import puppeteer, { Browser, Page } from 'puppeteer';
import { loginToBKBob } from './bkbobScraper';

interface SimpleRefundData {
  commandCount: number;
  seeMoreLinks: string[];
}

export async function getRefundsLinks(page: Page): Promise<SimpleRefundData> {
  try {
    console.log('Navigation sur la page des réclamations...');
    await page.goto('https://www.bkbob.fr/reclamations?status=FINISHED&pickUpType=DELIVERY', { waitUntil: 'networkidle2' });
    
    // Attendre que le tableau soit chargé
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    await page.waitForTimeout(5000);
    
    // Compter le nombre de commandes
    const commandCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr.sc-gFAWRd.ggzsfO');
      let count = 0;
      
      rows.forEach((row) => {
        // Ignorer les lignes d'en-tête
        if (!row.querySelector('th') && !row.querySelector('span.sc-gEvEer.sc-gmPhUn.cHXPSh.eDRZGN')) {
          count++;
        }
      });
      
      return count;
    });
    
    // Récupérer les informations des boutons "Voir plus"
    const seeMoreButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button.sc-dhKdcB.crwTIX.sc-fxwrCY.dFcoZY');
      const buttonInfos: string[] = [];
      
      buttons.forEach((button, index) => {
        // Vérifier si le bouton est dans un lien parent
        const parentLink = button.closest('a');
        
        if (parentLink && parentLink.href) {
          buttonInfos.push(parentLink.href);
        } else {
          // Récupérer les attributs utiles du bouton
          const onclick = button.getAttribute('onclick');
          const dataId = button.getAttribute('data-id') || button.getAttribute('data-order-id') || button.getAttribute('data-command-id');
          
          if (onclick) {
            // Extraire l'URL de l'onclick s'il y en a une
            const urlMatch = onclick.match(/['"]([^'"]*)['"]/);
            if (urlMatch && urlMatch[1]) {
              buttonInfos.push(urlMatch[1]);
            } else {
              buttonInfos.push(`onclick: ${onclick}`);
            }
          } else if (dataId) {
            buttonInfos.push(`data-id: ${dataId}`);
          } else {
            buttonInfos.push(`button-index: ${index}`);
          }
        }
      });
      
      return buttonInfos;
    });
    
    console.log(`Nombre de commandes: ${commandCount}`);
    console.log(`Nombre de boutons "Voir plus": ${seeMoreButtons.length}`);
    
    return {
      commandCount,
      seeMoreLinks: seeMoreButtons
    };
    
  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    throw error;
  }
}

async function clickAllSeeMoreButtons(page: Page): Promise<void> {
  try {
    // Attendre que les boutons "Voir plus" soient chargés
    await page.waitForSelector('button.sc-dhKdcB.crwTIX.sc-fxwrCY.dFcoZY', { timeout: 10000 });
    
    // Récupérer tous les boutons "Voir plus"
    const buttons = await page.$$('button.sc-dhKdcB.crwTIX.sc-fxwrCY.dFcoZY');
    console.log(`Nombre total de boutons "Voir plus" trouvés: ${buttons.length}`);
    
    // Cliquer sur chaque bouton et revenir en arrière
    for (let i = 0; i < buttons.length; i++) {
      console.log(`Clic sur le bouton "Voir plus" ${i + 1}/${buttons.length}`);
      
      // Cliquer sur le bouton
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        buttons[i].click()
      ]);
      
      // Simuler une pause pour observer la page (trou pour l'instant)
      console.log(`  Page ${i + 1} visitée avec succès`);
      await page.waitForTimeout(1000);
      
      // Revenir en arrière
      console.log(`  Retour à la page précédente`);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.goBack()
      ]);
      
      // Récupérer à nouveau les boutons car la référence DOM a changé après navigation
      if (i < buttons.length - 1) {
        await page.waitForSelector('button.sc-dhKdcB.crwTIX.sc-fxwrCY.dFcoZY', { timeout: 10000 });
        const refreshedButtons = await page.$$('button.sc-dhKdcB.crwTIX.sc-fxwrCY.dFcoZY');
        buttons[i+1] = refreshedButtons[i+1];
      }
    }
    
    console.log('Navigation sur tous les boutons "Voir plus" terminée');
  } catch (error) {
    console.error('Erreur lors de la navigation des boutons "Voir plus":', error);
    throw error;
  }
}

export async function getSimpleRefundsData(): Promise<SimpleRefundData> {
  let browser: Browser | undefined;
  
  try {
    const { browser: puppeteerBrowser, page } = await loginToBKBob();
    browser = puppeteerBrowser;
    
    const data = await getRefundsLinks(page);
    
    console.log(`Total commandes: ${data.commandCount}`);
    console.log(`Boutons récupérés: ${data.seeMoreLinks.length}`);
    
    // Cliquer sur chaque bouton "Voir plus"
    await clickAllSeeMoreButtons(page);
    
    return data;
    
  } catch (error) {
    console.error('Erreur:', error);
    return { commandCount: 0, seeMoreLinks: [] };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Exécution directe
if (require.main === module) {
  getSimpleRefundsData()
    .then(data => {
      console.log(`\nRésumé: ${data.commandCount} commandes, ${data.seeMoreLinks.length} liens`);
    })
    .catch(console.error);
}