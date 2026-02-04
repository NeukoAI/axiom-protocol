"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  fetchTractionStats,
  truncateAddress,
  timeAgo,
  explorerUrl,
  type TractionStats,
  type Commitment,
  type NetworkStats,
} from "@/lib/solprism";

// ─── Animated Counter ───────────────────────────────────────────────────

function AnimatedNumber({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (target === 0) { setCurrent(0); return; }
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return <>{current.toLocaleString()}</>;
}

// ─── Hero Stat Card ─────────────────────────────────────────────────────

function HeroStat({
  label,
  value,
  icon,
  gradient,
  sub,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="relative group">
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-[0.07] group-hover:opacity-[0.12] transition-opacity duration-500`} />
      <div className="relative bg-[#111827]/80 backdrop-blur-sm border border-slate-800/60 rounded-2xl p-6 hover:border-slate-700/60 transition-all duration-300">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white/90 shadow-lg`}>
            {icon}
          </div>
          <span className="text-sm text-slate-400 font-medium">{label}</span>
        </div>
        {loading ? (
          <div className="h-10 w-24 bg-slate-700/50 rounded-lg animate-pulse" />
        ) : (
          <>
            <div className="text-4xl font-bold tracking-tight">
              <AnimatedNumber target={value} />
            </div>
            {sub && (
              <div className="text-xs text-slate-500 mt-1.5">{sub}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Network Badge ──────────────────────────────────────────────────────

function NetworkCard({
  stats,
  accent,
}: {
  stats: NetworkStats;
  accent: "cyan" | "violet";
}) {
  const colors = {
    cyan: {
      bg: "from-cyan-500/10 to-blue-500/5",
      border: "border-cyan-500/20 hover:border-cyan-500/40",
      pill: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      text: "text-cyan-400",
      dot: "bg-cyan-400",
    },
    violet: {
      bg: "from-violet-500/10 to-purple-500/5",
      border: "border-violet-500/20 hover:border-violet-500/40",
      pill: "bg-violet-500/10 text-violet-400 border-violet-500/20",
      text: "text-violet-400",
      dot: "bg-violet-400",
    },
  }[accent];

  return (
    <div className={`bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-2xl p-6 transition-all duration-300`}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colors.dot} pulse-dot`} />
          <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
            {stats.network}
          </span>
        </div>
        {stats.error && (
          <span className="text-xs text-red-400/70 truncate max-w-[150px]">
            ⚠ {stats.error}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Agents", value: stats.agents },
          { label: "Commits", value: stats.commitments },
          { label: "Reveals", value: stats.reveals },
          { label: "Rate", value: stats.revealRate, suffix: "%" },
        ].map((item) => (
          <div key={item.label}>
            <div className="text-xs text-slate-500 mb-0.5">{item.label}</div>
            {stats.loading ? (
              <div className="h-6 w-12 bg-slate-700/50 rounded animate-pulse" />
            ) : (
              <div className="text-lg font-bold">
                {item.value.toLocaleString()}
                {item.suffix || ""}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity Chart (Pure CSS) ──────────────────────────────────────────

function ActivityChart({
  data,
  loading,
}: {
  data: Record<string, number>;
  loading?: boolean;
}) {
  const entries = Object.entries(data)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14); // Last 14 days
  const max = Math.max(...entries.map((e) => e[1]), 1);

  return (
    <div className="bg-[#111827]/80 border border-slate-800/60 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-slate-700 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Activity Timeline</h3>
            <p className="text-xs text-slate-500">Daily reasoning commitments</p>
          </div>
        </div>
        <span className="text-xs text-slate-600">Last 14 days</span>
      </div>
      {loading ? (
        <div className="flex items-end gap-2 h-36">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="flex-1 bg-slate-700/30 rounded-t animate-pulse" style={{ height: `${20 + Math.random() * 80}%` }} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex items-center justify-center h-36 text-slate-500 text-sm">
          No activity data yet
        </div>
      ) : (
        <div className="flex items-end gap-1.5 h-36">
          {entries.map(([date, count], i) => (
            <div key={date} className="flex-1 group flex flex-col items-center gap-1">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-slate-400 font-medium">
                {count}
              </div>
              <div
                className="w-full rounded-t-md transition-all duration-700 ease-out relative overflow-hidden"
                style={{
                  height: `${Math.max((count / max) * 100, 4)}%`,
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-blue-600 via-cyan-500 to-cyan-300 opacity-90" />
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10" />
              </div>
              <div className="text-[9px] text-slate-600 mt-0.5 tabular-nums">
                {date.slice(5)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Action Type Breakdown ──────────────────────────────────────────────

function ActionTypeChart({
  data,
  loading,
}: {
  data: Record<string, number>;
  loading?: boolean;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, e) => s + e[1], 0);

  const colors = [
    "from-blue-500 to-cyan-400",
    "from-violet-500 to-purple-400",
    "from-emerald-500 to-green-400",
    "from-amber-500 to-yellow-400",
    "from-rose-500 to-pink-400",
    "from-indigo-500 to-blue-400",
  ];

  return (
    <div className="bg-[#111827]/80 border border-slate-800/60 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-slate-700 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Action Types</h3>
          <p className="text-xs text-slate-500">Reasoning commitment categories</p>
        </div>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 bg-slate-700/30 rounded animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-slate-500 text-sm text-center py-8">
          No data yet
        </div>
      ) : (
        <div className="space-y-3">
          {entries.slice(0, 6).map(([type, count], i) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={type}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-300 font-medium">{type}</span>
                  <span className="text-slate-500 tabular-nums">
                    {count} <span className="text-slate-600">({pct}%)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full bg-gradient-to-r ${colors[i % colors.length]} transition-all duration-1000 ease-out`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Live Activity Feed ─────────────────────────────────────────────────

function LiveFeed({
  commitments,
  loading,
}: {
  commitments: Commitment[];
  loading?: boolean;
}) {
  return (
    <div className="bg-[#111827]/80 border border-slate-800/60 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-slate-700 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-400">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Live Activity</h3>
            <p className="text-xs text-slate-500">Recent reasoning commitments</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
          <span className="text-xs text-green-400 font-medium">Live</span>
        </div>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-700/20 rounded-xl animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      ) : commitments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 text-slate-600">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="text-sm">No activity yet</span>
          <span className="text-xs text-slate-600 mt-1">Waiting for first commit...</span>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
          {commitments.map((c, i) => (
            <a
              key={c.address}
              href={`/commitment/${c.address}`}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/40 transition-all duration-200 group feed-item"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* Status indicator */}
              <div className="mt-1.5 flex-shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full ${c.revealed ? "bg-green-500 shadow-green-500/50 shadow-sm" : "bg-amber-500 shadow-amber-500/50 shadow-sm"}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="hash-text text-slate-300 text-xs">
                    {truncateAddress(c.commitmentHash, 6)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/50">
                    {c.actionType}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {c.confidence}%
                  </span>
                  {c.network && (
                    <span className={`text-[10px] font-medium ${c.network === "mainnet" ? "text-cyan-500/70" : "text-violet-500/70"}`}>
                      {c.network}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-600">
                    {truncateAddress(c.authority)}
                  </span>
                  <span className="text-[10px] text-slate-700">·</span>
                  <span className="text-[10px] text-slate-600">
                    {timeAgo(c.timestamp)}
                  </span>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex-shrink-0 mt-1">
                {c.revealed ? (
                  <span className="text-[10px] text-green-400/80 font-medium">✓ Verified</span>
                ) : (
                  <span className="text-[10px] text-amber-400/60">Pending</span>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Top Agents Leaderboard ─────────────────────────────────────────────

function TopAgents({
  agents,
  loading,
}: {
  agents: { address: string; authority: string; name: string; totalCommitments: number; totalVerified: number; accountabilityScore: number }[];
  loading?: boolean;
}) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="bg-[#111827]/80 border border-slate-800/60 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-slate-700 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Top Agents</h3>
            <p className="text-xs text-slate-500">By commitment activity</p>
          </div>
        </div>
        <a href="/agents" className="text-xs text-blue-400/80 hover:text-blue-300 transition-colors">
          View all →
        </a>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-700/20 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No agents registered yet
        </div>
      ) : (
        <div className="space-y-2">
          {agents.slice(0, 7).map((agent, i) => (
            <a
              key={agent.address}
              href={`/agent/${agent.authority}`}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/40 transition-all duration-200"
            >
              <div className="w-6 text-center text-sm">
                {i < 3 ? medals[i] : <span className="text-slate-600">{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{agent.name}</div>
                <div className="text-[10px] text-slate-600 hash-text">
                  {truncateAddress(agent.authority)}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold tabular-nums">{agent.totalCommitments}</div>
                <div className="text-[10px] text-slate-600">commits</div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className={`text-sm font-medium tabular-nums ${agent.accountabilityScore >= 80 ? "text-green-400" : agent.accountabilityScore >= 50 ? "text-amber-400" : "text-slate-500"}`}>
                  {agent.accountabilityScore}%
                </div>
                <div className="text-[10px] text-slate-600">score</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ecosystem Integration Cards ────────────────────────────────────────

const INTEGRATIONS = [
  {
    name: "Eliza (ai16z)",
    desc: "AI agent framework plugin",
    url: "https://github.com/ai16z/eliza",
    icon: "🤖",
  },
  {
    name: "solana-agent-kit",
    desc: "Solana agent toolkit",
    url: "https://github.com/sendaifun/solana-agent-kit",
    icon: "🛠",
  },
  {
    name: "MCP Server",
    desc: "Model Context Protocol",
    url: "https://github.com/basedmereum/axiom-protocol/tree/main/packages/mcp-server",
    icon: "🔌",
  },
  {
    name: "@solprism/sdk",
    desc: "TypeScript SDK",
    url: "https://www.npmjs.com/package/@solprism/sdk",
    icon: "📦",
  },
];

// ─── Main Page ──────────────────────────────────────────────────────────

export default function TractionDashboard() {
  const [stats, setStats] = useState<TractionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(30);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchTractionStats();
      setStats(data);
    } catch (e) {
      console.error("Failed to fetch traction stats:", e);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
      setCountdown(30);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const tick = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="space-y-10">
      {/* ─── Hero ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-cyan-500/5 to-violet-600/10" />
        <div className="absolute inset-0 hero-grid opacity-[0.03]" />
        
        <div className="relative px-8 py-12 sm:py-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 pulse-dot" />
            <span className="text-xs font-medium text-green-400 tracking-wider uppercase">
              Live on Solana
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-violet-400">
              SOLPRISM
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-2">
            Verifiable AI Reasoning on Solana
          </p>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            Every AI agent commits a cryptographic proof of its reasoning before acting.
            Browse, verify, and audit onchain reasoning traces in real-time.
          </p>

          {/* Refresh indicator */}
          <div className="flex items-center justify-center gap-3 mt-6 text-xs text-slate-600">
            <span>Auto-refreshes every 30s</span>
            <span>·</span>
            <span>Next in {countdown}s</span>
          </div>
        </div>
      </div>

      {/* ─── Hero Stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroStat
          label="Agents Registered"
          value={stats?.totalAgents ?? 0}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          gradient="from-blue-500 to-cyan-400"
          sub="Across devnet & mainnet"
          loading={loading}
        />
        <HeroStat
          label="Reasoning Commits"
          value={stats?.totalCommitments ?? 0}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          }
          gradient="from-violet-500 to-purple-400"
          sub="SHA-256 hashes onchain"
          loading={loading}
        />
        <HeroStat
          label="Verified Reveals"
          value={stats?.totalReveals ?? 0}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
          gradient="from-emerald-500 to-green-400"
          sub={`${stats?.totalRevealRate ?? 0}% reveal rate`}
          loading={loading}
        />
        <HeroStat
          label="Avg Confidence"
          value={stats?.avgConfidence ?? 0}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
          gradient="from-amber-500 to-orange-400"
          sub="Agent self-reported"
          loading={loading}
        />
      </div>

      {/* ─── Network Comparison ──────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-400/20 border border-slate-700 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Network Status</h2>
            <p className="text-xs text-slate-500">Live program data from both networks</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <NetworkCard stats={stats?.devnet ?? { network: "devnet", agents: 0, commitments: 0, reveals: 0, revealRate: 0, lastCommitmentTs: null, loading: true, error: null }} accent="violet" />
          <NetworkCard stats={stats?.mainnet ?? { network: "mainnet", agents: 0, commitments: 0, reveals: 0, revealRate: 0, lastCommitmentTs: null, loading: true, error: null }} accent="cyan" />
        </div>
      </section>

      {/* ─── Charts Row ──────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <ActivityChart data={stats?.dailyActivity ?? {}} loading={loading} />
        <ActionTypeChart data={stats?.actionTypes ?? {}} loading={loading} />
      </div>

      {/* ─── Live Feed + Top Agents ──────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <LiveFeed commitments={stats?.recentCommitments ?? []} loading={loading} />
        </div>
        <div className="lg:col-span-2">
          <TopAgents agents={stats?.topAgents ?? []} loading={loading} />
        </div>
      </div>

      {/* ─── Ecosystem ───────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-slate-700 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Ecosystem</h2>
            <p className="text-xs text-slate-500">Integrations & SDK</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {INTEGRATIONS.map((item) => (
            <a
              key={item.name}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#111827]/80 border border-slate-800/60 rounded-2xl p-5 hover:border-slate-700/60 hover:bg-slate-800/30 transition-all duration-300 group"
            >
              <div className="text-2xl mb-3">{item.icon}</div>
              <div className="text-sm font-semibold group-hover:text-white transition-colors">
                {item.name}
              </div>
              <div className="text-xs text-slate-500 mt-1">{item.desc}</div>
              <div className="text-xs text-blue-400/60 mt-3 group-hover:text-blue-400 transition-colors">
                View →
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ─── Protocol Footer ─────────────────────────────────────── */}
      <div className="bg-[#111827]/60 border border-slate-800/40 rounded-2xl p-6">
        <div className="grid sm:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-medium">Program</div>
            <a
              href={explorerUrl("CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu", "address", "mainnet")}
              target="_blank"
              className="hash-text text-slate-400 hover:text-blue-400 transition-colors text-xs break-all"
            >
              CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu
            </a>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-medium">Status</div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-slate-400">Mainnet Immutable</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-medium">How It Works</div>
            <div className="text-slate-400">Commit → Act → Reveal → Verify</div>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-center text-xs text-slate-700 pb-4">
        Last refreshed: {lastRefresh.toLocaleTimeString()} · Data queried directly from Solana RPC
      </div>
    </div>
  );
}
