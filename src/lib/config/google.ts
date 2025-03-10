// Configuration pour l'API Google
export const GOOGLE_CONFIG = {
  // Ces valeurs devraient être stockées dans des variables d'environnement
  // dans un environnement de production
  CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID',
  CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
  REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3003/api/auth/google/callback',
  API_KEY: process.env.GOOGLE_API_KEY || 'YOUR_API_KEY',
  
  // Portées requises pour l'API Google Docs
  SCOPES: [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file'
  ]
}; 