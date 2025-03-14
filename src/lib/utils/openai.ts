/**
 * Utilitaires pour interagir avec l'API OpenAI
 */

import OpenAI from 'openai';

// Singleton pour l'instance OpenAI
let openaiInstance: OpenAI | null = null;

/**
 * Initialise et retourne une instance de l'API OpenAI
 * avec gestion des erreurs et vérification de la clé API
 */
export function getOpenAIInstance(): OpenAI {
  if (openaiInstance) {
    return openaiInstance;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('La clé API OpenAI (OPENAI_API_KEY) n\'est pas définie dans les variables d\'environnement');
  }

  // Vérifier le format de la clé API
  if (apiKey.startsWith('sk-proj-')) {
    console.warn('Attention: Vous utilisez une clé API OpenAI au format projet (sk-proj-). Ce format peut ne pas être compatible avec toutes les fonctionnalités. Utilisez une clé au format standard (sk-) si possible.');
  } else if (!apiKey.startsWith('sk-')) {
    console.warn('Attention: Votre clé API OpenAI ne commence pas par "sk-". Vérifiez qu\'il s\'agit d\'une clé valide.');
  }

  try {
    openaiInstance = new OpenAI({
      apiKey: apiKey,
      // Vous pouvez ajouter d'autres options ici, comme un timeout
      dangerouslyAllowBrowser: false, // Empêcher l'utilisation côté client
    });
    
    return openaiInstance;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de l\'API OpenAI:', error);
    throw new Error(`Erreur lors de l'initialisation de l'API OpenAI: ${(error as Error).message}`);
  }
}

/**
 * Vérifie que la clé API est valide en effectuant un appel simple
 * @returns Promise<boolean> - true si la clé est valide, false sinon
 */
export async function verifyOpenAIKey(): Promise<boolean> {
  try {
    const openai = getOpenAIInstance();
    
    // Tenter un appel simple pour vérifier l'authenticité de la clé
    const models = await openai.models.list();
    
    // Si nous arrivons ici, la clé est valide
    console.log('Clé API OpenAI valide, modèles disponibles:', models.data.length);
    return true;
  } catch (error) {
    console.error('La clé API OpenAI semble invalide:', error);
    return false;
  }
} 