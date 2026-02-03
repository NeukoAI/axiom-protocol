/**
 * SOLPRISM × solana-agent-kit — Commit Reasoning Tool
 *
 * LangChain-compatible tool that commits a SHA-256 hash of an AI agent's
 * reasoning trace onchain via the SOLPRISM program. This is step 1 of the
 * Commit → Execute → Reveal → Verify flow.
 *
 * @example
 * ```ts
 * const tool = new SolprismCommitReasoningTool(connection, wallet);
 * const result = await tool.call(JSON.stringify({
 *   reasoning: "SOL price rising, swap 10 SOL → USDC",
 *   action: "trade",
 *   confidence: 85,
 * }));
 * ```
 */

import { createHash } from "crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Tool } from "@langchain/core/tools";

// ─── Constants ──────────────────────────────────────────────────────────────

/** SOLPRISM program ID (mainnet + devnet) */
export const SOLPRISM_PROGRAM_ID = new PublicKey(
  "CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu",
);

/** Anchor instruction discriminators */
const DISCRIMINATORS = {
  registerAgent: Buffer.from([135, 157, 66, 195, 2, 113, 175, 30]),
  commitReasoning: Buffer.from([163, 80, 25, 135, 94, 49, 218, 44]),
} as const;

/** Account discriminator for AgentProfile */
const AGENT_PROFILE_DISCRIMINATOR = Buffer.from([
  60, 227, 42, 24, 0, 87, 86, 205,
]);

// ─── PDA Seeds ──────────────────────────────────────────────────────────────

const SEED_AGENT = Buffer.from("agent");
const SEED_COMMITMENT = Buffer.from("commitment");

// ─── Types ──────────────────────────────────────────────────────────────────

/** Input schema for the commit tool (parsed from the JSON string) */
export interface CommitReasoningInput {
  /** The full reasoning trace as a JSON object or string */
  reasoning: string | Record<string, unknown>;
  /** Action type label (e.g. "trade", "audit", "decision") */
  action?: string;
  /** Confidence 0-100 */
  confidence?: number;
  /** Agent display name (used for auto-registration) */
  agentName?: string;
}

/** Returned by the tool on success */
export interface CommitReasoningOutput {
  /** Transaction signature */
  signature: string;
  /** PDA address of the commitment account */
  commitmentAddress: string;
  /** SHA-256 hex hash of the reasoning */
  commitmentHash: string;
  /** Nonce used for this commitment */
  nonce: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function deriveAgentPDA(
  authority: PublicKey,
  programId: PublicKey = SOLPRISM_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_AGENT, authority.toBuffer()],
    programId,
  );
}

function deriveCommitmentPDA(
  agentProfile: PublicKey,
  nonce: bigint | number,
  programId: PublicKey = SOLPRISM_PROGRAM_ID,
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync(
    [SEED_COMMITMENT, agentProfile.toBuffer(), buf],
    programId,
  );
}

function encodeString(s: string): Buffer {
  const bytes = Buffer.from(s, "utf-8");
  const buf = Buffer.alloc(4 + bytes.length);
  buf.writeUInt32LE(bytes.length, 0);
  bytes.copy(buf, 4);
  return buf;
}

function encodeU64(n: bigint | number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n));
  return buf;
}

/**
 * Deterministic SHA-256 hash: sort keys recursively, then hash the
 * canonical JSON representation.
 */
function hashReasoning(input: string | Record<string, unknown>): {
  hash: Buffer;
  hex: string;
  canonical: string;
} {
  const obj = typeof input === "string" ? JSON.parse(input) : input;
  const canonical = JSON.stringify(sortKeys(obj));
  const hash = createHash("sha256").update(canonical, "utf-8").digest();
  return { hash, hex: hash.toString("hex"), canonical };
}

