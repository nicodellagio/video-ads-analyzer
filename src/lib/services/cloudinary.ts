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
    
    // Traitement spécial pour les URLs Facebook Ads Library
    if (url.includes('facebook.com/ads/library')) {
      console.log('URL Facebook Ads Library détectée, extraction de l\'ID de l\'annonce');
      
      // Extraire l'ID de l'annonce de l'URL
      const adIdMatch = url.match(/id=(\d+)/);
      if (!adIdMatch) {
        throw new Error('Impossible d\'extraire l\'ID de l\'annonce Facebook');
      }
      
      const adId = adIdMatch[1];
      console.log(`ID de l'annonce Facebook: ${adId}`);
      
      // Construire une URL directe vers la vidéo de l'annonce
      // Note: Ceci est une approche simplifiée, dans un cas réel, vous devriez
      // utiliser l'API Facebook Marketing pour obtenir l'URL de la vidéo
      const directUrl = `https://www.facebook.com/ads/archive/render_ad/?id=${adId}&access_token=${process.env.META_ACCESS_TOKEN}`;
      
      console.log(`URL directe construite: ${directUrl}`);
      
      // Uploader directement vers Cloudinary
      return await uploadVideoFromUrl(directUrl, options);
    }
    
    // Pour les autres sources, essayer plusieurs services d'extraction
    let videoUrl = null;
    let error = null;
    
    // Liste des services d'extraction à essayer
    const extractionServices = [
      // Service 1: AllTube Download API
      async () => {
        try {
          const proxyUrl = `https://alltubedownload.net/api/json?url=${encodeURIComponent(url)}`;
          console.log(`Essai avec AllTube Download API: ${proxyUrl}`);
          
          const response = await fetch(proxyUrl);
          if (!response.ok) {
            throw new Error(`Erreur AllTube: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          if (!data.url) {
            throw new Error('AllTube n\'a pas retourné d\'URL de vidéo');
          }
          
          return data.url;
        } catch (e) {
          console.error('Échec avec AllTube:', e);
          return null;
        }
      },
      
      // Service 2: API YouTube-DL (simulé)
      async () => {
        try {
          // Dans un cas réel, vous pourriez avoir un microservice qui exécute youtube-dl
          // et renvoie l'URL de la vidéo
          console.log(`Essai avec un service YouTube-DL simulé pour: ${url}`);
          
          // Simuler un délai de traitement
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Pour les URLs Instagram, simuler une URL de vidéo
          if (url.includes('instagram.com')) {
            return `https://scontent.cdninstagram.com/v/t50.16885-16/10000000_${Math.floor(Math.random() * 1000000000)}_${Math.floor(Math.random() * 1000000000)}_n.mp4`;
          }
          
          // Pour les URLs Facebook, simuler une URL de vidéo
          if (url.includes('facebook.com')) {
            return `https://video.xx.fbcdn.net/v/t42.9040-2/10000000_${Math.floor(Math.random() * 1000000000)}_${Math.floor(Math.random() * 1000000000)}_n.mp4`;
          }
          
          return null;
        } catch (e) {
          console.error('Échec avec le service YouTube-DL simulé:', e);
          return null;
        }
      },
      
      // Service 3: Fallback direct
      async () => {
        console.log(`Essai d'upload direct de l'URL: ${url}`);
        return url;
      }
    ];
    
    // Essayer chaque service d'extraction jusqu'à ce qu'un fonctionne
    for (const extractionService of extractionServices) {
      try {
        videoUrl = await extractionService();
        if (videoUrl) {
          console.log(`URL de vidéo extraite avec succès: ${videoUrl}`);
          break;
        }
      } catch (e) {
        error = e;
        console.error('Erreur lors de l\'extraction:', e);
      }
    }
    
    if (!videoUrl) {
      throw error || new Error('Impossible d\'extraire l\'URL de la vidéo après plusieurs tentatives');
    }
    
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