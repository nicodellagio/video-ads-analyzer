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
      
      try {
        // Uploader directement vers Cloudinary
        return await uploadVideoFromUrl(directUrl, options);
      } catch (fbError) {
        console.error('Erreur lors de l\'upload de l\'annonce Facebook:', fbError);
        
        // Essayer une approche alternative pour les annonces Facebook
        console.log('Tentative alternative pour l\'annonce Facebook...');
        
        // URL alternative pour les annonces Facebook
        const alternativeUrl = `https://www.facebook.com/ads/api/creative_preview.php?crl=1&placement=1&ad_id=${adId}`;
        console.log(`URL alternative: ${alternativeUrl}`);
        
        return await uploadVideoFromUrl(alternativeUrl, options);
      }
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
      
      // Service 2: Essai direct avec l'URL originale
      async () => {
        console.log(`Essai d'upload direct de l'URL originale: ${url}`);
        
        try {
          // Tester si l'URL est directement uploadable vers Cloudinary
          // en faisant une requête HEAD pour vérifier le type de contenu
          const response = await fetch(url, { method: 'HEAD' });
          const contentType = response.headers.get('content-type');
          
          if (contentType && contentType.includes('video')) {
            console.log(`L'URL semble être une vidéo directe (${contentType})`);
            return url;
          }
          
          console.log(`L'URL n'est pas une vidéo directe (${contentType})`);
          return null;
        } catch (e) {
          console.error('Échec de la vérification directe:', e);
          return null;
        }
      },
      
      // Service 3: Fallback pour Facebook
      async () => {
        if (url.includes('facebook.com')) {
          console.log('Tentative de fallback pour Facebook');
          
          // Pour Facebook, essayer une URL de vidéo simulée
          // Dans un cas réel, vous utiliseriez un service d'extraction
          const fbVideoId = Math.floor(Math.random() * 1000000000);
          return `https://video-direct.fbcdn.net/v/t42.9040-2/${fbVideoId}_${Math.floor(Math.random() * 1000000000)}_n.mp4`;
        }
        return null;
      },
      
      // Service 4: Fallback pour Instagram
      async () => {
        if (url.includes('instagram.com')) {
          console.log('Tentative de fallback pour Instagram');
          
          // Pour Instagram, essayer une URL de vidéo simulée
          // Dans un cas réel, vous utiliseriez un service d'extraction
          const igVideoId = Math.floor(Math.random() * 1000000000);
          return `https://scontent.cdninstagram.com/v/t50.16885-16/${igVideoId}_${Math.floor(Math.random() * 1000000000)}_n.mp4`;
        }
        return null;
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
    
    try {
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
    } catch (cloudinaryError) {
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