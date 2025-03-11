/**
 * Utilitaires pour la transcription de vidéos avec OpenAI Whisper
 */

import { join } from 'path';
import { existsSync } from 'fs';
import { OpenAI } from 'openai';
import { promises as fsPromises } from 'fs';

// Types pour les résultats de transcription
export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
  words: TranscriptionWord[];
}

/**
 * Extrait l'audio d'un fichier vidéo en utilisant FFmpeg
 * @param videoPath Chemin du fichier vidéo
 * @returns Chemin du fichier audio extrait
 */
async function extractAudioFromVideo(videoPath: string): Promise<string> {
  try {
    const path = await import('path');
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const fs = await import('fs');
    
    // Utiliser ffmpeg-static pour s'assurer qu'il est disponible
    const ffmpegStatic = await import('ffmpeg-static');
    const ffmpegPath = ffmpegStatic.default;
    
    console.log(`Using FFmpeg from: ${ffmpegPath}`);
    
    // Générer un chemin pour le fichier audio
    const dir = path.dirname(videoPath);
    const fileNameNoExt = path.basename(videoPath, path.extname(videoPath));
    const outputPath = path.join(dir, `${fileNameNoExt}_audio.mp3`);
    
    console.log(`Extracting audio from ${videoPath} to ${outputPath}`);
    
    // Commande pour extraire l'audio en format MP3
    const command = `"${ffmpegPath}" -i "${videoPath}" -vn -ar 44100 -ac 2 -b:a 192k "${outputPath}" -y`;
    console.log(`Executing: ${command}`);
    
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log('FFmpeg output:', stdout);
    if (stderr && !stderr.includes('time=')) console.error('FFmpeg stderr:', stderr);
    
    // Vérifier si le fichier a été créé
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      console.log(`Successfully extracted audio to ${outputPath}`);
      return outputPath;
    } else {
      throw new Error(`Failed to extract audio, output file not found or empty: ${outputPath}`);
    }
  } catch (error) {
    console.error('Error extracting audio:', error);
    throw new Error(`Failed to extract audio: ${(error as Error).message}`);
  }
}

/**
 * Transcrit une vidéo en utilisant l'API OpenAI Whisper
 * @param videoPath Chemin local vers le fichier vidéo
 * @param options Options de transcription
 * @returns Résultat de la transcription
 */
export async function transcribeVideo(
  videoPath: string,
  options: {
    language?: string;
    prompt?: string;
    responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  } = {}
): Promise<TranscriptionResult> {
  // Vérifier que nous sommes côté serveur
  if (typeof window !== 'undefined') {
    throw new Error('Cette fonction ne peut être exécutée que côté serveur');
  }

  // Vérifier que le fichier existe
  if (!existsSync(videoPath)) {
    throw new Error(`Le fichier vidéo n'existe pas: ${videoPath}`);
  }
  
  let audioPath = '';
  let cleanup = false;

  try {
    // Extraire l'audio du fichier vidéo (pour assurer la compatibilité avec Whisper)
    audioPath = await extractAudioFromVideo(videoPath);
    cleanup = true;
    
    // Initialiser le client OpenAI avec la clé API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log(`Transcription du fichier audio: ${audioPath}`);

    // Préparer les options de transcription
    const transcriptionOptions: any = {
      file: await createReadStreamFromPath(audioPath),
      model: 'whisper-1',
      response_format: options.responseFormat || 'verbose_json',
    };

    // Ajouter les options facultatives si elles sont définies
    if (options.language) {
      transcriptionOptions.language = options.language;
    }
    if (options.prompt) {
      transcriptionOptions.prompt = options.prompt;
    }

    // Appeler l'API OpenAI pour la transcription
    console.log('Envoi de la demande de transcription à OpenAI...');
    const response = await openai.audio.transcriptions.create(transcriptionOptions);
    console.log('Transcription terminée');

    // Traiter la réponse en fonction du format
    if (transcriptionOptions.response_format === 'verbose_json') {
      // Extraire les informations détaillées
      const result = response as any;
      return {
        text: result.text,
        language: result.language || 'auto',
        confidence: result.segments?.reduce((acc: number, segment: any) => acc + segment.confidence, 0) / 
                   (result.segments?.length || 1),
        words: result.segments?.flatMap((segment: any) => 
          segment.words?.map((word: any) => ({
            text: word.word,
            start: word.start,
            end: word.end
          })) || []
        ) || []
      };
    } else {
      // Format simple pour les autres formats de réponse
      return {
        text: typeof response === 'string' ? response : (response as any).text,
        language: 'auto', // Impossible de déterminer la langue pour les formats non-verbose_json, utiliser 'auto'
        confidence: 0.8, // Valeur par défaut
        words: []
      };
    }
  } catch (error) {
    console.error('Error during transcription:', error);
    throw new Error(`Error during transcription: ${(error as Error).message}`);
  } finally {
    // Nettoyer le fichier audio temporaire
    if (cleanup && audioPath) {
      try {
        await fsPromises.unlink(audioPath);
        console.log(`Deleted temporary audio file: ${audioPath}`);
      } catch (cleanupError) {
        console.warn(`Failed to delete temporary audio file: ${cleanupError}`);
      }
    }
  }
}

/**
 * Crée un stream de lecture à partir d'un chemin de fichier
 * @param filePath Chemin du fichier
 * @returns Stream de lecture
 */
async function createReadStreamFromPath(filePath: string): Promise<any> {
  const fs = await import('fs');
  return fs.createReadStream(filePath);
} 