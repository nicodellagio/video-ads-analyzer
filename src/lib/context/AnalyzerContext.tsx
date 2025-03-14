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

interface AnalyzerContextType {
  // State
  videoUrl: string;
  videoSource: VideoSource;
  uploadedFile: File | null;
  isProcessing: boolean;
  isAnalyzed: boolean;
  progress: number;
  videoMetadata: VideoMetadata | null;
  transcription: Transcription | null;
  analysis: AnalysisResult | null;
  exportUrl: string | null;
  error: string | null;
  isTranslating: boolean;
  
  // New states for progressive loading
  isVideoUploaded: boolean;
  isTranscriptionDone: boolean;
  isAnalysisDone: boolean;
  
  // Actions
  setVideoUrl: (url: string) => void;
  setVideoSource: (source: VideoSource) => void;
  setUploadedFile: (file: File | null) => void;
  processVideoUrl: (url: string, source: VideoSource) => Promise<void>;
  processUploadedFile: (file: File) => Promise<void>;
  generateExport: (format: ExportFormat) => Promise<any>;
  translateTranscription: (targetLanguage: LanguageCode) => Promise<void>;
  resetState: () => void;
}

// Valeurs par défaut du contexte
const defaultContext: AnalyzerContextType = {
  videoUrl: '',
  videoSource: 'instagram',
  uploadedFile: null,
  isProcessing: false,
  isAnalyzed: false,
  progress: 0,
  videoMetadata: null,
  transcription: null,
  analysis: null,
  exportUrl: null,
  error: null,
  isTranslating: false,
  
  // Nouveaux états pour le chargement progressif
  isVideoUploaded: false,
  isTranscriptionDone: false,
  isAnalysisDone: false,
  
  setVideoUrl: () => {},
  setVideoSource: () => {},
  setUploadedFile: () => {},
  processVideoUrl: async () => {},
  processUploadedFile: async () => {},
  generateExport: async () => {},
  translateTranscription: async () => {},
  resetState: () => {},
};

// Création du contexte
const AnalyzerContext = createContext<AnalyzerContextType>(defaultContext);

// Hook personnalisé pour utiliser le contexte
export const useAnalyzer = () => useContext(AnalyzerContext);

