/**
 * SOLPRISM Eliza Plugin — Provider
 *
 * Manages the Solana connection, wallet keypair, and SOLPRISM program
 * interaction layer. Provides onchain state to all actions.
 */

import { Provider, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash } from "crypto";
import {
  SolprismPluginConfig,
  SolprismProviderResponse,
  OnChainAgentProfile,
  OnChainCommitment,
  ReasoningTrace,
  SOLPRISM_SCHEMA_VERSION,
  ActionType,
} from "./types";

// ─── Constants ─────────────────────────────────────────────────────────────

const SOLPRISM_PROGRAM_ID = new PublicKey(
  "CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu"
);

const SEED_AGENT = Buffer.from("agent");
const SEED_COMMITMENT = Buffer.from("commitment");

/** Anchor 8-byte instruction discriminators */
const DISCRIMINATORS = {
  registerAgent: Buffer.from([135, 157, 66, 195, 2, 113, 175, 30]),
  commitReasoning: Buffer.from([163, 80, 25, 135, 94, 49, 218, 44]),
  revealReasoning: Buffer.from([76, 215, 6, 241, 209, 207, 84, 96]),
} as const;

/** Anchor 8-byte account discriminators for deserialization */
const ACCOUNT_DISCRIMINATORS = {
  AgentProfile: Buffer.from([60, 227, 42, 24, 0, 87, 86, 205]),
  ReasoningCommitment: Buffer.from([67, 22, 65, 98, 26, 124, 5, 25]),
} as const;

// ─── Module State ──────────────────────────────────────────────────────────

let connection: Connection | null = null;
let wallet: Keypair | null = null;
let programId: PublicKey = SOLPRISM_PROGRAM_ID;

// ─── Initialization ────────────────────────────────────────────────────────

/**
 * Initialize the SOLPRISM provider with connection and wallet.
 * Must be called before using any actions.
 */
