/**
 * SOLPRISM Verification API
 * 
 * Public endpoints for verifying AI reasoning onchain.
 * No authentication required — verification is trustless.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { Connection, PublicKey } from '@solana/web3.js';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// ─── Configuration ────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
const MAINNET_RPC = process.env.MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
const DEVNET_RPC = process.env.DEVNET_RPC || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu');

// Account discriminators
const AGENT_DISCRIMINATOR = Buffer.from([60, 227, 42, 24, 0, 87, 86, 205]);
const COMMITMENT_DISCRIMINATOR = Buffer.from([67, 22, 65, 98, 26, 124, 5, 25]);

// ─── Types ────────────────────────────────────────────────────────────────

interface ReasoningTrace {
  version: string;
  agentId: string;
  timestamp: string;
  context: {
    task: string;
    environment: string;
    inputs: Record<string, unknown>;
  };
  reasoning: {
    steps: Array<{
      step: number;
      thought: string;
      evidence?: string[];
    }>;
    conclusion: string;
  };
  decision: {
    action: string;
    confidence: number;
    alternatives?: Array<{
      action: string;
      reason: string;
    }>;
  };
  action: {
    type: string;
    params: Record<string, unknown>;
    expectedOutcome: string;
  };
}

interface OnChainCommitment {
  agent: string;
  commitmentHash: number[];
  actionType: string;
  confidence: number;
  commitSlot: number;
  revealed: boolean;
  reasoningUri: string | null;
}

interface OnChainAgent {
  authority: string;
  name: string;
  totalCommitments: number;
  createdAt: number;
}

// ─── Utility Functions ────────────────────────────────────────────────────

function getConnection(network: 'mainnet' | 'devnet'): Connection {
  return new Connection(network === 'mainnet' ? MAINNET_RPC : DEVNET_RPC, 'confirmed');
}

function hashTrace(trace: ReasoningTrace): Buffer {
  const canonical = JSON.stringify(trace, Object.keys(trace).sort());
  return crypto.createHash('sha256').update(canonical).digest();
}

function hashTraceHex(trace: ReasoningTrace): string {
  return hashTrace(trace).toString('hex');
}

async function parseCommitmentAccount(data: Buffer): Promise<OnChainCommitment | null> {
  if (data.length < 8 || !data.subarray(0, 8).equals(COMMITMENT_DISCRIMINATOR)) {
    return null;
  }

  let offset = 8;
  
  // agent: Pubkey (32 bytes)
  const agent = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;

  // commitment_hash: [u8; 32]
  const commitmentHash = Array.from(data.subarray(offset, offset + 32));
  offset += 32;

  // action_type: String (4 byte len + bytes)
  const actionTypeLen = data.readUInt32LE(offset);
  offset += 4;
  const actionType = data.subarray(offset, offset + actionTypeLen).toString('utf-8');
  offset += actionTypeLen;

  // confidence: u8
  const confidence = data.readUInt8(offset);
  offset += 1;

  // commit_slot: u64
  const commitSlot = Number(data.readBigUInt64LE(offset));
  offset += 8;

  // revealed: bool
  const revealed = data.readUInt8(offset) === 1;
  offset += 1;

  // reasoning_uri: Option<String>
  let reasoningUri: string | null = null;
  const hasUri = data.readUInt8(offset) === 1;
  offset += 1;
  if (hasUri) {
    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    reasoningUri = data.subarray(offset, offset + uriLen).toString('utf-8');
  }

  return {
    agent,
    commitmentHash,
    actionType,
    confidence,
    commitSlot,
    revealed,
    reasoningUri,
  };
}

async function parseAgentAccount(data: Buffer): Promise<OnChainAgent | null> {
  if (data.length < 8 || !data.subarray(0, 8).equals(AGENT_DISCRIMINATOR)) {
    return null;
  }

  let offset = 8;

  // authority: Pubkey (32 bytes)
  const authority = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;

  // name: String
  const nameLen = data.readUInt32LE(offset);
  offset += 4;
  const name = data.subarray(offset, offset + nameLen).toString('utf-8');
  offset += nameLen;

  // total_commitments: u64
  const totalCommitments = Number(data.readBigUInt64LE(offset));
  offset += 8;

  // created_at: i64
  const createdAt = Number(data.readBigInt64LE(offset));

  return {
    authority,
    name,
    totalCommitments,
    createdAt,
  };
}

// ─── API Routes ───────────────────────────────────────────────────────────

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'SOLPRISM Verification API',
    version: '0.1.0',
    programId: PROGRAM_ID.toBase58()
  });
});

// Get commitment by address
app.get('/v1/commitment/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const network = (req.query.network as string) === 'mainnet' ? 'mainnet' : 'devnet';
    
    const connection = getConnection(network);
    const pubkey = new PublicKey(address);
    
    const accountInfo = await connection.getAccountInfo(pubkey);
    if (!accountInfo) {
      return res.status(404).json({ error: 'Commitment not found', address });
    }

    const commitment = await parseCommitmentAccount(accountInfo.data);
    if (!commitment) {
      return res.status(400).json({ error: 'Invalid commitment account', address });
    }

    res.json({
      network,
      address,
      commitment,
      hashHex: Buffer.from(commitment.commitmentHash).toString('hex'),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get agent by authority
app.get('/v1/agent/:authority', async (req: Request, res: Response) => {
  try {
    const { authority } = req.params;
    const network = (req.query.network as string) === 'mainnet' ? 'mainnet' : 'devnet';
    
    const connection = getConnection(network);
    const authorityPubkey = new PublicKey(authority);
    
    // Derive agent PDA
    const [agentPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), authorityPubkey.toBuffer()],
      PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(agentPDA);
    if (!accountInfo) {
      return res.status(404).json({ error: 'Agent not found', authority, pda: agentPDA.toBase58() });
    }

    const agent = await parseAgentAccount(accountInfo.data);
    if (!agent) {
      return res.status(400).json({ error: 'Invalid agent account', authority });
    }

    res.json({
      network,
      authority,
      pda: agentPDA.toBase58(),
      agent,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify reasoning against commitment
app.post('/v1/verify', async (req: Request, res: Response) => {
  try {
    const { commitmentAddress, reasoning, network: networkParam } = req.body;
    
    if (!commitmentAddress || !reasoning) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['commitmentAddress', 'reasoning'] 
      });
    }

    const network = networkParam === 'mainnet' ? 'mainnet' : 'devnet';
    const connection = getConnection(network);
    
    // Fetch commitment
    const pubkey = new PublicKey(commitmentAddress);
    const accountInfo = await connection.getAccountInfo(pubkey);
    
    if (!accountInfo) {
      return res.status(404).json({ 
        valid: false,
        error: 'Commitment not found onchain',
        commitmentAddress 
      });
    }

    const commitment = await parseCommitmentAccount(accountInfo.data);
    if (!commitment) {
      return res.status(400).json({ 
        valid: false,
        error: 'Invalid commitment account',
        commitmentAddress 
      });
    }

    // Compute hash of provided reasoning
    const computedHash = hashTraceHex(reasoning);
    const storedHash = Buffer.from(commitment.commitmentHash).toString('hex');
    
    // Compare
    const valid = computedHash === storedHash;

    res.json({
      valid,
      network,
      commitmentAddress,
      computedHash,
      storedHash,
      commitment: {
        agent: commitment.agent,
        actionType: commitment.actionType,
        confidence: commitment.confidence,
        commitSlot: commitment.commitSlot,
        revealed: commitment.revealed,
        reasoningUri: commitment.reasoningUri,
      },
      message: valid 
        ? '✅ Verified — reasoning matches onchain commitment'
        : '❌ Mismatch — reasoning does not match onchain commitment',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Compute hash (utility endpoint)
app.post('/v1/hash', (req: Request, res: Response) => {
  try {
    const { reasoning } = req.body;
    
    if (!reasoning) {
      return res.status(400).json({ error: 'Missing reasoning in request body' });
    }

    const hash = hashTraceHex(reasoning);
    
    res.json({
      hash,
      canonical: JSON.stringify(reasoning, Object.keys(reasoning).sort()),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List recent commitments for an agent
app.get('/v1/agent/:authority/commitments', async (req: Request, res: Response) => {
  try {
    const { authority } = req.params;
    const network = (req.query.network as string) === 'mainnet' ? 'mainnet' : 'devnet';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    
    const connection = getConnection(network);
    const authorityPubkey = new PublicKey(authority);
    
    // Derive agent PDA
    const [agentPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), authorityPubkey.toBuffer()],
      PROGRAM_ID
    );

    // Get agent to find total commitments
    const agentInfo = await connection.getAccountInfo(agentPDA);
    if (!agentInfo) {
      return res.status(404).json({ error: 'Agent not found', authority });
    }

    const agent = await parseAgentAccount(agentInfo.data);
    if (!agent) {
      return res.status(400).json({ error: 'Invalid agent account', authority });
    }

    // Fetch recent commitments
    const commitments = [];
    const startNonce = Math.max(0, agent.totalCommitments - limit);
    
    for (let nonce = agent.totalCommitments - 1; nonce >= startNonce && commitments.length < limit; nonce--) {
      const nonceBuf = Buffer.alloc(8);
      nonceBuf.writeBigUInt64LE(BigInt(nonce));
      
      const [commitmentPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('commitment'), agentPDA.toBuffer(), nonceBuf],
        PROGRAM_ID
      );

      const commitInfo = await connection.getAccountInfo(commitmentPDA);
      if (commitInfo) {
        const commitment = await parseCommitmentAccount(commitInfo.data);
        if (commitment) {
          commitments.push({
            address: commitmentPDA.toBase58(),
            nonce,
            ...commitment,
            hashHex: Buffer.from(commitment.commitmentHash).toString('hex'),
          });
        }
      }
    }

    res.json({
      network,
      authority,
      agentPda: agentPDA.toBase58(),
      agent,
      commitments,
      totalCommitments: agent.totalCommitments,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    SOLPRISM Verification API                   ║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                    ║
║    GET  /health                    Health check                ║
║    GET  /v1/commitment/:address    Get commitment details      ║
║    GET  /v1/agent/:authority       Get agent profile           ║
║    GET  /v1/agent/:authority/commitments  List commitments     ║
║    POST /v1/verify                 Verify reasoning            ║
║    POST /v1/hash                   Compute reasoning hash      ║
╠═══════════════════════════════════════════════════════════════╣
║  Program ID: ${PROGRAM_ID.toBase58()}          ║
║  Port: ${PORT}                                                    ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
