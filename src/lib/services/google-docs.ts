import { google } from 'googleapis';
import { GOOGLE_CONFIG } from '../config/google';

// Vérifier si les identifiants sont configurés
const areCredentialsConfigured = () => {
  console.log('CLIENT_ID:', GOOGLE_CONFIG.CLIENT_ID);
  console.log('CLIENT_SECRET:', GOOGLE_CONFIG.CLIENT_SECRET);
  
  const checks = {
    hasClientId: !!GOOGLE_CONFIG.CLIENT_ID,
    notDefaultClientId: GOOGLE_CONFIG.CLIENT_ID !== 'YOUR_CLIENT_ID',
    noPlaceholderInClientId: !GOOGLE_CONFIG.CLIENT_ID.includes('abcdefghijklmnopqrstuvwxyz'),
    hasClientSecret: !!GOOGLE_CONFIG.CLIENT_SECRET,
    notDefaultClientSecret: GOOGLE_CONFIG.CLIENT_SECRET !== 'YOUR_CLIENT_SECRET',
    startsWithGOCSPX: GOOGLE_CONFIG.CLIENT_SECRET.startsWith('GOCSPX-'),
    notPlaceholderSecret: GOOGLE_CONFIG.CLIENT_SECRET !== 'GOCSPX-abcdefghijklmnopqrstuvwxyz1234'
  };
  
  console.log('Validation checks:', checks);
  
  return (
    checks.hasClientId && 
    checks.notDefaultClientId &&
    checks.noPlaceholderInClientId &&
    checks.hasClientSecret && 
    checks.notDefaultClientSecret &&
    checks.startsWithGOCSPX &&
    checks.notPlaceholderSecret
  );
};

// Vérifier si la clé API est configurée
const isApiKeyConfigured = () => {
  return (
    GOOGLE_CONFIG.API_KEY && 
    GOOGLE_CONFIG.API_KEY !== 'YOUR_API_KEY' &&
    !GOOGLE_CONFIG.API_KEY.includes('abcdefghijklmnopqrstuvwxyz')
  );
};

// Créer un client OAuth2
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CONFIG.CLIENT_ID,
  GOOGLE_CONFIG.CLIENT_SECRET,
  GOOGLE_CONFIG.REDIRECT_URI
);

// Générer une URL d'authentification
export function getAuthUrl() {
  // Si les identifiants ne sont pas configurés, retourner une URL factice
  if (!areCredentialsConfigured()) {
    console.warn('Identifiants Google OAuth non configurés. Utilisation du mode simulation.');
    return '/api/auth/google/simulate';
  }
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_CONFIG.SCOPES,
    prompt: 'consent'
  });
}

// Échanger le code d'autorisation contre un jeton d'accès
export async function getTokens(code: string) {
  // Si les identifiants ne sont pas configurés, retourner des jetons factices
  if (!areCredentialsConfigured()) {
    console.warn('Identifiants Google OAuth non configurés. Utilisation de jetons simulés.');
    return {
      tokens: {
        access_token: 'simulated_access_token',
        refresh_token: 'simulated_refresh_token',
        expiry_date: Date.now() + 3600000
      }
    };
  }
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Erreur lors de l\'échange du code d\'autorisation:', error);
    throw new Error('Échec de l\'authentification Google. Veuillez réessayer.');
  }
}

