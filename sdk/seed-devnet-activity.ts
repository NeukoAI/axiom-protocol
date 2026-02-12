#!/usr/bin/env npx tsx
/**
 * SOLPRISM Devnet Activity Seeder
 * 
 * Generates realistic agent reasoning activity on devnet:
 * 1. Creates new agent wallets, funds from main devnet wallet
 * 2. Registers agents with realistic DeFi/trading names
 * 3. Commits reasoning traces (SHA-256 hashes)
 * 4. Reveals reasoning with data URIs
 * 
 * Run: npx tsx seed-devnet-activity.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";

// Import SDK builders
import {
  buildRegisterAgentIx,
  buildCommitReasoningIx,
  buildRevealReasoningIx,
  deriveAgentPDA,
  deriveCommitmentPDA,
  SOLPRISM_PROGRAM_ID,
} from "./src/client";
import { createReasoningTrace } from "./src/schema";
import { hashTrace, hashTraceHex } from "./src/hash";
import { ReasoningTrace, ActionType } from "./src/types";

// ─── Config ─────────────────────────────────────────────────────────────

const DEVNET_RPC = "https://api.devnet.solana.com";
const BATCH_SIZE = 30;               // Number of agents to seed
const FUND_AMOUNT = 0.008 * LAMPORTS_PER_SOL; // SOL per agent (~0.008 covers register+commit+reveal+rent)
const DELAY_MS = 500;                // Delay between transactions to avoid rate limiting

// ─── Agent Templates ────────────────────────────────────────────────────

interface AgentTemplate {
  name: string;
  actionType: ActionType;
  scenario: {
    description: string;
    context: string;
    observations: string[];
    logic: string;
    alternatives: { action: string; reasonRejected: string }[];
    actionChosen: string;
    confidence: number;
    risk: string;
    outcome: string;
    dataSources: { name: string; type: "price_feed" | "oracle" | "api" | "on_chain" | "off_chain" | "model" | "other"; summary: string }[];
  };
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    name: "JupiterArb-v3",
    actionType: "trade",
    scenario: {
      description: "Execute SOL/USDC arbitrage via Jupiter aggregator",
      context: "Detected 0.3% price discrepancy between Orca and Raydium SOL/USDC pools during high volatility period",
      observations: [
        "SOL/USDC on Orca CLMM at $148.23, Raydium AMM at $148.67",
        "Spread of 0.30% exceeds gas costs (~$0.003) by 100x",
        "Historical fill rate for this spread size: 94.2%",
        "Current slot latency: 420ms avg"
      ],
      logic: "Price divergence detected across two major Solana DEXs. Jupiter route optimizer finds a 3-hop path: buy SOL on Orca CLMM → sell on Raydium concentrated liquidity → capture spread. Net profit after fees estimated at 0.27%. Slippage tolerance set at 0.1% based on current pool depth of $2.4M. Execution within 2 slots to prevent front-running.",
      alternatives: [
        { action: "Wait for larger spread", reasonRejected: "Spread is closing — delay risks missing the opportunity entirely" },
        { action: "Split across both pools", reasonRejected: "Single-direction arb is cleaner and avoids inventory risk" }
      ],
      actionChosen: "Execute 3-hop Jupiter arb route: Orca CLMM → Raydium CL",
      confidence: 87,
      risk: "Low — small position size, tight slippage, liquid pools",
      outcome: "Capture ~0.27% spread on 5 SOL position ($2.00 profit)",
      dataSources: [
        { name: "Jupiter Price API", type: "api", summary: "Best route: Orca CLMM → Raydium CL, 0.30% spread" },
        { name: "Orca CLMM Pool", type: "on_chain", summary: "SOL/USDC pool depth $2.4M, price $148.23" },
        { name: "Raydium AMM", type: "on_chain", summary: "SOL/USDC price $148.67, 24h volume $18M" }
      ]
    }
  },
  {
    name: "VaultRebalancer-Alpha",
    actionType: "rebalance",
    scenario: {
      description: "Rebalance DeFi vault allocations across Solana lending protocols",
      context: "Weekly rebalance cycle for multi-strategy vault with $850K TVL across Kamino, MarginFi, and Drift",
      observations: [
        "Kamino USDC yield dropped from 8.2% to 5.1% APY over 7 days",
        "MarginFi SOL lending rate spiked to 12.4% APY (leverage demand)",
        "Drift perp funding rate positive 0.03%/hr for SOL longs",
        "Total vault performance: +6.8% APY vs target 8.5%"
      ],
      logic: "Current allocation underperforming target by 1.7%. Root cause: Kamino USDC yield compression from increased deposits ($+15M this week). MarginFi SOL lending has elevated rates due to leveraged long demand ahead of potential ETF news. Optimal reallocation: reduce Kamino USDC from 40% to 25%, increase MarginFi SOL lending from 20% to 35%, maintain Drift delta-neutral at 40%. Expected blended yield: 9.2% APY.",
      alternatives: [
        { action: "Hold current allocation", reasonRejected: "Underperforming target by 1.7%, will compound losses over time" },
        { action: "Move 100% to MarginFi", reasonRejected: "Concentration risk — single protocol failure would wipe vault" },
        { action: "Add Solend allocation", reasonRejected: "Solend yields currently 3.8% APY, below all current positions" }
      ],
      actionChosen: "Rebalance: Kamino 40%→25%, MarginFi 20%→35%, Drift 40% hold",
      confidence: 79,
      risk: "Moderate — cross-protocol rebalance involves smart contract risk at each step",
      outcome: "Blended vault yield increases from 6.8% to ~9.2% APY",
      dataSources: [
        { name: "Kamino Finance API", type: "api", summary: "USDC vault APY: 5.1%, TVL: $124M" },
        { name: "MarginFi Program", type: "on_chain", summary: "SOL lending rate: 12.4% APY, utilization: 78%" },
        { name: "Drift Protocol", type: "on_chain", summary: "SOL-PERP funding: +0.03%/hr, OI: $45M" }
      ]
    }
  },
  {
    name: "RiskGuard-SOL",
    actionType: "audit",
    scenario: {
      description: "Automated risk assessment of new Solana DeFi protocol",
      context: "Evaluating a new yield aggregator requesting integration with our vault infrastructure",
      observations: [
        "Protocol deployed 14 days ago, TVL grew from $0 to $8.2M",
        "Smart contract not verified on Solscan — bytecode only",
        "Admin keys held by 2-of-3 multisig (one key is a fresh wallet)",
        "No formal audit report found, self-reported 'internal review'",
        "Token incentives account for ~60% of advertised yield"
      ],
      logic: "Risk scoring model assigns 72/100 risk score (high). Key concerns: unverified bytecode prevents independent code review, rapid TVL growth often precedes rug scenarios, multisig with fresh wallets suggests incomplete operational security. The 60% yield from token emissions is unsustainable and will compress as emissions decrease. Recommendation: do NOT integrate. Re-evaluate in 30 days if audit is published and TVL stabilizes.",
      alternatives: [
        { action: "Integrate with small allocation", reasonRejected: "Even small exposure to unverified contracts violates risk policy" },
        { action: "Request audit before integration", reasonRejected: "Audit timelines are 4-8 weeks; passive monitoring is sufficient" }
      ],
      actionChosen: "Reject integration — flag for 30-day re-evaluation",
      confidence: 91,
      risk: "High risk protocol — unverified code, fresh multisig, emission-dependent yield",
      outcome: "Vault remains protected from potential smart contract exploit",
      dataSources: [
        { name: "Solscan Contract Viewer", type: "on_chain", summary: "Bytecode not verified, deployed 14 days ago" },
        { name: "DeFiLlama", type: "api", summary: "TVL: $8.2M, 14-day old, no audit listed" },
        { name: "Internal Risk Model v2", type: "model", summary: "Risk score: 72/100 (HIGH)" }
      ]
    }
  },
  {
    name: "LiqBot-Kamino",
    actionType: "trade",
    scenario: {
      description: "Monitor and execute liquidation on undercollateralized Kamino position",
      context: "SOL price dropped 4.2% in 2 hours, approaching liquidation thresholds for leveraged positions",
      observations: [
        "SOL/USDC dropped from $152 to $145.62 (-4.2%)",
        "Kamino position 7xK...4rQ: 150 SOL collateral, 18,500 USDC borrowed",
        "Current health factor: 1.08 (liquidation at 1.00)",
        "Estimated liquidation price: $141.30 (2.97% below current)",
        "Liquidation bonus: 5% of collateral value"
      ],
      logic: "Position health factor at 1.08 is within monitoring range but not yet liquidatable. Setting up pre-positioned liquidation transaction that auto-executes if health drops below 1.02. At current rate of decline (-2.1%/hr), liquidation threshold could be reached within ~1.4 hours. Pre-positioning ensures we capture the 5% liquidation bonus ($1,090 estimated) ahead of competing liquidators. Gas cost: ~$0.004.",
      alternatives: [
        { action: "Wait for health < 1.00", reasonRejected: "Other liquidators will front-run — need pre-positioned tx" },
        { action: "Ignore — too small", reasonRejected: "$1,090 bonus is significant relative to near-zero execution cost" }
      ],
      actionChosen: "Pre-position liquidation tx with health < 1.02 trigger",
      confidence: 73,
      risk: "Moderate — SOL could bounce, wasting gas on failed tx",
      outcome: "Capture 5% liquidation bonus (~$1,090) if price continues declining",
      dataSources: [
        { name: "Pyth SOL/USD Oracle", type: "oracle", summary: "SOL price: $145.62, -4.2% 2hr" },
        { name: "Kamino Lending Program", type: "on_chain", summary: "Position health: 1.08, collateral: 150 SOL" },
        { name: "Jito Bundle API", type: "api", summary: "Tip estimate: 10,000 lamports for priority inclusion" }
      ]
    }
  },
  {
    name: "GovernanceBot-DAO",
    actionType: "governance",
    scenario: {
      description: "Analyze and vote on Marinade Finance governance proposal",
      context: "Proposal MIP-42: Adjust mSOL staking validator selection criteria to include MEV-share requirements",
      observations: [
        "Proposal requires validators to share ≥50% MEV revenue with stakers",
        "Current validator set: 450 validators, ~120 already share >50% MEV",
        "Estimated impact: 15-20% of current validators would be excluded",
        "Historical validator performance data shows MEV-sharing validators have 2.1% higher APY",
        "Community sentiment: 68% in favor based on forum discussion"
      ],
      logic: "MIP-42 aligns staker incentives with validator behavior. MEV-sharing validators demonstrate commitment to ecosystem health. Excluding non-sharing validators reduces set from 450 to ~350, which still maintains strong decentralization (Nakamoto coefficient stays above 19). The 2.1% APY improvement directly benefits mSOL holders including our vault positions. Risk: reduced validator set could increase concentration. Mitigation: 350 validators is still well above minimum threshold. Vote: FOR.",
      alternatives: [
        { action: "Vote AGAINST", reasonRejected: "Reduced validator set is manageable; benefits outweigh risks" },
        { action: "Abstain", reasonRejected: "We hold significant mSOL — abstaining wastes voting power on material proposal" }
      ],
      actionChosen: "Vote FOR MIP-42 with full voting power",
      confidence: 84,
      risk: "Low — validator set remains well-decentralized even after exclusions",
      outcome: "Higher mSOL APY through MEV-share enforcement benefits vault returns",
      dataSources: [
        { name: "Marinade Governance Portal", type: "other", summary: "MIP-42: MEV-share requirement, 68% community support" },
        { name: "Stakewiz Validator Data", type: "api", summary: "450 validators, 120 share >50% MEV" },
        { name: "Historical APY Analysis", type: "model", summary: "MEV-sharing validators: +2.1% APY avg" }
      ]
    }
  },
  {
    name: "YieldMax-USDC",
    actionType: "rebalance",
    scenario: {
      description: "Optimize USDC yield farming across Solana money markets",
      context: "Daily yield optimization for $320K USDC position across 4 lending protocols",
      observations: [
        "MarginFi USDC supply: 6.8% APY (down from 7.4% yesterday)",
        "Kamino USDC Multiply: 9.1% APY (new strategy launched)",
        "Solend USDC Main Pool: 4.2% APY (stable)",
        "Drift USDC Insurance Fund: 11.3% APY (high but capped at $50K)"
      ],
      logic: "Optimal allocation: max out Drift insurance fund cap at $50K (11.3%), allocate $150K to Kamino Multiply (9.1% with leveraged lending), $100K to MarginFi (6.8% as stable base), keep $20K in Solend as emergency liquidity (4.2% but instant withdrawals). Weighted average yield: 8.47% APY vs current 7.1%. Rebalance cost: ~$0.02 in transaction fees.",
      alternatives: [
        { action: "All-in Drift Insurance Fund", reasonRejected: "Cap is $50K — cannot allocate full position" },
        { action: "Keep current allocation", reasonRejected: "Suboptimal by 1.37% APY — that's $4,380/yr on $320K" }
      ],
      actionChosen: "Rebalance: Drift $50K, Kamino $150K, MarginFi $100K, Solend $20K",
      confidence: 82,
      risk: "Low — all protocols are established with >$100M TVL",
      outcome: "Increase blended USDC yield from 7.1% to 8.47% APY",
      dataSources: [
        { name: "MarginFi Rate API", type: "api", summary: "USDC supply rate: 6.8% APY" },
        { name: "Kamino Vaults", type: "on_chain", summary: "USDC Multiply: 9.1% APY, TVL $45M" },
        { name: "Drift Insurance Fund", type: "on_chain", summary: "USDC: 11.3% APY, cap $50K remaining" }
      ]
    }
  },
  {
    name: "MEVSentry-v2",
    actionType: "audit",
    scenario: {
      description: "Detect and report suspicious MEV activity on Solana",
      context: "Automated monitoring detected potential sandwich attack pattern on Jupiter swap",
      observations: [
        "Front-run tx: 4.2 SOL buy on Raydium SOL/USDC, 0.5s before victim",
        "Victim tx: 180 SOL swap on Jupiter, received 1.2% worse price than expected",
        "Back-run tx: 4.2 SOL sell on Raydium, 0.3s after victim",
        "Attacker profit: ~$32.40 per sandwich",
        "Same attacker pattern identified in 47 transactions over past 6 hours"
      ],
      logic: "Classic sandwich attack pattern confirmed. Attacker uses Jito bundles to guarantee front-run/back-run ordering. Victim's Jupiter swap of 180 SOL was targeted due to lack of slippage protection (set at 5% vs recommended 0.5%). Attacker's address has extracted ~$1,523 in past 6 hours across 47 similar attacks. Reporting to Jito's abuse prevention system and adding attacker address to our block list. Recommending protocol-level slippage warnings for large swaps.",
      alternatives: [
        { action: "Ignore — not our problem", reasonRejected: "MEV extraction degrades ecosystem health; reporting costs nothing" },
        { action: "Attempt counter-MEV", reasonRejected: "Counter-MEV is adversarial and may escalate gas wars" }
      ],
      actionChosen: "Report attacker pattern to Jito abuse system, update block list",
      confidence: 95,
      risk: "Low — reporting is informational, no direct financial exposure",
      outcome: "Attacker flagged, future victims protected by updated block list",
      dataSources: [
        { name: "Solana Transaction Stream", type: "on_chain", summary: "47 sandwich patterns from same attacker in 6hr" },
        { name: "Jupiter Swap Logs", type: "on_chain", summary: "Victim received 1.2% worse execution" },
        { name: "Jito Bundle API", type: "api", summary: "Attacker using Jito bundles for ordering guarantee" }
      ]
    }
  },
  {
    name: "StakeOptimizer-Pro",
    actionType: "rebalance",
    scenario: {
      description: "Optimize native SOL staking across validators for maximum rewards",
      context: "Managing 5,000 SOL delegation across Solana validators with focus on decentralization and yield",
      observations: [
        "Top validator APY range: 7.1% - 7.8%",
        "Current delegation: 60% to top-3 validators (too concentrated)",
        "5 validators in current set have >90% commission — likely extracting value",
        "Jito-enabled validators showing +0.4% APY premium from MEV tips"
      ],
      logic: "Current delegation is over-concentrated in top validators, weakening network decentralization. Redistributing to a set of 15 validators with: (1) commission ≤10%, (2) uptime >99.5%, (3) Jito-enabled for MEV sharing, (4) each getting max 6.7% of total stake. This improves decentralization coefficient while maintaining APY at ~7.5% including MEV tips. Re-delegation costs are zero (native staking), only epoch warmup delay of ~2.5 days.",
      alternatives: [
        { action: "Keep concentrated in top-3", reasonRejected: "Concentration risk and weakens Solana decentralization" },
        { action: "Liquid staking via mSOL", reasonRejected: "Client prefers native staking for validator selection control" }
      ],
      actionChosen: "Redistribute 5,000 SOL across 15 diversified validators",
      confidence: 88,
      risk: "Low — native staking has no smart contract risk, only epoch warmup delay",
      outcome: "Improved decentralization, maintained 7.5% APY, reduced concentration risk",
      dataSources: [
        { name: "Stakewiz Validator Rankings", type: "api", summary: "Top 15 validators by quality score with Jito" },
        { name: "Solana Validator List", type: "on_chain", summary: "Active set: 1,850 validators" },
        { name: "Jito MEV Dashboard", type: "api", summary: "Avg MEV tip: +0.4% APY for enabled validators" }
      ]
    }
  },
  {
    name: "NFTValuation-AI",
    actionType: "decision",
    scenario: {
      description: "Assess fair value of rare Solana NFT for potential acquisition",
      context: "Mad Lads #4271 listed at 42 SOL — running valuation analysis for collection fund",
      observations: [
        "Mad Lads floor price: 28.5 SOL (7-day avg: 26.8 SOL)",
        "Item #4271 has gold background trait (3.2% rarity) + cosmic eyes (1.1% rarity)",
        "Combined trait rarity: 0.035% (estimated 3-4 items with both traits)",
        "Last sale of comparable rarity: #2891 sold for 38 SOL (12 days ago)",
        "Collection volume: 1,240 SOL last 7 days (declining from 2,100 prev week)"
      ],
      logic: "Fair value estimate: 35-45 SOL based on trait rarity premium. The gold+cosmic combination is extremely rare (0.035% occurrence). Comparable sale at 38 SOL was in higher-volume market; current declining volume suggests slight discount. However, rarity premiums tend to hold even in low-volume periods. The listing at 42 SOL is within fair value range. Risk: declining collection volume could push floor lower, compressing rarity premiums. Recommendation: bid 38 SOL, willing to accept up to 40 SOL.",
      alternatives: [
        { action: "Bid at floor price (28.5 SOL)", reasonRejected: "Seller unlikely to accept 32% below listing for rare item" },
        { action: "Accept listing price (42 SOL)", reasonRejected: "Slight overpay given declining volume; negotiate for better entry" },
        { action: "Pass on opportunity", reasonRejected: "Sub-0.04% rarity combinations rarely list — opportunity cost is high" }
      ],
      actionChosen: "Place bid at 38 SOL for Mad Lads #4271",
      confidence: 71,
      risk: "Moderate — NFT markets are illiquid, exit timing uncertain",
      outcome: "Acquire rare NFT at ~10% below listing, target 2x in next bull cycle",
      dataSources: [
        { name: "Magic Eden API", type: "api", summary: "Mad Lads floor: 28.5 SOL, listing: 42 SOL" },
        { name: "HowRare Trait Analysis", type: "api", summary: "Gold+cosmic: 0.035% rarity" },
        { name: "Internal Valuation Model", type: "model", summary: "Fair value range: 35-45 SOL" }
      ]
    }
  },
  {
    name: "BridgeMonitor-ETH",
    actionType: "audit",
    scenario: {
      description: "Monitor cross-chain bridge health and validate pending transfers",
      context: "Wormhole bridge activity monitoring — 24hr automated health check",
      observations: [
        "Wormhole ETH→SOL transfers: 847 in past 24h ($12.4M volume)",
        "Average confirmation time: 14.2 minutes (within normal range)",
        "3 transfers pending >45 minutes (flagged as slow)",
        "Guardian attestation rate: 100% (all 19 guardians signing)",
        "No anomalous large transfers detected (max single: $180K)"
      ],
      logic: "Bridge health is nominal. The 3 slow transfers are likely due to Ethereum congestion (current base fee: 28 gwei, above 7-day avg of 18 gwei). Guardian consensus is at full strength (19/19). No patterns matching historical bridge exploit signatures (unusual token amounts, new contract interactions, guardian delays). Automated monitoring continues — no action required.",
      alternatives: [
        { action: "Alert operations team", reasonRejected: "All metrics within normal parameters — false alarm would cause fatigue" },
        { action: "Pause bridge integrations", reasonRejected: "No security indicators warrant disruption to user flows" }
      ],
      actionChosen: "Continue monitoring — all systems nominal, log health report",
      confidence: 96,
      risk: "Low — all bridge metrics within normal operational bounds",
      outcome: "Continued safe bridge operation with documented health status",
      dataSources: [
        { name: "Wormhole Guardian Network", type: "on_chain", summary: "19/19 guardians active, 100% attestation" },
        { name: "Wormhole Explorer API", type: "api", summary: "847 transfers, $12.4M volume, 14.2min avg" },
        { name: "Ethereum Gas Tracker", type: "oracle", summary: "Base fee: 28 gwei (elevated)" }
      ]
    }
  },
  {
    name: "PerpTrader-Delta",
    actionType: "trade",
    scenario: {
      description: "Open delta-neutral position on Drift Protocol",
      context: "Funding rate arbitrage — SOL-PERP funding at +0.08%/hr (annualized ~700%)",
      observations: [
        "Drift SOL-PERP funding rate: +0.08%/hr (8-hour TWAP)",
        "Historical avg funding: +0.02%/hr",
        "Current rate is 4x above average — likely shorts getting squeezed",
        "Open interest: $67M (near ATH, confirming crowded long positioning)",
        "Spot SOL price: $148.50, Perp mark: $149.20 (+0.47% premium)"
      ],
      logic: "Extreme positive funding creates opportunity for delta-neutral carry trade. Strategy: buy 100 SOL spot ($14,850) + short 100 SOL-PERP on Drift. This captures funding payments from longs while remaining market-neutral. At current 0.08%/hr funding, daily income: $285. Even if funding normalizes to 0.04%/hr (2x avg), still earning $142/day on $14,850 collateral (348% APY). Position sizing: 100 SOL keeps us under $15K exposure limit. Hedge ratio maintained by rebalancing every 4 hours.",
      alternatives: [
        { action: "Short only (directional)", reasonRejected: "Directional shorts carry unlimited risk in trending markets" },
        { action: "Larger position (500 SOL)", reasonRejected: "Exceeds risk limit and could face liquidation on sharp moves" }
      ],
      actionChosen: "Open delta-neutral: buy 100 SOL spot + short 100 SOL-PERP",
      confidence: 85,
      risk: "Low-moderate — delta neutral but funding can flip negative",
      outcome: "Capture ~$285/day in funding payments while market-neutral",
      dataSources: [
        { name: "Drift Protocol Funding", type: "on_chain", summary: "SOL-PERP funding: +0.08%/hr, OI: $67M" },
        { name: "Jupiter Spot Price", type: "api", summary: "SOL/USDC: $148.50" },
        { name: "Drift Mark Price", type: "on_chain", summary: "SOL-PERP: $149.20 (+0.47% premium)" }
      ]
    }
  },
  {
    name: "TokenScreen-v1",
    actionType: "audit",
    scenario: {
      description: "Automated token safety screening for new Raydium listing",
      context: "New token XYZAI launched on Raydium — running pre-trade safety checks",
      observations: [
        "Token mint authority: revoked ✅",
        "Freeze authority: still active ⚠️",
        "Top 10 holders control 78% of supply",
        "LP locked: only 12% of LP tokens locked (30-day lock)",
        "Contract: standard SPL token, no unusual instructions"
      ],
      logic: "Multiple red flags detected. While mint authority is revoked (no infinite minting risk), the active freeze authority means token holder accounts can be frozen at any time. Concentrated holdings (78% in top 10) suggest insider-dominated supply. LP lock of only 12% with 30-day duration provides minimal rug protection. Safety score: 32/100. Recommendation: DO NOT TRADE. This token has rug-pull characteristics.",
      alternatives: [
        { action: "Trade with stop-loss", reasonRejected: "Freeze authority can prevent selling — stop-loss won't execute" },
        { action: "Small speculative position", reasonRejected: "Active freeze authority makes any position size risky" }
      ],
      actionChosen: "Flag as HIGH RISK — do not trade, add to watchlist",
      confidence: 93,
      risk: "Critical — freeze authority + concentrated supply = potential rug",
      outcome: "Protect portfolio from potential rug pull, continue monitoring",
      dataSources: [
        { name: "Solscan Token Info", type: "on_chain", summary: "Freeze auth active, mint revoked" },
        { name: "RugCheck API", type: "api", summary: "Safety score: 32/100, multiple flags" },
        { name: "Birdeye Holder Analysis", type: "api", summary: "Top 10 holders: 78% supply" }
      ]
    }
  },
  {
    name: "TrendFollower-SOL",
    actionType: "trade",
    scenario: {
      description: "Momentum-based SOL position entry on breakout signal",
      context: "Technical analysis detected SOL breaking above 200-day EMA with increasing volume",
      observations: [
        "SOL broke above 200-day EMA at $142 — currently at $148.50",
        "Volume 2.3x daily average on breakout candle",
        "RSI at 62 — bullish but not overbought",
        "MACD crossed bullish 3 days ago, histogram expanding",
        "On-chain: DEX volume +45% week-over-week"
      ],
      logic: "Classic bullish breakout pattern confirmed. SOL's break above 200-day EMA with elevated volume signals regime change from bearish to bullish. RSI at 62 indicates momentum without overbought exhaustion. Supporting on-chain data (DEX volume surge) confirms real activity, not just speculative positioning. Position sizing: 5% of portfolio ($8,000), entry at $148.50, stop-loss at $138 (below 200-day EMA), target $165 (previous resistance). Risk/reward ratio: 1.6x.",
      alternatives: [
        { action: "Wait for pullback to EMA", reasonRejected: "Strong breakouts often don't retest — momentum could leave us behind" },
        { action: "Leverage 3x position", reasonRejected: "Leverage amplifies both gains and stop-loss risk; 1x is prudent" }
      ],
      actionChosen: "Enter long SOL at $148.50, stop $138, target $165",
      confidence: 76,
      risk: "Moderate — breakouts can fail, but volume confirmation reduces false signal probability",
      outcome: "Capture potential $16.50/SOL upside (11.1%) with $10.50 downside risk (7.1%)",
      dataSources: [
        { name: "TradingView Indicators", type: "api", summary: "200-EMA breakout, RSI 62, MACD bullish" },
        { name: "Jupiter Volume Data", type: "on_chain", summary: "DEX volume +45% WoW" },
        { name: "Pyth SOL/USD", type: "oracle", summary: "Current price: $148.50" }
      ]
    }
  },
  {
    name: "InsuranceBot-DeFi",
    actionType: "decision",
    scenario: {
      description: "Evaluate and purchase DeFi insurance coverage for vault positions",
      context: "Quarterly insurance review for $1.2M vault deployed across 5 Solana protocols",
      observations: [
        "Current coverage: $400K via Symmetry (covers Kamino, MarginFi)",
        "Uncovered exposure: $800K across Drift, Solend, Jupiter",
        "Recent exploit: protocol on Ethereum lost $12M to oracle manipulation",
        "Insurance cost: ~2.1% annual premium for full coverage",
        "Historical Solana DeFi exploit rate: ~0.8% of TVL per year"
      ],
      logic: "Expected loss from exploits (0.8% of $1.2M = $9,600/yr) is less than insurance premium cost (2.1% of $1.2M = $25,200/yr). However, tail risk is asymmetric — a single exploit could wipe the entire vault position. Given our risk tolerance and fiduciary duty, the premium is worth paying. Increasing coverage to $800K on uncovered protocols. Priority: Drift ($350K exposure, complex perp mechanics) and Jupiter ($250K, router attack surface).",
      alternatives: [
        { action: "Self-insure with reserve fund", reasonRejected: "Would need $120K+ reserve (10% TVL) — capital inefficient" },
        { action: "Accept uninsured risk", reasonRejected: "Tail risk of total loss outweighs premium savings" }
      ],
      actionChosen: "Purchase additional $800K coverage for Drift and Jupiter exposures",
      confidence: 80,
      risk: "Low — insurance adds cost but eliminates catastrophic tail risk",
      outcome: "Full vault coverage ($1.2M) for ~$25.2K annual premium",
      dataSources: [
        { name: "Symmetry Insurance Quotes", type: "api", summary: "Full coverage: 2.1% annual premium" },
        { name: "DeFi Exploit Database", type: "other", summary: "Solana historical loss rate: ~0.8% TVL/yr" },
        { name: "Vault Position Monitor", type: "on_chain", summary: "$1.2M across 5 protocols" }
      ]
    }
  },
  {
    name: "AirdropHunter-v4",
    actionType: "decision",
    scenario: {
      description: "Evaluate potential airdrop eligibility criteria and optimize wallet activity",
      context: "Phantom wallet upgrade hints at potential token launch — analyzing optimal engagement strategy",
      observations: [
        "Phantom posted roadmap teasing 'community rewards' for active users",
        "Similar projects (Backpack, Jupiter) rewarded users based on: tx count, volume, time period",
        "Jupiter airdrop criteria: min 3 unique months of activity, diverse protocol usage",
        "Current wallet: 47 transactions across 2 months",
        "Estimated airdrop value for top-tier users: $2,000-$8,000"
      ],
      logic: "Pattern analysis of previous Solana airdrops reveals key criteria: consistent activity over multiple months, interaction with multiple dApps, meaningful transaction volume, and early adoption signals. Our wallet needs: (1) extend activity to 3+ months, (2) diversify beyond current 2 protocols to 5+, (3) increase weekly transaction cadence. Organic activity is key — sybil detection will filter bot-like patterns. Budget $50 in gas fees over next 60 days for natural usage patterns across Phantom swaps, NFT marketplace, staking.",
      alternatives: [
        { action: "Multi-wallet sybil strategy", reasonRejected: "Sybil detection is sophisticated — risk of blacklisting all wallets" },
        { action: "Ignore potential airdrop", reasonRejected: "$50 investment for potential $2K-$8K return is extremely positive EV" }
      ],
      actionChosen: "Organic activity plan: 5+ protocols, 3+ months, $50 gas budget",
      confidence: 62,
      risk: "Low — only risking $50 in gas fees, airdrop is speculative but positive EV",
      outcome: "Position for potential $2K-$8K airdrop with minimal cost basis",
      dataSources: [
        { name: "Phantom Roadmap Blog", type: "other", summary: "Community rewards mentioned, no details yet" },
        { name: "Jupiter Airdrop Criteria Analysis", type: "other", summary: "3 months, diverse usage, volume tiers" },
        { name: "Wallet Transaction History", type: "on_chain", summary: "47 txs, 2 months, 2 protocols" }
      ]
    }
  },
  {
    name: "CrossChainArb-v1",
    actionType: "trade",
    scenario: {
      description: "Cross-chain stablecoin arbitrage between Solana and Ethereum",
      context: "USDC depeg detected on Solana DEXs — potential arb opportunity via Wormhole bridge",
      observations: [
        "Solana USDC/USDT on Orca: 0.9982 (0.18% below peg)",
        "Ethereum USDC/USDT on Uniswap: 0.9998 (at peg)",
        "Wormhole bridge fee: ~$3.50 + 14 min confirmation",
        "Spread after fees: 0.12% on $50K = $60 profit",
        "Similar depeg events resolved within 2-4 hours historically"
      ],
      logic: "Minor USDC depeg on Solana creates cross-chain arb opportunity. However, the spread of 0.12% after bridge fees yields only $60 on $50K — insufficient to justify capital lockup and smart contract risk of bridging. Additionally, historical depegs resolve quickly, meaning by the time funds bridge (14 min), the spread may be closed by on-chain arbers. This arb is not profitable at our scale. Would need $500K+ to justify the overhead.",
      alternatives: [
        { action: "Execute the arb anyway", reasonRejected: "Risk-adjusted return negative — $60 profit vs bridge risk" },
        { action: "Scale up to $200K", reasonRejected: "Exceeds single-trade risk limit and slippage would eat the spread" }
      ],
      actionChosen: "Pass — spread too thin for cross-chain overhead. Monitor for >0.5% depeg.",
      confidence: 89,
      risk: "N/A — no trade executed",
      outcome: "Capital preserved for higher-quality opportunities",
      dataSources: [
        { name: "Orca USDC/USDT Pool", type: "on_chain", summary: "Rate: 0.9982 (-0.18%)" },
        { name: "Uniswap V3 USDC/USDT", type: "on_chain", summary: "Rate: 0.9998 (at peg)" },
        { name: "Wormhole Bridge Estimator", type: "api", summary: "Fee: ~$3.50, time: ~14 min" }
      ]
    }
  },
  {
    name: "PortfolioGuard-AI",
    actionType: "rebalance",
    scenario: {
      description: "Automated portfolio rebalancing triggered by drift threshold",
      context: "Portfolio drift exceeded 5% threshold — triggering quarterly rebalance",
      observations: [
        "Target allocation: 50% SOL, 30% USDC, 20% LSTs (mSOL/jitoSOL)",
        "Current allocation: 58% SOL, 24% USDC, 18% LSTs (SOL price up 16%)",
        "Portfolio drift: 8% (exceeds 5% threshold)",
        "Tax impact: long-term gains on SOL sold (held >1 year)",
        "Gas costs: ~$0.02 total for rebalance swaps"
      ],
      logic: "Portfolio has drifted 8% from target due to SOL price appreciation. Rebalancing requires selling 8% SOL allocation ($12,800) and redistributing: $9,600 to USDC (bringing to 30%), $3,200 to LSTs (bringing to 20%). Using Jupiter aggregator for best execution. SOL positions held >1 year qualify for long-term capital gains treatment. Rebalancing maintains risk-adjusted returns and prevents overexposure to single-asset price moves.",
      alternatives: [
        { action: "Increase threshold to 10%", reasonRejected: "Research shows 5% threshold optimizes risk-adjusted returns for crypto portfolios" },
        { action: "Rebalance into BTC", reasonRejected: "BTC not in target allocation — adding assets should be a separate decision" }
      ],
      actionChosen: "Sell $12,800 SOL, buy $9,600 USDC + $3,200 mSOL/jitoSOL",
      confidence: 90,
      risk: "Low — systematic rebalancing is rules-based, removes emotional bias",
      outcome: "Portfolio returns to 50/30/20 target allocation",
      dataSources: [
        { name: "Portfolio Tracker", type: "model", summary: "Drift: 8%, SOL overweight by 8%" },
        { name: "Jupiter Aggregator", type: "api", summary: "Best route for SOL→USDC, SOL→mSOL" },
        { name: "Tax Lot Tracking", type: "model", summary: "All SOL lots >1yr, long-term gains rate" }
      ]
    }
  },
  {
    name: "OracleGuard-Pyth",
    actionType: "audit",
    scenario: {
      description: "Validate Pyth oracle price feed integrity for DeFi integration",
      context: "Pre-trade oracle health check — verifying SOL/USD feed before executing large swap",
      observations: [
        "Pyth SOL/USD: $148.52 ± $0.08 (confidence interval)",
        "Switchboard SOL/USD: $148.49",
        "Binance spot SOL/USDT: $148.55",
        "Deviation between oracles: 0.02% (well within tolerance)",
        "Pyth publisher count: 68 active publishers (healthy)"
      ],
      logic: "Oracle cross-validation confirms price feeds are healthy. Maximum inter-oracle deviation of 0.02% is well below our 0.5% tolerance threshold. Pyth confidence interval of ±$0.08 (0.054%) indicates high consensus among 68 publishers. No signs of oracle manipulation (deviation spike, publisher dropout, or stale price). Approving trade execution with current oracle prices. Setting staleness check: reject if Pyth slot age > 5 slots.",
      alternatives: [
        { action: "Use only Pyth", reasonRejected: "Multi-oracle validation is best practice for large trades" },
        { action: "Delay trade for more data", reasonRejected: "All feeds agree — delay adds no information, only execution risk" }
      ],
      actionChosen: "Oracle health confirmed — approve trade execution at current prices",
      confidence: 97,
      risk: "Very low — triple oracle cross-validation shows consensus",
      outcome: "Trade executes with verified oracle prices, no manipulation risk",
      dataSources: [
        { name: "Pyth Network SOL/USD", type: "oracle", summary: "$148.52 ± $0.08, 68 publishers" },
        { name: "Switchboard SOL/USD", type: "oracle", summary: "$148.49, deviation 0.02%" },
        { name: "Binance Spot Price", type: "price_feed", summary: "SOL/USDT: $148.55" }
      ]
    }
  },
  {
    name: "LPManager-ORCA",
    actionType: "rebalance",
    scenario: {
      description: "Adjust concentrated liquidity range on Orca Whirlpool position",
      context: "SOL price moved outside optimal LP range — need to reposition for fee capture",
      observations: [
        "Current LP range: $135-$155 SOL/USDC (set 2 weeks ago)",
        "SOL price: $148.50 (upper 73% of range)",
        "Fee APY in range: 42.3% (but declining as price approaches edge)",
        "Impermanent loss so far: -1.8% (acceptable)",
        "Fees earned: +4.2% (net positive including IL)"
      ],
      logic: "Position is profitable (net +2.4% after IL) but price approaching upper bound of range. At $155, position goes 100% USDC and stops earning fees. Given bullish trend, should widen range upward. New range: $140-$170 (centered on current price with slight upward skew). This wider range sacrifices fee APY (estimated 28.5% vs current 42.3%) but ensures fees continue in an uptrend. Repositioning costs ~$0.01 in gas.",
      alternatives: [
        { action: "Keep current range", reasonRejected: "If SOL breaks $155, position earns zero fees and holds 100% USDC" },
        { action: "Narrow range $145-$155", reasonRejected: "Too narrow — any 7% move either direction takes us out of range" }
      ],
      actionChosen: "Reposition LP: withdraw from $135-$155, re-add at $140-$170",
      confidence: 77,
      risk: "Low — repositioning is gas-cheap and maintains fee earning potential",
      outcome: "Continued fee capture (~28.5% APY) even if SOL trends to $165+",
      dataSources: [
        { name: "Orca Whirlpool Dashboard", type: "on_chain", summary: "Position in range, APY: 42.3%, IL: -1.8%" },
        { name: "Pyth SOL/USD", type: "oracle", summary: "$148.50, 73% through current range" },
        { name: "LP Fee Calculator", type: "model", summary: "New range APY estimate: 28.5%" }
      ]
    }
  },
  {
    name: "ComplianceBot-KYC",
    actionType: "audit",
    scenario: {
      description: "Automated compliance check on incoming DeFi vault deposit",
      context: "Large deposit of 500 SOL ($74,250) — running AML/compliance screening",
      observations: [
        "Depositor wallet: created 45 days ago, 312 transactions",
        "Funds origin: traced to Binance withdrawal (centralized exchange — KYC'd source)",
        "No interactions with OFAC-sanctioned addresses (Tornado Cash, etc.)",
        "CHAINALYSIS risk score: 12/100 (LOW RISK)",
        "Previous protocol interactions: Jupiter, Marinade, Magic Eden"
      ],
      logic: "Compliance screening passed all checks. Funds originate from a KYC'd centralized exchange (Binance), with no exposure to sanctioned protocols or addresses. Wallet age (45 days) with diverse DeFi activity (312 txs across 3+ protocols) indicates legitimate user, not a wash-trade or mixer pattern. Chainalysis risk score of 12/100 is well below our 40/100 threshold. Approving deposit.",
      alternatives: [
        { action: "Reject deposit", reasonRejected: "All compliance metrics pass — rejection would be false positive" },
        { action: "Request manual review", reasonRejected: "Automated screening is comprehensive — manual review would only add delay" }
      ],
      actionChosen: "Approve 500 SOL deposit — all compliance checks passed",
      confidence: 94,
      risk: "Very low — funds traced to KYC source with clean history",
      outcome: "Vault TVL increases by $74,250 with compliant deposit",
      dataSources: [
        { name: "Chainalysis Screening API", type: "api", summary: "Risk score: 12/100, no sanctions exposure" },
        { name: "Solscan Address Analysis", type: "on_chain", summary: "45-day wallet, 312 txs, CEX origin" },
        { name: "OFAC SDN List", type: "other", summary: "No matches found" }
      ]
    }
  },
  // Extra templates for variety
  {
    name: "FlashLoanDetector",
    actionType: "audit",
    scenario: {
      description: "Monitor flash loan activity for potential exploit patterns",
      context: "Elevated flash loan volume detected on Solana — automated pattern analysis",
      observations: [
        "Flash loan volume: 8 loans in past hour (vs 2/hr average)",
        "Largest loan: 50,000 USDC from Solend flash loan pool",
        "All loans repaid successfully within same transaction",
        "Borrower address interacted with: Jupiter, Raydium, Orca (multi-DEX)",
        "Net profit per loan: ~$12-$45 (legitimate arbitrage pattern)"
      ],
      logic: "Flash loan spike appears to be legitimate arbitrage activity. All loans were repaid successfully (no failed transactions indicating exploit attempts). The multi-DEX interaction pattern is consistent with cross-DEX arbitrage, not oracle manipulation or governance attacks. Individual loan profits of $12-$45 are typical for atomic arb bots. No unusual token price movements correlated with the flash loan timing. Assessment: BENIGN.",
      alternatives: [
        { action: "Alert security team", reasonRejected: "Pattern matches legitimate arb — alert would be false positive" },
        { action: "Temporarily block flash loans", reasonRejected: "Would disrupt legitimate protocol functionality" }
      ],
      actionChosen: "Continue monitoring — classify spike as legitimate arbitrage activity",
      confidence: 88,
      risk: "Low — all flash loans profitable and repaid, no exploit indicators",
      outcome: "Accurate classification avoids false security alerts",
      dataSources: [
        { name: "Solend Flash Loan Monitor", type: "on_chain", summary: "8 loans/hr, all repaid, max 50K USDC" },
        { name: "DEX Price Impact Tracker", type: "on_chain", summary: "No abnormal price movements detected" },
        { name: "Historical Flash Loan DB", type: "model", summary: "Pattern matches legitimate arb (87% confidence)" }
      ]
    }
  },
  {
    name: "GasOptimizer-TX",
    actionType: "decision",
    scenario: {
      description: "Optimize transaction priority and compute budget for time-sensitive swap",
      context: "Need to execute $25K swap within 3 slots — choosing optimal compute unit price",
      observations: [
        "Current base fee: 5,000 lamports per signature",
        "Median priority fee (last 50 slots): 15,000 micro-lamports per CU",
        "Network load: 72% of max TPS (moderately congested)",
        "Similar swap txs landing with 25,000 μlamports/CU (95th percentile)",
        "Estimated CU for Jupiter swap: 200,000 CU"
      ],
      logic: "For time-sensitive $25K swap, reliability > cost. Setting priority fee at 95th percentile (25,000 μlamports/CU) ensures 95%+ probability of inclusion within 2 slots. Total priority fee: 25,000 × 200,000 = 5,000,000 lamports = 0.005 SOL (~$0.74). This is negligible relative to $25K trade value (0.003%). Adding 20% compute buffer (240,000 CU) to prevent out-of-compute failures. Using Jito tip for guaranteed block inclusion.",
      alternatives: [
        { action: "Use median priority fee", reasonRejected: "50th percentile fee risks 3+ slot delay on time-sensitive trade" },
        { action: "No priority fee", reasonRejected: "Base fee only has ~30% inclusion probability in congested conditions" }
      ],
      actionChosen: "Set 25,000 μlamports/CU priority + 240K CU budget + Jito tip",
      confidence: 91,
      risk: "Very low — overpaying by ~$0.30 vs median ensures fast execution",
      outcome: "Transaction lands within 2 slots with >95% probability",
      dataSources: [
        { name: "Solana Fee API", type: "on_chain", summary: "Median: 15K μlamports, 95th: 25K μlamports" },
        { name: "Network TPS Monitor", type: "on_chain", summary: "72% capacity, moderately congested" },
        { name: "Jito Bundle Estimator", type: "api", summary: "Min tip: 10,000 lamports for inclusion" }
      ]
    }
  },
  {
    name: "SentimentTrader-X",
    actionType: "trade",
    scenario: {
      description: "Social sentiment-driven trade signal for SOL based on X/Twitter analysis",
      context: "NLP model detected surge in positive SOL sentiment correlating with price action",
      observations: [
        "SOL mention volume: +340% vs 7-day average on X/Twitter",
        "Sentiment score: 0.78 (strongly positive, scale -1 to 1)",
        "Top narratives: 'Solana ETF', 'Firedancer launch', 'DePIN growth'",
        "Historical correlation: 0.78 sentiment → +8.2% avg return next 7 days",
        "Current position: 0% SOL (waiting for signal)"
      ],
      logic: "Sentiment surge with multiple fundamental catalysts (ETF, Firedancer, DePIN) creates high-conviction signal. Historical backtesting shows 0.78+ sentiment score correlates with +8.2% average 7-day return (sample: 23 events, win rate 78%). Entry timing is favorable: sentiment surge precedes retail FOMO by 12-24 hours typically. Position: 3% of portfolio ($4,800) in spot SOL with 7-day hold target. Stop-loss at -5% to limit downside on false signal.",
      alternatives: [
        { action: "Wait for confirmation", reasonRejected: "Sentiment alpha decays — waiting 24h reduces expected return by 60%" },
        { action: "Trade via perpetuals", reasonRejected: "Funding is positive — spot position avoids paying 0.04%/hr funding" }
      ],
      actionChosen: "Buy $4,800 SOL spot on sentiment signal, 7-day hold, -5% stop",
      confidence: 72,
      risk: "Moderate — sentiment signals have 78% win rate but 22% loss rate",
      outcome: "Expected +8.2% return ($394) with 78% probability in 7 days",
      dataSources: [
        { name: "X/Twitter Sentiment Engine", type: "model", summary: "SOL sentiment: 0.78, mentions +340%" },
        { name: "Sentiment Backtest Database", type: "model", summary: "0.78+ signal: +8.2% avg return, 78% win rate" },
        { name: "Pyth SOL/USD", type: "oracle", summary: "Current price: $148.50" }
      ]
    }
  },
  {
    name: "WhaleWatch-SOL",
    actionType: "audit",
    scenario: {
      description: "Track and analyze large SOL wallet movements for market intelligence",
      context: "Whale alert: 150,000 SOL ($22.3M) moved from staking to exchange deposit address",
      observations: [
        "150,000 SOL unstaked from validator (top-20 validator)",
        "Funds moved to Binance hot wallet deposit address",
        "Wallet history: institutional pattern (quarterly movements, large lots)",
        "Current unstaking queue: 340,000 SOL total (above average 180,000)",
        "Exchange inflows: +25% vs 30-day average"
      ],
      logic: "Large SOL movement to exchange is a bearish signal but requires context. Institutional wallet pattern (quarterly, large lots) suggests planned rebalancing, not panic selling. However, combined with elevated exchange inflows (+25%) and large unstaking queue (340K vs 180K avg), this adds selling pressure. Reducing risk exposure by tightening stop-losses on SOL positions from -8% to -5%. Not shorting — institutional flows often spread sales over 2-3 days, limiting immediate impact.",
      alternatives: [
        { action: "Short SOL immediately", reasonRejected: "Whale selling pattern typically spreads over days — timing a short is risky" },
        { action: "Ignore the movement", reasonRejected: "150K SOL to exchange is material — risk management requires response" }
      ],
      actionChosen: "Tighten SOL stop-losses to -5%, increase monitoring frequency to 1hr",
      confidence: 74,
      risk: "Moderate — whale selling pressure is real but often gradual",
      outcome: "Reduced downside exposure while maintaining upside participation",
      dataSources: [
        { name: "Solscan Whale Tracker", type: "on_chain", summary: "150K SOL unstaked → Binance deposit" },
        { name: "Exchange Flow Monitor", type: "api", summary: "SOL inflows +25% vs 30-day avg" },
        { name: "Staking Queue Monitor", type: "on_chain", summary: "340K SOL in unstaking queue (avg: 180K)" }
      ]
    }
  },
  {
    name: "DCABot-Weekly",
    actionType: "trade",
    scenario: {
      description: "Execute weekly DCA buy of SOL per automated strategy",
      context: "Scheduled weekly DCA — $200 USDC → SOL regardless of price",
      observations: [
        "Current SOL price: $148.50",
        "DCA strategy: $200/week, started 12 weeks ago",
        "Average cost basis: $134.22/SOL (portfolio up 10.6%)",
        "Total invested: $2,400 → current value: $2,654",
        "This week's buy: 1.347 SOL at $148.50"
      ],
      logic: "Dollar-cost averaging removes timing decisions. This is week 13 of a 52-week DCA plan. Current price ($148.50) is above average cost basis ($134.22) — portfolio is profitable. DCA discipline requires executing regardless of short-term price. Using Jupiter limit order to get best execution within 1-hour window. No reason to deviate from plan.",
      alternatives: [
        { action: "Skip this week — price is high", reasonRejected: "DCA discipline requires consistency — timing the market defeats the purpose" },
        { action: "Double this week's buy", reasonRejected: "Increasing buys based on momentum is trend-chasing, not DCA" }
      ],
      actionChosen: "Execute standard $200 USDC → SOL DCA buy via Jupiter",
      confidence: 99,
      risk: "Very low — DCA is a proven risk-reduction strategy for volatile assets",
      outcome: "Add 1.347 SOL to portfolio, new avg cost basis ~$135.30",
      dataSources: [
        { name: "Jupiter Swap API", type: "api", summary: "Best route: $200 USDC → 1.347 SOL" },
        { name: "DCA Strategy Tracker", type: "model", summary: "Week 13/52, avg cost $134.22" },
        { name: "Pyth SOL/USD", type: "oracle", summary: "$148.50" }
      ]
    }
  },
  {
    name: "LendingBot-Kamino",
    actionType: "trade",
    scenario: {
      description: "Supply SOL to Kamino Lending for leveraged yield",
      context: "Kamino SOL lending rate spiked — opportunistic supply to capture elevated yield",
      observations: [
        "Kamino SOL supply APY: 14.2% (up from 4.5% yesterday)",
        "Spike caused by: large leveraged SOL long opened on Kamino",
        "Borrower health factor: 1.45 (safe, not at risk of liquidation)",
        "Pool utilization: 89% (high, driving up rates)",
        "Historical rate spikes last 2-8 hours before normalizing"
      ],
      logic: "Rate spike is driven by a large leveraged position increasing utilization. These spikes typically last 2-8 hours before the borrower deleverages or new supply enters. Supplying 50 SOL ($7,425) at 14.2% APY for even 4 hours earns $0.47. Over 24 hours if sustained: $2.89. The opportunity cost is minimal since these SOL were idle. Supplying now and withdrawing when rate drops below 6% APY (auto-withdraw trigger set).",
      alternatives: [
        { action: "Wait for higher rates", reasonRejected: "14.2% is already 3x normal — waiting risks missing the window" },
        { action: "Supply full SOL balance", reasonRejected: "Keep reserves for gas and other opportunities" }
      ],
      actionChosen: "Supply 50 SOL to Kamino at 14.2% APY, auto-withdraw at <6%",
      confidence: 83,
      risk: "Low — Kamino is established, withdrawal is instant, borrower health is safe",
      outcome: "Capture elevated 14.2% APY on idle SOL until rates normalize",
      dataSources: [
        { name: "Kamino Lending Dashboard", type: "on_chain", summary: "SOL APY: 14.2%, utilization: 89%" },
        { name: "Rate History Model", type: "model", summary: "Similar spikes: 2-8hr duration avg" },
        { name: "Borrower Health Monitor", type: "on_chain", summary: "Largest borrower health: 1.45" }
      ]
    }
  },
  {
    name: "MarketMaker-MM1",
    actionType: "trade",
    scenario: {
      description: "Adjust market making quotes on SOL/USDC based on inventory and volatility",
      context: "Inventory skew detected — too long SOL, need to adjust bid/ask spread",
      observations: [
        "Current inventory: +18 SOL net long (target: ±5 SOL neutral)",
        "Realized volatility (1hr): 1.2% (above avg 0.8%)",
        "Bid-ask spread: $0.12 (8 bps, competitive)",
        "Fill rate: 73% bids, 45% asks (imbalanced — buying more than selling)",
        "PnL today: +$42 (fees) - $28 (inventory depreciation) = +$14 net"
      ],
      logic: "Inventory skew of +18 SOL exposes us to directional risk. With realized vol at 1.2%, a 1-sigma move ($1.78) on 18 SOL = $32 potential loss. Adjustments: (1) widen bid by 2 bps to reduce inbound buys, (2) tighten ask by 2 bps to encourage sells, (3) add 1 bps skew to inventory-neutral price. This should naturally rebalance inventory toward neutral over next 30 minutes. If inventory exceeds ±25 SOL, trigger market order to flatten.",
      alternatives: [
        { action: "Market sell 13 SOL immediately", reasonRejected: "Market order incurs slippage and signals our inventory to other MMs" },
        { action: "Keep current quotes", reasonRejected: "18 SOL long at 1.2% vol = uncompensated directional risk" }
      ],
      actionChosen: "Skew quotes: bid +2bps wider, ask -2bps tighter, 1bps inventory skew",
      confidence: 86,
      risk: "Low — quote adjustment is gradual and reversible",
      outcome: "Inventory rebalances toward neutral within 30 min via natural flow",
      dataSources: [
        { name: "Internal Inventory Tracker", type: "model", summary: "+18 SOL net long, target ±5" },
        { name: "Realized Volatility Feed", type: "model", summary: "1hr vol: 1.2% (1.5x avg)" },
        { name: "Order Book Depth", type: "on_chain", summary: "Bid-ask: $0.12, fill rate imbalanced" }
      ]
    }
  },
  {
    name: "DegenAlert-v2",
    actionType: "decision",
    scenario: {
      description: "Evaluate memecoin launch for early entry opportunity",
      context: "New token $PEPECAT trending on Solana — analyzing rug risk vs upside",
      observations: [
        "Token age: 3 hours, market cap: $180K",
        "Liquidity: $42K in Raydium pool",
        "Top holder: 15% of supply (creator wallet)",
        "Mint authority: revoked ✅, Freeze authority: revoked ✅",
        "Social: 1,200 X mentions in past 2 hours, 3 influencer posts"
      ],
      logic: "Token has positive safety indicators (authorities revoked) but concentration risk with 15% creator wallet. Social momentum is high but driven by paid influencers (identified 2 of 3 as KOLs who charge for posts). Memecoin playbook: high risk, potential 2-10x in 24hr, 90% chance of -80% within 7 days. Risk budget: max $100 (fun money only). Will take profit at 2x and let house money ride. Setting hard stop at -50% ($50).",
      alternatives: [
        { action: "Full degen — $1,000 entry", reasonRejected: "Exceeds fun money budget — memecoins are entertainment, not investment" },
        { action: "Skip entirely", reasonRejected: "$100 risk with 2-10x potential is positive EV at our bankroll size" }
      ],
      actionChosen: "Enter $100 position, take profit at 2x, hard stop at -50%",
      confidence: 45,
      risk: "Very high — memecoin with 90% historical failure rate",
      outcome: "Either 2-10x ($200-$1,000) or lose $50-$100 maximum",
      dataSources: [
        { name: "RugCheck Scanner", type: "api", summary: "Authorities revoked, 15% creator wallet" },
        { name: "DexScreener", type: "api", summary: "3hr old, $180K mcap, $42K liquidity" },
        { name: "X/Twitter Trend Monitor", type: "model", summary: "1,200 mentions, 3 influencer posts (2 paid)" }
      ]
    }
  },
  {
    name: "NFTSniper-ME",
    actionType: "trade",
    scenario: {
      description: "Snipe underpriced NFT listing on Magic Eden using trait-based valuation",
      context: "Tensorian #7842 listed 22% below trait-estimated fair value",
      observations: [
        "Tensorian floor: 3.2 SOL, trait floor for 'Gold Frame': 5.8 SOL",
        "Listing price: 4.5 SOL (22% below trait floor)",
        "Seller wallet: listed 4 items in past hour (likely panic selling)",
        "Collection 7-day volume: 892 SOL (healthy)",
        "Similar trait item sold for 6.1 SOL 18 hours ago"
      ],
      logic: "Clear mispricing — Gold Frame trait has established floor at 5.8 SOL with recent comparable sale at 6.1 SOL. Listing at 4.5 SOL represents 22-26% discount. Seller appears to be liquidating multiple items quickly, suggesting motivation to sell rather than price discovery. Buy immediately at 4.5 SOL, list for 5.5 SOL (5% below trait floor for quick flip). Expected profit: 1.0 SOL ($148.50) minus ~0.1 SOL fees = 0.9 SOL net.",
      alternatives: [
        { action: "Offer 3.8 SOL", reasonRejected: "Counter-offer risks losing the listing to faster sniper" },
        { action: "Wait for cheaper listing", reasonRejected: "This trait appears <5 times at this price tier per month" }
      ],
      actionChosen: "Instant buy Tensorian #7842 at 4.5 SOL, list at 5.5 SOL",
      confidence: 81,
      risk: "Low-moderate — collection is liquid but NFT sales not guaranteed",
      outcome: "Expected 0.9 SOL profit (~$133) on quick flip within 48 hours",
      dataSources: [
        { name: "Magic Eden Listings API", type: "api", summary: "Tensorian #7842: 4.5 SOL, Gold Frame trait" },
        { name: "Tensor Trait Floor Data", type: "api", summary: "Gold Frame floor: 5.8 SOL" },
        { name: "NFT Valuation Model", type: "model", summary: "Fair value: 5.5-6.2 SOL based on recent sales" }
      ]
    }
  },
  {
    name: "JitoMEVBot-v3",
    actionType: "trade",
    scenario: {
      description: "Submit MEV bundle via Jito for back-running large Jupiter swap",
      context: "Detected 500 SOL buy order pending on Jupiter — back-run opportunity",
      observations: [
        "Pending swap: 500 SOL buy on Jupiter (impact: +0.8% on Raydium pool)",
        "Estimated post-swap price: $149.69 vs current $148.50",
        "Back-run strategy: sell 2 SOL at elevated price, buy back after spread normalizes",
        "Jito bundle tip: 50,000 lamports for guaranteed ordering",
        "Expected profit: $1.58 per back-run (after tip)"
      ],
      logic: "Large incoming swap will push SOL/USDC price up by ~0.8% on Raydium. By placing a sell order immediately after the swap executes (via Jito bundle), we capture the temporary price elevation before arbitrage bots normalize it. This is non-extractive MEV — we're providing liquidity at an elevated price, not front-running. Position size limited to 2 SOL to minimize market impact of our own trade. ROI per bundle: ~0.05% on 2 SOL, but at 20+ bundles/hour this scales to ~$31.60/hr.",
      alternatives: [
        { action: "Front-run instead", reasonRejected: "Front-running is extractive MEV — against our ethical guidelines" },
        { action: "Larger position (10 SOL)", reasonRejected: "Larger size risks adverse selection if swap doesn't fill as expected" }
      ],
      actionChosen: "Submit Jito back-run bundle: sell 2 SOL post-swap, buy back at revert",
      confidence: 79,
      risk: "Low — worst case: price doesn't revert and we sell 2 SOL at +0.8% premium",
      outcome: "Capture ~$1.58 profit from non-extractive back-running",
      dataSources: [
        { name: "Jito Block Engine", type: "api", summary: "Bundle submitted, tip: 50K lamports" },
        { name: "Jupiter Swap Detector", type: "on_chain", summary: "Pending: 500 SOL buy, +0.8% impact" },
        { name: "Raydium Pool State", type: "on_chain", summary: "SOL/USDC: $148.50, depth: $3.2M" }
      ]
    }
  },
  {
    name: "RWAMonitor-v1",
    actionType: "audit",
    scenario: {
      description: "Audit RWA (Real World Asset) token backing on Solana",
      context: "Monthly verification of RWA treasury token backed by US Treasury bills",
      observations: [
        "Token total supply: 5,000,000 USDY",
        "Claimed backing: $5.1M in US T-bills (102% collateralization)",
        "Ondo Finance attestation: verified by third-party auditor",
        "On-chain reserve address holds: $5.1M equivalent",
        "Yield distribution: 4.8% APY (matching current T-bill rate)"
      ],
      logic: "Monthly RWA audit confirms: (1) token supply matches stated amount, (2) reserve address holds 102% collateral as attested, (3) yield rate matches underlying T-bill rate (no unsustainable incentives), (4) third-party attestation is current and signed by recognized auditor. All checks pass. Maintaining our $200K allocation to USDY as stable yield component of the portfolio.",
      alternatives: [
        { action: "Increase allocation", reasonRejected: "RWA concentration should stay below 20% of portfolio" },
        { action: "Switch to USDC yield farming", reasonRejected: "USDY provides T-bill backed yield with lower smart contract risk" }
      ],
      actionChosen: "Confirm RWA backing verified — maintain $200K USDY position",
      confidence: 92,
      risk: "Very low — US T-bill backed, 102% collateralized, third-party audited",
      outcome: "Continued 4.8% APY on stable RWA position with verified backing",
      dataSources: [
        { name: "Ondo Finance Reserve Monitor", type: "on_chain", summary: "$5.1M reserves, 102% collateralized" },
        { name: "Third-Party Audit Report", type: "other", summary: "Monthly attestation current and valid" },
        { name: "US Treasury Rate Feed", type: "price_feed", summary: "T-bill rate: 4.8% APY (matching)" }
      ]
    }
  },
];

// ─── Main Script ────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const connection = new Connection(DEVNET_RPC, "confirmed");
  
  // Load main devnet wallet
  const keypairPath = process.env.KEYPAIR_PATH || "/Users/austin/.config/solana/axiom-devnet.json";
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const mainWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  🔮 SOLPRISM Devnet Activity Seeder");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Main wallet: ${mainWallet.publicKey.toBase58()}`);
  
  const balance = await connection.getBalance(mainWallet.publicKey);
  console.log(`  Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`  Agents to seed: ${BATCH_SIZE}`);
  console.log(`  Funding per agent: ${FUND_AMOUNT / LAMPORTS_PER_SOL} SOL`);
  console.log(`  Total funding needed: ${(BATCH_SIZE * FUND_AMOUNT / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const totalNeeded = BATCH_SIZE * FUND_AMOUNT + 0.01 * LAMPORTS_PER_SOL; // extra for tx fees
  if (balance < totalNeeded) {
    console.error(`❌ Insufficient balance. Need ${(totalNeeded / LAMPORTS_PER_SOL).toFixed(4)} SOL, have ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    process.exit(1);
  }

  // Step 1: Generate agent wallets
  console.log("📋 Step 1: Generating agent wallets...\n");
  const agents: { keypair: Keypair; template: AgentTemplate }[] = [];
  
  for (let i = 0; i < BATCH_SIZE; i++) {
    const template = AGENT_TEMPLATES[i % AGENT_TEMPLATES.length];
    // Append index if we reuse templates
    const uniqueName = i < AGENT_TEMPLATES.length 
      ? template.name 
      : `${template.name}-${Math.floor(i / AGENT_TEMPLATES.length) + 1}`;
    agents.push({
      keypair: Keypair.generate(),
      template: { ...template, name: uniqueName },
    });
  }
  console.log(`  ✅ Generated ${agents.length} agent keypairs\n`);

  // Step 2: Fund agents in batches (multiple transfers per tx to save fees)
  console.log("💰 Step 2: Funding agent wallets...\n");
  const FUND_BATCH = 10; // transfers per transaction
  for (let i = 0; i < agents.length; i += FUND_BATCH) {
    const batch = agents.slice(i, i + FUND_BATCH);
    const tx = new Transaction();
    
    for (const agent of batch) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: mainWallet.publicKey,
          toPubkey: agent.keypair.publicKey,
          lamports: FUND_AMOUNT,
        })
      );
    }

    try {
      const sig = await sendAndConfirmTransaction(connection, tx, [mainWallet], {
        commitment: "confirmed",
        skipPreflight: true,
      });
      console.log(`  ✅ Funded agents ${i + 1}-${i + batch.length}: ${sig}`);
    } catch (err: any) {
      console.error(`  ❌ Funding batch ${i / FUND_BATCH + 1} failed: ${err.message}`);
      // Retry individually
      for (const agent of batch) {
        try {
          const tx2 = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: mainWallet.publicKey,
              toPubkey: agent.keypair.publicKey,
              lamports: FUND_AMOUNT,
            })
          );
          const sig2 = await sendAndConfirmTransaction(connection, tx2, [mainWallet], {
            commitment: "confirmed",
            skipPreflight: true,
          });
          console.log(`    ↳ Funded ${agent.template.name}: ${sig2}`);
        } catch (err2: any) {
          console.error(`    ↳ ❌ Failed to fund ${agent.template.name}: ${err2.message}`);
        }
        await sleep(DELAY_MS);
      }
    }
    await sleep(DELAY_MS);
  }

  // Step 3: Register + Commit reasoning for each agent
  console.log("\n🔐 Step 3: Register agents & commit reasoning...\n");
  
  interface AgentResult {
    name: string;
    wallet: string;
    agentPda: string;
    commitmentPda: string;
    registerSig: string;
    commitSig: string;
    revealSig: string;
    hash: string;
    actionType: string;
    confidence: number;
    trace: ReasoningTrace;
  }
  
  const results: AgentResult[] = [];
  const failed: string[] = [];

  for (let i = 0; i < agents.length; i++) {
    const { keypair, template } = agents[i];
    const agentNum = `[${i + 1}/${agents.length}]`;
    
    try {
      // Build the reasoning trace
      const trace = createReasoningTrace({
        agent: template.name,
        action: {
          type: template.actionType,
          description: template.scenario.description,
        },
        inputs: {
          dataSources: template.scenario.dataSources,
          context: template.scenario.context,
        },
        analysis: {
          observations: template.scenario.observations,
          logic: template.scenario.logic,
          alternativesConsidered: template.scenario.alternatives,
        },
        decision: {
          actionChosen: template.scenario.actionChosen,
          confidence: template.scenario.confidence,
          riskAssessment: template.scenario.risk,
          expectedOutcome: template.scenario.outcome,
        },
        metadata: {
          model: "gpt-4-turbo",
          sessionId: `devnet-seed-${Date.now().toString(36)}-${i}`,
          executionTimeMs: 150 + Math.floor(Math.random() * 500),
        },
      });

      const traceHash = hashTrace(trace);
      const traceHashHex = hashTraceHex(trace);
      
      // Register agent
      const registerIx = buildRegisterAgentIx(keypair.publicKey, template.name);
      const registerTx = new Transaction().add(registerIx);
      
      const registerSig = await sendAndConfirmTransaction(connection, registerTx, [keypair], {
        commitment: "confirmed",
        skipPreflight: true,
      });
      
      // Commit reasoning (nonce = 0 for first commitment)
      const nonce = 0;
      const commitIx = buildCommitReasoningIx(
        keypair.publicKey,
        traceHash,
        template.actionType,
        template.scenario.confidence,
        nonce,
      );
      const commitTx = new Transaction().add(commitIx);
      
      const commitSig = await sendAndConfirmTransaction(connection, commitTx, [keypair], {
        commitment: "confirmed",
        skipPreflight: true,
      });

      const [agentPda] = deriveAgentPDA(keypair.publicKey);
      const [commitPda] = deriveCommitmentPDA(agentPda, nonce);

      results.push({
        name: template.name,
        wallet: keypair.publicKey.toBase58(),
        agentPda: agentPda.toBase58(),
        commitmentPda: commitPda.toBase58(),
        registerSig,
        commitSig,
        revealSig: "", // filled in step 4
        hash: traceHashHex,
        actionType: template.actionType,
        confidence: template.scenario.confidence,
        trace,
      });

      console.log(`  ${agentNum} ✅ ${template.name}`);
      console.log(`      Register: ${registerSig}`);
      console.log(`      Commit:   ${commitSig}`);
      console.log(`      Hash:     ${traceHashHex.slice(0, 16)}...`);
    } catch (err: any) {
      console.error(`  ${agentNum} ❌ ${template.name}: ${err.message}`);
      failed.push(template.name);
    }
    
    await sleep(DELAY_MS);
  }

  // Step 4: Reveal reasoning for committed agents
  console.log("\n📖 Step 4: Revealing reasoning traces...\n");
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const agent = agents.find(a => a.keypair.publicKey.toBase58() === result.wallet);
    if (!agent) continue;

    const revealNum = `[${i + 1}/${results.length}]`;

    try {
      // Create a data URI with the reasoning trace
      const traceJson = JSON.stringify(result.trace, null, 2);
      const dataUri = `data:application/json;base64,${Buffer.from(traceJson).toString("base64").slice(0, 200)}`;
      // Use a reasonable URI — in production this would be IPFS
      const reasoningUri = `https://solprism.app/api/reasoning/${result.hash.slice(0, 16)}`;

      const commitmentPubkey = new PublicKey(result.commitmentPda);
      const revealIx = buildRevealReasoningIx(
        agent.keypair.publicKey,
        commitmentPubkey,
        reasoningUri,
      );
      const revealTx = new Transaction().add(revealIx);

      const revealSig = await sendAndConfirmTransaction(connection, revealTx, [agent.keypair], {
        commitment: "confirmed",
        skipPreflight: true,
      });

      result.revealSig = revealSig;
      console.log(`  ${revealNum} ✅ ${result.name} revealed: ${revealSig}`);
    } catch (err: any) {
      console.error(`  ${revealNum} ❌ ${result.name} reveal failed: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  // Final Report
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  📊 SEEDING COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Agents registered:     ${results.length}`);
  console.log(`  Reasoning committed:   ${results.length}`);
  console.log(`  Reasoning revealed:    ${results.filter(r => r.revealSig).length}`);
  console.log(`  Failed:                ${failed.length}`);

  if (failed.length > 0) {
    console.log(`  Failed agents:         ${failed.join(", ")}`);
  }

  // Print all transaction signatures
  console.log("\n  📝 All Transaction Signatures:");
  console.log("  ─────────────────────────────────────────────────────────────");
  for (const r of results) {
    console.log(`  ${r.name}:`);
    console.log(`    Register: ${r.registerSig}`);
    console.log(`    Commit:   ${r.commitSig}`);
    if (r.revealSig) {
      console.log(`    Reveal:   ${r.revealSig}`);
    }
  }

  // Save results
  const outputPath = "/Users/austin/.openclaw/workspace/axiom-protocol/sdk/seed-results.json";
  const outputData = results.map(r => ({
    name: r.name,
    wallet: r.wallet,
    agentPda: r.agentPda,
    commitmentPda: r.commitmentPda,
    registerSig: r.registerSig,
    commitSig: r.commitSig,
    revealSig: r.revealSig,
    hash: r.hash,
    actionType: r.actionType,
    confidence: r.confidence,
  }));
  
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`\n  💾 Results saved to: ${outputPath}`);

  // Final balance
  const endBalance = await connection.getBalance(mainWallet.publicKey);
  console.log(`  💰 Remaining balance: ${(endBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`  💸 SOL spent: ${((balance - endBalance) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
