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
// Changement de l'acteur pour Facebook Ad Library - utiliser un acteur disponible
const FACEBOOK_AD_LIBRARY_SCRAPER_ID = 'curious_coder/facebook-ads-library-scraper'; // Nouvel acteur pour Ad Library

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

  // Utiliser directement le nouvel acteur pour Facebook Ad Library
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
      searchUrls: [url],
      scrapeAdDetails: true,
      proxyConfiguration: {
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
    
    // Trouver l'annonce correspondant à l'ID
    const adData = items.find(ad => ad.adId === adId) || items[0];
    
    // Extraire l'URL de la vidéo
    let videoUrl = '';
    
    // Adapter en fonction de la structure de l'acteur curious_coder/facebook-ads-library-scraper
    if (adData.videos && adData.videos.length > 0) {
      videoUrl = adData.videos[0].url || adData.videos[0].src || '';
    } else if (adData.media && adData.media.length > 0) {
      const videoMedia = adData.media.find(m => m.type === 'VIDEO' || m.url.includes('.mp4'));
      if (videoMedia) {
        videoUrl = videoMedia.url || videoMedia.src || '';
      }
    }
    
    if (!videoUrl) {
      throw new Error('Aucune vidéo trouvée dans cette annonce Facebook');
    }
    
    // Construire le résultat
    return {
      videoUrl,
      thumbnailUrl: adData.thumbnailUrl || (adData.media && adData.media.length > 0 ? adData.media[0].url : ''),
      title: adData.title || adData.message || 'Annonce Facebook',
      description: adData.message || adData.description || '',
      publishedAt: adData.startDate || adData.createdTime || new Date().toISOString(),
      source: 'facebook',
      originalUrl: url,
      metadata: {
        adId: adData.adId || adData.id,
        advertiserName: adData.advertiserName || adData.pageName,
        adLibraryData: adData
      }
    };
  } catch (error) {
    console.error('Erreur lors de l\'extraction de Facebook Ad Library:', error);
    throw new Error(`Erreur lors de l'extraction de Facebook Ad Library: ${(error as Error).message}`);
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