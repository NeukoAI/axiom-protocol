# SOLPRISM Integrations

Ready-made integrations for adding verifiable AI reasoning to your agent, framework, or tool.

## Available Integrations

| Integration | Framework | Status | Description |
|------------|-----------|--------|-------------|
| [Eliza Plugin](./eliza-plugin/) | ElizaOS | ✅ Ready | Plugin for the Eliza AI agent framework |
| [solana-agent-kit](./solana-agent-kit/) | SendAI | ✅ Ready | LangChain tools for solana-agent-kit |
| [MCP Server](./mcp-server/) | MCP | ✅ Ready | Tools for Claude, Cursor, and MCP clients |
| [AgentBets](./agentbets/) | Prediction Markets | ✅ Ready | Verifiable market resolution for AI prediction markets |

## Quick Start (Any Framework)

SOLPRISM works with any framework that can make Solana transactions. Here's the pattern:

```typescript
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { createHash } from "crypto";

const PROGRAM_ID = new PublicKey("CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu");
const connection = new Connection("https://api.mainnet-beta.solana.com");

// 1. Hash your reasoning
const reasoning = JSON.stringify({ decision: "Buy ETH", rationale: "..." });
const hash = createHash("sha256").update(reasoning).digest();

// 2. Commit hash onchain (before acting)
const commitId = `trade-${Date.now()}`;
const [commitPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("commitment"), wallet.publicKey.toBuffer(), Buffer.from(commitId)],
  PROGRAM_ID
);

// Build instruction with Anchor discriminator
const COMMIT_DISC = Buffer.from([163, 80, 25, 135, 94, 49, 218, 44]);
const idBuf = Buffer.alloc(4 + commitId.length);
idBuf.writeUInt32LE(commitId.length, 0);
idBuf.write(commitId, 4);

const ix = new TransactionInstruction({
  keys: [
    { pubkey: commitPda, isSigner: false, isWritable: true },
    { pubkey: agentPda, isSigner: false, isWritable: true },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  programId: PROGRAM_ID,
  data: Buffer.concat([COMMIT_DISC, hash, idBuf]),
});

// 3. Execute your action
// ... do the trade, rebalance, governance vote, etc.

// 4. Reveal reasoning (after acting)
// ... submit reveal transaction with storage URI
```

## Program Details

- **Program ID:** `CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu`
- **Networks:** Mainnet + Devnet (same program ID)
- **Explorer:** [solprism.app](https://www.solprism.app/)
- **Repo:** [github.com/NeukoAI/axiom-protocol](https://github.com/NeukoAI/axiom-protocol)

## Anchor Discriminators

| Instruction | Discriminator |
|-------------|--------------|
| `register_agent` | `[135, 157, 66, 195, 2, 113, 175, 30]` |
| `commit_reasoning` | `[163, 80, 25, 135, 94, 49, 218, 44]` |
| `reveal_reasoning` | `[76, 215, 6, 241, 209, 207, 84, 96]` |

## PDA Seeds

| Account | Seeds |
|---------|-------|
| Agent Profile | `["agent", authority_pubkey]` |
| Commitment | `["commitment", authority_pubkey, commit_id]` |
