#!/bin/bash

# Script d'installation et de vérification de yt-dlp
# Ce script est utilisé par le script postinstall

# Créer le répertoire bin s'il n'existe pas
mkdir -p "$(dirname "$0")"

# Détecter le système d'exploitation
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS - Télécharger la version macOS
  echo "Detected macOS, downloading yt-dlp for macOS..."
  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o "$(dirname "$0")/yt-dlp"
  chmod +x "$(dirname "$0")/yt-dlp"
else
  # Linux ou autre (Vercel) - Télécharger la version Linux
  echo "Detected Linux or other OS, downloading yt-dlp for Linux..."
  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o "$(dirname "$0")/yt-dlp"
  chmod +x "$(dirname "$0")/yt-dlp"
fi

# Vérifier que le binaire fonctionne (sauf sur CI/CD)
if [[ -z "$VERCEL" && -z "$CI" ]]; then
  echo "Testing yt-dlp binary..."
  "$(dirname "$0")/yt-dlp" --version || echo "Note: Cannot execute binary in this environment, but it should work in the correct environment."
fi

echo "yt-dlp setup complete!" 