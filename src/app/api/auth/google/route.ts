import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/services/google-docs';

export async function GET() {
  try {
    const authUrl = getAuthUrl();
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Erreur lors de la génération de l\'URL d\'authentification:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération de l\'URL d\'authentification' },
      { status: 500 }
    );
  }
} 