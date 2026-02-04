/**
 * SOLPRISM Explorer — Onchain Data Reader
 *
 * Reads SOLPRISM program accounts from Solana devnet + mainnet.
 * Browser-safe: no signing, just reads.
 */

import { Connection, PublicKey } from "@solana/web3.js";

// ─── Constants ──────────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
    "CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu"
);

const DEVNET_RPC =
  process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

const SEED_AGENT = Buffer.from("agent");
const SEED_COMMITMENT = Buffer.from("commitment");

// Account discriminators (first 8 bytes — from IDL)
const DISC_AGENT = Buffer.from([60, 227, 42, 24, 0, 87, 86, 205]);
const DISC_COMMITMENT = Buffer.from([67, 22, 65, 98, 26, 124, 5, 25]);

// ─── Types ──────────────────────────────────────────────────────────────

export type Network = "devnet" | "mainnet";

export interface AgentProfile {
  address: string;
  authority: string;
  name: string;
  totalCommitments: number;
  totalVerified: number;
  accountabilityScore: number;
  createdAt: number;
  network?: Network;
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
  network?: Network;
}

export interface DashboardStats {
  totalAgents: number;
  totalCommitments: number;
  totalRevealed: number;
  revealRate: number;
}

export interface NetworkStats {
  network: Network;
  agents: number;
  commitments: number;
  reveals: number;
  revealRate: number;
  lastCommitmentTs: number | null;
  loading: boolean;
  error: string | null;
}

export interface TractionStats {
  devnet: NetworkStats;
  mainnet: NetworkStats;
  totalAgents: number;
  totalCommitments: number;
  totalReveals: number;
  totalRevealRate: number;
  recentCommitments: Commitment[];
  dailyActivity: Record<string, number>;
  actionTypes: Record<string, number>;
  topAgents: AgentProfile[];
  avgConfidence: number;
}

// ─── Connection ─────────────────────────────────────────────────────────

const connections: Record<string, Connection> = {};

function getConnection(network: Network = "devnet"): Connection {
  const url = network === "mainnet" ? MAINNET_RPC : DEVNET_RPC;
  if (!connections[network]) {
    connections[network] = new Connection(url, "confirmed");
  }
  return connections[network];
}

// ─── Deserialization ────────────────────────────────────────────────────

function readString(buf: Buffer, offset: number): [string, number] {
  const len = buf.readUInt32LE(offset);
  const str = buf.subarray(offset + 4, offset + 4 + len).toString("utf-8");
  return [str, offset + 4 + len];
}

function deserializeAgent(
  address: string,
  data: Buffer,
  network?: Network
): AgentProfile {
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
    network,
  };
}

function deserializeCommitment(
  address: string,
  data: Buffer,
  network?: Network
): Commitment {
  let offset = 8; // skip discriminator

  const agent = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;

  const authority = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;

  const commitmentHash = Buffer.from(
    data.subarray(offset, offset + 32)
  ).toString("hex");
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
    network,
  };
}

// ─── Data Fetching ──────────────────────────────────────────────────────

export async function fetchAllAgents(
  network: Network = "devnet"
): Promise<AgentProfile[]> {
  const conn = getConnection(network);
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
    deserializeAgent(a.pubkey.toBase58(), Buffer.from(a.account.data), network)
  );
}

export async function fetchAllCommitments(
  network: Network = "devnet"
): Promise<Commitment[]> {
  const conn = getConnection(network);
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
      deserializeCommitment(
        a.pubkey.toBase58(),
        Buffer.from(a.account.data),
        network
      )
    )
    .sort((a, b) => b.timestamp - a.timestamp);
}

/** Count-only fetch (uses dataSlice for efficiency) */
export async function fetchAgentCount(
  network: Network = "devnet"
): Promise<number> {
  const conn = getConnection(network);
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
    dataSlice: { offset: 0, length: 0 },
  });
  return accounts.length;
}

export async function fetchAgentByAuthority(
  authority: string
): Promise<AgentProfile | null> {
  const conn = getConnection("devnet");
  const authorityPk = new PublicKey(authority);
  const [pda] = PublicKey.findProgramAddressSync(
    [SEED_AGENT, authorityPk.toBuffer()],
    PROGRAM_ID
  );

  const info = await conn.getAccountInfo(pda);
  if (!info || !info.data || info.data.length < 8) return null;

  if (!Buffer.from(info.data.subarray(0, 8)).equals(DISC_AGENT)) return null;

  return deserializeAgent(pda.toBase58(), Buffer.from(info.data), "devnet");
}

export async function fetchCommitment(
  address: string
): Promise<Commitment | null> {
  const conn = getConnection("devnet");
  const pk = new PublicKey(address);

  const info = await conn.getAccountInfo(pk);
  if (!info || !info.data || info.data.length < 8) return null;

  if (!Buffer.from(info.data.subarray(0, 8)).equals(DISC_COMMITMENT))
    return null;

  return deserializeCommitment(address, Buffer.from(info.data), "devnet");
}

