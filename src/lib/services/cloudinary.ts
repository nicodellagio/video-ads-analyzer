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
 * Télécharge une vidéo à partir d'une URL en utilisant RapidAPI comme service proxy
 * puis l'envoie vers Cloudinary
 */
export async function uploadVideoFromUrlViaProxy(url: string, source: string, options: any = {}) {
  try {
    console.log(`Téléchargement de vidéo via RapidAPI pour: ${url} (source: ${source})`);
    
    // Construire l'URL de l'API en fonction de la source
    let apiUrl;
    let apiHost;
    
    if (source === 'meta' || source === 'facebook') {
      apiHost = 'facebook-reel-and-video-downloader.p.rapidapi.com';
      apiUrl = `https://${apiHost}/app/main.php?url=${encodeURIComponent(url)}`;
    } else if (source === 'instagram') {
      apiHost = 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com';
      apiUrl = `https://${apiHost}/index?url=${encodeURIComponent(url)}`;
    } else if (source === 'tiktok') {
      apiHost = 'tiktok-downloader-download-tiktok-videos-without-watermark.p.rapidapi.com';
      apiUrl = `https://${apiHost}/analysis?url=${encodeURIComponent(url)}`;
    } else if (source === 'youtube') {
      apiHost = 'youtube-video-download-info.p.rapidapi.com';
      apiUrl = `https://${apiHost}/dl?id=${encodeURIComponent(url.includes('youtube.com/watch?v=') ? url.split('v=')[1].split('&')[0] : url)}`;
    } else {
      // Utiliser l'API Facebook comme fallback pour les autres sources
      apiHost = 'facebook-reel-and-video-downloader.p.rapidapi.com';
      apiUrl = `https://${apiHost}/app/main.php?url=${encodeURIComponent(url)}`;
    }
    
    console.log(`Appel de l'API RapidAPI: ${apiUrl}`);
    
    // Configurer les options de la requête
    const requestOptions = {
      method: 'GET',
      headers: {
        'x-rapidapi-key': 'f2737c0de4mshf7e328ef87ce454p1bdc04jsn3ad991abfed1',
        'x-rapidapi-host': apiHost
      }
    };
    
    // Faire une requête à l'API
    const response = await fetch(apiUrl, requestOptions);
    
    if (!response.ok) {
      throw new Error(`Erreur de l'API RapidAPI: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Réponse de RapidAPI:', JSON.stringify(data).substring(0, 200) + '...');
    
    // Extraire l'URL de la vidéo en fonction de la source
    let videoUrl;
    
    if (source === 'meta' || source === 'facebook') {
      if (data.success && data.links && data.links.length > 0) {
        // Prendre la meilleure qualité (généralement la première)
        videoUrl = data.links[0].url;
      } else {
        throw new Error('Aucune URL de vidéo trouvée dans la réponse de l\'API Facebook');
      }
    } else if (source === 'instagram') {
      if (data.media) {
        videoUrl = data.media;
      } else {
        throw new Error('Aucune URL de vidéo trouvée dans la réponse de l\'API Instagram');
      }
    } else if (source === 'tiktok') {
      if (data.video && data.video.noWatermark) {
        videoUrl = data.video.noWatermark;
      } else {
        throw new Error('Aucune URL de vidéo trouvée dans la réponse de l\'API TikTok');
      }
    } else if (source === 'youtube') {
      if (data.link && data.link.length > 0) {
        // Prendre le format mp4 de meilleure qualité
        const mp4Link = data.link.find((l: any) => l.type === 'mp4' && l.qualityLabel === '720p');
        videoUrl = mp4Link ? mp4Link.url : data.link[0].url;
      } else {
        throw new Error('Aucune URL de vidéo trouvée dans la réponse de l\'API YouTube');
      }
    } else {
      throw new Error(`Source non supportée: ${source}`);
    }
    
    if (!videoUrl) {
      throw new Error(`Impossible d'extraire l'URL de la vidéo pour la source ${source}`);
    }
    
    console.log(`URL de vidéo extraite: ${videoUrl}`);
    
    // Générer un ID unique pour la vidéo
    const videoId = options.public_id || uuidv4();
    
    // Uploader la vidéo vers Cloudinary
    const result = await cloudinary.uploader.upload(videoUrl, {
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
    console.error('Erreur lors de l\'upload via RapidAPI:', error);
    throw new Error(`Erreur lors de l'upload via RapidAPI: ${error instanceof Error ? error.message : String(error)}`);
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