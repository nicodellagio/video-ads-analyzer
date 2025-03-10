import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching

export async function GET(request: NextRequest) {
  try {
    // Récupérer l'URL et l'ID de la vidéo depuis les paramètres de requête
    const url = request.nextUrl.searchParams.get('url');
    const id = request.nextUrl.searchParams.get('id');
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }
    
    console.log(`Proxy video request for: ${url}`);
    
    // Créer une réponse simulée pour une vidéo
    // Dans un cas réel, vous feriez un fetch de la vidéo et la renverriez
    // Mais pour simplifier, nous renvoyons juste une URL de vidéo de démonstration
    
    // URL d'une vidéo de démonstration (Big Buck Bunny)
    const demoVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    
    // Rediriger vers la vidéo de démonstration
    return NextResponse.redirect(demoVideoUrl);
  } catch (error) {
    console.error('Error in proxy-video:', error);
    
    return NextResponse.json(
      { error: `Error in proxy-video: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 