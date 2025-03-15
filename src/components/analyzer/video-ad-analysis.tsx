"use client"

import type React from "react"
import { useRef } from "react"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Instagram,
  Facebook,
  Upload,
  FileText,
  Download,
  ExternalLink,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Loader2,
  CheckCircle2,
  Share2,
  Maximize2,
  AlertCircle,
  X
} from "lucide-react"
import { useAnalyzer, LanguageCode } from "@/lib/context/AnalyzerContext"

// Utility function to format HTML content
const formatHtmlContent = (content: string) => {
  if (!content) return '';
  
  // Step 1: Remove section titles
  let formatted = content.replace(/^\*\*[^*]+\*\*:\s*/m, '');
  
  // Step 2: Replace ** with strong tags
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Step 3: Format bullets for better readability
  formatted = formatted.replace(/^- (.+)$/gm, '• $1');
  
  // Step 4: Add line breaks for paragraphs
  formatted = formatted.replace(/\n\n/g, '</p><p>');
  
  // Step 5: Wrap in p tags if not already done
  if (!formatted.startsWith('<p>')) {
    formatted = `<p>${formatted}</p>`;
  }
  
  return formatted;
};

// Fonction pour formater la durée en minutes:secondes
const formatDuration = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const formattedSeconds = remainingSeconds < 10 ? `0${remainingSeconds}` : `${remainingSeconds}`;
  
  return `${formattedMinutes}:${formattedSeconds}`;
};

// Fonction pour filtrer les éléments uniques et éviter les duplications
const getUniqueElements = (elements: string[]) => {
  if (!elements || elements.length === 0) return [];
  
  // Nettoyer et formater chaque élément
  const cleanedElements = elements.map(element => {
    // Supprimer les tirets au début si présents
    return element.trim().replace(/^-\s*/, '');
  });
  
  // Filtrer les éléments vides ou trop courts
  return cleanedElements
    .filter(element => element.length > 3)
    .filter((element, index, self) => 
      // Garder seulement la première occurrence de chaque élément
      self.indexOf(element) === index
    );
};

