import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jsPDF } from 'jspdf';
// Corriger l'importation de jspdf-autotable
import autoTable from 'jspdf-autotable';
import { createGoogleDoc } from '@/lib/services/google-docs';

// Tentative d'initialisation explicite de jspdf-autotable
// (Uniquement si l'import standard ne fonctionne pas)
try {
  // @ts-ignore - Cette ligne pourrait être nécessaire dans certains environnements
  autoTable(jsPDF.API);
} catch (error) {
  console.warn("Initialisation explicite de jspdf-autotable a échoué, cela peut être normal:", error);
}

// Les types pour autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => any;
  }
}

// Pour convertir les caractères spéciaux en UTF-8
function decodeHtmlEntities(text: string) {
  try {
    const textArea = new TextDecoder('utf-8');
    return textArea.decode(new TextEncoder().encode(text));
  } catch {
    // Fallback pour les environnements où TextEncoder/Decoder ne sont pas disponibles
    return text;
  }
}

// Pour formater le texte pour le PDF
function formatText(text: string) {
  if (!text) return '';
  
  // Supprimer les balises HTML
  let formattedText = text.replace(/<[^>]*>/g, '');
  
  // Décoder les entités HTML
  formattedText = decodeHtmlEntities(formattedText);
  
  return formattedText;
}

