import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { transcribeVideo } from '@/lib/utils/transcription';
import { getVideoPath } from '@/lib/utils/video';
import { USE_S3_STORAGE } from '@/lib/utils/constants';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import https from 'https';
import { UPLOAD_DIR } from '@/lib/utils/video';

/**
 * Télécharge un fichier depuis une URL vers un chemin local
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          await writeFile(outputPath, buffer);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      response.on('error', (err) => reject(err));
    });
  });
}

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
    const videoId = videoUrl.split('/').pop()?.split('.')[0]?.split('?')[0];
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'Unable to extract the video ID from the URL' },
        { status: 400 }
      );
    }
    
    // Get video file path
    const videoPath = getVideoPath(videoId);
    
    let localFilePath = videoPath;
    let needsCleanup = false;
    
    // Si nous utilisons S3 et que l'URL est une URL S3, téléchargeons le fichier temporairement
    if (USE_S3_STORAGE && videoUrl.includes('s3.') && !existsSync(videoPath)) {
      localFilePath = join(UPLOAD_DIR, `${videoId}_temp.mp4`);
      console.log(`Downloading S3 file to: ${localFilePath}`);
      
      try {
        await downloadFile(videoUrl, localFilePath);
        needsCleanup = true;
      } catch (error) {
        console.error(`Failed to download file from S3: ${error}`);
        return NextResponse.json(
          { error: `Failed to download video file: ${(error as Error).message}` },
          { status: 500 }
        );
      }
    }
    
    // Check if video file exists locally after potential download
    if (!existsSync(localFilePath)) {
      return NextResponse.json(
        { error: 'Video file not found' },
        { status: 404 }
      );
    }

    // Transcribe video with OpenAI Whisper
    console.log(`Transcription of the video: ${videoId}`);
    const transcription = await transcribeVideo(localFilePath, {
      responseFormat: 'verbose_json',
    });

    console.log(`Transcription completed for the video: ${videoId}`);
    
    // Cleanup temporary file if needed
    if (needsCleanup) {
      try {
        const fs = await import('fs');
        fs.unlinkSync(localFilePath);
        console.log(`Temporary file deleted: ${localFilePath}`);
      } catch (err) {
        console.warn(`Failed to delete temporary file: ${err}`);
      }
    }

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