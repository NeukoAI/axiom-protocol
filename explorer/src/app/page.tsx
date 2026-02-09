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
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return <>{current.toLocaleString()}</>;
}

// ─── Hero Stat Card ─────────────────────────────────────────────────────

function HeroStat({
  label, value, icon, gradient, sub, loading,
}: {
  label: string; value: number; icon: React.ReactNode; gradient: string; sub?: string; loading?: boolean;
}) {
  return (
    <div className="relative group">
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-[0.05] group-hover:opacity-[0.12] transition-opacity duration-500`} />
      <div className="relative card-solana rounded-2xl p-6">
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
            {sub && <div className="text-xs text-slate-500 mt-1.5">{sub}</div>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Network Badge ──────────────────────────────────────────────────────

function NetworkCard({ stats, accent }: { stats: NetworkStats; accent: "green" | "purple" }) {
  const colors = {
    green: {
      bg: "from-[#14F195]/10 to-[#14F195]/5",
      border: "border-[#14F195]/20 hover:border-[#14F195]/40",
      pill: "bg-[#14F195]/10 text-[#14F195] border-[#14F195]/20",
      text: "text-[#14F195]",
      dot: "bg-[#14F195]",
    },
    purple: {
      bg: "from-[#9945FF]/10 to-[#9945FF]/5",
      border: "border-[#9945FF]/20 hover:border-[#9945FF]/40",
      pill: "bg-[#9945FF]/10 text-[#9945FF] border-[#9945FF]/20",
      text: "text-[#9945FF]",
      dot: "bg-[#9945FF]",
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
          <span className="text-xs text-red-400/70 truncate max-w-[150px]">⚠ {stats.error}</span>
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
                {item.value.toLocaleString()}{item.suffix || ""}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity Chart ──────────────────────────────────────────────────

function ActivityChart({ data, loading }: { data: Record<string, number>; loading?: boolean }) {
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  const max = Math.max(...entries.map((e) => e[1]), 1);

  return (
    <div className="card-solana rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 border border-solana-border flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#14F195]">
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
        <div className="flex items-center justify-center h-36 text-slate-500 text-sm">No activity data yet</div>
      ) : (
        <div className="flex items-end gap-1.5 h-36">
          {entries.map(([date, count], i) => (
            <div key={date} className="flex-1 group flex flex-col items-center gap-1">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-slate-400 font-medium">{count}</div>
              <div
                className="w-full rounded-t-md transition-all duration-700 ease-out relative overflow-hidden"
                style={{ height: `${Math.max((count / max) * 100, 4)}%`, animationDelay: `${i * 60}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#9945FF] via-purple-400 to-[#14F195] opacity-90" />
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10" />
              </div>
              <div className="text-[9px] text-slate-600 mt-0.5 tabular-nums">{date.slice(5)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Action Type Breakdown ──────────────────────────────────────────────

function ActionTypeChart({ data, loading }: { data: Record<string, number>; loading?: boolean }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, e) => s + e[1], 0);
  const colors = [
    "from-[#9945FF] to-purple-400",
    "from-[#14F195] to-emerald-300",
    "from-purple-400 to-[#14F195]",
    "from-amber-500 to-yellow-400",
    "from-rose-500 to-pink-400",
    "from-indigo-500 to-blue-400",
  ];

  return (
    <div className="card-solana rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF]/20 to-purple-500/20 border border-solana-border flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9945FF]">
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
        <div className="text-slate-500 text-sm text-center py-8">No data yet</div>
      ) : (
        <div className="space-y-3">
          {entries.slice(0, 6).map(([type, count], i) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={type}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-300 font-medium">{type}</span>
                  <span className="text-slate-500 tabular-nums">{count} <span className="text-slate-600">({pct}%)</span></span>
                </div>
                <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 rounded-full bg-gradient-to-r ${colors[i % colors.length]} transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
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

function LiveFeed({ commitments, loading }: { commitments: Commitment[]; loading?: boolean }) {
  return (
    <div className="card-solana rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#14F195]/20 to-emerald-500/20 border border-solana-border flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#14F195]">
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
          <span className="w-2 h-2 rounded-full bg-[#14F195] pulse-dot" />
          <span className="text-xs text-[#14F195] font-medium">Live</span>
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
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
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
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#9945FF]/5 transition-all duration-200 group feed-item"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="mt-1.5 flex-shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full ${c.revealed ? "bg-[#14F195] shadow-[#14F195]/50 shadow-sm" : "bg-amber-500 shadow-amber-500/50 shadow-sm"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="hash-text text-slate-300 text-xs">{truncateAddress(c.commitmentHash, 6)}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#9945FF]/10 text-[#9945FF] border border-[#9945FF]/20">{c.actionType}</span>
                  <span className="text-[10px] text-slate-600">{c.confidence}%</span>
                  {c.network && (
                    <span className={`text-[10px] font-medium ${c.network === "mainnet" ? "text-[#14F195]/70" : "text-[#9945FF]/70"}`}>{c.network}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-600">{truncateAddress(c.authority)}</span>
                  <span className="text-[10px] text-slate-700">·</span>
                  <span className="text-[10px] text-slate-600">{timeAgo(c.timestamp)}</span>
                </div>
              </div>
              <div className="flex-shrink-0 mt-1">
                {c.revealed ? (
                  <span className="text-[10px] text-[#14F195]/80 font-medium">✓ Verified</span>
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
  agents, loading,
}: {
  agents: { address: string; authority: string; name: string; totalCommitments: number; totalVerified: number; accountabilityScore: number }[];
  loading?: boolean;
}) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="card-solana rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-solana-border flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Top Agents</h3>
            <p className="text-xs text-slate-500">By commitment activity</p>
          </div>
        </div>
        <a href="/agents" className="text-xs text-[#9945FF]/80 hover:text-[#9945FF] transition-colors">View all →</a>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-700/20 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">No agents registered yet</div>
      ) : (
        <div className="space-y-2">
          {agents.slice(0, 7).map((agent, i) => (
            <a key={agent.address} href={`/agent/${agent.authority}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#9945FF]/5 transition-all duration-200">
              <div className="w-6 text-center text-sm">{i < 3 ? medals[i] : <span className="text-slate-600">{i + 1}</span>}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{agent.name}</div>
                <div className="text-[10px] text-slate-600 hash-text">{truncateAddress(agent.authority)}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold tabular-nums">{agent.totalCommitments}</div>
                <div className="text-[10px] text-slate-600">commits</div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className={`text-sm font-medium tabular-nums ${agent.accountabilityScore >= 80 ? "text-[#14F195]" : agent.accountabilityScore >= 50 ? "text-amber-400" : "text-slate-500"}`}>
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

// ─── Ecosystem Integrations ─────────────────────────────────────────────

const INTEGRATIONS = [
  { name: "Eliza (ai16z)", desc: "AI agent framework plugin — upstream PR open", url: "https://github.com/ai16z/eliza", icon: "🤖", badge: "PR Open" },
  { name: "solana-agent-kit", desc: "Solana agent toolkit — upstream PR open", url: "https://github.com/sendaifun/solana-agent-kit", icon: "🛠", badge: "PR Open" },
  { name: "MCP Server", desc: "Model Context Protocol server for AI tools", url: "https://github.com/NeukoAI/axiom-protocol/tree/main/integrations/mcp-server", icon: "🔌", badge: "Live" },
  { name: "@solprism/sdk", desc: "TypeScript SDK on npm — install & commit in 3 lines", url: "https://www.npmjs.com/package/@solprism/sdk", icon: "📦", badge: "Published" },
  { name: "Eliza Plugin", desc: "Drop-in plugin for the Eliza agent framework", url: "https://github.com/NeukoAI/axiom-protocol/tree/main/integrations/eliza-plugin", icon: "🧩", badge: "Shipped" },
  { name: "Agent Kit Plugin", desc: "solana-agent-kit integration package", url: "https://github.com/NeukoAI/axiom-protocol/tree/main/integrations/agent-kit-plugin", icon: "⚡", badge: "Shipped" },
];

// ─── Main Page ──────────────────────────────────────────────────────────

export default function TractionDashboard() {
  const [stats, setStats] = useState<TractionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(30);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error("Failed to fetch traction stats:", e);
      try {
        const data = await fetchTractionStats();
        setStats(data);
      } catch (fallbackErr) {
        console.error("Fallback also failed:", fallbackErr);
      }
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
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#9945FF]/10 via-[#13111C] to-[#14F195]/10" />
        <div className="absolute inset-0 hero-grid" />

        {/* Glowing orbs */}
        <div className="orb orb-purple w-[300px] h-[300px] -top-20 -left-20 animate-float" />
        <div className="orb orb-green w-[200px] h-[200px] -bottom-10 -right-10 animate-float-delayed" />
        <div className="orb orb-purple w-[150px] h-[150px] top-1/2 right-1/4 animate-glow" />

        <div className="relative px-8 py-16 sm:py-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="w-2.5 h-2.5 rounded-full bg-[#14F195] pulse-dot" />
            <span className="text-xs font-semibold text-[#14F195] tracking-[0.2em] uppercase">
              Live on Solana
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tighter mb-4">
            <span className="solana-gradient-text-animated">SOLPRISM</span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-300 max-w-2xl mx-auto mb-3 font-light">
            Verifiable AI Reasoning on Solana
          </p>
          <p className="text-sm text-slate-500 max-w-xl mx-auto mb-8 leading-relaxed">
            Every AI agent commits a cryptographic proof of its reasoning onchain before acting.
            Browse, verify, and audit reasoning traces in real-time.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <a
              href="https://www.colosseum.com/agent-hackathon/projects/axiom-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="relative group px-8 py-3.5 rounded-xl font-bold text-black bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 transition-all duration-300 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
            >
              <div className="absolute inset-0 rounded-xl vote-cta-shimmer" />
              <span className="relative flex items-center gap-2">
                🏆 Vote for SOLPRISM
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </a>
            <a
              href="https://github.com/NeukoAI/axiom-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 rounded-xl font-semibold text-slate-300 border border-solana-border hover:border-[#9945FF]/50 hover:text-white transition-all duration-300 bg-white/[0.02]"
            >
              <span className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                View on GitHub
              </span>
            </a>
          </div>

          {/* Refresh indicator */}
          <div className="flex items-center justify-center gap-3 text-xs text-slate-600">
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
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
          gradient="from-[#9945FF] to-purple-400"
          sub="Across devnet & mainnet"
          loading={loading}
        />
        <HeroStat
          label="Reasoning Commits"
          value={stats?.totalCommitments ?? 0}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>}
          gradient="from-[#9945FF] to-[#14F195]"
          sub="SHA-256 hashes onchain"
          loading={loading}
        />
        <HeroStat
          label="Verified Reveals"
          value={stats?.totalReveals ?? 0}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
          gradient="from-[#14F195] to-emerald-400"
          sub={`${stats?.totalRevealRate ?? 0}% reveal rate`}
          loading={loading}
        />
        <HeroStat
          label="Ecosystem Integrations"
          value={INTEGRATIONS.length}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>}
          gradient="from-amber-500 to-orange-400"
          sub="Eliza · Agent Kit · MCP · SDK"
          loading={false}
        />
      </div>

      {/* ─── Traction Highlights ────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#9945FF]/20 bg-gradient-to-r from-[#9945FF]/5 via-[#13111C] to-[#14F195]/5">
        <div className="absolute inset-0 hero-grid opacity-[0.02]" />
        <div className="relative px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shadow-lg shadow-purple-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold solana-gradient-text tracking-wide uppercase">Protocol Traction</div>
              <div className="text-xs text-slate-400 mt-0.5">Real onchain data from Solana — not mock numbers</div>
            </div>
          </div>
          <div className="flex items-center gap-6 text-center">
            {[
              { label: "Agents", val: stats?.totalAgents ?? 0 },
              { label: "Traces", val: stats?.totalCommitments ?? 0 },
              { label: "Integrations", val: INTEGRATIONS.length },
              { label: "Networks", val: 2 },
            ].map((item, idx) => (
              <div key={item.label} className="flex items-center gap-6">
                {idx > 0 && <div className="w-px h-8 bg-solana-border" />}
                <div>
                  <div className="text-2xl font-bold text-white">
                    {loading && idx < 2 ? "..." : typeof item.val === "number" ? <AnimatedNumber target={item.val} /> : item.val}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Network Status ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 border border-solana-border flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#14F195]">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Network Status</h2>
            <p className="text-xs text-slate-500">Live program data from both networks</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <NetworkCard stats={stats?.devnet ?? { network: "devnet", agents: 0, commitments: 0, reveals: 0, revealRate: 0, lastCommitmentTs: null, loading: true, error: null }} accent="purple" />
          <NetworkCard stats={stats?.mainnet ?? { network: "mainnet", agents: 0, commitments: 0, reveals: 0, revealRate: 0, lastCommitmentTs: null, loading: true, error: null }} accent="green" />
        </div>
      </section>

      {/* ─── Charts ──────────────────────────────────────────────── */}
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

      {/* ─── Vote CTA Section ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-[#9945FF]/20 via-[#13111C] to-[#14F195]/20" />
        <div className="absolute inset-0 hero-grid" />
        <div className="orb orb-purple w-[200px] h-[200px] -top-10 -right-10 animate-glow" />
        <div className="orb orb-green w-[200px] h-[200px] -bottom-10 -left-10 animate-float" />
        <div className="relative px-8 py-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            <span className="solana-gradient-text">Support SOLPRISM</span>
          </h2>
          <p className="text-slate-400 max-w-lg mx-auto mb-8">
            We&apos;re building the accountability layer for AI agents on Solana.
            Vote for us in the Colosseum Agent Hackathon to help make AI reasoning transparent.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://www.colosseum.com/agent-hackathon/projects/axiom-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="relative group px-10 py-4 rounded-xl font-bold text-lg text-black bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/50"
            >
              <div className="absolute inset-0 rounded-xl vote-cta-shimmer" />
              <span className="relative">🏆 Vote Now on Colosseum</span>
            </a>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm">
            <a href="https://x.com/BasedMereum" target="_blank" className="text-slate-500 hover:text-[#14F195] transition-colors flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              @BasedMereum
            </a>
            <a href="https://github.com/NeukoAI/axiom-protocol" target="_blank" className="text-slate-500 hover:text-[#14F195] transition-colors flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              GitHub
            </a>
            <a href="https://www.npmjs.com/package/@solprism/sdk" target="_blank" className="text-slate-500 hover:text-[#14F195] transition-colors flex items-center gap-2">
              📦 npm SDK
            </a>
          </div>
        </div>
      </div>

      {/* ─── Ecosystem ───────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF]/20 to-purple-500/20 border border-solana-border flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9945FF]">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Ecosystem &amp; Integrations</h2>
            <p className="text-xs text-slate-500">{INTEGRATIONS.length} integrations across major AI agent frameworks</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INTEGRATIONS.map((item) => (
            <a
              key={item.name}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card-solana rounded-2xl p-5 group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-2xl">{item.icon}</div>
                {item.badge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    item.badge === "PR Open" ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : item.badge === "Published" ? "bg-[#14F195]/10 text-[#14F195] border-[#14F195]/20"
                    : item.badge === "Live" ? "bg-[#14F195]/10 text-[#14F195] border-[#14F195]/20"
                    : "bg-[#9945FF]/10 text-[#9945FF] border-[#9945FF]/20"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <div className="text-sm font-semibold group-hover:text-white transition-colors">{item.name}</div>
              <div className="text-xs text-slate-500 mt-1">{item.desc}</div>
              <div className="text-xs text-[#9945FF]/60 mt-3 group-hover:text-[#9945FF] transition-colors">View →</div>
            </a>
          ))}
        </div>
      </section>

      {/* ─── Protocol Footer ─────────────────────────────────────── */}
      <div className="card-solana rounded-2xl p-6">
        <div className="grid sm:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-medium">Program</div>
            <a
              href={explorerUrl("CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu", "address", "mainnet")}
              target="_blank"
              className="hash-text text-slate-400 hover:text-[#14F195] transition-colors text-xs break-all"
            >
              CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu
            </a>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-medium">Status</div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#14F195]" />
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
