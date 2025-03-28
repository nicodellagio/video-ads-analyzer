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
    try {
      const fs = await import('fs');
      const path_module = await import('path');
      
      // Récupérer le contenu du fichier
      const buffer = fs.readFileSync(path);
      console.log(`Fichier local lu: ${path}, taille=${buffer.length} octets`);
      
      // Extraire le nom du fichier à partir du chemin
      const fileName = path_module.basename(path);
      
      // Déterminer le type MIME en fonction de l'extension
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
      
      // En environnement Node.js, nous devons créer un Blob à partir du buffer
      // puis créer un File à partir du Blob pour la compatibilité avec l'API OpenAI
      console.log(`Préparation du fichier local avec le type MIME: ${mimeType}, nom: ${fileName}`);
      
      // L'API OpenAI en Node.js accepte également les ReadStream, essayons cette approche
      const readStream = fs.createReadStream(path);
      console.log('Création d\'un ReadStream pour le fichier local');
      
      return readStream as any;
    } catch (error) {
      console.error('Error reading local file:', error);
      throw new Error(`Error reading local file: ${(error as Error).message}`);
    }
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
    // Importer dynamiquement notre utilitaire OpenAI (pour éviter les problèmes en SSR)
    const { getOpenAIInstance } = await import('./openai');
    
    // Obtenir l'instance OpenAI
    const openai = getOpenAIInstance();
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
    console.log(`Options de transcription: model=${transcriptionOptions.model}, format=${transcriptionOptions.response_format}`);
    
    try {
      const response = await openai.audio.transcriptions.create(transcriptionOptions);
      console.log('Transcription terminée avec succès');
      
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
    } catch (apiError) {
      console.error('Erreur lors de l\'appel à l\'API OpenAI:', apiError);
      
      // Vérifier si l'erreur est liée à l'authentification
      const errorMessage = (apiError as Error).message || '';
      if (errorMessage.includes('auth') || errorMessage.includes('key') || errorMessage.includes('token')) {
        console.error('Problème d\'authentification avec l\'API OpenAI. Vérifiez votre clé API.');
      } else if (errorMessage.includes('format') || errorMessage.includes('file')) {
        console.error('Problème avec le format du fichier:', errorMessage);
        throw new Error(`Format de fichier non supporté: ${errorMessage}`);
      }
      
      throw apiError;
    }
  } catch (error) {
    console.error('Error during transcription:', error);
    throw new Error(`Error during transcription: ${(error as Error).message}`);
  }
} 