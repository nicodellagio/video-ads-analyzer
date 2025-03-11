import { join } from 'path';
import { writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { ensureUploadDir, extractVideoMetadata } from './video';
import { getFacebookVideoInfo, getInstagramVideoInfo, downloadVideo } from './meta-api';
import type { VideoMetadata } from './video';
import { USE_LOCAL_STORAGE } from './constants';
import { uploadToS3 } from '@/lib/services/s3';
import { S3_PREFIX } from './video';

// Types de sources vidéo supportées
export type VideoSource = 'instagram' | 'meta' | 'youtube' | 'tiktok';

// Répertoire temporaire pour Vercel (ne pas utiliser /var/task qui est en lecture seule)
const TEMP_DIR = process.env.VERCEL ? '/tmp' : join(process.cwd(), 'public', 'uploads');

// Interface pour les options d'extraction
interface ExtractionOptions {
  url: string;
  source: VideoSource;
}

/**
 * Valide une URL en fonction de la source
 * @param url URL à valider
 * @param source Type de source (instagram, meta, etc.)
 * @returns Booléen indiquant si l'URL est valide
 */
export function validateUrl(url: string, source?: VideoSource): boolean {
  // Pour simplifier, on accepte toutes les URLs
  return true;
}

/**
 * Extrait une vidéo à partir d'une URL en utilisant yt-dlp
 * @param options Options d'extraction (url, source)
 * @returns Métadonnées de la vidéo extraite
 */
export async function extractVideoFromUrl(options: ExtractionOptions): Promise<VideoMetadata> {
  // Cette fonction ne doit être exécutée que côté serveur
  if (typeof window !== 'undefined') {
    throw new Error('Cette fonction ne peut être exécutée que côté serveur');
  }

  const { url, source } = options;
  
  // Valider l'URL
  if (!validateUrl(url, source)) {
    throw new Error(`URL invalide for the source ${source}`);
  }
  
  // En production sur Vercel, on ne peut pas utiliser le stockage local
  if (!USE_LOCAL_STORAGE) {
    throw new Error('Direct file extraction not supported in production. Use an external service.');
  }
  
  try {
    // Importer les modules côté serveur uniquement
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // S'assurer que le dossier de téléchargement existe
    await ensureUploadDir();
    
    // Générer un ID unique pour la vidéo
    const videoId = uuidv4();
    const outputPath = join(process.cwd(), 'public', 'uploads', `${videoId}.mp4`);
    
    console.log('Extraction of video from:', url);
    console.log('Output path:', outputPath);
    
    // Construire la commande yt-dlp
    const ytdlpCommand = `yt-dlp "${url}" -o "${outputPath}" --format "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --no-check-certificate --no-warnings --prefer-free-formats --add-header "referer:https://www.google.com" --add-header "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --verbose`;
    
    // Exécuter la commande
    console.log('Execution of the command:', ytdlpCommand);
    const { stdout, stderr } = await execAsync(ytdlpCommand);
    console.log('yt-dlp stdout:', stdout);
    if (stderr) console.error('yt-dlp stderr:', stderr);
    
    // Vérifier si le fichier a été créé
    const fs = await import('fs');
    if (!fs.existsSync(outputPath)) {
      throw new Error('Le fichier vidéo n\'a pas été créé');
    }
    
    // Obtenir les informations de la vidéo
    const infoCommand = `yt-dlp "${url}" --dump-json --no-check-certificate --no-warnings`;
    console.log('Récupération des informations:', infoCommand);
    
    let info;
    try {
      const { stdout: infoStdout } = await execAsync(infoCommand);
      info = JSON.parse(infoStdout);
    } catch (infoError) {
      console.error('Erreur lors de la récupération des informations:', infoError);
      // Utiliser des informations par défaut
      info = {
        filesize: fs.statSync(outputPath).size,
        title: url.split('/').pop() || 'video'
      };
    }
    
    // URL publique de la vidéo
    const videoUrl = `/uploads/${videoId}.mp4`;
    
    // Extraire les métadonnées de la vidéo téléchargée
    const videoMetadata = await extractVideoMetadata(outputPath, {
      size: info.filesize || fs.statSync(outputPath).size,
      name: info.title || url.split('/').pop() || 'video',
      id: videoId,
      url: videoUrl
    });
    
    return videoMetadata;
  } catch (error) {
    console.error('Error during video extraction:', error);
    throw new Error(`Error during video extraction: ${(error as Error).message}`);
  }
}

/**
 * Fonction de secours pour extraire une vidéo en cas d'échec de yt-dlp
 * Utilise got pour télécharger directement la vidéo si possible
 * @param url URL de la vidéo
 * @param source Type de source
 * @returns Métadonnées de la vidéo
 */
export async function fallbackExtraction(url: string, source: VideoSource): Promise<VideoMetadata> {
  // Cette fonction ne doit être exécutée que côté serveur
  if (typeof window !== 'undefined') {
    throw new Error('Cette fonction ne peut être exécutée que côté serveur');
  }
  
  try {
    // Importer got dynamiquement (uniquement côté serveur)
    const got = (await import('got')).default;
    
    // S'assurer que le dossier de téléchargement existe
    await ensureUploadDir();
    
    // Générer un ID unique pour la vidéo
    const videoId = uuidv4();
    const outputPath = join(process.cwd(), 'public', 'uploads', `${videoId}.mp4`);
    
    console.log('Extraction of fallback from:', url);
    
    // Télécharger la vidéo directement
    const response = await got(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'referer': 'https://www.google.com'
      },
      responseType: 'buffer'
    });
    
    // Sauvegarder la vidéo
    await writeFile(outputPath, response.body);
    
    // URL publique de la vidéo
    const videoUrl = `/uploads/${videoId}.mp4`;
    
    // Extraire les métadonnées de la vidéo téléchargée
    const videoMetadata = await extractVideoMetadata(outputPath, {
      size: response.body.length,
      name: url.split('/').pop() || 'video',
      id: videoId,
      url: videoUrl
    });
    
    return videoMetadata;
  } catch (error) {
    console.error('Erreur lors de l\'extraction de secours:', error);
    throw new Error(`Erreur lors de l'extraction de secours: ${(error as Error).message}`);
  }
}

