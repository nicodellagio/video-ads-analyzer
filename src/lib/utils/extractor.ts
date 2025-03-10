import { join } from 'path';
import { writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { ensureUploadDir, extractVideoMetadata, UPLOAD_DIR, UPLOAD_URL_PATH } from './video';
import { getFacebookVideoInfo, getInstagramVideoInfo } from './meta-api';
import type { VideoMetadata } from './video';
import { isServerless } from '@/lib/config/environment';
import { uploadVideoFromUrl, uploadVideoFromUrlViaProxy, formatFileSize } from '@/lib/services/cloudinary';

// Types de sources vidéo supportées
export type VideoSource = 'instagram' | 'meta' | 'youtube' | 'tiktok';

// Interface pour les options d'extraction
interface ExtractionOptions {
  url: string;
  source: VideoSource;
}

/**
 * Valide une URL en fonction de la source
 * @param url URL à valider
 * @returns Booléen indiquant si l'URL est valide
 */
export function validateUrl(url: string): boolean {
  // Pour simplifier, on accepte toutes les URLs
  return true;
}

/**
 * Extrait une vidéo à partir d'une URL en utilisant Cloudinary ou yt-dlp
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
  if (!validateUrl(url)) {
    throw new Error(`URL invalide for the source ${source}`);
  }
  
  try {
    // En environnement serverless (Vercel), utiliser Cloudinary
    if (isServerless) {
      console.log('Utilisation de Cloudinary pour l\'extraction de vidéo en environnement serverless');
      
      // Générer un ID unique pour la vidéo
      const videoId = uuidv4();
      
      // Déterminer si nous devons utiliser le proxy ou l'upload direct
      let cloudinaryResult;
      
      // Pour les URLs qui nécessitent une extraction (Facebook, Instagram, etc.)
      if (source === 'meta' || source === 'instagram' || source === 'youtube' || source === 'tiktok') {
        console.log('Utilisation du proxy pour extraire la vidéo');
        cloudinaryResult = await uploadVideoFromUrlViaProxy(url, source, {
          public_id: videoId,
          folder: `video-ads-${source}`
        });
      } else {
        // Pour les URLs directes
        cloudinaryResult = await uploadVideoFromUrl(url, {
          public_id: videoId,
          folder: 'video-ads'
        });
      }
      
      // Convertir le résultat au format VideoMetadata
      return {
        id: videoId,
        url: cloudinaryResult.url,
        duration: cloudinaryResult.duration.toString(),
        format: `${cloudinaryResult.width}x${cloudinaryResult.height}`,
        size: formatFileSize(cloudinaryResult.size),
        originalName: cloudinaryResult.originalName,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height
      };
    }

    // En environnement local, utiliser yt-dlp
    // Importer les modules côté serveur uniquement
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // S'assurer que le dossier de téléchargement existe
    await ensureUploadDir();
    
    // Générer un ID unique pour la vidéo
    const videoId = uuidv4();
    const outputPath = join(UPLOAD_DIR, `${videoId}.mp4`);
    
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
    // En environnement serverless (Vercel), utiliser Cloudinary via proxy
    if (isServerless) {
      console.log('Utilisation de Cloudinary pour l\'extraction de vidéo Facebook en environnement serverless');
      
      // Générer un ID unique pour la vidéo
      const videoId = uuidv4();
      
      // Utiliser le proxy pour extraire la vidéo Facebook
      const cloudinaryResult = await uploadVideoFromUrlViaProxy(url, 'facebook', {
        public_id: videoId,
        folder: 'video-ads-facebook'
      });
      
      // Convertir le résultat au format VideoMetadata
      return {
        id: videoId,
        url: cloudinaryResult.url,
        duration: cloudinaryResult.duration.toString(),
        format: `${cloudinaryResult.width}x${cloudinaryResult.height}`,
        size: formatFileSize(cloudinaryResult.size),
        originalName: cloudinaryResult.originalName || `facebook_video_${videoId}`,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height
      };
    }
    
    // En environnement local, utiliser l'API Meta
    console.log('Extraction of video Facebook from:', url);
    
    // Récupérer les informations de la vidéo via l'API Meta
    const videoInfoResponse = await getFacebookVideoInfo(url);
    
    if (!videoInfoResponse.success) {
      throw new Error(videoInfoResponse.error || 'Échec de la récupération des informations de la vidéo');
    }
    
    const videoInfo = videoInfoResponse.data;
    
    // Utiliser l'ID généré par getFacebookVideoInfo
    const videoId = videoInfo.id;
    const outputPath = join(process.cwd(), 'public', 'uploads', `${videoId}.mp4`);
    
    // L'URL de la vidéo est déjà locale (commence par /uploads/)
    // Pas besoin de télécharger à nouveau
    const publicUrl = videoInfo.url;
    
    // Vérifier si le fichier existe
    const fs = await import('fs');
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Le fichier vidéo n'existe pas à l'emplacement attendu: ${outputPath}`);
    }
    
    // Extraire les métadonnées de la vidéo téléchargée
    const videoMetadata = await extractVideoMetadata(outputPath, {
      size: fs.statSync(outputPath).size,
      name: videoInfo.title || `facebook_video_${videoId}`,
      id: videoId,
      url: publicUrl,
      duration: videoInfo.duration,
      width: videoInfo.width,
      height: videoInfo.height
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
    // En environnement serverless (Vercel), utiliser Cloudinary
    if (isServerless) {
      console.log('Utilisation de Cloudinary pour l\'extraction de vidéo Instagram en environnement serverless');
      
      // Vérifier si l'URL est une URL Instagram qui nécessite une authentification
      if (url.includes('instagram.com') && !url.includes('cdninstagram.com')) {
        console.log('URL Instagram standard détectée, utilisation du proxy pour extraction');
      }
      
      // Générer un ID unique pour la vidéo
      const videoId = uuidv4();
      
      // Utiliser le proxy pour extraire la vidéo Instagram
      const cloudinaryResult = await uploadVideoFromUrlViaProxy(url, 'instagram', {
        public_id: videoId,
        folder: 'video-ads-instagram'
      });
      
      // Convertir le résultat au format VideoMetadata
      return {
        id: videoId,
        url: cloudinaryResult.url,
        duration: cloudinaryResult.duration.toString(),
        format: `${cloudinaryResult.width}x${cloudinaryResult.height}`,
        size: formatFileSize(cloudinaryResult.size),
        originalName: cloudinaryResult.originalName || `instagram_video_${videoId}`,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height
      };
    }
    
    // En environnement local, utiliser l'API Meta
    console.log('Extraction of video Instagram from:', url);
    
    // Récupérer les informations de la vidéo via l'API Meta
    const videoInfoResponse = await getInstagramVideoInfo(url);
    
    if (!videoInfoResponse.success) {
      throw new Error(videoInfoResponse.error || 'Échec de la récupération des informations de la vidéo');
    }
    
    const videoInfo = videoInfoResponse.data;
    
    // Utiliser l'ID généré par getInstagramVideoInfo
    const videoId = videoInfo.id;
    const outputPath = join(process.cwd(), 'public', 'uploads', `${videoId}.mp4`);
    
    // L'URL de la vidéo est déjà locale (commence par /uploads/)
    // Pas besoin de télécharger à nouveau
    const publicUrl = videoInfo.url;
    
    // Vérifier si le fichier existe
    const fs = await import('fs');
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Le fichier vidéo n'existe pas à l'emplacement attendu: ${outputPath}`);
    }
    
    // Extraire les métadonnées de la vidéo téléchargée
    const videoMetadata = await extractVideoMetadata(outputPath, {
      size: fs.statSync(outputPath).size,
      name: videoInfo.title || `instagram_video_${videoId}`,
      id: videoId,
      url: publicUrl,
      duration: videoInfo.duration,
      width: videoInfo.width,
      height: videoInfo.height
    });
    
    return videoMetadata;
  } catch (error) {
    console.error('Erreur lors de l\'extraction de la vidéo Instagram:', error);
    throw new Error(`Erreur lors de l'extraction de la vidéo Instagram: ${(error as Error).message}`);
  }
} 