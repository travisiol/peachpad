/**
 * Shapes served by /api/launches and /api/pons/v2/<token>/*. They mirror
 * what the pad's indexer and the Pons V2 market API return, so the UI does
 * not care whether a response came from upstream or from the sample set.
 */

export type LaunchMarket = {
  priceUsd: number;
  marketCapUsd: number;
  pairedPrincipalEth: number;
  graduationProgressPct: number;
  graduated: boolean;
};

export type Launch = {
  token: string;
  curve: string;
  creator: string;
  /** The 90/10 fee splitter deployed for this launch. */
  splitter: string;
  creatorTaxBps: number;
  /** Developer buy in wei, as a decimal string. */
  developerBuy: string;
  name: string;
  symbol: string;
  /** `ipfs://<cid>` or an https URL. Empty when the launch has no image. */
  logo: string;
  description: string;
  txHash: string;
  blockNumber: string;
  launchedAt: string;
  market: LaunchMarket;
};

export type LaunchesResponse = {
  ok: boolean;
  /** `"indexer"` when served from PEACHPAD_INDEXER_URL, `"sample"` otherwise. */
  source: "indexer" | "sample";
  launches: Launch[];
};

export type QuoteAsset = {
  address: string;
  symbol: string;
  name?: string;
  decimals: number;
  isNative: boolean;
  assetClass?: string;
};

export type MarketSummary = {
  version: "v2";
  factory: string;
  token: string;
  deployer: string;
  pool: string;
  pairToken: string;
  transactionHash: string;
  blockNumber: number;
  launchedAt: string;
  initialBuyWei: string;
  name: string;
  symbol: string;
  logo: string;
  description: string;
  priceUsd: number;
  marketCapUsd: number;
  liquidityUsd: number | null;
  graduated: boolean;
  graduatedAt: string | null;
  graduatedBlockNumber: number | null;
  graduationProgressPct: number;
  pairedPrincipalEth: number;
  graduationThresholdEth: number;
  latestBuyAt: string | null;
  latestBuyBlockNumber: number | null;
  quoteAsset: QuoteAsset;
  venue: "curve" | "pool";
};

export type FeeSummary = {
  token: string;
  feeEscrow: string;
  /** The splitter that receives creator fees for this token. */
  recipient: string;
  quoteAsset: QuoteAsset;
  /** Lifetime creator fees indexed by Pons, in wei. */
  earnedForToken: string;
  /** Fees sitting in escrow, claimable now, in wei. */
  claimableForWallet: string;
  sweepCount: number;
  nothingToClaim: boolean;
};

export type SummaryResponse = {
  ok: boolean;
  source: "pons" | "sample";
  market: MarketSummary;
  fees: FeeSummary | null;
  feesError: string | null;
};

export type Trade = {
  id: string;
  venue: "curve" | "pool";
  side: "buy" | "sell";
  /** Token amount in base units (18 decimals), decimal string. */
  tokenAmount: string;
  /** Quote amount in wei, decimal string. */
  quoteAmount: string;
  account: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
};

export type TradesResponse = {
  source: "pons" | "sample";
  trades: Trade[];
};

export type ChartRange = "5m" | "1h" | "6h" | "1d" | "all";

export type ChartPoint = {
  t: number;
  /** Price in ETH per token. */
  price: number;
  blockNumber: number;
  volumeQuote: number;
  tradeCount: number;
};

export type ChartResponse = {
  source: "pons" | "sample";
  token: string;
  range: ChartRange;
  intervalSeconds: number;
  points: ChartPoint[];
};

export const CHART_RANGES: { key: ChartRange; label: string }[] = [
  { key: "5m", label: "5M" },
  { key: "1h", label: "1H" },
  { key: "6h", label: "6H" },
  { key: "1d", label: "1D" },
  { key: "all", label: "ALL" },
];

/** Pons launches with a fixed 1e9 supply; market cap = price × supply. */
export const TOKEN_SUPPLY = 1_000_000_000;

/** Resolve `ipfs://` logos through the Pons gateway, pass https through. */
export function logoUrl(logo: string | null | undefined): string | null {
  if (!logo) return null;
  if (logo.startsWith("ipfs://")) {
    const cid = logo.slice("ipfs://".length);
    return `https://www.ponsfamily.com/api/ipfs/content/${cid}?variant=card`;
  }
  if (/^https?:\/\//.test(logo)) return logo;
  return null;
}
