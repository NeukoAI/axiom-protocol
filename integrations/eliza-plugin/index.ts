/**
 * SOLPRISM Eliza Plugin
 *
 * Verifiable AI Reasoning on Solana — for the Eliza AI agent framework.
 *
 * This plugin enables Eliza agents to commit reasoning traces onchain
 * before acting, then reveal and verify them afterward. It implements
 * the SOLPRISM commit-reveal protocol using raw Solana instructions.
 *
 * @example
 * ```typescript
 * import { solprismPlugin, initializeSolprism } from "./plugins/solprism";
 *
 * // Initialize with Solana connection + wallet
 * initializeSolprism({
 *   rpcUrl: "https://api.devnet.solana.com",
 *   walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
 * });
 *
 * // Add to your Eliza agent
 * const agent = new AgentRuntime({
 *   plugins: [solprismPlugin],
 * });
 * ```
 *
 * @packageDocumentation
 */

import { Plugin } from "@ai16z/eliza";
import { registerAgentAction } from "./actions/registerAgent";
import { commitReasoningAction } from "./actions/commitReasoning";
import { revealReasoningAction } from "./actions/revealReasoning";
import { verifyReasoningAction } from "./actions/verifyReasoning";
import { solprismProvider, initializeSolprismProvider } from "./provider";
import { SolprismPluginConfig } from "./types";

// ─── Plugin Definition ─────────────────────────────────────────────────────

/**
 * The SOLPRISM plugin for the Eliza AI agent framework.
 *
 * Provides four actions:
 * - REGISTER_AGENT — Create an onchain agent profile
 * - COMMIT_REASONING — Hash and commit reasoning before acting
 * - REVEAL_REASONING — Publish full reasoning after acting
 * - VERIFY_REASONING — Verify a reasoning trace matches a commitment
 *
 * And one provider:
 * - solprismProvider — Connection state, wallet info, and agent profile
 */
export const solprismPlugin: Plugin = {
  name: "solprism",
  description:
    "SOLPRISM: Verifiable AI Reasoning on Solana. " +
    "Enables agents to commit reasoning traces onchain before acting, " +
    "then reveal and verify them — building trust through transparency.",
  actions: [
    registerAgentAction,
    commitReasoningAction,
    revealReasoningAction,
    verifyReasoningAction,
  ],
  evaluators: [],
  providers: [solprismProvider],
};

// ─── Initialization ────────────────────────────────────────────────────────

/**
 * Initialize the SOLPRISM plugin with Solana connection and wallet.
 * Must be called before the plugin's actions can be used.
 *
 * @param config - Solana RPC URL and wallet private key
 *
 * @example
 * ```typescript
 * initializeSolprism({
 *   rpcUrl: "https://api.devnet.solana.com",
 *   walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
 *   commitment: "confirmed",
 * });
 * ```
 */
export const initializeSolprism = (config: SolprismPluginConfig): void => {
  initializeSolprismProvider(config);
};

// ─── Re-exports ────────────────────────────────────────────────────────────

export { registerAgentAction } from "./actions/registerAgent";
export { commitReasoningAction } from "./actions/commitReasoning";
export { revealReasoningAction } from "./actions/revealReasoning";
export { verifyReasoningAction } from "./actions/verifyReasoning";
export { solprismProvider, initializeSolprismProvider } from "./provider";
export type {
  SolprismPluginConfig,
  ReasoningTrace,
  CommitReasoningContent,
  RevealReasoningContent,
  VerifyReasoningContent,
  RegisterAgentContent,
  CommitResult,
  RevealResult,
  VerifyResult,
  OnChainCommitment,
  OnChainAgentProfile,
  ActionType,
  DataSource,
  Alternative,
} from "./types";
