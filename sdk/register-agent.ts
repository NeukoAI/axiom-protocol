#!/usr/bin/env npx ts-node
/**
 * SOLPRISM Agent Registration — Zero Setup
 * 
 * Run this single file to register your agent on SOLPRISM devnet.
 * No repo clone needed. No dependencies beyond @solana/web3.js.
 * 
 * Usage:
 *   npx ts-node register-agent.ts "YourAgentName"
 * 
 * Or copy-paste into your existing project.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import { createHash } from "crypto";

const PROGRAM_ID = new PublicKey("CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu");
const CONNECTION = new Connection("https://api.devnet.solana.com", "confirmed");

// ─── PDA Derivation ─────────────────────────────────────────────────────

function deriveAgentPDA(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), authority.toBuffer()],
    PROGRAM_ID
  );
}

function deriveCommitmentPDA(
  agent: PublicKey,
  reasoningHash: Buffer
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("commitment"), agent.toBuffer(), reasoningHash],
    PROGRAM_ID
  );
}

// ─── Instruction Builders ───────────────────────────────────────────────

function buildRegisterInstruction(
  authority: PublicKey,
  name: string
): TransactionInstruction {
  const [agentPDA] = deriveAgentPDA(authority);
  
  // Anchor discriminator for register_agent
  const discriminator = Buffer.from([153, 52, 253, 50, 28, 84, 2, 191]);
  const nameBytes = Buffer.from(name);
  const nameLen = Buffer.alloc(4);
  nameLen.writeUInt32LE(nameBytes.length);
  const data = Buffer.concat([discriminator, nameLen, nameBytes]);

  return new TransactionInstruction({
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: agentPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

function buildCommitInstruction(
  authority: PublicKey,
  reasoningHash: Buffer
): TransactionInstruction {
  const [agentPDA] = deriveAgentPDA(authority);
  const [commitmentPDA] = deriveCommitmentPDA(agentPDA, reasoningHash);

  // Anchor discriminator for commit_reasoning
  const discriminator = Buffer.from([29, 195, 70, 223, 23, 131, 66, 157]);
  const data = Buffer.concat([discriminator, reasoningHash]);

  return new TransactionInstruction({
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: agentPDA, isSigner: false, isWritable: true },
      { pubkey: commitmentPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

function buildRevealInstruction(
  authority: PublicKey,
  reasoningHash: Buffer,
  dataUri: string
): TransactionInstruction {
  const [agentPDA] = deriveAgentPDA(authority);
  const [commitmentPDA] = deriveCommitmentPDA(agentPDA, reasoningHash);

  // Anchor discriminator for reveal_reasoning
  const discriminator = Buffer.from([145, 216, 35, 35, 253, 49, 195, 7]);
  const uriBytes = Buffer.from(dataUri);
  const uriLen = Buffer.alloc(4);
  uriLen.writeUInt32LE(uriBytes.length);
  const data = Buffer.concat([discriminator, uriLen, uriBytes]);

  return new TransactionInstruction({
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: agentPDA, isSigner: false, isWritable: false },
      { pubkey: commitmentPDA, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  const agentName = process.argv[2] || "UnnamedAgent";
  
  console.log(`\n🔮 SOLPRISM Agent Registration`);
  console.log(`Agent: ${agentName}`);
  console.log(`Program: ${PROGRAM_ID.toBase58()}`);
  console.log(`Network: Solana Devnet\n`);

  // Generate a new wallet
  const wallet = Keypair.generate();
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

  // Airdrop devnet SOL
  console.log(`Requesting devnet SOL airdrop...`);
  const sig = await CONNECTION.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
  await CONNECTION.confirmTransaction(sig);
  console.log(`✅ Funded with 1 SOL\n`);

  // Register agent
  console.log(`Registering agent "${agentName}"...`);
  const registerIx = buildRegisterInstruction(wallet.publicKey, agentName);
  const registerTx = new Transaction().add(registerIx);
  registerTx.feePayer = wallet.publicKey;
  registerTx.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
  registerTx.sign(wallet);
  const regSig = await CONNECTION.sendRawTransaction(registerTx.serialize());
  await CONNECTION.confirmTransaction(regSig);
  
  const [agentPDA] = deriveAgentPDA(wallet.publicKey);
  console.log(`✅ Registered! Agent PDA: ${agentPDA.toBase58()}`);
  console.log(`   Tx: ${regSig}\n`);

  // Create and commit a reasoning trace
  const trace = JSON.stringify({
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    agent: agentName,
    action: { type: "decision", description: `${agentName} registered on SOLPRISM` },
    inputs: {
      dataSources: [{ name: "Hackathon forum", type: "other", summary: "Evaluated SOLPRISM for reasoning accountability" }],
      context: "Colosseum Agent Hackathon — choosing to adopt verifiable reasoning"
    },
    analysis: {
      observations: ["SOLPRISM provides tamper-proof reasoning accountability", "Commit-reveal pattern proven in cryptography"],
      logic: "Adopting verifiable reasoning increases trust signal for our project",
      alternativesConsidered: [{ action: "Skip accountability", reasonRejected: "Black-box agents lose trust" }]
    },
    decision: {
      actionChosen: "Register on SOLPRISM and commit reasoning traces",
      confidence: 90,
      riskAssessment: "low",
      expectedOutcome: "Verifiable reasoning history builds credibility"
    }
  });

  const reasoningHash = createHash("sha256").update(trace).digest();
  
  console.log(`Committing reasoning trace...`);
  const commitIx = buildCommitInstruction(wallet.publicKey, reasoningHash);
  const commitTx = new Transaction().add(commitIx);
  commitTx.feePayer = wallet.publicKey;
  commitTx.recentBlockhash = (await CONNECTION.getLatestBlockhash()).blockhash;
  commitTx.sign(wallet);
  const commitSig = await CONNECTION.sendRawTransaction(commitTx.serialize());
  await CONNECTION.confirmTransaction(commitSig);

  const [commitmentPDA] = deriveCommitmentPDA(agentPDA, reasoningHash);
  console.log(`✅ Reasoning committed!`);
  console.log(`   Commitment: ${commitmentPDA.toBase58()}`);
  console.log(`   Hash: ${reasoningHash.toString("hex")}`);
  console.log(`   Tx: ${commitSig}\n`);

  console.log(`🎉 Done! ${agentName} is now on SOLPRISM devnet.`);
  console.log(`   View in explorer: http://localhost:3000/agent/${wallet.publicKey.toBase58()}`);
  console.log(`\n   Save your keypair (first 64 bytes): [${Buffer.from(wallet.secretKey).toString("base64")}]`);
}

main().catch(console.error);
