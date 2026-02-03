import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOLPRISM Explorer — Verifiable AI Reasoning on Solana",
  description:
    "Browse, search, and verify AI agent reasoning traces committed onchain through the SOLPRISM protocol.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <nav className="border-b border-slate-800 bg-[#0d1321]/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <a href="/" className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className="text-lg font-bold tracking-tight">
                  SOLPRISM
                  <span className="text-slate-500 font-normal ml-2 text-sm">Explorer</span>
                </span>
              </a>
              <div className="flex items-center gap-6">
                <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Explorer
                </a>
                <a href="/dashboard" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Dashboard
                </a>
                <a href="/agents" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Agents
                </a>
                <a href="/verify" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Verify
                </a>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
                  Devnet
                </div>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-800 mt-16 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-slate-500">
            <span>SOLPRISM Protocol — Verifiable AI Reasoning on Solana</span>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/basedmereum/axiom-protocol"
                className="hover:text-slate-300 transition-colors"
                target="_blank"
              >
                GitHub
              </a>
              <a
                href="https://explorer.solana.com/address/CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu?cluster=devnet"
                className="hover:text-slate-300 transition-colors"
                target="_blank"
              >
                Program ↗
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
