import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOLPRISM Explorer — Verifiable AI Reasoning on Solana",
  description:
    "Browse, search, and verify AI agent reasoning traces committed onchain through the SOLPRISM protocol. Built on Solana.",
  openGraph: {
    title: "SOLPRISM — Verifiable AI Reasoning on Solana",
    description: "Every AI agent commits cryptographic proof of its reasoning onchain before acting.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SOLPRISM — Verifiable AI Reasoning on Solana",
    description: "Every AI agent commits cryptographic proof of its reasoning onchain before acting.",
    creator: "@BasedMereum",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased bg-solana-dark">
        {/* Vote Banner */}
        <div className="vote-banner sticky top-0 z-[60]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-3 h-10 text-sm">
              <span className="text-purple-300/80">🏆</span>
              <span className="text-slate-300 text-xs sm:text-sm">
                <span className="hidden sm:inline">SOLPRISM is competing in the </span>
                <span className="font-semibold text-white">Colosseum Agent Hackathon</span>
              </span>
              <a
                href="https://www.colosseum.com/agent-hackathon/projects/axiom-protocol"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black hover:opacity-90 transition-opacity"
              >
                Vote Now →
              </a>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="border-b border-solana-border bg-solana-dark/80 backdrop-blur-xl sticky top-10 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <a href="/" className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-shadow">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className="text-lg font-bold tracking-tight">
                  <span className="solana-gradient-text">SOLPRISM</span>
                  <span className="text-slate-500 font-normal ml-2 text-sm">Explorer</span>
                </span>
              </a>
              <div className="flex items-center gap-1 sm:gap-4">
                <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
                  Dashboard
                </a>
                <a href="/agents" className="text-sm text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5 hidden sm:block">
                  Agents
                </a>
                <a href="/verify" className="text-sm text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5 hidden sm:block">
                  Verify
                </a>
                <div className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-[#14F195]/10 border border-[#14F195]/20">
                  <span className="w-2 h-2 rounded-full bg-[#14F195] pulse-dot" />
                  <span className="text-xs text-[#14F195] font-medium">Live</span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-solana-border mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                    </svg>
                  </div>
                  <span className="font-bold solana-gradient-text">SOLPRISM</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Verifiable AI reasoning on Solana. Commit-reveal protocol for transparent AI agent decisions.
                </p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Protocol</h4>
                <div className="space-y-2">
                  <a href="/" className="block text-sm text-slate-500 hover:text-[#14F195] transition-colors">Dashboard</a>
                  <a href="/agents" className="block text-sm text-slate-500 hover:text-[#14F195] transition-colors">Agents</a>
                  <a href="/verify" className="block text-sm text-slate-500 hover:text-[#14F195] transition-colors">Verify</a>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Developers</h4>
                <div className="space-y-2">
                  <a href="https://github.com/NeukoAI/axiom-protocol" target="_blank" className="block text-sm text-slate-500 hover:text-[#14F195] transition-colors">GitHub</a>
                  <a href="https://www.npmjs.com/package/@solprism/sdk" target="_blank" className="block text-sm text-slate-500 hover:text-[#14F195] transition-colors">npm SDK</a>
                  <a href="https://explorer.solana.com/address/CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu" target="_blank" className="block text-sm text-slate-500 hover:text-[#14F195] transition-colors">Solana Explorer</a>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Community</h4>
                <div className="space-y-2">
                  <a href="https://x.com/BasedMereum" target="_blank" className="block text-sm text-slate-500 hover:text-[#14F195] transition-colors">Twitter / X</a>
                  <a href="https://www.colosseum.com/agent-hackathon/projects/axiom-protocol" target="_blank" className="block text-sm text-slate-500 hover:text-[#14F195] transition-colors">Colosseum Hackathon</a>
                </div>
              </div>
            </div>
            <div className="border-t border-solana-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
              <span>Built on Solana · Powered by cryptographic accountability</span>
              <span className="hash-text">Program: CZcvo...QeBu</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
