/**
 * SOLPRISM Eliza Plugin — Verify Reasoning Action
 *
 * Verifies that a reasoning trace matches an onchain commitment.
 * This is the trust operation: anyone can fetch the commitment,
 * recompute the hash, and confirm it matches — proving the agent
 * committed to this reasoning BEFORE acting.
 */

import { Action, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { PublicKey } from "@solana/web3.js";
import {
  fetchCommitment,
  hashTrace,
  hashTraceHex,
  verifyHash,
} from "../provider";
import { VerifyReasoningContent, VerifyResult } from "../types";

export const verifyReasoningAction: Action = {
  name: "VERIFY_REASONING",
  description:
    "Verify that a reasoning trace matches a SOLPRISM onchain commitment. " +
    "Fetches the commitment hash from Solana, recomputes the hash of the " +
    "provided trace, and confirms they match — proving the agent's reasoning " +
    "was pre-committed before the action was executed.",
  similes: [
    "SOLPRISM_VERIFY",
    "CHECK_REASONING",
    "VALIDATE_COMMITMENT",
    "VERIFY_HASH",
    "AUDIT_REASONING",
    "CONFIRM_REASONING",
  ],
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Verify the reasoning for commitment 7KpX...4Xm2",
          commitmentAddress: "7KpX4Xm2nRtVqBcDeFgHiJkLmNoPqRsT4Xm2",
        } as VerifyReasoningContent,
      },
      {
        user: "{{agentName}}",
        content: {
          text: "✅ Verified! The reasoning trace matches the onchain commitment hash. The agent provably committed to this reasoning before acting.",
          action: "VERIFY_REASONING",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Check if this agent's reasoning was honest",
        } as VerifyReasoningContent,
      },
      {
        user: "{{agentName}}",
        content: {
          text: "I've verified the commitment. The reasoning hash matches — this proves the agent's reasoning was determined before the action was executed.",
          action: "VERIFY_REASONING",
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
      const content = message.content as VerifyReasoningContent;
      const text = content.text?.toLowerCase() ?? "";
      return (
        text.includes("verify") ||
        text.includes("check") ||
        text.includes("validate") ||
        text.includes("audit") ||
        (content.commitmentAddress != null && content.reasoningTrace != null)
      );
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
      const content = message.content as VerifyReasoningContent;

      // Extract commitment address
      let commitmentAddress = content.commitmentAddress;
      if (!commitmentAddress) {
        const addrMatch = content.text?.match(
          /(?:commitment|address|verify)[:\s]+([1-9A-HJ-NP-Za-km-z]{32,44})/i
        );
        if (addrMatch) {
          commitmentAddress = addrMatch[1];
        }
      }

      if (!commitmentAddress) {
        return (
          "❌ Missing commitment address. Please provide the SOLPRISM commitment " +
          "PDA address to verify against.\n\n" +
          "Example: `Verify reasoning for commitment 7KpX...4Xm2`"
        );
      }

      // Validate the address
      let commitmentPubkey: PublicKey;
      try {
        commitmentPubkey = new PublicKey(commitmentAddress);
      } catch {
        return `❌ Invalid commitment address: "${commitmentAddress}"`;
      }

      // Fetch the onchain commitment
      const commitment = await fetchCommitment(commitmentPubkey);
      if (!commitment) {
        return (
          `❌ Commitment account not found at \`${commitmentAddress}\`. ` +
          `The account may not exist or the address may be incorrect.`
        );
      }

      const storedHash = Buffer.from(commitment.commitmentHash).toString("hex");
      const timestamp = new Date(commitment.timestamp * 1000).toISOString();

      // If a reasoning trace is provided, verify the hash match
      if (content.reasoningTrace) {
        const computedHash = hashTraceHex(content.reasoningTrace);
        const valid = verifyHash(
          content.reasoningTrace,
          commitment.commitmentHash
        );

        const result: VerifyResult = {
          valid,
          computedHash,
          storedHash,
          commitment,
          message: valid
            ? "Reasoning verified — trace matches the onchain commitment"
            : "Mismatch — the provided reasoning does not match the onchain commitment",
        };

        if (valid) {
          return (
            `✅ **Reasoning Verified!**\n\n` +
            `The provided reasoning trace matches the onchain commitment hash.\n\n` +
            `**Commitment:** \`${commitmentAddress}\`\n` +
            `**Hash:** \`${storedHash.slice(0, 16)}...${storedHash.slice(-8)}\`\n` +
            `**Action:** ${commitment.actionType} | **Confidence:** ${commitment.confidence}%\n` +
            `**Committed at:** ${timestamp}\n` +
            `**Revealed:** ${commitment.revealed ? "Yes" : "Not yet"}\n\n` +
            `This proves the agent committed to this exact reasoning before ` +
            `executing the action.`
          );
        } else {
          return (
            `❌ **Verification Failed!**\n\n` +
            `The provided reasoning trace does NOT match the onchain commitment.\n\n` +
            `**Stored hash:** \`${storedHash.slice(0, 16)}...${storedHash.slice(-8)}\`\n` +
            `**Computed hash:** \`${computedHash.slice(0, 16)}...${computedHash.slice(-8)}\`\n\n` +
            `The reasoning may have been tampered with or a different trace ` +
            `was provided.`
          );
        }
      }

      // No trace provided — just show commitment info
      return (
        `📋 **Commitment Details**\n\n` +
        `**Address:** \`${commitmentAddress}\`\n` +
        `**Hash:** \`${storedHash.slice(0, 16)}...${storedHash.slice(-8)}\`\n` +
        `**Action:** ${commitment.actionType}\n` +
        `**Confidence:** ${commitment.confidence}%\n` +
        `**Committed at:** ${timestamp}\n` +
        `**Revealed:** ${commitment.revealed ? `Yes — ${commitment.reasoningUri}` : "Not yet"}\n` +
        `**Agent PDA:** \`${commitment.agent}\`\n\n` +
        `To verify, provide the full reasoning trace in the \`reasoningTrace\` field.`
      );
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown error occurred";
      return `❌ Failed to verify reasoning: ${msg}`;
    }
  },
};
