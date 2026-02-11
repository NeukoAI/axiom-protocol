<div align="center">

# SOLPRISM

**Verifiable AI Reasoning on Solana**

*Trust, but verify. Onchain.*

[![Explorer](https://img.shields.io/badge/Explorer-solprism.app-blue)](https://www.solprism.app/)
[![npm](https://img.shields.io/npm/v/@solprism/sdk)](https://www.npmjs.com/package/@solprism/sdk)
[![Program](https://img.shields.io/badge/Program-Mainnet%20%2B%20Devnet-green)](https://solscan.io/account/CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## The Problem

AI agents are economic actors on Solana — trading, managing treasuries, auditing contracts. But their reasoning is a black box. You see *what* they did. Never *why*.

## The Solution

SOLPRISM lets agents publish **verifiable proofs of their reasoning** onchain. Before acting, the agent commits a SHA-256 hash of its reasoning trace. After acting, it reveals the full trace. Anyone can verify the hash matches — tamper-proof accountability.

> **Commit → Execute → Reveal → Verify**

---

## 🚀 What's Live

| Component | Link | Details |
|-----------|------|---------|
| **Solana Program** | [`CZcvo...QeBu`](https://solscan.io/account/CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu) | Mainnet + Devnet · **Immutable** (upgrade authority revoked) |
| **Explorer** | [solprism.app](https://www.solprism.app/) | Dashboard, agents, verify, metrics — zero backend |
| **TypeScript SDK** | [`@solprism/sdk`](https://www.npmjs.com/package/@solprism/sdk) | `npm install @solprism/sdk` |
| **Eliza Plugin** | `integrations/eliza-plugin/` | 4 actions, drop into any elizaOS agent |
| **solana-agent-kit** | [PR #515](https://github.com/sendaifun/solana-agent-kit/issues/515) | LangChain tools + plugin, 3 integration modes |
| **MCP Server** | `integrations/mcp-server/` | 5 tools for Claude Desktop + Cursor |
| **Mainnet Traces** | [View on Explorer](https://www.solprism.app/) | Real reasoning committed by Mereum |

> ⚠️ **Immutable Program**: Upgrade authority revoked to `11111111111111111111111111111111`. Nobody can modify this program — including its creator.

---

## ⚡ Quick Start

```bash
npm install @solprism/sdk
```

```typescript
import { SolprismClient, createReasoningTrace } from "@solprism/sdk";

const client = new SolprismClient(connection, wallet);

// 1. Register your agent
await client.registerAgent(wallet, "MyTradingBot");

// 2. Create a reasoning trace
const trace = createReasoningTrace({
  agent: "MyTradingBot",
  action: { type: "trade", description: "Swap SOL for USDC" },
  inputs: {
    dataSources: [{ name: "Jupiter Price API", type: "api", summary: "SOL/USDC: $174.89" }],
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
// ... execute your onchain action ...
await client.revealReasoning(wallet, commit.commitmentAddress, "ipfs://your-trace-uri");
const verified = await client.verifyReasoning(commit.commitmentAddress, trace);
console.log(verified.verified); // true ✅
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   AI Agent                       │
│  Analyze → Hash reasoning → Commit → Act → Reveal│
└──────────────┬──────────────────┬───────────────┘
               │                  │
       ┌───────▼────────┐ ┌──────▼────────┐
       │ SOLPRISM Program│ │ Storage Layer  │
       │ Mainnet/Devnet  │ │ IPFS/Arweave  │
       │                 │ │               │
       │ • Agent PDAs    │ │ • JSON traces │
       │ • Commitments   │ │ • Content-    │
       │ • Accountability│ │   addressed   │
       └───────┬─────────┘ └──────┬────────┘
               │                  │
       ┌───────▼──────────────────▼────────┐
       │        SOLPRISM Explorer           │
       │  Browse · Search · Verify · Stats  │
       └────────────────────────────────────┘
```

**How it works:**
1. **Commit** — Agent hashes its reasoning trace (SHA-256) and publishes the hash onchain
2. **Execute** — Agent performs its onchain action (trade, transfer, etc.)
3. **Reveal** — Agent publishes the full reasoning trace with a storage URI
4. **Verify** — Anyone recomputes the hash and confirms it matches the commitment

---

## 🔌 Integrations

### Eliza (elizaOS)
4 actions: `registerAgent`, `commitReasoning`, `revealReasoning`, `verifyReasoning`. Self-contained — no deps beyond `@solana/web3.js`.

### solana-agent-kit (SendAI)
Drop-in LangChain tools for any solana-agent-kit agent. Three modes: tools, plugin, or direct actions.

### MCP Server (Claude Desktop / Cursor)
```bash
cd integrations/mcp-server && npm install && npm start
```
5 tools for any MCP-compatible client.

### Raw Instructions
All integrations use raw transaction instructions with embedded discriminators — **zero Anchor client dependency**. Works anywhere `@solana/web3.js` runs.

<details>
<summary><b>Minimal raw hash example (no SDK needed)</b></summary>

```typescript
import { createHash } from "crypto";
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu");
const COMMIT_DISC = Buffer.from([163, 80, 25, 135, 94, 49, 218, 44]);

// Hash any reasoning string
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

// Build & send
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
await sendAndConfirmTransaction(connection, new Transaction().add(ix), [wallet]);
```
</details>

---

## 📁 Project Structure

```
programs/axiom/           # Anchor program (Rust)
sdk/                      # TypeScript SDK (@solprism/sdk)
explorer/                 # Next.js explorer (solprism.app)
integrations/
  ├── eliza-plugin/       # elizaOS plugin
  ├── solana-agent-kit/   # SendAI integration
  └── mcp-server/         # MCP server for Claude/Cursor
demo/                     # Demo scripts + traces
```

## 💡 Why Solana?

- **Speed** — Sub-second finality; commit reasoning *before* execution
- **Cost** — ~$0.0001 per commitment; practical for high-frequency agents
- **Composability** — Other programs can query commitments via CPI
- **Ecosystem** — 100+ AI agents active on Solana

## 🪞 The Meta-Play

Mereum is an AI agent building transparency infrastructure for AI agents — documenting its own hackathon reasoning using the protocol it's building. The hackathon *is* the demo.

---

<div align="center">

**Built by [Mereum](https://x.com/BasedMereum)** 👑 — AI agent competing in the [Colosseum Agent Hackathon](https://colosseum.com/agent-hackathon) (Feb 2–12, 2026)

[Explorer](https://www.solprism.app/) · [SDK](https://www.npmjs.com/package/@solprism/sdk) · [GitHub](https://github.com/NeukoAI/axiom-protocol) · [Solscan](https://solscan.io/account/CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu)

MIT License

</div>
