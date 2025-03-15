import { ApifyClient } from 'apify-client';

// Configuration Apify
const APIFY_USER_ID = process.env.APIFY_USER_ID || 'dsFwuwfQ91TtdCjbZ';
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN || '';

// Initialiser le client Apify avec le token API
const apifyClient = new ApifyClient({
  token: APIFY_API_TOKEN,
});

// IDs des acteurs Apify
const FACEBOOK_PAGE_SCRAPER_ID = 'JJghSZmShuco4j9gJ'; // Acteur personnalisé pour les pages Facebook
// Acteur pour Facebook Ad Library - utiliser l'acteur qui fonctionne correctement
const FACEBOOK_AD_LIBRARY_SCRAPER_ID = 'apify/facebook-ads-scraper'; // Acteur vérifié pour Ad Library (JJghSZmShuco4j9gJ)

// Types pour les résultats
export interface ExtractedVideo {
  videoUrl: string;
  thumbnailUrl?: string;
  title?: string;
  description?: string;
  duration?: number;
  publishedAt?: string;
  source: 'facebook' | 'instagram';
  originalUrl: string;
  metadata?: any;
}

/**
 * Détecte le type d'URL (Facebook ou Instagram) et utilise l'acteur Apify approprié
 */
export async function extractVideoFromUrl(url: string): Promise<ExtractedVideo> {
  if (!APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN non configuré dans les variables d\'environnement');
  }
  
  // Déterminer la source en fonction de l'URL
  const isFacebookUrl = url.includes('facebook.com');
  const isInstagramUrl = url.includes('instagram.com');
  
  if (isFacebookUrl && url.includes('ads/library')) {
    return extractFacebookAdVideo(url);
  } else if (isFacebookUrl && url.includes('page_internal')) {
    // Utiliser l'acteur personnalisé pour les pages avec ?ref=page_internal
    return extractFacebookPageVideo(url);
  } else if (isFacebookUrl) {
    return extractFacebookPostVideo(url);
  } else if (isInstagramUrl) {
    return extractInstagramVideo(url);
  } else {
    throw new Error('URL non supportée. Utilisez une URL Facebook ou Instagram valide.');
  }
}

/**
 * Récupère l'acteur Apify, en privilégiant les acteurs personnalisés si disponibles
 */
function getActor(actorId: string, fallbackActorId: string) {
  // Essayer d'utiliser l'acteur personnalisé de l'utilisateur s'il existe
  return apifyClient.actor(`${APIFY_USER_ID}/${actorId}`).call({})
    .then(() => `${APIFY_USER_ID}/${actorId}`)
    .catch(() => {
      console.log(`Acteur personnalisé ${APIFY_USER_ID}/${actorId} non trouvé, utilisation de l'acteur par défaut ${fallbackActorId}`);
      return fallbackActorId;
    });
}

/**
 * Extrait une vidéo d'une page Facebook en utilisant l'acteur personnalisé
 */
async function extractFacebookPageVideo(url: string): Promise<ExtractedVideo> {
  console.log(`Extraction d'une vidéo depuis une page Facebook avec l'acteur personnalisé: ${url}`);

  // Préparer l'entrée pour l'acteur
  const input = {
    startUrls: [{ url }],
    resultsLimit: 99999,
    activeStatus: ""
  };

  // Exécuter l'acteur spécifique pour les pages Facebook
  const run = await apifyClient.actor(FACEBOOK_PAGE_SCRAPER_ID).call(input);

  // Récupérer les résultats
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
  
  if (!items || items.length === 0) {
    throw new Error('Aucune donnée extraite depuis la page Facebook');
  }
  
  console.log('Données extraites depuis la page Facebook:', items[0]);
  
  // Trouver la première vidéo disponible
  const pageData = items[0];
  let videoUrl = '';
  
  // Adaptation selon la structure de données de l'acteur personnalisé
  // Remarque: Nous devons adapter cette partie en fonction de la structure réelle des données
  if (pageData.videos && pageData.videos.length > 0) {
    videoUrl = pageData.videos[0].url;
  } else if (pageData.posts) {
    // Chercher dans les posts pour trouver une vidéo
    for (const post of pageData.posts) {
      if (post.videoUrl) {
        videoUrl = post.videoUrl;
        break;
      }
    }
  }
  
  if (!videoUrl) {
    throw new Error('Aucune vidéo trouvée dans cette page Facebook');
  }
  
  // Télécharger la vidéo depuis l'URL obtenue
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Erreur lors du téléchargement de la vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
  }
  
  // Construire le résultat (adapter les champs selon la structure des données)
  return {
    videoUrl,
    thumbnailUrl: pageData.thumbnailUrl || pageData.pictureUrl || pageData.profilePicture,
    title: pageData.name || pageData.title || 'Page Facebook',
    description: pageData.about || pageData.description || '',
    publishedAt: pageData.foundedDate || new Date().toISOString(),
    source: 'facebook',
    originalUrl: url,
    metadata: {
      pageId: pageData.id || pageData.pageId,
      pageName: pageData.name,
      pageData
    }
  };
}

