import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  saveVideoFile, 
  extractVideoMetadata, 
  ensureUploadDir 
} from '@/lib/utils/video';
import { USE_LOCAL_STORAGE, USE_S3_STORAGE } from '@/lib/utils/constants';

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
    
    // Vérifier si les identifiants AWS sont configurés en production
    if (USE_S3_STORAGE && (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME)) {
      return NextResponse.json({
        error: 'AWS S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME environment variables.'
      }, { status: 500 });
    }
    
    // Save file (via S3 en production, disque local en dev)
    const { filePath, s3Key, url } = await saveVideoFile(file, fileName);
    
    // URL publique (S3 ou locale)
    const fileUrl = url || `/uploads/${fileName}`;
    
    // Extract video metadata
    const videoMetadata = await extractVideoMetadata(filePath, {
      size: file.size,
      name: file.name,
      id: fileId,
      url: fileUrl,
      s3Key
    });

    return NextResponse.json({ 
      success: true, 
      videoMetadata 
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: `Error during video upload: ${(error as Error).message}` },
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