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

// ─── Stagger Wrapper ────────────────────────────────────────────────────

function Stagger({ children, index, className = "" }: { children: React.ReactNode; index: number; className?: string }) {
  return (
    <div className={`animate-fade-up ${className}`} style={{ animationDelay: `${index * 80 + 100}ms` }}>
      {children}
    </div>
  );
}

// ─── Hero Stat Card ─────────────────────────────────────────────────────

function HeroStat({
  label, value, icon, gradient, sub, loading, index,
}: {
  label: string; value: number; icon: React.ReactNode; gradient: string; sub?: string; loading?: boolean; index: number;
}) {
  return (
    <Stagger index={index}>
      <div className="relative group h-full">
        {/* Glow on hover */}
        <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-[0.08] blur-xl transition-all duration-700`} />
        <div className="relative card-solana rounded-2xl p-6 h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white/90 shadow-lg`}>
              {icon}
            </div>
            <span className="text-[13px] text-[#8b87a0] font-medium">{label}</span>
          </div>
          {loading ? (
            <div className="h-11 w-28 bg-[#1a1628] rounded-lg animate-pulse" />
          ) : (
            <>
              <div className="text-4xl font-[family-name:var(--font-syne)] font-extrabold tracking-tight">
                <AnimatedNumber target={value} />
              </div>
              {sub && <div className="text-[11px] text-[#6b6780] mt-2 tracking-wide">{sub}</div>}
            </>
          )}
        </div>
      </div>
    </Stagger>
  );
}

// ─── Network Badge ──────────────────────────────────────────────────────

