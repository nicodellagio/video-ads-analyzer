import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { saveVideoFile, extractVideoMetadata, ensureUploadDir } from '@/lib/utils/video';
import { USE_S3_STORAGE } from '@/lib/utils/constants';
import { getPresignedUrl } from '@/lib/services/s3';
import fs from 'fs';
import { join } from 'path';

// Taille maximale de fichier (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Endpoint de débogage pour tester le processus complet de téléchargement
 */
export async function POST(request: NextRequest) {
  const logs = [] as string[];
  const addLog = (message: string) => {
    console.log(message);
    logs.push(`${new Date().toISOString()} - ${message}`);
  };

  try {
    addLog("Début du processus de débogage du téléchargement");

    // Vérifier les variables d'environnement
    addLog(`Environnement: ${USE_S3_STORAGE ? 'S3/Vercel' : 'Local'}`);
    if (USE_S3_STORAGE) {
      const hasAwsAccessKey = !!process.env.AWS_ACCESS_KEY_ID;
      const hasAwsSecretKey = !!process.env.AWS_SECRET_ACCESS_KEY;
      const hasAwsBucket = !!process.env.AWS_S3_BUCKET_NAME;
      
      addLog(`Configuration AWS: AccessKey=${hasAwsAccessKey}, SecretKey=${hasAwsSecretKey}, Bucket=${hasAwsBucket}`);
      
      if (!hasAwsAccessKey || !hasAwsSecretKey || !hasAwsBucket) {
        addLog("ERREUR: Configuration AWS incomplète");
        return NextResponse.json({
          success: false,
          error: 'AWS S3 non configuré correctement',
          logs
        }, { status: 500 });
      }
    }

    // Récupérer le fichier vidéo depuis la requête
    addLog("Récupération des données du formulaire");
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      addLog("ERREUR: Aucun fichier fourni");
      return NextResponse.json({
        success: false,
        error: 'Aucun fichier fourni',
        logs
      }, { status: 400 });
    }

    // Vérifier le type de fichier
    addLog(`Type de fichier détecté: ${file.type}`);
    if (!file.type.startsWith('video/')) {
      addLog(`ERREUR: Type de fichier non valide: ${file.type}`);
      return NextResponse.json({
        success: false,
        error: 'Le fichier doit être une vidéo',
        logs
      }, { status: 400 });
    }

    // Vérifier la taille du fichier
    addLog(`Taille du fichier: ${file.size} octets`);
    if (file.size > MAX_FILE_SIZE) {
      addLog("ERREUR: Fichier trop volumineux");
      return NextResponse.json({
        success: false,
        error: 'La taille du fichier ne doit pas dépasser 100 Mo',
        logs
      }, { status: 400 });
    }
    
    // Générer un nom de fichier unique
    const fileId = uuidv4();
    const fileExtension = file.name.split('.').pop() || 'mp4';
    const fileName = `${fileId}.${fileExtension}`;
    addLog(`Nom de fichier généré: ${fileName}`);
    
    // Enregistrer le fichier
    addLog("Début de l'enregistrement du fichier");
    
    try {
      // Sauvegarder le fichier
      const { filePath, s3Key, url } = await saveVideoFile(file, fileName);
      addLog(`Fichier enregistré: ${filePath}`);
      if (s3Key) addLog(`Clé S3: ${s3Key}`);
      if (url) addLog(`URL: ${url}`);
      
      // URL publique
      const fileUrl = url || `/uploads/${fileName}`;
      addLog(`URL publique: ${fileUrl}`);
      
      // Vérifier l'accès au fichier téléchargé
      addLog("Vérification de l'accès au fichier téléchargé");
      
      if (USE_S3_STORAGE && url) {
        try {
          // Tester l'accès à l'URL S3
          addLog(`Test d'accès à l'URL S3: ${url}`);
          const response = await fetch(url);
          
          if (!response.ok) {
            addLog(`ERREUR: Impossible d'accéder au fichier S3: ${response.status} ${response.statusText}`);
          } else {
            const contentType = response.headers.get('content-type');
            const contentLength = response.headers.get('content-length');
            addLog(`Fichier S3 accessible: Type=${contentType}, Taille=${contentLength} octets`);
            
            // Lire une partie du fichier pour confirmer l'accès
            const buffer = await response.arrayBuffer();
            addLog(`Fichier lu avec succès: ${buffer.byteLength} octets`);
          }
        } catch (error) {
          addLog(`ERREUR lors du test d'accès S3: ${(error as Error).message}`);
        }
      } else if (!USE_S3_STORAGE) {
        // Vérifier l'existence du fichier local
        const localPath = join(process.cwd(), 'public', 'uploads', fileName);
        const fileExists = fs.existsSync(localPath);
        addLog(`Fichier local accessible: ${fileExists}, Chemin: ${localPath}`);
      }
      
      // Extraire les métadonnées vidéo
      addLog("Extraction des métadonnées vidéo");
      const videoMetadata = await extractVideoMetadata(filePath, {
        size: file.size,
        name: file.name,
        id: fileId,
        url: fileUrl,
        s3Key
      });
      
      addLog(`Métadonnées: ${JSON.stringify(videoMetadata)}`);
      
      // Simuler une requête de transcription
      // Note: nous ne faisons pas réellement la transcription ici
      addLog("Simulation d'une requête de transcription");
      
      if (USE_S3_STORAGE && s3Key) {
        try {
          const signedUrl = await getPresignedUrl(s3Key);
          addLog(`URL signée générée pour la transcription: ${signedUrl}`);
        } catch (error) {
          addLog(`ERREUR lors de la génération de l'URL signée: ${(error as Error).message}`);
        }
      }
      
      // Réponse finale
      addLog("Processus de débogage terminé avec succès");
      
      return NextResponse.json({
        success: true,
        videoMetadata,
        logs,
        environment: {
          useS3Storage: USE_S3_STORAGE,
          hasAwsAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
          hasAwsSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
          hasAwsBucket: !!process.env.AWS_S3_BUCKET_NAME,
          nodeEnv: process.env.NODE_ENV,
          isVercel: process.env.VERCEL === '1'
        }
      });
      
    } catch (uploadError) {
      addLog(`ERREUR lors de l'enregistrement du fichier: ${(uploadError as Error).message}`);
      return NextResponse.json({
        success: false,
        error: `Erreur lors de l'enregistrement du fichier: ${(uploadError as Error).message}`,
        logs
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Erreur générale:', error);
    logs.push(`ERREUR générale: ${(error as Error).message}`);
    
    return NextResponse.json({
      success: false,
      error: `Erreur lors du téléchargement: ${(error as Error).message}`,
      logs
    }, { status: 500 });
  }
} 