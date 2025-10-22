import * as fs from 'fs';
import * as path from 'path';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TWEETS_FILE = 'tweets.json';
const OUTPUT_FILE = 'ai_analyzer.json';
const AVALANCHE_TOKENS = 'avalanche_tokens.json';

// AWS and Bedrock config from .env
const REGION = process.env.AWS_REGION;
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const BEDROCK_MODEL = process.env.BEDROCK_LARGE_MODEL;

if (!REGION || !ACCESS_KEY || !SECRET_KEY || !BEDROCK_MODEL) {
  throw new Error('Missing AWS or Bedrock config in .env');
}

const bedrock = new BedrockRuntimeClient({
  region: REGION,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

// Helper to get token info from avalanche_tokens.json
function getTokenInfo(symbol: string, avalancheTokens: any): any {
  if (!avalancheTokens?.tokens) return null;
  return avalancheTokens.tokens.find((t: any) => t.symbol === symbol) || null;
}

async function analyzeToken(symbol: string, tweets: any[], tokenInfo: any): Promise<TokenAnalysis> {
  let tokenInfoStr = '';
  if (tokenInfo) {
    tokenInfoStr = `Token info: ${JSON.stringify(tokenInfo)}\n`;
  }
  const prompt = `Analyze the following memecoin based on recent tweets and token info for risk (1-10, 10=highest risk), investment potential (1-10, 10=best potential), and an overall score (1-100, 100=best overall).\nToken symbol: ${symbol}\n${tokenInfoStr}Recent tweets: ${tweets.map(t => t.text).slice(0, 5).join(' | ')}\nRespond ONLY with a single JSON object, no extra text, no code blocks, no explanations. The JSON object MUST have these exact keys: symbol, risk, potential, overall, rationale. Example: { \"symbol\": \"${symbol}\", \"risk\": 5, \"potential\": 7, \"overall\": 65, \"rationale\": \"...\" }`;
  const input = {
    modelId: BEDROCK_MODEL,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ prompt, max_tokens: 256 })
  };
  try {
    const command = new InvokeModelCommand(input);
    const response = await bedrock.send(command);
    const responseBody = Buffer.from(response.body).toString();
    let outputsObj;
    try {
      outputsObj = JSON.parse(responseBody);
    } catch (e) {
      console.error(`JSON.parse error for ${symbol}:`, e, '\nResponse:', responseBody);
      return {
        symbol,
        risk: -1,
        investmentPotential: -1,
        overall: -1,
        rationale: 'Error parsing model response.'
      };
    }
    // Extract the JSON from outputs[0].text
    let text = outputsObj.outputs?.[0]?.text || '';
    text = text.replace(/```json|```/g, '').trim();
    // Sanitize: remove unescaped control characters except for standard whitespace
    text = text.replace(/([\x00-\x08\x0B\x0C\x0E-\x1F])/g, ' ');
    const match = text.match(/\{[\s\S]*?\}/);
    let result;
    try {
      result = match ? JSON.parse(match[0]) : JSON.parse(text);
    } catch (e) {
      console.error(`Error parsing extracted JSON for ${symbol}:`, e, '\nExtracted:', match ? match[0] : text);
      return {
        symbol,
        risk: -1,
        investmentPotential: -1,
        overall: -1,
        rationale: 'Error parsing extracted JSON.'
      };
    }
    // Use the new keys: symbol, risk, potential, overall, rationale
    return {
      symbol: result.symbol || symbol,
      risk: result.risk,
      investmentPotential: result.potential, // map 'potential' to 'investmentPotential'
      overall: result.overall,
      rationale: result.rationale || ''
    };
  } catch (e) {
    console.error(`Bedrock error for ${symbol}:`, e);
    return {
      symbol,
      risk: -1,
      investmentPotential: -1,
      overall: -1,
      rationale: 'Error or no response from model.'
    };
  }
}

interface TokenAnalysis {
  symbol: string;
  risk: number;
  investmentPotential: number;
  overall: number;
  rationale: string;
}

