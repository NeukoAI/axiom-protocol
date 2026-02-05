# SOLPRISM Verification API

Public API for verifying AI reasoning onchain. No authentication required — verification is trustless.

## Endpoints

### Health Check
```bash
GET /health
```

### Get Commitment
```bash
GET /v1/commitment/:address?network=devnet|mainnet
```

### Get Agent
```bash
GET /v1/agent/:authority?network=devnet|mainnet
```

### List Agent Commitments
```bash
GET /v1/agent/:authority/commitments?network=devnet|mainnet&limit=10
```

### Verify Reasoning
```bash
POST /v1/verify
Content-Type: application/json

{
  "commitmentAddress": "...",
  "reasoning": { /* ReasoningTrace object */ },
  "network": "devnet" | "mainnet"
}
```

### Compute Hash
```bash
POST /v1/hash
Content-Type: application/json

{
  "reasoning": { /* ReasoningTrace object */ }
}
```

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production
npm run build
npm start
```

## Environment Variables

- `PORT` — Server port (default: 3001)
- `MAINNET_RPC` — Mainnet RPC URL
- `DEVNET_RPC` — Devnet RPC URL

## Example: Verify Reasoning

```bash
curl -X POST https://api.solprism.app/v1/verify \
  -H "Content-Type: application/json" \
  -d '{
    "commitmentAddress": "YOUR_COMMITMENT_ADDRESS",
    "reasoning": {
      "version": "1.0",
      "agentId": "my-agent",
      "timestamp": "2026-02-05T12:00:00Z",
      "context": {
        "task": "Execute trade",
        "environment": "mainnet",
        "inputs": {"pair": "SOL/USDC", "amount": 1.0}
      },
      "reasoning": {
        "steps": [
          {"step": 1, "thought": "Market conditions favorable"}
        ],
        "conclusion": "Execute buy order"
      },
      "decision": {
        "action": "buy",
        "confidence": 85
      },
      "action": {
        "type": "trade",
        "params": {"pair": "SOL/USDC", "side": "buy", "amount": 1.0},
        "expectedOutcome": "Acquire 1 SOL"
      }
    },
    "network": "mainnet"
  }'
```

## Response

```json
{
  "valid": true,
  "network": "mainnet",
  "commitmentAddress": "...",
  "computedHash": "abc123...",
  "storedHash": "abc123...",
  "commitment": {
    "agent": "...",
    "actionType": "trade",
    "confidence": 85,
    "commitSlot": 123456789,
    "revealed": false,
    "reasoningUri": null
  },
  "message": "✅ Verified — reasoning matches onchain commitment"
}
```

## License

MIT
