import { NextRequest, NextResponse } from 'next/server';
import { validateUrl, extractFacebookVideo, extractInstagramVideo, extractVideoFromUrl } from '@/lib/utils/extractor';
import type { VideoSource } from '@/lib/utils/extractor';
import { isServerless } from '@/lib/config/environment';

export const maxDuration = 60; // 60 secondes maximum pour le plan hobby de Vercel
export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching

export async function POST(request: NextRequest) {
  try {
    // Retrieve request data
    const data = await request.json();
    const { url: originalUrl, source } = data;
    let url = originalUrl;

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

    // Vérifier si l'URL est une URL Facebook Ads Library
    if (source === 'meta' && url.includes('facebook.com/ads/library')) {
      console.log('URL Facebook Ads Library détectée, utilisation du simulateur');
      
      try {
        // Utiliser l'endpoint de simulation pour ce type d'URL
        const response = await fetch(`${request.nextUrl.origin}/api/mock-ads-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, source }),
        });
        
        if (!response.ok) {
          throw new Error(`Échec de l'appel au simulateur: ${response.status}`);
        }
        
        const result = await response.json();
        return NextResponse.json(result);
      } catch (error) {
        console.error('Erreur lors de la simulation:', error);
        
        return NextResponse.json(
          { 
            error: `Les URLs Facebook Ads Library ne peuvent pas être extraites directement en raison des restrictions de Facebook. Veuillez utiliser une URL directe de vidéo Facebook à la place.`,
            technical_details: error instanceof Error ? error.message : String(error)
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
      } else if (source === 'youtube' || source === 'tiktok') {
        console.log(`Attempting extraction for ${source}...`);
        videoMetadata = await extractVideoFromUrl({ url, source });
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
      
      // Vérifier le type d'erreur
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Erreurs spécifiques Facebook Ads Library
      if (errorMessage.includes('Facebook Ads Library') || 
          (source === 'meta' && url.includes('facebook.com/ads/library'))) {
        return NextResponse.json(
          { 
            error: `Les URLs Facebook Ads Library ne peuvent pas être extraites directement en raison des restrictions de Facebook. Veuillez utiliser une URL directe de vidéo Facebook à la place.`,
            technical_details: errorMessage
          },
          { status: 400 }
        );
      }
      
      // Erreurs spécifiques API
      if (errorMessage.includes('RapidAPI')) {
        return NextResponse.json(
          { error: `Erreur d'extraction via API: ${errorMessage}` },
          { status: 400 }
        );
      }
      
      // Erreurs Cloudinary
      if (errorMessage.includes('Cloudinary')) {
        return NextResponse.json(
          { error: `Erreur Cloudinary: ${errorMessage}` },
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
    return NextResponse.json(
      { error: `Error processing request: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 