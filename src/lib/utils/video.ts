import { join } from 'path';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { UPLOAD_BASE_PATH, isServerless } from '@/lib/config/environment';

// Dossier de téléchargement
export const UPLOAD_DIR = isServerless 
  ? join('/tmp', 'uploads') 
  : join(process.cwd(), 'public', 'uploads');

// URL publique pour les uploads
export const UPLOAD_URL_PATH = '/uploads';

// Interface pour les métadonnées vidéo
export interface VideoMetadata {
  duration: string;
  format: string;
  size: string;
  url: string;
  originalName: string;
  id: string;
  width?: number;
  height?: number;
  codec?: string;
  bitrate?: number;
}

/**
 * S'assure que le dossier de téléchargement existe
 */
export async function ensureUploadDir(): Promise<void> {
  try {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }
  } catch (error) {
    console.error('Erreur lors de la création du dossier de téléchargement:', error);
    throw new Error(`Impossible de créer le dossier de téléchargement: ${(error as Error).message}`);
  }
}

/**
 * Obtient le chemin complet d'un fichier vidéo à partir de son ID
 * @param videoId ID de la vidéo
 * @param extension Extension du fichier (par défaut mp4)
 * @returns Chemin complet du fichier vidéo
 */
export function getVideoPath(videoId: string, extension: string = 'mp4'): string {
  return join(UPLOAD_DIR, `${videoId}.${extension}`);
}

/**
 * Sauvegarde un fichier vidéo sur le disque
 * @param file Fichier vidéo
 * @param fileName Nom du fichier
 * @returns Chemin du fichier sauvegardé
 */
export async function saveVideoFile(file: File, fileName: string): Promise<string> {
  await ensureUploadDir();
  const filePath = join(UPLOAD_DIR, fileName);
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, fileBuffer);
  return filePath;
}

/**
 * Supprime un fichier vidéo
 * @param fileName Nom du fichier à supprimer
 */
export async function deleteVideoFile(fileName: string): Promise<void> {
  const filePath = join(UPLOAD_DIR, fileName);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

/**
 * Version simplifiée pour obtenir les métadonnées d'une vidéo
 * Cette version n'utilise pas ffprobe pour éviter les problèmes d'importation
 * @param filePath Chemin du fichier vidéo
 * @returns Métadonnées de base du fichier
 */
export async function getVideoMetadata(filePath: string): Promise<any> {
  // Vérifier que nous sommes côté serveur
  if (typeof window !== 'undefined') {
    throw new Error('Cette fonction ne peut être exécutée que côté serveur');
  }
  
  try {
    // Obtenir les statistiques du fichier
    const stats = statSync(filePath);
    
    // Retourner des métadonnées de base
    return {
      format: {
        duration: 0, // Durée inconnue
        bit_rate: 0, // Bitrate inconnu
        size: stats.size
      },
      streams: [
        {
          codec_type: 'video',
          width: 1280, // Valeur par défaut
          height: 720, // Valeur par défaut
          codec_name: 'h264' // Valeur par défaut
        }
      ]
    };
  } catch (error) {
    console.error('Error getting metadata:', error);
    return {
      duration: 0,
      format: 'unknown',
      size: '0 B',
      url: filePath
    };
  }
}

/**
 * Formate la durée en HH:MM:SS
 * @param durationInSeconds Durée en secondes
 * @returns Durée formatée
 */
export function formatDuration(durationInSeconds: number): string {
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  const seconds = Math.floor(durationInSeconds % 60);
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
}

/**
 * Extrait et formate les métadonnées d'une vidéo
 * @param filePath Chemin du fichier vidéo
 * @param fileInfo Informations sur le fichier
 * @returns Métadonnées formatées de la vidéo
 */
export async function extractVideoMetadata(
  filePath: string, 
  fileInfo: { 
    size: number; 
    name: string; 
    id: string; 
    url: string;
    duration?: number;
    width?: number;
    height?: number;
    codec?: string;
    bitrate?: number;
  }
): Promise<VideoMetadata> {
  try {
    // Si des métadonnées sont déjà fournies par yt-dlp, les utiliser
    if (fileInfo.duration !== undefined && fileInfo.width !== undefined && fileInfo.height !== undefined) {
      return {
        duration: formatDuration(fileInfo.duration || 0),
        format: fileInfo.width && fileInfo.height ? `${fileInfo.width}x${fileInfo.height}` : '1280x720',
        size: `${(fileInfo.size / (1024 * 1024)).toFixed(1)} MB`,
        url: fileInfo.url,
        originalName: fileInfo.name,
        id: fileInfo.id,
        width: fileInfo.width || 1280,
        height: fileInfo.height || 720,
        codec: fileInfo.codec || 'h264',
        bitrate: fileInfo.bitrate || 0
      };
    }
    
    // Sinon, extraire les métadonnées du fichier
    const metadata = await getVideoMetadata(filePath);
    const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
    
    return {
      duration: formatDuration(metadata.format.duration || 0),
      format: videoStream ? `${videoStream.width}x${videoStream.height}` : '1280x720',
      size: `${(fileInfo.size / (1024 * 1024)).toFixed(1)} MB`,
      url: fileInfo.url,
      originalName: fileInfo.name,
      id: fileInfo.id,
      width: videoStream?.width || 1280,
      height: videoStream?.height || 720,
      codec: videoStream?.codec_name || 'h264',
      bitrate: metadata.format.bit_rate ? Math.round(metadata.format.bit_rate / 1000) : 0
    };
  } catch (error) {
    console.error('Erreur lors de l\'extraction des métadonnées:', error);
    
    // Métadonnées par défaut si l'extraction échoue
    return {
      duration: '00:00:30', // Valeur par défaut
      format: '1280x720', // Valeur par défaut
      size: `${(fileInfo.size / (1024 * 1024)).toFixed(1)} MB`,
      url: fileInfo.url,
      originalName: fileInfo.name,
      id: fileInfo.id,
      width: 1280,
      height: 720,
      codec: 'h264',
      bitrate: 0
    };
  }
} 