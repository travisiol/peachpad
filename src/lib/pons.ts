/**
 * Shapes served by /api/launches and /api/pons/v2/<token>/*. Everything is
 * read from Robinhood Chain — the router for the list and metadata, the
 * Pons curve for the market, the fee escrow for creator fees.
 */

export type LaunchMarket = {
  /** ETH per token, from the curve's (virtual) reserves. */
  priceEth: number;
  /** Null when no ETH/USD quote is available. */
  priceUsd: number | null;
  marketCapEth: number;
  marketCapUsd: number | null;
  /** ETH actually raised on the curve so far. */
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
  blockNumber: string;
  launchedAt: string;
  market: LaunchMarket;
};

export type LaunchesResponse = {
  ok: boolean;
  launches: Launch[];
};

export type MarketSummary = {
  token: string;
  curve: string;
  deployer: string;
  splitter: string;
  launchBlock: number;
  launchedAt: string;
  developerBuy: string;
  name: string;
  symbol: string;
  logo: string;
  description: string;
  priceEth: number;
  priceUsd: number | null;
  marketCapEth: number;
  marketCapUsd: number | null;
  graduated: boolean;
  graduationProgressPct: number;
  pairedPrincipalEth: number;
  graduationThresholdEth: number;
  launchSupply: number;
  ethUsd: number | null;
  venue: "curve" | "pool";
};

export type FeeSummary = {
  token: string;
  feeEscrow: string;
  /** The splitter that receives creator fees for this token. */
  recipient: string;
  /** Creator fees sitting in the Pons escrow for the splitter, in wei. */
  inEscrowWei: string;
  /** Everything a collect would pay out right now, in wei. */
  pendingWei: string;
  /** The creator's share of fees still on the curve, waiting for Pons' sweep, in wei. */
  accruingWei: string;
};

export type SummaryResponse = {
  ok: boolean;
  market: MarketSummary;
  fees: FeeSummary;
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
  token: string;
  range: ChartRange;
  intervalSeconds: number;
  ethUsd: number | null;
  launchSupply: number;
  points: ChartPoint[];
};

export const CHART_RANGES: { key: ChartRange; label: string }[] = [
  { key: "5m", label: "5M" },
  { key: "1h", label: "1H" },
  { key: "6h", label: "6H" },
  { key: "1d", label: "1D" },
  { key: "all", label: "ALL" },
];

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
