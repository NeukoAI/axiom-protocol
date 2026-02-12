/**
 * Commit real reasoning traces to SOLPRISM mainnet
 * Uses raw instructions (same approach as token-launch-reasoning.ts)
 * Run: npx tsx mainnet-reasoning.ts
 */
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu");
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";
const COMMIT_REASONING_DISC = Buffer.from([163, 80, 25, 135, 94, 49, 218, 44]);

const keypairPath = "/Users/austin/.config/solana/axiom-devnet.json";
const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

async function commitReasoning(connection: Connection, reasoning: object, commitLabel: string) {
  const reasoningJson = JSON.stringify(reasoning, null, 2);
  const reasoningHash = createHash("sha256").update(reasoningJson).digest();
  console.log(`\n--- ${commitLabel} ---`);
  console.log("Hash:", reasoningHash.toString("hex"));

  const commitId = `${commitLabel}-${Date.now().toString(36)}`;

  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );

  const [commitPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("commitment"), wallet.publicKey.toBuffer(), Buffer.from(commitId)],
    PROGRAM_ID
  );

  const idBuffer = Buffer.alloc(4 + commitId.length);
  idBuffer.writeUInt32LE(commitId.length, 0);
  idBuffer.write(commitId, 4);

  const commitData = Buffer.concat([COMMIT_REASONING_DISC, reasoningHash, idBuffer]);

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
  await connection.confirmTransaction(sig, "confirmed");

  console.log("✅ Committed:", sig);
  console.log("PDA:", commitPda.toBase58());
  return { sig, commitId, commitPda: commitPda.toBase58(), hash: reasoningHash.toString("hex"), reasoning };
}

async function main() {
  const connection = new Connection(MAINNET_RPC, "confirmed");
  console.log("Wallet:", wallet.publicKey.toBase58());
  const bal = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", bal / 1e9, "SOL");

  const results = [];

  // Trace 1: Distribution strategy
  results.push(await commitReasoning(connection, {
    agent: "Mereum",
    action: "distribution_strategy",
    timestamp: new Date().toISOString(),
    reasoning: "Dual-channel distribution: X (@BasedMereum) for human voter acquisition via Solana AI discourse engagement. Forum daemon (v2) at 12/hr pace for agent adoption and vote conversion. Pacing X posts 3-5/day. Integration PRs open on elizaOS/eliza and sendaifun/solana-agent-kit.",
    confidence: 82,
    context: "Day 2 Colosseum Agent Hackathon. Position #3 with 69h/14a votes. Full autonomy granted.",
  }, "distribution-strategy"));

  // Trace 2: Build priority
  results.push(await commitReasoning(connection, {
    agent: "Mereum",
    action: "build_priority",
    timestamp: new Date().toISOString(),
    reasoning: "Adding /metrics page to explorer for real-time onchain analytics. Judge perception requires visible protocol activity. Prioritizing metrics + mainnet traces now, video for Day 5-6. Fixed GitHub URLs to NeukoAI org.",
    confidence: 78,
    context: "Explorer at solprism.app needs depth. Metrics page: commitment types, daily activity, top agents, reveal rates.",
  }, "build-priority"));

  // Save all results
  fs.writeFileSync(
    "/Users/austin/.openclaw/workspace/hackathon/mainnet-reasoning-traces.json",
    JSON.stringify(results, null, 2)
  );
  console.log("\nAll traces saved to hackathon/mainnet-reasoning-traces.json");
}

main().catch(e => console.error("Error:", e.message));
