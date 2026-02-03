/**
 * SOLPRISM Eliza Plugin — Type Definitions
 *
 * Types for the Eliza AI agent framework integration with
 * SOLPRISM verifiable reasoning on Solana.
 */

import { Content } from "@ai16z/eliza";

// ─── Plugin Configuration ──────────────────────────────────────────────────

/** Configuration for the SOLPRISM Eliza plugin */
export interface SolprismPluginConfig {
  /** Solana RPC endpoint URL */
  rpcUrl: string;
  /** Agent wallet private key (base58 or byte array JSON) */
  walletPrivateKey: string;
  /** SOLPRISM program ID (defaults to mainnet/devnet program) */
  programId?: string;
  /** Solana commitment level */
  commitment?: "processed" | "confirmed" | "finalized";
}

// ─── Reasoning Trace (mirrors SDK) ─────────────────────────────────────────

export const SOLPRISM_SCHEMA_VERSION = "1.0.0" as const;

export type ActionType =
  | "trade"
  | "audit"
  | "rebalance"
  | "decision"
  | "governance"
  | "custom";

export interface DataSource {
  name: string;
  type: "price_feed" | "oracle" | "api" | "on_chain" | "off_chain" | "model" | "other";
  queriedAt?: string;
  summary?: string;
}

export interface Alternative {
  action: string;
  reasonRejected: string;
  estimatedConfidence?: number;
}

export interface ReasoningTrace {
  version: typeof SOLPRISM_SCHEMA_VERSION;
  agent: string;
  timestamp: number;
  action: {
    type: ActionType;
    description: string;
    transactionSignature?: string;
  };
  inputs: {
    dataSources: DataSource[];
    context: string;
  };
  analysis: {
    observations: string[];
    logic: string;
    alternativesConsidered: Alternative[];
  };
  decision: {
    actionChosen: string;
    confidence: number;
    riskAssessment: string;
    expectedOutcome: string;
  };
  metadata?: {
    model?: string;
    sessionId?: string;
    executionTimeMs?: number;
    custom?: Record<string, string | number | boolean>;
  };
}

// ─── Onchain Account Types ─────────────────────────────────────────────────

export interface OnChainCommitment {
  agent: string;
  commitmentHash: Uint8Array;
  actionType: string;
  confidence: number;
  timestamp: number;
  revealed: boolean;
  reasoningUri: string | null;
  bump: number;
}

export interface OnChainAgentProfile {
  authority: string;
  name: string;
  totalCommitments: number;
  totalVerified: number;
  accountabilityScore: number;
  bump: number;
}

// ─── Action Content Types ──────────────────────────────────────────────────

export interface CommitReasoningContent extends Content {
  text: string;
  /** Full reasoning trace to commit */
  reasoningTrace?: ReasoningTrace;
  /** Or provide individual fields for simple traces */
  actionType?: ActionType;
  actionDescription?: string;
  reasoning?: string;
  confidence?: number;
}

export interface RevealReasoningContent extends Content {
  text: string;
  /** The commitment PDA address to reveal */
  commitmentAddress?: string;
  /** URI where the full reasoning is stored (e.g., IPFS, Arweave) */
  reasoningUri?: string;
}

export interface VerifyReasoningContent extends Content {
  text: string;
  /** The commitment PDA address to verify */
  commitmentAddress?: string;
  /** The reasoning trace to verify against */
  reasoningTrace?: ReasoningTrace;
}

export interface RegisterAgentContent extends Content {
  text: string;
  /** Agent display name (max 64 chars) */
  agentName?: string;
}

// ─── Provider Response Types ───────────────────────────────────────────────

export interface SolprismProviderResponse {
  success: boolean;
  data?: {
    connected: boolean;
    walletAddress: string;
    programId: string;
    rpcUrl: string;
    agentProfile: OnChainAgentProfile | null;
  };
  error?: string;
}

// ─── Result Types ──────────────────────────────────────────────────────────

export interface CommitResult {
  signature: string;
  commitmentAddress: string;
  commitmentHash: string;
  slot: number;
}

export interface RevealResult {
  signature: string;
  reasoningUri: string;
}

export interface VerifyResult {
  valid: boolean;
  computedHash: string;
  storedHash: string;
  commitment: OnChainCommitment | null;
  message: string;
}
