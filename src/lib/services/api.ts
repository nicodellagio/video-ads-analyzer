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
export async function exportReport(transcription: any, analysis: any, format: 'pdf' | 'gdocs') {
  try {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcription, analysis, format }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error during export');
    }

    return await response.json();
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

// Function for video extraction from URL
export async function extractVideoFromUrl(url: string, source: 'instagram' | 'meta' | 'youtube' | 'tiktok' | 'upload') {
  try {
    // Call extraction API
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, source }),
    });

    if (!response.ok) {
      const errorData = await response.json();
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