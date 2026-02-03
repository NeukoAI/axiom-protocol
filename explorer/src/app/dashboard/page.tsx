"use client";

import { useEffect, useState, useCallback } from "react";
import { Connection, PublicKey } from "@solana/web3.js";

// ─── Constants ──────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey(
  "CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu"
);
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";
const DEVNET_RPC = "https://api.devnet.solana.com";
const REFRESH_INTERVAL = 30_000;

// Account discriminators (first 8 bytes)
const DISC_AGENT = Buffer.from([135, 157, 66, 195, 2, 113, 175, 30]);
const DISC_COMMITMENT = Buffer.from([163, 80, 25, 135, 94, 49, 218, 44]);

// ─── Types ──────────────────────────────────────────────────────────────

interface NetworkMetrics {
  agents: number;
  commitments: number;
  reveals: number;
  revealRate: number;
  lastCommitmentTs: number | null;
  loading: boolean;
  error: string | null;
}

interface AdoptionMetrics {
  githubStars: number | null;
  loading: boolean;
}

// ─── Data Fetching ──────────────────────────────────────────────────────

/**
 * Parse a commitment account to extract revealed flag and timestamp.
 *
 * Layout:
 *   0..8     discriminator
 *   8..40    agent pubkey
 *   40..72   authority pubkey
 *   72..104  commitment_hash
 *   104..108 action_type string len (u32 LE)
 *   108..N   action_type bytes
 *   N        confidence (u8)
 *   N+1..N+9 timestamp (i64 LE)
 *   N+9      revealed (bool u8)
 */
function parseCommitmentFields(data: Buffer): {
  revealed: boolean;
  timestamp: number;
} {
  let offset = 8 + 32 + 32 + 32; // disc + agent + authority + hash = 104
  const strLen = data.readUInt32LE(offset);
  offset += 4 + strLen; // action_type string
  offset += 1; // confidence
  const timestamp = Number(data.readBigInt64LE(offset));
  offset += 8;
  const revealed = data[offset] === 1;
  return { revealed, timestamp };
}

async function fetchNetworkMetrics(
  rpcUrl: string
): Promise<Omit<NetworkMetrics, "loading" | "error">> {
  const conn = new Connection(rpcUrl, "confirmed");

  const [agentAccounts, commitmentAccounts] = await Promise.all([
    conn.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: DISC_AGENT.toString("base64"),
            encoding: "base64" as unknown as undefined,
          },
        },
      ],
      dataSlice: { offset: 0, length: 0 }, // only need count
    }),
    conn.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: DISC_COMMITMENT.toString("base64"),
            encoding: "base64" as unknown as undefined,
          },
        },
      ],
    }),
  ]);

  let reveals = 0;
  let lastTs: number | null = null;

  for (const acct of commitmentAccounts) {
    try {
      const buf = Buffer.from(acct.account.data);
      const { revealed, timestamp } = parseCommitmentFields(buf);
      if (revealed) reveals++;
      if (lastTs === null || timestamp > lastTs) lastTs = timestamp;
    } catch {
      // skip malformed
    }
  }

  const total = commitmentAccounts.length;
  return {
    agents: agentAccounts.length,
    commitments: total,
    reveals,
    revealRate: total > 0 ? Math.round((reveals / total) * 100) : 0,
    lastCommitmentTs: lastTs,
  };
}

