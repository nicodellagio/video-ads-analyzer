'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { 
  transcribeVideo, 
  analyzeContent, 
  exportReport, 
  extractVideoFromUrl,
  uploadVideoFile,
  translateText
} from '@/lib/services/api';

// Types
type VideoSource = 'instagram' | 'meta' | 'youtube' | 'tiktok' | 'upload';
type ExportFormat = 'pdf' | 'gdocs';
export type LanguageCode = 'fr' | 'en' | 'es' | 'de' | 'it' | 'zh';

interface VideoMetadata {
  duration: string;
  format: string;
  size: string;
  url: string;
  originalName?: string;
  id?: string;
}

interface Transcription {
  text: string;
  language: string;
  confidence: number;
  words?: Array<{ text: string; start: number; end: number }>;
  translations?: Record<LanguageCode, string>;
}

interface AnalysisResult {
  rawAnalysis?: string;
  storytelling: {
    score: number;
    description: string;
    elements: string[];
  };
  callToAction: {
    score: number;
    description: string;
    elements: string[];
  };
  narrativeStructure: {
    score: number;
    description: string;
    elements: string[];
  };
  targetAudience?: {
    score: number;
    description: string;
    elements: string[];
  };
  emotionalTriggers?: {
    score: number;
    description: string;
    elements: string[];
  };
}

export interface AnalyzerContextType {
  videoUrl: string | null;
  videoSource: VideoSource;
  uploadedFile: File | null;
  isProcessing: boolean;
  isAnalyzed: boolean;
  progress: number;
  videoMetadata: VideoMetadata | null;
  transcription: Transcription | null;
  analysis: AnalysisResult | null;
  error: string | null;
  warning: string | null;
  isTranslating: boolean;
  reset: () => void;
  setVideoSource: (source: VideoSource) => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleInstagramUrlSubmit: (url: string) => void;
  handleYoutubeUrlSubmit: (url: string) => void;
  handleTikTokUrlSubmit: (url: string) => void;
  handleDropFile: (files: FileList) => void;
  handleTranslate: () => void;
  exportAnalysis: () => void;
}

// Valeurs par défaut du contexte
const defaultContext: AnalyzerContextType = {
  videoUrl: null,
  videoSource: 'instagram',
  uploadedFile: null,
  isProcessing: false,
  isAnalyzed: false,
  progress: 0,
  videoMetadata: null,
  transcription: null,
  analysis: null,
  error: null,
  warning: null,
  isTranslating: false,
  reset: () => {},
  setVideoSource: () => {},
  handleFileUpload: () => {},
  handleInstagramUrlSubmit: () => {},
  handleYoutubeUrlSubmit: () => {},
  handleTikTokUrlSubmit: () => {},
  handleDropFile: () => {},
  handleTranslate: () => {},
  exportAnalysis: () => {},
};

// Création du contexte
const AnalyzerContext = createContext<AnalyzerContextType>(defaultContext);

// Hook personnalisé pour utiliser le contexte
export const useAnalyzer = () => useContext(AnalyzerContext);

