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

    // Extract video ID from URL
    const videoId = videoUrl.split('/').pop()?.split('.')[0];
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'Unable to extract the video ID from the URL' },
        { status: 400 }
      );
    }
    
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
    } else {
      // Pour le stockage local, vérifier si le fichier existe
      fileExists = existsSync(videoPath);
    }
    
    if (!fileExists) {
      console.error(`Video file not found: ${videoPath}`);
      return NextResponse.json(
        { error: 'Video file not found' },
        { status: 404 }
      );
    }

    // Transcribe video with OpenAI Whisper
    console.log(`Transcription of the video: ${videoId}`);
    const transcription = await transcribeVideo(videoPath, {
      responseFormat: 'verbose_json',
    });

    console.log(`Transcription completed for the video: ${videoId}`);

    // Return transcription results
    return NextResponse.json(transcription);
  } catch (error) {
    console.error('Error during transcription:', error);
    return NextResponse.json(
      { error: `Error during transcription: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 