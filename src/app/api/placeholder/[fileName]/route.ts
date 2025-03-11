import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint API qui retourne une réponse pour les vidéos qui ne sont pas disponibles
 * Utilisé quand un fichier n'a pas pu être téléchargé sur S3
 */
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { fileName: string } }
) {
  const { fileName } = params;
  
  // Renvoyer un message JSON indiquant que la vidéo n'est pas disponible
  return NextResponse.json({
    error: "Video not available",
    message: "The requested video could not be processed or is not available",
    fileName
  }, {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
  });
} 