/**
 * Méthode spécifique pour extraire les vidéos Facebook
 * @param url URL de la vidéo Facebook
 * @returns Métadonnées de la vidéo
 */
export async function extractFacebookVideo(url: string): Promise<VideoMetadata> {
  // Cette fonction ne doit être exécutée que côté serveur
  if (typeof window !== 'undefined') {
    throw new Error('Cette fonction ne peut être exécutée que côté serveur');
  }
  
  try {
    // Importer les modules côté serveur uniquement
    const fs = await import('fs');
    const fsPromises = await import('fs/promises');
    
    // S'assurer que le dossier temporaire existe
    if (!fs.existsSync(TEMP_DIR)) {
      await fsPromises.mkdir(TEMP_DIR, { recursive: true });
    }
    
    console.log('Extraction of video Facebook from:', url);
    
    // Récupérer les informations de la vidéo via l'API Meta
    const videoInfoResponse = await getFacebookVideoInfo(url);
    
    if (!videoInfoResponse.success) {
      throw new Error(videoInfoResponse.error || 'Échec de la récupération des informations de la vidéo');
    }
    
    const videoInfo = videoInfoResponse.data;
    
    // Utiliser l'ID généré par getFacebookVideoInfo
    const videoId = videoInfo.id;
    const outputPath = join(TEMP_DIR, `${videoId}.mp4`);
    
    // Si nous sommes en production sur Vercel et que le fichier a été téléchargé, le sauvegarder sur S3
    let publicUrl;
    let s3Key;
    
    if (!USE_LOCAL_STORAGE && fs.existsSync(outputPath)) {
      // Sauvegarder le fichier sur S3
      const result = await saveExtractedFile(outputPath, `${videoId}.mp4`);
      publicUrl = result.url;
      s3Key = result.s3Key;
    } else {
      // L'URL de la vidéo est déjà locale (commence par /uploads/)
      publicUrl = videoInfo.url;
    }
    
    // Vérifier si le fichier existe (seulement en mode local)
    if (USE_LOCAL_STORAGE && !fs.existsSync(outputPath)) {
      throw new Error(`Le fichier vidéo n'existe pas à l'emplacement attendu: ${outputPath}`);
    }
    
    // Extraire les métadonnées de la vidéo téléchargée
    // En mode S3, outputPath n'existe peut-être plus, mais la fonction gère ce cas
    const videoMetadata = await extractVideoMetadata(outputPath, {
      size: USE_LOCAL_STORAGE ? fs.statSync(outputPath).size : videoInfo.size || 0,
      name: videoInfo.title || `facebook_video_${videoId}`,
      id: videoId,
      url: publicUrl,
      duration: videoInfo.duration,
      width: videoInfo.width,
      height: videoInfo.height,
      s3Key
    });
    
    return videoMetadata;
  } catch (error) {
    console.error('Erreur lors de l\'extraction de la vidéo Facebook:', error);
    throw new Error(`Erreur lors de l'extraction de la vidéo Facebook: ${(error as Error).message}`);
  }
}

/**
 * Méthode spécifique pour extraire les vidéos Instagram
 * @param url URL de la vidéo Instagram
 * @returns Métadonnées de la vidéo
 */