// Configurer le client avec les jetons
export function setCredentials(tokens: any) {
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

// Créer un nouveau document Google Docs
export async function createGoogleDoc(
  title: string, 
  content: any, 
  tokens: any
) {
  try {
    // Si les identifiants ne sont pas configurés mais que la clé API est disponible
    if (!areCredentialsConfigured() && isApiKeyConfigured()) {
      console.warn('Utilisation de la clé API Google au lieu de OAuth.');
      return createGoogleDocWithApiKey(title, content);
    }
    
    // Si les identifiants ne sont pas configurés ou si on utilise des jetons simulés
    if (!areCredentialsConfigured() || tokens.access_token === 'simulated_access_token') {
      console.warn('Mode simulation activé. Génération d\'un document HTML au lieu de Google Docs.');
      return generateHtmlDocument(title, {
        transcription: content.transcription,
        analysis: content.analysis,
        videoMetadata: content.videoMetadata
      });
    }
    
    // Configurer le client avec les jetons
    setCredentials(tokens);
    
    // Créer une instance de l'API Docs
    const docs = google.docs({ version: 'v1', auth: oauth2Client });
    
    // Créer un nouveau document
    const document = await docs.documents.create({
      requestBody: {
        title: title
      }
    });
    
    const documentId = document.data.documentId;
    
    if (!documentId) {
      throw new Error('Impossible de créer le document Google Docs');
    }
    
    // Préparer le contenu pour l'insertion
    const requests = prepareContentRequests({
      transcription: content.transcription,
      analysis: content.analysis,
      videoMetadata: content.videoMetadata
    });
    
    // Insérer le contenu dans le document
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests
        }
      });
    }
    
    // Retourner l'URL du document
    return `https://docs.google.com/document/d/${documentId}/edit`;
  } catch (error) {
    console.error('Erreur lors de la création du document Google Docs:', error);
    // En cas d'erreur, générer un document HTML comme solution de secours
    return generateHtmlDocument(title, {
      transcription: content.transcription,
      analysis: content.analysis,
      videoMetadata: content.videoMetadata
    });
  }
}

// Créer un document Google Docs avec la clé API
async function createGoogleDocWithApiKey(title: string, content: any) {
  try {
    // Créer une instance de l'API Docs avec la clé API
    const docs = google.docs({
      version: 'v1',
      auth: GOOGLE_CONFIG.API_KEY
    });
    
    // Tenter de créer un document (cela échouera probablement car les clés API
    // ne peuvent généralement pas être utilisées pour créer des documents)
    const document = await docs.documents.create({
      requestBody: {
        title: title
      }
    });
    
    const documentId = document.data.documentId;
    
    if (!documentId) {
      throw new Error('Impossible de créer le document Google Docs avec la clé API');
    }
    
    // Préparer le contenu pour l'insertion
    const requests = prepareContentRequests({
      transcription: content.transcription,
      analysis: content.analysis,
      videoMetadata: content.videoMetadata
    });
    
    // Insérer le contenu dans le document
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests
        }
      });
    }
    
    // Retourner l'URL du document
    return `https://docs.google.com/document/d/${documentId}/edit`;
  } catch (error) {
    console.error('Erreur lors de la création du document avec la clé API:', error);
    // Les clés API ne peuvent généralement pas être utilisées pour créer des documents,
    // donc nous générons un document HTML comme solution de secours
    return generateHtmlDocument(title, {
      transcription: content.transcription,
      analysis: content.analysis,
      videoMetadata: content.videoMetadata
    });
  }
}

// Fonction pour générer le HTML des métadonnées
function generateMetadataHtml(metadata: any) {
  if (!metadata) return '';
  
  let html = `
  <div class="metadata-section">
    <h3>Métadonnées de la vidéo</h3>
    <table class="metadata-table">
      <tr>
        <th>Attribut</th>
        <th>Valeur</th>
      </tr>`;
  
  // Ajouter les métadonnées de base
  html += `
      <tr>
        <td>Durée</td>
        <td>${metadata.duration || 'Non disponible'}</td>
      </tr>
      <tr>
        <td>Format</td>
        <td>${metadata.format || 'Non disponible'}</td>
      </tr>
      <tr>
        <td>Taille</td>
        <td>${metadata.size || 'Non disponible'}</td>
      </tr>`;
  
  // Ajouter les métadonnées optionnelles
  if (metadata.originalName) {
    html += `
      <tr>
        <td>Titre original</td>
        <td>${metadata.originalName}</td>
      </tr>`;
  }
  
  if (metadata.width && metadata.height) {
    html += `
      <tr>
        <td>Résolution</td>
        <td>${metadata.width}x${metadata.height}</td>
      </tr>`;
  }
  
  if (metadata.codec) {
    html += `
      <tr>
        <td>Codec</td>
        <td>${metadata.codec}</td>
      </tr>`;
  }
  
  if (metadata.bitrate) {
    html += `
      <tr>
        <td>Bitrate</td>
        <td>${metadata.bitrate} kbps</td>
      </tr>`;
  }
  
  html += `
    </table>
  </div>`;
  
  return html;
}

