/**
 * SOLPRISM Protocol — Type Definitions
 * 
 * Core types for verifiable AI reasoning on Solana.
 */

// ─── Reasoning Trace Schema ────────────────────────────────────────────────

export const SOLPRISM_SCHEMA_VERSION = "1.0.0" as const;

/** Supported action types for reasoning traces */
export type ActionType = 
  | "trade" 
  | "audit" 
  | "rebalance" 
  | "decision" 
  | "governance"
  | "custom";

/** A data source that informed the agent's reasoning */
export interface DataSource {
  /** Name of the data source (e.g., "Jupiter price feed", "Pyth SOL/USD oracle") */
  name: string;
  /** Type of source */
  type: "price_feed" | "oracle" | "api" | "on_chain" | "off_chain" | "model" | "other";
  /** When the data was queried (ISO 8601) */
  queriedAt?: string;
  /** Summary of what data was retrieved */
  summary?: string;
}

/** An alternative action that was considered but rejected */
export interface Alternative {
  /** What the alternative action was */
  action: string;
  /** Why it was rejected */
  reasonRejected: string;
  /** Estimated confidence if this path was taken (0-100) */
  estimatedConfidence?: number;
}

/**
 * A structured reasoning trace produced by an AI agent.
 * 
 * This is the core data structure of SOLPRISM. It captures the full
 * chain of reasoning that led to an agent's decision, in a format
 * that can be hashed, committed on-chain, and later verified.
 */
export interface ReasoningTrace {
  /** Schema version (for forward compatibility) */
  version: typeof SOLPRISM_SCHEMA_VERSION;
  
  /** Agent identifier (name, address, or DID) */
  agent: string;
  
  /** Unix timestamp (ms) when this reasoning was produced */
  timestamp: number;
  
  /** What action the agent is about to take */
  action: {
    type: ActionType;
    description: string;
    /** Optional: the on-chain transaction signature this reasoning justifies */
    transactionSignature?: string;
  };
  
  /** What inputs informed the reasoning */
  inputs: {
    dataSources: DataSource[];
    context: string;
  };
  
  /** The agent's analysis process */
  analysis: {
    /** Key observations from the data */
    observations: string[];
    /** The logical reasoning chain */
    logic: string;
    /** Other actions considered and why they were rejected */
    alternativesConsidered: Alternative[];
  };
  
  /** The final decision */
  decision: {
    /** What action was chosen */
    actionChosen: string;
    /** Confidence score (0-100) */
    confidence: number;
    /** Risk assessment */
    riskAssessment: string;
    /** What the agent expects to happen */
    expectedOutcome: string;
  };
  
  /** Optional metadata */
  metadata?: {
    /** AI model used for reasoning */
    model?: string;
    /** Session or conversation ID */
    sessionId?: string;
    /** How long the reasoning took (ms) */
    executionTimeMs?: number;
    /** Custom key-value pairs */
    custom?: Record<string, string | number | boolean>;
  };
}

// ─── On-Chain Types ────────────────────────────────────────────────────────

/** On-chain commitment data (mirrors the Anchor account struct) */
export interface OnChainCommitment {
  /** The agent's public key */
  agent: string;
  /** SHA-256 hash of the serialized reasoning trace */
  commitmentHash: Uint8Array;
  /** Action type (for filtering) */
  actionType: string;
  /** Confidence score (0-100) */
  confidence: number;
  /** Unix timestamp */
  timestamp: number;
  /** Whether the full reasoning has been revealed */
  revealed: boolean;
  /** URI to the full reasoning (set on reveal) */
  reasoningUri: string | null;
  /** PDA bump */
  bump: number;
}

/** On-chain agent profile data */
export interface OnChainAgentProfile {
  /** The agent's authority (owner) public key */
  authority: string;
  /** Display name */
  name: string;
  /** Total reasoning commitments published */
  totalCommitments: number;
  /** Total commitments that have been revealed and verified */
  totalVerified: number;
  /** Accountability score (0-10000, basis points) */
  accountabilityScore: number;
  /** PDA bump */
  bump: number;
}

// ─── SDK Types ─────────────────────────────────────────────────────────────

/** Configuration for SOLPRISM SDK client */
export interface SolprismConfig {
  /** Solana RPC endpoint URL */
  rpcUrl?: string;
  /** SOLPRISM program ID on-chain */
  programId?: string;
  /** IPFS gateway URL for storing/retrieving reasoning traces */
  ipfsGateway?: string;
  /** Whether to auto-reveal after committing (default: false) */
  autoReveal?: boolean;
}

/** Result of a commit operation */
export interface CommitResult {
  /** Transaction signature on Solana */
  signature: string;
  /** PDA address of the commitment account */
  commitmentAddress: string;
  /** The commitment hash that was stored */
  commitmentHash: string;
  /** Slot the transaction was confirmed in */
  slot: number;
}

/** Result of a reveal operation */
export interface RevealResult {
  /** Transaction signature for the reveal update */
  signature: string;
  /** URI where the full reasoning is stored */
  reasoningUri: string;
}

/** Result of a verify operation */
export interface VerifyResult {
  /** Whether the reasoning matches the on-chain commitment */
  valid: boolean;
  /** The on-chain commitment data */
  commitment: OnChainCommitment;
  /** The hash of the provided reasoning */
  computedHash: string;
  /** The hash stored on-chain */
  storedHash: string;
  /** Human-readable explanation */
  message: string;
}
