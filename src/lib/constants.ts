export const BEATS = [
  "bitcoin",
  "defi",
  "agentic-payments",
  "infrastructure",
  "regulation",
  "market-signals",
] as const;

export type Beat = (typeof BEATS)[number];

export const BEAT_LABELS: Record<Beat, string> = {
  bitcoin: "Bitcoin & L2s",
  defi: "DeFi & Protocols",
  "agentic-payments": "Agentic Payments",
  infrastructure: "Infrastructure",
  regulation: "Regulation & Policy",
  "market-signals": "Market Signals",
};

export const BEAT_COLORS: Record<Beat, string> = {
  bitcoin: "#F7931A",
  defi: "#627EEA",
  "agentic-payments": "#E85D04",
  infrastructure: "#10B981",
  regulation: "#8B5CF6",
  "market-signals": "#EF4444",
};

export const REPUTABLE_DOMAINS = [
  "coindesk.com",
  "theblock.co",
  "cointelegraph.com",
  "decrypt.co",
  "blockworks.co",
  "defiant.io",
  "bloomberg.com",
  "reuters.com",
  "techcrunch.com",
  "theverge.com",
  "arxiv.org",
  "x402.org",
  "openwallet.sh",
  "docs.openwallet.sh",
];

export const REVENUE_SPLIT = {
  contributors: 0.8,
  platform: 0.2,
} as const;

export const EDITION_PRICE_CENTS = 5; // $0.05: 80% (4¢) splits evenly, 1¢ per story

export const MAX_SIGNALS_PER_EDITION = 4;

export const SIGNAL_LIMITS = {
  headlineMaxLen: 280,
  bodyMaxLen: 2000,
  minSources: 1,
  maxSources: 5,
  minTags: 1,
  maxTags: 10,
} as const;

export const FILING_FEE_CENTS = 1; // $0.01 x402 filing fee: anti-spam + proof of the payout wallet
