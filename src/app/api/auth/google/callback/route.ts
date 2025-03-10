import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTokens } from '@/lib/services/google-docs';

export async function GET(request: NextRequest) {
  try {
    // Récupérer le code d'autorisation de l'URL
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json(
        { error: 'Code d\'autorisation manquant' },
        { status: 400 }
      );
    }
    
    // Échanger le code contre des jetons
    const tokens = await getTokens(code);
    
    // Stocker les jetons dans un cookie sécurisé
    // Dans une application réelle, vous devriez utiliser un stockage plus sécurisé
    const response = NextResponse.redirect(new URL('/?auth_success=true', request.url));
    
    // Définir un cookie avec les jetons
    // Note: Dans une application de production, utilisez des cookies HttpOnly et Secure
    response.cookies.set('google_tokens', JSON.stringify(tokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 semaine
      path: '/'
    });
    
    return response;
  } catch (error) {
    console.error('Erreur lors de l\'échange du code d\'autorisation:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
} 