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
      
      // Vérifier si l'erreur contient des détails supplémentaires
      if (errorData.details) {
        const error = new Error(errorData.error || 'Error during transcription');
        (error as any).details = errorData.details;
        (error as any).supported_formats = errorData.supported_formats;
        throw error;
      }
      
      throw new Error(errorData.error || 'Error during transcription');
    }

    // Return transcription data directly
    return await response.json();
  } catch (error) {
    console.error('Transcription error:', error);
    
    // Créer un message d'erreur plus convivial si c'est une erreur de format
    if ((error as Error).message.includes("format de la vidéo n'est pas pris en charge") || 
        (error as any).details) {
      const errorWithDetails = new Error(`Le format de la vidéo n'est pas compatible avec la transcription. Veuillez utiliser un format vidéo standard comme MP4 ou audio comme MP3.`);
      (errorWithDetails as any).isFormatError = true;
      (errorWithDetails as any).details = (error as any).details || 
        "OpenAI Whisper ne peut pas traiter ce format. Essayez de convertir votre vidéo avant de l'uploader.";
      throw errorWithDetails;
    }
    
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

    return await response.json();
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