async function main() {
  let tweetsObj: any = {};
  let avalancheTokens: any = {};
  try {
    if (!fs.existsSync(TWEETS_FILE)) {
      console.log('tweets.json not found. Nothing to analyze.');
      return;
    }
    tweetsObj = JSON.parse(fs.readFileSync(TWEETS_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading or parsing tweets.json:', e);
    return;
  }
  try {
    if (fs.existsSync(AVALANCHE_TOKENS)) {
      avalancheTokens = JSON.parse(fs.readFileSync(AVALANCHE_TOKENS, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading or parsing avalanche_tokens.json:', e);
    avalancheTokens = {};
  }

  let analysisResults: TokenAnalysis[] = [];
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      analysisResults = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading or parsing ai_analyzer.json:', e);
    analysisResults = [];
  }

  const analyzedSymbols = new Set(analysisResults.map(a => a.symbol));
  for (const symbol of Object.keys(tweetsObj)) {
    if (!analyzedSymbols.has(symbol)) {
      const tweets = tweetsObj[symbol]?.tweets || [];
      const tokenInfo = getTokenInfo(symbol, avalancheTokens);
      let analysis: TokenAnalysis;
      try {
        analysis = await analyzeToken(symbol, tweets, tokenInfo);
        // Only add and write if rationale is not empty and analysis succeeded
        if (analysis.rationale && analysis.rationale.trim() !== '' && analysis.risk !== -1) {
          analysisResults.push(analysis);
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(analysisResults, null, 2));
        } else {
          console.warn(`Skipping ${symbol}: No valid analysis returned.`);
        }
      } catch (e) {
        console.error(`Error analyzing token ${symbol}:`, e);
      }
      // Add a delay between analyses to avoid rate limits
      await new Promise(res => setTimeout(res, 1000));
    }
  }
}

// Helper: full analysis function (shared by interval and watcher)
async function runFullAnalysis() {
  let tweetsObj: any = {};
  let avalancheTokens: any = {};
  try {
    if (!fs.existsSync(TWEETS_FILE)) {
      console.log('tweets.json not found. Nothing to analyze.');
      return;
    }
    tweetsObj = JSON.parse(fs.readFileSync(TWEETS_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading or parsing tweets.json:', e);
    return;
  }
  try {
    if (fs.existsSync(AVALANCHE_TOKENS)) {
      avalancheTokens = JSON.parse(fs.readFileSync(AVALANCHE_TOKENS, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading or parsing avalanche_tokens.json:', e);
    avalancheTokens = {};
  }
  let analysisResults: TokenAnalysis[] = [];
  for (const symbol of Object.keys(tweetsObj)) {
    const tweets = tweetsObj[symbol]?.tweets || [];
    const tokenInfo = getTokenInfo(symbol, avalancheTokens);
    let analysis: TokenAnalysis;
    try {
      analysis = await analyzeToken(symbol, tweets, tokenInfo);
      if (analysis.rationale && analysis.rationale.trim() !== '' && analysis.risk !== -1) {
        analysisResults.push(analysis);
      } else {
        console.warn(`Skipping ${symbol}: No valid analysis returned.`);
      }
    } catch (e) {
      console.error(`Error analyzing token ${symbol}:`, e);
    }
    await new Promise(res => setTimeout(res, 1000)); // avoid rate limits
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(analysisResults, null, 2));
  console.log('Full analysis complete.');
}

// Re-analyze all tokens every 12.5 hours
async function analyzeAllTokensPeriodically() {
  const INTERVAL_MS = 12.5 * 60 * 60 * 1000; // 12.5 hours
  runFullAnalysis();
  setInterval(runFullAnalysis, INTERVAL_MS);
}

// Watch tweets.json for changes and analyze only new tokens
function watchTweetsFile() {
  let timeout: NodeJS.Timeout | null = null;
  let lastHash = '';
  if (!fs.existsSync(TWEETS_FILE)) return;
  fs.watch(TWEETS_FILE, { persistent: true }, () => {
    try {
      const content = fs.readFileSync(TWEETS_FILE, 'utf8');
      const hash = require('crypto').createHash('sha256').update(content).digest('hex');
      if (hash !== lastHash) {
        lastHash = hash;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          console.log('tweets.json changed, analyzing only new tokens...');
          main(); // Only analyze new tokens
        }, 2000); // debounce 2s
      }
    } catch (e) {
      console.error('Error watching tweets.json:', e);
    }
  });
}

// --- Efficiently copy files to knowledge base on update ---
const KNOWLEDGE_DEST = '/home/trendpup/Trendpup/eliza/trendpup/docs';

function copyToKnowledgeBase(file: string) {
  if (!fs.existsSync(file)) return;
  if (!fs.existsSync(KNOWLEDGE_DEST)) fs.mkdirSync(KNOWLEDGE_DEST, { recursive: true });
  const dest = path.join(KNOWLEDGE_DEST, path.basename(file));
  fs.copyFileSync(file, dest);
}

function watchAndSyncKnowledgeFiles() {
  const filesToWatch = [OUTPUT_FILE, AVALANCHE_TOKENS];
  filesToWatch.forEach(file => {
    if (fs.existsSync(file)) {
      fs.watchFile(file, { interval: 2000 }, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          copyToKnowledgeBase(file);
        }
      });
    }
  });
}

// Initial sync on startup
[OUTPUT_FILE, AVALANCHE_TOKENS].forEach(copyToKnowledgeBase);

main().catch(console.error);
analyzeAllTokensPeriodically();
watchTweetsFile();
watchAndSyncKnowledgeFiles();
