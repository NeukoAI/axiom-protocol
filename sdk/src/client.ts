/**
 * SOLPRISM Protocol — On-Chain Client
 *
 * Connects the TypeScript SDK to the deployed SOLPRISM Anchor program.
 * Handles agent registration, reasoning commitment, reveal, and verification.
 */

import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN, Idl } from "@coral-xyz/anchor";

import {
  ReasoningTrace,
  AxiomConfig,
  CommitResult,
  RevealResult,
  VerifyResult,
  OnChainCommitment,
  OnChainAgentProfile,
} from "./types";
import { hashTrace, hashTraceHex, verifyHash } from "./hash";
import { createReasoningTrace } from "./schema";

// ─── Constants ────────────────────────────────────────────────────────────

/** Default program ID (deployed on devnet) */
export const SOLPRISM_PROGRAM_ID = new PublicKey(
  "CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu"
);

/** Default Solana devnet RPC */
const DEFAULT_RPC = "https://api.devnet.solana.com";

/** PDA seed prefixes (must match the Anchor program) */
const SEED_AGENT = Buffer.from("agent");
const SEED_COMMITMENT = Buffer.from("commitment");

// ─── IDL (embedded for zero-dependency usage) ─────────────────────────────

/**
 * Minimal IDL for direct instruction building.
 * We embed discriminators so we don't need the full Anchor IDL at runtime.
 */
const DISCRIMINATORS = {
  registerAgent: Buffer.from([135, 157, 66, 195, 2, 113, 175, 30]),
  commitReasoning: Buffer.from([163, 80, 25, 135, 94, 49, 218, 44]),
  revealReasoning: Buffer.from([76, 215, 6, 241, 209, 207, 84, 96]),
} as const;

// Account discriminators for deserialization
const ACCOUNT_DISCRIMINATORS = {
  AgentProfile: Buffer.from([60, 227, 42, 24, 0, 87, 86, 205]),
  ReasoningCommitment: Buffer.from([67, 22, 65, 98, 26, 124, 5, 25]),
} as const;

// ─── PDA Derivation ───────────────────────────────────────────────────────

/**
 * Derive the agent profile PDA for a given authority.
 */
export function deriveAgentPDA(
  authority: PublicKey,
  programId: PublicKey = SOLPRISM_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_AGENT, authority.toBuffer()],
    programId
  );
}

/**
 * Derive the commitment PDA for a given agent profile and nonce.
 */
export function deriveCommitmentPDA(
  agentProfile: PublicKey,
  nonce: bigint | number,
  programId: PublicKey = SOLPRISM_PROGRAM_ID
): [PublicKey, number] {
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync(
    [SEED_COMMITMENT, agentProfile.toBuffer(), nonceBuf],
    programId
  );
}

// ─── Serialization Helpers ────────────────────────────────────────────────

/** Encode a string as [u32 length][utf8 bytes] (Borsh format) */
function encodeString(s: string): Buffer {
  const bytes = Buffer.from(s, "utf-8");
  const buf = Buffer.alloc(4 + bytes.length);
  buf.writeUInt32LE(bytes.length, 0);
  bytes.copy(buf, 4);
  return buf;
}

/** Encode a u64 as 8 bytes LE */
function encodeU64(n: bigint | number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n));
  return buf;
}

/** Encode a u8 */
function encodeU8(n: number): Buffer {
  return Buffer.from([n]);
}

// ─── Instruction Builders ─────────────────────────────────────────────────

/**
 * Build a register_agent instruction.
 */
