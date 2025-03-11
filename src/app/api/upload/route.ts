import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  saveVideoFile, 
  extractVideoMetadata, 
  ensureUploadDir 
} from '@/lib/utils/video';
import { USE_LOCAL_STORAGE, USE_S3_STORAGE } from '@/lib/utils/constants';
import path from 'path';

// Taille maximale de fichier (100MB or from environment variables)
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE 
  ? parseInt(process.env.MAX_FILE_SIZE) 
  : 100 * 1024 * 1024;

/**
 * Normalise l'extension d'un fichier pour la rendre compatible avec OpenAI Whisper
 * @param fileName Nom du fichier original
 * @returns Nom du fichier avec extension normalisée
 */
function normalizeFileName(fileName: string): string {
  // Extraire le nom et l'extension du fichier
  let extension = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, extension);
  
  // Si l'extension est en majuscules ou contient des caractères non standards, la normaliser
  // Whisper accepte: 'flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'
  const whisperCompatibleExtensions = ['.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'];
  
  // Normaliser des extensions communes vers leurs équivalents compatibles
  const extensionMap: Record<string, string> = {
    '.mpg': '.mpeg',
    '.mov': '.mp4',
    '.avi': '.mp4',
    '.mkv': '.mp4',
    '.3gp': '.mp4',
    '.m4v': '.mp4',
    '.wmv': '.mp4'
  };
  
  // Si l'extension est mappée, utiliser l'extension compatible
  if (extensionMap[extension]) {
    extension = extensionMap[extension];
  } 
  // Sinon, si l'extension n'est pas dans la liste compatible, utiliser .mp4 par défaut
  else if (!whisperCompatibleExtensions.includes(extension)) {
    extension = '.mp4';
  }
  
  return `${baseName}${extension}`;
}

export async function POST(request: NextRequest) {
  try {
    // Vérifier que nous sommes côté serveur
    if (typeof window !== 'undefined') {
      return NextResponse.json(
        { error: 'Cette fonction ne peut être exécutée que côté serveur' },
        { status: 500 }
      );
    }
    
    // Récupérer le formulaire de données (multipart/form-data)
    const formData = await request.formData();
    
    // Récupérer le fichier vidéo du formulaire
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Vérifier la taille maximale du fichier (100MB par défaut)
    const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '104857600', 10); // 100MB en octets
    
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { error: `File size exceeds the maximum allowed size (${Math.floor(maxFileSize / 1024 / 1024)}MB)` },
        { status: 400 }
      );
    }
    
    // En mode production, vérifier que S3 est configuré
    if (USE_S3_STORAGE && (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME)) {
      return NextResponse.json({
        error: 'AWS S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME environment variables.'
      }, { status: 500 });
    }
    
    // Générer un nom de fichier unique (UUID)
    const originalFileName = file.name || 'video.mp4';
    const uniqueId = uuidv4();
    const normalizedFileName = normalizeFileName(originalFileName);
    
    // Extraire l'extension et s'assurer qu'elle est valide
    let fileExt = '';
    if (normalizedFileName.lastIndexOf('.') !== -1) {
      fileExt = normalizedFileName.substring(normalizedFileName.lastIndexOf('.'));
    } else {
      fileExt = '.mp4'; // Extension par défaut
    }
    
    const fileName = `${uniqueId}${fileExt}`;
    
    // Save file (via S3 en production, disque local en dev)
    const { filePath, s3Key, url } = await saveVideoFile(file, fileName);
    
    // Extract basic metadata (without ffprobe)
    const videoMetadata = await extractVideoMetadata(filePath, {
      size: file.size,
      name: originalFileName,
      id: uniqueId,
      url: USE_S3_STORAGE ? url : `/uploads/${fileName}`,
      s3Key
    });
    
    return NextResponse.json({
      success: true,
      videoMetadata
    });
    
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: `Error uploading file: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// Configuration to accept larger files
export const config = {
  api: {
    bodyParser: false,
  },
}; 