export async function fetchCommitmentsForAgent(
  agentAddress: string
): Promise<Commitment[]> {
  const conn = getConnection("devnet");
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
      deserializeCommitment(
        a.pubkey.toBase58(),
        Buffer.from(a.account.data),
        "devnet"
      )
    )
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [agents, commitments] = await Promise.all([
    fetchAllAgents("devnet"),
    fetchAllCommitments("devnet"),
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

/** Fetch full traction stats from both networks */
export async function fetchTractionStats(): Promise<TractionStats> {
  const emptyNet = (network: Network): NetworkStats => ({
    network,
    agents: 0,
    commitments: 0,
    reveals: 0,
    revealRate: 0,
    lastCommitmentTs: null,
    loading: false,
    error: null,
  });

  let devnetStats = emptyNet("devnet");
  let mainnetStats = emptyNet("mainnet");
  let allCommitments: Commitment[] = [];
  let allAgents: AgentProfile[] = [];

  // Fetch both networks in parallel
  const [devResult, mainResult] = await Promise.allSettled([
    Promise.all([
      fetchAllAgents("devnet"),
      fetchAllCommitments("devnet"),
    ]),
    Promise.all([
      fetchAllAgents("mainnet"),
      fetchAllCommitments("mainnet"),
    ]),
  ]);

  if (devResult.status === "fulfilled") {
    const [agents, commits] = devResult.value;
    const reveals = commits.filter((c) => c.revealed).length;
    const lastTs = commits.length > 0 ? commits[0].timestamp : null;
    devnetStats = {
      network: "devnet",
      agents: agents.length,
      commitments: commits.length,
      reveals,
      revealRate:
        commits.length > 0 ? Math.round((reveals / commits.length) * 100) : 0,
      lastCommitmentTs: lastTs,
      loading: false,
      error: null,
    };
    allCommitments.push(...commits);
    allAgents.push(...agents);
  } else {
    devnetStats.error = devResult.reason?.message || "Failed to fetch";
  }

  if (mainResult.status === "fulfilled") {
    const [agents, commits] = mainResult.value;
    const reveals = commits.filter((c) => c.revealed).length;
    const lastTs = commits.length > 0 ? commits[0].timestamp : null;
    mainnetStats = {
      network: "mainnet",
      agents: agents.length,
      commitments: commits.length,
      reveals,
      revealRate:
        commits.length > 0 ? Math.round((reveals / commits.length) * 100) : 0,
      lastCommitmentTs: lastTs,
      loading: false,
      error: null,
    };
    allCommitments.push(...commits);
    allAgents.push(...agents);
  } else {
    mainnetStats.error = mainResult.reason?.message || "Failed to fetch";
  }

  // Sort all commitments by time
  allCommitments.sort((a, b) => b.timestamp - a.timestamp);

  // Compute daily activity
  const dailyActivity: Record<string, number> = {};
  allCommitments.forEach((c) => {
    const date = new Date(c.timestamp * 1000).toISOString().split("T")[0];
    dailyActivity[date] = (dailyActivity[date] || 0) + 1;
  });

  // Compute action types
  const actionTypes: Record<string, number> = {};
  allCommitments.forEach((c) => {
    actionTypes[c.actionType] = (actionTypes[c.actionType] || 0) + 1;
  });

  // Avg confidence
  const avgConfidence =
    allCommitments.length > 0
      ? Math.round(
          allCommitments.reduce((s, c) => s + c.confidence, 0) /
            allCommitments.length
        )
      : 0;

  // Top agents by commitments
  const topAgents = [...allAgents]
    .sort((a, b) => b.totalCommitments - a.totalCommitments)
    .slice(0, 10);

  const totalReveals =
    devnetStats.reveals + mainnetStats.reveals;
  const totalCommits =
    devnetStats.commitments + mainnetStats.commitments;

  return {
    devnet: devnetStats,
    mainnet: mainnetStats,
    totalAgents: devnetStats.agents + mainnetStats.agents,
    totalCommitments: totalCommits,
    totalReveals,
    totalRevealRate:
      totalCommits > 0
        ? Math.round((totalReveals / totalCommits) * 100)
        : 0,
    recentCommitments: allCommitments.slice(0, 20),
    dailyActivity,
    actionTypes,
    topAgents,
    avgConfidence,
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

export function explorerUrl(
  address: string,
  type: "address" | "tx" = "address",
  network: Network = "devnet"
): string {
  const cluster = network === "mainnet" ? "" : "?cluster=devnet";
  return `https://explorer.solana.com/${type}/${address}${cluster}`;
}
