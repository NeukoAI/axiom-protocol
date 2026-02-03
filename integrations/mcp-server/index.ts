#!/usr/bin/env node
/**
 * SOLPRISM MCP Server
 * 
 * Model Context Protocol server that exposes SOLPRISM verifiable reasoning
 * as tools for Claude, Cursor, and any MCP-compatible client.
 * 
 * Tools:
 *   - solprism_register_agent: Register an agent on SOLPRISM
 *   - solprism_commit_reasoning: Commit a reasoning hash onchain
 *   - solprism_reveal_reasoning: Reveal reasoning after action
 *   - solprism_verify_reasoning: Verify a commitment matches reasoning
 *   - solprism_get_agent: Get agent profile and stats
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";

// Config
const PROGRAM_ID = new PublicKey(
  process.env.SOLPRISM_PROGRAM_ID ||
    "CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu"
);
const RPC_URL =
  process.env.SOLPRISM_RPC_URL || "https://api.mainnet-beta.solana.com";

// Anchor discriminators
const DISC = {
  registerAgent: Buffer.from([135, 157, 66, 195, 2, 113, 175, 30]),
  commitReasoning: Buffer.from([163, 80, 25, 135, 94, 49, 218, 44]),
  revealReasoning: Buffer.from([76, 215, 6, 241, 209, 207, 84, 96]),
};

// Load wallet if available
function loadWallet(): Keypair | null {
  const keypairPath =
    process.env.SOLPRISM_KEYPAIR ||
    process.env.SOLANA_KEYPAIR ||
    `${process.env.HOME}/.config/solana/id.json`;
  try {
    const raw = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  } catch {
    return null;
  }
}

function deriveAgentPda(authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), authority.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

function deriveCommitmentPda(
  authority: PublicKey,
  commitId: string
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("commitment"),
      authority.toBuffer(),
      Buffer.from(commitId),
    ],
    PROGRAM_ID
  );
  return pda;
}

function encodeString(s: string): Buffer {
  const buf = Buffer.alloc(4 + s.length);
  buf.writeUInt32LE(s.length, 0);
  buf.write(s, 4);
  return buf;
}

const server = new Server(
  { name: "solprism", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "solprism_register_agent",
      description:
        "Register an agent on the SOLPRISM protocol. Required before committing reasoning.",
      inputSchema: {
        type: "object" as const,
        properties: {
          agentName: {
            type: "string",
            description: "Name of the agent to register",
          },
        },
        required: ["agentName"],
      },
    },
    {
      name: "solprism_commit_reasoning",
      description:
        "Commit a SHA-256 hash of reasoning to the SOLPRISM program onchain. Do this BEFORE executing the action the reasoning describes.",
      inputSchema: {
        type: "object" as const,
        properties: {
          reasoning: {
            type: "string",
            description:
              "JSON string of the reasoning trace to commit. Will be hashed with SHA-256.",
          },
          commitId: {
            type: "string",
            description:
              "Unique identifier for this commitment (e.g. 'trade-eth-2026-02-03')",
          },
        },
        required: ["reasoning", "commitId"],
      },
    },
    {
      name: "solprism_reveal_reasoning",
      description:
        "Reveal the reasoning behind a previous commitment. Do this AFTER executing the action.",
      inputSchema: {
        type: "object" as const,
        properties: {
          commitId: {
            type: "string",
            description: "The commit ID used when committing",
          },
          storageUri: {
            type: "string",
            description:
              "URI where the full reasoning JSON is stored (e.g. IPFS, Arweave, or HTTPS URL)",
          },
        },
        required: ["commitId", "storageUri"],
      },
    },
    {
      name: "solprism_verify_reasoning",
      description:
        "Verify that a reasoning trace matches its onchain commitment. Returns true if hash matches.",
      inputSchema: {
        type: "object" as const,
        properties: {
          reasoning: {
            type: "string",
            description: "The reasoning JSON to verify",
          },
          expectedHash: {
            type: "string",
            description: "The expected SHA-256 hash (hex string)",
          },
        },
        required: ["reasoning", "expectedHash"],
      },
    },
    {
      name: "solprism_get_agent",
      description:
        "Get an agent's SOLPRISM profile including name, registration time, and commitment count.",
      inputSchema: {
        type: "object" as const,
        properties: {
          authority: {
            type: "string",
            description:
              "Solana public key of the agent's authority (wallet address)",
          },
        },
        required: ["authority"],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = loadWallet();

  try {
    switch (name) {
      case "solprism_register_agent": {
        if (!wallet)
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: No wallet configured. Set SOLPRISM_KEYPAIR or SOLANA_KEYPAIR env var.",
              },
            ],
          };

        const agentName = args?.agentName as string;
        const agentPda = deriveAgentPda(wallet.publicKey);

        // Check if already registered
        const existing = await connection.getAccountInfo(agentPda);
        if (existing) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Agent already registered.\nPDA: ${agentPda.toBase58()}\nAuthority: ${wallet.publicKey.toBase58()}`,
              },
            ],
          };
        }

        const data = Buffer.concat([
          DISC.registerAgent,
          encodeString(agentName),
        ]);

        const ix = new TransactionInstruction({
          keys: [
            { pubkey: agentPda, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: PROGRAM_ID,
          data,
        });

        const tx = new Transaction().add(ix);
        tx.feePayer = wallet.publicKey;
        tx.recentBlockhash = (
          await connection.getLatestBlockhash()
        ).blockhash;
        tx.sign(wallet);

        const sig = await connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: true,
        });
        await connection.confirmTransaction(sig, "confirmed");

        return {
          content: [
            {
              type: "text" as const,
              text: `Agent "${agentName}" registered on SOLPRISM.\nPDA: ${agentPda.toBase58()}\nTransaction: ${sig}`,
            },
          ],
        };
      }

      case "solprism_commit_reasoning": {
        if (!wallet)
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: No wallet configured. Set SOLPRISM_KEYPAIR env var.",
              },
            ],
          };

        const reasoning = args?.reasoning as string;
        const commitId = args?.commitId as string;

        const hash = createHash("sha256").update(reasoning).digest();
        const agentPda = deriveAgentPda(wallet.publicKey);
        const commitPda = deriveCommitmentPda(wallet.publicKey, commitId);

        const data = Buffer.concat([
          DISC.commitReasoning,
          hash,
          encodeString(commitId),
        ]);

        const ix = new TransactionInstruction({
          keys: [
            { pubkey: commitPda, isSigner: false, isWritable: true },
            { pubkey: agentPda, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: PROGRAM_ID,
          data,
        });

        const tx = new Transaction().add(ix);
        tx.feePayer = wallet.publicKey;
        tx.recentBlockhash = (
          await connection.getLatestBlockhash()
        ).blockhash;
        tx.sign(wallet);

        const sig = await connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: true,
        });
        await connection.confirmTransaction(sig, "confirmed");

        return {
          content: [
            {
              type: "text" as const,
              text: `Reasoning committed on SOLPRISM.\nCommit ID: ${commitId}\nHash: ${hash.toString("hex")}\nPDA: ${commitPda.toBase58()}\nTransaction: ${sig}\n\nNow execute your action, then call solprism_reveal_reasoning to reveal.`,
            },
          ],
        };
      }

      case "solprism_reveal_reasoning": {
        if (!wallet)
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: No wallet configured. Set SOLPRISM_KEYPAIR env var.",
              },
            ],
          };

        const commitId = args?.commitId as string;
        const storageUri = args?.storageUri as string;

        const agentPda = deriveAgentPda(wallet.publicKey);
        const commitPda = deriveCommitmentPda(wallet.publicKey, commitId);

        const data = Buffer.concat([
          DISC.revealReasoning,
          encodeString(storageUri),
        ]);

        const ix = new TransactionInstruction({
          keys: [
            { pubkey: commitPda, isSigner: false, isWritable: true },
            { pubkey: agentPda, isSigner: false, isWritable: true },
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          ],
          programId: PROGRAM_ID,
          data,
        });

        const tx = new Transaction().add(ix);
        tx.feePayer = wallet.publicKey;
        tx.recentBlockhash = (
          await connection.getLatestBlockhash()
        ).blockhash;
        tx.sign(wallet);

        const sig = await connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: true,
        });
        await connection.confirmTransaction(sig, "confirmed");

        return {
          content: [
            {
              type: "text" as const,
              text: `Reasoning revealed.\nCommit ID: ${commitId}\nStorage: ${storageUri}\nTransaction: ${sig}`,
            },
          ],
        };
      }

      case "solprism_verify_reasoning": {
        const reasoning = args?.reasoning as string;
        const expectedHash = args?.expectedHash as string;

        const actualHash = createHash("sha256")
          .update(reasoning)
          .digest("hex");
        const matches = actualHash === expectedHash;

        return {
          content: [
            {
              type: "text" as const,
              text: `Verification ${matches ? "PASSED ✅" : "FAILED ❌"}\nExpected: ${expectedHash}\nActual:   ${actualHash}\n${matches ? "Reasoning matches the onchain commitment." : "WARNING: Reasoning does NOT match. The reasoning may have been altered after commitment."}`,
            },
          ],
        };
      }

      case "solprism_get_agent": {
        const authority = new PublicKey(args?.authority as string);
        const agentPda = deriveAgentPda(authority);
        const account = await connection.getAccountInfo(agentPda);

        if (!account) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No SOLPRISM agent found for authority ${authority.toBase58()}`,
              },
            ],
          };
        }

        // Parse agent account data (Anchor format: 8-byte discriminator + fields)
        const data = account.data;
        const authorityBytes = data.subarray(8, 40);
        const nameLen = data.readUInt32LE(40);
        const agentName = data.subarray(44, 44 + nameLen).toString("utf-8");
        const commitCount = data.readUInt32LE(44 + nameLen);

        return {
          content: [
            {
              type: "text" as const,
              text: `SOLPRISM Agent Profile\nName: ${agentName}\nAuthority: ${new PublicKey(authorityBytes).toBase58()}\nPDA: ${agentPda.toBase58()}\nCommitments: ${commitCount}`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            { type: "text" as const, text: `Unknown tool: ${name}` },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SOLPRISM MCP Server running on stdio");
}

main().catch(console.error);
