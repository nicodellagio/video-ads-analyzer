/**
 * Configuration de l'environnement d'exécution
 */

// Détecter si l'application s'exécute sur Vercel
export const isVercel = process.env.VERCEL === '1';

// Détecter si l'application s'exécute en production
export const isProduction = process.env.NODE_ENV === 'production';

// Détecter si l'application s'exécute en développement
export const isDevelopment = process.env.NODE_ENV === 'development';

// Détecter si l'application s'exécute en mode serverless
export const isServerless = isVercel || process.env.SERVERLESS === '1';

// Chemin de base pour les uploads
export const UPLOAD_BASE_PATH = isServerless 
  ? '/tmp' 
  : process.cwd();

// URL de base de l'application
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; 