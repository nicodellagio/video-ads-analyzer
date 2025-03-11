# Video Ad Analyzer

Une application web moderne pour analyser les vidéos publicitaires à partir de différentes sources (Instagram, Meta Ads Library, téléchargement direct) et générer des analyses détaillées sur leur contenu, leur structure narrative et leur efficacité.

## Fonctionnalités

- **Extraction de vidéos** à partir d'URLs Instagram et Meta Ads Library
- **Téléchargement direct** de fichiers vidéo (jusqu'à 100MB)
- **Transcription automatique** du contenu audio
- **Analyse IA** du contenu publicitaire avec évaluation de :
  - Storytelling
  - Appel à l'action
  - Structure narrative
  - Public cible
  - Déclencheurs émotionnels
- **Exportation des rapports** en PDF ou Google Docs
- **Interface utilisateur intuitive** avec visualisation des résultats

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/votre-username/video-ads-v1.git
cd video-ads-v1

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés API
```

## Configuration

Créez un fichier `.env.local` à la racine du projet avec les variables suivantes :

```
# API Keys
OPENAI_API_KEY=votre_clé_openai
CLOUDINARY_CLOUD_NAME=votre_cloud_name
CLOUDINARY_API_KEY=votre_api_key
CLOUDINARY_API_SECRET=votre_api_secret

# Configuration
MAX_FILE_SIZE=104857600  # 100MB en octets
```

## Configuration des API Meta (Facebook et Instagram)

Pour utiliser les fonctionnalités d'extraction de vidéos à partir de Facebook et Instagram, vous devez configurer les API Meta :

1. **Créer un compte développeur Meta** :
   - Rendez-vous sur [Meta for Developers](https://developers.facebook.com/)
   - Inscrivez-vous en tant que développeur
   - Acceptez les conditions d'utilisation

2. **Créer une application** :
   - Dans le tableau de bord, cliquez sur "Créer une application"
   - Sélectionnez le type d'application "Business"
   - Remplissez les informations requises

3. **Configurer les produits** :
   - Ajoutez les produits suivants à votre application :
     - Facebook Login
     - Instagram Graph API
     - Pages API

4. **Obtenir les tokens d'accès** :
   - Pour Facebook : Générez un token d'accès de page à longue durée
   - Pour Instagram : Connectez un compte Instagram professionnel et générez un token d'accès

5. **Configurer les variables d'environnement** :
   - Ajoutez les tokens et identifiants dans votre fichier `.env.local` :
   ```
   META_APP_ID=votre_app_id
   META_APP_SECRET=votre_app_secret
   META_ACCESS_TOKEN=votre_access_token
   META_BUSINESS_ACCOUNT_ID=votre_business_account_id
   INSTAGRAM_USER_ID=votre_instagram_user_id
   INSTAGRAM_ACCESS_TOKEN=votre_instagram_access_token
   FACEBOOK_PAGE_ID=votre_facebook_page_id
   FACEBOOK_ACCESS_TOKEN=votre_facebook_access_token
   ```

## Développement

```bash
# Lancer le serveur de développement
npm run dev

# Ouvrir http://localhost:3000
```

## Structure du projet

```
/video-ads-v1/
  ├── src/
  │   ├── app/                  # Routes Next.js
  │   │   ├── api/              # API Routes
  │   │   │   ├── analyze/      # Analyse IA du contenu
  │   │   │   ├── export/       # Exportation des rapports
  │   │   │   ├── extract/      # Extraction de vidéos
  │   │   │   ├── transcribe/   # Transcription audio
  │   │   │   └── upload/       # Téléchargement de fichiers
  │   │   ├── page.tsx          # Page d'accueil
  │   │   └── layout.tsx        # Layout principal
  │   ├── components/           # Composants React
  │   │   ├── analyzer/         # Composants d'analyse
  │   │   └── ui/               # Composants d'interface
  │   └── lib/                  # Utilitaires et services
  │       ├── context/          # Contextes React
  │       ├── services/         # Services API
  │       └── utils.ts          # Fonctions utilitaires
  └── public/                   # Fichiers statiques
```

## Prochaines étapes

- [ ] Intégration avec youtube-dl pour l'extraction de vidéos
- [ ] Intégration avec OpenAI Whisper pour la transcription
- [ ] Intégration avec GPT-4/Claude pour l'analyse
- [ ] Configuration du stockage cloud avec Cloudinary/S3
- [ ] Mise en place d'une base de données pour stocker les analyses
- [ ] Système d'authentification utilisateur
- [ ] Déploiement sur Vercel

## Licence

MIT
