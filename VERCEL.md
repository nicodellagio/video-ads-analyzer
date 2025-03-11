# Compatibilité avec Vercel

Ce document explique les modifications apportées pour rendre l'application compatible avec le déploiement sur Vercel.

## Problème initial

Vercel a des limitations spécifiques pour le système de fichiers:

1. Le répertoire `/var/task` est en lecture seule
2. Seul le répertoire `/tmp` est accessible en écriture
3. Le système de fichiers est éphémère (les fichiers sont supprimés entre les exécutions des fonctions)

## Modifications apportées

### 1. Utilisation du répertoire temporaire

Nous avons créé une constante `TEMP_DIR` qui pointe vers `/tmp` lorsque l'application est déployée sur Vercel, et vers le répertoire local habituel en développement:

```typescript
const TEMP_DIR = process.env.VERCEL ? '/tmp' : join(process.cwd(), 'public', 'uploads');
```

### 2. Adaptation des fonctions d'extraction

Les fonctions suivantes ont été adaptées pour utiliser le répertoire temporaire:

- `extractFacebookVideo` et `extractInstagramVideo` - Création du répertoire temporaire et stockage des fichiers téléchargés
- `extractVideoWithYoutubeDl` - Utilisation de `/tmp` pour stocker les fichiers téléchargés par yt-dlp
- `downloadVideo` - Gestion améliorée de la création des répertoires temporaires

### 3. Gestion des erreurs et solutions de secours

- Ajout de vérifications supplémentaires pour l'existence des fichiers
- Création d'un endpoint `/api/placeholder/[fileName]` pour gérer les cas où un fichier ne peut pas être téléchargé
- Amélioration de la fonction `saveExtractedFile` pour gérer les cas où un fichier n'existe pas

### 4. Stockage S3

L'application utilise maintenant S3 pour le stockage des fichiers permanents lorsqu'elle est déployée sur Vercel. Les fichiers sont:

1. Téléchargés temporairement dans `/tmp`
2. Transférés vers S3
3. Supprimés du système de fichiers local

## Configuration requise

Pour que ces modifications fonctionnent correctement, assurez-vous que les variables d'environnement suivantes sont configurées dans votre projet Vercel:

```
AWS_ACCESS_KEY_ID=votre_cle_acces
AWS_SECRET_ACCESS_KEY=votre_cle_secrete
AWS_S3_BUCKET_NAME=nom_de_votre_bucket
AWS_REGION=votre_region (par défaut: eu-north-1)
VERCEL=1 (cette variable est automatiquement définie par Vercel)
```

## Notes importantes

- Les fichiers dans `/tmp` sont limités à 512 Mo au total
- Les fonctions Vercel ont une limite de temps d'exécution de 10 secondes (plan gratuit)
- Si vous utilisez un webhook ou une fonction d'API, la limite est de 60 secondes (hobby plan) 