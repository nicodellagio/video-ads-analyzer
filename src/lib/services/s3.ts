import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ReadableStream } from 'stream/web';

// Configuration S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const bucketName = process.env.AWS_S3_BUCKET_NAME || '';

/**
 * Convertit un objet File ou Buffer en ReadableStream compatible avec S3
 * @param file Fichier ou Buffer à convertir
 * @returns ReadableStream pour S3
 */
async function fileToStream(file: File | Buffer): Promise<ReadableStream> {
  if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return bufferToStream(buffer);
  } else {
    return bufferToStream(file);
  }
}

/**
 * Convertit un Buffer en ReadableStream
 * @param buffer Buffer à convertir
 * @returns ReadableStream
 */
function bufferToStream(buffer: Buffer): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(buffer);
      controller.close();
    }
  });
}

/**
 * Télécharge un fichier sur S3
 * @param file Fichier à télécharger (File ou Buffer)
 * @param key Clé du fichier sur S3 (chemin)
 * @param contentType Type MIME du fichier
 * @returns URL du fichier téléchargé
 */
export async function uploadToS3(
  file: File | Buffer,
  key: string,
  contentType = 'video/mp4'
): Promise<{ url: string; key: string }> {
  try {
    // Vérifier si les identifiants AWS sont définis
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !bucketName) {
      throw new Error('AWS credentials or bucket name not configured');
    }

    // Convertir le fichier en stream
    let body;
    let size;

    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      body = Buffer.from(arrayBuffer);
      size = file.size;
    } else {
      body = file;
      size = file.length;
    }

    // Télécharger le fichier sur S3
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType
    });

    await s3Client.send(command);

    // Générer une URL signée (valide pour 1 heure)
    const url = await getPresignedUrl(key);

    return { url, key };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error(`Error uploading to S3: ${(error as Error).message}`);
  }
}

/**
 * Génère une URL présignée pour accéder à un fichier
 * @param key Clé du fichier sur S3
 * @param expiresIn Durée de validité en secondes (par défaut 1 heure)
 * @returns URL présignée
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error(`Error generating presigned URL: ${(error as Error).message}`);
  }
}

/**
 * Supprime un fichier de S3
 * @param key Clé du fichier à supprimer
 */
export async function deleteFromS3(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw new Error(`Error deleting from S3: ${(error as Error).message}`);
  }
} 