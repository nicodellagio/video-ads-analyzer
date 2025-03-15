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

// Configurations de proxy pour la rotation
const PROXY_CONFIGURATIONS = [
  // Configuration France
  {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    countryCode: 'FR'
  },
  // Configuration États-Unis
  {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    countryCode: 'US'
  },
  // Configuration Allemagne
  {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    countryCode: 'DE'
  },
  // Configuration Royaume-Uni
  {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    countryCode: 'GB'
  },
  // Configuration Datacenter (plus rapide mais moins fiable pour Instagram)
  {
    useApifyProxy: true,
    apifyProxyGroups: ['DATACENTER'],
  },
  // Configuration pour plusieurs pays européens avec sessions persistantes
  {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    countryCode: 'FR,DE,IT,ES,NL',
    apifyProxySessionId: `instagram_session_${Date.now()}`
  },
  // NOUVELLE CONFIG: Canada avec session persistante (généralement moins suspecté)
  {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    countryCode: 'CA',
    apifyProxySessionId: `instagram_ca_session_${Date.now()}`
  },
  // NOUVELLE CONFIG: Asie (Japon, Corée) peut contourner certaines restrictions
  {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    countryCode: 'JP,KR',
    apifyProxySessionId: `instagram_asia_session_${Date.now()}`
  },
  // NOUVELLE CONFIG: Configuration avec Groupe SMART pour adaptation automatique
  {
    useApifyProxy: true,
    apifyProxyGroups: ['SMART_PROXY'],
  }
];

// Statistiques de succès pour chaque configuration de proxy
interface ProxyStats {
  attempts: number;
  successes: number;
  failures: number;
  lastUsed: number; // Timestamp
  successRate: number;
}

// Initialisation des statistiques pour chaque configuration
const proxyStats: ProxyStats[] = PROXY_CONFIGURATIONS.map(() => ({
  attempts: 0,
  successes: 0,
  failures: 0,
  lastUsed: 0,
  successRate: 0
}));

/**
 * Choisit la meilleure configuration de proxy en fonction des statistiques
 * et assure une rotation pour éviter la détection
 */
function selectProxyConfiguration(): { proxy: any, index: number } {
  // Calculer les taux de succès pour chaque configuration
  proxyStats.forEach(stat => {
    if (stat.attempts > 0) {
      stat.successRate = stat.successes / stat.attempts;
    }
  });

  // Trier par taux de succès (les meilleurs d'abord) et par date de dernière utilisation (les moins récents d'abord)
  const sortedIndices = proxyStats
    .map((stat, index) => ({ stat, index }))
    .sort((a, b) => {
      // Si le taux de succès diffère de plus de 0.1, privilégier le meilleur taux
      if (Math.abs(a.stat.successRate - b.stat.successRate) > 0.1) {
        return b.stat.successRate - a.stat.successRate;
      }
      
      // À taux similaires, favoriser celui utilisé le moins récemment
      return a.stat.lastUsed - b.stat.lastUsed;
    })
    .map(item => item.index);

  // Stratégie améliorée - 30% du temps, choisir au hasard plutôt qu'optimiser 
  // Cela permet d'explorer d'autres configurations et évite de surutiliser un proxy efficace
  let selectedIndex: number;
  
  if (Math.random() < 0.3) {
    // Sélection aléatoire parmi les proxys moins utilisés (dernier tiers du tableau)
    const randomIndex = Math.floor(Math.random() * Math.max(3, Math.floor(PROXY_CONFIGURATIONS.length / 3)));
    selectedIndex = sortedIndices[sortedIndices.length - 1 - randomIndex];
    console.log(`Sélection aléatoire de proxy pour exploration: ${PROXY_CONFIGURATIONS[selectedIndex]?.countryCode || 'DATACENTER/SMART'}`);
  } else {
    // Sélection optimisée basée sur les performances passées
    selectedIndex = sortedIndices[0];
    console.log(`Sélection optimisée de proxy: ${PROXY_CONFIGURATIONS[selectedIndex]?.countryCode || 'DATACENTER/SMART'} (Taux: ${(proxyStats[selectedIndex].successRate * 100).toFixed(1)}%)`);
  }

  // Mettre à jour les statistiques d'utilisation
  proxyStats[selectedIndex].attempts++;
  proxyStats[selectedIndex].lastUsed = Date.now();
  
  return {
    proxy: PROXY_CONFIGURATIONS[selectedIndex],
    index: selectedIndex
  };
}

/**
 * Met à jour les statistiques après une tentative d'extraction
 */
