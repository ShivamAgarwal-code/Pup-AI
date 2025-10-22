// STEALTH: Use playwright-extra and stealth plugin
const {chromium} = require('playwright');
import * as fs from 'fs';

// Types and interfaces
interface Token {
  name: string;
  symbol: string;
  price?: string;
  volume?: string;
  liquidity?: string;
  mcap?: string;
  transactions?: string;
  age?: string;
  [key: string]: any;
}

interface TweetData {
  id: string;
  text: string;
  author: {
    name: string;
    handle: string;
  };
  timestamp: string;
  engagement: {
    likes: string;
    retweets: string;
    replies: string;
  };
  collectedAt: string;
}

interface TokenResult {
  symbol: string;
  name: string;
  searchQuery: string;
  searchTimestamp: string;
  tweets: TweetData[];
  totalTweets: number;
  scrollDuration: number;
  error: string | null;
}

interface ScrapingResults {
  timestamp: string;
  totalTokens: number;
  results: TokenResult[];
}

interface ScrapingQueue {
  timestamp: string;
  activeTokens: Token[];
  maxTokens: number;
  lastFileHash: string;
  scrapedTokens: Set<string>; // Track which tokens have been scraped
}

// Configuration
const MAX_TOKENS_TO_SCRAPE = 20; // Limit concurrent scraping to 20 tokens
// Path to the rolling tweets file
const TWEETS_FILE = 'tweets.json';
const MAX_TOKENS_IN_FILE = 100;

// In-memory queue - no file needed
let currentQueue: ScrapingQueue = {
  timestamp: new Date().toISOString(),
  activeTokens: [],
  maxTokens: MAX_TOKENS_TO_SCRAPE,
  lastFileHash: '',
  scrapedTokens: new Set()
};

// Track last-scraped timestamps for each token
let lastScraped: Record<string, string> = {};

// Flag to block token file reading during a full run
let isFullRunInProgress = false;
let pendingNewTokens: Token[] = [];

// Function to get file hash for detecting changes
function getFileHash(filePath: string): string {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    // Simple hash using file content length and first/last chars
    const hash = fileContent.length.toString() + 
                 (fileContent.charCodeAt(0) || 0).toString() + 
                 (fileContent.charCodeAt(fileContent.length - 1) || 0).toString();
    return hash;
  } catch (error) {
    return '';
  }
}

// Function to get all tokens from file
function getAllTokens(): Token[] {
  const tokensData = JSON.parse(fs.readFileSync('avalanche_tokens.json', 'utf8'));
  return tokensData.tokens;
}

// Helper to load tweets.json (rolling file)
function loadTweetsFile(): Record<string, TokenResult> {
  if (!fs.existsSync(TWEETS_FILE)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(TWEETS_FILE, 'utf8'));
    // Data is an array or object keyed by symbol
    if (Array.isArray(data)) {
      // Legacy: convert to object
      const obj: Record<string, TokenResult> = {};
      data.forEach((tr: TokenResult) => { obj[tr.symbol] = tr; });
      return obj;
    }
    return data;
  } catch (e) {
    console.error('Error loading tweets.json:', e);
    return {};
  }
}

// Helper to save tweets.json (rolling file)
function saveTweetsFile(tweetsObj: Record<string, TokenResult>) {
  // Only keep up to MAX_TOKENS_IN_FILE, remove oldest by searchTimestamp
  const entries = Object.entries(tweetsObj);
  if (entries.length > MAX_TOKENS_IN_FILE) {
    // Sort by searchTimestamp ascending (oldest first)
    entries.sort((a, b) => new Date(a[1].searchTimestamp).getTime() - new Date(b[1].searchTimestamp).getTime());
  }
  const trimmed = entries.slice(-MAX_TOKENS_IN_FILE);
  const outObj: Record<string, TokenResult> = {};
  trimmed.forEach(([symbol, tr]) => { outObj[symbol] = tr; });
  fs.writeFileSync(TWEETS_FILE, JSON.stringify(outObj, null, 2));
}