// Fonction pour générer le HTML d'analyse
function generateAnalysisHtml(analysis: any) {
  let html = '';
  
  const sections = [
    { title: 'Narration and storytelling', data: analysis.storytelling },
    { title: 'Call-to-Action', data: analysis.callToAction },
    { title: 'Narrative structure', data: analysis.narrativeStructure }
  ];
  
  if (analysis.targetAudience) {
    sections.push({ title: 'Target audience', data: analysis.targetAudience });
  }
  
  if (analysis.emotionalTriggers) {
    sections.push({ title: 'Emotional triggers', data: analysis.emotionalTriggers });
  }
  
  for (const section of sections) {
    html += `
    <div class="section">
      <h3>${section.title}</h3>
      <p>${section.data.description}</p>
    `;
    
    // Vérifier si les éléments ne sont pas déjà inclus dans la description
    if (section.data.elements && section.data.elements.length > 0) {
      // Filtrer les éléments qui pourraient être des répétitions de la description
      const description = section.data.description.toLowerCase();
      const filteredElements = section.data.elements.filter(element => {
        const cleanElement = element.replace(/<[^>]*>/g, '').toLowerCase();
        // Ajouter l'élément uniquement s'il n'est pas déjà entièrement contenu dans la description
        return !description.includes(cleanElement) && 
               // Si l'élément est long, vérifier que le début n'est pas identique à la description
               !(cleanElement.length > 20 && description.substring(0, 20) === cleanElement.substring(0, 20));
      });
      
      if (filteredElements.length > 0) {
        html += '<ul>';
        for (const element of filteredElements) {
          // Nettoyer le texte
          const cleanElement = element.replace(/<[^>]*>/g, '');
          html += `<li>${cleanElement}</li>`;
        }
        html += '</ul>';
      }
    }
    
    html += '</div>';
  }
  
  return html;
}

// Fonction pour générer un document HTML comme solution de secours
function generateHtmlDocument(title: string, content: any) {
  // Créer un document HTML
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      text-align: center;
      color: #000;
      margin-bottom: 10px;
    }
    .date {
      text-align: center;
      color: #666;
      margin-bottom: 30px;
    }
    h2 {
      color: #000;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
      margin-top: 30px;
    }
    h3 {
      color: #333;
      margin-top: 20px;
    }
    ul {
      margin-top: 10px;
    }
    li {
      margin-bottom: 5px;
    }
    .section {
      margin-bottom: 30px;
    }
    .metadata-section {
      margin-bottom: 30px;
    }
    .metadata-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    .metadata-table th, .metadata-table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    .metadata-table th {
      background-color: #f2f2f2;
    }
    .metadata-table tr:nth-child(even) {
      background-color: #f9f9f9;
    }
  </style>
