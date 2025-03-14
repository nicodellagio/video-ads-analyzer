import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUrl } from '@/lib/services/s3';
import { USE_S3_STORAGE } from '@/lib/utils/constants';

/**
 * Endpoint de test pour vérifier l'accès au bucket S3
 */
export async function POST(request: NextRequest) {
  try {
    // Récupérer l'URL de la vidéo à tester depuis le corps de la requête
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'URL de la vidéo manquante' },
        { status: 400 }
      );
    }

    console.log(`Test de récupération de la vidéo: ${videoUrl}`);

    // Vérifier si nous sommes en mode S3
    if (!USE_S3_STORAGE) {
      return NextResponse.json(
        { 
          success: true, 
          message: 'Mode de stockage local - Aucun test S3 nécessaire',
          isS3: false
        }
      );
    }

    // Extraire l'ID ou la clé S3 de l'URL
    let s3Key;
    try {
      if (videoUrl.includes('/videos/')) {
        // Si l'URL contient déjà le préfixe /videos/
        s3Key = videoUrl.split('/videos/')[1].split('?')[0];
        if (!s3Key.startsWith('videos/')) {
          s3Key = `videos/${s3Key}`;
        }
      } else {
        // Extraire juste le nom du fichier/ID
        const videoId = videoUrl.split('/').pop()?.split('.')[0]?.split('?')[0];
        if (!videoId) {
          throw new Error('Impossible d\'extraire l\'ID de la vidéo');
        }
        s3Key = `videos/${videoId}.mp4`;
      }
    } catch (err) {
      console.error('Erreur lors de l\'extraction de la clé S3:', err);
      return NextResponse.json(
        { 
          error: 'Format d\'URL de vidéo non valide',
          details: (err as Error).message 
        },
        { status: 400 }
      );
    }

    // Générer une URL signée pour S3
    console.log(`Génération d'une URL signée pour la clé S3: ${s3Key}`);
    try {
      const signedUrl = await getPresignedUrl(s3Key);
      
      // Tester l'accès au fichier
      console.log(`Test d'accès à l'URL signée: ${signedUrl}`);
      const response = await fetch(signedUrl);
      
      if (!response.ok) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Erreur lors de l'accès au fichier: ${response.status} ${response.statusText}`,
            s3Key,
            signedUrl
          },
          { status: 404 }
        );
      }
      
      // Récupérer les informations sur le contenu
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      // Lire les 1024 premiers octets pour vérifier que le fichier est accessible
      const buffer = await response.arrayBuffer();
      const firstChunkSize = Math.min(buffer.byteLength, 1024);
      
      return NextResponse.json({
        success: true,
        message: 'Vidéo accessible dans le bucket S3',
        s3Key,
        signedUrl,
        contentType,
        contentLength,
        firstChunkSize,
        totalSize: buffer.byteLength
      });
      
    } catch (error) {
      console.error('Erreur lors du test d\'accès S3:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: `Erreur lors du test d'accès S3: ${(error as Error).message}`,
          s3Key
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erreur générale:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Erreur générale: ${(error as Error).message}` 
      },
      { status: 500 }
    );
  }
} 