'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function TestMimePage() {
  const [videoUrl, setVideoUrl] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    if (!videoUrl) {
      setError('Veuillez saisir une URL vidéo');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await fetch('/api/test-mime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl }),
      });

      const data = await response.json();
      setResult(data);
      
      if (!response.ok || !data.success) {
        setError(data.error || 'Erreur lors du test');
      }
    } catch (err) {
      setError(`Erreur lors de la requête: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Test de MIME Type</CardTitle>
          <CardDescription>
            Vérifier si une vidéo a un format compatible avec l'API OpenAI Whisper
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="video-url" className="text-sm font-medium">
              URL de la vidéo ou identifiant S3
            </label>
            <Input
              id="video-url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://example.com/video.mp4 ou 12345.mp4"
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Entrez l'URL complète de la vidéo ou simplement l'identifiant du fichier
            </p>
          </div>

          <Button 
            onClick={handleTest} 
            disabled={loading || !videoUrl}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Test en cours...
              </>
            ) : (
              'Tester le format de la vidéo'
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && result.success && (
            <div className="space-y-4 mt-4">
              <Alert 
                variant={result.isOriginalTypeAccepted && result.isExtensionAccepted ? "default" : "warning"}
                className={result.isOriginalTypeAccepted && result.isExtensionAccepted ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}
              >
                {result.isOriginalTypeAccepted && result.isExtensionAccepted ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
                <AlertTitle>
                  {result.isOriginalTypeAccepted && result.isExtensionAccepted 
                    ? "Format compatible" 
                    : "Format potentiellement incompatible"}
                </AlertTitle>
                <AlertDescription>
                  {result.isOriginalTypeAccepted && result.isExtensionAccepted 
                    ? "Le format de ce fichier devrait être compatible avec l'API OpenAI Whisper."
                    : "Le format de ce fichier pourrait nécessiter des ajustements pour l'API OpenAI Whisper."}
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 p-4 rounded-md space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Informations du fichier</h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="font-medium text-gray-700">Nom:</span>
                    <span className="col-span-2">{result.fileName || 'Non disponible'}</span>
                    
                    <span className="font-medium text-gray-700">Taille:</span>
                    <span className="col-span-2">{result.fileSize || 'Non disponible'}</span>
                    
                    <span className="font-medium text-gray-700">Extension:</span>
                    <span className="col-span-2 flex items-center gap-1">
                      {result.fileExtension || 'Non disponible'}
                      {result.isExtensionAccepted ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs ml-2">Compatible</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs ml-2">Non compatible</Badge>
                      )}
                    </span>
                    
                    <span className="font-medium text-gray-700">Type MIME original:</span>
                    <span className="col-span-2 flex items-center gap-1">
                      {result.originalContentType}
                      {result.isOriginalTypeAccepted ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs ml-2">Compatible</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs ml-2">Non compatible</Badge>
                      )}
                    </span>
                    
                    <span className="font-medium text-gray-700">Type MIME suggéré:</span>
                    <span className="col-span-2">{result.suggestedMimeType}</span>
                  </div>
                </div>

                {result.recommendations && result.recommendations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Recommandations</h3>
                    <ul className="list-disc pl-4 text-sm space-y-1">
                      {result.recommendations.map((recommendation: string, i: number) => (
                        <li key={i} className="text-gray-700">{recommendation}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium mb-2">Types MIME acceptés par OpenAI</h3>
                  <div className="flex flex-wrap gap-1 text-xs">
                    {result.acceptedMimeTypes?.map((type: string) => (
                      <Badge 
                        key={type} 
                        variant="outline" 
                        className={type === result.originalContentType 
                          ? "bg-green-50 text-green-700 border-green-200" 
                          : "bg-gray-50"
                        }
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Extensions acceptées par OpenAI</h3>
                  <div className="flex flex-wrap gap-1 text-xs">
                    {result.acceptedExtensions?.map((ext: string) => (
                      <Badge 
                        key={ext} 
                        variant="outline" 
                        className={ext === result.fileExtension 
                          ? "bg-green-50 text-green-700 border-green-200" 
                          : "bg-gray-50"
                        }
                      >
                        .{ext}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="text-xs text-gray-500">
          Cet outil est destiné à vérifier si une vidéo est dans un format compatible avec l'API OpenAI Whisper pour la transcription.
        </CardFooter>
      </Card>
    </div>
  );
} 