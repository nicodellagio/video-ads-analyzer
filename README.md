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
- **Stockage des vidéos** sur AWS S3 en production

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/votre-username/video-ads-v1.git
cd video-ads-v1

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.local.example .env.local
# Éditer .env.local avec vos clés API
```

## Configuration

Créez un fichier `.env.local` à la racine du projet avec les variables suivantes :

```
# API Keys
OPENAI_API_KEY=votre_clé_openai

# AWS S3 Configuration (requis pour le stockage en production)
AWS_ACCESS_KEY_ID=votre_aws_access_key_id
AWS_SECRET_ACCESS_KEY=votre_aws_secret_access_key
AWS_REGION=eu-north-1
AWS_S3_BUCKET_NAME=votre_bucket_name
AWS_APPLICATION_ARN=arn:aws:resource-groups:eu-north-1:897722698206:group/VideoAds_Analyzer/08i6plqg6mgngt3xsqar3uqzoj

# Configuration
MAX_FILE_SIZE=104857600  # 100MB en octets
```

## Configuration d'AWS S3 (pour la production)

### Méthode 1: Déploiement automatisé avec CloudFormation

Nous fournissons un script de déploiement CloudFormation qui configure automatiquement toutes les ressources AWS nécessaires:

1. **Installez l'AWS CLI** si ce n'est pas déjà fait:
   - Suivez les instructions sur [la documentation AWS](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

2. **Configurez vos identifiants AWS**:
   ```bash
   aws configure
   ```
   - Entrez votre AWS Access Key ID et Secret Access Key
   - Définissez la région par défaut sur `eu-north-1`
   - Format de sortie: `json`

3. **Exécutez le script de déploiement**:
   ```bash
   cd aws
   ./deploy.sh
   ```

Ce script va:
- Créer un bucket S3 configuré pour l'application
- Configurer les autorisations nécessaires
- Associer l'application à l'ARN spécifié
- Mettre à jour votre fichier `.env.local` avec le nom du bucket

### Méthode 2: Configuration manuelle

Pour utiliser le stockage AWS S3 en production, suivez ces étapes :

1. **Créer un compte AWS** (si vous n'en avez pas déjà un)
   - Rendez-vous sur [AWS Console](https://console.aws.amazon.com/)
   - Créez un compte ou connectez-vous

2. **Créer un bucket S3** :
   - Dans la console AWS, recherchez "S3"
   - Cliquez sur "Créer un bucket"
   - Donnez un nom unique à votre bucket
   - Choisissez la région `eu-north-1` (Stockholm)
   - Configurez les paramètres selon vos besoins
   - Assurez-vous que "Block all public access" est désactivé si vous voulez que les vidéos soient publiques
   - Dans les tags, ajoutez la clé `awsApplication` avec la valeur `arn:aws:resource-groups:eu-north-1:897722698206:group/VideoAds_Analyzer/08i6plqg6mgngt3xsqar3uqzoj`
   - Créez le bucket

3. **Créer un utilisateur IAM avec les permissions S3** :
   - Dans la console AWS, recherchez "IAM"
   - Allez dans "Utilisateurs" et cliquez sur "Ajouter un utilisateur"
   - Donnez un nom (ex: video-ads-s3-user)
   - Sélectionnez "Accès programmatique"
   - Attachez une politique qui autorise l'accès S3 (AmazonS3FullAccess)
   - Terminez la création et notez l'Access Key ID et le Secret Access Key

4. **Configurer les variables d'environnement** :
   - Ajoutez les clés d'accès à votre fichier `.env.local` comme indiqué ci-dessus
   - Pour Vercel, ajoutez ces variables dans les paramètres du projet

5. **Configurer CORS pour le bucket S3** :
   - Dans les propriétés du bucket, allez dans "Permissions" > "CORS"
   - Ajoutez une configuration comme celle-ci :
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedOrigins": ["https://votre-domaine.com"],
       "ExposeHeaders": ["ETag"]
     }
   ]
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

## Déploiement sur Vercel

1. **Créer un compte Vercel** (si vous n'en avez pas)
2. **Lier votre dépôt GitHub**
3. **Configurer les variables d'environnement** :
   - Copiez toutes les variables de `.env.local` dans les paramètres du projet sur Vercel
   - Assurez-vous de configurer AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION et AWS_S3_BUCKET_NAME
4. **Déployer le projet**

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
  │       ├── services/         # Services API (S3, etc.)
  │       └── utils/            # Fonctions utilitaires
  └── public/                   # Fichiers statiques
```

## Prochaines étapes

- [x] Intégration avec youtube-dl pour l'extraction de vidéos
- [x] Intégration avec OpenAI pour l'analyse
- [x] Configuration du stockage cloud avec AWS S3
- [ ] Mise en place d'une base de données pour stocker les analyses
- [ ] Système d'authentification utilisateur
- [x] Déploiement sur Vercel

## Licence

MIT
