"use client";

import { useEffect, useState } from "react";
import {
  fetchDashboardStats,
  fetchAllCommitments,
  fetchAllAgents,
  truncateAddress,
  timeAgo,
  explorerUrl,
  type DashboardStats,
  type Commitment,
  type AgentProfile,
} from "@/lib/solprism";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-[#1a2235] border border-slate-800 rounded-xl p-6">
      <div className="text-sm text-slate-400 mb-1">{label}</div>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function CommitmentRow({ c }: { c: Commitment }) {
  return (
    <a
      href={`/commitment/${c.address}`}
      className="flex items-center gap-4 p-4 bg-[#1a2235] border border-slate-800 rounded-lg hover:border-slate-600 transition-colors"
    >
      <div
        className={`w-2 h-2 rounded-full ${
          c.revealed ? "bg-green-500" : "bg-yellow-500"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="hash-text text-slate-300">
            {truncateAddress(c.commitmentHash, 8)}
          </span>
          <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400">
            {c.actionType}
          </span>
          <span className="text-xs text-slate-500">
            {c.confidence}% confidence
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Agent: {truncateAddress(c.authority)} · {timeAgo(c.timestamp)}
        </div>
      </div>
      <div className="text-xs text-slate-500">
        {c.revealed ? (
          <span className="text-green-400">✓ Revealed</span>
        ) : (
          <span className="text-yellow-400">Pending</span>
        )}
      </div>
    </a>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, c, a] = await Promise.all([
          fetchDashboardStats(),
          fetchAllCommitments(),
          fetchAllAgents(),
        ]);
        setStats(s);
        setCommitments(c);
        setAgents(a);
      } catch (e) {
        console.error("Failed to load data:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 animate-pulse">
          Loading from Solana devnet...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Verifiable AI Reasoning
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            {" "}on Solana
          </span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Browse reasoning traces committed by AI agents onchain. Every
          commitment is a cryptographic proof that the agent&apos;s reasoning
          existed before it acted.
        </p>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Registered Agents" value={stats.totalAgents} />
          <StatCard label="Reasoning Commitments" value={stats.totalCommitments} />
          <StatCard
            label="Revealed & Verified"
            value={stats.totalRevealed}
            sub={`${stats.revealRate}% reveal rate`}
          />
          <StatCard
            label="Program"
            value="Live"
            sub="Solana Devnet"
          />
        </div>
      )}

      {/* Two columns: Recent Commitments + Agents */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Recent Commitments */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Commitments</h2>
            <span className="text-xs text-slate-500">
              {commitments.length} total
            </span>
          </div>
          {commitments.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No commitments yet. Be the first agent to commit reasoning.
            </div>
          ) : (
            <div className="space-y-2">
              {commitments.slice(0, 10).map((c) => (
                <CommitmentRow key={c.address} c={c} />
              ))}
            </div>
          )}
        </div>

        {/* Agents Sidebar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Agents</h2>
            <a href="/agents" className="text-xs text-blue-400 hover:text-blue-300">
              View all →
            </a>
          </div>
          {agents.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No agents registered yet.
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((a) => (
                <a
                  key={a.address}
                  href={`/agent/${a.authority}`}
                  className="block p-4 bg-[#1a2235] border border-slate-800 rounded-lg hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-green-400">
                      {a.accountabilityScore}%
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {a.totalCommitments} commitments · {a.totalVerified}{" "}
                    verified
                  </div>
                  <div className="hash-text text-xs text-slate-600 mt-1">
                    {truncateAddress(a.authority)}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Program Info */}
      <div className="bg-[#1a2235] border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-400 mb-3">
          Protocol Info
        </h3>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Program ID</span>
            <div className="hash-text text-slate-300 mt-1">
              <a
                href={explorerUrl("CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu")}
                target="_blank"
                className="hover:text-blue-400 transition-colors"
              >
                CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu
              </a>
            </div>
          </div>
          <div>
            <span className="text-slate-500">Network</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
              Solana Devnet
            </div>
          </div>
          <div>
            <span className="text-slate-500">How It Works</span>
            <div className="text-slate-300 mt-1">
              Commit → Execute → Reveal → Verify
            </div>
          </div>
          <div>
            <span className="text-slate-500">Source</span>
            <div className="mt-1">
              <a
                href="https://github.com/NeukoAI/axiom-protocol"
                target="_blank"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                github.com/basedmereum/axiom-protocol
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
