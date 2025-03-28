import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { OpenAI } from 'openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcription, videoMetadata } = body;
    
    if (!transcription) {
      return NextResponse.json(
        { error: 'Transcription non fournie' },
        { status: 400 }
      );
    }

    // Initialiser le client OpenAI avec la clé API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('Analyse de la transcription avec GPT-4o...');

    // Système de message pour l'analyse marketing
    const systemMessage = `As a professional marketing analyst, perform a structured and detailed analysis of video ad transcriptions.

Analyze the transcription of each video ad considering various marketing aspects such as target audience, message clarity, call to action, tone, and effectiveness.

# Steps

1. **Review Transcription**: Carefully read through the transcription of the video ad to understand the message being conveyed.
2. **Identify Target Audience**: Determine who the ad is targeting based on the language, tone, and content.
3. **Message Clarity**: Evaluate how clearly the ad conveys its message to the audience. Consider if the main points are easily understood.
4. **Call to Action**: Analyze the call(s) to action in the ad. Are they prominent and compelling? Do they motivate the audience to take the desired action?
5. **Tone and Style**: Assess the tone and style of the ad. Is it appropriate for the intended audience and message?
6. **Effectiveness Evaluation**: Judge the overall effectiveness of the ad in achieving its marketing goals. Is the ad likely to engage and convert the audience?

# Output Format

Provide your analysis in a structured format. Use bullet points or numbered lists under the following headings:
- Target Audience
- Message Clarity
- Call to Action
- Tone and Style
- Effectiveness Evaluation

Each section should include a brief but detailed description and conclude with your evaluation.

# Examples

- **Target Audience**: 
  - The ad uses informal language and pop culture references, indicating it targets young adults aged 18-25.
  
- **Message Clarity**: 
  - The main product benefits are clearly stated, making the message easy to grasp.

- **Call to Action**: 
  - The ad ends with a clear and visible call to action, encouraging viewers to "Visit our website for exclusive offers."

- **Tone and Style**: 
  - The casual and humorous tone matches the youthful target audience, enhancing engagement.

- **Effectiveness Evaluation**: 
  - Overall, the ad effectively captures attention and motivates the target audience to learn more about the product.

# Notes
Always follow the strcutre and format of the examples.
Consider including any insights on visual elements mentioned in the transcription as they may impact the overall analysis.`;

    // Créer le prompt pour l'analyse
    const userMessage = `Voici la transcription d'une publicité vidéo à analyser:

${transcription.text}

Métadonnées de la vidéo:
Durée: ${videoMetadata?.duration || 'Non disponible'}
Format: ${videoMetadata?.format || 'Non disponible'}
Titre original: ${videoMetadata?.originalName || 'Non disponible'}

Veuillez fournir une analyse marketing détaillée de cette publicité.`;

    // Appeler l'API OpenAI pour l'analyse
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    // Analyser la réponse pour extraire les sections
    const rawAnalysis = response.choices[0].message.content || '';
    
    console.log("Réponse brute de GPT-4o:", rawAnalysis);
    
    // Approche directe pour extraire les sections spécifiques
    // Nous recherchons des patterns exacts basés sur le format de la réponse observée
    
    // Extraire Target Audience (lignes commençant par '**Target Audience**:' jusqu'à la prochaine section)
    const targetAudienceRegex = /\*\*Target Audience\*\*:[\s\S]*?(?=\*\*Message Clarity|$)/i;
    const targetAudienceMatch = rawAnalysis.match(targetAudienceRegex);
    const targetAudienceSection = targetAudienceMatch ? targetAudienceMatch[0].trim() : '';
    
    // Extraire Message Clarity (lignes commençant par '**Message Clarity**:' jusqu'à la prochaine section)
    const messageClarityRegex = /\*\*Message Clarity\*\*:[\s\S]*?(?=\*\*Call to Action|$)/i;
    const messageClarityMatch = rawAnalysis.match(messageClarityRegex);
    const messageClaritySection = messageClarityMatch ? messageClarityMatch[0].trim() : '';
    
    // Extraire Call to Action (lignes commençant par '**Call to Action**:' jusqu'à la prochaine section)
    const callToActionRegex = /\*\*Call to Action\*\*:[\s\S]*?(?=\*\*Tone and Style|$)/i;
    const callToActionMatch = rawAnalysis.match(callToActionRegex);
    const callToActionSection = callToActionMatch ? callToActionMatch[0].trim() : '';
    
    // Extraire Tone and Style (lignes commençant par '**Tone and Style**:' jusqu'à la prochaine section)
    const toneAndStyleRegex = /\*\*Tone and Style\*\*:[\s\S]*?(?=\*\*Effectiveness Evaluation|$)/i;
    const toneAndStyleMatch = rawAnalysis.match(toneAndStyleRegex);
    const toneAndStyleSection = toneAndStyleMatch ? toneAndStyleMatch[0].trim() : '';
    
    // Extraire Effectiveness Evaluation (lignes commençant par '**Effectiveness Evaluation**:' jusqu'à la fin)
    const effectivenessRegex = /\*\*Effectiveness Evaluation\*\*:[\s\S]*?$/i;
    const effectivenessMatch = rawAnalysis.match(effectivenessRegex);
    const effectivenessSection = effectivenessMatch ? effectivenessMatch[0].trim() : '';
    
    console.log("Sections extraites:", {
      targetAudience: targetAudienceSection ? "OK" : "Non trouvé",
      messageClarity: messageClaritySection ? "OK" : "Non trouvé",
      callToAction: callToActionSection ? "OK" : "Non trouvé",
      toneAndStyle: toneAndStyleSection ? "OK" : "Non trouvé",
      effectiveness: effectivenessSection ? "OK" : "Non trouvé"
    });
    
    // Extraire les éléments (puces) de chaque section
    const targetAudienceElements = extractBulletPoints(targetAudienceSection);
    const messageClarityElements = extractBulletPoints(messageClaritySection);
    const callToActionElements = extractBulletPoints(callToActionSection);
    const toneAndStyleElements = extractBulletPoints(toneAndStyleSection);
    const effectivenessElements = extractBulletPoints(effectivenessSection);
    
    // Calculer les scores pour chaque section
    const targetAudienceScore = calculateScore(targetAudienceSection);
    const messageClarityScore = calculateScore(messageClaritySection);
    const callToActionScore = calculateScore(callToActionSection);
    const toneAndStyleScore = calculateScore(toneAndStyleSection);
    const effectivenessScore = calculateScore(effectivenessSection);
    
    // Extraire les principales descriptions de chaque section (en supprimant les puces)
    const extractMainText = (section: string): string => {
      if (!section) return '';
      
      // Supprimer le titre de la section
      let text = section.replace(/^\*\*[^*]+\*\*:\s*/m, '');
      
      // Extraire le texte avant les puces
      const mainContent = text.split(/\n\s*-/)[0].trim();
      return mainContent;
    };
    
    // Construire l'objet de résultat d'analyse avec des descriptions précises
    const analysisResult = {
      rawAnalysis,
      targetAudience: {
        score: targetAudienceScore,
        description: extractMainText(targetAudienceSection),
        elements: targetAudienceElements
      },
      narrativeStructure: {
        score: messageClarityScore,
        description: extractMainText(messageClaritySection),
        elements: messageClarityElements
      },
      callToAction: {
        score: callToActionScore,
        description: extractMainText(callToActionSection),
        elements: callToActionElements
      },
      storytelling: {
        score: toneAndStyleScore,
        description: extractMainText(toneAndStyleSection),
        elements: toneAndStyleElements
      },
      emotionalTriggers: {
        score: effectivenessScore,
        description: extractMainText(effectivenessSection),
        elements: effectivenessElements
      }
    };
    
    console.log('Analyse terminée');
    
    return NextResponse.json({ success: true, analysis: analysisResult });
  } catch (error) {
    console.error('Error during analysis:', error);
    return NextResponse.json(
      { error: `Error during analysis: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// Fonction pour extraire une section spécifique du texte d'analyse
function extractSection(text: string, sectionName: string): string {
  // Vérifier d'abord le format avec ### (format GPT-4o récent)
  const hashRegex = new RegExp(`### ${sectionName}[\\s\\S]*?(?=### |$)`, 'i');
  const hashMatch = text.match(hashRegex);
  
  if (hashMatch && hashMatch[0].trim()) {
    return hashMatch[0].trim();
  }
  
  // Essayer plusieurs approches pour extraire la section
  const approaches = [
    // Approche 1: Recherche avec le nom de section suivi de deux points
    new RegExp(`${sectionName}\\s*:\\s*((?:.|\\n)*?)(?:\\n\\s*\\n\\s*[A-Z][A-Za-z\\s]+:|$)`, 'i'),
    // Approche 2: Recherche avec le nom de section sans deux points
    new RegExp(`${sectionName}\\s*((?:.|\\n)*?)(?:\\n\\s*\\n\\s*[A-Z][A-Za-z\\s]+(?::|\\n)|$)`, 'i'),
    // Approche 3: Recherche avec le nom de section en gras
    new RegExp(`\\*\\*${sectionName}\\*\\*\\s*((?:.|\\n)*?)(?:\\n\\s*\\n\\s*\\*\\*[A-Z][A-Za-z\\s]+\\*\\*|$)`, 'i'),
    // Approche 4: Recherche avec le nom de section en gras suivi de deux points
    new RegExp(`\\*\\*${sectionName}\\*\\*:\\s*((?:.|\\n)*?)(?:\\n\\s*\\n\\s*\\*\\*[A-Z][A-Za-z\\s]+\\*\\*:|$)`, 'i'),
    // Approche 5: Recherche avec tiret suivi du nom de section
    new RegExp(`- ${sectionName}:\\s*((?:.|\\n)*?)(?:\\n\\s*\\n\\s*-\\s*[A-Z][A-Za-z\\s]+:|$)`, 'i')
  ];

  for (const regex of approaches) {
    const match = text.match(regex);
    if (match && match[1] && match[1].trim()) {
      return `${sectionName}: ${match[1].trim()}`;
    }
  }

  console.log(`Section "${sectionName}" non trouvée avec les approches standard`);
  
  // Approche de secours: rechercher simplement le texte après le nom de la section
  const fallbackRegex = new RegExp(`${sectionName}[^\\n]*\\n((?:.|\\n)*?)(?:\\n[A-Z][A-Za-z\\s]+:|$)`, 'i');
  const fallbackMatch = text.match(fallbackRegex);
  
  if (fallbackMatch && fallbackMatch[1] && fallbackMatch[1].trim()) {
    return `${sectionName}: ${fallbackMatch[1].trim()}`;
  }
  
  // Dernière tentative: extraire tout le texte entre ce titre de section et le suivant
  const lastResortRegex = new RegExp(`(?:^|\\n)\\s*(?:-\\s*)?(?:\\*\\*)?${sectionName}(?:\\*\\*)?:?\\s*([\\s\\S]*?)(?:(?:^|\\n)\\s*(?:-\\s*)?(?:\\*\\*)?(?:${['Target Audience', 'Message Clarity', 'Call to Action', 'Tone and Style', 'Effectiveness Evaluation'].filter(s => s !== sectionName).join('|')})(?:\\*\\*)?:?|$)`, 'i');
  const lastResortMatch = text.match(lastResortRegex);
  
  if (lastResortMatch && lastResortMatch[1] && lastResortMatch[1].trim()) {
    return `${sectionName}: ${lastResortMatch[1].trim()}`;
  }
  
  return '';
}

// Fonction pour extraire les puces d'une section
function extractBulletPoints(sectionText: string): string[] {
  if (!sectionText) return [];
  
  // Supprimer le titre de la section
  const textWithoutTitle = sectionText.replace(/^\*\*[^*]+\*\*:\s*/m, '');
  
  // Extraire les lignes commençant par un tiret
  const bulletRegex = /(?:^|\n)\s*-\s*([^\n]+)/g;
  const bullets: string[] = [];
  
  let match;
  while ((match = bulletRegex.exec(textWithoutTitle)) !== null) {
    if (match[1] && match[1].trim()) {
      bullets.push(match[1].trim());
    }
  }
  
  return bullets;
}

function formatSectionForDisplay(text: string): string {
  if (!text) return '';
  
  // Step 1: Remove bullets and dashes at the beginning of lines
  let formatted = text.replace(/^[-•*]\s*/gm, '');
  
  // Step 2: Make important keywords bold
  formatted = formatted.replace(/\b(important|key|critical|essential|significant|crucial|vital|major)\b/gi, '<strong>$1</strong>');
  
  // Step 3: Make keywords followed by colons bold
  formatted = formatted.replace(/\b(\w+):/g, '<strong>$1</strong>:');
  
  // Step 4: Ensure appropriate line breaks between paragraphs
  formatted = formatted.replace(/\n{2,}/g, '\n\n');
  
  return formatted.trim();
}

// Fonction pour calculer un score basé sur le contenu de la section
function calculateScore(sectionText: string): number {
  if (!sectionText) return 0;
  
  // Rechercher des mots-clés positifs et négatifs avec leur poids
  const positiveKeywords = [
    { term: 'excellent', weight: 1.5 },
    { term: 'efficace', weight: 1.2 },
    { term: 'clair', weight: 1.0 },
    { term: 'fort', weight: 1.0 },
    { term: 'puissant', weight: 1.2 },
    { term: 'convaincant', weight: 1.3 },
    { term: 'persuasif', weight: 1.3 },
    { term: 'engageant', weight: 1.1 },
    { term: 'mémorable', weight: 1.2 },
    { term: 'impactant', weight: 1.3 },
    { term: 'réussi', weight: 1.2 },
    { term: 'bien', weight: 0.8 },
    { term: 'effective', weight: 1.2 },
    { term: 'clear', weight: 1.0 },
    { term: 'strong', weight: 1.0 },
    { term: 'powerful', weight: 1.2 },
    { term: 'compelling', weight: 1.3 },
    { term: 'persuasive', weight: 1.3 },
    { term: 'engaging', weight: 1.1 },
    { term: 'memorable', weight: 1.2 },
    { term: 'impactful', weight: 1.3 },
    { term: 'successful', weight: 1.2 },
    { term: 'good', weight: 0.8 },
    { term: 'great', weight: 1.0 },
    { term: 'parfait', weight: 1.5 },
    { term: 'optimal', weight: 1.3 },
    { term: 'cohérent', weight: 1.1 },
    { term: 'pertinent', weight: 1.1 },
    { term: 'bien ciblé', weight: 1.2 },
    { term: 'précis', weight: 1.1 },
    { term: 'direct', weight: 1.0 }
  ];
  
  const negativeKeywords = [
    { term: 'faible', weight: 1.3 },
    { term: 'confus', weight: 1.2 },
    { term: 'vague', weight: 1.1 },
    { term: 'inefficace', weight: 1.3 },
    { term: 'peu clair', weight: 1.2 },
    { term: 'manque', weight: 1.0 },
    { term: 'pourrait être amélioré', weight: 0.8 },
    { term: 'limité', weight: 1.0 },
    { term: 'weak', weight: 1.3 },
    { term: 'confusing', weight: 1.2 },
    { term: 'ineffective', weight: 1.3 },
    { term: 'unclear', weight: 1.2 },
    { term: 'lacks', weight: 1.0 },
    { term: 'could be improved', weight: 0.8 },
    { term: 'limited', weight: 1.0 },
    { term: 'insuffisant', weight: 1.2 },
    { term: 'ambigu', weight: 1.1 },
    { term: 'mal défini', weight: 1.2 },
    { term: 'mal ciblé', weight: 1.2 },
    { term: 'générique', weight: 0.9 },
    { term: 'incomplet', weight: 1.1 }
  ];

  // Détecter les phrases négatives qui renversent le sens (négation)
  const negationPhrases = [
    'n\'est pas', 'ne sont pas', 'n\'a pas', 'n\'ont pas',
    'is not', 'are not', 'does not', 'do not', 'doesn\'t', 'don\'t',
    'lacks', 'missing', 'absence of', 'without', 'manque de', 'sans'
  ];
  
  // Compter les occurrences avec poids et contexte
  let positiveScore = 0;
  let negativeScore = 0;
  
  // Fonction pour vérifier si un mot est dans un contexte de négation
  const isInNegationContext = (text: string, position: number): boolean => {
    // Vérifier les 6 mots avant le mot-clé pour des négations
    const beforeContext = text.substring(Math.max(0, position - 50), position).toLowerCase();
    return negationPhrases.some(phrase => beforeContext.includes(phrase));
  };
  
  for (const keyword of positiveKeywords) {
    const regex = new RegExp(`\\b${keyword.term}\\b`, 'gi');
    let match;
    
    while ((match = regex.exec(sectionText)) !== null) {
      // Vérifier si le mot est dans un contexte négatif
      if (isInNegationContext(sectionText, match.index)) {
        negativeScore += keyword.weight; // Inverser le sens si négation
      } else {
        positiveScore += keyword.weight;
      }
    }
  }
  
  for (const keyword of negativeKeywords) {
    const regex = new RegExp(`\\b${keyword.term}\\b`, 'gi');
    let match;
    
    while ((match = regex.exec(sectionText)) !== null) {
      // Vérifier si le mot est dans un contexte négatif
      if (isInNegationContext(sectionText, match.index)) {
        positiveScore += keyword.weight * 0.8; // Inverser le sens si négation, avec réduction
      } else {
        negativeScore += keyword.weight;
      }
    }
  }
  
  // Longueur du texte pour normalisation
  const textLength = sectionText.split(/\s+/).length;
  const contentFactor = Math.min(1, Math.max(0.5, textLength / 100)); // Plus de contenu = plus fiable
  
  // Calculer le score (base 0.5 avec échelle mobile pour plus de granularité)
  let baseScore = 0.5; // Point milieu de l'échelle 0-1
  
  // Calculer le score net et l'ajuster avec le facteur de contenu
  const netScore = positiveScore - negativeScore;
  const adjustedNetScore = netScore * contentFactor;
  
  // Transformer le score net en score sur une échelle de 0 à 1
  if (adjustedNetScore > 0) {
    // Formule pour scores positifs: 0.5 + (netScore * facteur_échelle)
    // avec un plafond à 1.0
    baseScore = Math.min(1.0, 0.5 + (adjustedNetScore * 0.05));
  } else if (adjustedNetScore < 0) {
    // Formule pour scores négatifs: 0.5 - (netScore * facteur_échelle)
    // avec un plancher à 0.0
    baseScore = Math.max(0.0, 0.5 + (adjustedNetScore * 0.05));
  }
  
  // Arrondir à deux décimales pour plus de précision
  return Math.round(baseScore * 100) / 100;
} 