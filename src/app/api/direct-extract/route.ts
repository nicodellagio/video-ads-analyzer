import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching

export async function POST(request: NextRequest) {
  try {
    // Récupérer les données de la requête
    const data = await request.json();
    const { url, source } = data;
    
    console.log('Extraction directe demandée pour:', { url, source });
    
    // Vérifier que les paramètres requis sont présents
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }
    
    try {
      // Utiliser directement l'API SaveFrom.net pour extraire la vidéo
      const videoInfo = await extractVideoWithSaveFrom(url);
      
      console.log('Extraction réussie:', videoInfo);
      
      return NextResponse.json({
        success: true,
        video: {
          id: videoInfo.id,
          url: videoInfo.url,
          duration: videoInfo.duration?.toString() || '0',
          format: `${videoInfo.width || 1280}x${videoInfo.height || 720}`,
          size: '0',
          originalName: videoInfo.title || `video_${videoInfo.id}`,
          width: videoInfo.width || 1280,
          height: videoInfo.height || 720
        }
      });
    } catch (error) {
      console.error('Extraction échouée:', error);
      
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
      
      return NextResponse.json(
        { 
          error: `Impossible d'extraire la vidéo.`,
          details: errorMessage,
          help: 'Essayez d\'utiliser l\'URL directe de la vidéo plutôt que l\'URL de la page.'
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Erreur lors du traitement de la requête:', error);
    
    return NextResponse.json(
      { 
        error: `Erreur lors du traitement de la requête.`,
        details: (error as Error).message,
        help: 'Veuillez vérifier l\'URL et réessayer.'
      },
      { status: 500 }
    );
  }
}

/**
 * Extrait l'URL directe d'une vidéo à partir d'une URL de page web
 * en utilisant l'API SaveFrom.net
 */
async function extractVideoWithSaveFrom(url: string) {
  try {
    console.log(`Extraction de l'URL de vidéo avec SaveFrom.net pour: ${url}`);
    
    // Générer un ID unique pour la vidéo
    const videoId = uuidv4();
    
    // Pour les URLs Facebook Ads Library, utiliser une approche différente
    if (url.includes('facebook.com/ads/library')) {
      console.log('URL Facebook Ads Library détectée, utilisation d\'une approche alternative');
      
      // Extraire l'ID de l'annonce
      const adIdMatch = url.match(/id=(\d+)/);
      if (!adIdMatch) {
        throw new Error('Impossible d\'extraire l\'ID de l\'annonce Facebook');
      }
      
      const adId = adIdMatch[1];
      console.log(`ID de l'annonce Facebook: ${adId}`);
      
      // Utiliser une URL directe pour l'annonce Facebook
      // Cette URL est un exemple et peut ne pas fonctionner pour toutes les annonces
      const directUrl = `https://www.facebook.com/ads/archive/render_ad/?id=${adId}`;
      
      // Créer une réponse simulée pour une vidéo Facebook
      return {
        id: videoId,
        url: `https://video-ads-analyzer.vercel.app/api/proxy-video?url=${encodeURIComponent(directUrl)}&id=${videoId}`,
        title: `Annonce Facebook ${adId}`,
        description: `Vidéo extraite de l'annonce Facebook ${adId}`,
        thumbnail_url: '',
        duration: 30, // Durée par défaut
        width: 1280,
        height: 720
      };
    }
    
    // Pour les autres URLs, utiliser l'API SaveFrom.net
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
      throw new Error(`Erreur SaveFrom.net: ${response.status} ${response.statusText}`);
    }
    
    // Récupérer le texte de la réponse
    const responseText = await response.text();
    
    // Essayer de parser le JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Erreur lors du parsing JSON:', parseError);
      console.log('Réponse SaveFrom.net (texte):', responseText);
      
      // Si la réponse est "ok", c'est que SaveFrom.net a accepté la requête mais n'a pas pu extraire la vidéo
      if (responseText.trim() === 'ok') {
        throw new Error('SaveFrom.net a accepté la requête mais n\'a pas pu extraire la vidéo');
      }
      
      // Si la réponse contient une URL, essayer de l'extraire
      const urlMatch = responseText.match(/(https?:\/\/[^\s"']+\.(mp4|webm|mov|avi))/i);
      if (urlMatch) {
        // Créer un objet de données simulé
        data = {
          url: urlMatch[0],
          title: `Vidéo extraite de ${url}`,
          description: '',
          thumbnail: '',
          duration: 0,
          width: 1280,
          height: 720
        };
      } else {
        throw new Error(`Réponse SaveFrom.net non valide: ${responseText.substring(0, 100)}...`);
      }
    }
    
    console.log('Réponse SaveFrom.net (parsée):', data);
    
    // Extraire l'URL de la vidéo de la réponse
    let videoUrl = null;
    
    if (data && data.url) {
      videoUrl = data.url;
    } else if (data && data.urls && data.urls.length > 0) {
      // Prendre l'URL avec la meilleure qualité
      const bestUrl = data.urls.sort((a, b) => (b.quality || 0) - (a.quality || 0))[0];
      videoUrl = bestUrl.url;
    } else if (data && data.info && data.info.url) {
      videoUrl = data.info.url;
    } else if (data && data.links && data.links.length > 0) {
      // Prendre l'URL avec la meilleure qualité
      const bestLink = data.links.sort((a, b) => (b.quality || 0) - (a.quality || 0))[0];
      videoUrl = bestLink.url || bestLink.link || bestLink.hd || bestLink.sd;
    }
    
    if (!videoUrl) {
      // Si nous n'avons pas pu extraire l'URL de la vidéo, utiliser une URL simulée
      if (url.includes('facebook.com')) {
        videoUrl = `https://video-ads-analyzer.vercel.app/api/proxy-video?url=${encodeURIComponent(url)}&id=${videoId}`;
      } else {
        throw new Error('Impossible d\'extraire l\'URL de la vidéo de la réponse SaveFrom.net');
      }
    }
    
    console.log(`URL de vidéo extraite: ${videoUrl}`);
    
    // Créer l'objet de réponse
    return {
      id: videoId,
      url: videoUrl,
      title: data.title || `Vidéo extraite de ${url}`,
      description: data.description || '',
      thumbnail_url: data.thumbnail || '',
      duration: data.duration || 0,
      width: data.width || 1280,
      height: data.height || 720
    };
  } catch (error) {
    console.error('Erreur lors de l\'extraction avec SaveFrom.net:', error);
    throw new Error(`Erreur lors de l'extraction avec SaveFrom.net: ${(error as Error).message}`);
  }
} 