export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_VERCEL = process.env.VERCEL === '1';

// Détermine si on doit utiliser le stockage local ou non
export const USE_LOCAL_STORAGE = !IS_PRODUCTION && !IS_VERCEL;

// URL de base pour les médias (à remplacer par une URL de CDN en production)
export const MEDIA_BASE_URL = IS_PRODUCTION 
  ? process.env.MEDIA_URL || 'https://storage.example.com'
  : ''; 