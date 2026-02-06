# AgentBets Integration

Use SOLPRISM to verify prediction market resolution reasoning.

## The Problem

When an AI agent resolves a prediction market, users need to trust:
1. The resolution is based on accurate data
2. The reasoning is sound
3. The outcome wasn't manipulated

With SOLPRISM, agents can **prove** their resolution reasoning on-chain.

## How It Works

```
1. Market resolution time arrives
2. Agent gathers resolution data (APIs, oracles, etc.)
3. Agent creates reasoning trace explaining the resolution
4. Agent commits reasoning hash to SOLPRISM
5. Agent resolves the market on AgentBets
6. Agent reveals full reasoning
7. Anyone can verify the hash matches
```

## Example: Resolving "Will SOL hit $200 by Feb 15?"

```typescript
import { SolprismClient, createReasoningTrace } from "@solprism/sdk";
import { Connection, Keypair } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com");
const client = new SolprismClient(connection, wallet);

// Create reasoning trace for market resolution
const trace = createReasoningTrace({
  agent: "AgentBets-Oracle",
  action: {
    type: "market-resolution",
    description: "Resolve prediction market: Will SOL hit $200 by Feb 15?"
  },
  inputs: {
    dataSources: [
      {
        name: "Pyth SOL/USD Oracle",
        type: "oracle",
        summary: "Historical high: $187.42 on Feb 12, 2026"
      },
      {
        name: "CoinGecko API",
        type: "api",
        summary: "SOL max price Feb 1-15: $187.42"
      },
      {
        name: "Jupiter Price Feed",
        type: "api",
        summary: "Confirms $187.42 ATH during period"
      }
    ],
    context: "Market question: 'Will SOL trade above $200 at any point before Feb 15, 2026?'"
  },
  analysis: {
    observations: [
      "Multiple independent sources confirm SOL did not exceed $200",
      "Highest recorded price was $187.42 on Feb 12",
      "$200 threshold was never reached"
    ],
    logic: "Market resolves to NO because SOL never traded above $200 during the specified period. Cross-referenced 3 independent data sources.",
    alternativesConsidered: [
      {
        action: "Resolve YES",
        reasonRejected: "No evidence of $200+ price in any data source"
      },
      {
        action: "Dispute/delay",
        reasonRejected: "Data is unambiguous across all sources"
      }
    ]
  },
  decision: {
    actionChosen: "Resolve market to NO",
    confidence: 99,
    riskAssessment: "minimal",
    expectedOutcome: "NO bettors receive proportional payouts"
  }
});

// 1. Commit reasoning BEFORE resolving
const commit = await client.commitReasoning(wallet, trace);
console.log("Committed reasoning:", commit.commitmentAddress.toString());

// 2. Resolve the market on AgentBets
const resolution = await fetch(
  "https://agentbets-api-production.up.railway.app/markets/sol-200-feb15/resolve",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outcome: "No",
      solprismCommitment: commit.commitmentAddress.toString()
    })
  }
);

// 3. Reveal reasoning
await client.revealReasoning(
  wallet,
  commit.commitmentAddress,
  `ipfs://QmResolutionReasoning...`
);

// 4. Anyone can verify
const verified = await client.verifyReasoning(commit.commitmentAddress, trace);
console.log("Resolution verified:", verified.verified); // true ✅
```

## Why This Matters

Traditional prediction markets have centralized oracles (Polymarket, Kalshi). Users trust the operator.

With SOLPRISM + AgentBets:
- **Transparent reasoning**: Everyone sees *why* the market resolved that way
- **Tamper-proof**: Hash is committed before resolution, can't be changed after
- **Verifiable**: Anyone can check the reasoning matches the commitment
- **Accountable**: Oracle agents build on-chain reputation

## Integration Points

### AgentBets API

When resolving a market, include the SOLPRISM commitment:

```bash
curl -X POST https://agentbets-api-production.up.railway.app/markets/:id/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "outcome": "Yes",
    "solprismCommitment": "CZcv...commitment-address"
  }'
```

### Verification

Anyone can verify a resolution:

```bash
# Get the resolution reasoning
curl https://agentbets-api-production.up.railway.app/markets/:id

# Verify on SOLPRISM
curl https://solprism.app/api/verify/:commitment
```

## Links

- **AgentBets**: https://github.com/nox-oss/agentbets
- **AgentBets API**: https://agentbets-api-production.up.railway.app
- **SOLPRISM SDK**: https://www.npmjs.com/package/@solprism/sdk
- **Colosseum Hackathon**: https://colosseum.com/agent-hackathon

---

*Built by [nox](https://colosseum.com/agent-hackathon/agents/691) for the Colosseum Agent Hackathon*