export async function extractInstagramVideo(url: string): Promise<VideoMetadata> {
  // Cette fonction ne doit être exécutée que côté serveur
  if (typeof window !== 'undefined') {
    throw new Error('Cette fonction ne peut être exécutée que côté serveur');
  }
  
  try {
    // Importer les modules côté serveur uniquement
    const fs = await import('fs');
    const fsPromises = await import('fs/promises');
    
    // S'assurer que le dossier temporaire existe
    if (!fs.existsSync(TEMP_DIR)) {
      await fsPromises.mkdir(TEMP_DIR, { recursive: true });
    }
    
    console.log('Extraction of video Instagram from:', url);
    
    // Récupérer les informations de la vidéo via l'API Meta
    const videoInfoResponse = await getInstagramVideoInfo(url);
    
    if (!videoInfoResponse.success) {
      throw new Error(videoInfoResponse.error || 'Échec de la récupération des informations de la vidéo');
    }
    
    const videoInfo = videoInfoResponse.data;
    
    // Utiliser l'ID généré par getInstagramVideoInfo
    const videoId = videoInfo.id;
    const outputPath = join(TEMP_DIR, `${videoId}.mp4`);
    
    // Si nous sommes en production sur Vercel et que le fichier a été téléchargé, le sauvegarder sur S3
    let publicUrl;
    let s3Key;
    
    if (!USE_LOCAL_STORAGE && fs.existsSync(outputPath)) {
      // Sauvegarder le fichier sur S3
      const result = await saveExtractedFile(outputPath, `${videoId}.mp4`);
      publicUrl = result.url;
      s3Key = result.s3Key;
    } else {
      // L'URL de la vidéo est déjà locale (commence par /uploads/)
      publicUrl = videoInfo.url;
    }
    
    // Vérifier si le fichier existe (seulement en mode local)
    if (USE_LOCAL_STORAGE && !fs.existsSync(outputPath)) {
      throw new Error(`Le fichier vidéo n'existe pas à l'emplacement attendu: ${outputPath}`);
    }
    
    // Extraire les métadonnées de la vidéo téléchargée
    // En mode S3, outputPath n'existe peut-être plus, mais la fonction gère ce cas
    const videoMetadata = await extractVideoMetadata(outputPath, {
      size: USE_LOCAL_STORAGE ? fs.statSync(outputPath).size : videoInfo.size || 0,
      name: videoInfo.title || `instagram_video_${videoId}`,
      id: videoId,
      url: publicUrl,
      duration: videoInfo.duration,
      width: videoInfo.width,
      height: videoInfo.height,
      s3Key
    });
    
    return videoMetadata;
  } catch (error) {
    console.error('Erreur lors de l\'extraction de la vidéo Instagram:', error);
    throw new Error(`Erreur lors de l'extraction de la vidéo Instagram: ${(error as Error).message}`);
  }
}

/**
 * Sauvegarde un fichier sur S3 ou sur le disque local selon l'environnement
 * @param filePath Chemin local du fichier
 * @param fileName Nom du fichier
 * @param contentType Type de contenu (MIME)
 * @returns Informations sur le fichier sauvegardé
 */
export async function saveExtractedFile(filePath: string, fileName: string, contentType = 'video/mp4'): Promise<{ url: string; s3Key?: string }> {
  // En production sur Vercel, on utilise S3
  if (!USE_LOCAL_STORAGE) {
    try {
      // Importer fs dynamiquement (seulement disponible côté serveur)
      const fs = await import('fs');
      
      // Vérifier si le fichier existe
      if (!fs.existsSync(filePath)) {
        console.warn(`Le fichier ${filePath} n'existe pas, impossible de l'uploader sur S3`);
        return { url: `/api/placeholder/${fileName}` }; // URL de remplacement pour éviter les erreurs
      }
      
      const buffer = fs.readFileSync(filePath);
      
      // Générer une clé S3
      const s3Key = `${S3_PREFIX}${fileName}`;
      
      console.log(`Uploading file to S3: ${s3Key}`);
      
      // Uploader sur S3
      const { url, key } = await uploadToS3(buffer, s3Key, contentType);
      
      // Supprimer le fichier local temporaire
      try {
        fs.unlinkSync(filePath);
        console.log(`Temporary file deleted: ${filePath}`);
      } catch (err) {
        console.warn(`Failed to delete temporary file ${filePath}:`, err);
      }
      
      return { url, s3Key: key };
    } catch (error) {
      console.error('Erreur lors de l\'upload sur S3:', error);
      throw new Error(`Erreur lors de l'upload sur S3: ${(error as Error).message}`);
    }
  }
  
  // En développement, retourner l'URL locale
  return { url: `/uploads/${fileName}` };
} 