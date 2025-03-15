'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

export default function TestApifyPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Déterminer la source en fonction de l'URL
      const source = url.includes('facebook.com') ? 'facebook' : 
                     url.includes('instagram.com') ? 'instagram' : 
                     'unknown';
      
      if (source === 'unknown') {
        throw new Error('URL non reconnue. Veuillez utiliser une URL Facebook ou Instagram.');
      }

      // Appeler l'API d'extraction
      const response = await fetch('/api/extract-meta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, source }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'extraction de la vidéo');
      }

      setResult(data);
    } catch (err: any) {
      console.error('Erreur:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Test d'extraction Apify</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Extraire une vidéo</CardTitle>
          <CardDescription>
            Entrez une URL Facebook ou Instagram pour extraire la vidéo associée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="url">URL de la vidéo</Label>
                <Input
                  id="url"
                  placeholder="https://www.facebook.com/ads/library/?id=123456789"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Extraction en cours...' : 'Extraire la vidéo'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Résultat de l'extraction</CardTitle>
            <CardDescription>
              Vidéo extraite avec succès
              <Badge className="ml-2">{result.video.source}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {result.video.url && (
                <div>
                  <h3 className="font-medium mb-2">Aperçu de la vidéo :</h3>
                  <video 
                    controls 
                    className="w-full rounded-md border"
                    src={result.video.url}
                    poster={result.video.thumbnailUrl}
                    preload="metadata"
                  >
                    Votre navigateur ne prend pas en charge la lecture vidéo.
                  </video>
                </div>
              )}
              
              <div>
                <h3 className="font-medium mb-2">Informations :</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Titre :</div>
                  <div>{result.video.title || 'Non disponible'}</div>
                  
                  <div className="font-medium">Taille :</div>
                  <div>{result.video.size}</div>
                  
                  <div className="font-medium">Format :</div>
                  <div>{result.video.format}</div>
                  
                  <div className="font-medium">Durée :</div>
                  <div>{result.video.duration}</div>
                  
                  <div className="font-medium">URL d'origine :</div>
                  <div className="truncate">
                    <a 
                      href={result.video.originalUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {result.video.originalUrl}
                    </a>
                  </div>
                </div>
              </div>
              
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="metadata">
                  <AccordionTrigger>Métadonnées détaillées</AccordionTrigger>
                  <AccordionContent>
                    <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-xs">
                      {JSON.stringify(result.video.metadata, null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setResult(null)}>
              Effacer
            </Button>
            {result.video.url && (
              <Button asChild>
                <a 
                  href={result.video.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  download
                >
                  Télécharger
                </a>
              </Button>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
} 