function updateProxyStats(index: number, success: boolean): void {
  if (success) {
    proxyStats[index].successes++;
  } else {
    proxyStats[index].failures++;
  }
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
      // Vérifier les deux formats de nommage (camelCase et underscores)
      videoUrl = video.videoHdUrl || video.video_hd_url || video.videoSdUrl || video.video_sd_url || '';
      thumbnailUrl = video.videoPreviewImageUrl || video.video_preview_image_url || '';
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
 * Extrait une vidéo d'Instagram avec le système avancé de rotation d'IP
 */
async function extractInstagramVideo(url: string): Promise<ExtractedVideo> {
  console.log(`Extraction d'une vidéo depuis Instagram avec rotation d'IP avancée: ${url}`);

  try {
    return await extractInstagramVideoWithRetry(url);
  } catch (error) {
    // Gestion améliorée des erreurs avec détails sur l'échec du système de rotation
    console.error('Erreur après plusieurs tentatives d\'extraction Instagram avec différentes IPs:', error);
    
    // Erreurs liées à l'API Instagram
    if (error.message?.includes('IP-BLOCKED') || 
        error.message?.includes('Your Request Couldn\'t be Processed')) {
      throw new Error(`Instagram a détecté et bloqué toutes nos tentatives d'extraction. Tous nos proxys semblent être bloqués actuellement. Veuillez réessayer plus tard (idéalement dans quelques heures).`);
    }
    
    // Si l'erreur est liée à l'analyse JSON
    if (error instanceof SyntaxError && error.message.includes('Unexpected token')) {
      throw new Error(`Instagram a renvoyé des données non valides après plusieurs tentatives. Leur système de protection a probablement été mis à jour récemment.`);
    }
    
    // Pour les erreurs de timeout
    if (error.message?.includes('timeout') || error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
      throw new Error(`Le délai d'attente a été dépassé sur toutes nos tentatives d'extraction. Instagram limite fortement les extractions actuellement.`);
    }
    
    // Message général pour les autres types d'erreurs
    throw new Error(`Échec de l'extraction Instagram après plusieurs tentatives avec différentes configurations: ${error.message}`);
  }
}

// Fonction utilitaire pour rechercher récursivement une URL de vidéo
function findVideoUrlRecursive(obj: any, path = ''): string | null {
  if (!obj || typeof obj !== 'object') return null;
  
  for (const key in obj) {
    const currentPath = path ? `${path}.${key}` : key;
    
    // Rechercher les clés qui pourraient contenir des URL vidéo
    if (
      typeof obj[key] === 'string' && 
      obj[key].length > 10 &&
      (
        (key.toLowerCase().includes('video') && key.toLowerCase().includes('url')) ||
        (key.toLowerCase() === 'url' && currentPath.toLowerCase().includes('video')) ||
        (key.toLowerCase() === 'src' && obj[key].includes('.mp4'))
      ) && 
      obj[key].startsWith('http')
    ) {
      console.log(`URL vidéo Instagram trouvée dans ${currentPath}:`, obj[key]);
      return obj[key];
    }
    
    // Recherche récursive
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const result = findVideoUrlRecursive(obj[key], currentPath);
      if (result) return result;
    }
  }
  
  return null;
}

/**
 * Version améliorée d'extraction Instagram avec plusieurs tentatives et rotation de proxys
 */
