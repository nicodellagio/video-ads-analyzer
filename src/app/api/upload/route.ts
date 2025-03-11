import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  saveVideoFile, 
  extractVideoMetadata, 
  ensureUploadDir 
} from '@/lib/utils/video';
import { USE_LOCAL_STORAGE } from '@/lib/utils/constants';

// Taille maximale de fichier (100MB or from environment variables)
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE 
  ? parseInt(process.env.MAX_FILE_SIZE) 
  : 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.type.startsWith('video/')) {
      return NextResponse.json(
        { error: 'File must be a video' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must not exceed 100MB' },
        { status: 400 }
      );
    }
    
    // Generate a unique file name
    const fileId = uuidv4();
    const fileExtension = file.name.split('.').pop() || 'mp4';
    const fileName = `${fileId}.${fileExtension}`;
    
    // En production sur Vercel, on ne peut pas utiliser le stockage local
    if (!USE_LOCAL_STORAGE) {
      // Envoyer une réponse temporaire avec des métadonnées simulées
      // TODO: Implémenter l'intégration avec un service de stockage externe (S3, Cloudinary, etc.)
      return NextResponse.json({
        success: true,
        videoMetadata: {
          duration: '00:00:30',
          format: '1280x720',
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          url: `/api/media/${fileId}`, // URL fictive, à remplacer par l'URL réelle du service de stockage
          originalName: file.name,
          id: fileId,
          width: 1280,
          height: 720,
          codec: 'h264',
          bitrate: 0
        },
        message: "NOTE: Cette application fonctionne actuellement en mode démo. Pour activer l'upload de fichiers en production, veuillez configurer un service de stockage externe."
      });
    }
    
    // Save file (uniquement en développement local)
    const filePath = await saveVideoFile(file, fileName);
    
    // Public file URL
    const fileUrl = `/uploads/${fileName}`;
    
    // Extract video metadata
    const videoMetadata = await extractVideoMetadata(filePath, {
      size: file.size,
      name: file.name,
      id: fileId,
      url: fileUrl
    });

    return NextResponse.json({ 
      success: true, 
      videoMetadata 
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Error during video upload' },
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