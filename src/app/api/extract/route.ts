import { NextRequest, NextResponse } from 'next/server';
import { validateUrl, extractFacebookVideo, extractInstagramVideo } from '@/lib/utils/extractor';
import type { VideoSource } from '@/lib/utils/extractor';
import { isServerless } from '@/lib/config/environment';

export const maxDuration = 60; // 60 secondes maximum pour le plan hobby de Vercel
export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching

export async function POST(request: NextRequest) {
  try {
    // Retrieve request data
    const data = await request.json();
    const { url, source } = data;

    console.log('Extraction requested for:', { url, source });

    // Verify required parameters are present
    if (!url || !source) {
      return NextResponse.json(
        { error: 'URL and source are required' },
        { status: 400 }
      );
    }

    // Validate URL based on source
    if (!validateUrl(url)) {
      return NextResponse.json(
        { error: `Invalid URL for source ${source}` },
        { status: 400 }
      );
    }

    // Vérifier si l'URL est une URL Facebook ou Instagram
    if (isServerless) {
      if ((source === 'meta' || url.includes('facebook.com')) && !url.includes('fbcdn.net')) {
        return NextResponse.json(
          { 
            error: 'L\'extraction de vidéos Facebook n\'est pas prise en charge en environnement serverless.',
            details: 'Les restrictions de sécurité de Facebook empêchent l\'extraction automatique de vidéos.',
            help: 'Veuillez télécharger directement la vidéo depuis votre ordinateur en utilisant le bouton "Télécharger" en haut de la page.'
          },
          { status: 400 }
        );
      }
      
      if ((source === 'instagram' || url.includes('instagram.com')) && !url.includes('cdninstagram.com')) {
        return NextResponse.json(
          { 
            error: 'L\'extraction de vidéos Instagram n\'est pas prise en charge en environnement serverless.',
            details: 'Les restrictions de sécurité d\'Instagram empêchent l\'extraction automatique de vidéos.',
            help: 'Veuillez télécharger directement la vidéo depuis votre ordinateur en utilisant le bouton "Télécharger" en haut de la page.'
          },
          { status: 400 }
        );
      }
    }

    // Extract video based on source
    try {
      let videoMetadata;
      
      if (source === 'meta') {
        console.log('Attempting extraction for Facebook...');
        videoMetadata = await extractFacebookVideo(url);
      } else if (source === 'instagram') {
        console.log('Attempting extraction for Instagram...');
        videoMetadata = await extractInstagramVideo(url);
      } else {
        return NextResponse.json(
          { error: `Extraction for source ${source} is not yet implemented` },
          { status: 501 }
        );
      }
      
      console.log('Extraction successful:', videoMetadata);
      return NextResponse.json({ success: true, video: videoMetadata });
    } catch (error) {
      console.error('Extraction failed:', error);
      
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
      
      // Messages d'erreur spécifiques pour aider l'utilisateur
      if (errorMessage.includes('Facebook') || (source === 'meta' && errorMessage.includes('extraction'))) {
        return NextResponse.json(
          { 
            error: 'Impossible d\'extraire la vidéo Facebook.',
            details: errorMessage,
            help: 'Veuillez télécharger directement la vidéo depuis votre ordinateur en utilisant le bouton "Télécharger" en haut de la page.'
          },
          { status: 400 }
        );
      } else if (errorMessage.includes('Instagram') || (source === 'instagram' && errorMessage.includes('extraction'))) {
        return NextResponse.json(
          { 
            error: 'Impossible d\'extraire la vidéo Instagram.',
            details: errorMessage,
            help: 'Veuillez télécharger directement la vidéo depuis votre ordinateur en utilisant le bouton "Télécharger" en haut de la page.'
          },
          { status: 400 }
        );
      } else if (errorMessage.includes('Cloudinary')) {
        return NextResponse.json(
          { 
            error: 'Erreur lors du téléchargement de la vidéo vers Cloudinary.',
            details: errorMessage,
            help: 'Veuillez télécharger directement la vidéo depuis votre ordinateur en utilisant le bouton "Télécharger" en haut de la page.'
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { 
          error: `Impossible d'extraire la vidéo.`,
          details: errorMessage,
          help: 'Veuillez télécharger directement la vidéo depuis votre ordinateur en utilisant le bouton "Télécharger" en haut de la page.'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing request:', error);
    
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
        error: `Erreur lors du traitement de la requête.`,
        details: errorMessage,
        help: 'Veuillez télécharger directement la vidéo depuis votre ordinateur en utilisant le bouton "Télécharger" en haut de la page.'
      },
      { status: 500 }
    );
  }
} 