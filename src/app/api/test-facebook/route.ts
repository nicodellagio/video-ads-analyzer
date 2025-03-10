import { NextRequest, NextResponse } from 'next/server';
import { isServerless } from '@/lib/config/environment';
import { uploadVideoFromUrlViaProxy } from '@/lib/services/cloudinary';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching

export async function GET(request: NextRequest) {
  try {
    // URL de test Facebook Ads Library
    const url = 'https://www.facebook.com/ads/library/?id=979549317467848';
    
    console.log('Test d\'extraction Facebook pour:', url);
    console.log('Environnement serverless:', isServerless);
    
    // Générer un ID unique pour la vidéo
    const videoId = uuidv4();
    
    try {
      // Utiliser directement le proxy pour extraire la vidéo Facebook
      const result = await uploadVideoFromUrlViaProxy(url, 'facebook', {
        public_id: videoId,
        folder: 'video-ads-facebook-test'
      });
      
      return NextResponse.json({
        success: true,
        message: 'Extraction réussie',
        result: {
          id: result.id,
          url: result.url,
          duration: result.duration,
          format: result.format,
          size: result.size,
          originalName: result.originalName,
          width: result.width,
          height: result.height
        }
      });
    } catch (error) {
      console.error('Erreur lors du test d\'extraction Facebook:', error);
      
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
      
      return NextResponse.json({
        success: false,
        message: 'Échec de l\'extraction',
        error: errorMessage
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Erreur lors du test:', error);
    
    return NextResponse.json(
      { error: `Error during test: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 