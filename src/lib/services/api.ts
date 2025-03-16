/**
 * Service for interacting with application APIs
 */

// Function for video transcription
export async function transcribeVideo(videoUrl: string, source: string) {
  try {
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoUrl, source }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error during transcription');
    }

    // Return transcription data directly
    return await response.json();
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}

// Function for text translation
export async function translateText(text: string, targetLanguage: string) {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, targetLanguage }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error during translation');
    }

    return await response.json();
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

// Function for content analysis
export async function analyzeContent(transcription: any, videoMetadata: any) {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcription, videoMetadata }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error during analysis');
    }

    // Return analysis data directly
    return await response.json();
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
}

// Function for report export
export async function exportReport(transcription: any, analysis: any, format: 'pdf' | 'gdocs', videoMetadata?: any) {
  try {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcription, analysis, format, videoMetadata }),
    });

    if (!response.ok) {
      // Essayer d'obtenir les détails de l'erreur du serveur
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur lors de l'export (${response.status}: ${response.statusText})`);
      } catch (jsonError) {
        // Si la réponse n'est pas du JSON valide, utiliser le statut HTTP
        throw new Error(`Erreur lors de l'export: le serveur a retourné ${response.status} ${response.statusText}`);
      }
    }

    // Vérifier que la réponse est du JSON valide
    try {
      return await response.json();
    } catch (jsonError) {
      throw new Error("La réponse du serveur n'est pas au format JSON valide");
    }
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

// Function for video extraction from URL
export async function extractVideoFromUrl(url: string, source: 'instagram' | 'meta' | 'youtube' | 'tiktok' | 'upload') {
  try {
    // Pour Instagram, ajouter un message spécial indiquant que l'extraction peut prendre du temps
    const isInstagram = source === 'instagram' || url.includes('instagram.com');
    if (isInstagram) {
      console.log('Extraction d\'une vidéo Instagram. Cela peut prendre un peu plus de temps...');
    }

    // Call extraction API with a longer timeout for Instagram
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), isInstagram ? 120000 : 60000); // 2 minutes pour Instagram, 1 minute pour les autres

    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, source }),
      signal: controller.signal
    });

    clearTimeout(timeoutId); // Nettoyer le timeout

    // Vérifier si la réponse est une erreur 429 (Too Many Requests) pour Instagram
    if (response.status === 429 && isInstagram) {
      const data = await response.json();
      console.error('Limitation d\'Instagram détectée:', data.error);
      throw new Error(data.error || 'Instagram limite actuellement l\'extraction de vidéos. Veuillez réessayer plus tard ou utiliser une URL différente.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `Erreur HTTP ${response.status}: ${response.statusText}` }));
      
      // Gestion spécifique des erreurs d'Instagram
      if (isInstagram) {
        const errorMessage = errorData.error || 'Error during video extraction';
        if (errorMessage.includes('JSON') || errorMessage.includes('timeout') || errorMessage.includes('Instagram')) {
          throw new Error(`Instagram a limité l'extraction de cette vidéo. Veuillez réessayer plus tard ou utiliser une autre URL. Détails: ${errorMessage}`);
        }
      }
      
      throw new Error(errorData.error || 'Error during video extraction');
    }

    const data = await response.json();
    
    // Si la réponse indique une annonce avec uniquement des images, renvoyer directement 
    // l'objet pour que le contexte de l'analyseur puisse le gérer proprement
    if (data.containsOnlyImages === true) {
      console.log('Annonce contenant uniquement des images détectée:', data.adInfo.title);
      return data;
    }
    
    // Si la réponse indique qu'aucun média n'a été trouvé, renvoyer l'objet pour gestion par l'analyseur
    if (data.noMediaFound === true) {
      console.log('Annonce sans média détectée:', data.adInfo.title);
      return data;
    }
    
    return data;
  } catch (error) {
    // Gestion spécifique des erreurs d'extraction Instagram
    if ((error.message && error.message.includes('Instagram')) || 
        (url && url.includes('instagram.com'))) {
      console.error('Erreur d\'extraction Instagram:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('L\'extraction de la vidéo Instagram a pris trop de temps. Instagram limite peut-être les extractions. Veuillez réessayer plus tard.');
      }
      
      throw new Error(`Impossible d'extraire cette vidéo Instagram: ${error.message}. Instagram protège ses contenus contre l'extraction automatisée.`);
    }
    
    console.error('Video extraction error:', error);
    throw error;
  }
}

// Function for uploading a video file
export async function uploadVideoFile(file: File) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error during video upload');
    }

    return await response.json();
  } catch (error) {
    console.error('Video upload error:', error);
    throw error;
  }
} 