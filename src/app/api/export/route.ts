import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jsPDF } from 'jspdf';
// @ts-expect-error - importer jspdf-autotable sans erreurs TypeScript
import 'jspdf-autotable';
import { createGoogleDoc } from '@/lib/services/google-docs';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcription, analysis, format } = body;
    
    if (!transcription || !analysis) {
      return NextResponse.json(
        { error: 'Transcription and analysis required for export' },
        { status: 400 }
      );
    }

    let exportUrl = '';
    const exportId = 'export_' + Math.random().toString(36).substring(2, 15);
    
    if (format === 'pdf') {
      // Utiliser jsPDF pour générer un PDF réel
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Configurer les polices et les couleurs
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      
      // Titre du document
      doc.text('Rapport d\'analyse vidéo', 105, 20, { align: 'center' });
      
      // Sous-titre
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(80, 80, 80);
      const date = new Date().toLocaleDateString('fr-FR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      doc.text(`Généré le ${date}`, 105, 30, { align: 'center' });
      
      // Séparateur
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 35, 190, 35);
      
      // Section 1: Transcription
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Transcription', 20, 45);
      
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
      } else if ((transcription as any).text_fr) {
        transcriptionText = (transcription as any).text_fr;
      }
      
      // Formater le texte pour le PDF
      transcriptionText = formatText(transcriptionText);
      
      // Ajouter le texte avec retour à la ligne automatique
      const splitTranscription = doc.splitTextToSize(transcriptionText, 170);
      doc.text(splitTranscription, 20, 55);
      
      // Calculer la position Y après la transcription
      let yPos = 55 + (splitTranscription.length * 6);
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }
      
      // Section 2: Analyse
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Analyse IA', 20, yPos + 10);
      
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
        
        // Score
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 102, 204);
        doc.text(`Score: ${section.data.score}/10`, 150, yPos);
        
        yPos += 10;
        
        // Description
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
        const splitDescription = doc.splitTextToSize(formatText(section.data.description), 170);
        doc.text(splitDescription, 20, yPos);
        
        yPos += (splitDescription.length * 6) + 5;
        
        // Elements
        if (section.data.elements && section.data.elements.length > 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(10);
          
          for (const element of section.data.elements) {
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
      
      // Elements
      if (analysis.targetAudience && analysis.targetAudience.elements.length > 0) {
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        analysis.targetAudience.elements.forEach((element: string) => {
          doc.text('• ' + element.replace(/\*\*/g, ''), 20, yPos);
          yPos += 6;
        });
        yPos += 5;
      }
      
      // Pied de page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} sur ${pageCount}`, 105, 290, { align: 'center' });
      }
      
      // Générer le PDF
      const pdfBase64 = doc.output('datauristring');
      
      // Dans une application réelle, vous stockeriez ce PDF sur un serveur ou un service comme AWS S3
      // Pour cet exemple, nous retournons l'URL de données
      exportUrl = pdfBase64;
      
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
      const content = { transcription, analysis };
      
      exportUrl = await createGoogleDoc(title, content, tokens);
    } else {
      return NextResponse.json(
        { error: 'Export format not supported' },
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
    return NextResponse.json(
      { error: 'Error during report export' },
      { status: 500 }
    );
  }
} 