/**
 * Extrait une vidéo de la bibliothèque d'annonces Facebook
 */
async function extractFacebookAdVideo(url: string): Promise<ExtractedVideo> {
  console.log(`Extraction d'une vidéo depuis Facebook Ad Library: ${url}`);

  // Utiliser l'acteur vérifié pour Facebook Ad Library
  const actorToUse = FACEBOOK_AD_LIBRARY_SCRAPER_ID;
  console.log(`Utilisation de l'acteur: ${actorToUse} pour extraire des données de Facebook Ad Library`);

  try {
    // Récupérer l'ID de l'annonce à partir de l'URL
    const urlObj = new URL(url);
    const adId = urlObj.searchParams.get('id');
    
    if (!adId) {
      throw new Error("ID d'annonce non trouvé dans l'URL");
    }
    
    // Préparer les options de l'acteur pour Facebook Ad Library
    const input = {
      startUrls: [{ url }],
      resultsLimit: 99999,
      activeStatus: "",
      proxy: {
        useApifyProxy: true
      }
    };
    
    // Exécuter l'acteur pour Facebook Ad Library
    const run = await apifyClient.actor(actorToUse).call(input);
    
    // Récupérer les résultats
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    if (!items || items.length === 0) {
      throw new Error('Aucune donnée extraite depuis Facebook Ad Library');
    }
    
    console.log(`Données extraites depuis Facebook Ad Library: ${items.length} annonces trouvées`);
    console.log('Première annonce trouvée:', JSON.stringify(items[0]).slice(0, 500) + '...');
    
    // Trouver l'annonce avec l'adArchiveID correspondant à l'ID
    const adData = items.find(ad => ad.adArchiveID === adId || ad.adArchiveId === adId) || items[0];
    
    // Log détaillé pour le débogage
    console.log('Structure complète des données de l\'annonce:', JSON.stringify(adData, null, 2));
    
    // Extraire l'URL de la vidéo
    let videoUrl = '';
    let thumbnailUrl = '';
    let title = '';
    let description = '';
    
    // Structure basée sur l'acteur apify/facebook-ads-scraper
    if (adData.snapshot && adData.snapshot.videos && adData.snapshot.videos.length > 0) {
      // Extraction directe des vidéos disponibles
      const video = adData.snapshot.videos[0];
      videoUrl = video.videoHdUrl || video.videoSdUrl || '';
      thumbnailUrl = video.videoPreviewImageUrl || '';
      console.log('Vidéo trouvée dans snapshot.videos:', videoUrl);
    } 
    // Vérifier les cartes qui contiennent souvent des vidéos
    else if (adData.snapshot && adData.snapshot.cards && adData.snapshot.cards.length > 0) {
      for (const card of adData.snapshot.cards) {
        if (card.videoHdUrl || card.videoSdUrl) {
          videoUrl = card.videoHdUrl || card.videoSdUrl || '';
          thumbnailUrl = card.videoPreviewImageUrl || card.resizedImageUrl || '';
          title = card.title || '';
          description = card.body || '';
          console.log('Vidéo trouvée dans snapshot.cards:', videoUrl);
          break;
        }
      }
    }
    // Vérifier les extraVideos
    else if (adData.snapshot && adData.snapshot.extraVideos && adData.snapshot.extraVideos.length > 0) {
      const video = adData.snapshot.extraVideos[0];
      videoUrl = video.videoHdUrl || video.videoSdUrl || video.url || '';
      thumbnailUrl = video.videoPreviewImageUrl || video.thumbnailUrl || '';
      console.log('Vidéo trouvée dans snapshot.extraVideos:', videoUrl);
    }
    // Vérifier creatives si disponible
    else if (adData.creatives && adData.creatives.length > 0) {
      for (const creative of adData.creatives) {
        // Chercher dans les attributs possibles de vidéo
        if (creative.videoUrl || creative.video_url || creative.media_url) {
          videoUrl = creative.videoUrl || creative.video_url || creative.media_url;
          thumbnailUrl = creative.thumbnailUrl || creative.thumbnail_url || creative.image_url || '';
          console.log('Vidéo trouvée dans creatives:', videoUrl);
          break;
        }
      }
    }
    // Vérifier creativeAssets
    else if (adData.creativeAssets && adData.creativeAssets.length > 0) {
      for (const asset of adData.creativeAssets) {
        if (asset.video_hd_url || asset.video_sd_url || asset.video_url) {
          videoUrl = asset.video_hd_url || asset.video_sd_url || asset.video_url;
          thumbnailUrl = asset.thumbnail_url || asset.image_url || '';
          console.log('Vidéo trouvée dans creativeAssets:', videoUrl);
          break;
        }
      }
    }
    // Vérifier directement dans l'objet adData
    else if (adData.videoUrl || adData.video_url) {
      videoUrl = adData.videoUrl || adData.video_url;
      thumbnailUrl = adData.thumbnailUrl || adData.thumbnail_url || '';
      console.log('Vidéo trouvée directement dans adData:', videoUrl);
    }
    // Chercher dans les médias des annonces Facebook Ad Library
    else if (adData.media && Array.isArray(adData.media)) {
      for (const mediaItem of adData.media) {
        if (mediaItem.source && typeof mediaItem.source === 'string' && 
            (mediaItem.source.includes('.mp4') || mediaItem.type === 'video')) {
          videoUrl = mediaItem.source;
          thumbnailUrl = mediaItem.poster || mediaItem.thumbnail || '';
          console.log('Vidéo trouvée dans adData.media:', videoUrl);
          break;
        }
      }
    }
    // Chercher dans adMediaLibrary
    else if (adData.adMediaLibrary && Array.isArray(adData.adMediaLibrary)) {
      for (const mediaItem of adData.adMediaLibrary) {
        if (mediaItem.video_url || mediaItem.media_url || mediaItem.source) {
          videoUrl = mediaItem.video_url || mediaItem.media_url || mediaItem.source;
          thumbnailUrl = mediaItem.thumbnail_url || mediaItem.image_url || '';
          console.log('Vidéo trouvée dans adData.adMediaLibrary:', videoUrl);
          break;
        }
      }
    }
    // Chercher dans les creativeMedias
    else if (adData.creativeMedias && Array.isArray(adData.creativeMedias)) {
      for (const media of adData.creativeMedias) {
        if (media.url && typeof media.url === 'string' && 
            (media.url.includes('.mp4') || media.type === 'VIDEO')) {
          videoUrl = media.url;
          thumbnailUrl = media.thumbnail_url || media.thumbnailUrl || '';
          console.log('Vidéo trouvée dans adData.creativeMedias:', videoUrl);
          break;
        }
      }
    }
    // Chercher dans les données brutes de l'annonce
    else if (adData.raw && typeof adData.raw === 'string') {
      try {
        // Certains extracteurs stockent les données brutes sous forme de chaîne JSON
        const rawData = JSON.parse(adData.raw);
        console.log('Données brutes de l\'annonce détectées, recherche de vidéos...');
        
        // Chercher dans les médias des données brutes
        if (rawData.media && Array.isArray(rawData.media)) {
          for (const mediaItem of rawData.media) {
            if (mediaItem.source && typeof mediaItem.source === 'string' && 
                (mediaItem.source.includes('.mp4') || mediaItem.type === 'video')) {
              videoUrl = mediaItem.source;
              thumbnailUrl = mediaItem.poster || mediaItem.thumbnail || '';
              console.log('Vidéo trouvée dans les données brutes (media):', videoUrl);
              break;
            }
          }
        }
        
        // Si aucune vidéo n'a été trouvée, chercher récursivement dans les données brutes
        if (!videoUrl) {
          const foundVideoUrl = findVideoUrl(rawData);
          if (foundVideoUrl) {
            videoUrl = foundVideoUrl;
          }
        }
      } catch (e) {
        console.log('Erreur lors de l\'analyse des données brutes:', e);
      }
    }
    // Recherche récursive dans l'objet adData pour trouver toute clé contenant "video"
    else {
      console.log('Recherche récursive de vidéo dans la structure des données...');
      
      function findVideoUrl(obj: any, path = ''): string | null {
        if (!obj || typeof obj !== 'object') return null;
        
        // Rechercher des clés contenant "video" et "url"
        for (const key in obj) {
          const currentPath = path ? `${path}.${key}` : key;
          
          // Si la clé contient "video" et "url" et la valeur est une chaîne, c'est probablement une URL vidéo
          if (
            typeof obj[key] === 'string' && 
            obj[key].length > 10 &&
            (
              (key.toLowerCase().includes('video') && key.toLowerCase().includes('url')) ||
              (key.toLowerCase() === 'url' && currentPath.toLowerCase().includes('video')) ||
              (key.toLowerCase() === 'source' && (
                obj[key].includes('.mp4') || 
                currentPath.toLowerCase().includes('video')
              )) ||
              (key.toLowerCase() === 'media_url' && (
                obj[key].includes('.mp4') || 
                obj['type'] === 'video' || 
                obj['type'] === 'VIDEO'
              ))
            ) &&
            (
              obj[key].startsWith('http') || 
              obj[key].startsWith('//')
            )
          ) {
            console.log(`Vidéo trouvée par recherche récursive à ${currentPath}:`, obj[key]);
            return obj[key];
          }
          
          // Vérifier spécifiquement le type de média
          if (key === 'type' && (obj[key] === 'video' || obj[key] === 'VIDEO') && obj['url']) {
            console.log(`Vidéo trouvée par détection de type à ${currentPath}:`, obj['url']);
            return obj['url'];
          }
          
          // Vérifier les assets qui pourraient contenir des vidéos
          if (key === 'asset' && typeof obj[key] === 'object' && obj[key] !== null) {
            const asset = obj[key];
            if (asset.url && (
                asset.type === 'video' || 
                asset.type === 'VIDEO' || 
                asset.url.includes('.mp4')
              )) {
              console.log(`Vidéo trouvée dans un asset à ${currentPath}:`, asset.url);
              return asset.url;
            }
          }
          
          // Recherche récursive
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            const result = findVideoUrl(obj[key], currentPath);
            if (result) return result;
          }
        }
        
        return null;
      }
      
      const foundVideoUrl = findVideoUrl(adData);
      if (foundVideoUrl) {
        videoUrl = foundVideoUrl;
      }
    }
    
    // Si on n'a pas trouvé de vidéo, vérifier s'il y a des images
    if (!videoUrl) {
      // Extraire les images disponibles
      let images: string[] = [];
      
      if (adData.snapshot && adData.snapshot.images && adData.snapshot.images.length > 0) {
        // Extraire les URLs des images
        images = adData.snapshot.images.map(img => img.resizedImageUrl || img.originalImageUrl).filter(Boolean);
        
        if (images.length === 0 && adData.snapshot.extraImages && adData.snapshot.extraImages.length > 0) {
          images = adData.snapshot.extraImages.map(img => img.resizedImageUrl || img.originalImageUrl).filter(Boolean);
        }
        
        // Pour la vignette, utiliser la première image
        thumbnailUrl = images[0] || '';
        
        // Extraire titre et description
        title = adData.snapshot.title || adData.pageName || 'Annonce Facebook';
        description = adData.snapshot.body?.text || adData.snapshot.linkDescription || '';
        
        // Renvoi d'une structure spéciale indiquant qu'il s'agit d'une annonce avec images
        return {
          videoUrl: '', // Pas de vidéo
          thumbnailUrl,
          title,
          description,
          publishedAt: adData.startDateFormatted || new Date().toISOString(),
          source: 'facebook',
          originalUrl: url,
          metadata: {
            adId: adData.adArchiveID || adData.adArchiveId,
            pageName: adData.pageName,
            pageId: adData.pageId,
            categories: adData.categories,
            containsOnlyImages: true, // Indicateur important!
            images,
            adData
          }
        };
      } else {
        // Au lieu de lever une erreur, retourner un objet structuré indiquant qu'aucun média n'a été trouvé
        console.log('Aucune vidéo ni image trouvée dans cette annonce Facebook. Renvoi d\'une réponse structurée.');
        return {
          videoUrl: '', // Pas de vidéo
          thumbnailUrl: '',
          title: adData.pageName || 'Annonce Facebook',
          description: adData.snapshot?.body?.text || '',
          publishedAt: adData.startDateFormatted || new Date().toISOString(),
          source: 'facebook',
          originalUrl: url,
          metadata: {
            adId: adData.adArchiveID || adData.adArchiveId,
            pageName: adData.pageName,
            pageId: adData.pageId,
            categories: adData.categories,
            containsOnlyImages: false,
            noMediaFound: true, // Nouvel indicateur pour signaler qu'aucun média n'a été trouvé
            adData
          }
        };
      }
    }
    
    // Normaliser l'URL de la vidéo (s'assurer qu'elle commence par http ou https)
    if (videoUrl && videoUrl.startsWith('//')) {
      videoUrl = 'https:' + videoUrl;
      console.log('URL de vidéo normalisée:', videoUrl);
    }
    
    // Vérifier que l'URL de la vidéo est valide
    if (!videoUrl || !videoUrl.startsWith('http')) {
      console.log('URL de vidéo invalide ou manquante:', videoUrl);
      // Essayer une dernière recherche dans tout l'objet
      const lastChanceUrl = findVideoUrl(adData);
      if (lastChanceUrl) {
        videoUrl = lastChanceUrl;
        console.log('URL de vidéo trouvée en dernier recours:', videoUrl);
      } else {
        console.log('Impossible de trouver une URL de vidéo valide dans l\'annonce Facebook');
        // Vérifier s'il y a au moins des images
        if (adData.snapshot && adData.snapshot.images && adData.snapshot.images.length > 0) {
          console.log('Annonce contenant uniquement des images détectée');
          // Traiter comme une annonce avec images uniquement
          // Cette partie est identique au code ci-dessus pour les images
          let images = adData.snapshot.images.map(img => img.resizedImageUrl || img.originalImageUrl).filter(Boolean);
          thumbnailUrl = images[0] || '';
          return {
            videoUrl: '',
            thumbnailUrl,
            title: adData.snapshot.title || adData.pageName || 'Annonce Facebook',
            description: adData.snapshot.body?.text || adData.snapshot.linkDescription || '',
            publishedAt: adData.startDateFormatted || new Date().toISOString(),
            source: 'facebook',
            originalUrl: url,
            metadata: {
              adId: adData.adArchiveID || adData.adArchiveId,
              pageName: adData.pageName,
              pageId: adData.pageId,
              categories: adData.categories,
              containsOnlyImages: true,
              images,
              adData
            }
          };
        } else {
          // Si aucune vidéo ou image n'a été trouvée
          return {
            videoUrl: '',
            thumbnailUrl: '',
            title: adData.pageName || 'Annonce Facebook',
            description: adData.snapshot?.body?.text || '',
            publishedAt: adData.startDateFormatted || new Date().toISOString(),
            source: 'facebook',
            originalUrl: url,
            metadata: {
              adId: adData.adArchiveID || adData.adArchiveId,
              pageName: adData.pageName,
              pageId: adData.pageId,
              categories: adData.categories,
              containsOnlyImages: false,
              noMediaFound: true,
              adData
            }
          };
        }
      }
    }
    
    // Si le titre et la description ne sont pas encore définis, les extraire de l'annonce
    if (!title) {
      title = adData.snapshot?.title || 'Annonce Facebook';
    }
    
    if (!description) {
      description = adData.snapshot?.body?.text || adData.snapshot?.linkDescription || '';
    }
    
    // Obtenir la date de publication
    const publishedAt = adData.startDateFormatted || new Date().toISOString();
    
    // Télécharger la vidéo depuis l'URL obtenue
    console.log(`Téléchargement de la vidéo depuis: ${videoUrl}`);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Erreur lors du téléchargement de la vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
    }
    
    // Construire le résultat
    return {
      videoUrl,
      thumbnailUrl,
      title,
      description,
      publishedAt,
      source: 'facebook',
      originalUrl: url,
      metadata: {
        adId: adData.adArchiveID || adData.adArchiveId,
        pageName: adData.pageName,
        pageId: adData.pageId,
        categories: adData.categories,
        containsOnlyImages: false,
        adData
      }
    };
  } catch (error) {
    console.error('Erreur lors de l\'extraction de la vidéo Facebook Ad:', error);
    throw error;
  }
}

