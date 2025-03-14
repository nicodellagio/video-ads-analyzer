import { NextRequest, NextResponse } from 'next/server';
import { BusinessAdsAPI, AdCreative, Ad } from 'facebook-nodejs-business-sdk';

// Configuration des identifiants Meta
const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

// Formats d'URL supportés
const FB_AD_LIBRARY_REGEX = /facebook\.com\/ads\/library\/\?id=(\d+)/;
const FB_POST_REGEX = /facebook\.com\/(.*?)\/posts\/(\d+)/;
const IG_POST_REGEX = /instagram\.com\/p\/([A-Za-z0-9_-]+)/;

/**
 * Extrait l'ID d'une publicité à partir d'une URL
 */
function extractAdId(url: string): string | null {
  // Format bibliothèque d'annonces
  const adLibraryMatch = url.match(FB_AD_LIBRARY_REGEX);
  if (adLibraryMatch) return adLibraryMatch[1];
  
  // Autres formats à implémenter selon vos besoins
  return null;
}

/**
 * Récupère les détails d'une annonce, y compris ses ressources créatives
 */
async function getAdDetails(adId: string) {
  try {
    if (!APP_ID || !APP_SECRET || !ACCESS_TOKEN) {
      throw new Error('Identifiants Meta non configurés');
    }

    // Initialiser l'API avec les identifiants
    const api = new BusinessAdsAPI();
    api.init(APP_ID, APP_SECRET, ACCESS_TOKEN);

    // Récupérer l'annonce
    const ad = new Ad(adId);
    const adData = await ad.get(['creative', 'adset', 'campaign']);

    // Récupérer le contenu créatif
    const creativeId = adData.creative.id;
    const creative = new AdCreative(creativeId);
    const creativeData = await creative.get([
      'video_id',
      'image_url',
      'thumbnail_url',
      'asset_feed_spec',
      'object_story_spec'
    ]);

    // Extraire l'URL de la vidéo si disponible
    let videoUrl = null;
    if (creativeData.video_id) {
      // Construire l'URL de la vidéo à partir de l'ID de vidéo
      videoUrl = `https://business.facebook.com/business_locations/download_video?video_id=${creativeData.video_id}`;
      
      // Ou utiliser l'API vidéo pour obtenir les liens de streaming
      // Cette partie nécessiterait des appels supplémentaires à l'API
    }

    return {
      adId,
      campaign: adData.campaign?.name,
      adset: adData.adset?.name,
      creativeId,
      videoId: creativeData.video_id,
      videoUrl,
      imageUrl: creativeData.image_url,
      thumbnailUrl: creativeData.thumbnail_url,
      rawCreativeData: creativeData
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des détails de l'annonce:", error);
    throw error;
  }
}

/**
 * Point d'entrée de l'API
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL non fournie' },
        { status: 400 }
      );
    }

    console.log(`Extraction de contenu pour l'URL: ${url}`);

    // Extraire l'ID de l'annonce à partir de l'URL
    const adId = extractAdId(url);
    if (!adId) {
      return NextResponse.json(
        { error: 'Format d\'URL non supporté ou ID d\'annonce non trouvé' },
        { status: 400 }
      );
    }

    // Récupérer les détails de l'annonce
    const adDetails = await getAdDetails(adId);

    // Vérifier si une vidéo a été trouvée
    if (!adDetails.videoUrl) {
      return NextResponse.json(
        { error: 'Aucune vidéo trouvée dans cette annonce' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      adDetails,
      videoUrl: adDetails.videoUrl
    });

  } catch (error) {
    console.error("Erreur lors de l'extraction:", error);
    return NextResponse.json(
      { error: `Erreur lors de l'extraction: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 