// Provider du contexte
export const AnalyzerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [serverVideoUrl, setServerVideoUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progress, setProgress] = useState(0);
  const [videoSource, setVideoSource] = useState<VideoSource>('instagram');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  
  // Progressive loading states
  const [isVideoUploaded, setIsVideoUploaded] = useState<boolean>(false);
  const [isTranscriptionDone, setIsTranscriptionDone] = useState<boolean>(false);
  const [isAnalysisDone, setIsAnalysisDone] = useState<boolean>(false);

  // Fonction pour simuler la progression
  const simulateProgress = () => {
    // Nous n'avons plus besoin de simuler la progression car nous la mettons à jour
    // en fonction des étapes réelles du processus
    return setInterval(() => {
      setProgress((prev) => {
        // Limiter la progression simulée à 95% maximum
        // Les étapes réelles mettront à jour la progression à 33%, 66% et 100%
        if (prev < 20) return prev + 1;
        return prev;
      });
    }, 500);
  };

  // Traitement d'une URL de vidéo
  const processVideoUrl = async (videoUrl: string) => {
    setIsProcessing(true);
    setError(null);
    setWarning(null);
    setProgress(10);
    
    try {
      console.log('Traitement de la vidéo à partir de l\'URL:', videoUrl);
      
      // Extraire les métadonnées de la vidéo
      try {
        const metadata = await extractVideoMetadata(videoUrl);
        if (metadata) {
          setVideoMetadata(metadata);
          console.log('Métadonnées extraites:', metadata);
        }
      } catch (metadataError) {
        console.error('Erreur lors de l\'extraction des métadonnées:', metadataError);
        // Continuer même si l'extraction des métadonnées échoue
      }
      
      // Mettre à jour la vidéo immédiatement, même si la transcription peut échouer
      setVideoUrl(videoUrl);
      setProgress(30);
      
      // Transcription de la vidéo
      let transcriptionResult;
      try {
        console.log('Transcription de la vidéo en cours...');
        transcriptionResult = await transcribeVideo(videoUrl, { responseFormat: 'verbose_json' });
        console.log('Transcription réussie:', transcriptionResult);
        setTranscription(transcriptionResult);
        setProgress(70);
      } catch (transcriptionError) {
        console.error('Erreur lors de la transcription:', transcriptionError);
        
        // Si nous avons un message d'erreur spécifique concernant le format de fichier, l'afficher
        if ((transcriptionError as Error).message.includes('Format de fichier non supporté')) {
          setWarning('La transcription a échoué car le format du fichier n\'est pas pris en charge. L\'API OpenAI accepte uniquement les formats audio: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm.');
        } else {
          setWarning('La transcription a échoué, mais la vidéo reste disponible pour visionnage.');
        }
        
        // Marquer le processus comme terminé mais avec un avertissement
        setIsProcessing(false);
        setIsAnalyzed(true);
        setProgress(100);
        return; // Sortir de la fonction, la vidéo est déjà affichée
      }
      
      // Analyse du contenu si la transcription est disponible
      if (transcriptionResult) {
        try {
          console.log('Analyse du contenu en cours...');
          // On peut procéder à l'analyse si nous avons une transcription
          const analysisResult = await analyzeContent(transcriptionResult);
          
          // Vérifier si la structure de l'analyse est valide
          if (analysisResult && typeof analysisResult === 'object') {
            setAnalysis(analysisResult);
            console.log('Analyse terminée:', analysisResult);
          } else {
            console.error('Résultat d\'analyse invalide:', analysisResult);
            setWarning('L\'analyse n\'a pas produit de résultats valides, mais la vidéo et la transcription sont disponibles.');
          }
        } catch (analysisError) {
          console.error('Erreur lors de l\'analyse:', analysisError);
          setWarning('L\'analyse a échoué, mais la vidéo et la transcription restent disponibles.');
        }
      }
      
      // Marquer le processus comme terminé
      setIsProcessing(false);
      setIsAnalyzed(true);
      setProgress(100);
      
    } catch (error) {
      console.error('Erreur lors du traitement de la vidéo:', error);
      // En cas d'erreur générale, on réinitialise les états de progression
      // mais on conserve la vidéo si elle a été définie
      setIsProcessing(false);
      setProgress(0);
      setError(`Erreur lors du traitement de la vidéo: ${(error as Error).message}`);
    }
  };

  // Traitement d'un fichier téléchargé
  const processUploadedFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setWarning(null);
    setUploadProgress(0);
    setProgress(10);
    
    try {
      // Commencer par uploader la vidéo
      console.log(`Début de l'upload du fichier: ${file.name} (${file.size} octets, type: ${file.type})`);
      
      // Conserver la vidéo localement pour l'affichage immédiat
      const localVideoUrl = URL.createObjectURL(file);
      setVideoUrl(localVideoUrl);
      setProgress(20);
      
      // Uploader la vidéo sur le serveur
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        // Effectuer l'upload avec suivi de progression
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!uploadResponse.ok) {
          const errorMessage = await uploadResponse.text();
          throw new Error(`Erreur lors de l'upload: ${uploadResponse.status} - ${errorMessage}`);
        }
        
        const uploadResult = await uploadResponse.json();
        console.log('Résultat de l\'upload:', uploadResult);
        
        if (!uploadResult.url) {
          throw new Error('L\'URL de la vidéo est manquante dans la réponse d\'upload');
        }
        
        setServerVideoUrl(uploadResult.url);
        setProgress(40);
      } catch (uploadError) {
        console.error('Erreur lors de l\'upload:', uploadError);
        setWarning(`L\'upload sur le serveur a échoué, mais la vidéo locale reste disponible pour visionnage. Erreur: ${(uploadError as Error).message}`);
        // Continuer avec la version locale de la vidéo
        setProgress(40); // Passer à l'étape suivante malgré l'erreur
      }
      
      // Extraire les métadonnées de la vidéo
      try {
        const metadata = await extractVideoMetadata(localVideoUrl);
        if (metadata) {
          setVideoMetadata(metadata);
          console.log('Métadonnées extraites:', metadata);
        }
      } catch (metadataError) {
        console.error('Erreur lors de l\'extraction des métadonnées:', metadataError);
        // Continuer même si l'extraction des métadonnées échoue
      }
      
      // Transcription de la vidéo (utiliser l'URL du serveur si disponible, sinon fichier local)
      let transcriptionResult;
      try {
        const videoToTranscribe = serverVideoUrl || file;
        console.log('Transcription de la vidéo en cours...', typeof videoToTranscribe);
        
        transcriptionResult = await transcribeVideo(videoToTranscribe, { responseFormat: 'verbose_json' });
        console.log('Transcription réussie:', transcriptionResult);
        setTranscription(transcriptionResult);
        setProgress(70);
      } catch (transcriptionError) {
        console.error('Erreur lors de la transcription:', transcriptionError);
        
        // Si nous avons un message d'erreur spécifique concernant le format de fichier, l'afficher
        if ((transcriptionError as Error).message.includes('Format de fichier non supporté')) {
          setWarning('La transcription a échoué car le format du fichier n\'est pas pris en charge. L\'API OpenAI accepte uniquement les formats audio: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm.');
        } else {
          setWarning('La transcription a échoué, mais la vidéo reste disponible pour visionnage.');
        }
        
        // Marquer le processus comme terminé mais avec un avertissement
        setIsProcessing(false);
        setIsAnalyzed(true);
        setProgress(100);
        return; // Sortir de la fonction, la vidéo est déjà affichée
      }
      
      // Analyse du contenu si la transcription est disponible
      if (transcriptionResult) {
        try {
          console.log('Analyse du contenu en cours...');
          // On peut procéder à l'analyse si nous avons une transcription
          const analysisResult = await analyzeContent(transcriptionResult);
          
          // Vérifier si la structure de l'analyse est valide
          if (analysisResult && typeof analysisResult === 'object') {
            setAnalysis(analysisResult);
            console.log('Analyse terminée:', analysisResult);
          } else {
            console.error('Résultat d\'analyse invalide:', analysisResult);
            setWarning('L\'analyse n\'a pas produit de résultats valides, mais la vidéo et la transcription sont disponibles.');
          }
        } catch (analysisError) {
          console.error('Erreur lors de l\'analyse:', analysisError);
          setWarning('L\'analyse a échoué, mais la vidéo et la transcription restent disponibles.');
        }
      }
      
      // Marquer le processus comme terminé
      setIsProcessing(false);
      setIsAnalyzed(true);
      setProgress(100);
      
    } catch (error) {
      console.error('Erreur lors du traitement du fichier:', error);
      // En cas d'erreur générale, on réinitialise les états de progression
      // mais on conserve la vidéo si elle a été définie
      setIsProcessing(false);
      setProgress(0);
      setError(`Erreur lors du traitement du fichier: ${(error as Error).message}`);
      
      // Arrêter toute simulation de progression en cours
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }
  };

  // Génération d'un export
  const generateExport = async (format: ExportFormat): Promise<any> => {
    if (!transcription || !analysis) {
      throw new Error('No data to export');
    }
    
    try {
      setError(null);
      const exportResult = await exportReport(transcription, analysis, format);
      
      if (exportResult.needsAuth) {
        // Si l'authentification est nécessaire, retourner l'objet complet
        return exportResult;
      }
      
      // Sinon, stocker l'URL et la retourner
      setExportUrl(exportResult.exportUrl);
      return exportResult.exportUrl;
    } catch (error: any) {
      console.error('Error exporting:', error);
      setError(error.message || 'An error occurred while exporting');
      throw error;
    }
  };

  // Réinitialisation de l'état
  const resetState = () => {
    // Arrêter toute simulation de progression en cours
    const interval = simulateProgress();
    clearInterval(interval);
    
    // Réinitialiser les états principaux
    setIsProcessing(false);
    setIsAnalyzed(false);
    setProgress(0);
    setVideoMetadata(null);
    setTranscription(null);
    setAnalysis(null);
    setExportUrl(null);
    setError(null);
    setIsTranslating(false);
    
    // Réinitialiser les états de progression
    setIsVideoUploaded(false);
    setIsTranscriptionDone(false);
    setIsAnalysisDone(false);
  };

  // Handlers pour le téléchargement de fichiers et soumission d'URL
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setUploadedFile(file);
      processUploadedFile(file);
    }
  };

  const handleInstagramUrlSubmit = (url: string) => {
    setVideoSource('instagram');
    processVideoUrl(url);
  };

  const handleYoutubeUrlSubmit = (url: string) => {
    setVideoSource('youtube');
    processVideoUrl(url);
  };

  const handleTikTokUrlSubmit = (url: string) => {
    setVideoSource('tiktok');
    processVideoUrl(url);
  };

  const handleDropFile = (files: FileList) => {
    if (files && files.length > 0) {
      const file = files[0];
      setUploadedFile(file);
      processUploadedFile(file);
    }
  };

  const handleTranslate = async () => {
    if (!transcription) {
      setError('Aucune transcription disponible à traduire');
      return;
    }
    
    try {
      setError(null);
      setIsTranslating(true);
      
      // Ici, vous pouvez appeler votre fonction de traduction
      // par exemple: await translateText(transcription.text, targetLanguage);
      
      // Pour l'instant, ajoutons un message d'information
      setWarning('La fonctionnalité de traduction est en cours de développement');
    } catch (error) {
      console.error('Erreur de traduction:', error);
      setError(`Erreur lors de la traduction: ${(error as Error).message}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const exportAnalysis = () => {
    if (!transcription || !analysis) {
      setError('Aucune analyse disponible à exporter');
      return;
    }
    
    try {
      // Créer un objet contenant les données à exporter
      const exportData = {
        metadata: videoMetadata,
        transcription: transcription,
        analysis: analysis
      };
      
      // Convertir en JSON
      const jsonStr = JSON.stringify(exportData, null, 2);
      
      // Créer un Blob
      const blob = new Blob([jsonStr], { type: 'application/json' });
      
      // Créer une URL pour le téléchargement
      const url = URL.createObjectURL(blob);
      
      // Créer un lien de téléchargement
      const a = document.createElement('a');
      a.href = url;
      a.download = 'video-analysis.json';
      
      // Simuler un clic
      document.body.appendChild(a);
      a.click();
      
      // Nettoyer
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      setError(`Erreur lors de l'export: ${(error as Error).message}`);
    }
  };

  // Valeur du contexte
  const value: AnalyzerContextType = {
    videoUrl,
    videoSource,
    uploadedFile,
    isProcessing,
    isAnalyzed,
    progress,
    videoMetadata,
    transcription,
    analysis,
    error,
    warning,
    isTranslating,
    reset: resetState,
    setVideoSource,
    handleFileUpload,
    handleInstagramUrlSubmit,
    handleYoutubeUrlSubmit,
    handleTikTokUrlSubmit,
    handleDropFile,
    handleTranslate,
    exportAnalysis,
  };

  return (
    <AnalyzerContext.Provider value={value}>
      {children}
    </AnalyzerContext.Provider>
  );
}; 