function NetworkCard({ stats, accent, index }: { stats: NetworkStats; accent: "green" | "purple"; index: number }) {
  const colors = {
    green: {
      bg: "from-[#14F195]/[0.06] to-[#14F195]/[0.02]",
      border: "border-[#14F195]/15 hover:border-[#14F195]/30",
      text: "text-[#14F195]",
      dot: "bg-[#14F195]",
      glow: "shadow-[#14F195]/5",
    },
    purple: {
      bg: "from-[#9945FF]/[0.06] to-[#9945FF]/[0.02]",
      border: "border-[#9945FF]/15 hover:border-[#9945FF]/30",
      text: "text-[#9945FF]",
      dot: "bg-[#9945FF]",
      glow: "shadow-[#9945FF]/5",
    },
  }[accent];

  return (
    <Stagger index={index}>
      <div className={`bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-2xl p-6 transition-all duration-500 hover:shadow-lg ${colors.glow}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full ${colors.dot} pulse-dot`} />
            <span className={`text-[11px] font-bold uppercase tracking-[0.2em] ${colors.text}`}>
              {stats.network}
            </span>
          </div>
          {stats.error && (
            <span className="text-[11px] text-red-400/60 truncate max-w-[140px]">⚠ {stats.error}</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-5">
          {[
            { label: "Agents", value: stats.agents },
            { label: "Commits", value: stats.commitments },
            { label: "Reveals", value: stats.reveals },
            { label: "Rate", value: stats.revealRate, suffix: "%" },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-[11px] text-[#6b6780] mb-1 tracking-wide">{item.label}</div>
              {stats.loading ? (
                <div className="h-7 w-14 bg-[#1a1628] rounded animate-pulse" />
              ) : (
                <div className="text-xl font-[family-name:var(--font-syne)] font-bold">
                  {item.value.toLocaleString()}{item.suffix || ""}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Stagger>
  );
}

// ─── Activity Chart ──────────────────────────────────────────────────

function ActivityChart({ data, loading }: { data: Record<string, number>; loading?: boolean }) {
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  const max = Math.max(...entries.map((e) => e[1]), 1);

  return (
    <div className="card-solana rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF]/15 to-[#14F195]/15 border border-[#1a1628] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#14F195]">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Activity Timeline</h3>
            <p className="text-[11px] text-[#6b6780]">Daily reasoning commitments</p>
          </div>
        </div>
        <span className="text-[11px] text-[#4a4660] font-[family-name:var(--font-mono)]">14d</span>
      </div>
      {loading ? (
        <div className="flex items-end gap-2 h-40">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="flex-1 bg-[#1a1628] rounded-t animate-pulse" style={{ height: `${20 + Math.random() * 80}%` }} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-[#6b6780] text-sm">No activity data yet</div>
      ) : (
        <div className="flex items-end gap-[5px] h-40">
          {entries.map(([date, count], i) => (
            <div key={date} className="flex-1 group flex flex-col items-center gap-1.5">
              <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 text-[11px] text-[#8b87a0] font-[family-name:var(--font-mono)] font-medium -translate-y-1 group-hover:translate-y-0">{count}</div>
              <div
                className="w-full rounded-t transition-all duration-700 ease-out relative overflow-hidden group-hover:shadow-lg group-hover:shadow-[#9945FF]/10"
                style={{ height: `${Math.max((count / max) * 100, 6)}%`, animationDelay: `${i * 60}ms` }}
              >
                <div className="absolute inset-0 bar-gradient opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.06]" />
              </div>
              <div className="text-[9px] text-[#4a4660] font-[family-name:var(--font-mono)] mt-0.5">{date.slice(5)}</div>
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
    "from-[#9945FF] to-[#b66dff]",
    "from-[#14F195] to-[#5dffc0]",
    "from-[#b66dff] to-[#14F195]",
    "from-amber-500 to-yellow-400",
    "from-rose-500 to-pink-400",
    "from-indigo-500 to-blue-400",
  ];

  return (
    <div className="card-solana rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF]/15 to-purple-500/10 border border-[#1a1628] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9945FF]">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Action Types</h3>
          <p className="text-[11px] text-[#6b6780]">Reasoning categories</p>
        </div>
      </div>
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 bg-[#1a1628] rounded animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-[#6b6780] text-sm text-center py-10">No data yet</div>
      ) : (
        <div className="space-y-4">
          {entries.slice(0, 6).map(([type, count], i) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={type} className="group">
                <div className="flex justify-between text-[13px] mb-2">
                  <span className="text-[#c5c2d4] font-medium">{type}</span>
                  <span className="text-[#6b6780] font-[family-name:var(--font-mono)] text-[12px]">{count} <span className="text-[#4a4660]">({pct}%)</span></span>
                </div>
                <div className="w-full bg-[#110f1a] rounded-full h-[6px] overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${colors[i % colors.length]} transition-all duration-1000 ease-out group-hover:shadow-sm`} style={{ width: `${pct}%` }} />
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#14F195]/15 to-emerald-500/10 border border-[#1a1628] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#14F195]">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Live Activity</h3>
            <p className="text-[11px] text-[#6b6780]">Recent reasoning commitments</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] pulse-dot" />
          <span className="text-[11px] text-[#14F195] font-semibold tracking-wide">Live</span>
        </div>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#110f1a] rounded-xl animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      ) : commitments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#6b6780]">
          <div className="w-12 h-12 rounded-full bg-[#110f1a] flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#4a4660]">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
          </div>
          <span className="text-sm font-medium">No activity yet</span>
          <span className="text-[11px] text-[#4a4660] mt-1">Waiting for first commit...</span>
        </div>
      ) : (
        <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
          {commitments.map((c, i) => (
            <a
              key={c.address}
              href={`/commitment/${c.address}`}
              className="flex items-start gap-3.5 p-3.5 rounded-xl hover:bg-[#9945FF]/[0.04] transition-all duration-300 group feed-item border border-transparent hover:border-[#1a1628]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="mt-2 flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${c.revealed ? "bg-[#14F195] shadow-[0_0_8px_rgba(20,241,149,0.4)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-[family-name:var(--font-mono)] text-[#c5c2d4] text-[12px]">{truncateAddress(c.commitmentHash, 6)}</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#9945FF]/[0.08] text-[#b66dff] border border-[#9945FF]/15">{c.actionType}</span>
                  <span className="text-[10px] text-[#4a4660] font-[family-name:var(--font-mono)]">{c.confidence}%</span>
                  {c.network && (
                    <span className={`text-[10px] font-semibold ${c.network === "mainnet" ? "text-[#14F195]/60" : "text-[#9945FF]/60"}`}>{c.network}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-[#4a4660] font-[family-name:var(--font-mono)]">{truncateAddress(c.authority)}</span>
                  <span className="text-[10px] text-[#2a2445]">·</span>
                  <span className="text-[10px] text-[#4a4660]">{timeAgo(c.timestamp)}</span>
                </div>
              </div>
              <div className="flex-shrink-0 mt-1.5">
                {c.revealed ? (
                  <span className="text-[10px] text-[#14F195]/70 font-semibold">✓ Verified</span>
                ) : (
                  <span className="text-[10px] text-amber-400/50 font-medium">Pending</span>
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/15 to-yellow-500/10 border border-[#1a1628] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Top Agents</h3>
            <p className="text-[11px] text-[#6b6780]">By commitment activity</p>
          </div>
        </div>
        <a href="/agents" className="text-[11px] text-[#9945FF]/70 hover:text-[#9945FF] transition-colors font-medium">View all →</a>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-[#110f1a] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-10 text-[#6b6780] text-sm">No agents registered yet</div>
      ) : (
        <div className="space-y-1">
          {agents.slice(0, 7).map((agent, i) => (
            <a key={agent.address} href={`/agent/${agent.authority}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#9945FF]/[0.04] transition-all duration-300 border border-transparent hover:border-[#1a1628]">
              <div className="w-7 text-center text-sm">{i < 3 ? medals[i] : <span className="text-[#4a4660] font-[family-name:var(--font-mono)] text-[12px]">{i + 1}</span>}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate">{agent.name}</div>
                <div className="text-[10px] text-[#4a4660] font-[family-name:var(--font-mono)]">{truncateAddress(agent.authority)}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[13px] font-[family-name:var(--font-syne)] font-bold tabular-nums">{agent.totalCommitments}</div>
                <div className="text-[10px] text-[#4a4660]">commits</div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className={`text-[13px] font-semibold tabular-nums ${agent.accountabilityScore >= 80 ? "text-[#14F195]" : agent.accountabilityScore >= 50 ? "text-amber-400" : "text-[#6b6780]"}`}>
                  {agent.accountabilityScore}%
                </div>
                <div className="text-[10px] text-[#4a4660]">score</div>
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
    <div className="space-y-16">
      {/* ─── Hero ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[28px]">
        {/* Layered background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#9945FF]/[0.07] via-[#06050a] to-[#14F195]/[0.05]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06050a] via-transparent to-transparent" />
        <div className="absolute inset-0 hero-grid" />

        {/* Orbs with more depth */}
        <div className="orb orb-purple w-[400px] h-[400px] -top-32 -left-32 animate-float" />
        <div className="orb orb-green w-[250px] h-[250px] -bottom-16 -right-16 animate-float-delayed" />
        <div className="orb orb-purple w-[180px] h-[180px] top-1/3 right-1/4 animate-glow" />

        {/* Geometric accents */}
        <div className="absolute top-12 left-12 w-24 h-24 border border-[#9945FF]/[0.08] rounded-full ring-spin hidden lg:block" />
        <div className="absolute bottom-16 right-16 w-16 h-16 border border-[#14F195]/[0.08] rounded-lg rotate-45 animate-float-delayed hidden lg:block" />

        <div className="relative px-8 py-20 sm:py-28">
          {/* Asymmetric layout — text left-aligned on large screens */}
          <div className="max-w-3xl mx-auto lg:mx-0 lg:ml-8 xl:ml-16">
            <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
              <div className="flex items-center gap-2.5 mb-8">
                <span className="w-2 h-2 rounded-full bg-[#14F195] pulse-dot" />
                <span className="text-[11px] font-bold text-[#14F195] tracking-[0.25em] uppercase">
                  Live on Solana
                </span>
              </div>
            </div>

            <div className="animate-fade-up" style={{ animationDelay: '80ms' }}>
              <h1 className="text-6xl sm:text-8xl lg:text-9xl font-[family-name:var(--font-syne)] font-black tracking-[-0.04em] mb-6 leading-[0.9]">
                <span className="solana-gradient-text-animated">SOL</span>
                <span className="text-white/90">PRISM</span>
              </h1>
            </div>

            <div className="animate-fade-up" style={{ animationDelay: '160ms' }}>
              <p className="text-xl sm:text-2xl text-[#c5c2d4] mb-4 font-light leading-relaxed max-w-xl">
                Verifiable AI Reasoning on Solana
              </p>
            </div>

            <div className="animate-fade-up" style={{ animationDelay: '240ms' }}>
              <p className="text-[14px] text-[#6b6780] max-w-lg mb-10 leading-[1.7]">
                Every AI agent commits a cryptographic proof of its reasoning onchain before acting.
                Browse, verify, and audit reasoning traces in real-time.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="animate-fade-up flex flex-col sm:flex-row items-start gap-4 mb-10" style={{ animationDelay: '320ms' }}>
              <a
                href="https://www.colosseum.com/agent-hackathon/projects/axiom-protocol"
                target="_blank"
                rel="noopener noreferrer"
                className="relative group px-8 py-3.5 rounded-xl font-bold text-black bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 transition-all duration-300 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-[1.02]"
              >
                <div className="absolute inset-0 rounded-xl vote-cta-shimmer" />
                <span className="relative flex items-center gap-2.5 text-[14px]">
                  🏆 Vote for SOLPRISM
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </a>
              <a
                href="https://github.com/NeukoAI/axiom-protocol"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 rounded-xl font-semibold text-[#8b87a0] border border-[#1a1628] hover:border-[#9945FF]/30 hover:text-white transition-all duration-300 bg-white/[0.02] hover:bg-white/[0.04] text-[14px]"
              >
                <span className="flex items-center gap-2.5">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  View on GitHub
                </span>
              </a>
            </div>

            {/* Refresh indicator */}
            <div className="animate-fade-up flex items-center gap-3 text-[11px] text-[#4a4660]" style={{ animationDelay: '400ms' }}>
              <span className="font-[family-name:var(--font-mono)]">Auto-refresh 30s</span>
              <span className="text-[#2a2445]">·</span>
              <span className="font-[family-name:var(--font-mono)]">Next in {countdown}s</span>
            </div>
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
          index={0}
        />
        <HeroStat
          label="Reasoning Commits"
          value={stats?.totalCommitments ?? 0}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>}
          gradient="from-[#9945FF] to-[#14F195]"
          sub="SHA-256 hashes onchain"
          loading={loading}
          index={1}
        />
        <HeroStat
          label="Verified Reveals"
          value={stats?.totalReveals ?? 0}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
          gradient="from-[#14F195] to-emerald-400"
          sub={`${stats?.totalRevealRate ?? 0}% reveal rate`}
          loading={loading}
          index={2}
        />
        <HeroStat
          label="Ecosystem Integrations"
          value={INTEGRATIONS.length}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>}
          gradient="from-amber-500 to-orange-400"
          sub="Eliza · Agent Kit · MCP · SDK"
          loading={false}
          index={3}
        />
      </div>

      {/* ─── Traction Highlights ────────────────────────────────── */}
      <Stagger index={0}>
        <div className="relative overflow-hidden rounded-2xl border border-[#9945FF]/[0.12] bg-gradient-to-r from-[#9945FF]/[0.04] via-[#0d0b14] to-[#14F195]/[0.04]">
          <div className="absolute inset-0 hero-grid opacity-30" />
          <div className="relative px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shadow-lg shadow-purple-500/20">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-[family-name:var(--font-syne)] font-bold solana-gradient-text tracking-wider uppercase">Protocol Traction</div>
                <div className="text-[11px] text-[#6b6780] mt-0.5">Real onchain data from Solana — not mock numbers</div>
              </div>
            </div>
            <div className="flex items-center gap-8 text-center">
              {[
                { label: "Agents", val: stats?.totalAgents ?? 0 },
                { label: "Traces", val: stats?.totalCommitments ?? 0 },
                { label: "Integrations", val: INTEGRATIONS.length },
                { label: "Networks", val: 2 },
              ].map((item, idx) => (
                <div key={item.label} className="flex items-center gap-8">
                  {idx > 0 && <div className="w-px h-10 bg-[#1a1628]" />}
                  <div>
                    <div className="text-2xl font-[family-name:var(--font-syne)] font-extrabold text-white">
                      {loading && idx < 2 ? <span className="text-[#4a4660]">...</span> : typeof item.val === "number" ? <AnimatedNumber target={item.val} /> : item.val}
                    </div>
                    <div className="text-[10px] text-[#4a4660] uppercase tracking-[0.15em] mt-0.5">{item.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Stagger>

      {/* ─── Network Status ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF]/15 to-[#14F195]/15 border border-[#1a1628] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#14F195]">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-[family-name:var(--font-syne)] font-bold">Network Status</h2>
            <p className="text-[11px] text-[#6b6780]">Live program data from both networks</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <NetworkCard stats={stats?.devnet ?? { network: "devnet", agents: 0, commitments: 0, reveals: 0, revealRate: 0, lastCommitmentTs: null, loading: true, error: null }} accent="purple" index={0} />
          <NetworkCard stats={stats?.mainnet ?? { network: "mainnet", agents: 0, commitments: 0, reveals: 0, revealRate: 0, lastCommitmentTs: null, loading: true, error: null }} accent="green" index={1} />
        </div>
      </section>

      {/* ─── Charts ──────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <Stagger index={0}>
          <ActivityChart data={stats?.dailyActivity ?? {}} loading={loading} />
        </Stagger>
        <Stagger index={1}>
          <ActionTypeChart data={stats?.actionTypes ?? {}} loading={loading} />
        </Stagger>
      </div>

      {/* ─── Live Feed + Top Agents ──────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <Stagger index={0}>
            <LiveFeed commitments={stats?.recentCommitments ?? []} loading={loading} />
          </Stagger>
        </div>
        <div className="lg:col-span-2">
          <Stagger index={1}>
            <TopAgents agents={stats?.topAgents ?? []} loading={loading} />
          </Stagger>
        </div>
      </div>

      {/* ─── Vote CTA Section ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[28px]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#9945FF]/15 via-[#06050a] to-[#14F195]/15" />
        <div className="absolute inset-0 hero-grid" />
        <div className="orb orb-purple w-[250px] h-[250px] -top-16 -right-16 animate-glow" />
        <div className="orb orb-green w-[250px] h-[250px] -bottom-16 -left-16 animate-float" />
        <div className="relative px-8 py-20 text-center">
          <h2 className="text-4xl sm:text-5xl font-[family-name:var(--font-syne)] font-black mb-5 tracking-tight">
            <span className="solana-gradient-text">Support SOLPRISM</span>
          </h2>
          <p className="text-[#8b87a0] max-w-lg mx-auto mb-10 text-[15px] leading-relaxed">
            We&apos;re building the accountability layer for AI agents on Solana.
            Vote for us in the Colosseum Agent Hackathon to help make AI reasoning transparent.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://www.colosseum.com/agent-hackathon/projects/axiom-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="relative group px-10 py-4 rounded-xl font-bold text-lg text-black bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/50 hover:scale-[1.02]"
            >
              <div className="absolute inset-0 rounded-xl vote-cta-shimmer" />
              <span className="relative">🏆 Vote Now on Colosseum</span>
            </a>
          </div>
          <div className="flex items-center justify-center gap-8 mt-10 text-[13px]">
            <a href="https://x.com/BasedMereum" target="_blank" className="text-[#6b6780] hover:text-[#14F195] transition-colors flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              @BasedMereum
            </a>
            <a href="https://github.com/NeukoAI/axiom-protocol" target="_blank" className="text-[#6b6780] hover:text-[#14F195] transition-colors flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              GitHub
            </a>
            <a href="https://www.npmjs.com/package/@solprism/sdk" target="_blank" className="text-[#6b6780] hover:text-[#14F195] transition-colors flex items-center gap-2">
              📦 npm SDK
            </a>
          </div>
        </div>
      </div>

      {/* ─── Ecosystem ───────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF]/15 to-purple-500/10 border border-[#1a1628] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9945FF]">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-[family-name:var(--font-syne)] font-bold">Ecosystem &amp; Integrations</h2>
            <p className="text-[11px] text-[#6b6780]">{INTEGRATIONS.length} integrations across major AI agent frameworks</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INTEGRATIONS.map((item, i) => (
            <Stagger key={item.name} index={i} className="h-full">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card-solana rounded-2xl p-6 group block h-full"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-2xl">{item.icon}</div>
                  {item.badge && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      item.badge === "PR Open" ? "bg-amber-500/[0.08] text-amber-400 border-amber-500/15"
                      : item.badge === "Published" ? "bg-[#14F195]/[0.08] text-[#14F195] border-[#14F195]/15"
                      : item.badge === "Live" ? "bg-[#14F195]/[0.08] text-[#14F195] border-[#14F195]/15"
                      : "bg-[#9945FF]/[0.08] text-[#b66dff] border-[#9945FF]/15"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <div className="text-[14px] font-semibold group-hover:text-white transition-colors duration-300">{item.name}</div>
                <div className="text-[12px] text-[#6b6780] mt-1.5 leading-relaxed">{item.desc}</div>
                <div className="text-[11px] text-[#9945FF]/50 mt-4 group-hover:text-[#9945FF] transition-colors duration-300 font-medium">View →</div>
              </a>
            </Stagger>
          ))}
        </div>
      </section>

      {/* ─── Protocol Footer ─────────────────────────────────────── */}
      <div className="card-solana rounded-2xl p-6">
        <div className="grid sm:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="text-[10px] text-[#4a4660] mb-2.5 uppercase tracking-[0.15em] font-semibold">Program</div>
            <a
              href={explorerUrl("CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu", "address", "mainnet")}
              target="_blank"
              className="font-[family-name:var(--font-mono)] text-[#6b6780] hover:text-[#14F195] transition-colors text-[12px] break-all"
            >
              CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu
            </a>
          </div>
          <div>
            <div className="text-[10px] text-[#4a4660] mb-2.5 uppercase tracking-[0.15em] font-semibold">Status</div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#14F195]" />
              <span className="text-[#8b87a0] text-[13px]">Mainnet Immutable</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#4a4660] mb-2.5 uppercase tracking-[0.15em] font-semibold">How It Works</div>
            <div className="text-[#8b87a0] text-[13px] font-[family-name:var(--font-mono)]">Commit → Act → Reveal → Verify</div>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-center text-[11px] text-[#4a4660] pb-4 font-[family-name:var(--font-mono)]">
        Last refreshed: {lastRefresh.toLocaleTimeString()} · Data queried directly from Solana RPC
      </div>
    </div>
  );
}
