import { NextRequest, NextResponse } from 'next/server';
import { uploadVideoFromUrlViaProxy } from '@/lib/services/cloudinary';

export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching
export const maxDuration = 60; // 60 secondes maximum pour le plan hobby de Vercel

/**
 * Handles POST requests for video transcription
 */
export async function POST(request: NextRequest) {
  try {
    // Récupérer les données de la requête
    const data = await request.json();
    const { videoUrl, source } = data;

    console.log('Transcription demandée pour:', { videoUrl, source });

    // Vérifier que les paramètres requis sont présents
    if (!videoUrl) {
      return NextResponse.json(
        { error: 'videoUrl est requis' },
        { status: 400 }
      );
    }

    // Vérifier si l'URL est une URL proxy
    if (videoUrl.includes('/api/proxy-video')) {
      // Extraire l'URL originale et l'ID
      const url = new URL(videoUrl);
      const originalUrl = url.searchParams.get('url');
      const id = url.searchParams.get('id');

      if (!originalUrl || !id) {
        return NextResponse.json(
          { error: 'URL proxy invalide' },
          { status: 400 }
        );
      }

      // Déterminer la source à partir de l'URL originale
      let videoSource = source || 'unknown';
      if (!videoSource || videoSource === 'unknown') {
        if (originalUrl.includes('facebook')) {
          videoSource = 'facebook';
        } else if (originalUrl.includes('instagram')) {
          videoSource = 'instagram';
        } else if (originalUrl.includes('youtube')) {
          videoSource = 'youtube';
        } else if (originalUrl.includes('tiktok')) {
          videoSource = 'tiktok';
        }
      }

      try {
        // Télécharger la vidéo via RapidAPI et l'uploader sur Cloudinary
        const cloudinaryResult = await uploadVideoFromUrlViaProxy(originalUrl, videoSource, {
          public_id: id,
          folder: `video-ads-${videoSource}`
        });

        console.log('Vidéo téléchargée pour transcription:', cloudinaryResult);

        // Pour l'instant, retourner un texte fictif pour la transcription
        // À remplacer par une vraie intégration avec Whisper ou un autre service de transcription
        return NextResponse.json({
          success: true,
          transcription: "Ceci est une transcription fictive. L'intégration avec un service de transcription comme OpenAI Whisper n'est pas encore implémentée.",
          language: "fr"
        });
      } catch (error) {
        console.error('Erreur lors du téléchargement de la vidéo pour transcription:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
          { error: `Erreur lors du téléchargement de la vidéo: ${errorMessage}` },
          { status: 500 }
        );
      }
    } else {
      // Pour l'instant, retourner un texte fictif pour la transcription
      return NextResponse.json({
        success: true,
        transcription: "Ceci est une transcription fictive. L'intégration avec un service de transcription comme OpenAI Whisper n'est pas encore implémentée.",
        language: "fr"
      });
    }
  } catch (error) {
    console.error('Erreur lors de la transcription:', error);
    return NextResponse.json(
      { error: `Erreur lors de la transcription: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 