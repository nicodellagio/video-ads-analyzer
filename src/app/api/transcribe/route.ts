import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Force dynamic mode to avoid caching
export const maxDuration = 300; // 5 minutes maximum pour le plan hobby de Vercel

/**
 * Handles POST requests for video transcription
 */
export async function POST(request: NextRequest) {
  try {
    // Retrieve request data
    const data = await request.json();
    const { videoUrl, source } = data;

    console.log('Transcription requested for:', { videoUrl, source });

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      );
    }

    // En environnement de production, vous utiliseriez un service comme OpenAI Whisper
    // pour transcrire la vidéo. Pour simplifier, nous simulons une transcription.
    
    // Simuler un délai pour l'analyse
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Générer une transcription simulée
    const simulatedTranscription = {
      text: "Ceci est une transcription simulée pour la vidéo. Pour une application en production, vous devriez utiliser un service comme OpenAI Whisper pour générer une véritable transcription.",
      language: "fr",
      confidence: 0.9,
      words: [
        { text: "Ceci", start: 0.0, end: 0.5 },
        { text: "est", start: 0.5, end: 0.7 },
        { text: "une", start: 0.7, end: 0.9 },
        { text: "transcription", start: 0.9, end: 1.5 },
        { text: "simulée", start: 1.5, end: 2.0 },
        { text: "pour", start: 2.0, end: 2.2 },
        { text: "la", start: 2.2, end: 2.3 },
        { text: "vidéo", start: 2.3, end: 2.8 }
      ]
    };
    
    // Ajouter des données spécifiques en fonction de la source
    if (source === 'meta' || videoUrl.includes('facebook')) {
      simulatedTranscription.text += " Cette vidéo provient de Facebook. On y voit probablement une publicité ou une annonce avec des éléments visuels attrayants et un message marketing ciblé.";
    } else if (source === 'instagram' || videoUrl.includes('instagram')) {
      simulatedTranscription.text += " Cette vidéo provient d'Instagram. Elle est probablement courte, visuellement engageante et conçue pour captiver l'attention des utilisateurs qui défilent rapidement.";
    } else if (source === 'youtube' || videoUrl.includes('youtube')) {
      simulatedTranscription.text += " Cette vidéo provient de YouTube. Elle pourrait être plus longue et détaillée que sur d'autres plateformes, avec un contenu informatif ou divertissant.";
    } else if (source === 'tiktok' || videoUrl.includes('tiktok')) {
      simulatedTranscription.text += " Cette vidéo provient de TikTok. Elle est probablement très courte, rythmée et conçue pour un format vertical avec des effets ou de la musique.";
    }
    
    // Ajouter des informations supplémentaires simulées
    const additionalText = " La publicité met en avant un produit ou service, utilise des couleurs vives et des appels à l'action clairs. Le ton est persuasif et engageant, avec un message qui résonne auprès du public cible.";
    simulatedTranscription.text += additionalText;
    
    // Simuler plus de mots pour correspondre au texte complet
    for (let i = 0; i < 20; i++) {
      simulatedTranscription.words.push(
        { text: "mot" + i, start: 3.0 + i * 0.2, end: 3.0 + (i + 1) * 0.2 }
      );
    }

    return NextResponse.json({
      success: true,
      transcription: simulatedTranscription
    });
  } catch (error) {
    console.error('Error during transcription:', error);
    return NextResponse.json(
      { error: `Error during transcription: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 