// Helper: Update tweets.json after each token
function updateTweetsFileWithToken(tokenResult: TokenResult, currentSymbols: Set<string>) {
  const tweetsData = loadTweetsFile();
  // Remove any tokens not in the current 100
  let filtered = Object.values(tweetsData).filter(t => currentSymbols.has(t.symbol));
  // Remove this token if already present (to update it)
  filtered = filtered.filter(t => t.symbol !== tokenResult.symbol);
  // Add the new/updated token at the end
  filtered.push(tokenResult);
  // If more than 100, remove oldest
  while (filtered.length > MAX_TOKENS_IN_FILE) filtered.shift();
  // Convert back to object for saving
  const filteredObj = {} as Record<string, TokenResult>;
  filtered.forEach(tr => { filteredObj[tr.symbol] = tr; });
  saveTweetsFile(filteredObj);
}

// Function to update scraping queue with new tokens
function updateScrapingQueue(): Token[] {
  console.log('Checking for token list updates...');
  
  const currentFileHash = getFileHash('avalanche_tokens.json');
  
  // If file hasn't changed, return current active tokens
  if (currentQueue.lastFileHash === currentFileHash && currentQueue.activeTokens.length > 0) {
    console.log('No changes detected in token list');
    return currentQueue.activeTokens;
  }
  
  console.log('Token list updated or first run, updating scraping queue...');
  
  // Load all available tokens
  const tokensData = JSON.parse(fs.readFileSync('avalanche_tokens.json', 'utf8'));
  const allTokens: Token[] = tokensData.tokens;
  
  // Get currently active token symbols for comparison
  const currentActiveSymbols = new Set(currentQueue.activeTokens.map(t => t.symbol));
  
  // Find new tokens that aren't currently being scraped
  const newTokens = allTokens.filter(token => !currentActiveSymbols.has(token.symbol));
  
  // If we have new tokens and we're at capacity, remove oldest tokens
  if (newTokens.length > 0 && currentQueue.activeTokens.length >= MAX_TOKENS_TO_SCRAPE) {
    const tokensToRemove = Math.min(newTokens.length, currentQueue.activeTokens.length);
    const removedTokens = currentQueue.activeTokens.splice(0, tokensToRemove);
    console.log(`Removed ${tokensToRemove} tokens from queue:`, removedTokens.map(t => t.symbol).join(', '));
    
    // Remove from scraped tokens set to allow them to be added back later
    removedTokens.forEach(token => currentQueue.scrapedTokens.delete(token.symbol));
  }
  
  // Add new tokens to the end of the queue
  const tokensToAdd = newTokens.slice(0, MAX_TOKENS_TO_SCRAPE - currentQueue.activeTokens.length);
  currentQueue.activeTokens.push(...tokensToAdd);
  
  if (tokensToAdd.length > 0) {
    console.log(`Added ${tokensToAdd.length} new tokens to queue:`, tokensToAdd.map(t => t.symbol).join(', '));
  }
  
  // If queue is empty (first run), take the first MAX_TOKENS_TO_SCRAPE tokens
  if (currentQueue.activeTokens.length === 0) {
    currentQueue.activeTokens = allTokens.slice(0, MAX_TOKENS_TO_SCRAPE);
    console.log(`Initialized queue with ${currentQueue.activeTokens.length} tokens`);
  }
  
  // Update queue metadata
  currentQueue.timestamp = new Date().toISOString();
  currentQueue.lastFileHash = currentFileHash;
  
  console.log(`Active scraping queue: ${currentQueue.activeTokens.length} tokens`);
  return currentQueue.activeTokens;
}

