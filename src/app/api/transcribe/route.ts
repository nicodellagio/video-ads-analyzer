import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { transcribeVideo } from '@/lib/utils/transcription';
import { getVideoPath } from '@/lib/utils/video';
import { USE_S3_STORAGE } from '@/lib/utils/constants';

/**
 * Handles POST requests for video transcription
 */
export async function POST(request: NextRequest) {
  try {
    // Get video URL from request body
    const { videoUrl, source } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'URL of the video is missing' },
        { status: 400 }
      );
    }

    console.log(`Request for transcription for the video: ${videoUrl}`);
    console.log(`Environment: ${USE_S3_STORAGE ? 'Vercel/S3' : 'Local'}, Source: ${source || 'unknown'}`);

    // Extract video ID from URL
    const videoId = videoUrl.split('/').pop()?.split('.')[0]?.split('?')[0];
    
    if (!videoId) {
      console.error(`Unable to extract video ID from URL: ${videoUrl}`);
      return NextResponse.json(
        { error: 'Unable to extract the video ID from the URL' },
        { status: 400 }
      );
    }
    
    console.log(`Extracted video ID: ${videoId}`);
    
    // Get video file path
    const videoPath = getVideoPath(videoId);
    
    // Check if video file exists, considering S3 for Vercel deployment
    let fileExists = false;
    
    if (USE_S3_STORAGE) {
      // En déploiement Vercel, nous supposons que l'URL est valide
      // car la vérification d'existence se fait différemment pour S3
      fileExists = true;
      
      // Si l'URL ne commence pas par /uploads/ ou https://, c'est probablement une URL invalide
      if (!videoUrl.startsWith('/uploads/') && !videoUrl.startsWith('https://')) {
        console.error(`Invalid video URL format: ${videoUrl}`);
        return NextResponse.json(
          { error: 'Invalid video URL format' },
          { status: 400 }
        );
      }
      
      console.log(`Using video URL for S3: ${videoUrl}`);
    } else {
      // Pour le stockage local, vérifier si le fichier existe
      fileExists = existsSync(videoPath);
      console.log(`Checking local file existence: ${videoPath}, exists: ${fileExists}`);
    }
    
    if (!fileExists) {
      console.error(`Video file not found: ${videoPath}`);
      return NextResponse.json(
        { error: 'Video file not found' },
        { status: 404 }
      );
    }

    // Transcribe video with OpenAI Whisper
    console.log(`Starting transcription for video: ${videoId}`);
    
    try {
      // Dans l'environnement S3, utiliser directement l'URL si disponible
      let pathForTranscription = videoPath;
      
      if (USE_S3_STORAGE && videoUrl.startsWith('https://')) {
        // Assurer que l'URL S3 est complète
        pathForTranscription = videoUrl;
        
        // Si l'URL contient des paramètres de requête (comme les signatures AWS), les garder
        console.log(`Using S3 URL for transcription: ${pathForTranscription}`);
      } else {
        console.log(`Using local path for transcription: ${pathForTranscription}`);
      }
      
      // Lancer la transcription avec traçage des erreurs
      console.log(`Calling OpenAI API for video: ${videoId}`);
      const transcription = await transcribeVideo(pathForTranscription, {
        responseFormat: 'verbose_json',
      });

      console.log(`Transcription completed successfully for the video: ${videoId}`);
      console.log(`Transcription results: language=${transcription.language || 'unknown'}, text length=${transcription.text?.length || 0} chars`);

      // Return transcription results
      return NextResponse.json(transcription);
    } catch (transcriptionError) {
      console.error(`Transcription failed for ${videoId}:`, transcriptionError);
      
      // Vérifier si l'erreur est liée au format de fichier
      const errorMsg = (transcriptionError as Error).message || '';
      console.error(`Transcription error details: ${errorMsg}`);
      
      if (errorMsg.includes('Invalid file format') || errorMsg.includes('format')) {
        return NextResponse.json(
          { 
            error: `Format de fichier non supporté. L'API de transcription accepte uniquement les formats audio: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm. Erreur: ${errorMsg}` 
          },
          { status: 400 }
        );
      }
      
      // Renvoyer l'erreur générique
      throw transcriptionError;
    }
  } catch (error) {
    console.error('Error during transcription API call:', error);
    return NextResponse.json(
      { error: `Error during transcription: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 