function sortKeys(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) return val.map(sortKeys);
  if (typeof val === "object") {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(val as Record<string, unknown>).sort()) {
      sorted[k] = sortKeys((val as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return val;
}

/**
 * Read the totalCommitments counter from an AgentProfile account.
 * Returns null when the account doesn't exist.
 */
async function readAgentNonce(
  connection: Connection,
  authority: PublicKey,
  programId: PublicKey,
): Promise<number | null> {
  const [pda] = deriveAgentPDA(authority, programId);
  const info = await connection.getAccountInfo(pda);
  if (!info?.data || info.data.length < 8) return null;
  if (
    !Buffer.from(info.data.slice(0, 8)).equals(AGENT_PROFILE_DISCRIMINATOR)
  ) {
    return null;
  }
  // totalCommitments is a u64 at offset 8 (discriminator) + 32 (authority) + 4+name_len
  const nameLen = Buffer.from(info.data).readUInt32LE(44); // offset 8+32+4
  const nonceOffset = 8 + 32 + 4 + nameLen;
  return Number(Buffer.from(info.data).readBigUInt64LE(nonceOffset));
}

// ─── Instruction Builders ───────────────────────────────────────────────────

function buildRegisterAgentIx(
  authority: PublicKey,
  name: string,
  programId: PublicKey,
): TransactionInstruction {
  const [agentProfile] = deriveAgentPDA(authority, programId);
  return new TransactionInstruction({
    keys: [
      { pubkey: agentProfile, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: Buffer.concat([DISCRIMINATORS.registerAgent, encodeString(name)]),
  });
}

function buildCommitReasoningIx(
  authority: PublicKey,
  commitmentHash: Buffer,
  actionType: string,
  confidence: number,
  nonce: number,
  programId: PublicKey,
): TransactionInstruction {
  const [agentProfile] = deriveAgentPDA(authority, programId);
  const [commitment] = deriveCommitmentPDA(agentProfile, nonce, programId);

  return new TransactionInstruction({
    keys: [
      { pubkey: commitment, isSigner: false, isWritable: true },
      { pubkey: agentProfile, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: Buffer.concat([
      DISCRIMINATORS.commitReasoning,
      commitmentHash, // [u8; 32]
      encodeString(actionType), // String (Borsh)
      Buffer.from([confidence & 0xff]), // u8
      encodeU64(nonce), // u64
    ]),
  });
}

// ─── Tool ───────────────────────────────────────────────────────────────────

/**
 * LangChain tool that commits a SHA-256 hash of AI reasoning onchain
 * via the SOLPRISM program.
 *
 * **Input:** A JSON string with the shape `CommitReasoningInput`.
 * At minimum, provide a `reasoning` field (string or object).
 *
 * **Output:** A JSON string with `CommitReasoningOutput` containing the
 * transaction signature, commitment PDA, and hash.
 *
 * The tool will automatically register the agent if it hasn't been
 * registered on SOLPRISM yet.
 */
export class SolprismCommitReasoningTool extends Tool {
  name = "solprism_commit_reasoning";

  description =
    "Commit a SHA-256 hash of your reasoning onchain via SOLPRISM before " +
    "executing an action. Input is a JSON string with: reasoning (string or " +
    "object), action (optional, e.g. 'trade'), confidence (optional, 0-100), " +
    "agentName (optional). Returns the commitment address and tx signature.";

  private connection: Connection;
  private wallet: Keypair;
  private programId: PublicKey;

  constructor(
    connection: Connection,
    wallet: Keypair,
    programId: PublicKey = SOLPRISM_PROGRAM_ID,
  ) {
    super();
    this.connection = connection;
    this.wallet = wallet;
    this.programId = programId;
  }

  /** @internal */
  protected async _call(input: string): Promise<string> {
    try {
      const parsed: CommitReasoningInput = JSON.parse(input);
      const reasoning = parsed.reasoning;
      const actionType = parsed.action ?? "decision";
      const confidence = Math.min(100, Math.max(0, parsed.confidence ?? 80));
      const agentName = parsed.agentName ?? "solana-agent";

      // 1. Hash the reasoning deterministically
      const { hash, hex } = hashReasoning(reasoning);

      // 2. Ensure agent is registered (auto-register on first use)
      let nonce = await readAgentNonce(
        this.connection,
        this.wallet.publicKey,
        this.programId,
      );

      if (nonce === null) {
        const regIx = buildRegisterAgentIx(
          this.wallet.publicKey,
          agentName,
          this.programId,
        );
        const regTx = new Transaction().add(regIx);
        await sendAndConfirmTransaction(
          this.connection,
          regTx,
          [this.wallet],
          { commitment: "confirmed" },
        );
        nonce = 0;
      }

      // 3. Build and send the commit instruction
      const ix = buildCommitReasoningIx(
        this.wallet.publicKey,
        hash,
        actionType,
        confidence,
        nonce,
        this.programId,
      );

      const tx = new Transaction().add(ix);
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.wallet],
        { commitment: "confirmed" },
      );

      // 4. Derive the commitment PDA for the result
      const [agentProfile] = deriveAgentPDA(
        this.wallet.publicKey,
        this.programId,
      );
      const [commitmentAddress] = deriveCommitmentPDA(
        agentProfile,
        nonce,
        this.programId,
      );

      const result: CommitReasoningOutput = {
        signature,
        commitmentAddress: commitmentAddress.toBase58(),
        commitmentHash: hex,
        nonce,
      };

      return JSON.stringify(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        error: `Failed to commit reasoning: ${message}`,
      });
    }
  }
}
