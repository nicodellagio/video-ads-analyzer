/**
 * Utilitaires pour la transcription de vidéos avec OpenAI Whisper
 */

import { join } from 'path';
import { existsSync } from 'fs';
import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { USE_S3_STORAGE } from './constants';
import { getPresignedUrl } from '@/lib/services/s3';

// Types pour les résultats de transcription
export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  confidence?: number;
  words?: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

/**
 * Crée un ReadStream à partir d'un chemin de fichier
 * Gère les cas où le fichier est en local ou sur S3
 */
async function createReadStreamFromPath(path: string): Promise<any> {
  // Vérifier si nous sommes dans un environnement S3/Vercel
  if (USE_S3_STORAGE) {
    try {
      if (path.startsWith('https://')) {
        // Utiliser directement l'URL si elle est déjà au format HTTPS
        // Télécharger le fichier avec fetch pour le passer à l'API OpenAI
        const response = await fetch(path);
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());
        return new Readable({
          read() {
            this.push(buffer);
            this.push(null);
          }
        });
      } else {
        // Si c'est un ID de fichier, extraire l'ID pour obtenir une URL signée
        const videoId = path.split('/').pop()?.split('.')[0] || path;
        // Générer une URL signée pour S3
        const s3Key = `videos/${videoId}.mp4`;
        const signedUrl = await getPresignedUrl(s3Key);
        
        // Télécharger le fichier avec l'URL signée
        const response = await fetch(signedUrl);
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());
        return new Readable({
          read() {
            this.push(buffer);
            this.push(null);
          }
        });
      }
    } catch (error) {
      console.error('Error creating stream from S3:', error);
      throw new Error(`Error creating stream from S3: ${(error as Error).message}`);
    }
  } else {
    // Environnement local - utiliser le système de fichiers
    return createReadStream(path);
  }
}

/**
 * Transcrit une vidéo en utilisant l'API OpenAI Whisper
 * @param videoPath Chemin local vers le fichier vidéo ou URL S3
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

  // Vérifier que le fichier existe en local (uniquement si nous ne sommes pas en mode S3)
  if (!USE_S3_STORAGE && !existsSync(videoPath)) {
    throw new Error(`Le fichier vidéo n'existe pas: ${videoPath}`);
  }

  try {
    // Initialiser le client OpenAI avec la clé API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log(`Transcription de la vidéo: ${videoPath}`);

    // Préparer les options de transcription
    const transcriptionOptions: any = {
      file: await createReadStreamFromPath(videoPath),
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
  }
} 