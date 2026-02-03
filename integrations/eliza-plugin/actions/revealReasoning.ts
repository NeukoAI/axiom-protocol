/**
 * SOLPRISM Eliza Plugin — Reveal Reasoning Action
 *
 * Reveals the full reasoning trace for a previously committed hash.
 * This is the second step of the commit-reveal protocol: after the
 * agent has executed its action, it reveals what it was thinking,
 * allowing anyone to verify the commitment.
 */

import { Action, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { PublicKey } from "@solana/web3.js";
import {
  getWallet,
  buildRevealReasoningIx,
  sendTransaction,
  fetchCommitment,
} from "../provider";
import { RevealReasoningContent } from "../types";

export const revealReasoningAction: Action = {
  name: "REVEAL_REASONING",
  description:
    "Reveal the full reasoning trace for a previously committed hash on SOLPRISM. " +
    "This links a URI (IPFS, Arweave, or HTTP) to the onchain commitment so anyone " +
    "can fetch the reasoning and verify it matches the pre-committed hash.",
  similes: [
    "SOLPRISM_REVEAL",
    "REVEAL_COMMITMENT",
    "PUBLISH_REASONING",
    "DISCLOSE_REASONING",
    "REASONING_REVEAL",
    "SHOW_REASONING",
  ],
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Reveal my reasoning for commitment 7KpX...4Xm2",
          commitmentAddress: "7KpX4Xm2nRtVqBcDeFgHiJkLmNoPqRsT4Xm2",
          reasoningUri: "ipfs://QmX7a9b2c3d4e5f6g7h8i9j0kLmNoPqRsT",
        } as RevealReasoningContent,
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Reasoning revealed! The full trace at ipfs://QmX7a... is now linked to your onchain commitment. Anyone can verify the hash matches.",
          action: "REVEAL_REASONING",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Publish the reasoning for my last commitment",
        } as RevealReasoningContent,
      },
      {
        user: "{{agentName}}",
        content: {
          text: "I've revealed the reasoning trace onchain. The commitment now links to the full reasoning URI for public verification.",
          action: "REVEAL_REASONING",
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
      const content = message.content as RevealReasoningContent;
      const text = content.text?.toLowerCase() ?? "";
      return (
        text.includes("reveal") ||
        text.includes("disclose") ||
        text.includes("publish reasoning") ||
        (content.commitmentAddress != null && content.reasoningUri != null)
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
      const signer = getWallet();
      const content = message.content as RevealReasoningContent;

      // Extract commitment address
      let commitmentAddress = content.commitmentAddress;
      if (!commitmentAddress) {
        // Try to extract from message text
        const addrMatch = content.text?.match(
          /(?:commitment|address)[:\s]+([1-9A-HJ-NP-Za-km-z]{32,44})/i
        );
        if (addrMatch) {
          commitmentAddress = addrMatch[1];
        }
      }

      if (!commitmentAddress) {
        return (
          "❌ Missing commitment address. Please provide the commitment PDA " +
          "address from your COMMIT_REASONING result.\n\n" +
          "Example: `Reveal reasoning for commitment 7KpX...4Xm2 with URI ipfs://...`"
        );
      }

      // Validate the address
      let commitmentPubkey: PublicKey;
      try {
        commitmentPubkey = new PublicKey(commitmentAddress);
      } catch {
        return `❌ Invalid commitment address: "${commitmentAddress}"`;
      }

      // Verify the commitment exists and hasn't been revealed yet
      const commitment = await fetchCommitment(commitmentPubkey);
      if (!commitment) {
        return (
          `❌ Commitment account not found at ${commitmentAddress}. ` +
          `Verify the address is correct.`
        );
      }
      if (commitment.revealed) {
        return (
          `⚠️ This commitment has already been revealed.\n` +
          `**URI:** ${commitment.reasoningUri}\n` +
          `**Action:** ${commitment.actionType} | **Confidence:** ${commitment.confidence}%`
        );
      }

      // Extract reasoning URI
      let reasoningUri = content.reasoningUri;
      if (!reasoningUri) {
        const uriMatch = content.text?.match(
          /(?:uri|url|ipfs|arweave|https?)[:\s]+((?:ipfs|ar|https?):\/\/\S+)/i
        );
        reasoningUri = uriMatch?.[1];
      }

      if (!reasoningUri) {
        return (
          "❌ Missing reasoning URI. Please provide a URI where the full " +
          "reasoning trace is stored (IPFS, Arweave, or HTTP).\n\n" +
          "Example: `Reveal reasoning for commitment <addr> with URI ipfs://Qm...`"
        );
      }

      // Build and send the reveal instruction
      const ix = buildRevealReasoningIx(
        signer.publicKey,
        commitmentPubkey,
        reasoningUri
      );
      const signature = await sendTransaction(ix);

      return (
        `✅ Reasoning revealed onchain!\n\n` +
        `**Commitment:** \`${commitmentAddress}\`\n` +
        `**Reasoning URI:** ${reasoningUri}\n` +
        `**Transaction:** ${signature}\n` +
        `**Action:** ${commitment.actionType} | **Confidence:** ${commitment.confidence}%\n\n` +
        `The full reasoning trace is now publicly linked to the commitment. ` +
        `Anyone can fetch the trace from the URI and use VERIFY_REASONING ` +
        `to confirm the hash matches.`
      );
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown error occurred";

      if (msg.includes("unauthorized") || msg.includes("constraint")) {
        return (
          "❌ Authorization failed. Only the original committer can reveal reasoning. " +
          "Make sure you're using the same wallet that committed the hash."
        );
      }

      return `❌ Failed to reveal reasoning: ${msg}`;
    }
  },
};
