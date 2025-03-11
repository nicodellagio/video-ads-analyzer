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
 * Vérifie si l'extension du fichier est compatible avec l'API Whisper d'OpenAI
 * @param filePath Chemin du fichier
 * @returns true si l'extension est compatible, false sinon
 */
function hasCompatibleExtension(filePath: string): boolean {
  const compatibleExtensions = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'];
  const extension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  return compatibleExtensions.includes(extension);
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

  try {
    // Initialiser le client OpenAI avec la clé API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log(`Transcription du fichier: ${videoPath}`);

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

/**
 * Crée un stream de lecture à partir d'un chemin de fichier
 * @param filePath Chemin du fichier
 * @returns Stream de lecture
 */
async function createReadStreamFromPath(filePath: string): Promise<any> {
  const fs = await import('fs');
  return fs.createReadStream(filePath);
} 