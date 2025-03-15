import { NextRequest, NextResponse } from 'next/server';
import { validateUrl } from '@/lib/utils/extractor';
import type { VideoSource } from '@/lib/utils/extractor';
import { v4 as uuidv4 } from 'uuid';
import { extractVideoFromUrl } from '@/lib/services/apify-extraction';
import { saveVideoFile } from '@/lib/utils/video';

export const maxDuration = 60; // 1 minute maximum for processing (Vercel hobby plan limit)
export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching

export async function POST(request: NextRequest) {
  try {
    // Retrieve request data
    const data = await request.json();
    const { url, source } = data;

    console.log('Meta extraction requested for:', { url, source });

    // Verify required parameters are present
    if (!url || !source) {
      return NextResponse.json(
        { error: 'URL and source are required' },
        { status: 400 }
      );
    }

    // Validate URL based on source
    if (!validateUrl(url, source as VideoSource)) {
      return NextResponse.json(
        { error: `Invalid URL for source ${source}` },
        { status: 400 }
      );
    }

    // Vérifier si le token API Apify est configuré
    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json({
        error: 'APIFY_API_TOKEN is not configured in environment variables'
      }, { status: 500 });
    }

    // Extraction avec Apify
    try {
      console.log(`Extraction depuis ${source} en utilisant Apify...`);
      
      // Utiliser le service Apify pour extraire la vidéo
      const extractedVideo = await extractVideoFromUrl(url);
      console.log('Vidéo extraite avec succès:', extractedVideo.videoUrl);
      
      // Télécharger la vidéo depuis l'URL extraite
      console.log('Téléchargement de la vidéo...');
      const videoResponse = await fetch(extractedVideo.videoUrl);
      
      if (!videoResponse.ok) {
        throw new Error(`Erreur lors du téléchargement de la vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
      }
      
      // Convertir la réponse en blob
      const videoBlob = await videoResponse.blob();
      
      // Générer un identifiant unique et un nom de fichier
      const fileId = uuidv4();
      const fileExtension = 'mp4'; // Forcer l'extension mp4 pour la compatibilité
      const fileName = `${fileId}.${fileExtension}`;
      
      // Convertir le blob en File
      const videoFile = new File([videoBlob], fileName, { 
        type: 'video/mp4' // Forcer le type MIME pour la compatibilité
      });
      
      // Sauvegarder le fichier (localement ou sur S3 selon l'environnement)
      console.log('Sauvegarde du fichier vidéo...');
      const { filePath, s3Key, url: fileUrl } = await saveVideoFile(videoFile, fileName);
      
      // Construire les métadonnées de la vidéo
      const videoMetadata = {
        id: fileId,
        url: fileUrl || `/uploads/${fileName}`,
        s3Key,
        format: `${extractedVideo.metadata?.width || 'unknown'}x${extractedVideo.metadata?.height || 'unknown'}`,
        size: `${(videoBlob.size / (1024 * 1024)).toFixed(1)} MB`,
        duration: extractedVideo.duration || '00:00:30', // Durée par défaut si non disponible
        originalName: fileName,
        title: extractedVideo.title,
        description: extractedVideo.description,
        thumbnailUrl: extractedVideo.thumbnailUrl,
        source: extractedVideo.source,
        originalUrl: extractedVideo.originalUrl,
        metadata: extractedVideo.metadata
      };
      
      console.log('Extraction Meta complète:', videoMetadata);
      return NextResponse.json({ success: true, video: videoMetadata });
    } catch (error) {
      console.error('Extraction Meta failed:', error);
      return NextResponse.json(
        { error: `Unable to extract from Meta: ${(error as Error).message}` },
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