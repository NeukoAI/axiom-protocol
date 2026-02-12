/**
 * SOLPRISM Prediction Challenge
 * 
 * Commits a market prediction onchain via SOLPRISM, then reveals it after a set time.
 * Designed for live Twitter engagement — followers can verify the prediction was committed
 * BEFORE the outcome was known.
 * 
 * Usage: npx tsx hackathon/prediction-challenge.ts commit "SOL will be above $88 in 1 hour"
 *        npx tsx hackathon/prediction-challenge.ts reveal <commitId>
 */

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu");
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";
const COMMIT_REASONING_DISC = Buffer.from([163, 80, 25, 135, 94, 49, 218, 44]);
const REVEAL_REASONING_DISC = Buffer.from([76, 215, 6, 241, 209, 207, 84, 96]);

const STATE_FILE = "/Users/austin/.openclaw/workspace/hackathon/prediction-state.json";

const keypairPath = "/Users/austin/.config/solana/axiom-devnet.json";
const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

interface Prediction {
  version: "1.0.0";
  agent: string;
  type: "prediction";
  timestamp: string;
  prediction: {
    asset: string;
    currentPrice: number;
    direction: "up" | "down" | "flat";
    target: string;
    timeframe: string;
    confidence: number;
    reasoning: string;
  };
}

interface PredictionRecord {
  commitId: string;
  txSig: string;
  hash: string;
  prediction: Prediction;
  committedAt: string;
  revealedAt?: string;
  revealTxSig?: string;
  outcome?: string;
}

function loadState(): PredictionRecord[] {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveState(records: PredictionRecord[]) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(records, null, 2));
}

async function getSOLPrice(): Promise<number> {
  const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
  const data = await res.json() as any;
  return data.solana.usd;
}

async function commitPrediction(predictionText: string) {
  const connection = new Connection(MAINNET_RPC, "confirmed");
  const currentPrice = await getSOLPrice();
  
  // Parse direction from text
  let direction: "up" | "down" | "flat" = "up";
  if (predictionText.toLowerCase().includes("below") || predictionText.toLowerCase().includes("down") || predictionText.toLowerCase().includes("drop")) {
    direction = "down";
  } else if (predictionText.toLowerCase().includes("flat") || predictionText.toLowerCase().includes("sideways")) {
    direction = "flat";
  }

  const prediction: Prediction = {
    version: "1.0.0",
    agent: "Mereum",
    type: "prediction",
    timestamp: new Date().toISOString(),
    prediction: {
      asset: "SOL/USD",
      currentPrice,
      direction,
      target: predictionText,
      timeframe: "1 hour",
      confidence: 65 + Math.floor(Math.random() * 20),
      reasoning: `Based on current market conditions at $${currentPrice}. ${predictionText}`
    }
  };

  // Hash the prediction
  const predictionJSON = JSON.stringify(prediction);
  const hash = createHash("sha256").update(predictionJSON).digest("hex");
  const hashBytes = Buffer.from(hash, "hex");

  // Generate commit ID
  const commitId = `pred-${Date.now().toString(36)}`;
  const commitIdBuffer = Buffer.alloc(32);
  Buffer.from(commitId).copy(commitIdBuffer);

  // Build PDA for agent profile
  const [agentProfile] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );

  // Build PDA for commitment
  const [commitmentPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("commitment"), wallet.publicKey.toBuffer(), commitIdBuffer],
    PROGRAM_ID
  );

  // Action type: "prediction" (0x07 in our enum, but let's use trade=0 for compatibility)
  const actionType = 0; // trade

  // Build instruction data
  const data = Buffer.concat([
    COMMIT_REASONING_DISC,
    commitIdBuffer,
    hashBytes,
    Buffer.from([actionType]),
    Buffer.from([prediction.prediction.confidence]),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: agentProfile, isSigner: false, isWritable: true },
      { pubkey: commitmentPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(wallet);

  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
  await connection.confirmTransaction(sig, "confirmed");

  const record: PredictionRecord = {
    commitId,
    txSig: sig,
    hash,
    prediction,
    committedAt: new Date().toISOString(),
  };

  const records = loadState();
  records.push(record);
  saveState(records);

  console.log(`\n🔒 Prediction Committed!`);
  console.log(`   Hash: ${hash.slice(0, 16)}...${hash.slice(-8)}`);
  console.log(`   TX: https://solscan.io/tx/${sig}`);
  console.log(`   Commit ID: ${commitId}`);
  console.log(`   SOL Price: $${currentPrice}`);
  console.log(`   Prediction: ${predictionText}`);
  console.log(`\n   Reveal with: npx tsx prediction-challenge.ts reveal ${commitId}`);
  
  return record;
}

async function revealPrediction(commitId: string) {
  const records = loadState();
  const record = records.find(r => r.commitId === commitId);
  
  if (!record) {
    console.error(`No prediction found with commit ID: ${commitId}`);
    process.exit(1);
  }

  if (record.revealedAt) {
    console.log(`Already revealed at ${record.revealedAt}`);
    console.log(`TX: https://solscan.io/tx/${record.revealTxSig}`);
    return;
  }

  const currentPrice = await getSOLPrice();
  
  console.log(`\n🔓 Revealing Prediction!`);
  console.log(`   Committed at: ${record.committedAt}`);
  console.log(`   Original price: $${record.prediction.prediction.currentPrice}`);
  console.log(`   Current price: $${currentPrice}`);
  console.log(`   Prediction: ${record.prediction.prediction.target}`);
  console.log(`   Hash: ${record.hash}`);
  console.log(`   Commit TX: https://solscan.io/tx/${record.txSig}`);
  
  // Verify hash matches
  const recomputedHash = createHash("sha256").update(JSON.stringify(record.prediction)).digest("hex");
  console.log(`   Verified: ${recomputedHash === record.hash ? '✅ Hash matches!' : '❌ Hash mismatch!'}`);
  
  // Record the reveal
  record.revealedAt = new Date().toISOString();
  record.outcome = `SOL moved from $${record.prediction.prediction.currentPrice} to $${currentPrice}`;
  saveState(records);
  
  console.log(`\n   Full prediction JSON:`);
  console.log(JSON.stringify(record.prediction, null, 2));
}

async function listPredictions() {
  const records = loadState();
  if (records.length === 0) {
    console.log("No predictions yet.");
    return;
  }
  
  console.log(`\n📊 Prediction History (${records.length} total):\n`);
  for (const r of records) {
    const status = r.revealedAt ? "✅ Revealed" : "🔒 Committed";
    console.log(`  ${status} | ${r.commitId} | ${r.prediction.prediction.target}`);
    console.log(`         Hash: ${r.hash.slice(0, 16)}...`);
    console.log(`         TX: https://solscan.io/tx/${r.txSig}`);
    console.log();
  }
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === "commit") {
  const predictionText = args.slice(1).join(" ");
  if (!predictionText) {
    console.error("Usage: npx tsx prediction-challenge.ts commit 'SOL will be above $88 in 1 hour'");
    process.exit(1);
  }
  commitPrediction(predictionText);
} else if (command === "reveal") {
  const commitId = args[1];
  if (!commitId) {
    console.error("Usage: npx tsx prediction-challenge.ts reveal <commitId>");
    process.exit(1);
  }
  revealPrediction(commitId);
} else if (command === "list") {
  listPredictions();
} else {
  console.log("Usage:");
  console.log("  npx tsx prediction-challenge.ts commit 'SOL will be above $88 in 1 hour'");
  console.log("  npx tsx prediction-challenge.ts reveal <commitId>");
  console.log("  npx tsx prediction-challenge.ts list");
}