/**
 * Extrait une vidéo d'un post Facebook standard
 */
async function extractFacebookPostVideo(url: string): Promise<ExtractedVideo> {
  console.log(`Extraction d'une vidéo depuis un post Facebook: ${url}`);

  // Déterminer l'acteur à utiliser (personnalisé ou par défaut)
  const actorToUse = await getActor('facebook-post-extractor', 'apify/facebook-pages-scraper')
    .catch(() => 'apify/facebook-pages-scraper');

  // Exécuter l'acteur Apify pour Facebook Pages Scraper
  const run = await apifyClient.actor(actorToUse).call({
    startUrls: [{ url }],
    maxPosts: 1,
    maxPostComments: 0,
    maxPostReactions: 0,
  });

  // Récupérer les résultats
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
  
  if (!items || items.length === 0) {
    throw new Error('Aucune donnée extraite depuis le post Facebook');
  }
  
  const postData = items[0];
  
  // Vérifier si le post contient une vidéo
  if (!postData.videoUrl) {
    throw new Error('Aucune vidéo trouvée dans ce post Facebook');
  }
  
  const videoUrl = postData.videoUrl;
  
  // Télécharger la vidéo depuis l'URL obtenue
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Erreur lors du téléchargement de la vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
  }
  
  // Construire le résultat
  return {
    videoUrl,
    thumbnailUrl: postData.thumbnailUrl || postData.pictureUrl,
    title: postData.title || 'Post Facebook',
    description: postData.text || '',
    publishedAt: postData.date,
    source: 'facebook',
    originalUrl: url,
    metadata: {
      postId: postData.postId,
      postUrl: postData.postUrl,
      authorName: postData.authorName,
      postData
    }
  };
}

