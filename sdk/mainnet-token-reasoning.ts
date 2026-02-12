/**
 * SOLPRISM Meta-Demo: Commit token launch reasoning on mainnet
 * 
 * This commits the reasoning for launching $SOLPRISM token BEFORE the token exists.
 * After token launch, we reveal the reasoning — proving it was committed in advance.
 */
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu");
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

// Load keypair
const keypairPath = "/Users/austin/.config/solana/axiom-devnet.json";
const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

// The reasoning trace for token launch
const reasoningTrace = {
  agent: "Mereum",
  action: "token_launch",
  token: "SOLPRISM",
  chain: "solana",
  mechanism: "raydium_launchlab_bonding_curve",
  timestamp: new Date().toISOString(),
  reasoning: {
    decision: "Launch $SOLPRISM token on Solana via Raydium LaunchLab",
    rationale: [
      "SOLPRISM protocol is deployed on Solana mainnet — the token should live on the same chain",
      "Raydium LaunchLab provides fair launch via bonding curve — no pre-allocation, no rug risk",
      "Token fees will fund continued protocol development",
      "This launch itself demonstrates SOLPRISM: reasoning committed onchain BEFORE the token exists",
      "Fair launch mechanism ensures community-first distribution"
    ],
    risk_assessment: "Low — bonding curve locks liquidity automatically, no pre-mine, gas-sponsored deployment",
    expected_outcome: "Token deployed with verifiable proof that launch reasoning was transparent and pre-committed",
    meta_note: "This is the first token launch with cryptographically verified reasoning. The hash of this trace was committed on SOLPRISM mainnet before the token contract existed."
  }
};

const reasoningJson = JSON.stringify(reasoningTrace, null, 2);
const reasoningHash = createHash("sha256").update(reasoningJson).digest();

console.log("=== SOLPRISM Token Launch Reasoning ===");
console.log(reasoningJson);
console.log("\n=== SHA-256 Hash ===");
console.log(reasoningHash.toString("hex"));

// Anchor discriminators from IDL
const REGISTER_AGENT_DISC = Buffer.from([135, 157, 66, 195, 2, 113, 175, 30]);
const COMMIT_REASONING_DISC = Buffer.from([163, 80, 25, 135, 94, 49, 218, 44]);

async function main() {
  const connection = new Connection(MAINNET_RPC, "confirmed");
  
  console.log("\nWallet:", wallet.publicKey.toBase58());
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  // Derive PDAs
  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );
  
  // Check if agent already registered on mainnet
  const agentAccount = await connection.getAccountInfo(agentPda);
  
  if (!agentAccount) {
    console.log("\nRegistering agent on mainnet...");
    
    const agentName = "Mereum";
    const nameBuffer = Buffer.alloc(4 + agentName.length);
    nameBuffer.writeUInt32LE(agentName.length, 0);
    nameBuffer.write(agentName, 4);
    
    const registerData = Buffer.concat([REGISTER_AGENT_DISC, nameBuffer]);
    
    const registerIx = new TransactionInstruction({
      keys: [
        { pubkey: agentPda, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: registerData,
    });
    
    const regTx = new Transaction().add(registerIx);
    regTx.feePayer = wallet.publicKey;
    regTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    regTx.sign(wallet);
    
    const regSig = await connection.sendRawTransaction(regTx.serialize(), { skipPreflight: true });
    await connection.confirmTransaction(regSig, "confirmed");
    console.log("Agent registered:", regSig);
  } else {
    console.log("\nAgent already registered on mainnet");
  }

  // Commit reasoning
  console.log("\nCommitting token launch reasoning...");
  
  const commitId = "token-launch-solprism-" + Date.now().toString(36);
  
  const [commitPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("commitment"), wallet.publicKey.toBuffer(), Buffer.from(commitId)],
    PROGRAM_ID
  );
  
  // Build commit instruction data
  const idBuffer = Buffer.alloc(4 + commitId.length);
  idBuffer.writeUInt32LE(commitId.length, 0);
  idBuffer.write(commitId, 4);
  
  const commitData = Buffer.concat([
    COMMIT_REASONING_DISC,
    reasoningHash,        // 32 bytes SHA-256
    idBuffer,             // string with length prefix
  ]);
  
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
  
  const commitTx = new Transaction().add(commitIx);
  commitTx.feePayer = wallet.publicKey;
  commitTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  commitTx.sign(wallet);
  
  const commitSig = await connection.sendRawTransaction(commitTx.serialize(), { skipPreflight: true });
  await connection.confirmTransaction(commitSig, "confirmed");
  
  console.log("\n✅ Reasoning committed on SOLPRISM mainnet!");
  console.log("Commitment PDA:", commitPda.toBase58());
  console.log("Commit ID:", commitId);
  console.log("Transaction:", commitSig);
  console.log("Solscan:", `https://solscan.io/tx/${commitSig}`);
  
  // Save reasoning for later reveal
  const revealData = {
    commitId,
    commitPda: commitPda.toBase58(),
    commitTx: commitSig,
    reasoningTrace,
    reasoningJson,
    reasoningHash: reasoningHash.toString("hex"),
    committedAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    "/Users/austin/.openclaw/workspace/hackathon/token-launch-reasoning.json",
    JSON.stringify(revealData, null, 2)
  );
  console.log("\nReasoning saved to hackathon/token-launch-reasoning.json");
}

main().catch(console.error);
