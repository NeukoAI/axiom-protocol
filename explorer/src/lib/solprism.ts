/**
 * SOLPRISM Explorer — Onchain Data Reader
 * 
 * Reads SOLPRISM program accounts from Solana devnet.
 * Browser-safe: no signing, just reads.
 */

import { Connection, PublicKey } from "@solana/web3.js";

// ─── Constants ──────────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu"
);

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

const SEED_AGENT = Buffer.from("agent");
const SEED_COMMITMENT = Buffer.from("commitment");

// Account discriminators (first 8 bytes)
const DISC_AGENT = Buffer.from([60, 227, 42, 24, 0, 87, 86, 205]);
const DISC_COMMITMENT = Buffer.from([67, 22, 65, 98, 26, 124, 5, 25]);

// ─── Types ──────────────────────────────────────────────────────────────

export interface AgentProfile {
  address: string;
  authority: string;
  name: string;
  totalCommitments: number;
  totalVerified: number;
  accountabilityScore: number;
  createdAt: number;
}

export interface Commitment {
  address: string;
  agent: string;
  authority: string;
  commitmentHash: string;
  actionType: string;
  confidence: number;
  timestamp: number;
  revealed: boolean;
  reasoningUri: string | null;
  nonce: number;
}

export interface DashboardStats {
  totalAgents: number;
  totalCommitments: number;
  totalRevealed: number;
  revealRate: number;
}

// ─── Connection ─────────────────────────────────────────────────────────

let _connection: Connection | null = null;

function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_URL, "confirmed");
  }
  return _connection;
}

// ─── Deserialization ────────────────────────────────────────────────────

function readString(buf: Buffer, offset: number): [string, number] {
  const len = buf.readUInt32LE(offset);
  const str = buf.subarray(offset + 4, offset + 4 + len).toString("utf-8");
  return [str, offset + 4 + len];
}

function deserializeAgent(address: string, data: Buffer): AgentProfile {
  let offset = 8; // skip discriminator

  const authority = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;

  const [name, nameEnd] = readString(data, offset);
  offset = nameEnd;

  const totalCommitments = Number(data.readBigUInt64LE(offset));
  offset += 8;

  const totalVerified = Number(data.readBigUInt64LE(offset));
  offset += 8;

  const accountabilityScore = data.readUInt16LE(offset);
  offset += 2;

  const createdAt = Number(data.readBigInt64LE(offset));
  offset += 8;

  return {
    address,
    authority,
    name,
    totalCommitments,
    totalVerified,
    accountabilityScore: accountabilityScore / 100,
    createdAt,
  };
}

function deserializeCommitment(address: string, data: Buffer): Commitment {
  let offset = 8; // skip discriminator

  const agent = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;

  const authority = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;

  const commitmentHash = Buffer.from(data.subarray(offset, offset + 32)).toString("hex");
  offset += 32;

  const [actionType, atEnd] = readString(data, offset);
  offset = atEnd;

  const confidence = data[offset];
  offset += 1;

  const timestamp = Number(data.readBigInt64LE(offset));
  offset += 8;

  const revealed = data[offset] === 1;
  offset += 1;

  const [reasoningUri, ruEnd] = readString(data, offset);
  offset = ruEnd;

  const nonce = Number(data.readBigUInt64LE(offset));
  offset += 8;

  return {
    address,
    agent,
    authority,
    commitmentHash,
    actionType,
    confidence,
    timestamp,
    revealed,
    reasoningUri: reasoningUri || null,
    nonce,
  };
}

// ─── Data Fetching ──────────────────────────────────────────────────────

export async function fetchAllAgents(): Promise<AgentProfile[]> {
  const conn = getConnection();
  const accounts = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: DISC_AGENT.toString("base64"),
          encoding: "base64" as unknown as undefined,
        },
      },
    ],
  });

  return accounts.map((a) =>
    deserializeAgent(a.pubkey.toBase58(), Buffer.from(a.account.data))
  );
}

export async function fetchAllCommitments(): Promise<Commitment[]> {
  const conn = getConnection();
  const accounts = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: DISC_COMMITMENT.toString("base64"),
          encoding: "base64" as unknown as undefined,
        },
      },
    ],
  });

  return accounts
    .map((a) =>
      deserializeCommitment(a.pubkey.toBase58(), Buffer.from(a.account.data))
    )
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function fetchAgentByAuthority(
  authority: string
): Promise<AgentProfile | null> {
  const conn = getConnection();
  const authorityPk = new PublicKey(authority);
  const [pda] = PublicKey.findProgramAddressSync(
    [SEED_AGENT, authorityPk.toBuffer()],
    PROGRAM_ID
  );

  const info = await conn.getAccountInfo(pda);
  if (!info || !info.data || info.data.length < 8) return null;

  if (!Buffer.from(info.data.subarray(0, 8)).equals(DISC_AGENT)) return null;

  return deserializeAgent(pda.toBase58(), Buffer.from(info.data));
}

export async function fetchCommitment(
  address: string
): Promise<Commitment | null> {
  const conn = getConnection();
  const pk = new PublicKey(address);

  const info = await conn.getAccountInfo(pk);
  if (!info || !info.data || info.data.length < 8) return null;

  if (!Buffer.from(info.data.subarray(0, 8)).equals(DISC_COMMITMENT))
    return null;

  return deserializeCommitment(address, Buffer.from(info.data));
}

export async function fetchCommitmentsForAgent(
  agentAddress: string
): Promise<Commitment[]> {
  const conn = getConnection();
  const accounts = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: DISC_COMMITMENT.toString("base64"),
          encoding: "base64" as unknown as undefined,
        },
      },
      {
        memcmp: {
          offset: 8, // agent field after discriminator
          bytes: agentAddress,
        },
      },
    ],
  });

  return accounts
    .map((a) =>
      deserializeCommitment(a.pubkey.toBase58(), Buffer.from(a.account.data))
    )
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [agents, commitments] = await Promise.all([
    fetchAllAgents(),
    fetchAllCommitments(),
  ]);

  const totalRevealed = commitments.filter((c) => c.revealed).length;

  return {
    totalAgents: agents.length,
    totalCommitments: commitments.length,
    totalRevealed,
    revealRate:
      commitments.length > 0
        ? Math.round((totalRevealed / commitments.length) * 100)
        : 0,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

export function truncateAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function explorerUrl(address: string, type: "address" | "tx" = "address"): string {
  return `https://explorer.solana.com/${type}/${address}?cluster=devnet`;
}