async function extractInstagramVideoWithRetry(url: string, maxRetries = 5): Promise<ExtractedVideo> {
  let lastError: any;
  
  // Plusieurs tentatives avec différentes configurations
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Sélectionner une configuration de proxy optimale
    const { proxy, index } = selectProxyConfiguration();
    console.log(`Tentative ${attempt+1}/${maxRetries} d'extraction Instagram avec proxy ${proxy.countryCode || 'DATACENTER/SMART'}`);
    
    try {
      // Attendre de manière exponentielle entre les tentatives
      if (attempt > 0) {
        const delayMs = Math.min(30000, 2000 * Math.pow(2, attempt)); // 2s, 4s, 8s, 16s...
        console.log(`Attente de ${delayMs/1000}s avant la prochaine tentative...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      // Déterminer l'acteur à utiliser 
      const actorToUse = await getActor('instagram-post-extractor', 'apify/instagram-scraper')
        .catch(() => 'apify/instagram-scraper');
      
      console.log(`Utilisation de l'acteur: ${actorToUse} avec proxy ${proxy.countryCode || 'DATACENTER/SMART'}`);
      
      // Configuration de base avec paramètres optimisés
      const runInput = {
        directUrls: [url],
        resultsType: 'posts',
        addParentData: true,
        maxRequestRetries: 20, // Augmenté pour plus de persistance
        maxRequestsPerMinute: Math.max(1, 2 - attempt*0.5), // Stratégie adaptative: plus lent après chaque échec
        maxConcurrency: 1,
        maxSessionRotations: 8, // Augmenté pour plus de rotations
        loginCookies: [],
        proxy: proxy, // Utiliser la configuration de proxy sélectionnée
        forceEnglishLocale: true,
        verboseLog: true,
        debugLog: true,
        timeout: 150000 + (attempt * 30000), // Timeout plus long avec marges
        // En-têtes HTTP aléatoires pour simuler différents navigateurs
        additionalHttpHeaders: getRandomHeaders(attempt) // Utiliser la version améliorée
      };
      
      // Exécuter l'acteur avec timeout adaptatif
      const run = await apifyClient.actor(actorToUse).call(runInput, {
        timeoutSecs: 180 + (attempt * 60), // 3min, puis 4min, etc.
        waitSecs: 120 + (attempt * 30),    // 2min, puis 2min30, etc.
      });
      
      // Récupérer les résultats
      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
      
      if (!items || items.length === 0) {
        throw new Error('Aucune donnée extraite depuis Instagram');
      }
      
      // Traitement du résultat comme dans la fonction originale
      const postData = items[0];
      // Recherche d'URL vidéo comme dans la fonction originale
      let videoUrl = extractVideoUrlFromPostData(postData);
      
      if (!videoUrl) {
        throw new Error('Le post Instagram ne contient pas de vidéo');
      }
      
      // Téléchargement de la vidéo
      const videoResponse = await fetchWithRetry(videoUrl, 3);
      
      // Extraire les métadonnées comme dans la fonction originale
      const thumbnailUrl = postData.displayUrl || postData.display_url || postData.thumbnail_url || postData.thumbnailUrl || 
                         (postData.image_versions2?.candidates ? postData.image_versions2.candidates[0].url : undefined);
      
      const caption = postData.caption || (postData.edge_media_to_caption?.edges?.length ? postData.edge_media_to_caption.edges[0].node.text : '');
      const timestamp = postData.timestamp || postData.taken_at || postData.taken_at_timestamp || new Date().toISOString();
      
      // Mise à jour des statistiques - succès
      updateProxyStats(index, true);
      
      // Construire et retourner le résultat
      return {
        videoUrl,
        thumbnailUrl,
        title: caption ? (caption.slice(0, 50) + (caption.length > 50 ? '...' : '')) : 'Post Instagram',
        description: caption || '',
        publishedAt: typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : timestamp,
        source: 'instagram',
        originalUrl: url,
        metadata: {
          postId: postData.id,
          authorName: postData.ownerUsername || postData.owner?.username || postData.user?.username || '',
          likesCount: postData.likesCount || postData.like_count || postData.edge_media_preview_like?.count,
          commentsCount: postData.commentsCount || postData.comment_count || postData.edge_media_to_comment?.count,
          // Inclure des informations sur le proxy utilisé pour le débogage
          extractionInfo: {
            proxyCountry: proxy.countryCode || 'DATACENTER',
            attemptNumber: attempt + 1,
            extractionTime: new Date().toISOString()
          },
          postData: {
            id: postData.id,
            caption,
            timestamp,
            ownerUsername: postData.ownerUsername || postData.owner?.username || postData.user?.username || '',
            shortcode: postData.shortcode || postData.code,
          }
        }
      };
    } catch (error) {
      console.error(`Échec de la tentative ${attempt+1} avec proxy ${proxy.countryCode || 'DATACENTER/SMART'}:`, error.message);
      lastError = error;
      
      // Mise à jour des statistiques - échec
      updateProxyStats(index, false);
      
      // Si ce n'est pas la dernière tentative, continuer avec la prochaine configuration
      if (attempt < maxRetries - 1) {
        console.log(`Passage à la configuration de proxy suivante...`);
      }
    }
  }
  
  // Si toutes les tentatives ont échoué, lancer la dernière erreur
  console.error(`Échec de l'extraction Instagram après ${maxRetries} tentatives avec différentes configurations de proxy`);
  throw new Error(`Impossible d'extraire la vidéo Instagram après plusieurs tentatives: ${lastError.message}`);
}

/**
 * Récupère une URL avec plusieurs tentatives et rotation des User-Agents
 */
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Délai exponentiel entre les tentatives
      if (attempt > 0) {
        const delayMs = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      // Différents headers à chaque tentative
      const headers = getRandomHeaders(attempt);
      
      const response = await fetch(url, {
        timeout: 60000,
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      console.error(`Échec de téléchargement (tentative ${attempt+1}/${maxRetries}):`, error.message);
    }
  }
  
  throw lastError;
}

/**
 * Génère des en-têtes HTTP aléatoires pour simuler différents navigateurs
 * Le paramètre attempt permet d'adapter les en-têtes selon le nombre de tentatives
 */
function getRandomHeaders(attempt: number = 0): Record<string, string> {
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/121.0'
  ];
  
  const languages = [
    'en-US,en;q=0.9',
    'fr-FR,fr;q=0.9,en;q=0.8',
    'en-GB,en;q=0.9',
    'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    'es-ES,es;q=0.9,en;q=0.8',
    'it-IT,it;q=0.9,en;q=0.8',
    'en-US,en;q=0.9,fr;q=0.8'
  ];
  
  // Pour les tentatives ultérieures, ajouter des en-têtes plus sophistiqués
  // pour simuler un navigateur différent
  const baseHeaders = {
    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': languages[Math.floor(Math.random() * languages.length)],
    'Referer': 'https://www.instagram.com/',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache'
  };

  // Après plusieurs tentatives, simuler un comportement plus humain avec des en-têtes supplémentaires
  if (attempt >= 2) {
    // Ajouter des cookies aléatoires pour simuler un utilisateur connecté
    baseHeaders['Cookie'] = `ig_cb=1; ig_did=${Math.random().toString(36).substring(2, 15)}; mid=${Math.random().toString(36).substring(2, 15)}`;
    
    // Simuler différents encodages selon la tentative
    if (attempt % 2 === 0) {
      baseHeaders['Accept-Encoding'] = 'gzip, deflate, br';
    }
    
    // Simuler un client mobile pour certaines tentatives
    if (attempt >= 3) {
      const mobileUserAgents = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/121.0.6167.66 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/121.0.6167.66 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.101 Mobile Safari/537.36'
      ];
      
      baseHeaders['User-Agent'] = mobileUserAgents[Math.floor(Math.random() * mobileUserAgents.length)];
      baseHeaders['Sec-Ch-Ua-Mobile'] = '?1';
      baseHeaders['Sec-Ch-Ua-Platform'] = attempt % 2 === 0 ? '"Android"' : '"iOS"';
    }
  }
  
  return baseHeaders;
}

