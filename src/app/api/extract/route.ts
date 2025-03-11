import { NextRequest, NextResponse } from 'next/server';
import { validateUrl, extractFacebookVideo, extractInstagramVideo } from '@/lib/utils/extractor';
import type { VideoSource } from '@/lib/utils/extractor';
import { USE_LOCAL_STORAGE, USE_S3_STORAGE } from '@/lib/utils/constants';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60; // 1 minute maximum for processing (Vercel hobby plan limit)
export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching

export async function POST(request: NextRequest) {
  try {
    // Retrieve request data
    const data = await request.json();
    const { url, source } = data;

    console.log('Extraction requested for:', { url, source });

    // Verify required parameters are present
    if (!url || !source) {
      return NextResponse.json(
        { error: 'URL and source are required' },
        { status: 400 }
      );
    }

    // Validate URL based on source
    if (!validateUrl(url, source as VideoSource)) {
      return NextResponse.json(
        { error: `Invalid URL for source ${source}` },
        { status: 400 }
      );
    }

    // Vérifier si les identifiants AWS sont configurés en production
    if (USE_S3_STORAGE && (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME)) {
      return NextResponse.json({
        error: 'AWS S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME environment variables.'
      }, { status: 500 });
    }

    // Extract video based on source
    try {
      let videoMetadata;
      
      if (source === 'meta') {
        console.log('Attempting extraction for Facebook...');
        videoMetadata = await extractFacebookVideo(url);
      } else if (source === 'instagram') {
        console.log('Attempting extraction for Instagram...');
        videoMetadata = await extractInstagramVideo(url);
      } else {
        return NextResponse.json(
          { error: `Extraction for source ${source} is not yet implemented` },
          { status: 501 }
        );
      }
      
      console.log('Extraction successful:', videoMetadata);
      return NextResponse.json({ success: true, video: videoMetadata });
    } catch (error) {
      console.error('Extraction failed:', error);
      return NextResponse.json(
        { error: `Unable to extract video: ${(error as Error).message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: `Error processing request: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 