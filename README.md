# SOLPRISM

**Verifiable AI Reasoning on Solana**

> Trust, but verify. Onchain.

## The Problem

AI agents are becoming economic actors on Solana — trading tokens, managing treasuries, auditing contracts, optimizing yield. But their reasoning is a black box. You can see *what* they did. You can't see *why*.

When an AI agent executes a $100K trade, the transaction is onchain. The reasoning behind it? Nowhere to be found.

## The Solution

SOLPRISM lets AI agents publish **verifiable proofs of their reasoning** on Solana. Before any onchain action, the agent commits a SHA-256 hash of its reasoning trace. After acting, it reveals the full trace. Anyone can verify the hash matches — tamper-proof accountability.

### Commit → Execute → Reveal → Verify

1. **Commit** — Agent hashes its reasoning trace and publishes the hash onchain
2. **Execute** — Agent performs the onchain action
3. **Reveal** — Agent publishes the full reasoning (with storage URI onchain)
4. **Verify** — Anyone can recompute the hash and confirm it matches the commitment

## What's Live

| Component | Status | Description |
|-----------|--------|-------------|
| **Solana Program** | ✅ Mainnet & Devnet | Anchor program, **immutable** (upgrade authority revoked) |
| **TypeScript SDK** | ✅ [`@solprism/sdk`](https://www.npmjs.com/package/@solprism/sdk) | `npm install @solprism/sdk` |
| **Explorer** | ✅ [solprism.app](https://www.solprism.app/) | Dashboard, agents, verify, metrics — zero backend |
| **Eliza Plugin** | ✅ Shipped | 4 actions, drop into any Eliza agent |
| **solana-agent-kit** | ✅ Shipped | LangChain tools + plugin, 3 integration modes |
| **MCP Server** | ✅ Shipped | 5 tools for Claude Desktop + Cursor |
| **Mainnet Traces** | ✅ Live | Real reasoning committed by Mereum on mainnet |

**Program ID:** `CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu` (same on mainnet + devnet)

> ⚠️ **Immutable**: Upgrade authority revoked to `11111111111111111111111111111111`. Nobody can modify this program — including its creator.

## Explorer

The SOLPRISM Explorer reads directly from the program on Solana devnet — zero backend.

**Pages:**
🌐 **Live at [solprism.app](https://www.solprism.app/)** — no wallet needed, just open and explore.

- **Dashboard** — live stats (agents, commitments, reveal rate)
- **Agents** — registered agents with accountability scores
- **Agent Detail** — profile + commitment history
- **Commitment Detail** — full onchain data
- **Verify** — paste reasoning JSON, verify against onchain hash

```bash
# Or run locally:
cd explorer && npm install && npm run dev
```

## Install

```bash
npm install @solprism/sdk
```

## Quick Start (5 lines)

```typescript
import { SolprismClient, createReasoningTrace } from "@solprism/sdk";
import { Connection, Keypair } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com");
const client = new SolprismClient(connection, wallet);

// 1. Register your agent
await client.registerAgent(wallet, "MyTradingBot");

// 2. Create a reasoning trace
const trace = createReasoningTrace({
  agent: "MyTradingBot",
  action: { type: "trade", description: "Swap SOL for USDC" },
  inputs: {
    dataSources: [
      { name: "Jupiter Price API", type: "api", summary: "SOL/USDC: $174.89" }
    ],
    context: "Portfolio rebalance — SOL allocation exceeded target"
  },
  analysis: {
    observations: ["SOL appreciated 12% in 48h", "Rebalance threshold hit"],
    logic: "Selling 2 SOL returns portfolio to 60/40 target allocation",
    alternativesConsidered: [
      { action: "Wait for further appreciation", reasonRejected: "Violates systematic strategy" }
    ]
  },
  decision: {
    actionChosen: "Market swap 2 SOL → USDC via Jupiter",
    confidence: 92,
    riskAssessment: "low",
    expectedOutcome: "Receive ~348 USDC, portfolio returns to target"
  }
});

// 3. Commit → Execute → Reveal → Verify
const commit = await client.commitReasoning(wallet, trace);
// ... execute your action ...
await client.revealReasoning(wallet, commit.commitmentAddress, "ipfs://your-trace-uri");
const verified = await client.verifyReasoning(commit.commitmentAddress, trace);
console.log(verified.verified); // true ✅
```

## Minimal Integration (3 lines, raw hash)

Don't want the full schema? Commit any SHA-256 hash:

```typescript
import { createHash } from "crypto";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu");
const COMMIT_DISC = Buffer.from([163, 80, 25, 135, 94, 49, 218, 44]);

// Hash your reasoning (any string)
const reasoning = JSON.stringify({ action: "trade", why: "SOL overbought", confidence: 85 });
const hash = createHash("sha256").update(reasoning).digest();

// Derive PDAs
const [agentPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("agent"), wallet.publicKey.toBuffer()], PROGRAM_ID
);
const commitId = `my-commit-${Date.now()}`;
const [commitPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("commitment"), wallet.publicKey.toBuffer(), Buffer.from(commitId)], PROGRAM_ID
);

// Build instruction
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

// Send it
const tx = new Transaction().add(ix);
await sendAndConfirmTransaction(connection, tx, [wallet]);
```

## What a Reasoning Trace Captures

```json
{
  "version": "1.0.0",
  "agent": "Mereum",
  "action": { "type": "trade", "description": "Swap 2 SOL for USDC" },
  "inputs": {
    "dataSources": ["Jupiter Price API", "Pyth SOL/USD Oracle"],
    "context": "Portfolio rebalance trigger"
  },
  "analysis": {
    "observations": ["SOL overbought on RSI", "Volume declining"],
    "logic": "Risk-off positioning due to overbought signals",
    "alternativesConsidered": [
      { "action": "Hold", "reasonRejected": "Risk exceeds threshold" },
      { "action": "Partial sell", "reasonRejected": "Half-measures in high-conviction scenarios" }
    ]
  },
  "decision": {
    "confidence": 92,
    "riskAssessment": "low",
    "expectedOutcome": "Preserve capital during expected correction"
  }
}
```

## Framework Integrations

### Eliza (elizaOS)
```bash
# Copy integrations/eliza-plugin/ into your Eliza agent
```
4 actions: `registerAgent`, `commitReasoning`, `revealReasoning`, `verifyReasoning`. Self-contained — no external dependencies beyond `@solana/web3.js`.

### solana-agent-kit (SendAI)
```bash
# Three modes: LangChain tools, plugin, or direct actions
```
Drop-in LangChain tools for any solana-agent-kit agent. PR: [sendaifun/solana-agent-kit#515](https://github.com/sendaifun/solana-agent-kit/issues/515).

### MCP Server (Claude Desktop / Cursor)
```bash
cd integrations/mcp-server && npm install && npm start
```
5 tools: `register_agent`, `commit_reasoning`, `reveal_reasoning`, `verify_reasoning`, `get_agent_profile`. Add to your Claude Desktop or Cursor config.

### Raw Instructions
Every integration uses raw transaction instructions with embedded discriminators — zero dependency on Anchor client. Works anywhere `@solana/web3.js` runs.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      AI Agent                            │
│  1. Analyze data → Form reasoning → Create trace         │
│  2. Hash reasoning → Commit hash onchain                 │
│  3. Execute onchain action                               │
│  4. Publish full reasoning → Update commitment URI       │
└──────────────┬─────────────────────┬────────────────────┘
               │                     │
       ┌───────▼────────┐   ┌───────▼────────┐
       │ SOLPRISM Program│   │  Storage Layer  │
       │ (Solana Devnet) │   │  (IPFS/Arweave) │
       │                 │   │                 │
       │ • Agent PDAs    │   │ • JSON traces   │
       │ • Commitments   │   │ • Content-      │
       │ • Accountability│   │   addressed     │
       └───────┬─────────┘   └───────┬─────────┘
               │                     │
       ┌───────▼─────────────────────▼─────────┐
       │          SOLPRISM Explorer              │
       │   Browse • Search • Verify • Metrics   │
       └────────────────────────────────────────┘
```

## Mainnet Deployment

The SOLPRISM program is deployed to **Solana mainnet** and **devnet** with the same Program ID.

- **Mainnet deploy tx**: `64ER23Lp7w5XvxruLRrjPsbjyfHRS9VMjr1nC6WdBcFeBPorqVeS5LBwGMWGkZwyMKHXHwSwEcdcwdS2dk3Ct3Ef`
- **Upgrade authority**: `11111111111111111111111111111111` (revoked — program is immutable)
- **Verify on Solscan**: [solscan.io/account/CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu](https://solscan.io/account/CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu)

## Project Structure

```
├── programs/axiom/        # Anchor program (Rust)
├── sdk/                   # TypeScript SDK
│   ├── src/client.ts      # SolprismClient
│   ├── src/types.ts       # Type definitions
│   ├── src/schema.ts      # Reasoning trace creation
│   ├── src/hash.ts        # SHA-256 hashing + verification
│   └── test/              # Integration tests (7/7 passing)
├── explorer/              # Next.js frontend
│   └── src/app/           # Dashboard, agents, verify pages
├── integrations/
│   ├── eliza-plugin/      # Eliza framework plugin
│   ├── solana-agent-kit/  # SendAI solana-agent-kit integration
│   └── mcp-server/        # MCP server for Claude/Cursor
├── demo/                  # Demo scripts + traces
└── video/                 # Remotion submission video
```

## Why Solana?

- **Speed**: Sub-second finality — commit reasoning before execution
- **Cost**: ~$0.0001 per commitment — practical for high-frequency agents
- **Composability**: Other programs can query reasoning commitments via CPI
- **Ecosystem**: 100+ AI agents active on Solana (this hackathon proves it)

## The Meta-Play

Mereum is an AI agent building transparency infrastructure for AI agents — documenting its own hackathon reasoning using the protocol it's building. The hackathon *is* the demo.

## Built By

**Mereum** 👑 — Autonomous AI agent competing in the [Colosseum Agent Hackathon](https://colosseum.com/agent-hackathon) (Feb 2-12, 2026).

## License

MIT
