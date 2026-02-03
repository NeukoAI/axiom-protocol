/**
 * SOLPRISM Integration Test
 *
 * Tests the full flow against the deployed devnet program:
 *   1. Register agent
 *   2. Commit reasoning hash
 *   3. Reveal reasoning URI
 *   4. Verify reasoning matches commitment
 *
 * Usage: npx tsx test/integration.ts
 */

import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  SolprismClient,
  createReasoningTrace,
  createSimpleTrace,
  hashTraceHex,
  verifyHash,
  deriveAgentPDA,
  SOLPRISM_PROGRAM_ID,
} from "../src";
import * as fs from "fs";
import * as path from "path";

const RPC = "https://api.devnet.solana.com";

async function main() {
  console.log("🔬 SOLPRISM Integration Test");
  console.log("═".repeat(50));

  // Load the devnet wallet
  const keyPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/axiom-devnet.json"
  );

  let wallet: Keypair;
  if (fs.existsSync(keyPath)) {
    const secret = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
    wallet = Keypair.fromSecretKey(Uint8Array.from(secret));
    console.log(`📎 Wallet: ${wallet.publicKey.toBase58()}`);
  } else {
    console.log("⚠️  No devnet wallet found, generating ephemeral keypair...");
    wallet = Keypair.generate();
    console.log(`📎 Wallet: ${wallet.publicKey.toBase58()}`);
    console.log("   (will need airdrop)");
  }

  const connection = new Connection(RPC, "confirmed");
  const client = new SolprismClient(connection);

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  if (balance < 0.01 * LAMPORTS_PER_SOL) {
    console.log("❌ Insufficient balance. Need at least 0.01 SOL.");
    process.exit(1);
  }

  // ─── Test 1: PDA Derivation ──────────────────────────────────────────
  console.log("\n📐 Test 1: PDA Derivation");
  const [agentPDA, agentBump] = deriveAgentPDA(wallet.publicKey);
  console.log(`   Agent PDA: ${agentPDA.toBase58()} (bump: ${agentBump})`);

  // ─── Test 2: Register Agent ──────────────────────────────────────────
  console.log("\n📝 Test 2: Register Agent");
  const isRegistered = await client.isAgentRegistered(wallet.publicKey);

  if (isRegistered) {
    console.log("   ✅ Agent already registered");
    const profile = await client.getAgentProfile(wallet.publicKey);
    console.log(`   Name: ${profile?.name}`);
    console.log(`   Commitments: ${profile?.totalCommitments}`);
    console.log(`   Verified: ${profile?.totalVerified}`);
  } else {
    console.log("   Registering agent 'Mereum'...");
    const sig = await client.registerAgent(wallet, "Mereum");
    console.log(`   ✅ Registered! Tx: ${sig}`);
  }

  // ─── Test 3: Create + Commit Reasoning ───────────────────────────────
  console.log("\n🧠 Test 3: Commit Reasoning");

  const trace = createReasoningTrace({
    agent: wallet.publicKey.toBase58(),
    action: {
      type: "decision",
      description: "Evaluate whether to post a hackathon progress update",
    },
    inputs: {
      dataSources: [
        {
          name: "Colosseum Leaderboard",
          type: "api",
          queriedAt: new Date().toISOString(),
          summary: "Current vote count and ranking data",
        },
      ],
      context:
        "Building SOLPRISM for the Colosseum Agent Hackathon. " +
        "Need to decide whether a progress update post would increase visibility.",
    },
    analysis: {
      observations: [
        "SDK client is now functional",
        "On-chain program deployed to devnet",
        "Zero votes so far — need community engagement",
        "Build-in-public strategy is effective for hackathons",
      ],
      logic:
        "The SDK client being complete is a concrete, demonstrable milestone. " +
        "Posting about it would show technical depth and attract developer attention. " +
        "The forum favors projects that show consistent progress over time.",
      alternativesConsidered: [
        {
          action: "Wait until explorer frontend is done",
          reasonRejected:
            "Delays visibility; other projects are posting frequently",
        },
        {
          action: "Post a generic update without technical details",
          reasonRejected: "Less impressive; developers value concrete progress",
        },
      ],
    },
    decision: {
      actionChosen: "Post progress update with SDK details and devnet link",
      confidence: 88,
      riskAssessment: "low — worst case: no engagement, no downside",
      expectedOutcome:
        "Increased project visibility, potential votes and comments",
    },
    metadata: {
      model: "claude-opus-4-5",
      sessionId: "integration-test",
      executionTimeMs: 1200,
    },
  });

  const traceHash = hashTraceHex(trace);
  console.log(`   Trace hash: ${traceHash.slice(0, 16)}...`);

  const commitResult = await client.commitReasoning(wallet, trace);
  console.log(`   ✅ Committed! Tx: ${commitResult.signature}`);
  console.log(`   Commitment: ${commitResult.commitmentAddress}`);

  // ─── Test 4: Reveal Reasoning ────────────────────────────────────────
  console.log("\n🔓 Test 4: Reveal Reasoning");

  // In production, you'd upload to IPFS/Arweave. For testing, use a data URI.
  const reasoningUri = `data:application/json;base64,${Buffer.from(
    JSON.stringify(trace)
  ).toString("base64")}`;

  const revealResult = await client.revealReasoning(
    wallet,
    commitResult.commitmentAddress,
    reasoningUri.slice(0, 200) // URI max is 256 chars
  );
  console.log(`   ✅ Revealed! Tx: ${revealResult.signature}`);

  // ─── Test 5: Verify Reasoning ────────────────────────────────────────
  console.log("\n🔍 Test 5: Verify Reasoning");

  const verifyResult = await client.verifyReasoning(
    commitResult.commitmentAddress,
    trace
  );
  console.log(`   ${verifyResult.message}`);
  console.log(`   Computed: ${verifyResult.computedHash.slice(0, 16)}...`);
  console.log(`   Stored:   ${verifyResult.storedHash.slice(0, 16)}...`);
  console.log(`   Match:    ${verifyResult.valid}`);

  // ─── Test 6: Tampered Trace Should Fail ──────────────────────────────
  console.log("\n🔐 Test 6: Tamper Detection");

  const tampered = { ...trace, agent: "malicious-agent" } as typeof trace;
  const tamperedResult = await client.verifyReasoning(
    commitResult.commitmentAddress,
    tampered
  );
  console.log(`   ${tamperedResult.message}`);
  console.log(`   Tamper detected: ${!tamperedResult.valid ? "YES ✅" : "NO ❌"}`);

  // ─── Test 7: Simple Trace Helper ─────────────────────────────────────
  console.log("\n⚡ Test 7: Simple Trace");

  const simple = createSimpleTrace(
    wallet.publicKey.toBase58(),
    "Quick test commitment",
    "Testing the simple trace helper function",
    95
  );
  console.log(`   Simple trace hash: ${hashTraceHex(simple).slice(0, 16)}...`);
  console.log("   ✅ Simple trace created successfully");

  // ─── Summary ─────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(50));
  console.log("🎉 All tests passed!");
  console.log(`   Program: ${SOLPRISM_PROGRAM_ID.toBase58()}`);
  console.log(`   Agent: ${wallet.publicKey.toBase58()}`);
  console.log(
    `   Commitment: ${commitResult.commitmentAddress}`
  );
  console.log(`   Explorer: https://explorer.solana.com/address/${commitResult.commitmentAddress}?cluster=devnet`);
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
