/**
 * SOLPRISM Live Demo Agent
 * 
 * A market analysis agent that commits its reasoning to SOLPRISM mainnet
 * before publishing any analysis. Demonstrates verifiable AI reasoning in action.
 * 
 * Run: npx tsx hackathon/demo-agent.ts
 */

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";

// ─── Config ───────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey("CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu");
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";
const COMMIT_REASONING_DISC = Buffer.from([163, 80, 25, 135, 94, 49, 218, 44]);

const ANALYSIS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STATE_FILE = "/Users/austin/.openclaw/workspace/hackathon/demo-agent-state.json";
const LOG_FILE = "/Users/austin/.openclaw/workspace/hackathon/demo-agent.log";

// Load wallet
const keypairPath = "/Users/austin/.config/solana/axiom-devnet.json";
const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

// ─── Types ────────────────────────────────────────────────────────────────

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  timestamp: string;
}

interface AnalysisResult {
  agent: string;
  action: string;
  timestamp: string;
  market: {
    symbol: string;
    price: number;
    change24h: number;
    volume24h: number;
  };
  analysis: {
    trend: "bullish" | "bearish" | "neutral";
    momentum: "strong" | "moderate" | "weak";
    signal: "buy" | "sell" | "hold";
    confidence: number;
  };
  reasoning: string;
}

interface State {
  analysisCount: number;
  lastPrice: number | null;
  lastAnalysis: string | null;
  commitments: Array<{
    sig: string;
    commitId: string;
    hash: string;
    timestamp: string;
  }>;
}

// ─── Logging ──────────────────────────────────────────────────────────────

function log(msg: string) {
  const timestamp = new Date().toLocaleTimeString("en-US", { 
    hour12: false, 
    timeZone: "America/New_York" 
  });
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

// ─── Price Fetching ───────────────────────────────────────────────────────

async function fetchSolPrice(): Promise<PriceData> {
  // Use CoinGecko free API
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true"
  );
  
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    symbol: "SOL/USD",
    price: data.solana.usd,
    change24h: data.solana.usd_24h_change,
    volume24h: data.solana.usd_24h_vol,
    timestamp: new Date().toISOString(),
  };
}

// ─── Analysis Logic ───────────────────────────────────────────────────────

function analyzeMarket(current: PriceData, lastPrice: number | null): AnalysisResult {
  const priceChange = lastPrice ? ((current.price - lastPrice) / lastPrice) * 100 : 0;
  
  // Determine trend based on 24h change
  let trend: "bullish" | "bearish" | "neutral";
  if (current.change24h > 3) trend = "bullish";
  else if (current.change24h < -3) trend = "bearish";
  else trend = "neutral";
  
  // Determine momentum based on recent price movement
  let momentum: "strong" | "moderate" | "weak";
  const absChange = Math.abs(current.change24h);
  if (absChange > 7) momentum = "strong";
  else if (absChange > 3) momentum = "moderate";
  else momentum = "weak";
  
  // Generate signal
  let signal: "buy" | "sell" | "hold";
  let confidence: number;
  
  if (trend === "bullish" && momentum !== "weak") {
    signal = "buy";
    confidence = momentum === "strong" ? 75 : 60;
  } else if (trend === "bearish" && momentum !== "weak") {
    signal = "sell";
    confidence = momentum === "strong" ? 75 : 60;
  } else {
    signal = "hold";
    confidence = 50 + (10 - absChange);
  }
  
  // Add some variance
  confidence = Math.min(95, Math.max(40, confidence + (Math.random() * 10 - 5)));
  confidence = Math.round(confidence);
  
  // Build reasoning narrative
  const reasoning = buildReasoning(current, priceChange, trend, momentum, signal, confidence);
  
  return {
    agent: "SOLPRISM Demo Agent",
    action: "market_analysis",
    timestamp: current.timestamp,
    market: {
      symbol: current.symbol,
      price: current.price,
      change24h: current.change24h,
      volume24h: current.volume24h,
    },
    analysis: {
      trend,
      momentum,
      signal,
      confidence,
    },
    reasoning,
  };
}

function buildReasoning(
  price: PriceData,
  recentChange: number,
  trend: string,
  momentum: string,
  signal: string,
  confidence: number
): string {
  const parts: string[] = [];
  
  // Price context
  parts.push(`SOL trading at $${price.price.toFixed(2)}, ${price.change24h >= 0 ? "up" : "down"} ${Math.abs(price.change24h).toFixed(2)}% over 24h.`);
  
  // Volume context
  const volBillions = price.volume24h / 1e9;
  if (volBillions > 2) {
    parts.push(`High volume ($${volBillions.toFixed(1)}B) indicates strong market participation.`);
  } else if (volBillions > 1) {
    parts.push(`Moderate volume ($${volBillions.toFixed(1)}B) suggests normal trading activity.`);
  } else {
    parts.push(`Lower volume ($${(price.volume24h / 1e6).toFixed(0)}M) may indicate reduced conviction.`);
  }
  
  // Trend analysis
  if (trend === "bullish") {
    parts.push(`Trend is bullish with ${momentum} momentum.`);
  } else if (trend === "bearish") {
    parts.push(`Trend is bearish with ${momentum} momentum.`);
  } else {
    parts.push(`Market is consolidating in a neutral range.`);
  }
  
  // Signal rationale
  if (signal === "buy") {
    parts.push(`Signal: BUY. Positive momentum favors long positions.`);
  } else if (signal === "sell") {
    parts.push(`Signal: SELL. Negative momentum suggests risk-off.`);
  } else {
    parts.push(`Signal: HOLD. No clear directional bias — wait for confirmation.`);
  }
  
  parts.push(`Confidence: ${confidence}%.`);
  
  return parts.join(" ");
}

