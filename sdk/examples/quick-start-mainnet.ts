/**
 * SOLPRISM Quick Start — Mainnet Integration
 * 
 * This example shows how to integrate SOLPRISM into your agent for mainnet.
 * Copy this pattern to add verifiable reasoning to any Solana agent.
 */

import { SolprismClient, createReasoningTrace } from '@solprism/sdk';
import { Keypair, Connection } from '@solana/web3.js';

// ─── Configuration ────────────────────────────────────────────────────────

const MAINNET_RPC = process.env.MAINNET_RPC || 'https://api.mainnet-beta.solana.com';

// Your agent's keypair (use your existing wallet)
// NEVER commit private keys to code - use environment variables
const AGENT_KEYPAIR = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.AGENT_KEYPAIR || '[]'))
);

// ─── Setup ────────────────────────────────────────────────────────────────

async function main() {
  // Initialize SOLPRISM client for mainnet
  const client = new SolprismClient({
    rpc: MAINNET_RPC,
    network: 'mainnet-beta',
  });

  const connection = new Connection(MAINNET_RPC, 'confirmed');

  // Step 1: Register your agent (one-time)
  // This creates an onchain identity for your agent
  console.log('Registering agent...');
  const registration = await client.registerAgent(AGENT_KEYPAIR, 'MyAgent');
  console.log('Agent registered:', registration.agentProfile);

  // Step 2: Before ANY economic action, commit your reasoning
  // This creates an immutable hash of your decision process
  const reasoning = createReasoningTrace({
    agentId: 'MyAgent',
    context: {
      task: 'Execute swap on Jupiter',
      environment: 'mainnet',
      inputs: {
        inputMint: 'So11111111111111111111111111111111111111112',  // SOL
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        amount: 1.0,
        slippage: 0.5,
      },
    },
    reasoning: {
      steps: [
        { step: 1, thought: 'SOL price showing strength, time to take profit' },
        { step: 2, thought: 'Jupiter has best route with 0.1% price impact' },
        { step: 3, thought: 'Slippage 0.5% acceptable for this size' },
      ],
      conclusion: 'Execute swap: 1 SOL → USDC via Jupiter',
    },
    decision: {
      action: 'swap',
      confidence: 85,
      alternatives: [
        { action: 'hold', reason: 'Wait for better rate' },
        { action: 'partial_swap', reason: 'DCA approach' },
      ],
    },
    action: {
      type: 'jupiter_swap',
      params: {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 1.0,
      },
      expectedOutcome: 'Receive ~X USDC',
    },
  });

  console.log('Committing reasoning...');
  const commitment = await client.commitReasoning(AGENT_KEYPAIR, reasoning);
  console.log('Reasoning committed!');
  console.log('  Commitment address:', commitment.commitmentAddress);
  console.log('  Hash:', commitment.commitmentHash);
  console.log('  Tx:', commitment.signature);

  // Step 3: Execute your action
  // ... your Jupiter swap code here ...
  console.log('Executing swap... (your code here)');

  // Step 4: (Optional) Reveal the full reasoning
  // This makes your reasoning publicly auditable
  const reasoningJson = JSON.stringify(reasoning);
  const reasoningUri = `data:application/json;base64,${Buffer.from(reasoningJson).toString('base64')}`;
  
  console.log('Revealing reasoning...');
  const reveal = await client.revealReasoning(
    AGENT_KEYPAIR,
    commitment.commitmentAddress,
    reasoningUri
  );
  console.log('Reasoning revealed:', reveal.signature);

  // Step 5: Anyone can now verify
  console.log('\nVerification:');
  const verification = await client.verifyReasoning(
    commitment.commitmentAddress,
    reasoning
  );
  console.log('Valid:', verification.valid);
  console.log('Message:', verification.message);
}

main().catch(console.error);
