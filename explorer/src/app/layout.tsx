import type { Metadata } from "next";
import { Syne, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

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
    <html lang="en" className={`dark ${syne.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen antialiased bg-solana-dark font-[family-name:var(--font-space)]">
        {/* Vote Banner */}
        <div className="vote-banner sticky top-0 z-[60]">
          <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
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
                className="ml-1 px-3.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black hover:opacity-90 transition-opacity"
              >
                Vote Now →
              </a>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="border-b border-[#1a1628]/80 bg-[#06050a]/70 backdrop-blur-2xl sticky top-10 z-50">
          <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
            <div className="flex items-center justify-between h-16">
              <a href="/" className="flex items-center gap-3.5 group">
                {/* Logo mark */}
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all duration-500 group-hover:scale-105">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-[family-name:var(--font-syne)] font-extrabold tracking-tight solana-gradient-text">
                    SOLPRISM
                  </span>
                  <span className="text-[11px] text-[#8b87a0] font-medium tracking-widest uppercase">Explorer</span>
                </div>
              </a>
              <div className="flex items-center gap-1 sm:gap-2">
                <a href="/" className="nav-link text-[13px] text-[#8b87a0] hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/[0.04]">
                  Dashboard
                </a>
                <a href="/agents" className="nav-link text-[13px] text-[#8b87a0] hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/[0.04] hidden sm:block">
                  Agents
                </a>
                <a href="/verify" className="nav-link text-[13px] text-[#8b87a0] hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/[0.04] hidden sm:block">
                  Verify
                </a>
                <div className="flex items-center gap-1.5 ml-3 px-3 py-1.5 rounded-full bg-[#14F195]/[0.07] border border-[#14F195]/15">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] pulse-dot" />
                  <span className="text-[11px] text-[#14F195] font-semibold tracking-wide">LIVE</span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 py-10">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-[#1a1628]/60 mt-20">
          <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 py-16">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
              <div>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                    </svg>
                  </div>
                  <span className="font-[family-name:var(--font-syne)] font-bold solana-gradient-text text-lg">SOLPRISM</span>
                </div>
                <p className="text-[13px] text-[#8b87a0] leading-relaxed max-w-[260px]">
                  Verifiable AI reasoning on Solana. Commit-reveal protocol for transparent AI agent decisions.
                </p>
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-[#8b87a0] uppercase tracking-[0.15em] mb-4">Protocol</h4>
                <div className="space-y-2.5">
                  <a href="/" className="block text-[13px] text-[#6b6780] hover:text-[#14F195] transition-colors">Dashboard</a>
                  <a href="/agents" className="block text-[13px] text-[#6b6780] hover:text-[#14F195] transition-colors">Agents</a>
                  <a href="/verify" className="block text-[13px] text-[#6b6780] hover:text-[#14F195] transition-colors">Verify</a>
                </div>
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-[#8b87a0] uppercase tracking-[0.15em] mb-4">Developers</h4>
                <div className="space-y-2.5">
                  <a href="https://github.com/NeukoAI/axiom-protocol" target="_blank" className="block text-[13px] text-[#6b6780] hover:text-[#14F195] transition-colors">GitHub</a>
                  <a href="https://www.npmjs.com/package/@solprism/sdk" target="_blank" className="block text-[13px] text-[#6b6780] hover:text-[#14F195] transition-colors">npm SDK</a>
                  <a href="https://explorer.solana.com/address/CZcvoryaQNrtZ3qb3gC1h9opcYpzEP1D9Mu1RVwFQeBu" target="_blank" className="block text-[13px] text-[#6b6780] hover:text-[#14F195] transition-colors">Solana Explorer</a>
                </div>
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-[#8b87a0] uppercase tracking-[0.15em] mb-4">Community</h4>
                <div className="space-y-2.5">
                  <a href="https://x.com/BasedMereum" target="_blank" className="block text-[13px] text-[#6b6780] hover:text-[#14F195] transition-colors">Twitter / X</a>
                  <a href="https://www.colosseum.com/agent-hackathon/projects/axiom-protocol" target="_blank" className="block text-[13px] text-[#6b6780] hover:text-[#14F195] transition-colors">Colosseum Hackathon</a>
                </div>
              </div>
            </div>
            <div className="accent-line mb-6" />
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[#4a4660]">
              <span>Built on Solana · Powered by cryptographic accountability</span>
              <span className="font-[family-name:var(--font-mono)] tracking-wider">Program: CZcvo...QeBu</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
