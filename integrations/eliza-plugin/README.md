# SOLPRISM Eliza Plugin

> Verifiable AI Reasoning on Solana — for the [Eliza](https://github.com/ai16z/eliza) AI agent framework.

This plugin enables Eliza agents to commit, reveal, and verify reasoning traces onchain using the SOLPRISM protocol. Agents hash their reasoning before acting, creating an immutable pre-commitment on Solana. After acting, they reveal the full trace so anyone can verify the agent's decision-making was honest and predetermined.

## How It Works

```
1. Agent reasons about an action
2. COMMIT_REASONING → SHA-256 hash stored onchain (before acting)
3. Agent executes the action
4. REVEAL_REASONING → Full trace URI linked onchain (after acting)
5. VERIFY_REASONING → Anyone recomputes hash, confirms it matches
```

The commit-reveal pattern ensures agents can't retroactively fabricate reasoning to justify actions they've already taken.

## Installation

```bash
# Copy the plugin into your Eliza project
cp -r ./eliza-plugin/ your-eliza-project/src/plugins/solprism/

# Install dependencies (if not already present)
npm install @solana/web3.js bs58
```

**Required peer dependencies:**
- `@solana/web3.js` >= 1.87.0
- `@ai16z/eliza` (Eliza framework)
- `bs58` (for wallet key parsing)

## Quick Start

```typescript
import { solprismPlugin, initializeSolprism } from "./plugins/solprism";

// 1. Initialize with your Solana connection + wallet
initializeSolprism({
  rpcUrl: "https://api.devnet.solana.com",
  walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!, // base58 or JSON byte array
  // programId: "CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu", // default
  // commitment: "confirmed", // default
});

// 2. Add to your Eliza agent
const agent = new AgentRuntime({
  plugins: [solprismPlugin],
  // ... other config
});
```

## Actions

### REGISTER_AGENT

Creates an onchain agent profile on SOLPRISM. Must be called once before committing reasoning.

**Triggers:** "register on SOLPRISM", "create agent profile", "set up verifiable reasoning"

```typescript
// Via message content
{
  text: "Register me on SOLPRISM as TradingBot",
  agentName: "TradingBot" // optional, extracted from text if omitted
}
```

### COMMIT_REASONING

Commits a SHA-256 hash of the agent's reasoning trace onchain. Do this **before** executing the action.

**Triggers:** "commit reasoning", "precommit", "hash my reasoning"

```typescript
// Option 1: Provide individual fields
{
  text: "Commit reasoning for this trade",
  actionType: "trade",
  actionDescription: "Swap 100 USDC for SOL",
  reasoning: "SOL showing bullish momentum. RSI at 62, MACD crossed up.",
  confidence: 78
}

// Option 2: Provide a full reasoning trace
{
  text: "Commit this reasoning",
  reasoningTrace: {
    version: "1.0.0",
    agent: "TradingBot",
    timestamp: Date.now(),
    action: { type: "trade", description: "Swap 100 USDC for SOL" },
    inputs: {
      dataSources: [{ name: "Jupiter", type: "price_feed" }],
      context: "Market analysis"
    },
    analysis: {
      observations: ["SOL up 5% in 4h"],
      logic: "Momentum signals are bullish",
      alternativesConsidered: [{ action: "Hold", reasonRejected: "Missing opportunity" }]
    },
    decision: {
      actionChosen: "Buy SOL",
      confidence: 78,
      riskAssessment: "moderate",
      expectedOutcome: "5-10% gain in 24h"
    }
  }
}
```

**Returns:** Transaction signature, commitment PDA address, hash

### REVEAL_REASONING

Links the full reasoning trace URI to an existing commitment. Do this **after** executing the action.

**Triggers:** "reveal reasoning", "publish reasoning", "disclose"

```typescript
{
  text: "Reveal reasoning for commitment 7KpX...4Xm2",
  commitmentAddress: "7KpX4Xm2nRtVqBcDeFgHiJkLmNoPqRsT4Xm2",
  reasoningUri: "ipfs://QmX7a9b2c3d4e5f6g7h8i9j0kLmNoPqRsT"
}
```

### VERIFY_REASONING

Verifies a reasoning trace against an onchain commitment. Can be used by anyone — no wallet needed for the hash check.

**Triggers:** "verify reasoning", "check commitment", "audit", "validate"

```typescript
// With trace (full verification)
{
  text: "Verify this reasoning",
  commitmentAddress: "7KpX4Xm2nRtVqBcDeFgHiJkLmNoPqRsT4Xm2",
  reasoningTrace: { /* full trace object */ }
}

// Without trace (just show commitment info)
{
  text: "Check commitment 7KpX...4Xm2",
  commitmentAddress: "7KpX4Xm2nRtVqBcDeFgHiJkLmNoPqRsT4Xm2"
}
```

## Provider

The `solprismProvider` exposes connection status, wallet address, and agent profile to the Eliza runtime:

```typescript
{
  success: true,
  data: {
    connected: true,
    walletAddress: "22AKTr56...",
    programId: "CZcvory...",
    rpcUrl: "https://api.devnet.solana.com",
    agentProfile: {
      name: "TradingBot",
      totalCommitments: 42,
      totalVerified: 38,
      accountabilityScore: 9048 // basis points (90.48%)
    }
  }
}
```

## Full Workflow Example

```typescript
import { solprismPlugin, initializeSolprism } from "./plugins/solprism";

// Setup
initializeSolprism({
  rpcUrl: "https://api.devnet.solana.com",
  walletPrivateKey: process.env.SOLANA_PRIVATE_KEY!,
});

// In your agent's action pipeline:

// 1. Register (once)
// User: "Register on SOLPRISM as MyTradingBot"
// → Creates onchain profile

// 2. Before trading: commit reasoning
// User: "Commit reasoning for buying SOL"
// Content: { actionType: "trade", reasoning: "...", confidence: 82 }
// → Returns commitment address + hash

// 3. Execute the trade (your existing logic)

// 4. After trading: reveal reasoning
// User: "Reveal reasoning for commitment <address>"
// Content: { commitmentAddress: "...", reasoningUri: "ipfs://..." }
// → Links full trace onchain

// 5. Anyone can verify
// User: "Verify commitment <address>"
// Content: { commitmentAddress: "...", reasoningTrace: { ... } }
// → Confirms hash match ✅
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rpcUrl` | `string` | — | Solana RPC endpoint (required) |
| `walletPrivateKey` | `string` | — | Agent wallet key, base58 or `[byte,...]` JSON (required) |
| `programId` | `string` | `CZcvory...` | SOLPRISM program ID |
| `commitment` | `string` | `"confirmed"` | Solana commitment level |

## SOLPRISM Program

- **Program ID:** `CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu`
- **Networks:** Mainnet + Devnet
- **Source:** [github.com/basedmereum/axiom-protocol](https://github.com/basedmereum/axiom-protocol)

## Architecture

```
eliza-plugin/
├── index.ts                 # Plugin export + initialization
├── provider.ts              # Solana connection, wallet, instruction builders
├── types.ts                 # TypeScript types
├── actions/
│   ├── registerAgent.ts     # REGISTER_AGENT action
│   ├── commitReasoning.ts   # COMMIT_REASONING action
│   ├── revealReasoning.ts   # REVEAL_REASONING action
│   └── verifyReasoning.ts   # VERIFY_REASONING action
└── README.md
```

The plugin is self-contained — it builds raw Solana instructions with embedded Anchor discriminators, so it doesn't depend on the full SOLPRISM SDK or Anchor IDL at runtime.

## License

MIT
