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
 * Récupère le contenu d'un fichier à partir d'un chemin ou d'une URL
 * Retourne un File ou un Buffer compatible avec l'API OpenAI
 */
async function createReadStreamFromPath(path: string): Promise<File | Buffer> {
  // Vérifier si nous sommes dans un environnement S3/Vercel
  if (USE_S3_STORAGE) {
    try {
      let fileUrl = path;
      
      // Si ce n'est pas une URL HTTPS, générer une URL signée pour S3
      if (!path.startsWith('https://')) {
        // Extraire l'ID de la vidéo
        const videoId = path.split('/').pop()?.split('.')[0] || path;
        // Générer une URL signée pour S3
        const s3Key = `videos/${videoId}.mp4`;
        fileUrl = await getPresignedUrl(s3Key);
      }
      
      console.log(`Téléchargement du fichier depuis ${fileUrl}`);
      
      // Télécharger le fichier depuis l'URL
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Erreur lors du téléchargement du fichier: ${response.status} ${response.statusText}`);
      }
      
      // Récupérer le type de contenu de la réponse
      const contentType = response.headers.get('content-type');
      console.log(`Type de contenu détecté: ${contentType}`);
      
      // Convertir la réponse en Blob
      const blob = await response.blob();
      console.log(`Fichier téléchargé: taille=${blob.size} octets, type=${blob.type}`);
      
      // Extraire le nom du fichier
      const fileName = path.split('/').pop()?.split('?')[0] || 'audio.mp4';
      
      // IMPORTANT: Forcer le type MIME à audio/mp4 pour garantir la compatibilité avec OpenAI
      // Les formats acceptés par OpenAI: 'flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'
      let mimeType = 'audio/mp4';
      
      if (fileName.toLowerCase().endsWith('.mp3')) {
        mimeType = 'audio/mpeg';
      } else if (fileName.toLowerCase().endsWith('.wav')) {
        mimeType = 'audio/wav'; 
      } else if (fileName.toLowerCase().endsWith('.ogg')) {
        mimeType = 'audio/ogg';
      } else if (fileName.toLowerCase().endsWith('.flac')) {
        mimeType = 'audio/flac';
      } else if (fileName.toLowerCase().endsWith('.m4a')) {
        mimeType = 'audio/m4a';
      } else if (fileName.toLowerCase().endsWith('.webm')) {
        mimeType = 'audio/webm';
      }
      
      console.log(`Création du fichier avec le type MIME forcé: ${mimeType}, nom: ${fileName}`);
      const file = new File([blob], fileName, { type: mimeType });
      
      return file;
    } catch (error) {
      console.error('Error creating file from S3:', error);
      throw new Error(`Error creating file from S3: ${(error as Error).message}`);
    }
  } else {
    // Environnement local - utiliser le système de fichiers
    // Nous devons retourner un Buffer pour l'API OpenAI
    const fs = await import('fs');
    const buffer = fs.readFileSync(path);
    return buffer;
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

    // Récupérer le fichier à envoyer à l'API
    const fileData = await createReadStreamFromPath(videoPath);
    
    // Préparer les options de transcription
    const transcriptionOptions: any = {
      file: fileData,
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