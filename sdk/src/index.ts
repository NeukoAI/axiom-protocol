/**
 * AXIOM Protocol SDK
 * 
 * Verifiable AI Reasoning on Solana.
 * 
 * @example
 * ```typescript
 * import { Axiom, createReasoningTrace } from '@axiom-protocol/sdk';
 * 
 * const axiom = new Axiom({ rpcUrl: 'https://api.devnet.solana.com' });
 * 
 * // Create a reasoning trace
 * const trace = createReasoningTrace({
 *   agent: 'MyAgent',
 *   action: { type: 'trade', description: 'Swap 10 SOL for USDC' },
 *   inputs: { dataSources: [...], context: 'Bearish signal detected' },
 *   analysis: { observations: [...], logic: '...', alternativesConsidered: [...] },
 *   decision: { actionChosen: 'sell', confidence: 85, riskAssessment: 'moderate', expectedOutcome: '...' }
 * });
 * 
 * // Commit reasoning hash on-chain
 * const commitment = await axiom.commit(trace, wallet);
 * 
 * // Execute your action...
 * 
 * // Reveal full reasoning
 * const reveal = await axiom.reveal(commitment.commitmentAddress, trace, wallet);
 * 
 * // Anyone can verify
 * const result = await axiom.verify(commitment.commitmentAddress, trace);
 * console.log(result.valid); // true
 * ```
 * 
 * @packageDocumentation
 */

// Re-export types
export type {
  ReasoningTrace,
  ActionType,
  DataSource,
  Alternative,
  OnChainCommitment,
  OnChainAgentProfile,
  AxiomConfig,
  CommitResult,
  RevealResult,
  VerifyResult,
} from "./types";

export { AXIOM_SCHEMA_VERSION } from "./types";

// Re-export hashing utilities
export {
  hashTrace,
  hashTraceHex,
  verifyHash,
  validateTrace,
  canonicalize,
} from "./hash";

// Re-export schema helpers
export { createReasoningTrace } from "./schema";

// Re-export client (when ready)
// export { Axiom } from "./client";
