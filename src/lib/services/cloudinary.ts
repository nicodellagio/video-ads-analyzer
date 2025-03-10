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
    
    try {
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
    } catch (cloudinaryError) {
      // Gérer spécifiquement les erreurs Cloudinary
      console.error('Erreur Cloudinary spécifique:', cloudinaryError);
      
      // Formater l'erreur Cloudinary de manière plus détaillée
      let errorMessage = 'Erreur inconnue';
      
      if (cloudinaryError instanceof Error) {
        errorMessage = cloudinaryError.message;
      } else if (typeof cloudinaryError === 'object' && cloudinaryError !== null) {
        try {
          errorMessage = JSON.stringify(cloudinaryError);
        } catch (e) {
          errorMessage = 'Erreur non sérialisable';
        }
      } else {
        errorMessage = String(cloudinaryError);
      }
      
      throw new Error(`Erreur Cloudinary: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Erreur lors de l\'upload vers Cloudinary:', error);
    
    // Fournir des informations plus détaillées sur l'erreur
    let errorMessage = 'Erreur inconnue';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        errorMessage = 'Erreur non sérialisable';
      }
    } else {
      errorMessage = String(error);
    }
    
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
    
    // Générer un ID unique pour la vidéo
    const videoId = options.public_id || uuidv4();
    
    // Utiliser l'API Cloudinary directement avec fetch_url
    // Cette approche permet à Cloudinary de gérer l'extraction de la vidéo
    try {
      console.log('Utilisation de l\'API Cloudinary avec fetch_url');
      
      const uploadOptions = {
        resource_type: 'video',
        public_id: videoId,
        folder: `video-ads-${source}`,
        fetch_format: 'auto',
        quality: 'auto',
        type: 'fetch',
        ...options
      };
      
      console.log('Options d\'upload:', uploadOptions);
      
      // Utiliser l'API Cloudinary pour récupérer la vidéo à partir de l'URL
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
    } catch (cloudinaryError) {
      console.error('Erreur lors de l\'upload direct via Cloudinary:', cloudinaryError);
      
      // Si l'upload direct échoue, essayer avec un service d'extraction externe
      console.log('Tentative avec un service d\'extraction externe...');
      
      // Utiliser un service d'extraction de vidéos public
      // Nous utilisons RapidAPI YouTube Downloader comme exemple
      const rapidApiUrl = 'https://youtube-media-downloader.p.rapidapi.com/v2/video/details';
      const encodedUrl = encodeURIComponent(url);
      
      const rapidApiOptions = {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '7c0d65c688msh5e2c8e200a9e5a9p1e9c9djsn5a2be5d2fd7d',
          'X-RapidAPI-Host': 'youtube-media-downloader.p.rapidapi.com'
        }
      };
      
      console.log(`Appel du service RapidAPI pour: ${url}`);
      
      try {
        const response = await fetch(`${rapidApiUrl}?url=${encodedUrl}`, rapidApiOptions);
        
        if (!response.ok) {
          throw new Error(`Erreur RapidAPI: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.url && !data.formats && !data.streamingData) {
          throw new Error('Le service RapidAPI n\'a pas retourné d\'URL de vidéo');
        }
        
        // Extraire l'URL de la vidéo de la réponse
        let videoUrl = null;
        
        if (data.url) {
          videoUrl = data.url;
        } else if (data.formats && data.formats.length > 0) {
          // Prendre le format avec la meilleure qualité
          const bestFormat = data.formats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
          videoUrl = bestFormat.url;
        } else if (data.streamingData && data.streamingData.formats && data.streamingData.formats.length > 0) {
          // Format YouTube
          const bestFormat = data.streamingData.formats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
          videoUrl = bestFormat.url;
        }
        
        if (!videoUrl) {
          throw new Error('Impossible d\'extraire l\'URL de la vidéo de la réponse RapidAPI');
        }
        
        console.log(`URL de vidéo extraite: ${videoUrl}`);
        
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
      } catch (rapidApiError) {
        console.error('Erreur lors de l\'extraction via RapidAPI:', rapidApiError);
        
        // Si RapidAPI échoue, essayer avec un service de secours
        console.log('Tentative avec un service de secours...');
        
        // Utiliser un service de secours (simulé ici)
        // Dans un cas réel, vous pourriez utiliser un autre service d'extraction
        if (source === 'meta' || url.includes('facebook.com')) {
          throw new Error('L\'extraction de vidéos Facebook nécessite un service d\'extraction spécialisé. Veuillez utiliser l\'URL directe de la vidéo.');
        } else if (source === 'instagram' || url.includes('instagram.com')) {
          throw new Error('L\'extraction de vidéos Instagram nécessite un service d\'extraction spécialisé. Veuillez utiliser l\'URL directe de la vidéo.');
        } else {
          throw new Error(`Impossible d'extraire la vidéo depuis ${url}. Veuillez utiliser l'URL directe de la vidéo.`);
        }
      }
    }
  } catch (error) {
    console.error('Erreur lors de l\'upload via proxy:', error);
    
    // Formater l'erreur de manière plus détaillée
    let errorMessage = 'Erreur inconnue';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        errorMessage = 'Erreur non sérialisable';
      }
    } else {
      errorMessage = String(error);
    }
    
    throw new Error(`Erreur lors de l'upload via proxy: ${errorMessage}`);
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