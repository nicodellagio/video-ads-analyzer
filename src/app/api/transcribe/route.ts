import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { transcribeVideo } from '@/lib/utils/transcription';
import { getVideoPath } from '@/lib/utils/video';
import { USE_S3_STORAGE } from '@/lib/utils/constants';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import https from 'https';
import { UPLOAD_DIR } from '@/lib/utils/video';
import { extname } from 'path';

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
 * Convertit un fichier vidéo en format MP4 compatible avec OpenAI Whisper
 * @param inputPath Chemin du fichier source
 * @param outputPath Chemin du fichier de sortie
 * @returns true si la conversion a réussi, false sinon
 */
async function convertToCompatibleFormat(inputPath: string, outputPath: string): Promise<boolean> {
  try {
    console.log(`Converting file ${inputPath} to MP4 format at ${outputPath}`);
    
    // Méthode 1: Utiliser FFmpeg via ffmpeg-static
    try {
      // Importer ffmpeg-static
      const ffmpegStatic = await import('ffmpeg-static');
      const ffmpegPath = ffmpegStatic.default;
      
      console.log(`Using FFmpeg from: ${ffmpegPath}`);
      
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Commande FFmpeg pour convertir le fichier
      const command = `"${ffmpegPath}" -i "${inputPath}" -c:v libx264 -c:a aac "${outputPath}" -y`;
      console.log(`Executing: ${command}`);
      
      const { stdout, stderr } = await execAsync(command);
      console.log('FFmpeg conversion output:', stdout);
      if (stderr && !stderr.includes('time=')) console.error('FFmpeg stderr:', stderr);
      
      const fs = await import('fs');
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        console.log(`Successfully converted file to ${outputPath}`);
        return true;
      }
    } catch (ffmpegError) {
      console.error('FFmpeg conversion failed:', ffmpegError);
      console.log('Falling back to file copy method');
    }
    
    // Méthode 2: Si FFmpeg échoue, simplement copier le fichier et renommer
    const fs = await import('fs');
    fs.copyFileSync(inputPath, outputPath);
    console.log(`Copied file to ${outputPath}`);
    
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch (error) {
    console.error('Error converting file:', error);
    return false;
  }
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
    let tempFiles: string[] = []; // Pour suivre les fichiers temporaires à nettoyer
    let needsCleanup = false;
    
    // Si nous utilisons S3 et que l'URL est une URL S3, téléchargeons le fichier temporairement
    if (USE_S3_STORAGE && videoUrl.includes('s3.') && !existsSync(videoPath)) {
      // Extraire l'extension originale du fichier
      const originalExt = extname(videoUrl.split('?')[0]).toLowerCase() || '.mp4';
      const originalFilePath = join(UPLOAD_DIR, `${videoId}_original${originalExt}`);
      tempFiles.push(originalFilePath);
      
      // Destination finale avec extension mp4
      localFilePath = join(UPLOAD_DIR, `${videoId}_temp.mp4`);
      tempFiles.push(localFilePath);
      
      console.log(`Downloading S3 file to: ${originalFilePath}`);
      
      try {
        // Télécharger le fichier original
        await downloadFile(videoUrl, originalFilePath);
        needsCleanup = true;
        
        // Vérifier que le fichier a été téléchargé et n'est pas vide
        const fs = await import('fs');
        const stats = fs.statSync(originalFilePath);
        
        if (stats.size === 0) {
          return NextResponse.json(
            { error: 'Downloaded file is empty (0 bytes)' },
            { status: 400 }
          );
        }
        
        // Vérifier le type MIME du fichier téléchargé
        const fileBuffer = fs.readFileSync(originalFilePath);
        const fileType = await getFileType(fileBuffer);
        
        console.log(`File type detected: ${fileType?.mime || 'unknown'}`);
        
        // Si ce n'est pas un format directement compatible avec Whisper, le convertir
        const whisperCompatibleMimes = [
          'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm',
          'audio/mpeg', 'audio/mp4', 'audio/mp3', 'audio/ogg', 
          'audio/wav', 'audio/webm', 'audio/flac', 'audio/m4a'
        ];
        
        if (fileType && !whisperCompatibleMimes.includes(fileType.mime)) {
          console.log(`Converting ${fileType.mime} to MP4 format`);
          const conversionSuccess = await convertToCompatibleFormat(originalFilePath, localFilePath);
          
          if (!conversionSuccess) {
            console.warn(`Conversion failed, using original file: ${originalFilePath}`);
            localFilePath = originalFilePath;
          } else {
            console.log(`File successfully converted to MP4`);
          }
        } else {
          // Si c'est déjà un format compatible, utiliser directement le fichier original
          console.log(`File already in compatible format, using as is`);
          localFilePath = originalFilePath;
        }
        
      } catch (error) {
        console.error(`Failed to download or process file from S3: ${error}`);
        return NextResponse.json(
          { error: `Failed to download or process video file: ${(error as Error).message}` },
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
    console.log(`Transcription of the video: ${videoId} (file: ${localFilePath})`);
    const transcription = await transcribeVideo(localFilePath, {
      responseFormat: 'verbose_json',
    });

    console.log(`Transcription completed for the video: ${videoId}`);
    
    // Cleanup temporary files if needed
    if (needsCleanup) {
      try {
        const fs = await import('fs');
        // Nettoyer tous les fichiers temporaires
        for (const tempFile of tempFiles) {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
            console.log(`Temporary file deleted: ${tempFile}`);
          }
        }
      } catch (err) {
        console.warn(`Failed to delete some temporary files: ${err}`);
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

/**
 * Vérifie le type MIME d'un fichier en lisant son en-tête
 */
async function getFileType(buffer: Buffer): Promise<{ mime: string; ext: string } | null> {
  try {
    // Import dynamique de file-type
    const fileType = await import('file-type');
    // Analyse le type de fichier à partir du buffer
    return await fileType.fileTypeFromBuffer(buffer) || null;
  } catch (error) {
    console.error('Error detecting file type:', error);
    return null;
  }
}

/**
 * Vérifie si le type MIME est un format média valide pour la transcription
 */
function isValidMediaType(mimeType: string): boolean {
  // Formats directement compatibles avec OpenAI Whisper
  const whisperCompatibleMimeTypes = [
    'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'audio/mp3', 'audio/ogg', 
    'audio/wav', 'audio/webm', 'audio/flac', 'audio/m4a'
  ];
  
  // Formats vidéo additionnels que nous accepterons même s'ils ne sont pas directement compatibles
  const additionalSupportedMimeTypes = [
    'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/3gpp',
    'video/x-ms-wmv', 'video/x-flv', 'video/avi'
  ];
  
  // Nous acceptons tous les formats vidéo/audio, même ceux qui ne sont pas directement compatibles
  // OpenAI va potentiellement les rejeter, mais nous laissons l'API faire ce choix
  return whisperCompatibleMimeTypes.includes(mimeType) || 
         additionalSupportedMimeTypes.includes(mimeType) ||
         mimeType.startsWith('video/') || 
         mimeType.startsWith('audio/');
} 