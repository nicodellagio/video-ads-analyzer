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
    
    // Traitement spécial pour Facebook Ads Library
    if (url.includes('facebook.com/ads/library')) {
      console.log('URL Facebook Ads Library détectée, extraction de l\'ID de l\'annonce');
      
      // Extraire l'ID de l'annonce de l'URL
      const adIdMatch = url.match(/id=(\d+)/);
      if (!adIdMatch) {
        throw new Error('Impossible d\'extraire l\'ID de l\'annonce Facebook');
      }
      
      const adId = adIdMatch[1];
      console.log(`ID de l'annonce Facebook: ${adId}`);
      
      // Utiliser l'API SaveFrom.net pour extraire la vidéo
      const videoUrl = await extractVideoUrlWithSaveFrom(`https://www.facebook.com/ads/library/?id=${adId}`);
      
      if (!videoUrl) {
        throw new Error('Impossible d\'extraire l\'URL de la vidéo Facebook Ads Library');
      }
      
      console.log(`URL de vidéo extraite: ${videoUrl}`);
      
      // Uploader la vidéo vers Cloudinary
      return await uploadVideoFromUrl(videoUrl, {
        public_id: videoId,
        folder: `video-ads-facebook`,
        ...options
      });
    }
    
    // Traitement spécial pour Instagram
    if (url.includes('instagram.com')) {
      console.log('URL Instagram détectée, utilisation de SaveFrom.net');
      
      // Utiliser l'API SaveFrom.net pour extraire la vidéo
      const videoUrl = await extractVideoUrlWithSaveFrom(url);
      
      if (!videoUrl) {
        throw new Error('Impossible d\'extraire l\'URL de la vidéo Instagram');
      }
      
      console.log(`URL de vidéo extraite: ${videoUrl}`);
      
      // Uploader la vidéo vers Cloudinary
      return await uploadVideoFromUrl(videoUrl, {
        public_id: videoId,
        folder: `video-ads-instagram`,
        ...options
      });
    }
    
    // Pour les autres URLs, essayer d'abord l'upload direct via Cloudinary
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
      
      // Si l'upload direct échoue, essayer avec SaveFrom.net
      console.log('Tentative avec SaveFrom.net...');
      
      const videoUrl = await extractVideoUrlWithSaveFrom(url);
      
      if (!videoUrl) {
        throw new Error(`Impossible d'extraire l'URL de la vidéo depuis ${url}`);
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
 * Extrait l'URL directe d'une vidéo à partir d'une URL de page web
 * en utilisant l'API SaveFrom.net
 */
async function extractVideoUrlWithSaveFrom(url: string): Promise<string | null> {
  try {
    console.log(`Extraction de l'URL de vidéo avec SaveFrom.net pour: ${url}`);
    
    // Utiliser l'API SaveFrom.net
    const saveFromUrl = `https://worker.sf-tools.com/savefrom.php?url=${encodeURIComponent(url)}`;
    
    console.log(`Appel de l'API SaveFrom.net: ${saveFromUrl}`);
    
    const response = await fetch(saveFromUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://en.savefrom.net',
        'Referer': 'https://en.savefrom.net/'
      }
    });
    
    if (!response.ok) {
      console.error(`Erreur SaveFrom.net: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log('Réponse SaveFrom.net:', data);
    
    // Extraire l'URL de la vidéo de la réponse
    if (data && data.url) {
      return data.url;
    }
    
    if (data && data.urls && data.urls.length > 0) {
      // Prendre l'URL avec la meilleure qualité
      const bestUrl = data.urls.sort((a, b) => (b.quality || 0) - (a.quality || 0))[0];
      return bestUrl.url;
    }
    
    if (data && data.info && data.info.url) {
      return data.info.url;
    }
    
    if (data && data.links && data.links.length > 0) {
      // Prendre l'URL avec la meilleure qualité
      const bestLink = data.links.sort((a, b) => (b.quality || 0) - (a.quality || 0))[0];
      return bestLink.url || bestLink.link || bestLink.hd || bestLink.sd;
    }
    
    console.error('Format de réponse SaveFrom.net non reconnu:', data);
    return null;
  } catch (error) {
    console.error('Erreur lors de l\'extraction avec SaveFrom.net:', error);
    return null;
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