</head>
<body>
  <h1>Rapport d'analyse vidéo</h1>
  <div class="date">Généré le ${new Date().toLocaleDateString('fr-FR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}</div>
  
  ${content.videoMetadata ? `
  <h2>Métadonnées</h2>
  ${generateMetadataHtml(content.videoMetadata)}
  ` : ''}
  
  <h2>Transcription</h2>
  <div class="section">
    ${getTranscriptionText(content.transcription)}
  </div>
  
  <h2>Analyse IA</h2>
  ${generateAnalysisHtml(content.analysis)}
</body>
</html>
  `;
  
  // Créer un Blob et une URL de données
  const blob = new Blob([html], { type: 'text/html' });
  return URL.createObjectURL(blob);
}

// Fonction pour extraire le texte de transcription
function getTranscriptionText(transcription: any) {
  let text = '';
  if (transcription.text) {
    text = transcription.text;
  } else if (transcription.transcription) {
    text = transcription.transcription;
  } else if (transcription.text_fr) {
    text = transcription.text_fr;
  }
  
  // Nettoyer le texte
  text = text.replace(/<[^>]*>/g, '');
  
  // Formater avec des paragraphes
  return text.split('\n').map(paragraph => `<p>${paragraph}</p>`).join('');
}

// Fonction pour préparer les requêtes de contenu
function prepareContentRequests(content: any) {
  const requests: any[] = [];
  
  // Ajouter un titre
  requests.push({
    insertText: {
      location: {
        index: 1
      },
      text: 'Rapport d\'analyse vidéo\n\n'
    }
  });
  
  // Mettre en forme le titre
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: 1,
        endIndex: 22 // Longueur du titre + 1
      },
      paragraphStyle: {
        namedStyleType: 'HEADING_1',
        alignment: 'CENTER'
      },
      fields: 'namedStyleType,alignment'
    }
  });
  
  // Ajouter la date
  const date = new Date().toLocaleDateString('fr-FR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  requests.push({
    insertText: {
      location: {
        index: 23 // Après le titre et les sauts de ligne
      },
      text: `Généré le ${date}\n\n`
    }
  });
  
  // Mettre en forme la date
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: 23,
        endIndex: 23 + `Généré le ${date}\n\n`.length
      },
      paragraphStyle: {
        alignment: 'CENTER'
      },
      fields: 'alignment'
    }
  });
  
  // Index actuel pour l'insertion
  let currentIndex = 23 + `Généré le ${date}\n\n`.length;
  
  // Ajouter la section de métadonnées si disponible
  if (content.videoMetadata) {
    requests.push({
      insertText: {
        location: {
          index: currentIndex
        },
        text: 'Métadonnées de la vidéo\n\n'
      }
    });
    
    // Mettre en forme le titre de section
    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: currentIndex,
          endIndex: currentIndex + 'Métadonnées de la vidéo\n\n'.length
        },
        paragraphStyle: {
          namedStyleType: 'HEADING_2'
        },
        fields: 'namedStyleType'
      }
    });
    
    currentIndex += 'Métadonnées de la vidéo\n\n'.length;
    
    // Ajouter une table de métadonnées
    const metadataTable = [
      ['Attribut', 'Valeur'],
      ['Durée', content.videoMetadata.duration || 'Non disponible'],
      ['Format', content.videoMetadata.format || 'Non disponible'],
      ['Taille', content.videoMetadata.size || 'Non disponible']
    ];
    
    // Ajouter des attributs optionnels
    if (content.videoMetadata.originalName) {
      metadataTable.push(['Titre original', content.videoMetadata.originalName]);
    }
    
    if (content.videoMetadata.width && content.videoMetadata.height) {
      metadataTable.push(['Résolution', `${content.videoMetadata.width}x${content.videoMetadata.height}`]);
    }
    
    if (content.videoMetadata.codec) {
      metadataTable.push(['Codec', content.videoMetadata.codec]);
    }
    
    if (content.videoMetadata.bitrate) {
      metadataTable.push(['Bitrate', `${content.videoMetadata.bitrate} kbps`]);
    }
    
    // Créer une table
    requests.push({
      insertTable: {
        location: {
          index: currentIndex
        },
        rows: metadataTable.length,
        columns: 2
      }
    });
    
    // Estimer l'index après la table
    // Chaque cellule a un index de début et de fin, donc on multiplie par 2
    // Puis on ajoute un peu plus pour être sûr
    currentIndex += (metadataTable.length * 2 * 2) + 10;
    
    // Ajouter un peu d'espace après la table
    requests.push({
      insertText: {
        location: {
          index: currentIndex
        },
        text: '\n\n'
      }
    });
    
    currentIndex += 2;
  }
  
  // Ajouter la section de transcription
  requests.push({
    insertText: {
      location: {
        index: currentIndex
      },
      text: 'Transcription\n\n'
    }
  });
  
  // Mettre en forme le titre de section
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: currentIndex,
        endIndex: currentIndex + 'Transcription\n\n'.length
      },
      paragraphStyle: {
        namedStyleType: 'HEADING_2'
      },
      fields: 'namedStyleType'
    }
  });
  
  currentIndex += 'Transcription\n\n'.length;
  
  // Ajouter le texte de transcription
  let transcriptionText = '';
  if (content.transcription.text) {
    transcriptionText = content.transcription.text;
  } else if (content.transcription.transcription) {
    transcriptionText = content.transcription.transcription;
  } else if (content.transcription.text_fr) {
    transcriptionText = content.transcription.text_fr;
  }
  
  // Nettoyer le texte
  transcriptionText = transcriptionText.replace(/<[^>]*>/g, '');
  
  requests.push({
    insertText: {
      location: {
        index: currentIndex
      },
      text: transcriptionText + '\n\n'
    }
  });
  
  currentIndex += transcriptionText.length + 2;
  
  // Ajouter la section d'analyse
  requests.push({
    insertText: {
      location: {
        index: currentIndex
      },
      text: 'Analyse IA\n\n'
    }
  });
  
  // Mettre en forme le titre de section
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: currentIndex,
        endIndex: currentIndex + 'Analyse IA\n\n'.length
      },
      paragraphStyle: {
        namedStyleType: 'HEADING_2'
      },
      fields: 'namedStyleType'
    }
  });
  
  currentIndex += 'Analyse IA\n\n'.length;
  
  // Ajouter les sections d'analyse
  const sections = [
    { title: 'Narration and storytelling', data: content.analysis.storytelling },
    { title: 'Call-to-Action', data: content.analysis.callToAction },
    { title: 'Narrative structure', data: content.analysis.narrativeStructure }
  ];
  
  if (content.analysis.targetAudience) {
    sections.push({ title: 'Target audience', data: content.analysis.targetAudience });
  }
  
  if (content.analysis.emotionalTriggers) {
    sections.push({ title: 'Emotional triggers', data: content.analysis.emotionalTriggers });
  }
  
  // Ajouter chaque section d'analyse
  for (const section of sections) {
    // Titre de la section
    requests.push({
      insertText: {
        location: {
          index: currentIndex
        },
        text: section.title + '\n'
      }
    });
    
    // Mettre en forme le titre de sous-section
    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: currentIndex,
          endIndex: currentIndex + section.title.length + 1
        },
        paragraphStyle: {
          namedStyleType: 'HEADING_3'
        },
        fields: 'namedStyleType'
      }
    });
    
    currentIndex += section.title.length + 1;
    
    // Description
    const descriptionText = section.data.description + '\n\n';
    requests.push({
      insertText: {
        location: {
          index: currentIndex
        },
        text: descriptionText
      }
    });
    
    currentIndex += descriptionText.length;
    
    // Éléments - Filtrer pour éviter les répétitions avec la description
    if (section.data.elements && section.data.elements.length > 0) {
      // Filtrer les éléments qui pourraient être des répétitions de la description
      const description = section.data.description.toLowerCase();
      const filteredElements = section.data.elements.filter(element => {
        const cleanElement = element.replace(/<[^>]*>/g, '').toLowerCase();
        // Ajouter l'élément uniquement s'il n'est pas déjà entièrement contenu dans la description
        return !description.includes(cleanElement) && 
               // Si l'élément est long, vérifier que le début n'est pas identique à la description
               !(cleanElement.length > 20 && description.substring(0, 20) === cleanElement.substring(0, 20));
      });
      
      for (const element of filteredElements) {
        // Nettoyer le texte
        const cleanElement = element.replace(/<[^>]*>/g, '');
        const bulletPoint = `• ${cleanElement}\n`;
        
        requests.push({
          insertText: {
            location: {
              index: currentIndex
            },
            text: bulletPoint
          }
        });
        
        // Mettre en forme la puce
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: currentIndex,
              endIndex: currentIndex + bulletPoint.length
            },
            paragraphStyle: {
              indentStart: {
                magnitude: 20,
                unit: 'PT'
              }
            },
            fields: 'indentStart'
          }
        });
        
        currentIndex += bulletPoint.length;
      }
      
      // Ajouter un saut de ligne après les éléments seulement s'il y a des éléments filtrés
      if (filteredElements.length > 0) {
        requests.push({
          insertText: {
            location: {
              index: currentIndex
            },
            text: '\n'
          }
        });
        
        currentIndex += 1;
      }
    }
  }
  
  return requests;
} 