#!/bin/bash

# Script de déploiement pour Video Ads Analyzer sur AWS

# Définition des variables
STACK_NAME="video-ads-analyzer"
BUCKET_NAME="video-ads-analyzer-storage"
REGION="eu-north-1"
APPLICATION_ARN="arn:aws:resource-groups:eu-north-1:897722698206:group/VideoAds_Analyzer/08i6plqg6mgngt3xsqar3uqzoj"
TEMPLATE_FILE="cloudformation.yaml"

# Vérifier si AWS CLI est installé
if ! command -v aws &> /dev/null
then
    echo "AWS CLI n'est pas installé. Veuillez l'installer."
    exit 1
fi

# Vérifier si les crédentials sont configurés
if ! aws sts get-caller-identity &> /dev/null
then
    echo "Veuillez configurer vos crédentials AWS avec 'aws configure'"
    exit 1
fi

echo "Déploiement du stack CloudFormation..."

# Déployer le stack CloudFormation
aws cloudformation deploy \
  --stack-name $STACK_NAME \
  --template-file $TEMPLATE_FILE \
  --parameter-overrides BucketName=$BUCKET_NAME \
  --capabilities CAPABILITY_IAM \
  --region $REGION \
  --tags awsApplication=$APPLICATION_ARN

if [ $? -eq 0 ]; then
  echo "Déploiement réussi!"
  
  # Récupérer les informations du bucket
  BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
  BUCKET_ARN=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION --query "Stacks[0].Outputs[?OutputKey=='BucketARN'].OutputValue" --output text)
  
  echo "Bucket S3 créé: $BUCKET_NAME"
  echo "ARN du bucket: $BUCKET_ARN"
  
  # Mettre à jour .env.local avec le bon nom de bucket
  if [ -f "../.env.local" ]; then
    sed -i '' "s|AWS_S3_BUCKET_NAME=.*|AWS_S3_BUCKET_NAME=$BUCKET_NAME|g" "../.env.local" 
    echo "Fichier .env.local mis à jour avec le nom du bucket."
  else
    echo "ATTENTION: Le fichier .env.local n'existe pas. Veuillez le créer et y ajouter:"
    echo "AWS_S3_BUCKET_NAME=$BUCKET_NAME"
  fi
  
  echo ""
  echo "N'oubliez pas de configurer les variables d'environnement sur Vercel:"
  echo "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET_NAME et AWS_APPLICATION_ARN"
else
  echo "Erreur lors du déploiement."
  exit 1
fi 