// Fonction alternative pour générer un PDF sans utiliser autoTable
async function generatePdfWithoutAutoTable(transcription: any, analysis: any, videoMetadata: any) {
  try {
    console.log("Utilisation de la méthode de génération PDF alternative sans autoTable");
    
    // Créer un nouveau document PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Configurer les polices et les couleurs
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    
    // Titre du document (en anglais)
    doc.text('Video Ad Analysis Report', 105, 20, { align: 'center' });
    
    // Sous-titre (en anglais)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(80, 80, 80);
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    doc.text(`Generated on ${date}`, 105, 30, { align: 'center' });
    
    // Séparateur
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);
    
    // Section des données marketing Apify (au lieu des métadonnées vidéo)
    let yPos = 45;
    if (videoMetadata && videoMetadata.metadata && (videoMetadata.metadata.pageData || videoMetadata.metadata.adData)) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Marketing Data', 20, yPos);
      
      yPos += 10;
      
      // Extraction des données marketing pertinentes
      const marketingData = [];
      const pageData = videoMetadata.metadata.pageData || videoMetadata.metadata.adData || {};
      
      if (pageData.name || pageData.title) {
        marketingData.push({ key: 'Ad Title', value: pageData.name || pageData.title || 'N/A' });
      }
      
      if (pageData.pageName) {
        marketingData.push({ key: 'Page Name', value: pageData.pageName });
      }
      
      if (pageData.id || pageData.pageId) {
        marketingData.push({ key: 'Page/Ad ID', value: pageData.id || pageData.pageId });
      }
      
      if (pageData.followerCount) {
        marketingData.push({ key: 'Followers', value: pageData.followerCount.toLocaleString() });
      }
      
      if (pageData.likes) {
        marketingData.push({ key: 'Likes', value: pageData.likes.toLocaleString() });
      }
      
      if (pageData.category) {
        marketingData.push({ key: 'Category', value: pageData.category });
      }
      
      if (pageData.description || pageData.about) {
        const description = pageData.description || pageData.about;
        marketingData.push({ key: 'Description', value: description.length > 70 ? description.substring(0, 70) + '...' : description });
      }
      
      if (videoMetadata.source) {
        marketingData.push({ key: 'Source', value: videoMetadata.source.charAt(0).toUpperCase() + videoMetadata.source.slice(1) });
      }
      
      if (videoMetadata.originalUrl) {
        marketingData.push({ key: 'Original URL', value: videoMetadata.originalUrl });
      }
      
      if (pageData.location) {
        marketingData.push({ key: 'Location', value: pageData.location });
      }
      
      if (pageData.publishedAt || pageData.foundedDate) {
        const publishDate = pageData.publishedAt || pageData.foundedDate;
        marketingData.push({ key: 'Published', value: new Date(publishDate).toLocaleDateString('en-US') });
      }
      
      // Dessiner un tableau manuel
      if (marketingData.length > 0) {
        const colWidth = 85;
        const rowHeight = 10;
        const tableX = 20;
        let tableY = yPos;
        
        // En-tête
        doc.setFillColor(240, 240, 240);
        doc.rect(tableX, tableY, colWidth, rowHeight, 'F');
        doc.rect(tableX + colWidth, tableY, colWidth, rowHeight, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('Attribute', tableX + 5, tableY + 7);
        doc.text('Value', tableX + colWidth + 5, tableY + 7);
        
        // Lignes
        doc.setFont('helvetica', 'normal');
        for (let i = 0; i < marketingData.length; i++) {
          tableY += rowHeight;
          
          // Dessiner des bordures et remplir les cellules alternées
          if (i % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(tableX, tableY, colWidth, rowHeight, 'F');
            doc.rect(tableX + colWidth, tableY, colWidth, rowHeight, 'F');
          }
          
          // Bordures des cellules
          doc.setDrawColor(220, 220, 220);
          doc.rect(tableX, tableY, colWidth, rowHeight, 'S');
          doc.rect(tableX + colWidth, tableY, colWidth, rowHeight, 'S');
          
          // Texte
          doc.text(marketingData[i].key, tableX + 5, tableY + 7);
          
          // Valeur - gérer les valeurs longues
          const value = marketingData[i].value.toString();
          const maxWidth = colWidth - 10;
          if (doc.getTextWidth(value) > maxWidth) {
            const truncated = value.substring(0, 30) + '...';
            doc.text(truncated, tableX + colWidth + 5, tableY + 7);
          } else {
            doc.text(value, tableX + colWidth + 5, tableY + 7);
          }
        }
        
        // Mise à jour de la position Y après le tableau
        yPos = tableY + rowHeight + 10;
      }
    }
    
    // Section 1: Transcription (en anglais)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Transcription', 20, yPos);
    
    // Contenu de la transcription
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    
    // Extraire le texte de la transcription
    let transcriptionText = '';
    if (transcription.text) {
      transcriptionText = transcription.text;
    } else if ((transcription as any).transcription) {
      transcriptionText = (transcription as any).transcription;
    } else if ((transcription as any).text_en) {
      transcriptionText = (transcription as any).text_en;
    } else if ((transcription as any).text_fr) {
      // Utiliser la traduction en anglais si disponible
      if (transcription.translations && transcription.translations.en) {
        transcriptionText = transcription.translations.en;
      } else {
        transcriptionText = (transcription as any).text_fr;
      }
    }
    
    // Formater le texte pour le PDF
    transcriptionText = formatText(transcriptionText);
    
    // Ajouter le texte avec retour à la ligne automatique
    const splitTranscription = doc.splitTextToSize(transcriptionText, 170);
    yPos += 10;
    doc.text(splitTranscription, 20, yPos);
    
    // Calculer la position Y après la transcription
    yPos = yPos + (splitTranscription.length * 6);
    if (yPos > 280) {
      doc.addPage();
      yPos = 20;
    }
    
    // Section 2: Analyse (en anglais)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('AI Analysis', 20, yPos + 10);
    
    yPos += 20;
    
    // Sous-sections d'analyse
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
    
    // Ajouter chaque section d'analyse
    for (const section of sections) {
      // Vérifier si une nouvelle page est nécessaire
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      // Titre de la section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(40, 40, 40);
      doc.text(section.title, 20, yPos);
      
      yPos += 10;
      
      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      
      let descriptionText = formatText(section.data.description);
      let displayElements = [...(section.data.elements || [])];
      
      // Si la description est identique ou très similaire au premier élément, ne pas répéter l'élément
      if (displayElements.length > 0) {
        const firstElement = formatText(displayElements[0]);
        // Vérifier si la description contient le premier élément
        if (descriptionText.includes(firstElement) || 
            firstElement.includes(descriptionText) ||
            // Comparer les 20 premiers caractères pour une similarité approximative
            (firstElement.length > 20 && descriptionText.substring(0, 20) === firstElement.substring(0, 20))) {
          // Ne pas afficher le premier élément car il est déjà dans la description
          displayElements = displayElements.slice(1);
        }
      }
      
      const splitDescription = doc.splitTextToSize(descriptionText, 170);
      doc.text(splitDescription, 20, yPos);
      
      yPos += (splitDescription.length * 6) + 5;
      
      // Elements
      if (displayElements.length > 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        
        for (const element of displayElements) {
          // Vérifier si une nouvelle page est nécessaire
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          
          const formattedElement = "• " + formatText(element);
          const splitElement = doc.splitTextToSize(formattedElement, 165);
          doc.text(splitElement, 25, yPos);
          yPos += (splitElement.length * 5) + 2;
        }
      }
      
      yPos += 10;
    }
    
    // Pied de page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }
    
    // Générer le PDF
    return doc.output('datauristring');
  } catch (error) {
    console.error("Erreur dans la génération PDF alternative:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcription, analysis, format, videoMetadata } = body;
    
    if (!transcription || !analysis) {
      return NextResponse.json(
        { error: 'La transcription et l\'analyse sont requises pour l\'export' },
        { status: 400 }
      );
    }

    let exportUrl = '';
    const exportId = 'export_' + Math.random().toString(36).substring(2, 15);
    
    if (format === 'pdf') {
      try {
        // Utiliser la méthode alternative sans autoTable
        exportUrl = await generatePdfWithoutAutoTable(transcription, analysis, videoMetadata);
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        return NextResponse.json(
          { error: `Erreur lors de la génération du PDF: ${pdfError.message}` },
          { status: 500 }
        );
      }
    } else if (format === 'gdocs') {
      // Vérifier si l'utilisateur est authentifié avec Google
      const googleTokens = request.cookies.get('google_tokens');
      
      if (!googleTokens || !googleTokens.value) {
        // L'utilisateur n'est pas authentifié, renvoyer l'URL d'authentification
        const authResponse = await fetch(new URL('/api/auth/google', request.url).toString());
        const authData = await authResponse.json();
        
        return NextResponse.json({
          success: false,
          needsAuth: true,
          authUrl: authData.authUrl
        });
      }
      
      // L'utilisateur est authentifié, créer le document Google Docs
      const tokens = JSON.parse(googleTokens.value);
      const title = `Rapport d'analyse vidéo - ${new Date().toLocaleDateString()}`;
      const content = { transcription, analysis, videoMetadata };
      
      exportUrl = await createGoogleDoc(title, content, tokens);
    } else {
      return NextResponse.json(
        { error: 'Format d\'export non pris en charge' },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      exportUrl,
      exportId
    });
    
  } catch (error) {
    console.error('Export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue lors de l\'export du rapport';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 