/**
 * Extrait une vidéo d'Instagram
 */
async function extractInstagramVideo(url: string): Promise<ExtractedVideo> {
  console.log(`Extraction d'une vidéo depuis Instagram: ${url}`);

  // Déterminer l'acteur à utiliser (personnalisé ou par défaut)
  const actorToUse = await getActor('instagram-post-extractor', 'apify/instagram-scraper')
    .catch(() => 'apify/instagram-scraper');

  // Exécuter l'acteur Apify pour Instagram Scraper
  const run = await apifyClient.actor(actorToUse).call({
    directUrls: [url],
    resultsType: 'posts',
    maxRequestRetries: 5,
  });

  // Récupérer les résultats
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
  
  if (!items || items.length === 0) {
    throw new Error('Aucune donnée extraite depuis Instagram');
  }
  
  const postData = items[0];
  
  // Vérifier si le post contient une vidéo
  if (!postData.videoUrl) {
    throw new Error('Aucune vidéo trouvée dans ce post Instagram');
  }
  
  const videoUrl = postData.videoUrl;
  
  // Télécharger la vidéo depuis l'URL obtenue
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Erreur lors du téléchargement de la vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
  }
  
  // Construire le résultat
  return {
    videoUrl,
    thumbnailUrl: postData.displayUrl,
    title: postData.caption ? postData.caption.slice(0, 50) + '...' : 'Post Instagram',
    description: postData.caption || '',
    publishedAt: postData.timestamp,
    source: 'instagram',
    originalUrl: url,
    metadata: {
      postId: postData.id,
      authorName: postData.ownerUsername,
      postData
    }
  };
} 