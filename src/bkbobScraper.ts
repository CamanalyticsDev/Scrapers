import puppeteer, { Browser, Page } from 'puppeteer';
import dotenv from 'dotenv';
import { getRefundsLinks } from './refundsDone';

dotenv.config();

const USERNAME: string = process.env.BKBOB_USERNAME || '165156';
const PASSWORD: string = process.env.BKBOB_PASSWORD || '654654';

export async function loginToBKBob(): Promise<{browser: Browser, page: Page}> {
  console.log('Démarrage de la connexion à BKBob...');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('Navigation vers https://www.bkbob.fr/');
    await page.goto('https://www.bkbob.fr/', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);
    
    console.log('Saisie des identifiants...');
    await page.type('input[name="email"]', USERNAME);
    await page.type('input[type="password"]', PASSWORD);
    
    console.log('Clic sur le bouton de connexion...');
    await page.click('button[type="submit"]');
    
    await page.waitForNavigation({ waitUntil: 'networkidle2' })
      .catch(() => console.log('Connexion terminée'));
    
    console.log('Le navigateur reste ouvert pour navigation.');
    
    return { browser, page };
  } catch (error) {
    console.error('Erreur:', error);
    await browser.close();
    throw error;
  }
}

async function main(): Promise<void> {
  let browser: Browser | undefined;
  
  try {
    // Connexion à BKBob
    const { browser: puppeteerBrowser, page } = await loginToBKBob();
    browser = puppeteerBrowser;
    
    // Appel à la fonction de traitement des remboursements
    await getRefundsLinks(page);
    
    console.log('Traitement terminé avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'exécution:', error);
  }
}

// Si ce fichier est exécuté directement
if (require.main === module) {
  main().catch(console.error);
}