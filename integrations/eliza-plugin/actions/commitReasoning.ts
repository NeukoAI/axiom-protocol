/**
 * SOLPRISM Eliza Plugin — Commit Reasoning Action
 *
 * Commits a SHA-256 hash of the agent's reasoning trace onchain
 * BEFORE the agent executes its action. This creates an immutable,
 * timestamped record that proves what the agent was thinking.
 */

import { Action, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { PublicKey } from "@solana/web3.js";
import {
  getWallet,
  getConnection,
  buildCommitReasoningIx,
  sendTransaction,
  fetchAgentProfile,
  deriveAgentPDA,
  deriveCommitmentPDA,
  hashTrace,
  hashTraceHex,
  createReasoningTrace,
} from "../provider";
import {
  CommitReasoningContent,
  ReasoningTrace,
  CommitResult,
} from "../types";

export const commitReasoningAction: Action = {
  name: "COMMIT_REASONING",
  description:
    "Commit a SHA-256 hash of the agent's reasoning trace onchain via SOLPRISM. " +
    "This should be done BEFORE taking an action, creating a verifiable pre-commitment " +
    "that proves the agent's reasoning was determined before execution.",
  similes: [
    "SOLPRISM_COMMIT",
    "COMMIT_HASH",
    "PUBLISH_REASONING_HASH",
    "PRECOMMIT_REASONING",
    "HASH_AND_COMMIT",
    "REASONING_COMMITMENT",
  ],
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Commit my reasoning for this trade decision",
          actionType: "trade",
          actionDescription: "Swap 100 USDC for SOL based on momentum signals",
          reasoning:
            "SOL showing strong upward momentum on 4h chart. RSI at 62, MACD crossed bullish. Volume increasing.",
          confidence: 78,
        } as CommitReasoningContent,
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Reasoning committed onchain! Hash: a3f2...8b1c. Commitment address: 7Kp...4Xm. You can now execute the trade and later reveal the full reasoning.",
          action: "COMMIT_REASONING",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "I need to commit reasoning before rebalancing the portfolio",
        } as CommitReasoningContent,
      },
      {
        user: "{{agentName}}",
        content: {
          text: "I've committed your reasoning hash onchain. The trace is locked in — anyone can later verify that your reasoning preceded the action.",
          action: "COMMIT_REASONING",
        },
      },
    ],
  ],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State
  ): Promise<boolean> => {
    try {
      const content = message.content as CommitReasoningContent;
      const text = content.text?.toLowerCase() ?? "";
      const hasKeyword =
        text.includes("commit") ||
        text.includes("reasoning") ||
        text.includes("precommit") ||
        text.includes("hash");

      // Also valid if a full reasoning trace is provided
      const hasTrace = content.reasoningTrace != null;
      const hasFields =
        content.actionDescription != null || content.reasoning != null;

      return hasKeyword || hasTrace || hasFields;
    } catch {
      return false;
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<string> => {
    try {
      const signer = getWallet();
      const content = message.content as CommitReasoningContent;

      // Build or extract the reasoning trace
      let trace: ReasoningTrace;
      if (content.reasoningTrace) {
        trace = content.reasoningTrace;
      } else {
        // Build from individual fields
        const agentName = signer.publicKey.toBase58().slice(0, 8);
        trace = createReasoningTrace({
          agent: agentName,
          actionType: content.actionType ?? "decision",
          actionDescription:
            content.actionDescription ?? "Agent decision via Eliza",
          reasoning:
            content.reasoning ?? content.text ?? "No reasoning provided",
          confidence: content.confidence ?? 75,
        });
      }

      // Compute the hash
      const hash = hashTrace(trace);
      const hashHex = hashTraceHex(trace);

      // Get current nonce from agent profile
      const profile = await fetchAgentProfile(signer.publicKey);
      if (!profile) {
        return (
          "❌ Agent not registered on SOLPRISM. " +
          "Use REGISTER_AGENT first to create your onchain profile."
        );
      }
      const nonce = profile.totalCommitments;

      // Build and send the commit instruction
      const ix = buildCommitReasoningIx(
        signer.publicKey,
        hash,
        trace.action.type,
        trace.decision.confidence,
        nonce
      );
      const signature = await sendTransaction(ix);

      // Derive the commitment PDA address for the response
      const [agentPDA] = deriveAgentPDA(signer.publicKey);
      const [commitmentPDA] = deriveCommitmentPDA(agentPDA, nonce);

      // Get the slot for the result
      const conn = getConnection();
      const status = await conn.getSignatureStatus(signature);
      const slot = status?.value?.slot ?? 0;

      const result: CommitResult = {
        signature,
        commitmentAddress: commitmentPDA.toBase58(),
        commitmentHash: hashHex,
        slot,
      };

      return (
        `✅ Reasoning committed onchain!\n\n` +
        `**Hash:** \`${hashHex.slice(0, 16)}...${hashHex.slice(-8)}\`\n` +
        `**Commitment:** \`${result.commitmentAddress}\`\n` +
        `**Transaction:** ${signature}\n` +
        `**Nonce:** ${nonce} | **Slot:** ${slot}\n` +
        `**Action:** ${trace.action.type} | **Confidence:** ${trace.decision.confidence}%\n\n` +
        `The reasoning hash is now immutably recorded. Execute your action, ` +
        `then use REVEAL_REASONING with the commitment address to publish ` +
        `the full trace.`
      );
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown error occurred";
      return `❌ Failed to commit reasoning: ${msg}`;
    }
  },
};