// Provider du contexte
export const AnalyzerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoSource, setVideoSource] = useState<VideoSource>('instagram');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isAnalyzed, setIsAnalyzed] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const processVideoUrl = async (url: string, source: VideoSource) => {
    try {
      setError(null);
      setIsProcessing(true);
      setIsAnalyzed(false); // Réinitialiser l'état d'analyse
      setAnalysis(null); // Réinitialiser l'analyse précédente
      setTranscription(null); // Réinitialiser la transcription précédente
      
      // Réinitialiser les états de progression
      setIsVideoUploaded(false);
      setIsTranscriptionDone(false);
      setIsAnalysisDone(false);
      
      const progressInterval = simulateProgress();
      
      // 1. Extraire la vidéo
      const extractionResult = await extractVideoFromUrl(url, source) as any;
      
      // Vérifier la structure de la réponse et extraire les métadonnées vidéo
      let videoData;
      if (extractionResult.videoMetadata) {
        videoData = extractionResult.videoMetadata;
      } else if (extractionResult.video) {
        videoData = extractionResult.video;
      } else {
        throw new Error("Invalid response extraction format");
      }
      
      setVideoMetadata(videoData);
      setIsVideoUploaded(true); // Marquer l'extraction comme terminée
      setProgress(33); // Mettre à jour la progression
      
      // 2. Transcription de la vidéo
      const transcriptionResult = await transcribeVideo(
        videoData.url, 
        source
      );
      console.log("Transcription result:", JSON.stringify(transcriptionResult, null, 2));
      setTranscription(transcriptionResult);
      setIsTranscriptionDone(true); // Marquer la transcription comme terminée
      setProgress(66); // Mettre à jour la progression
      
      // 3. Analyse du contenu
      const analysisResult = await analyzeContent(
        transcriptionResult, 
        videoData
      );
      console.log("Analysis result:", JSON.stringify(analysisResult, null, 2));
      
      // S'assurer que l'analyse est correctement structurée
      if (analysisResult && analysisResult.analysis) {
        setAnalysis(analysisResult.analysis);
        setIsAnalysisDone(true); // Marquer l'analyse comme terminée
      } else {
        console.error("Invalid analysis structure:", analysisResult);
        throw new Error("The analysis structure is invalid");
      }
      
      clearInterval(progressInterval);
      setProgress(100);
      setIsAnalyzed(true);
      setIsProcessing(false);
    } catch (error: any) {
      console.error('Error processing URL:', error);
      setIsProcessing(false);
      setProgress(0);
      setError(error.message || 'An error occurred while processing the URL');
      
      // Reset progress states
      setIsVideoUploaded(false);
      setIsTranscriptionDone(false);
      setIsAnalysisDone(false);
    }
  };

  // Traitement d'un fichier téléchargé
  const processUploadedFile = async (file: File) => {
    try {
      setError(null);
      setIsProcessing(true);
      setIsAnalyzed(false); // Réinitialiser l'état d'analyse
      setAnalysis(null); // Réinitialiser l'analyse précédente
      setTranscription(null); // Réinitialiser la transcription précédente
      
      // Réinitialiser les états de progression
      setIsVideoUploaded(false);
      setIsTranscriptionDone(false);
      setIsAnalysisDone(false);
      
      const progressInterval = simulateProgress();
      
      // 1. Télécharger le fichier
      const uploadResult = await uploadVideoFile(file) as any;
      
      // Vérifier la structure de la réponse
      if (!uploadResult || !uploadResult.videoMetadata) {
        throw new Error("Invalid upload response format");
      }
      
      setVideoMetadata(uploadResult.videoMetadata);
      setIsVideoUploaded(true); // Marquer le téléchargement comme terminé
      setProgress(33); // Mettre à jour la progression
      
      // 2. Transcription de la vidéo
      const transcriptionResult = await transcribeVideo(
        uploadResult.videoMetadata.url, 
        'upload'
      );
      console.log("Transcription result:", JSON.stringify(transcriptionResult, null, 2));
      setTranscription(transcriptionResult);
      setIsTranscriptionDone(true); // Marquer la transcription comme terminée
      setProgress(66); // Mettre à jour la progression
      
      // 3. Analyse du contenu
      const analysisResult = await analyzeContent(
        transcriptionResult, 
        uploadResult.videoMetadata
      );
      console.log("Analysis result:", JSON.stringify(analysisResult, null, 2));
      
      // S'assurer que l'analyse est correctement structurée
      if (analysisResult && analysisResult.analysis) {
        setAnalysis(analysisResult.analysis);
        setIsAnalysisDone(true); // Marquer l'analyse comme terminée
      } else {
        console.error("Invalid analysis structure:", analysisResult);
        throw new Error("The analysis structure is invalid");
      }
      
      clearInterval(progressInterval);
      setProgress(100);
      setIsAnalyzed(true);
      setIsProcessing(false);
    } catch (error: any) {
      console.error('Error processing file:', error);
      setIsProcessing(false);
      setProgress(0);
      setError(error.message || 'An error occurred while processing the file');
      
      // Reset progress states in case of error
      setIsVideoUploaded(false);
      setIsTranscriptionDone(false);
      setIsAnalysisDone(false);
      
      // Stop progress simulation
      clearInterval(simulateProgress());
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
    exportUrl,
    error,
    isTranslating,
    
    // Nouveaux états pour le chargement progressif
    isVideoUploaded,
    isTranscriptionDone,
    isAnalysisDone,
    
    setVideoUrl,
    setVideoSource,
    setUploadedFile,
    processVideoUrl,
    processUploadedFile,
    generateExport,
    translateTranscription: async (targetLanguage: LanguageCode) => {
      if (!transcription) {
        throw new Error('No transcription to translate');
      }
      
      try {
        setError(null);
        setIsTranslating(true);
        console.log(`Request translation to ${targetLanguage} for text:`, transcription.text.substring(0, 50) + '...');
        console.log(`Initial transcription state:`, JSON.stringify({
          hasText: !!transcription.text,
          language: transcription.language,
          hasTranslations: !!transcription.translations,
          availableTranslations: transcription.translations ? Object.keys(transcription.translations) : []
        }, null, 2));
        
        const response = await translateText(transcription.text, targetLanguage);
        
        // Extract translated text from response
        const translatedText = response.translatedText;
        console.log(`Received translated text (${targetLanguage}):`, translatedText.substring(0, 50) + '...');
        
        // Create a new translations object
        const updatedTranslations = {
          ...(transcription.translations || {}),
          [targetLanguage]: translatedText
        };
        
        // Create a new transcription object with updated translations
        const updatedTranscription = {
          ...transcription,
          translations: updatedTranslations
        };
        
        console.log(`Updated transcription state:`, JSON.stringify({
          hasText: !!updatedTranscription.text,
          language: updatedTranscription.language,
          hasTranslations: !!updatedTranscription.translations,
          availableTranslations: updatedTranscription.translations ? Object.keys(updatedTranscription.translations) : []
        }, null, 2));
        
        // Update state with new object
        setTranscription(updatedTranscription);
        console.log(`Transcription updated with translation in ${targetLanguage}`);
        
        // Return translated text for immediate use
        return translatedText;
      } catch (error: any) {
        console.error('Translation error:', error);
        setError(error.message || 'An error occurred while translating');
        throw error;
      } finally {
        setIsTranslating(false);
      }
    },
    resetState,
  };

  return (
    <AnalyzerContext.Provider value={value}>
      {children}
    </AnalyzerContext.Provider>
  );
}; 