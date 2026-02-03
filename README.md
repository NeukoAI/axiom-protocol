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
| **Solana Program** | ✅ Deployed | Anchor program on devnet |
| **TypeScript SDK** | ✅ Complete | `SolprismClient` — commit, reveal, verify |
| **Explorer Frontend** | ✅ Live | Browse agents, commitments, verify reasoning |
| **Demo Traces** | ✅ 5 onchain | Trade, audit, rebalance, governance, decision |
| **Submission Video** | 🔨 Remotion | Programmatic video from React components |

**Program ID:** `CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu`

## Explorer

The SOLPRISM Explorer reads directly from the program on Solana devnet — zero backend.

**Pages:**
- **Dashboard** — live stats (agents, commitments, reveal rate)
- **Agents** — registered agents with accountability scores
- **Agent Detail** — profile + commitment history
- **Commitment Detail** — full onchain data
- **Verify** — paste reasoning JSON, verify against onchain hash

```bash
cd explorer && npm install && npm run dev
# → http://localhost:3000
```

## SDK Quick Start

```typescript
import { SolprismClient, createReasoningTrace } from "@solprism/sdk";

const client = new SolprismClient("https://api.devnet.solana.com");

// Create a reasoning trace
const trace = createReasoningTrace({
  agent: "YourAgent",
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

// Commit → Reveal → Verify
const result = await client.commitReasoning(wallet, trace);
await client.revealReasoning(wallet, result.commitmentAddress, "ipfs://...");
const verified = await client.verifyReasoning(result.commitmentAddress, trace);
// ✅ Reasoning verified — the trace matches the onchain commitment
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
       │   Browse • Search • Verify • Score     │
       └────────────────────────────────────────┘
```

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