export function buildRegisterAgentIx(
  authority: PublicKey,
  name: string,
  programId: PublicKey = SOLPRISM_PROGRAM_ID
): TransactionInstruction {
  const [agentProfile] = deriveAgentPDA(authority, programId);

  const data = Buffer.concat([
    DISCRIMINATORS.registerAgent,
    encodeString(name),
  ]);

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

/**
 * Build a commit_reasoning instruction.
 */
export function buildCommitReasoningIx(
  authority: PublicKey,
  commitmentHash: Uint8Array,
  actionType: string,
  confidence: number,
  nonce: bigint | number,
  programId: PublicKey = SOLPRISM_PROGRAM_ID
): TransactionInstruction {
  const [agentProfile] = deriveAgentPDA(authority, programId);
  const [commitment] = deriveCommitmentPDA(agentProfile, nonce, programId);

  const data = Buffer.concat([
    DISCRIMINATORS.commitReasoning,
    Buffer.from(commitmentHash),     // [u8; 32]
    encodeString(actionType),         // String
    encodeU8(confidence),             // u8
    encodeU64(nonce),                 // u64
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

/**
 * Build a reveal_reasoning instruction.
 */
export function buildRevealReasoningIx(
  authority: PublicKey,
  commitmentAddress: PublicKey,
  reasoningUri: string,
  programId: PublicKey = SOLPRISM_PROGRAM_ID
): TransactionInstruction {
  const [agentProfile] = deriveAgentPDA(authority, programId);

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

// ─── Account Deserialization ──────────────────────────────────────────────

function readString(buf: Buffer, offset: number): [string, number] {
  const len = buf.readUInt32LE(offset);
  const str = buf.slice(offset + 4, offset + 4 + len).toString("utf-8");
  return [str, offset + 4 + len];
}

/**
 * Deserialize an AgentProfile account.
 */
export function deserializeAgentProfile(data: Buffer): OnChainAgentProfile {
  // Skip 8-byte discriminator
  let offset = 8;

  // authority: Pubkey (32 bytes)
  const authority = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;

  // name: String
  const [name, nameEnd] = readString(data, offset);
  offset = nameEnd;

  // total_commitments: u64
  const totalCommitments = Number(data.readBigUInt64LE(offset));
  offset += 8;

  // total_verified: u64
  const totalVerified = Number(data.readBigUInt64LE(offset));
  offset += 8;

  // accountability_score: u16
  const accountabilityScore = data.readUInt16LE(offset);
  offset += 2;

  // created_at: i64
  // skip for now (offset += 8)
  offset += 8;

  // bump: u8
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

/**
 * Deserialize a ReasoningCommitment account.
 */
export function deserializeCommitment(data: Buffer): OnChainCommitment {
  // Skip 8-byte discriminator
  let offset = 8;

  // agent: Pubkey
  const agent = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;

  // authority: Pubkey
  const _authority = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;

  // commitment_hash: [u8; 32]
  const commitmentHash = new Uint8Array(data.slice(offset, offset + 32));
  offset += 32;

  // action_type: String
  const [actionType, atEnd] = readString(data, offset);
  offset = atEnd;

  // confidence: u8
  const confidence = data[offset];
  offset += 1;

  // timestamp: i64
  const timestamp = Number(data.readBigInt64LE(offset));
  offset += 8;

  // revealed: bool
  const revealed = data[offset] === 1;
  offset += 1;

  // reasoning_uri: String
  const [reasoningUri, ruEnd] = readString(data, offset);
  offset = ruEnd;

  // nonce: u64
  // const nonce = Number(data.readBigUInt64LE(offset));
  offset += 8;

  // bump: u8
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

// ─── High-Level Client ───────────────────────────────────────────────────

/**
 * SOLPRISM Protocol Client
 *
 * High-level interface for interacting with the SOLPRISM on-chain program.
 *
 * @example
 * ```typescript
 * import { SolprismClient } from '@solprism/sdk';
 * import { Keypair, Connection } from '@solana/web3.js';
 *
 * const connection = new Connection('https://api.devnet.solana.com');
 * const wallet = Keypair.generate();
 * const client = new SolprismClient(connection);
 *
 * // Register
 * await client.registerAgent(wallet, 'MyAgent');
 *
 * // Commit reasoning
 * const result = await client.commitReasoning(wallet, trace);
 *
 * // Reveal
 * await client.revealReasoning(wallet, result.commitmentAddress, 'ipfs://...');
 *
 * // Verify
 * const verified = await client.verifyReasoning(result.commitmentAddress, trace);
 * ```
 */
export class SolprismClient {
  public readonly connection: Connection;
  public readonly programId: PublicKey;

  constructor(
    connection?: Connection | string,
    programId?: PublicKey | string
  ) {
    if (typeof connection === "string") {
      this.connection = new Connection(connection, "confirmed");
    } else if (connection) {
      this.connection = connection;
    } else {
      this.connection = new Connection(DEFAULT_RPC, "confirmed");
    }

    this.programId = programId
      ? typeof programId === "string"
        ? new PublicKey(programId)
        : programId
      : SOLPRISM_PROGRAM_ID;
  }

  // ─── Agent Registration ──────────────────────────────────────────────

  /**
   * Register a new agent on SOLPRISM.
   *
   * @param wallet - The agent's keypair (will be the authority)
   * @param name - Display name (max 64 chars)
   * @returns Transaction signature
   */
  async registerAgent(wallet: Keypair, name: string): Promise<string> {
    const ix = buildRegisterAgentIx(wallet.publicKey, name, this.programId);
    const tx = new Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(this.connection, tx, [wallet], {
      commitment: "confirmed",
    });

    return sig;
  }

  // ─── Commit ──────────────────────────────────────────────────────────

  /**
   * Commit a reasoning trace hash on-chain.
   *
   * Hashes the trace, derives the next nonce, and publishes
   * the commitment to the SOLPRISM program.
   *
   * @param wallet - The agent's keypair
   * @param trace - The reasoning trace to commit
   * @param nonceOverride - Optional: specify nonce (otherwise auto-incremented)
   * @returns CommitResult with signature, address, and hash
   */
  async commitReasoning(
    wallet: Keypair,
    trace: ReasoningTrace,
    nonceOverride?: number
  ): Promise<CommitResult> {
    // Hash the trace
    const hash = hashTrace(trace);

    // Get current nonce from agent profile (or use override)
    let nonce: number;
    if (nonceOverride !== undefined) {
      nonce = nonceOverride;
    } else {
      const agent = await this.getAgentProfile(wallet.publicKey);
      nonce = agent ? agent.totalCommitments : 0;
    }

    // Build and send the instruction
    const actionType = trace.action.type;
    const confidence = trace.decision.confidence;

    const ix = buildCommitReasoningIx(
      wallet.publicKey,
      hash,
      actionType,
      confidence,
      nonce,
      this.programId
    );

    const tx = new Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(this.connection, tx, [wallet], {
      commitment: "confirmed",
    });

    // Derive the commitment address for the response
    const [agentProfile] = deriveAgentPDA(wallet.publicKey, this.programId);
    const [commitmentAddress] = deriveCommitmentPDA(
      agentProfile,
      nonce,
      this.programId
    );

    // Get slot
    const status = await this.connection.getSignatureStatus(sig);
    const slot = status?.value?.slot ?? 0;

    return {
      signature: sig,
      commitmentAddress: commitmentAddress.toBase58(),
      commitmentHash: hashTraceHex(trace),
      slot,
    };
  }

  // ─── Reveal ──────────────────────────────────────────────────────────

  /**
   * Reveal the full reasoning for a commitment.
   *
   * @param wallet - The agent's keypair
   * @param commitmentAddress - The commitment PDA address
   * @param reasoningUri - URI where the full reasoning is stored
   * @returns RevealResult with signature and URI
   */
  async revealReasoning(
    wallet: Keypair,
    commitmentAddress: string | PublicKey,
    reasoningUri: string
  ): Promise<RevealResult> {
    const commitPubkey =
      typeof commitmentAddress === "string"
        ? new PublicKey(commitmentAddress)
        : commitmentAddress;

    const ix = buildRevealReasoningIx(
      wallet.publicKey,
      commitPubkey,
      reasoningUri,
      this.programId
    );

    const tx = new Transaction().add(ix);

    const sig = await sendAndConfirmTransaction(this.connection, tx, [wallet], {
      commitment: "confirmed",
    });

    return {
      signature: sig,
      reasoningUri,
    };
  }

  // ─── Verify ──────────────────────────────────────────────────────────

  /**
   * Verify that a reasoning trace matches an on-chain commitment.
   *
   * This is the core trust operation: anyone can fetch the commitment
   * from chain, compute the hash of the provided reasoning, and
   * check they match.
   *
   * @param commitmentAddress - The commitment PDA address
   * @param trace - The reasoning trace to verify against
   * @returns VerifyResult with validity and details
   */
  async verifyReasoning(
    commitmentAddress: string | PublicKey,
    trace: ReasoningTrace
  ): Promise<VerifyResult> {
    const commitPubkey =
      typeof commitmentAddress === "string"
        ? new PublicKey(commitmentAddress)
        : commitmentAddress;

    // Fetch the on-chain commitment
    const commitment = await this.getCommitment(commitPubkey);
    if (!commitment) {
      return {
        valid: false,
        commitment: null as unknown as OnChainCommitment,
        computedHash: hashTraceHex(trace),
        storedHash: "",
        message: "Commitment account not found on-chain",
      };
    }

    // Compute hash of the provided trace
    const computedHash = hashTraceHex(trace);
    const storedHash = Buffer.from(commitment.commitmentHash).toString("hex");

    // Compare
    const valid = verifyHash(trace, commitment.commitmentHash);

    return {
      valid,
      commitment,
      computedHash,
      storedHash,
      message: valid
        ? "✅ Reasoning verified — the trace matches the on-chain commitment"
        : "❌ Mismatch — the provided reasoning does not match the on-chain commitment",
    };
  }

  // ─── Account Fetching ────────────────────────────────────────────────

  /**
   * Fetch an agent profile from chain.
   */
  async getAgentProfile(
    authority: PublicKey | string
  ): Promise<OnChainAgentProfile | null> {
    const authorityPk =
      typeof authority === "string" ? new PublicKey(authority) : authority;
    const [pda] = deriveAgentPDA(authorityPk, this.programId);

    const info = await this.connection.getAccountInfo(pda);
    if (!info || !info.data || info.data.length < 8) return null;

    // Check discriminator
    if (
      !Buffer.from(info.data.slice(0, 8)).equals(
        ACCOUNT_DISCRIMINATORS.AgentProfile
      )
    ) {
      return null;
    }

    return deserializeAgentProfile(Buffer.from(info.data));
  }

  /**
   * Fetch a reasoning commitment from chain.
   */
  async getCommitment(
    address: PublicKey | string
  ): Promise<OnChainCommitment | null> {
    const pk = typeof address === "string" ? new PublicKey(address) : address;

    const info = await this.connection.getAccountInfo(pk);
    if (!info || !info.data || info.data.length < 8) return null;

    // Check discriminator
    if (
      !Buffer.from(info.data.slice(0, 8)).equals(
        ACCOUNT_DISCRIMINATORS.ReasoningCommitment
      )
    ) {
      return null;
    }

    return deserializeCommitment(Buffer.from(info.data));
  }

  /**
   * Get all commitments for an agent (by scanning program accounts).
   */
  async getAgentCommitments(
    authority: PublicKey | string,
    limit = 100
  ): Promise<OnChainCommitment[]> {
    const authorityPk =
      typeof authority === "string" ? new PublicKey(authority) : authority;
    const [agentPda] = deriveAgentPDA(authorityPk, this.programId);

    // Fetch all program accounts with the ReasoningCommitment discriminator
    // and filter by agent field
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from(ACCOUNT_DISCRIMINATORS.ReasoningCommitment).toString("base64"),
            encoding: "base64" as any,
          },
        },
        {
          memcmp: {
            offset: 8, // after discriminator
            bytes: agentPda.toBase58(),
          },
        },
      ],
    });

    return accounts
      .slice(0, limit)
      .map((a) => deserializeCommitment(Buffer.from(a.account.data)));
  }

  // ─── Convenience ────────────────────────────────────────────────────

  /**
   * Full commit-and-reveal flow in one call.
   *
   * 1. Hashes the trace
   * 2. Commits the hash on-chain
   * 3. Reveals with the provided URI
   *
   * @returns Both commit and reveal results
   */
  async commitAndReveal(
    wallet: Keypair,
    trace: ReasoningTrace,
    reasoningUri: string
  ): Promise<{ commit: CommitResult; reveal: RevealResult }> {
    const commit = await this.commitReasoning(wallet, trace);
    const reveal = await this.revealReasoning(
      wallet,
      commit.commitmentAddress,
      reasoningUri
    );
    return { commit, reveal };
  }

  /**
   * Check if an agent is registered.
   */
  async isAgentRegistered(authority: PublicKey | string): Promise<boolean> {
    const profile = await this.getAgentProfile(authority);
    return profile !== null;
  }

  /**
   * Get agent's accountability score as a percentage.
   */
  async getAccountability(
    authority: PublicKey | string
  ): Promise<number | null> {
    const profile = await this.getAgentProfile(authority);
    if (!profile) return null;
    return profile.accountabilityScore / 100; // basis points to percentage
  }
}