export function initializeSolprismProvider(config: SolprismPluginConfig): void {
  const commitment = config.commitment ?? "confirmed";
  connection = new Connection(config.rpcUrl, commitment);

  // Parse wallet private key (supports base58 and JSON byte array)
  try {
    const keyData = config.walletPrivateKey.trim();
    if (keyData.startsWith("[")) {
      // JSON byte array format
      const bytes = JSON.parse(keyData) as number[];
      wallet = Keypair.fromSecretKey(Uint8Array.from(bytes));
    } else {
      // Base58 format
      const bs58 = require("bs58");
      wallet = Keypair.fromSecretKey(bs58.decode(keyData));
    }
  } catch (err) {
    throw new Error(
      `Failed to parse SOLPRISM wallet private key: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (config.programId) {
    programId = new PublicKey(config.programId);
  }
}

// ─── Accessors ─────────────────────────────────────────────────────────────

export function getConnection(): Connection {
  if (!connection) {
    throw new Error(
      "SOLPRISM provider not initialized. Call initializeSolprismProvider() first."
    );
  }
  return connection;
}

export function getWallet(): Keypair {
  if (!wallet) {
    throw new Error(
      "SOLPRISM provider not initialized. Call initializeSolprismProvider() first."
    );
  }
  return wallet;
}

export function getProgramId(): PublicKey {
  return programId;
}

// ─── PDA Derivation ────────────────────────────────────────────────────────

export function deriveAgentPDA(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_AGENT, authority.toBuffer()],
    programId
  );
}

export function deriveCommitmentPDA(
  agentProfile: PublicKey,
  nonce: bigint | number
): [PublicKey, number] {
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync(
    [SEED_COMMITMENT, agentProfile.toBuffer(), nonceBuf],
    programId
  );
}

// ─── Serialization Helpers ─────────────────────────────────────────────────

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

function encodeU8(n: number): Buffer {
  return Buffer.from([n]);
}

function readString(buf: Buffer, offset: number): [string, number] {
  const len = buf.readUInt32LE(offset);
  const str = buf.slice(offset + 4, offset + 4 + len).toString("utf-8");
  return [str, offset + 4 + len];
}

// ─── Hashing ───────────────────────────────────────────────────────────────

function sortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

/** Compute SHA-256 hash of a reasoning trace (canonical JSON) */
export function hashTrace(trace: ReasoningTrace): Uint8Array {
  const canonical = JSON.stringify(sortKeys(trace));
  const hash = createHash("sha256").update(canonical, "utf-8").digest();
  return new Uint8Array(hash);
}

/** Compute SHA-256 hash as hex string */
export function hashTraceHex(trace: ReasoningTrace): string {
  return Buffer.from(hashTrace(trace)).toString("hex");
}

/** Constant-time hash comparison */
export function verifyHash(
  trace: ReasoningTrace,
  commitmentHash: Uint8Array
): boolean {
  const computed = hashTrace(trace);
  if (computed.length !== commitmentHash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed[i] ^ commitmentHash[i];
  }
  return diff === 0;
}

// ─── Reasoning Trace Builder ───────────────────────────────────────────────

/** Create a reasoning trace with defaults */
export function createReasoningTrace(params: {
  agent: string;
  actionType: ActionType;
  actionDescription: string;
  reasoning: string;
  confidence: number;
  context?: string;
  dataSources?: Array<{ name: string; type: string }>;
}): ReasoningTrace {
  return {
    version: SOLPRISM_SCHEMA_VERSION,
    agent: params.agent,
    timestamp: Date.now(),
    action: {
      type: params.actionType,
      description: params.actionDescription,
    },
    inputs: {
      dataSources: (params.dataSources ?? []).map((ds) => ({
        name: ds.name,
        type: ds.type as any,
      })),
      context: params.context ?? "Eliza agent decision",
    },
    analysis: {
      observations: [],
      logic: params.reasoning,
      alternativesConsidered: [],
    },
    decision: {
      actionChosen: params.actionDescription,
      confidence: Math.round(Math.min(100, Math.max(0, params.confidence))),
      riskAssessment:
        params.confidence >= 80
          ? "low"
          : params.confidence >= 50
            ? "moderate"
            : "high",
      expectedOutcome: params.actionDescription,
    },
  };
}

// ─── Instruction Builders ──────────────────────────────────────────────────

export function buildRegisterAgentIx(
  authority: PublicKey,
  name: string
): TransactionInstruction {
  const [agentProfile] = deriveAgentPDA(authority);
  const data = Buffer.concat([DISCRIMINATORS.registerAgent, encodeString(name)]);

  return new TransactionInstruction({
    keys: [
      { pubkey: agentProfile, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });
}

export function buildCommitReasoningIx(
  authority: PublicKey,
  commitmentHash: Uint8Array,
  actionType: string,
  confidence: number,
  nonce: bigint | number
): TransactionInstruction {
  const [agentProfile] = deriveAgentPDA(authority);
  const [commitment] = deriveCommitmentPDA(agentProfile, nonce);

  const data = Buffer.concat([
    DISCRIMINATORS.commitReasoning,
    Buffer.from(commitmentHash), // [u8; 32]
    encodeString(actionType), // String (Borsh)
    encodeU8(confidence), // u8
    encodeU64(nonce), // u64
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: commitment, isSigner: false, isWritable: true },
      { pubkey: agentProfile, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });
}

export function buildRevealReasoningIx(
  authority: PublicKey,
  commitmentAddress: PublicKey,
  reasoningUri: string
): TransactionInstruction {
  const [agentProfile] = deriveAgentPDA(authority);
  const data = Buffer.concat([
    DISCRIMINATORS.revealReasoning,
    encodeString(reasoningUri),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: commitmentAddress, isSigner: false, isWritable: true },
      { pubkey: agentProfile, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    programId,
    data,
  });
}

// ─── Account Deserialization ───────────────────────────────────────────────

export function deserializeAgentProfile(
  data: Buffer
): OnChainAgentProfile | null {
  if (
    data.length < 8 ||
    !Buffer.from(data.slice(0, 8)).equals(ACCOUNT_DISCRIMINATORS.AgentProfile)
  ) {
    return null;
  }

  let offset = 8;
  const authority = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;

  const [name, nameEnd] = readString(data, offset);
  offset = nameEnd;

  const totalCommitments = Number(data.readBigUInt64LE(offset));
  offset += 8;

  const totalVerified = Number(data.readBigUInt64LE(offset));
  offset += 8;

  const accountabilityScore = data.readUInt16LE(offset);
  offset += 2;

  // created_at: i64 (skip)
  offset += 8;

  const bump = data[offset];

  return {
    authority,
    name,
    totalCommitments,
    totalVerified,
    accountabilityScore,
    bump,
  };
}

export function deserializeCommitment(
  data: Buffer
): OnChainCommitment | null {
  if (
    data.length < 8 ||
    !Buffer.from(data.slice(0, 8)).equals(
      ACCOUNT_DISCRIMINATORS.ReasoningCommitment
    )
  ) {
    return null;
  }

  let offset = 8;

  const agent = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;

  // authority (skip, we use agent PDA)
  offset += 32;

  const commitmentHash = new Uint8Array(data.slice(offset, offset + 32));
  offset += 32;

  const [actionType, atEnd] = readString(data, offset);
  offset = atEnd;

  const confidence = data[offset];
  offset += 1;

  const timestamp = Number(data.readBigInt64LE(offset));
  offset += 8;

  const revealed = data[offset] === 1;
  offset += 1;

  const [reasoningUri, ruEnd] = readString(data, offset);
  offset = ruEnd;

  // nonce: u64 (skip)
  offset += 8;

  const bump = data[offset];

  return {
    agent,
    commitmentHash,
    actionType,
    confidence,
    timestamp,
    revealed,
    reasoningUri: reasoningUri || null,
    bump,
  };
}

// ─── High-Level Operations ─────────────────────────────────────────────────

/** Fetch agent profile from chain, or null if not registered */
export async function fetchAgentProfile(
  authority: PublicKey
): Promise<OnChainAgentProfile | null> {
  const conn = getConnection();
  const [pda] = deriveAgentPDA(authority);
  const info = await conn.getAccountInfo(pda);
  if (!info?.data) return null;
  return deserializeAgentProfile(Buffer.from(info.data));
}

/** Fetch a commitment account from chain */
export async function fetchCommitment(
  address: PublicKey
): Promise<OnChainCommitment | null> {
  const conn = getConnection();
  const info = await conn.getAccountInfo(address);
  if (!info?.data) return null;
  return deserializeCommitment(Buffer.from(info.data));
}

/** Send a transaction with the configured wallet */
export async function sendTransaction(
  ix: TransactionInstruction
): Promise<string> {
  const conn = getConnection();
  const signer = getWallet();
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(conn, tx, [signer], {
    commitment: "confirmed",
  });
}

// ─── Eliza Provider ────────────────────────────────────────────────────────

/**
 * The SOLPRISM provider for the Eliza runtime.
 *
 * Returns current connection status, wallet address, and agent profile
 * when queried. Actions use the exported helper functions directly.
 */
export const solprismProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<SolprismProviderResponse> => {
    try {
      const conn = getConnection();
      const signer = getWallet();

      // Check connectivity
      let connected = false;
      try {
        await conn.getSlot();
        connected = true;
      } catch {
        connected = false;
      }

      // Fetch agent profile if connected
      let agentProfile: OnChainAgentProfile | null = null;
      if (connected) {
        try {
          agentProfile = await fetchAgentProfile(signer.publicKey);
        } catch {
          // Profile may not exist yet
        }
      }

      return {
        success: true,
        data: {
          connected,
          walletAddress: signer.publicKey.toBase58(),
          programId: programId.toBase58(),
          rpcUrl: conn.rpcEndpoint,
          agentProfile,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "SOLPRISM provider not initialized",
      };
    }
  },
};
