const { chromium } = require('playwright');
const fs = require('fs');

async function scraper() {
  let browser;
  let page;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
    });
    page = await context.newPage();
    await page.goto('https://dexscreener.com/avalanche?rankBy=pairAge&order=asc&minLiq=1&minMarketCap=1&minAge=1&maxAge=72&min24HTxns=1');
    // Wait for Cloudflare or page to settle
    await page.waitForTimeout(5000); // Wait 5 seconds before scraping
    // Token names
    const names = await page.locator('.ds-dex-table-row-base-token-name').allTextContents();
    // Token Symbol
    const symbol = await page.locator('.ds-dex-table-row-base-token-symbol').allTextContents();
    const symbol1 = await page.locator('.ds-dex-table-row-quote-token-symbol').allTextContents();
    // Token price (handle sub-elements by joining innerText)
    const priceHandles = await page.locator('.ds-dex-table-row-col-price').elementHandles();
    const prices: string[] = [];
    for (const handle of priceHandles) {
      const text = await handle.evaluate((el: Element) => el.textContent || '');
      prices.push(text.replace(/\s+/g, '').trim());
    }
    // Token volume
    const volume = await page.locator('.ds-dex-table-row-col-volume').allTextContents();
    // Token mcap
    const mcap = await page.locator('.ds-dex-table-row-col-market-cap').allTextContents();
    // Token Liquidity
    const liquidity = await page.locator('.ds-dex-table-row-col-liquidity').allTextContents();
    // Token transactions
    const txns = await page.locator('.ds-dex-table-row-col-txns').allTextContents();
    // Token age
    const age = await page.locator('.ds-dex-table-row-col-pair-age').allTextContents();
    // Token change (5m)
    const fivem = await page.locator('.ds-dex-table-row-col-price-change-m5').allTextContents();
    // Token change (1h)
    const oneh = await page.locator('.ds-dex-table-row-col-price-change-h1').allTextContents();
    // Token change (6h)
    const sixh = await page.locator('.ds-dex-table-row-col-price-change-h6').allTextContents();
    // Token change (24h)
    const oned = await page.locator('.ds-dex-table-row-col-price-change-h24').allTextContents();
    // Scrape href links for each token row (target <a> elements)
    const hrefs = await page.$$eval('a.ds-dex-table-row.ds-dex-table-row-new', (rows: Element[]) => rows.map((row: Element) => (row as HTMLAnchorElement).getAttribute('href')));


    const tokens = names.map((name: string, i: number) => ({
      name: name,
      symbol: symbol[i],
      symbol1: symbol1[i],
      price: prices[i],
      volume: volume[i],
      liquidity: liquidity[i],
      mcap: mcap[i],
      transactions: txns[i],
      age: age[i],
      'change-5m': fivem[i],
      'change-1h': oneh[i],
      'change-6h': sixh[i],
      'change-24h': oned[i],
      href: hrefs[i] ? `https://dexscreener.com${hrefs[i]}` : null // Add full link
    }));

    const jsonData = {
      timestamp: new Date().toISOString(),
      totalTokens: tokens.length,
      tokens
    };
    fs.writeFileSync('avalanche_tokens.json', JSON.stringify(jsonData, null, 2));
  } catch (err) {
    console.error('Scraping failed', err);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

scraper();
setInterval(scraper, 10_000);