/**
 * Extrait l'URL vidéo de la réponse du scraper Instagram
 */
function extractVideoUrlFromPostData(postData: any): string | null {
  let videoUrl = null;
  
  // 1. Vérifier les propriétés directes standard
  if (postData.videoUrl || postData.video_url) {
    videoUrl = postData.videoUrl || postData.video_url;
    console.log('URL vidéo trouvée dans propriété directe:', videoUrl);
  }
  // 2. Vérifier dans les media video_versions (format API Instagram)
  else if (postData.media && postData.media.video_versions && postData.media.video_versions.length > 0) {
    // Prendre la version avec la meilleure résolution
    videoUrl = postData.media.video_versions.sort((a, b) => b.width - a.width)[0].url;
    console.log('URL vidéo trouvée dans media.video_versions:', videoUrl);
  }
  // 3. Vérifier dans l'array videos si disponible
  else if (postData.videos && postData.videos.length > 0) {
    const videoItem = postData.videos[0];
    videoUrl = videoItem.url || videoItem.video_url;
    console.log('URL vidéo trouvée dans videos array:', videoUrl);
  }
  // 4. Vérifier les médias carousel (Instagram reels/stories)
  else if (postData.carousel_media || postData.carousel) {
    const carouselMedia = postData.carousel_media || postData.carousel;
    // Parcourir tous les médias du carousel à la recherche d'une vidéo
    for (const media of carouselMedia) {
      if (media.video_versions && media.video_versions.length > 0) {
        videoUrl = media.video_versions.sort((a, b) => b.width - a.width)[0].url;
        console.log('URL vidéo trouvée dans carousel_media:', videoUrl);
        break;
      }
      if (media.videos && media.videos.length > 0) {
        videoUrl = media.videos[0].url;
        console.log('URL vidéo trouvée dans carousel_media.videos:', videoUrl);
        break;
      }
    }
  }
  // 5. Recherche récursive en dernier recours
  else {
    console.log('Recherche récursive d\'URL vidéo dans les données Instagram...');
    videoUrl = findVideoUrlRecursive(postData);
    if (videoUrl) {
      console.log('URL vidéo trouvée par recherche récursive:', videoUrl);
    }
  }
  
  return videoUrl;
} 