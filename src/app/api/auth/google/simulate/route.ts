import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Simuler un délai d'authentification
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Rediriger vers la page d'accueil avec un paramètre de succès
    const response = NextResponse.redirect(new URL('/?auth_success=true', request.url));
    
    // Définir un cookie avec des jetons simulés
    const simulatedTokens = {
      access_token: 'simulated_access_token',
      refresh_token: 'simulated_refresh_token',
      expiry_date: Date.now() + 3600000
    };
    
    response.cookies.set('google_tokens', JSON.stringify(simulatedTokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 semaine
      path: '/'
    });
    
    return response;
  } catch (error) {
    console.error('Erreur lors de la simulation d\'authentification:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
} 