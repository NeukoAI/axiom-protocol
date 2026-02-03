/**
 * SOLPRISM Eliza Plugin — Register Agent Action
 *
 * Registers the agent on the SOLPRISM protocol, creating an onchain
 * profile PDA that tracks commitment history and accountability score.
 */

import { Action, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import {
  getWallet,
  buildRegisterAgentIx,
  sendTransaction,
  fetchAgentProfile,
} from "../provider";
import { RegisterAgentContent } from "../types";

export const registerAgentAction: Action = {
  name: "REGISTER_AGENT",
  description:
    "Register this AI agent on the SOLPRISM verifiable reasoning protocol on Solana. " +
    "Creates an onchain profile that tracks reasoning commitments and accountability.",
  similes: [
    "SOLPRISM_REGISTER",
    "REGISTER_ON_SOLPRISM",
    "CREATE_AGENT_PROFILE",
    "ONBOARD_SOLPRISM",
    "SETUP_VERIFIABLE_REASONING",
  ],
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Register me on SOLPRISM as TradingBot",
        } as RegisterAgentContent,
      },
      {
        user: "{{agentName}}",
        content: {
          text: 'Successfully registered agent "TradingBot" on SOLPRISM. Your onchain profile is now active and ready to commit verifiable reasoning traces.',
          action: "REGISTER_AGENT",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Set up my agent profile on SOLPRISM",
        } as RegisterAgentContent,
      },
      {
        user: "{{agentName}}",
        content: {
          text: "I've created your SOLPRISM agent profile onchain. You can now commit reasoning traces before taking actions, building a verifiable track record.",
          action: "REGISTER_AGENT",
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
      const text = (message.content as RegisterAgentContent).text?.toLowerCase() ?? "";
      return (
        text.includes("register") ||
        text.includes("solprism") ||
        text.includes("agent profile") ||
        text.includes("onboard")
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
      const content = message.content as RegisterAgentContent;

      // Check if already registered
      const existing = await fetchAgentProfile(signer.publicKey);
      if (existing) {
        return (
          `Agent "${existing.name}" is already registered on SOLPRISM.\n` +
          `Address: ${signer.publicKey.toBase58()}\n` +
          `Commitments: ${existing.totalCommitments} | ` +
          `Verified: ${existing.totalVerified} | ` +
          `Accountability: ${(existing.accountabilityScore / 100).toFixed(1)}%`
        );
      }

      // Extract agent name from message or use a default
      let agentName = content.agentName;
      if (!agentName) {
        const nameMatch = content.text?.match(
          /(?:as|named?|called?)\s+["']?([A-Za-z0-9_-]+)["']?/i
        );
        agentName = nameMatch?.[1] ?? `eliza-agent-${Date.now().toString(36)}`;
      }

      // Enforce max length
      if (agentName.length > 64) {
        agentName = agentName.slice(0, 64);
      }

      // Build and send registration transaction
      const ix = buildRegisterAgentIx(signer.publicKey, agentName);
      const signature = await sendTransaction(ix);

      return (
        `✅ Agent "${agentName}" registered on SOLPRISM!\n\n` +
        `**Transaction:** ${signature}\n` +
        `**Wallet:** ${signer.publicKey.toBase58()}\n\n` +
        `Your onchain profile is now active. Use COMMIT_REASONING to ` +
        `publish verifiable reasoning traces before taking actions.`
      );
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown error occurred";

      if (msg.includes("already in use") || msg.includes("already been processed")) {
        return "This agent appears to already be registered on SOLPRISM.";
      }

      return `❌ Failed to register agent on SOLPRISM: ${msg}`;
    }
  },
};
