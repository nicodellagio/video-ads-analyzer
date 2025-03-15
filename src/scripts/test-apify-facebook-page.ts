import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN || '';
const FACEBOOK_PAGE_SCRAPER_ID = 'JJghSZmShuco4j9gJ';

// Vérifier que le token API est présent
if (!APIFY_API_TOKEN) {
  console.error('APIFY_API_TOKEN non configuré dans les variables d\'environnement');
  process.exit(1);
}

// Initialiser le client Apify
const client = new ApifyClient({
  token: APIFY_API_TOKEN,
});

/**
 * Script de test pour l'extraction de données d'une page Facebook
 */
async function testFacebookPageScraper() {
  try {
    // URL de la page Facebook à tester (remplacez par votre URL)
    const testUrl = "https://www.facebook.com/drive4quantix/?ref=page_internal";
    
    console.log(`Extraction des données pour: ${testUrl}`);
    
    // Préparer l'entrée pour l'acteur
    const input = {
      startUrls: [{ url: testUrl }],
      resultsLimit: 99999,
      activeStatus: ""
    };
    
    // Exécuter l'acteur
    console.log(`Lancement de l'acteur ${FACEBOOK_PAGE_SCRAPER_ID}...`);
    const run = await client.actor(FACEBOOK_PAGE_SCRAPER_ID).call(input);
    
    console.log(`Exécution terminée, ID du dataset: ${run.defaultDatasetId}`);
    
    // Récupérer les résultats
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    if (items.length === 0) {
      console.log('Aucun résultat trouvé');
      return;
    }
    
    // Afficher le nombre d'éléments récupérés
    console.log(`${items.length} élément(s) récupéré(s)`);
    
    // Enregistrer les résultats dans un fichier JSON pour analyse
    const outputFile = path.resolve(process.cwd(), 'facebook-page-data.json');
    fs.writeFileSync(outputFile, JSON.stringify(items, null, 2), 'utf-8');
    
    console.log(`Résultats enregistrés dans: ${outputFile}`);
    
    // Analyser les données pour trouver les vidéos
    let videosFound = 0;
    
    items.forEach((item, index) => {
      console.log(`\nÉlément #${index + 1}:`);
      console.log(`- Nom: ${item.name || 'N/A'}`);
      console.log(`- Type: ${item.type || 'N/A'}`);
      
      // Chercher les vidéos dans différents emplacements
      if (item.videos && item.videos.length > 0) {
        console.log(`- Vidéos trouvées: ${item.videos.length}`);
        
        item.videos.forEach((video: any, vIndex: number) => {
          console.log(`  Vidéo #${vIndex + 1}: ${video.url || 'URL non disponible'}`);
          videosFound++;
        });
      } else if (item.posts) {
        let postVideos = 0;
        
        item.posts.forEach((post: any, pIndex: number) => {
          if (post.videoUrl) {
            console.log(`  Post #${pIndex + 1} contient une vidéo: ${post.videoUrl}`);
            postVideos++;
            videosFound++;
          }
        });
        
        if (postVideos > 0) {
          console.log(`- Vidéos trouvées dans les posts: ${postVideos}`);
        } else {
          console.log('- Aucune vidéo trouvée dans les posts');
        }
      } else {
        console.log('- Aucune vidéo trouvée directement');
      }
    });
    
    console.log(`\nRésumé: ${videosFound} vidéo(s) trouvée(s) au total`);
    
  } catch (error) {
    console.error('Erreur lors de l\'extraction:', error);
  }
}

// Exécuter le script
testFacebookPageScraper()
  .then(() => console.log('Script terminé'))
  .catch(err => console.error('Erreur:', err)); 