// ─── Components ─────────────────────────────────────────────────────────

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-slate-700/50 rounded animate-pulse ${className}`}
      style={{ minHeight: "2rem", minWidth: "3rem" }}
    />
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
  loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "cyan" | "purple" | "green" | "yellow";
  loading?: boolean;
}) {
  const colors: Record<string, string> = {
    cyan: "from-cyan-500/10 to-transparent border-cyan-500/20",
    purple: "from-purple-500/10 to-transparent border-purple-500/20",
    green: "from-green-500/10 to-transparent border-green-500/20",
    yellow: "from-yellow-500/10 to-transparent border-yellow-500/20",
  };
  const border = accent ? colors[accent] : "from-transparent to-transparent border-slate-800";

  return (
    <div
      className={`bg-[#1a2235] border rounded-xl p-5 bg-gradient-to-b ${border}`}
    >
      <div className="text-sm text-slate-400 mb-1">{label}</div>
      {loading ? (
        <Shimmer className="h-8 w-16" />
      ) : (
        <>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-400/20 border border-slate-700 flex items-center justify-center text-cyan-400">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function NetworkPanel({
  label,
  metrics,
  accent,
}: {
  label: string;
  metrics: NetworkMetrics;
  accent: "cyan" | "purple";
}) {
  const pill =
    accent === "cyan"
      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
      : "bg-purple-500/10 text-purple-400 border-purple-500/20";

  return (
    <div className="bg-[#1a2235] border border-slate-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${pill}`}
        >
          {label}
        </span>
        {metrics.error && (
          <span className="text-xs text-red-400 truncate max-w-[200px]">
            ⚠ {metrics.error}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Agents"
          value={metrics.agents}
          accent={accent}
          loading={metrics.loading}
        />
        <MetricCard
          label="Commitments"
          value={metrics.commitments}
          accent={accent}
          loading={metrics.loading}
        />
        <MetricCard
          label="Reveals"
          value={metrics.reveals}
          accent={accent}
          loading={metrics.loading}
        />
        <MetricCard
          label="Reveal Rate"
          value={`${metrics.revealRate}%`}
          accent={accent}
          loading={metrics.loading}
        />
      </div>
    </div>
  );
}

function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Page ───────────────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    name: "Eliza (ai16z)",
    url: "https://github.com/ai16z/eliza",
    desc: "AI agent framework",
  },
  {
    name: "solana-agent-kit",
    url: "https://github.com/sendaifun/solana-agent-kit",
    desc: "Solana agent toolkit",
  },
  {
    name: "MCP Server",
    url: "https://github.com/basedmereum/axiom-protocol/tree/main/packages/mcp-server",
    desc: "Model Context Protocol",
  },
];

export default function DashboardPage() {
  const emptyNetwork: NetworkMetrics = {
    agents: 0,
    commitments: 0,
    reveals: 0,
    revealRate: 0,
    lastCommitmentTs: null,
    loading: true,
    error: null,
  };

  const [mainnet, setMainnet] = useState<NetworkMetrics>({ ...emptyNetwork });
  const [devnet, setDevnet] = useState<NetworkMetrics>({ ...emptyNetwork });
  const [adoption, setAdoption] = useState<AdoptionMetrics>({
    githubStars: null,
    loading: true,
  });
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(30);

  const fetchAll = useCallback(async () => {
    // Fetch mainnet metrics
    fetchNetworkMetrics(MAINNET_RPC)
      .then((m) => setMainnet({ ...m, loading: false, error: null }))
      .catch((e) =>
        setMainnet((prev) => ({
          ...prev,
          loading: false,
          error: String(e.message ?? "RPC error").slice(0, 60),
        }))
      );

    // Fetch devnet metrics
    fetchNetworkMetrics(DEVNET_RPC)
      .then((m) => setDevnet({ ...m, loading: false, error: null }))
      .catch((e) =>
        setDevnet((prev) => ({
          ...prev,
          loading: false,
          error: String(e.message ?? "RPC error").slice(0, 60),
        }))
      );

    // Fetch GitHub stars
    fetch("https://api.github.com/repos/NeukoAI/axiom-protocol")
      .then((r) => r.json())
      .then((d) =>
        setAdoption({
          githubStars: typeof d.stargazers_count === "number" ? d.stargazers_count : null,
          loading: false,
        })
      )
      .catch(() => setAdoption({ githubStars: null, loading: false }));

    setLastRefresh(new Date());
    setCountdown(30);
  }, []);

  // Initial fetch + 30s interval
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(
      () => setCountdown((c) => Math.max(0, c - 1)),
      1000
    );
    return () => clearInterval(tick);
  }, []);

  // Aggregates
  const bothLoading = mainnet.loading && devnet.loading;
  const totalAgents = mainnet.agents + devnet.agents;
  const totalCommitments = mainnet.commitments + devnet.commitments;
  const totalReveals = mainnet.reveals + devnet.reveals;
  const totalRevealRate =
    totalCommitments > 0
      ? Math.round((totalReveals / totalCommitments) * 100)
      : 0;
  const lastTs = [mainnet.lastCommitmentTs, devnet.lastCommitmentTs]
    .filter((t): t is number => t !== null)
    .sort((a, b) => b - a)[0] ?? null;

  return (
    <div className="space-y-8">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Protocol Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time metrics across mainnet &amp; devnet
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
            Live
          </div>
          <span>Refresh in {countdown}s</span>
        </div>
      </div>

      {/* ── Aggregate Stats ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Agents"
          value={totalAgents}
          accent="cyan"
          loading={bothLoading}
        />
        <MetricCard
          label="Total Commitments"
          value={totalCommitments}
          accent="purple"
          loading={bothLoading}
        />
        <MetricCard
          label="Total Reveals"
          value={totalReveals}
          accent="green"
          loading={bothLoading}
        />
        <MetricCard
          label="Reveal Rate"
          value={`${totalRevealRate}%`}
          accent="yellow"
          loading={bothLoading}
        />
      </div>

      {/* ── Onchain Metrics — Side by Side ────────────────────────── */}
      <section>
        <SectionHeader
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          }
          title="Onchain Metrics"
          subtitle="Live program account data from Solana RPC"
        />
        <div className="grid md:grid-cols-2 gap-6">
          <NetworkPanel label="Mainnet" metrics={mainnet} accent="cyan" />
          <NetworkPanel label="Devnet" metrics={devnet} accent="purple" />
        </div>
      </section>

      {/* ── Adoption Metrics ──────────────────────────────────────── */}
      <section>
        <SectionHeader
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          title="Adoption"
          subtitle="SDK downloads, community, and integrations"
        />
        <div className="grid md:grid-cols-3 gap-4">
          {/* npm Downloads */}
          <div className="bg-[#1a2235] border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
            <div className="text-sm text-slate-400">npm Downloads</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/npm/dt/@solprism/sdk?style=for-the-badge&color=0ea5e9&labelColor=1e293b&label=@solprism/sdk"
              alt="npm total downloads"
              className="h-7"
            />
            <a
              href="https://www.npmjs.com/package/@solprism/sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              View on npm →
            </a>
          </div>

          {/* GitHub Stars */}
          <div className="bg-[#1a2235] border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
            <div className="text-sm text-slate-400">GitHub Stars</div>
            {adoption.loading ? (
              <Shimmer className="h-9 w-20" />
            ) : (
              <div className="text-3xl font-bold">
                {adoption.githubStars !== null ? (
                  <>⭐ {adoption.githubStars}</>
                ) : (
                  <span className="text-slate-500 text-lg">—</span>
                )}
              </div>
            )}
            <a
              href="https://github.com/NeukoAI/axiom-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Star on GitHub →
            </a>
          </div>

          {/* Integrations */}
          <div className="bg-[#1a2235] border border-slate-800 rounded-xl p-6">
            <div className="text-sm text-slate-400 mb-3 text-center">
              Integrations
            </div>
            <div className="text-3xl font-bold text-center mb-3">
              {INTEGRATIONS.length}
            </div>
            <div className="space-y-2">
              {INTEGRATIONS.map((i) => (
                <a
                  key={i.name}
                  href={i.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors text-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                  <span className="text-slate-300 truncate">{i.name}</span>
                  <span className="ml-auto text-slate-600 flex-shrink-0">
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Protocol Health ───────────────────────────────────────── */}
      <section>
        <SectionHeader
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
          title="Protocol Health"
          subtitle="Program status, timestamps, and resources"
        />
        <div className="bg-[#1a2235] border border-slate-800 rounded-xl p-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            {/* Program Status */}
            <div>
              <div className="text-slate-500 mb-2">Program Status</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-slate-300">Mainnet:</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                    Immutable
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="text-slate-300">Devnet:</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    Upgradeable
                  </span>
                </div>
              </div>
            </div>

            {/* Last Commitment */}
            <div>
              <div className="text-slate-500 mb-2">Last Commitment</div>
              {bothLoading ? (
                <Shimmer className="h-6 w-40" />
              ) : lastTs ? (
                <div className="text-slate-300">{formatTs(lastTs)}</div>
              ) : (
                <div className="text-slate-500">No commitments yet</div>
              )}
            </div>

            {/* Quick Links */}
            <div>
              <div className="text-slate-500 mb-2">Quick Links</div>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://explorer.solana.com/address/CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Solana Explorer ↗
                </a>
                <a
                  href="https://github.com/basedmereum/axiom-protocol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  GitHub ↗
                </a>
                <a
                  href="https://www.npmjs.com/package/@solprism/sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  npm ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer Timestamp ──────────────────────────────────────── */}
      <div className="text-center text-xs text-slate-600 pb-4">
        Last refreshed: {lastRefresh.toLocaleTimeString()} · Auto-refreshes
        every 30s
      </div>
    </div>
  );
}
