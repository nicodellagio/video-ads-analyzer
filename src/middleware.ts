import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Ce middleware s'exécute avant chaque requête API
export function middleware(request: NextRequest) {
  // Définir un timeout pour les fonctions serverless
  const response = NextResponse.next();
  
  // Ajouter des en-têtes pour indiquer à Vercel de limiter la durée d'exécution
  response.headers.set('x-vercel-max-duration', '60');
  
  return response;
}

// Configurer le middleware pour s'exécuter uniquement sur les routes API
export const config = {
  matcher: '/api/:path*',
}; 