// Function to run the scraping process
async function runScraper() {
  console.log(`\n=== Starting scraper run at ${new Date().toISOString()} ===`);

  const maxRetries = 3;
  let attempt = 0;
  let browser;
  let context;
  let page;
  while (attempt < maxRetries) {
    try {
      browser = await chromium.launch({ headless: false });
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
      });
      // Load cookies for authentication if available
      if (fs.existsSync('cookies.json')) {
        const cookiesRaw = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
        const cookies = cookiesRaw.map((cookie: any) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expirationDate ? Math.floor(cookie.expirationDate) : undefined,
          httpOnly: cookie.httpOnly || false,
          secure: cookie.secure || false,
          sameSite: cookie.sameSite === 'no_restriction' ? 'None' : 
                    cookie.sameSite === 'lax' ? 'Lax' : 
                    cookie.sameSite === 'strict' ? 'Strict' : 'Lax'
        }));
        console.log('Setting cookies:', cookies.map((c: any) => ({ name: c.name, domain: c.domain, value: c.value.slice(0, 6) + '...' })));
        await context.addCookies(cookies);
      }
      page = await context.newPage();
      await page.goto('https://x.com/home', { timeout: 30000 });
      // Wait longer for cookies and Cloudflare to settle
      await page.waitForTimeout(8000);
      try {
        await page.getByTestId('SearchBox_Search_Input').waitFor({ timeout: 15000 });
        await page.getByTestId('SearchBox_Search_Input').click();
        console.log('Successfully authenticated with cookies!');
        break; // Success, exit retry loop
      } catch (e) {
        throw new Error('Cookie authentication failed, cookies may be expired or navigation failed.');
      }
    } catch (error) {
      attempt++;
      console.error(`Attempt ${attempt} failed:`, (error as any).message || error);
      if (attempt >= maxRetries) {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        return;
      }
      // Clean up before retrying
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      await new Promise(res => setTimeout(res, 3000)); // Wait before retry
    }
  }
  // Get tokens from dynamic queue instead of loading all tokens
  const tokens = updateScrapingQueue();
  
  console.log(`Found ${tokens.length} tokens to search for (from active scraping queue)`);
  
  const allResults: ScrapingResults = {
    timestamp: new Date().toISOString(),
    totalTokens: tokens.length,
    results: []
  };

  await scrapeTokens(tokens, page, allResults);
  
  const totalTweetsCollected = allResults.results.reduce((sum, r) => sum + r.totalTweets, 0);
  console.log(`Scraper run completed! Total tweets collected: ${totalTweetsCollected}`);
  
  if (page) await page.close().catch(() => {});
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
}

// Function to calculate milliseconds until next hour
function millisecondsUntilNextHour() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  return nextHour.getTime() - now.getTime();
}

// Function to display current queue status
function displayQueueStatus(): void {
  console.log('\n=== Current Scraping Queue Status ===');
  console.log(`Last updated: ${currentQueue.timestamp}`);
  console.log(`Max tokens: ${currentQueue.maxTokens}`);
  console.log(`Active tokens: ${currentQueue.activeTokens.length}`);
  
  if (currentQueue.activeTokens.length > 0) {
    console.log('\nCurrently in queue:');
    currentQueue.activeTokens.forEach((token, index) => {
      const scrapedStatus = currentQueue.scrapedTokens.has(token.symbol) ? '✓' : '○';
      console.log(`  ${index + 1}. ${token.symbol} (${token.name}) ${scrapedStatus}`);
    });
  }
  
  // Show available tokens not in queue
  try {
    const tokensData = JSON.parse(fs.readFileSync('avalanche_tokens.json', 'utf8'));
    const allTokens: Token[] = tokensData.tokens;
    const activeSymbols = new Set(currentQueue.activeTokens.map(t => t.symbol));
    const availableTokens = allTokens.filter(token => !activeSymbols.has(token.symbol));
    
    console.log(`\nTokens not in queue: ${availableTokens.length}`);
    if (availableTokens.length > 0 && availableTokens.length <= 10) {
      console.log('Next tokens that could be added:');
      availableTokens.slice(0, 5).forEach((token) => {
        console.log(`  • ${token.symbol} (${token.name})`);
      });
      if (availableTokens.length > 5) {
        console.log(`  ... and ${availableTokens.length - 5} more`);
      }
    }
  } catch (error) {
    console.log('Could not load avalanche_tokens.json for comparison');
  }
  console.log('=====================================\n');
}

