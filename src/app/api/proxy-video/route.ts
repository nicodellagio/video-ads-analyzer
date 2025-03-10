import { NextRequest, NextResponse } from 'next/server';
import { uploadVideoFromUrlViaProxy } from '@/lib/services/cloudinary';

export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching
export const maxDuration = 60; // 60 secondes maximum pour le plan hobby de Vercel

export async function GET(request: NextRequest) {
  try {
    // Récupérer les paramètres de l'URL
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');
    const id = searchParams.get('id');

    // Vérifier que les paramètres requis sont présents
    if (!url || !id) {
      return NextResponse.json(
        { error: 'URL et ID sont requis' },
        { status: 400 }
      );
    }

    console.log('Téléchargement de vidéo proxy demandé pour:', { url, id });

    // Déterminer la source à partir de l'URL
    let source = 'facebook';
    if (url.includes('instagram')) {
      source = 'instagram';
    } else if (url.includes('youtube')) {
      source = 'youtube';
    } else if (url.includes('tiktok')) {
      source = 'tiktok';
    }

    try {
      // Télécharger la vidéo via RapidAPI et l'uploader sur Cloudinary
      const cloudinaryResult = await uploadVideoFromUrlViaProxy(url, source, {
        public_id: id,
        folder: `video-ads-${source}`
      });

      console.log('Vidéo téléchargée et uploadée sur Cloudinary:', cloudinaryResult);

      // Rediriger vers l'URL Cloudinary de la vidéo
      return NextResponse.redirect(cloudinaryResult.url);
    } catch (error) {
      console.error('Erreur lors du téléchargement de la vidéo:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return NextResponse.json(
        { error: `Erreur lors du téléchargement de la vidéo: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erreur de traitement de la requête:', error);
    return NextResponse.json(
      { error: `Erreur de traitement de la requête: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 