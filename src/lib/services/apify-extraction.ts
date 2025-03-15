import { ApifyClient } from 'apify-client';

// Initialiser le client Apify avec le token API
const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || '',
});

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
  if (!process.env.APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN non configuré dans les variables d\'environnement');
  }
  
  // Déterminer la source en fonction de l'URL
  const isFacebookUrl = url.includes('facebook.com');
  const isInstagramUrl = url.includes('instagram.com');
  
  if (isFacebookUrl && url.includes('ads/library')) {
    return extractFacebookAdVideo(url);
  } else if (isFacebookUrl) {
    return extractFacebookPostVideo(url);
  } else if (isInstagramUrl) {
    return extractInstagramVideo(url);
  } else {
    throw new Error('URL non supportée. Utilisez une URL Facebook ou Instagram valide.');
  }
}

/**
 * Extrait une vidéo de la bibliothèque d'annonces Facebook
 */
async function extractFacebookAdVideo(url: string): Promise<ExtractedVideo> {
  console.log(`Extraction d'une vidéo depuis Facebook Ad Library: ${url}`);

  // Exécuter l'acteur Apify pour Facebook Ads Library
  const run = await apifyClient.actor("zuzka/facebook-ads-library-scraper").call({
    startUrls: [{ url }],
    maxRequestRetries: 5,
  });

  // Récupérer les résultats
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
  
  if (!items || items.length === 0) {
    throw new Error('Aucune donnée extraite depuis Facebook Ad Library');
  }
  
  const adData = items[0];
  
  // Vérifier si l'annonce contient une vidéo
  if (!adData.videos || adData.videos.length === 0) {
    throw new Error('Aucune vidéo trouvée dans cette annonce Facebook');
  }
  
  // Récupérer l'URL de la première vidéo
  const videoUrl = adData.videos[0].url;
  
  if (!videoUrl) {
    throw new Error('URL de vidéo non trouvée dans l\'annonce Facebook');
  }
  
  // Télécharger la vidéo depuis l'URL obtenue
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Erreur lors du téléchargement de la vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
  }
  
  // Construire le résultat
  return {
    videoUrl,
    thumbnailUrl: adData.images?.[0]?.url,
    title: adData.title || adData.message || 'Annonce Facebook',
    description: adData.message || adData.title || '',
    publishedAt: adData.startDate,
    source: 'facebook',
    originalUrl: url,
    metadata: {
      adId: adData.id,
      advertiserName: adData.advertiserName,
      adLibraryData: adData
    }
  };
}

/**
 * Extrait une vidéo d'un post Facebook standard
 */
async function extractFacebookPostVideo(url: string): Promise<ExtractedVideo> {
  console.log(`Extraction d'une vidéo depuis un post Facebook: ${url}`);

  // Exécuter l'acteur Apify pour Facebook Pages Scraper
  const run = await apifyClient.actor("apify/facebook-pages-scraper").call({
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

  // Exécuter l'acteur Apify pour Instagram Scraper
  const run = await apifyClient.actor("apify/instagram-scraper").call({
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