// Function to manually add a token to the queue
function addTokenToQueue(symbol: string): boolean {
  try {
    const tokensData = JSON.parse(fs.readFileSync('avalanche_tokens.json', 'utf8'));
    const allTokens: Token[] = tokensData.tokens;
    const tokenToAdd = allTokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
    
    if (!tokenToAdd) {
      console.log(`Token ${symbol} not found in avalanche_tokens.json`);
      return false;
    }
    
    const isAlreadyActive = currentQueue.activeTokens.some(t => t.symbol === tokenToAdd.symbol);
    if (isAlreadyActive) {
      console.log(`Token ${symbol} is already in the active queue`);
      return false;
    }
    
    currentQueue.activeTokens.push(tokenToAdd);
    currentQueue.timestamp = new Date().toISOString();
    console.log(`Added ${tokenToAdd.symbol} (${tokenToAdd.name}) to queue`);
    return true;
  } catch (error) {
    console.error('Error adding token to queue:', error);
    return false;
  }
}

// Function to remove a token from the queue
function removeTokenFromQueue(symbol: string): boolean {
  const initialLength = currentQueue.activeTokens.length;
  currentQueue.activeTokens = currentQueue.activeTokens.filter(t => t.symbol !== symbol);
  currentQueue.scrapedTokens.delete(symbol);
  
  if (currentQueue.activeTokens.length < initialLength) {
    currentQueue.timestamp = new Date().toISOString();
    console.log(`Removed ${symbol} from queue`);
    return true;
  } else {
    console.log(`Token ${symbol} not found in queue`);
    return false;
  }
}

