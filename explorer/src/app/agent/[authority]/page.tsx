"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  fetchAgentByAuthority,
  fetchCommitmentsForAgent,
  truncateAddress,
  formatTimestamp,
  timeAgo,
  explorerUrl,
  PROGRAM_ID,
  type AgentProfile,
  type Commitment,
} from "@/lib/solprism";
import { PublicKey } from "@solana/web3.js";

const SEED_AGENT = Buffer.from("agent");

export default function AgentDetailPage() {
  const params = useParams();
  const authority = params.authority as string;

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const a = await fetchAgentByAuthority(authority);
        setAgent(a);

        if (a) {
          const c = await fetchCommitmentsForAgent(a.address);
          setCommitments(c);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authority]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 animate-pulse">Loading agent...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-2">Agent Not Found</h1>
        <p className="text-slate-400">
          No agent registered with authority{" "}
          <span className="hash-text">{truncateAddress(authority, 8)}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Agent Header */}
      <div className="bg-[#1a2235] border border-slate-800 rounded-xl p-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{agent.name}</h1>
            <div className="hash-text text-sm text-slate-500 mt-2">
              <a
                href={explorerUrl(authority)}
                target="_blank"
                className="hover:text-blue-400 transition-colors"
              >
                {authority}
              </a>
            </div>
            <div className="text-sm text-slate-400 mt-2">
              Registered {formatTimestamp(agent.createdAt)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-green-400">
              {agent.accountabilityScore}%
            </div>
            <div className="text-xs text-slate-500">accountability score</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-700">
          <div>
            <div className="text-2xl font-bold">{agent.totalCommitments}</div>
            <div className="text-xs text-slate-500">Total Commitments</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">
              {agent.totalVerified}
            </div>
            <div className="text-xs text-slate-500">Revealed & Verified</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">
              {agent.totalCommitments - agent.totalVerified}
            </div>
            <div className="text-xs text-slate-500">Pending Reveal</div>
          </div>
        </div>
      </div>

      {/* Commitments */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Reasoning Commitments</h2>
        {commitments.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No commitments yet.
          </div>
        ) : (
          <div className="space-y-3">
            {commitments.map((c) => (
              <a
                key={c.address}
                href={`/commitment/${c.address}`}
                className="block p-5 bg-[#1a2235] border border-slate-800 rounded-lg hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        c.revealed ? "bg-green-500" : "bg-yellow-500"
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="hash-text text-slate-300">
                          {truncateAddress(c.commitmentHash, 10)}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400">
                          {c.actionType}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Nonce #{c.nonce} · {c.confidence}% confidence ·{" "}
                        {timeAgo(c.timestamp)}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm">
                    {c.revealed ? (
                      <span className="text-green-400">✓ Revealed</span>
                    ) : (
                      <span className="text-yellow-400">Pending</span>
                    )}
                  </div>
                </div>
                {c.revealed && c.reasoningUri && (
                  <div className="mt-2 pl-5 text-xs text-slate-500">
                    URI: {c.reasoningUri}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
