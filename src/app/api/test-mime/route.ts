import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUrl } from '@/lib/services/s3';
import { USE_S3_STORAGE } from '@/lib/utils/constants';

/**
 * Endpoint de test pour vérifier les MIME types des fichiers
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

    console.log(`Test de MIME type pour la vidéo: ${videoUrl}`);

    // Déterminer la source de l'URL
    let sourceUrl = videoUrl;
    
    // Si nous utilisons S3 et que l'URL n'est pas complète
    if (USE_S3_STORAGE && !videoUrl.startsWith('https://')) {
      try {
        // Essayer d'extraire la clé S3
        let s3Key;
        if (videoUrl.includes('/videos/')) {
          s3Key = videoUrl.split('/videos/')[1].split('?')[0];
          if (!s3Key.startsWith('videos/')) {
            s3Key = `videos/${s3Key}`;
          }
        } else {
          const videoId = videoUrl.split('/').pop()?.split('.')[0] || videoUrl;
          s3Key = `videos/${videoId}.mp4`;
        }
        
        // Générer une URL signée
        sourceUrl = await getPresignedUrl(s3Key);
        console.log(`URL S3 générée: ${sourceUrl}`);
      } catch (error) {
        console.error('Erreur lors de la génération de l\'URL S3:', error);
        return NextResponse.json(
          { 
            error: `Erreur lors de la génération de l'URL S3: ${(error as Error).message}` 
          },
          { status: 500 }
        );
      }
    }
    
    // Tester l'accès au fichier et récupérer les informations MIME
    try {
      console.log(`Récupération des informations du fichier depuis: ${sourceUrl}`);
      const response = await fetch(sourceUrl);
      
      if (!response.ok) {
        return NextResponse.json(
          { 
            error: `Erreur lors de l'accès au fichier: ${response.status} ${response.statusText}` 
          },
          { status: response.status }
        );
      }
      
      // Récupérer le type MIME et créer un tableau de types compatibles
      const originalContentType = response.headers.get('content-type') || 'inconnu';
      const contentLength = response.headers.get('content-length');
      
      // Extensions de fichier acceptées par l'API OpenAI Whisper
      const acceptedExtensions = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
      
      // MIME types correspondants
      const acceptedMimeTypes = [
        'audio/flac', 
        'audio/m4a',
        'audio/mp3',
        'audio/mp4',
        'audio/mpeg',
        'audio/mpga',
        'audio/ogg',
        'audio/wav',
        'audio/webm',
        'video/mp4',
        'video/mpeg',
        'video/ogg',
        'video/webm'
      ];
      
      // Déterminer le type MIME que nous utiliserions pour OpenAI
      let suggestedMimeType = 'audio/mp4'; // Type par défaut pour l'API OpenAI
      const fileName = sourceUrl.split('/').pop()?.split('?')[0].toLowerCase() || '';
      
      if (fileName.endsWith('.mp3')) {
        suggestedMimeType = 'audio/mpeg';
      } else if (fileName.endsWith('.wav')) {
        suggestedMimeType = 'audio/wav';
      } else if (fileName.endsWith('.ogg')) {
        suggestedMimeType = 'audio/ogg';
      } else if (fileName.endsWith('.flac')) {
        suggestedMimeType = 'audio/flac';
      } else if (fileName.endsWith('.m4a')) {
        suggestedMimeType = 'audio/m4a';
      } else if (fileName.endsWith('.webm')) {
        suggestedMimeType = 'audio/webm';
      }
      
      // Vérifier si le type MIME original est compatible
      const isOriginalTypeAccepted = acceptedMimeTypes.includes(originalContentType);
      
      // Vérifier si l'extension est compatible
      const fileExtension = fileName.split('.').pop() || '';
      const isExtensionAccepted = acceptedExtensions.includes(fileExtension);
      
      // Lire une partie du fichier
      const buffer = await response.arrayBuffer();
      
      return NextResponse.json({
        success: true,
        sourceUrl,
        fileName,
        fileSize: contentLength ? `${Math.round(parseInt(contentLength) / 1024)} Ko` : 'Inconnu',
        originalContentType,
        suggestedMimeType,
        isOriginalTypeAccepted,
        isExtensionAccepted,
        acceptedMimeTypes,
        acceptedExtensions,
        fileExtension,
        bufferSize: buffer.byteLength,
        recommendations: [
          !isOriginalTypeAccepted ? 
            "Le type MIME original n'est pas dans la liste des types acceptés par l'API OpenAI." : null,
          !isExtensionAccepted ? 
            "L'extension du fichier n'est pas dans la liste des extensions acceptées par l'API OpenAI." : null,
          "Pour les fichiers MP4, OpenAI recommande d'utiliser le type MIME 'audio/mp4', même si le fichier est une vidéo."
        ].filter(Boolean)
      });
      
    } catch (error) {
      console.error('Erreur lors du test MIME:', error);
      return NextResponse.json(
        { 
          error: `Erreur lors du test MIME: ${(error as Error).message}` 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Erreur générale:', error);
    return NextResponse.json(
      { 
        error: `Erreur générale: ${(error as Error).message}` 
      },
      { status: 500 }
    );
  }
} 