// ─── SOLPRISM Commitment ──────────────────────────────────────────────────

async function commitReasoning(
  connection: Connection,
  analysis: AnalysisResult
): Promise<{ sig: string; commitId: string; hash: string }> {
  const reasoningJson = JSON.stringify(analysis, null, 2);
  const reasoningHash = createHash("sha256").update(reasoningJson).digest();
  
  const nonce = BigInt(Date.now());
  const commitId = `demo-${Date.now().toString(36)}`;
  
  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );
  
  // PDA uses agent_profile (not authority) and nonce as u64 LE bytes
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(nonce);
  const [commitPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("commitment"), agentPda.toBuffer(), nonceBuf],
    PROGRAM_ID
  );
  
  // Serialize args: commitment_hash [u8;32], action_type (string), confidence (u8), nonce (u64)
  const actionType = analysis.signal || "market_analysis";
  const actionTypeBuf = Buffer.alloc(4 + actionType.length);
  actionTypeBuf.writeUInt32LE(actionType.length, 0);
  actionTypeBuf.write(actionType, 4);
  
  const confidenceBuf = Buffer.alloc(1);
  confidenceBuf.writeUInt8(Math.min(100, Math.max(0, analysis.confidence || 50)));
  
  const commitData = Buffer.concat([COMMIT_REASONING_DISC, reasoningHash, actionTypeBuf, confidenceBuf, nonceBuf]);
  
  const commitIx = new TransactionInstruction({
    keys: [
      { pubkey: commitPda, isSigner: false, isWritable: true },
      { pubkey: agentPda, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: commitData,
  });
  
  const tx = new Transaction().add(commitIx);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(wallet);
  
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
  const confirmation = await connection.confirmTransaction(sig, "confirmed");
  
  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }
  
  return { sig, commitId, hash: reasoningHash.toString("hex") };
}

// ─── State Management ─────────────────────────────────────────────────────

function loadState(): State {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch (e) {
    log(`Warning: Could not load state: ${e}`);
  }
  return {
    analysisCount: 0,
    lastPrice: null,
    lastAnalysis: null,
    commitments: [],
  };
}

function saveState(state: State) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Main Loop ────────────────────────────────────────────────────────────

async function runAnalysisCycle(connection: Connection, state: State): Promise<State> {
  try {
    // 1. Fetch current price
    log("Fetching SOL price...");
    const priceData = await fetchSolPrice();
    log(`SOL: $${priceData.price.toFixed(2)} (${priceData.change24h >= 0 ? "+" : ""}${priceData.change24h.toFixed(2)}%)`);
    
    // 2. Run analysis
    log("Running market analysis...");
    const analysis = analyzeMarket(priceData, state.lastPrice);
    log(`Signal: ${analysis.analysis.signal.toUpperCase()} (${analysis.analysis.confidence}% confidence)`);
    
    // 3. Commit reasoning to SOLPRISM
    log("Committing reasoning to SOLPRISM mainnet...");
    const commitment = await commitReasoning(connection, analysis);
    log(`✅ Committed: https://solscan.io/tx/${commitment.sig}`);
    log(`   Hash: ${commitment.hash.slice(0, 16)}...`);
    
    // 4. Update state
    state.analysisCount++;
    state.lastPrice = priceData.price;
    state.lastAnalysis = analysis.timestamp;
    state.commitments.push({
      sig: commitment.sig,
      commitId: commitment.commitId,
      hash: commitment.hash,
      timestamp: analysis.timestamp,
    });
    
    // Keep only last 100 commitments in state
    if (state.commitments.length > 100) {
      state.commitments = state.commitments.slice(-100);
    }
    
    saveState(state);
    log(`Analysis #${state.analysisCount} complete. Next in ${ANALYSIS_INTERVAL_MS / 60000} minutes.`);
    
  } catch (error: any) {
    log(`Error in analysis cycle: ${error.message}`);
  }
  
  return state;
}

async function main() {
  log("═══════════════════════════════════════════════════════════════");
  log("SOLPRISM Demo Agent Starting");
  log("═══════════════════════════════════════════════════════════════");
  log(`Wallet: ${wallet.publicKey.toBase58()}`);
  
  const connection = new Connection(MAINNET_RPC, "confirmed");
  const balance = await connection.getBalance(wallet.publicKey);
  log(`Balance: ${(balance / 1e9).toFixed(4)} SOL`);
  
  if (balance < 0.01 * 1e9) {
    log("⚠️  Warning: Low balance. May run out of SOL for transactions.");
  }
  
  let state = loadState();
  log(`Loaded state: ${state.analysisCount} previous analyses`);
  log(`Analysis interval: ${ANALYSIS_INTERVAL_MS / 60000} minutes`);
  log("");
  
  // Run first cycle immediately
  state = await runAnalysisCycle(connection, state);
  
  // Then run on interval
  setInterval(async () => {
    log("");
    log("─── New Analysis Cycle ───");
    state = await runAnalysisCycle(connection, state);
  }, ANALYSIS_INTERVAL_MS);
  
  log("");
  log("Demo agent running. Press Ctrl+C to stop.");
}

main().catch(e => {
  log(`Fatal error: ${e.message}`);
  process.exit(1);
});
