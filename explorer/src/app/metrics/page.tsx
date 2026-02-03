"use client";

import { useEffect, useState } from "react";
import {
  fetchAllCommitments,
  fetchAllAgents,
  type Commitment,
  type AgentProfile,
} from "@/lib/solprism";

interface MetricsData {
  totalAgents: number;
  totalCommitments: number;
  totalRevealed: number;
  revealRate: number;
  avgConfidence: number;
  actionTypes: Record<string, number>;
  dailyActivity: Record<string, number>;
  topAgents: { name: string; authority: string; commitments: number; verified: number; score: number }[];
  uniqueAuthorities: number;
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#1a2235] border border-slate-800 rounded-xl p-6">
      <div className="text-sm text-slate-400 mb-1">{label}</div>
      <div className={`text-3xl font-bold tracking-tight ${accent || ''}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function BarChart({ data, label }: { data: Record<string, number>; label: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(e => e[1]), 1);
  
  return (
    <div className="bg-[#1a2235] border border-slate-800 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-slate-400 mb-4">{label}</h3>
      <div className="space-y-3">
        {entries.slice(0, 8).map(([key, val]) => (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-300">{key}</span>
              <span className="text-slate-500">{val}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(val / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityTimeline({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max(...entries.map(e => e[1]), 1);
  
  return (
    <div className="bg-[#1a2235] border border-slate-800 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-slate-400 mb-4">Daily Commitments</h3>
      {entries.length === 0 ? (
        <div className="text-slate-500 text-sm">No activity data yet</div>
      ) : (
        <div className="flex items-end gap-1 h-32">
          {entries.map(([date, count]) => (
            <div key={date} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-xs text-slate-500">{count}</div>
              <div
                className="w-full bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t min-h-[4px] transition-all duration-500"
                style={{ height: `${(count / max) * 100}%` }}
              />
              <div className="text-[10px] text-slate-600 -rotate-45 origin-top-left whitespace-nowrap">
                {date.slice(5)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function computeMetrics(agents: AgentProfile[], commitments: Commitment[]): MetricsData {
  const totalRevealed = commitments.filter(c => c.revealed).length;
  const avgConfidence = commitments.length > 0
    ? Math.round(commitments.reduce((sum, c) => sum + c.confidence, 0) / commitments.length)
    : 0;

  const actionTypes: Record<string, number> = {};
  commitments.forEach(c => {
    actionTypes[c.actionType] = (actionTypes[c.actionType] || 0) + 1;
  });

  const dailyActivity: Record<string, number> = {};
  commitments.forEach(c => {
    const date = new Date(c.timestamp * 1000).toISOString().split('T')[0];
    dailyActivity[date] = (dailyActivity[date] || 0) + 1;
  });

  const uniqueAuthorities = new Set(agents.map(a => a.authority)).size;

  const topAgents = agents
    .sort((a, b) => b.totalCommitments - a.totalCommitments)
    .slice(0, 10)
    .map(a => ({
      name: a.name,
      authority: a.authority,
      commitments: a.totalCommitments,
      verified: a.totalVerified,
      score: a.accountabilityScore,
    }));

  return {
    totalAgents: agents.length,
    totalCommitments: commitments.length,
    totalRevealed,
    revealRate: commitments.length > 0 ? Math.round((totalRevealed / commitments.length) * 100) : 0,
    avgConfidence,
    actionTypes,
    dailyActivity,
    topAgents,
    uniqueAuthorities,
  };
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [agents, commitments] = await Promise.all([
          fetchAllAgents(),
          fetchAllCommitments(),
        ]);
        setMetrics(computeMetrics(agents, commitments));
      } catch (e) {
        console.error("Failed to load metrics:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 animate-pulse">Loading metrics from Solana...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Failed to load metrics</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Protocol
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
            {" "}Metrics
          </span>
        </h1>
        <p className="text-slate-400">
          Real-time onchain analytics for verifiable AI reasoning
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label="Total Agents" value={metrics.totalAgents} />
        <MetricCard label="Unique Authorities" value={metrics.uniqueAuthorities} />
        <MetricCard label="Commitments" value={metrics.totalCommitments} />
        <MetricCard
          label="Reveal Rate"
          value={`${metrics.revealRate}%`}
          accent={metrics.revealRate > 80 ? "text-green-400" : metrics.revealRate > 50 ? "text-yellow-400" : "text-red-400"}
        />
        <MetricCard label="Avg Confidence" value={`${metrics.avgConfidence}%`} />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        <BarChart data={metrics.actionTypes} label="Commitment Types" />
        <ActivityTimeline data={metrics.dailyActivity} />
      </div>

      {/* Top Agents Table */}
      <div className="bg-[#1a2235] border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-400 mb-4">Top Agents by Activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left py-2 px-3">Agent</th>
                <th className="text-right py-2 px-3">Commitments</th>
                <th className="text-right py-2 px-3">Verified</th>
                <th className="text-right py-2 px-3">Score</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topAgents.map((a, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-3">
                    <a href={`/agent/${a.authority}`} className="text-blue-400 hover:text-blue-300">
                      {a.name}
                    </a>
                  </td>
                  <td className="text-right py-2 px-3 text-slate-300">{a.commitments}</td>
                  <td className="text-right py-2 px-3 text-slate-300">{a.verified}</td>
                  <td className="text-right py-2 px-3">
                    <span className={a.score >= 80 ? "text-green-400" : a.score >= 50 ? "text-yellow-400" : "text-slate-400"}>
                      {a.score}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Protocol Info Footer */}
      <div className="text-center text-xs text-slate-600 py-4">
        Data read directly from Solana. Program ID: CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu
      </div>
    </div>
  );
}
