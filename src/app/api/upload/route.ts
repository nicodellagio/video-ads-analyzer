import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  saveVideoFile, 
  extractVideoMetadata, 
  ensureUploadDir 
} from '@/lib/utils/video';

// Taille maximale de fichier (100MB or from environment variables)
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE 
  ? parseInt(process.env.MAX_FILE_SIZE) 
  : 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Ensure upload directory exists
    await ensureUploadDir();
    
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
    
    // Save file
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