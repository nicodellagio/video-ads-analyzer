'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, Upload, FileText, RefreshCw } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function DebugUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Réinitialiser les états précédents
      setResult(null);
      setError(null);
      setLogs([]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Veuillez sélectionner un fichier");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setLogs([]);

      // Ajouter le premier log
      addLog("Début du téléchargement...");

      const formData = new FormData();
      formData.append('file', file);

      // Envoyer la requête
      addLog(`Envoi du fichier: ${file.name} (${formatFileSize(file.size)})`);
      
      const response = await fetch('/api/debug-upload', {
        method: 'POST',
        body: formData,
      });

      // Analyser la réponse
      const data = await response.json();
      
      // Ajouter les logs du serveur
      if (data.logs && Array.isArray(data.logs)) {
        setLogs(prev => [...prev, ...data.logs]);
      }
      
      setResult(data);
      
      if (!response.ok || !data.success) {
        setError(data.error || "Erreur lors du téléchargement");
        addLog(`ERREUR: ${data.error || "Erreur inconnue"}`);
      } else {
        addLog("Téléchargement terminé avec succès");
      }
      
    } catch (err) {
      const errorMessage = `Erreur lors de la requête: ${(err as Error).message}`;
      setError(errorMessage);
      addLog(`ERREUR: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setLogs([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()} - ${message}`]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  const formatLogLevel = (log: string): { level: 'info' | 'error' | 'success'; message: string } => {
    const lowerLog = log.toLowerCase();
    if (lowerLog.includes('erreur')) {
      return { level: 'error', message: log };
    } else if (lowerLog.includes('succès') || lowerLog.includes('terminé avec succès')) {
      return { level: 'success', message: log };
    }
    return { level: 'info', message: log };
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Débogage du téléchargement de vidéo</CardTitle>
          <CardDescription>
            Outil pour tester et déboguer le processus complet de téléchargement et traitement de vidéo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="mb-6">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer bg-gray-50">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer block">
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">Glissez-déposez ou cliquez pour télécharger une vidéo</p>
                <p className="text-xs text-gray-400 mt-1">MP4, MOV ou AVI jusqu'à 100MB</p>
              </label>
            </div>
          </div>

          {file && (
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200 flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-2 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)} · {file.type}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 text-gray-500">
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex space-x-4">
            <Button 
              onClick={handleUpload} 
              disabled={loading || !file}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Téléchargement en cours...
                </>
              ) : (
                <>Déboguer le téléchargement</>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={resetForm}
              disabled={loading}
              className="w-auto"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {logs.length > 0 && (
            <div className="mt-6 border rounded-md overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 border-b">
                <h3 className="text-sm font-medium">Logs de débogage</h3>
              </div>
              <div className="h-80 overflow-y-auto p-4 bg-gray-50 space-y-1">
                {logs.map((log, index) => {
                  const { level, message } = formatLogLevel(log);
                  return (
                    <div 
                      key={index} 
                      className={`text-xs font-mono p-1 rounded ${
                        level === 'error' 
                          ? 'text-red-800 bg-red-50' 
                          : level === 'success' 
                            ? 'text-green-800 bg-green-50' 
                            : 'text-gray-800'
                      }`}
                    >
                      {message}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result && result.success && (
            <Accordion type="single" collapsible className="mt-6">
              <AccordionItem value="metadata">
                <AccordionTrigger className="text-sm font-medium">
                  Métadonnées de la vidéo
                </AccordionTrigger>
                <AccordionContent>
                  <pre className="text-xs bg-gray-50 p-4 rounded-md overflow-x-auto">
                    {JSON.stringify(result.videoMetadata, null, 2)}
                  </pre>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="environment">
                <AccordionTrigger className="text-sm font-medium">
                  Informations sur l'environnement
                </AccordionTrigger>
                <AccordionContent>
                  <div className="text-xs grid grid-cols-2 gap-2 bg-gray-50 p-4 rounded-md">
                    <div className="font-medium">Utilisation de S3:</div>
                    <div>{result.environment?.useS3Storage ? 'Oui' : 'Non'}</div>
                    
                    <div className="font-medium">Clé d'accès AWS:</div>
                    <div>{result.environment?.hasAwsAccessKey ? 'Configurée' : 'Non configurée'}</div>
                    
                    <div className="font-medium">Clé secrète AWS:</div>
                    <div>{result.environment?.hasAwsSecretKey ? 'Configurée' : 'Non configurée'}</div>
                    
                    <div className="font-medium">Bucket AWS:</div>
                    <div>{result.environment?.hasAwsBucket ? 'Configuré' : 'Non configuré'}</div>
                    
                    <div className="font-medium">Environnement Node:</div>
                    <div>{result.environment?.nodeEnv || 'Non défini'}</div>
                    
                    <div className="font-medium">Déployé sur Vercel:</div>
                    <div>{result.environment?.isVercel ? 'Oui' : 'Non'}</div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardContent>
        <CardFooter className="text-xs text-gray-500 flex justify-between">
          <div>
            Cet outil de débogage vous aide à identifier les problèmes de téléchargement de vidéos.
          </div>
          {result && result.success && (
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Terminé avec succès
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
} 