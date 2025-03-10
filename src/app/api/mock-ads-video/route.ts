import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * Endpoint de simulation pour les vidéos d'annonces Facebook
 * À utiliser uniquement pour les tests et le développement
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { url, source } = data;

    console.log('Simulation de vidéo demandée pour:', { url, source });

    // Extraire l'ID de l'annonce si c'est une URL Facebook Ads
    let adId = 'unknown';
    if (url.includes('facebook.com/ads/library') && url.includes('id=')) {
      try {
        const urlObj = new URL(url);
        adId = urlObj.searchParams.get('id') || 'unknown';
      } catch (e) {
        // Ignorer les erreurs d'analyse d'URL
      }
    }

    // Générer un ID unique
    const videoId = uuidv4();

    // Renvoyer des métadonnées simulées avec une vidéo d'exemple de Cloudinary
    return NextResponse.json({
      success: true,
      video: {
        id: videoId,
        url: 'https://res.cloudinary.com/dbsbvpikt/video/upload/v1662123456/sample.mp4',
        duration: '30',
        format: '1280x720',
        size: '1.5 MB',
        originalName: `Facebook Ad ${adId}`,
        width: 1280,
        height: 720,
        // Message explicatif pour que l'utilisateur comprenne qu'il s'agit d'une simulation
        simulation_notice: "Ceci est une vidéo de simulation. Facebook ne permet pas l'extraction directe des vidéos depuis sa bibliothèque d'annonces. En production, utilisez une URL directe de vidéo Facebook."
      }
    });
  } catch (error) {
    console.error('Erreur lors de la simulation:', error);
    return NextResponse.json({
      error: `Erreur lors de la simulation: ${(error as Error).message}`
    }, { status: 500 });
  }
} 