import { NextRequest, NextResponse } from 'next/server';
import { isServerless } from '@/lib/config/environment';

export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching

export async function GET(request: NextRequest) {
  try {
    // Récupérer les variables d'environnement (sans les secrets)
    const env = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? '***' : undefined,
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? '***' : undefined,
      CLOUDINARY_URL: process.env.CLOUDINARY_URL ? '***' : undefined,
      META_APP_ID: process.env.META_APP_ID,
      META_APP_SECRET: process.env.META_APP_SECRET ? '***' : undefined,
      META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN ? '***' : undefined,
      RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ? '***' : undefined,
      isServerless: isServerless
    };
    
    // Vérifier si Cloudinary est correctement configuré
    let cloudinaryStatus = 'Non configuré';
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      cloudinaryStatus = 'Configuré';
      
      try {
        const { v2 } = await import('cloudinary');
        
        // Vérifier si la configuration est correcte
        const result = await v2.api.ping();
        if (result && result.status === 'ok') {
          cloudinaryStatus = 'Connecté';
        } else {
          cloudinaryStatus = 'Erreur de connexion';
        }
      } catch (error) {
        cloudinaryStatus = `Erreur: ${(error as Error).message}`;
      }
    }
    
    // Vérifier si SaveFrom.net est accessible
    let saveFromStatus = 'Non testé';
    try {
      const response = await fetch('https://worker.sf-tools.com/savefrom.php?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
          'Origin': 'https://en.savefrom.net',
          'Referer': 'https://en.savefrom.net/'
        }
      });
      
      if (response.ok) {
        saveFromStatus = 'Accessible';
      } else {
        saveFromStatus = `Erreur: ${response.status} ${response.statusText}`;
      }
    } catch (error) {
      saveFromStatus = `Erreur: ${(error as Error).message}`;
    }
    
    return NextResponse.json({
      env,
      status: {
        cloudinary: cloudinaryStatus,
        saveFrom: saveFromStatus
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Error checking environment: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 