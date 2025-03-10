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
      
      // Vérifier si l'erreur est liée à Cloudinary
      if (errorMessage.includes('Cloudinary') || errorMessage.includes('cloudinary')) {
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: `Unable to extract video: ${errorMessage}` },
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
      { error: `Error processing request: ${errorMessage}` },
      { status: 500 }
    );
  }
} 