// Function to scrape a list of tokens
async function scrapeTokens(tokens: Token[], page: any, allResults: ScrapingResults) {
  // Load rolling tweets file at start
  let tweetsObj = loadTweetsFile();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const symbol = token.symbol;
    const name = token.name;
    const tokenResult: TokenResult = {
      symbol: symbol,
      name: name,
      searchQuery: `$${symbol}`,
      searchTimestamp: new Date().toISOString(),
      tweets: [],
      totalTweets: 0,
      scrollDuration: 30000,
      error: null
    };
    try {
      const startTokenTime = Date.now();
      await page.getByTestId('SearchBox_Search_Input').click();
      await page.getByTestId('SearchBox_Search_Input').fill('');
      await page.getByTestId('SearchBox_Search_Input').fill(`$${symbol}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      try {
        await page.getByRole('tab', { name: 'Latest' }).click();
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log('Latest tab not found, continuing with default results');
      }
      const scrollDuration = 30000;
      const startTime = Date.now();
      let tweetCount = 0;
      const collectedTweets = new Set();
      console.log(`Scrolling for ${symbol} for ${scrollDuration/1000}s...`);
      while (Date.now() - startTime < scrollDuration) {
        await page.keyboard.press('PageDown');
        await page.waitForTimeout(300);
        try {
          const tweetElements = await page.locator('[data-testid="tweet"]').all();
          for (const tweet of tweetElements) {
            try {
              const tweetText = await tweet.locator('[data-testid="tweetText"]').textContent().catch(() => '');
              const authorHandle = await tweet.locator('[data-testid="User-Name"] a').textContent().catch(() => '');
              const authorName = await tweet.locator('[data-testid="User-Name"] span').first().textContent().catch(() => '');
              const timestamp = await tweet.locator('time').getAttribute('datetime').catch(() => '');
              const likes = await tweet.locator('[data-testid="like"] span').textContent().catch(() => '0');
              const retweets = await tweet.locator('[data-testid="retweet"] span').textContent().catch(() => '0');
              const replies = await tweet.locator('[data-testid="reply"] span').textContent().catch(() => '0');
              const tweetId = `${authorHandle}_${timestamp}_${tweetText.substring(0, 50)}`;
              if (tweetText && !collectedTweets.has(tweetId)) {
                collectedTweets.add(tweetId);
                const tweetData: TweetData = {
                  id: tweetId,
                  text: tweetText || '',
                  author: {
                    name: authorName || '',
                    handle: authorHandle || ''
                  },
                  timestamp: timestamp || '',
                  engagement: {
                    likes: likes || '0',
                    retweets: retweets || '0',
                    replies: replies || '0'
                  },
                  collectedAt: new Date().toISOString()
                };
                tokenResult.tweets.push(tweetData);
                tweetCount++;
              }
            } catch (tweetError) { continue; }
          }
        } catch (e) { }
        await page.waitForTimeout(Math.random() * 700 + 100);
        // Hard stop if total time for this token exceeds 40s
        if (Date.now() - startTokenTime > 40000) {
          console.log(`Hard timeout: Stopping scrape for ${symbol} after 40s.`);
          break;
        }
      }
      tokenResult.totalTweets = tokenResult.tweets.length;
      allResults.results.push(tokenResult);
      lastScraped[symbol] = new Date().toISOString();
      // --- Rolling file update logic ---
      tweetsObj[symbol] = tokenResult;
      saveTweetsFile(tweetsObj);
      // --- End rolling file update ---
    } catch (error) {
      console.error(`Error searching for ${symbol}:`, (error as any).message);
      tokenResult.error = (error as any).message;
      tokenResult.totalTweets = 0;
      allResults.results.push(tokenResult);
      // Still update rolling file with error result
      tweetsObj[symbol] = tokenResult;
      saveTweetsFile(tweetsObj);
      continue;
    }
  }
}

// Function to scrape only new tokens
async function scrapeNewTokens(newTokens: Token[]) {
  if (newTokens.length === 0) return;
  console.log(`\nScraping ${newTokens.length} new token(s) immediately: ${newTokens.map(t => t.symbol).join(', ')}`);
  const maxRetries = 3;
  let attempt = 0;
  let browser;
  let context;
  let page;
  while (attempt < maxRetries) {
    try {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
      });
      if (fs.existsSync('cookies.json')) {
        const cookiesRaw = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
        const cookies = cookiesRaw.map((cookie: any) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expirationDate ? Math.floor(cookie.expirationDate) : undefined,
          httpOnly: cookie.httpOnly || false,
          secure: cookie.secure || false,
          sameSite: cookie.sameSite === 'no_restriction' ? 'None' : 
                    cookie.sameSite === 'lax' ? 'Lax' : 
                    cookie.sameSite === 'strict' ? 'Strict' : 'Lax'
        }));
        await context.addCookies(cookies);
      }
      page = await context.newPage();
      await page.goto('https://x.com/home', { timeout: 30000 });
      await page.waitForTimeout(8000);
      try {
        await page.getByTestId('SearchBox_Search_Input').waitFor({ timeout: 15000 });
        await page.getByTestId('SearchBox_Search_Input').click();
        console.log('Successfully authenticated with cookies!');
        break;
      } catch (e) {
        throw new Error('Cookie authentication failed, cookies may be expired or navigation failed.');
      }
    } catch (error) {
      attempt++;
      console.error(`Attempt ${attempt} failed:`, (error as any).message || error);
      if (attempt >= maxRetries) {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        return;
      }
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      await new Promise(res => setTimeout(res, 3000));
    }
  }
  try {
    const allResults: ScrapingResults = {
      timestamp: new Date().toISOString(),
      totalTokens: newTokens.length,
      results: []
    };
    await scrapeTokens(newTokens, page, allResults);
    const totalTweetsCollected = allResults.results.reduce((sum, r) => sum + r.totalTweets, 0);
    console.log(`New token scrape completed! Total tweets collected: ${totalTweetsCollected}`);
  } catch (error) {
    console.error('Error during new token scraping:', error);
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

// Main execution function
(async () => {
  console.log('Twitter Token Scraper - Dynamic Token Mode (100 tokens)');
  console.log('==========================================');

  // Initial scrape of all tokens
  async function scrapeAllTokens() {
    isFullRunInProgress = true;
    const tokens = getAllTokens();
    const browser = await chromium.launch({ headless: true });
    try {
      const cookiesRaw = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
      const cookies = cookiesRaw.map((cookie: any) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expirationDate ? Math.floor(cookie.expirationDate) : undefined,
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || false,
        sameSite: cookie.sameSite === 'no_restriction' ? 'None' : 
                  cookie.sameSite === 'lax' ? 'Lax' : 
                  cookie.sameSite === 'strict' ? 'Strict' : 'Lax'
      }));
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
      });
      await context.addCookies(cookies);
      const page = await context.newPage();
      await page.goto('https://x.com/home');
      try {
        await page.getByTestId('SearchBox_Search_Input').click({ timeout: 10000 });
        console.log('Successfully authenticated with cookies!');
      } catch (e) {
        console.log('Cookie authentication failed, cookies may be expired');
        await browser.close();
        isFullRunInProgress = false;
        return;
      }
      const allResults: ScrapingResults = {
        timestamp: new Date().toISOString(),
        totalTokens: tokens.length,
        results: []
      };
      await scrapeTokens(tokens, page, allResults);
      const totalTweetsCollected = allResults.results.reduce((sum, r) => sum + r.totalTweets, 0);
      console.log(`Scraper run completed! Total tweets collected: ${totalTweetsCollected}`);
      await context.close();
    } catch (error) {
      console.error('Error during scraping:', error);
    } finally {
      await browser.close();
      isFullRunInProgress = false;
      // If any new tokens were detected during the full run, scrape them now
      if (pendingNewTokens.length > 0) {
        const unique = Array.from(new Set(pendingNewTokens.map(t => t.symbol)));
        const allTokens = getAllTokens();
        const toScrape = allTokens.filter(t => unique.includes(t.symbol));
        console.log(`\nScraping ${toScrape.length} new token(s) detected during full run: ${toScrape.map(t => t.symbol).join(', ')}`);
        await scrapeNewTokens(toScrape);
        pendingNewTokens = [];
      }
    }
  }

  // Initial full scrape
  await scrapeAllTokens();

  // Watch for new tokens
  let lastTokenSymbols = new Set(getAllTokens().map(t => t.symbol));
  if (fs.existsSync('avalanche_tokens.json')) {
    fs.watchFile('avalanche_tokens.json', { interval: 5000 }, async (curr, prev) => {
      const tokens = getAllTokens();
      const currentSymbols = new Set(tokens.map(t => t.symbol));
      const newTokens = tokens.filter(t => !lastTokenSymbols.has(t.symbol));
      if (newTokens.length > 0) {
        if (isFullRunInProgress) {
          // Queue new tokens to be scraped after the full run
          pendingNewTokens.push(...newTokens);
        } else {
          await scrapeNewTokens(newTokens);
          // Update lastScraped for new tokens
          newTokens.forEach(t => lastScraped[t.symbol] = new Date().toISOString());
        }
      }
      lastTokenSymbols = currentSymbols;
    });
  }

  // Schedule to run every 12 hours
  function msUntilNext12Hour() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(Math.ceil(now.getHours() / 12) * 12, 0, 0, 0);
    if (next <= now) next.setHours(next.getHours() + 12);
    return next.getTime() - now.getTime();
  }
  console.log(`\nScheduling next full scrape in ${Math.round(msUntilNext12Hour() / 1000 / 60)} minutes...`);
  setTimeout(() => {
    scrapeAllTokens();
    setInterval(scrapeAllTokens, 12 * 60 * 60 * 1000);
  }, msUntilNext12Hour());

  console.log('Scraper is running in dynamic token mode. Press Ctrl+C to stop.');
})();