export default function VideoAdAnalysis() {
  // Utiliser le contexte d'analyse
  const {
    videoUrl,
    uploadedFile,
    isProcessing,
    isAnalyzed,
    progress,
    videoMetadata,
    transcription,
    analysis,
    error,
    isTranslating,
    
    // Nouveaux états pour le chargement progressif
    isVideoUploaded,
    isTranscriptionDone,
    isAnalysisDone,
    
    setVideoUrl,
    setUploadedFile,
    processVideoUrl,
    processUploadedFile,
    generateExport,
    translateTranscription,
    resetState,
  } = useAnalyzer();

  // Local UI state
  const [currentTab, setCurrentTab] = useState<string>('instagram');
  const [showError, setShowError] = useState<boolean>(true);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null);
  const [realMetadata, setRealMetadata] = useState<{ duration: number; format: string; size: string }>({ duration: 0, format: '', size: '' });
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [googleAuthMessage, setGoogleAuthMessage] = useState<string | null>(null);
  
  // Video playback states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Mettre à jour la langue sélectionnée lorsque la transcription est disponible
  useEffect(() => {
    if (transcription && transcription.language) {
      // Définir la langue sélectionnée sur la langue détectée
      const detectedLang = transcription.language.substring(0, 2) as LanguageCode;
      setSelectedLanguage(detectedLang);
    }
  }, [transcription]);

  // Effet pour forcer le rafraîchissement de l'interface lorsque les traductions changent
  useEffect(() => {
    if (transcription && transcription.translations) {
      console.log("Traductions mises à jour:", Object.keys(transcription.translations));
      // Forcer le rafraîchissement de l'interface
      const currentLang = selectedLanguage;
      if (currentLang && transcription.translations[currentLang]) {
        console.log(`Traduction disponible pour ${currentLang}, rafraîchissement de l'interface`);
        // Utiliser un setTimeout pour s'assurer que l'état est bien mis à jour
        setTimeout(() => {
          setSelectedLanguage(prev => {
            console.log(`Rafraîchissement forcé: ${prev} -> ${prev}`);
            return prev;
          });
        }, 50);
      }
    }
  }, [transcription?.translations, selectedLanguage]);

  // Gérer le changement de langue
  const handleLanguageChange = async (language: string) => {
    console.log(`Changement de langue demandé: ${language}`);
    const langCode = language as LanguageCode;
    setSelectedLanguage(langCode);
    
    // Si la langue sélectionnée n'est pas la langue originale et que la traduction n'existe pas encore
    const originalLang = transcription?.language?.substring(0, 2) as LanguageCode || 'fr';
    console.log(`Langue originale: ${originalLang}, Nouvelle langue: ${langCode}`);
    
    if (transcription) {
      console.log(`État actuel des traductions:`, 
        transcription.translations 
          ? `Disponibles: ${Object.keys(transcription.translations).join(', ')}` 
          : 'Aucune traduction disponible');
    }
    
    if (langCode !== originalLang && transcription && (!transcription.translations || !transcription.translations[langCode])) {
      try {
        console.log(`Traduction en cours vers ${langCode}...`);
        await translateTranscription(langCode);
        console.log(`Traduction terminée vers ${langCode}`);
        
        // Forcer la mise à jour de l'interface après la traduction
        setTimeout(() => {
          console.log("Rafraîchissement forcé de l'interface après traduction");
          setSelectedLanguage(prev => {
            console.log(`Mise à jour forcée de la langue sélectionnée: ${prev} -> ${langCode}`);
            return langCode;
          });
        }, 100);
      } catch (error) {
        console.error("Erreur lors de la traduction:", error);
      }
    } else {
      console.log(`Utilisation de la langue ${langCode}${langCode === originalLang ? ' (originale)' : ' (déjà traduite)'}`);
    }
  };

  // Obtenir le texte à afficher en fonction de la langue sélectionnée
  const getDisplayText = () => {
    if (!transcription) {
      console.log("Transcription non disponible");
      return "";
    }
    
    // Si aucune langue n'est sélectionnée, retourner une chaîne vide
    if (!selectedLanguage) {
      console.log("Aucune langue sélectionnée");
      return "";
    }
    
    // Déterminer la langue originale de la transcription
    const originalLang = transcription.language?.substring(0, 2) as LanguageCode || 'fr';
    console.log(`Langue originale: ${originalLang}, Langue sélectionnée: ${selectedLanguage}`);
    console.log(`État de la transcription:`, JSON.stringify({
      hasText: !!transcription.text,
      language: transcription.language,
      hasTranslations: !!transcription.translations,
      availableTranslations: transcription.translations ? Object.keys(transcription.translations) : []
    }, null, 2));
    
    // Vérifier si transcription est un objet ou une chaîne de caractères
    if (typeof transcription === 'string') {
      console.log("Transcription est une chaîne de caractères");
      return transcription;
    }
    
    // Vérifier si transcription a une propriété text
    if (!transcription.text && (transcription as any).transcription) {
      console.log("Utilisation de transcription.transcription");
      return (transcription as any).transcription;
    }
    
    // Si la langue sélectionnée est la langue originale
    if (selectedLanguage === originalLang) {
      console.log("Affichage du texte original");
      // Vérifier si text est disponible, sinon essayer d'autres propriétés
      if (transcription.text) {
        return transcription.text;
      } else if ((transcription as any).transcription) {
        return (transcription as any).transcription;
      } else if ((transcription as any)[`text_${originalLang}`]) {
        return (transcription as any)[`text_${originalLang}`];
      }
      
      // Si aucune propriété n'est trouvée, retourner une chaîne vide
      return "";
    }
    
    // Si une traduction existe pour cette langue
    if (transcription.translations && transcription.translations[selectedLanguage]) {
      console.log(`Utilisation de la traduction en ${selectedLanguage}`);
      console.log(`Texte traduit: ${transcription.translations[selectedLanguage].substring(0, 50)}...`);
      return transcription.translations[selectedLanguage];
    }
    
    // Si la traduction est en cours
    if (isTranslating) {
      console.log("Traduction en cours...");
      return "Translation in progress...";
    }
    
    // Par défaut, afficher le texte original
    console.log("Aucune traduction disponible, affichage du texte original");
    if (transcription.text) {
      return transcription.text;
    } else if ((transcription as any).transcription) {
      return (transcription as any).transcription;
    } else if ((transcription as any)[`text_${originalLang}`]) {
      return (transcription as any)[`text_${originalLang}`];
    }
    
    return "";
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoUrl) return
    setShowError(true)
    resetState()
    processVideoUrl(videoUrl, currentTab as any);
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadedFile) return
    setShowError(true)
    resetState()
    processUploadedFile(uploadedFile);
  }

  const handleExport = async (format: 'pdf' | 'gdocs') => {
    try {
      setShowError(true);
      setIsExporting(true);
      setGoogleAuthMessage(null);
      
      if (format === 'gdocs') {
        setGoogleAuthMessage("Préparation de l'export vers Google Docs...");
      }
      
      const response = await generateExport(format);
      
      if (format === 'pdf') {
        // Télécharger le PDF directement
        const link = document.createElement('a');
        link.href = response;
        link.download = `rapport-analyse-video_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (format === 'gdocs') {
        // Vérifier si l'authentification est nécessaire
        if (response.needsAuth && response.authUrl) {
          // Afficher un message d'information
          setGoogleAuthMessage("You will be redirected to Google to authorize access to Google Docs.");
          
          // Rediriger vers l'URL d'authentification Google après un court délai
          setTimeout(() => {
            window.location.href = response.authUrl;
          }, 2000);
          return;
        }
        
        // Si c'est une URL de données (HTML), afficher un message
        if (response.startsWith('blob:') || response.startsWith('data:')) {
          setGoogleAuthMessage("Export Google Docs not available. A HTML document has been generated instead.");
        } else {
          setGoogleAuthMessage("Google Docs document created successfully!");
          setTimeout(() => setGoogleAuthMessage(null), 5000);
        }
        
        // Ouvrir le lien dans un nouvel onglet
        window.open(response, '_blank');
      }
    } catch (error) {
      console.error('Erreur lors de l\'exportation:', error);
      setGoogleAuthMessage("An error occurred while exporting. Please try again.");
      // L'erreur est déjà gérée dans le contexte
    } finally {
      setIsExporting(false);
    }
  }

  // Fonctions pour contrôler la lecture vidéo
  const togglePlay = () => {
    if (videoRef.current) {
      try {
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        } else {
          // Utiliser une promesse pour gérer correctement la lecture
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setIsPlaying(true);
              })
              .catch(e => {
                console.error('Erreur de lecture vidéo:', e);
                // Ne pas changer l'état si la lecture échoue
              });
          } else {
            setIsPlaying(true); // Fallback pour les anciens navigateurs
          }
        }
      } catch (error) {
        console.error('Erreur lors du contrôle de la vidéo:', error);
      }
    }
  };
  
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };
  
  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(e => console.error('Erreur lors de la sortie du mode plein écran:', e));
      } else {
        videoRef.current.requestFullscreen().catch(e => console.error('Erreur lors du passage en mode plein écran:', e));
      }
    }
  };
  
  // Mettre à jour le temps de lecture
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const updateTime = () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration);
    };
    
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateTime);
    
    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateTime);
    };
  }, [videoRef.current]);

  // Mettre à jour la source vidéo lorsque l'onglet change
  const handleTabChange = (value: string) => {
    setCurrentTab(value);
  }

  // Fermer le message d'erreur
  const dismissError = () => {
    setShowError(false);
  }

  // Vérifier si l'utilisateur revient d'une authentification Google
  useEffect(() => {
    // Vérifier si l'URL contient un paramètre d'erreur d'authentification
    const urlParams = new URLSearchParams(window.location.search);
    const authError = urlParams.get('error');
    const authSuccess = urlParams.get('auth_success');
    
    if (authError === 'auth_failed') {
      setGoogleAuthMessage("Google authentication failed. Please try again.");
      
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authSuccess === 'true' && isAnalyzed && transcription && analysis) {
      // L'utilisateur vient de s'authentifier avec succès, déclencher l'export
      setGoogleAuthMessage("Authentication successful. Creating Google Docs document in progress...");
      
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Déclencher l'export après un court délai
      setTimeout(() => {
        handleExport('gdocs');
      }, 1000);
    }
  }, [isAnalyzed, transcription, analysis, handleExport]);

  // Ajout de la fonction handleLoadedMetadata pour récupérer les métadonnées réelles de la vidéo
  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const duration = video.duration;
    let format = videoMetadata?.format;
    let size = videoMetadata?.size;
    
    if (uploadedFile) {
      format = uploadedFile.type;
      const bytes = uploadedFile.size;
      if (bytes < 1024) {
        size = `${bytes} B`;
      } else if (bytes < 1048576) {
        size = `${(bytes / 1024).toFixed(2)} KB`;
      } else if (bytes < 1073741824) {
        size = `${(bytes / 1048576).toFixed(2)} MB`;
      } else {
        size = `${(bytes / 1073741824).toFixed(2)} GB`;
      }
    } else if (videoMetadata?.url) {
      // Extraction du format plus robuste pour gérer les URLs S3 signées
      // Exemple: https://something.s3.amazonaws.com/video.mp4?X-Amz-Algorithm=...
      const urlPath = videoMetadata.url.split('?')[0]; // Retirer tous les paramètres d'URL
      const parts = urlPath.split('.');
      if (parts.length > 1) {
        format = parts[parts.length - 1].toLowerCase(); // Prendre seulement l'extension
        
        // S'assurer que le format est propre, sans paramètres supplémentaires
        if (format.includes('/')) {
          format = 'mp4'; // Format par défaut si l'extension est corrompue
        }
      } else {
        format = 'mp4'; // Format par défaut si aucune extension n'est trouvée
      }
    }
    setRealMetadata({ duration, format: format || '', size: size || '' });
  };

  // Mettre à jour la source vidéo lorsque l'URL change
  useEffect(() => {
    if (videoRef.current) {
      const updateTime = () => {
        setCurrentTime(videoRef.current?.currentTime || 0);
      };
      
      const handleVideoLoaded = () => {
        console.log('Vidéo chargée et prête à être lue');
        setDuration(videoRef.current?.duration || 0);
      };
      
      videoRef.current.addEventListener('timeupdate', updateTime);
      videoRef.current.addEventListener('loadeddata', handleVideoLoaded);
      
      return () => {
        videoRef.current?.removeEventListener('timeupdate', updateTime);
        videoRef.current?.removeEventListener('loadeddata', handleVideoLoaded);
      };
    }
  }, []);

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="container mx-auto py-12 max-w-5xl px-4">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">VideoAds Analyzer</h1>
            <p className="text-gray-500 mt-2 text-lg">Analyze your video ads with precision</p>
          </div>
          <Badge variant="outline" className="border-black text-black px-3 py-1 rounded-full">
            BETA
          </Badge>
        </div>

        {/* Error display */}
        {error && showError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
              <div className="mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                  onClick={() => resetState()}
                >
                  Try Again
                </Button>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-500 hover:text-gray-700"
              onClick={dismissError}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Input Section */}
          <div>
            <Card className="bg-white border-gray-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-black">Input Source</CardTitle>
                <CardDescription className="text-gray-500">
                  Enter a URL or upload a video file to analyze
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
                  <TabsList className="grid grid-cols-3 bg-gray-50 rounded-none border-b border-gray-100 p-0">
                    <TabsTrigger
                      value="instagram"
                      className="data-[state=active]:bg-white data-[state=active]:text-black rounded-none border-r border-gray-100 py-3"
                    >
                      <Instagram className="h-4 w-4 mr-2" />
                      Instagram
                    </TabsTrigger>
                    <TabsTrigger
                      value="meta"
                      className="data-[state=active]:bg-white data-[state=active]:text-black rounded-none border-r border-gray-100 py-3"
                    >
                      <Facebook className="h-4 w-4 mr-2" />
                      Meta Ads
                    </TabsTrigger>
                    <TabsTrigger
                      value="upload"
                      className="data-[state=active]:bg-white data-[state=active]:text-black rounded-none py-3"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="instagram" className="p-6 m-0">
                    <form onSubmit={handleUrlSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="instagram-url" className="block text-sm font-medium mb-1 text-gray-700">
                          URL Instagram Reel/Ad
                        </label>
                        <Input
                          id="instagram-url"
                          placeholder="https://www.instagram.com/reel/..."
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          className="bg-white border-gray-200 focus:border-black focus:ring-black text-black"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Exemple: https://www.instagram.com/reel/CxKLz7xIWdF/
                        </p>
                      </div>
                      <Button
                        type="submit"
                        disabled={isProcessing || !videoUrl}
                        className="bg-black hover:bg-gray-900 text-white w-full rounded-full"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing {progress}%
                          </>
                        ) : (
                          <>Analyze</>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="meta" className="p-6 m-0">
                    <form onSubmit={handleUrlSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="meta-url" className="block text-sm font-medium mb-1 text-gray-700">
                          URL Meta Ad Library
                        </label>
                        <Input
                          id="meta-url"
                          placeholder="https://www.facebook.com/ads/library/..."
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          className="bg-white border-gray-200 focus:border-black focus:ring-black text-black"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Exemple: https://www.facebook.com/ads/library/?id=123456789
                        </p>
                      </div>
                      <Button
                        type="submit"
                        disabled={isProcessing || !videoUrl}
                        className="bg-black hover:bg-gray-900 text-white w-full rounded-full"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing {progress}%
                          </>
                        ) : (
                          <>Analyze</>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="upload" className="p-6 m-0">
                    <form onSubmit={handleUploadSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="video-upload" className="block text-sm font-medium mb-1 text-gray-700">
                          Upload a video file
                        </label>
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-black transition-colors cursor-pointer bg-gray-50">
                          <Input
                            id="video-upload"
                            type="file"
                            accept="video/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <label htmlFor="video-upload" className="cursor-pointer">
                            <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600">Drag and drop or click to upload</p>
                            <p className="text-xs text-gray-400 mt-1">MP4, MOV or AVI up to 100MB</p>
                          </label>
                        </div>
                      </div>
                      {uploadedFile && (
                        <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                          <p className="text-sm text-gray-700 flex items-center">
                            <FileText className="h-4 w-4 mr-2 text-gray-500" />
                            {uploadedFile.name}
                          </p>
                        </div>
                      )}
                      <Button
                        type="submit"
                        disabled={isProcessing || !uploadedFile}
                        className="bg-black hover:bg-gray-900 text-white w-full rounded-full"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing {progress}%
                          </>
                        ) : (
                          <>Upload & Analyze</>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                {isProcessing && (
                  <div className="p-6 pt-0">
                    <Progress value={progress} className="h-1 bg-gray-100" />
                    <div className="flex justify-between mt-2 text-xs text-gray-400">
                      <span className={isVideoUploaded ? "text-black font-medium" : ""}>Video Retrieval</span>
                      <span className={isTranscriptionDone ? "text-black font-medium" : ""}>Content Analysis</span>
                      <span className={isAnalysisDone ? "text-black font-medium" : ""}>Report Generation</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {isVideoUploaded && videoMetadata && (
              <Card className="bg-white border-gray-200 shadow-sm rounded-2xl overflow-hidden mb-6">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-black">Video Preview</CardTitle>
                    {isProcessing ? (
                      <Badge className="bg-blue-50 text-blue-600 border-blue-100 px-3 rounded-full">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Processing
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800 border-gray-200 px-3 rounded-full">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ready
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-gray-500">
                    Preview of your uploaded video
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative aspect-video bg-black">
                    <video
                      ref={videoRef}
                      src={videoMetadata.url}
                      className="w-full h-full object-contain"
                      controls={false}
                      onLoadedMetadata={handleLoadedMetadata}
                      muted={isMuted}
                      playsInline
                    ></video>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {!isPlaying ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-full w-12 h-12"
                          onClick={togglePlay}
                        >
                          <Play className="h-5 w-5" />
                        </Button>
                      ) : null}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-3 bg-gradient-to-t from-black/50 to-transparent">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20 rounded-full w-8 h-8"
                        onClick={togglePlay}
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full"
                          style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                        ></div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20 rounded-full w-8 h-8"
                        onClick={toggleMute}
                      >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20 rounded-full w-8 h-8"
                        onClick={toggleFullscreen}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
                    <div className="p-4 text-center">
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="text-lg font-mono text-black">{formatDuration(realMetadata?.duration || 0)}</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-xs text-gray-500">Format</p>
                      <p className="text-lg font-mono text-black">{realMetadata?.format || ''}</p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-xs text-gray-500">Size</p>
                      <p className="text-lg font-mono text-black">{realMetadata?.size || ''}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Output Section */}
          <div>
            {/* Display initial loading state when no elements are available yet */}
            {isProcessing && !isVideoUploaded && (
              <Card className="bg-white border-gray-200 shadow-sm rounded-2xl overflow-hidden h-full">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="flex items-center gap-2 text-black">Processing</CardTitle>
                  <CardDescription className="text-gray-500">
                    Please wait while your video is being processed
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center p-12 h-full">
                  <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-6 relative">
                    <Loader2 className="h-12 w-12 text-gray-300 animate-spin" />
                  </div>
                  <h3 className="text-xl font-medium mb-2 text-black">Retrieving Video</h3>
                  <p className="text-sm text-gray-500 max-w-md">
                    We are retrieving your video. This step may take a few moments depending on the file size.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Display an error message if the process failed */}
            {error && !isProcessing && !isVideoUploaded && (
              <Card className="bg-white border-gray-200 shadow-sm rounded-2xl overflow-hidden h-full">
                <CardHeader className="border-b border-gray-100 pb-4 bg-red-50">
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    Processing Error
                  </CardTitle>
                  <CardDescription className="text-red-600">
                    An error occurred while processing your video
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center p-12 h-full">
                  <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center mb-6">
                    <AlertCircle className="h-12 w-12 text-red-400" />
                  </div>
                  <h3 className="text-xl font-medium mb-2 text-black">Processing Failed</h3>
                  <p className="text-sm text-gray-700 max-w-md mb-4">
                    {error}
                  </p>
                  <Button 
                    variant="outline" 
                    className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => resetState()}
                  >
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}

            {isTranscriptionDone && transcription && (
              <Card className="bg-white border-gray-200 shadow-sm rounded-2xl overflow-hidden mb-6">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-black">Transcription</CardTitle>
                    {isProcessing && !isAnalysisDone ? (
                      <Badge className="bg-blue-50 text-blue-600 border-blue-100 px-3 rounded-full">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Analyzing Content
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800 border-gray-200 px-3 rounded-full">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-gray-500">
                    Video content transcription
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium text-black flex items-center gap-2">Transcription</h3>
                    <Select defaultValue={selectedLanguage || 'fr'} onValueChange={handleLanguageChange}>
                      <SelectTrigger className="w-[140px] bg-white border-gray-200 text-gray-700">
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        {transcription && transcription.language ? (
                          <>
                            {/* Place original language first */}
                            {transcription.language.substring(0, 2) === 'fr' && (
                              <SelectItem value="fr">French (Original)</SelectItem>
                            )}
                            {transcription.language.substring(0, 2) === 'en' && (
                              <SelectItem value="en">English (Original)</SelectItem>
                            )}
                            {transcription.language.substring(0, 2) === 'es' && (
                              <SelectItem value="es">Spanish (Original)</SelectItem>
                            )}
                            {transcription.language.substring(0, 2) === 'de' && (
                              <SelectItem value="de">German (Original)</SelectItem>
                            )}
                            {transcription.language.substring(0, 2) === 'it' && (
                              <SelectItem value="it">Italian (Original)</SelectItem>
                            )}
                            {transcription.language.substring(0, 2) === 'zh' && (
                              <SelectItem value="zh">Chinese (Original)</SelectItem>
                            )}
                            
                            {/* Add other languages */}
                            {transcription.language.substring(0, 2) !== 'fr' && (
                              <SelectItem value="fr">French</SelectItem>
                            )}
                            {transcription.language.substring(0, 2) !== 'en' && (
                              <SelectItem value="en">English</SelectItem>
                            )}
                            {transcription.language.substring(0, 2) !== 'es' && (
                              <SelectItem value="es">Spanish</SelectItem>
                            )}
                            {transcription.language.substring(0, 2) !== 'de' && (
                              <SelectItem value="de">German</SelectItem>
                            )}
                            {transcription.language.substring(0, 2) !== 'it' && (
                              <SelectItem value="it">Italian</SelectItem>
                            )}
                            {transcription.language.substring(0, 2) !== 'zh' && (
                              <SelectItem value="zh">Chinese</SelectItem>
                            )}
                          </>
                        ) : (
                          <>
                            <SelectItem value="fr">French</SelectItem>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Spanish</SelectItem>
                            <SelectItem value="de">German</SelectItem>
                            <SelectItem value="it">Italian</SelectItem>
                            <SelectItem value="zh">Chinese</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="bg-gray-50 rounded-md border border-gray-200 p-4">
                    <Textarea
                      readOnly
                      className="min-h-[120px] bg-transparent border-0 p-0 focus-visible:ring-0 text-gray-700"
                      value={getDisplayText()}
                      key={`transcription-${selectedLanguage}`}
                    />
                    {isTranslating && (
                      <div className="mt-2 text-sm text-blue-600 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Translation in progress...
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-end mt-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-500 hover:text-black gap-1"
                      onClick={() => navigator.clipboard.writeText(getDisplayText())}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isAnalysisDone && analysis && (
              <Card className="bg-white border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-black">AI Analysis</CardTitle>
                    <Badge className="bg-gray-100 text-gray-800 border-gray-200 px-3 rounded-full">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-500">
                    Video content analysis
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {analysis?.targetAudience && (
                      <div className="bg-gray-50 rounded-md border border-gray-200 p-4">
                        <h4 className="text-sm font-medium text-black mb-1">Target Audience</h4>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-black rounded-full" 
                              style={{ width: `${analysis.targetAudience.score * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-mono text-gray-500">{Math.round(analysis.targetAudience.score * 100)}%</span>
                        </div>
                        {analysis.targetAudience.elements.length > 0 && (
                          <div className="mt-0">
                            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
                              {getUniqueElements(analysis.targetAudience.elements).map((element, index) => (
                                <li key={index} className="prose prose-sm max-w-none" 
                                    dangerouslySetInnerHTML={{ __html: formatHtmlContent(element) }} />
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-md border border-gray-200 p-4">
                      <h4 className="text-sm font-medium text-black mb-1">Message Clarity</h4>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-black rounded-full"
                            style={{ width: `${analysis.narrativeStructure.score * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono text-gray-500">{Math.round(analysis.narrativeStructure.score * 100)}%</span>
                      </div>
                      {analysis.narrativeStructure.elements.length > 0 && (
                        <div className="mt-0">
                          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
                            {getUniqueElements(analysis.narrativeStructure.elements).map((element, index) => (
                              <li key={index} className="prose prose-sm max-w-none" 
                                  dangerouslySetInnerHTML={{ __html: formatHtmlContent(element) }} />
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-md border border-gray-200 p-4">
                      <h4 className="text-sm font-medium text-black mb-1">Call to Action</h4>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-black rounded-full"
                            style={{ width: `${analysis.callToAction.score * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono text-gray-500">{Math.round(analysis.callToAction.score * 100)}%</span>
                      </div>
                      {analysis.callToAction.elements.length > 0 && (
                        <div className="mt-0">
                          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
                            {getUniqueElements(analysis.callToAction.elements).map((element, index) => (
                              <li key={index} className="prose prose-sm max-w-none" 
                                  dangerouslySetInnerHTML={{ __html: formatHtmlContent(element) }} />
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-md border border-gray-200 p-4">
                      <h4 className="text-sm font-medium text-black mb-1">Tone and Style</h4>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-black rounded-full" 
                            style={{ width: `${analysis.storytelling.score * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono text-gray-500">{Math.round(analysis.storytelling.score * 100)}%</span>
                      </div>
                      {analysis.storytelling.elements.length > 0 && (
                        <div className="mt-0">
                          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
                            {getUniqueElements(analysis.storytelling.elements).map((element, index) => (
                              <li key={index} className="prose prose-sm max-w-none" 
                                  dangerouslySetInnerHTML={{ __html: formatHtmlContent(element) }} />
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {analysis?.emotionalTriggers && (
                      <div className="bg-gray-50 rounded-md border border-gray-200 p-4">
                        <h4 className="text-sm font-medium text-black mb-1">Emotional Triggers</h4>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-black rounded-full" 
                              style={{ width: `${analysis.emotionalTriggers.score * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-mono text-gray-500">{Math.round(analysis.emotionalTriggers.score * 100)}%</span>
                        </div>
                        {analysis.emotionalTriggers.elements.length > 0 && (
                          <div className="mt-0">
                            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
                              {getUniqueElements(analysis.emotionalTriggers.elements).map((element, index) => (
                                <li key={index} className="prose prose-sm max-w-none" 
                                    dangerouslySetInnerHTML={{ __html: formatHtmlContent(element) }} />
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => handleExport('pdf')}
                      className="bg-black hover:bg-gray-900 text-white rounded-full flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export as PDF
                    </Button>
                    <Button
                      onClick={() => handleExport('gdocs')}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-full flex-1"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Export to Google Docs
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 