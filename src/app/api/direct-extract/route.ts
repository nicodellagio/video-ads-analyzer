import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching
export const maxDuration = 60; // 60 secondes maximum pour le plan hobby de Vercel

export async function POST(request: NextRequest) {
  try {
    // Retrieve request data
    const data = await request.json();
    const { url: originalUrl, source } = data;
    let url = originalUrl;

    console.log('Extraction directe demandée pour:', { url, source });

    // Vérifier que les paramètres requis sont présents
    if (!url || !source) {
      return NextResponse.json(
        { error: 'URL and source are required' },
        { status: 400 }
      );
    }

    // Traiter les URLs Facebook Ads Library
    if (source === 'meta' && url.includes('facebook.com/ads/library')) {
      console.log('URL Facebook Ads Library détectée');
      
      // Extraire l'ID de l'annonce
      let adId = '';
      try {
        const urlObj = new URL(url);
        adId = urlObj.searchParams.get('id') || '';
        
        if (!adId) {
          return NextResponse.json(
            { error: 'Impossible d\'extraire l\'ID de l\'annonce depuis l\'URL' },
            { status: 400 }
          );
        }
        
        // Remplacer l'URL par l'URL directe de Facebook Ads Archive
        url = `https://www.facebook.com/ads/archive/render_ad/?id=${adId}`;
        console.log('URL transformée pour extraction:', url);
      } catch (error) {
        return NextResponse.json(
          { error: 'URL Facebook Ads Library invalide' },
          { status: 400 }
        );
      }
    }

    // Générer un ID unique pour la vidéo
    const videoId = uuidv4();
    
    // Au lieu d'extraire directement la vidéo, nous créons une URL proxy
    // qui sera utilisée pour récupérer la vidéo à la demande
    const proxyUrl = `${request.nextUrl.origin}/api/proxy-video?url=${encodeURIComponent(url)}&id=${videoId}`;
    
    // Construire des métadonnées fictives pour la vidéo
    // Les vraies métadonnées seront récupérées lors de l'accès à l'URL proxy
    const videoMetadata = {
      id: videoId,
      url: proxyUrl,
      duration: source === 'meta' ? '30' : '0', // Durée fictive pour Facebook
      format: '1280x720',                      // Format fictif
      size: '0',                               // Taille inconnue pour l'instant
      originalName: source === 'meta' 
        ? `Annonce Facebook ${adId || url.split('/').pop() || videoId}` 
        : `Video ${source} ${videoId}`,
      width: 1280,
      height: 720
    };
    
    return NextResponse.json({ 
      success: true, 
      video: videoMetadata 
    });
  } catch (error) {
    console.error('Erreur lors de l\'extraction directe:', error);
    return NextResponse.json({
      error: `Erreur lors de l'extraction directe: ${(error as Error).message}`
    }, { status: 500 });
  }
} 