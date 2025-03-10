import { v2 as cloudinary } from 'cloudinary';
import { formatDuration } from '@/lib/utils/video';
import { v4 as uuidv4 } from 'uuid';

// Configuration de Cloudinary avec vos identifiants
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dbsbvpikt',
  api_key: process.env.CLOUDINARY_API_KEY || '287673542476712',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'U4iI9m2ksL84QgjJY1KUmD4Dn1A'
});

/**
 * Formate la taille du fichier en unités lisibles (KB, MB, GB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Télécharge une vidéo à partir d'une URL vers Cloudinary
 */
export async function uploadVideoFromUrl(url: string, options: any = {}) {
  try {
    console.log(`Uploading video from URL to Cloudinary: ${url}`);
    
    // Vérifier si l'URL est valide
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      throw new Error(`URL invalide: ${url}`);
    }
    
    // Ajouter des options pour améliorer la compatibilité
    const uploadOptions = {
      resource_type: 'video',
      fetch_format: 'auto',
      quality: 'auto',
      flags: 'attachment',
      ...options
    };
    
    console.log('Options d\'upload:', uploadOptions);
    
    const result = await cloudinary.uploader.upload(url, uploadOptions);
    
    console.log('Cloudinary upload result:', result);
    
    return {
      id: result.public_id,
      url: result.secure_url,
      format: result.format,
      duration: result.duration || 0,
      width: result.width,
      height: result.height,
      size: result.bytes,
      originalName: options.public_id || url.split('/').pop() || 'video'
    };
  } catch (error) {
    console.error('Erreur lors de l\'upload vers Cloudinary:', error);
    
    // Fournir des informations plus détaillées sur l'erreur
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Erreur lors de l'upload vers Cloudinary: ${errorMessage}`);
  }
}

/**
 * Télécharge une vidéo à partir d'une URL en utilisant un service proxy
 * puis l'envoie vers Cloudinary
 */
export async function uploadVideoFromUrlViaProxy(url: string, source: string, options: any = {}) {
  try {
    console.log(`Téléchargement de vidéo via proxy pour: ${url} (source: ${source})`);
    
    // Utiliser un service proxy pour extraire la vidéo
    // Nous utilisons AllTube Download API comme exemple
    // Vous pouvez remplacer cela par n'importe quel service d'extraction de vidéo
    const proxyUrl = `https://alltubedownload.net/api/json?url=${encodeURIComponent(url)}`;
    
    console.log(`Appel du service proxy: ${proxyUrl}`);
    
    // Faire une requête au service proxy
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Erreur du service proxy: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.url) {
      throw new Error('Le service proxy n\'a pas retourné d\'URL de vidéo');
    }
    
    console.log(`URL de vidéo extraite: ${data.url}`);
    
    // Générer un ID unique pour la vidéo
    const videoId = options.public_id || uuidv4();
    
    // Uploader la vidéo vers Cloudinary
    const result = await cloudinary.uploader.upload(data.url, {
      resource_type: 'video',
      public_id: videoId,
      folder: `video-ads-${source}`,
      ...options
    });
    
    console.log('Cloudinary upload result:', result);
    
    return {
      id: result.public_id,
      url: result.secure_url,
      format: result.format,
      duration: result.duration || 0,
      width: result.width,
      height: result.height,
      size: result.bytes,
      originalName: options.public_id || url.split('/').pop() || 'video'
    };
  } catch (error) {
    console.error('Erreur lors de l\'upload via proxy:', error);
    throw new Error(`Erreur lors de l'upload via proxy: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Récupère les informations d'une vidéo Cloudinary
 */
export async function getVideoInfo(publicId: string) {
  try {
    const result = await cloudinary.api.resource(publicId, { resource_type: 'video' });
    
    return {
      id: result.public_id,
      url: result.secure_url,
      format: result.format,
      duration: result.duration || 0,
      width: result.width,
      height: result.height,
      size: result.bytes,
      originalName: result.public_id.split('/').pop() || 'video'
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des informations de la vidéo:', error);
    throw new Error(`Erreur lors de la récupération des informations de la vidéo: ${(error as Error).message}`);
  }
}

/**
 * Supprime une vidéo de Cloudinary
 */
export async function deleteVideo(publicId: string) {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    return result.result === 'ok';
  } catch (error) {
    console.error('Erreur lors de la suppression de la vidéo:', error);
    throw new Error(`Erreur lors de la suppression de la vidéo: ${(error as Error).message}`);
  }
} 