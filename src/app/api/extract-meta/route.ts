import { NextRequest, NextResponse } from 'next/server';
import { validateUrl } from '@/lib/utils/extractor';
import type { VideoSource } from '@/lib/utils/extractor';
import * as bizSdk from 'facebook-nodejs-business-sdk';
import { v4 as uuidv4 } from 'uuid';

// Importation correcte des classes depuis le SDK
const { Ad } = bizSdk;

export const maxDuration = 60; // 1 minute maximum for processing (Vercel hobby plan limit)
export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching

export async function POST(request: NextRequest) {
  try {
    // Retrieve request data
    const data = await request.json();
    const { url, source } = data;

    console.log('Meta extraction requested for:', { url, source });

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

    // Vérifier si les identifiants Meta API sont configurés
    if (!process.env.META_ACCESS_TOKEN || !process.env.META_APP_ID || !process.env.META_APP_SECRET) {
      return NextResponse.json({
        error: 'META API is not configured. Please set META_ACCESS_TOKEN, META_APP_ID, and META_APP_SECRET environment variables.'
      }, { status: 500 });
    }

    // Configurer l'API Meta
    bizSdk.FacebookAdsApi.init(process.env.META_ACCESS_TOKEN);

    // Extraction avec SDK Meta
    try {
      console.log(`Extraction depuis ${source} en utilisant Meta API...`);
      
      let adId = '';
      
      // Extraire l'ID de l'annonce depuis l'URL
      if (url.includes('ads/library')) {
        const urlParams = new URL(url).searchParams;
        adId = urlParams.get('id') || '';
        
        if (!adId) {
          throw new Error('ID d\'annonce non trouvé dans l\'URL');
        }
      } else {
        throw new Error('URL non supportée pour l\'extraction Meta');
      }
      
      console.log(`ID d'annonce trouvé: ${adId}`);
      
      // Récupérer les détails de l'annonce
      const ad = await Ad(adId).get([
        'id',
        'name',
        'creative',
        'adset_id',
        'campaign_id',
        'status',
        'created_time',
        'updated_time'
      ]);
      
      // Récupérer les créatifs
      const creative = await ad.creative.get([
        'id',
        'name',
        'title',
        'body',
        'image_url',
        'video_id',
        'thumbnail_url',
        'asset_feed_spec'
      ]);
      
      let videoUrl = '';
      let thumbnailUrl = '';
      
      if (creative.video_id) {
        // Récupérer l'URL de la vidéo
        const video = await bizSdk.Video(creative.video_id).get([
          'id',
          'source',
          'picture',
          'title',
          'description',
          'length'
        ]);
        
        videoUrl = video.source || '';
        thumbnailUrl = video.picture || creative.thumbnail_url || '';
      }
      
      if (!videoUrl) {
        throw new Error('Aucune vidéo trouvée dans cette annonce');
      }
      
      // Générer un identifiant unique
      const fileId = uuidv4();
      
      // Construction des métadonnées
      const videoMetadata = {
        id: fileId,
        url: videoUrl,
        thumbnailUrl: thumbnailUrl,
        title: creative.title || ad.name || 'Annonce Facebook',
        description: creative.body || '',
        duration: '00:00:30', // Durée par défaut
        originalName: `ad_${adId}.mp4`,
        source: 'facebook',
        originalUrl: url,
        metadata: {
          adId: ad.id,
          adName: ad.name,
          adsetId: ad.adset_id,
          campaignId: ad.campaign_id,
          status: ad.status,
          createdTime: ad.created_time,
          updatedTime: ad.updated_time,
          creativeId: creative.id,
          creativeName: creative.name
        }
      };
      
      console.log('Extraction Meta complète:', videoMetadata);
      return NextResponse.json({ success: true, video: videoMetadata });
    } catch (error) {
      console.error('Extraction Meta failed:', error);
      return NextResponse.json(
        { error: `Unable to extract from Meta: ${(error as Error).message}` },
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