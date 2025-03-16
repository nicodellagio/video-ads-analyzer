import { NextRequest, NextResponse } from 'next/server';
import { validateUrl } from '@/lib/utils/extractor';
import type { VideoSource } from '@/lib/utils/extractor';
import { USE_S3_STORAGE } from '@/lib/utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { extractVideoFromUrl } from '@/lib/services/apify-extraction';
import { saveVideoFile } from '@/lib/utils/video';

export const maxDuration = 60; // Maximum 60 secondes pour compatibilité avec Vercel Hobby plan
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
    
    // Vérifier si le token API Apify est configuré
    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json({
        error: 'APIFY_API_TOKEN is not configured in environment variables'
      }, { status: 500 });
    }

    // Extract video using Apify service
    try {
      console.log(`Extraction de la vidéo depuis ${source} en utilisant Apify...`);
      
      // Ajuster la source si nécessaire pour Facebook Ad Library
      const isFacebookAdLibrary = url.includes('facebook.com') && url.includes('ads/library');
      const actualSource = isFacebookAdLibrary ? 'facebook' : source;
      
      // Pour Instagram, ajouter un traitement spécial vu les limitations fréquentes
      const isInstagram = source === 'instagram' || url.includes('instagram.com');
      if (isInstagram) {
        console.log(`Traitement spécial pour extraction Instagram: ${url}`);
      }
      
      // Utiliser le service Apify pour extraire la vidéo
      let extractedVideo;
      try {
        extractedVideo = await extractVideoFromUrl(url);
      } catch (extractionError) {
        console.error('Erreur lors de l\'extraction de la vidéo:', extractionError);
        
        // Gestion spéciale pour les erreurs Instagram
        if (isInstagram && (
          extractionError.message.includes('Instagram a bloqué') || 
          extractionError.message.includes('limite') ||
          extractionError.message.includes('timeout') ||
          extractionError.message.includes('not valid JSON')
        )) {
          return NextResponse.json({
            error: `Instagram limite actuellement l'extraction de vidéos. Veuillez réessayer plus tard ou utiliser une URL différente. Détails: ${extractionError.message}`,
            isInstagramLimitError: true
          }, { status: 429 }); // 429 Too Many Requests est approprié pour les limitations
        }
        
        throw extractionError; // Relancer pour la gestion générale des erreurs
      }
      
      // Vérifier si c'est une annonce avec uniquement des images
      const containsOnlyImages = extractedVideo.metadata?.containsOnlyImages === true;
      const noMediaFound = extractedVideo.metadata?.noMediaFound === true;
      
      if (noMediaFound) {
        console.log('Aucun média trouvé dans l\'annonce');
        
        // Construire une réponse spéciale pour les annonces sans média
        return NextResponse.json({ 
          success: true, 
          noMediaFound: true,
          adInfo: {
            title: extractedVideo.title || 'Annonce Facebook',
            description: extractedVideo.description || '',
            source: extractedVideo.source,
            originalUrl: extractedVideo.originalUrl,
            metadata: {
              ...extractedVideo.metadata,
              extractionMethod: 'apify',
              extractionTime: new Date().toISOString()
            }
          }
        });
      }
      
      if (containsOnlyImages) {
        console.log('Annonce contenant uniquement des images extraite avec succès');
        
        // Construire une réponse spéciale pour les annonces avec uniquement des images
        return NextResponse.json({ 
          success: true, 
          containsOnlyImages: true,
          adInfo: {
            title: extractedVideo.title || 'Annonce Facebook',
            description: extractedVideo.description || '',
            thumbnailUrl: extractedVideo.thumbnailUrl,
            images: extractedVideo.metadata?.images || [],
            source: extractedVideo.source,
            originalUrl: extractedVideo.originalUrl,
            metadata: {
              ...extractedVideo.metadata,
              extractionMethod: 'apify',
              extractionTime: new Date().toISOString()
            }
          }
        });
      }
      
      console.log('Vidéo extraite avec succès:', extractedVideo.videoUrl);
      
      // Vérifier si nous avons une URL vidéo valide
      if (!extractedVideo.videoUrl) {
        throw new Error('Aucune URL vidéo trouvée dans le contenu extrait');
      }
      
      // Télécharger la vidéo depuis l'URL extraite
      console.log('Téléchargement de la vidéo depuis:', extractedVideo.videoUrl);
      const videoResponse = await fetch(extractedVideo.videoUrl);
      
      if (!videoResponse.ok) {
        throw new Error(`Erreur lors du téléchargement de la vidéo: ${videoResponse.status} ${videoResponse.statusText}`);
      }
      
      // Convertir la réponse en blob
      const videoBlob = await videoResponse.blob();
      
      // Générer un identifiant unique et un nom de fichier
      const fileId = extractedVideo.metadata?.id || uuidv4();
      const fileExtension = 'mp4'; // Forcer l'extension mp4 pour la compatibilité
      const fileName = `${fileId}.${fileExtension}`;
      
      // Vérifier que nous avons bien un blob vidéo
      if (videoBlob.size === 0) {
        throw new Error('Le fichier vidéo téléchargé est vide');
      }
      
      // Convertir le blob en File
      const videoFile = new File([videoBlob], fileName, { 
        type: 'video/mp4' // Forcer le type MIME pour la compatibilité
      });
      
      // Sauvegarder le fichier (localement ou sur S3 selon l'environnement)
      console.log('Sauvegarde du fichier vidéo...');
      const { filePath, s3Key, url: fileUrl } = await saveVideoFile(videoFile, fileName);
      
      // Construire les métadonnées de la vidéo
      const videoMetadata = {
        id: fileId,
        url: fileUrl || `/uploads/${fileName}`,
        s3Key,
        format: 'mp4', // Format simple et cohérent
        size: `${(videoBlob.size / (1024 * 1024)).toFixed(1)} MB`,
        duration: extractedVideo.duration || '00:00:30', // Durée par défaut si non disponible
        originalName: extractedVideo.title || fileName,
        title: extractedVideo.title || `Video from ${actualSource}`,
        description: extractedVideo.description || '',
        thumbnailUrl: extractedVideo.thumbnailUrl,
        source: extractedVideo.source,
        originalUrl: extractedVideo.originalUrl,
        metadata: {
          ...extractedVideo.metadata,
          width: extractedVideo.metadata?.width || 'unknown',
          height: extractedVideo.metadata?.height || 'unknown',
          extractionMethod: 'apify',
          extractionTime: new Date().toISOString()
        }
      };
      
      console.log('Extraction complète:', videoMetadata);
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