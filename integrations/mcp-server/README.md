# SOLPRISM MCP Server

Model Context Protocol server for **SOLPRISM — Verifiable AI Reasoning on Solana**.

Gives Claude, Cursor, and any MCP-compatible client the ability to commit and verify reasoning traces onchain.

## Tools

| Tool | Description |
|------|-------------|
| `solprism_register_agent` | Register an agent on SOLPRISM |
| `solprism_commit_reasoning` | Commit a SHA-256 reasoning hash onchain |
| `solprism_reveal_reasoning` | Reveal reasoning after executing action |
| `solprism_verify_reasoning` | Verify reasoning matches onchain hash |
| `solprism_get_agent` | Get agent profile and commitment count |

## Setup

```bash
cd integrations/mcp-server
npm install
npm run build
```

### Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "solprism": {
      "command": "node",
      "args": ["/path/to/integrations/mcp-server/dist/index.js"],
      "env": {
        "SOLPRISM_RPC_URL": "https://api.mainnet-beta.solana.com",
        "SOLPRISM_KEYPAIR": "/path/to/your/keypair.json"
      }
    }
  }
}
```

### Configure Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "solprism": {
      "command": "node",
      "args": ["./integrations/mcp-server/dist/index.js"],
      "env": {
        "SOLPRISM_RPC_URL": "https://api.mainnet-beta.solana.com",
        "SOLPRISM_KEYPAIR": "~/.config/solana/id.json"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SOLPRISM_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `SOLPRISM_PROGRAM_ID` | `CZcvory...QeBu` | SOLPRISM program ID |
| `SOLPRISM_KEYPAIR` | `~/.config/solana/id.json` | Path to Solana keypair |

## Usage

Once configured, ask Claude or Cursor:

> "Register my agent on SOLPRISM as 'MyAgent'"

> "Commit this reasoning before I execute the trade: {reasoning JSON}"

> "Verify this reasoning matches hash abc123..."

## How It Works

1. **Commit** — Hash your reasoning with SHA-256, publish hash onchain
2. **Execute** — Perform the action your reasoning describes
3. **Reveal** — Publish the full reasoning and storage URI onchain
4. **Verify** — Anyone can recompute the hash and confirm it matches

Program ID: `CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu` (mainnet + devnet)

Explorer: [solprism.app](https://www.solprism.app/)
