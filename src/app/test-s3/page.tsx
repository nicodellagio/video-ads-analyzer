'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function TestS3Page() {
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

      const response = await fetch('/api/test-s3', {
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
          <CardTitle>Test d'accès S3</CardTitle>
          <CardDescription>
            Vérifier si une vidéo est correctement accessible depuis AWS S3
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
              'Tester l\'accès à la vidéo'
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="mt-4 space-y-4">
              <Alert variant={result.success ? "default" : "destructive"} className={result.success ? "bg-green-50 border-green-200" : ""}>
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>{result.success ? "Succès" : "Échec"}</AlertTitle>
                <AlertDescription>{result.message || result.error}</AlertDescription>
              </Alert>

              {result.success && (
                <div className="space-y-2 bg-gray-50 p-4 rounded-md text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium">Clé S3:</span>
                    <span className="col-span-2">{result.s3Key}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium">Type de contenu:</span>
                    <span className="col-span-2">{result.contentType || 'Non disponible'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium">Taille:</span>
                    <span className="col-span-2">
                      {result.contentLength ? `${Math.round(parseInt(result.contentLength) / 1024)} Ko` : 'Non disponible'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium">Premier fragment:</span>
                    <span className="col-span-2">{result.firstChunkSize} octets</span>
                  </div>
                  <div className="mt-4">
                    <p className="font-medium mb-2">URL signée:</p>
                    <pre className="bg-gray-100 p-2 rounded-md text-xs break-all">
                      {result.signedUrl}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="text-xs text-gray-500">
          Cet outil est destiné au débogage et vérifie si une vidéo peut être correctement récupérée depuis AWS S3.
        </CardFooter>
      </Card>
    </div>
  );
} 