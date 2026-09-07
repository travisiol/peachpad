import type {
  ChartPoint,
  ChartRange,
  Launch,
  MarketSummary,
  FeeSummary,
  Trade,
} from "@/lib/pons";
import { TOKEN_SUPPLY } from "@/lib/pons";

/**
 * The sample set served while no indexer is configured. Every address here
 * is a visibly synthetic `0x0000…` value — never a real contract — and every
 * response built from this file carries `source: "sample"` so the UI can
 * say so next to the numbers.
 */

const ZERO = "0x0000000000000000000000000000000000000000";
const pad = (tag: string) => `0x${tag.padStart(40, "0")}`;
const hash = (tag: string) => `0x${tag.padStart(64, "0")}`;

/** ETH/USD used to turn a chart price (ETH per token) into a market cap. */
export const SAMPLE_ETH_USD = 2600;

type Seed = {
  name: string;
  symbol: string;
  description: string;
  tag: string;
  marketCapUsd: number;
  pairedPrincipalEth: number;
  graduated: boolean;
  developerBuy: string;
  launchedAt: string;
  blockNumber: number;
};

const SEEDS: Seed[] = [
  {
    name: "APRICOT",
    symbol: "APRICOT",
    description: "",
    tag: "a01",
    marketCapUsd: 4164.26,
    pairedPrincipalEth: 0.0015,
    graduated: false,
    developerBuy: "50000000000000000",
    launchedAt: "2026-09-07T10:02:07.000Z",
    blockNumber: 56747115,
  },
  {
    name: "NECTARINE",
    symbol: "NECTA",
    description: "",
    tag: "a02",
    marketCapUsd: 4282.6,
    pairedPrincipalEth: 0.01505,
    graduated: false,
    developerBuy: "40000000000000000",
    launchedAt: "2026-09-07T09:47:27.000Z",
    blockNumber: 56738402,
  },
  {
    name: "PLUM",
    symbol: "PLUM",
    description: "",
    tag: "a03",
    marketCapUsd: 4310.93,
    pairedPrincipalEth: 0.023142,
    graduated: false,
    developerBuy: "4000000000000000",
    launchedAt: "2026-09-07T09:35:46.000Z",
    blockNumber: 56731452,
  },
  {
    name: "Mango",
    symbol: "MANGO",
    description: "",
    tag: "a04",
    marketCapUsd: 5297.25,
    pairedPrincipalEth: 0.2068,
    graduated: false,
    developerBuy: "0",
    launchedAt: "2026-09-06T21:57:09.000Z",
    blockNumber: 56315973,
  },
  {
    name: "peachpad.fun",
    symbol: "PEACH",
    description: "The juiciest way to launch on Robinhood.",
    tag: "a05",
    marketCapUsd: 7071.57,
    pairedPrincipalEth: 4.2,
    graduated: true,
    developerBuy: "250000000000000000",
    launchedAt: "2026-09-06T21:34:25.000Z",
    blockNumber: 56302447,
  },
];

const GRADUATION_ETH = 4.2;

function toLaunch(s: Seed): Launch {
  const progress = s.graduated
    ? 100
    : Math.round((s.pairedPrincipalEth / GRADUATION_ETH) * 10000) / 100;
  return {
    token: pad(s.tag),
    curve: pad(`c${s.tag}`),
    creator: pad(`d${s.tag}`),
    splitter: pad(`5${s.tag}`),
    creatorTaxBps: 0,
    developerBuy: s.developerBuy,
    name: s.name,
    symbol: s.symbol,
    logo: "",
    description: s.description,
    txHash: hash(s.tag),
    blockNumber: String(s.blockNumber),
    launchedAt: s.launchedAt,
    market: {
      priceUsd: s.marketCapUsd / TOKEN_SUPPLY,
      marketCapUsd: s.marketCapUsd,
      pairedPrincipalEth: s.pairedPrincipalEth,
      graduationProgressPct: progress,
      graduated: s.graduated,
    },
  };
}

export const SAMPLE_LAUNCHES: Launch[] = SEEDS.map(toLaunch);

export function findSampleLaunch(token: string): Launch | undefined {
  const t = token.toLowerCase();
  return SAMPLE_LAUNCHES.find((l) => l.token.toLowerCase() === t);
}

/** Deterministic pseudo-random so the sample chart is stable across reloads. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANGE_SECONDS: Record<ChartRange, number> = {
  "5m": 5 * 60,
  "1h": 60 * 60,
  "6h": 6 * 60 * 60,
  "1d": 24 * 60 * 60,
  all: 36 * 60 * 60,
};

const RANGE_INTERVAL: Record<ChartRange, number> = {
  "5m": 15,
  "1h": 15,
  "6h": 60,
  "1d": 300,
  all: 900,
};

export function sampleChart(launch: Launch, range: ChartRange, now = Date.now()) {
  const rand = mulberry32(parseInt(launch.token.slice(-3), 16) * 7 + range.length);
  const span = RANGE_SECONDS[range];
  const end = Math.floor(now / 1000);
  const start = end - span;
  const count = Math.min(48, Math.max(8, Math.floor(span / RANGE_INTERVAL[range] / 6)));
  const endPriceEth = launch.market.priceUsd / SAMPLE_ETH_USD;
  const points: ChartPoint[] = [];
  // Walk backwards from the live price so the last point always matches
  // the summary, then reverse.
  let price = endPriceEth;
  for (let i = count - 1; i >= 0; i--) {
    const t = start + Math.floor((span * i) / (count - 1));
    points.unshift({
      t,
      price,
      blockNumber: Number(launch.blockNumber) + i * 40,
      volumeQuote: Math.round(rand() * 900) / 10000,
      tradeCount: 1 + Math.floor(rand() * 3),
    });
    price = price * (1 + (rand() - 0.45) * 0.08);
  }
  return {
    token: launch.token,
    range,
    intervalSeconds: RANGE_INTERVAL[range],
    points,
  };
}

export function sampleTrades(launch: Launch, now = Date.now()): Trade[] {
  const rand = mulberry32(parseInt(launch.token.slice(-3), 16) * 13);
  const end = Math.floor(now / 1000);
  const trades: Trade[] = [];
  const accounts = [pad("b01"), pad("b02"), pad("b03"), pad("b04")];
  let t = end - 120;
  for (let i = 0; i < 24; i++) {
    const side = rand() > 0.55 ? "sell" : "buy";
    const quoteEth = 0.0005 + rand() * 0.09;
    const priceEth = launch.market.priceUsd / SAMPLE_ETH_USD;
    const tokens = quoteEth / priceEth;
    trades.push({
      id: `sample:${launch.token}:${i}`,
      venue: launch.market.graduated ? "pool" : "curve",
      side,
      tokenAmount: BigInt(Math.floor(tokens)).toString() + "000000000000000000",
      quoteAmount: BigInt(Math.floor(quoteEth * 1e18)).toString(),
      account: accounts[Math.floor(rand() * accounts.length)],
      transactionHash: hash(`${launch.token.slice(-3)}${i.toString(16)}`),
      blockNumber: Number(launch.blockNumber) + 5000 - i * 37,
      timestamp: t,
    });
    t -= 60 + Math.floor(rand() * 900);
  }
  return trades;
}

export function sampleSummary(launch: Launch): {
  market: MarketSummary;
  fees: FeeSummary;
} {
  const earned = "202434174408503955";
  const claimable = "33237149332099512";
  return {
    market: {
      version: "v2",
      factory: ZERO,
      token: launch.token,
      deployer: launch.creator,
      pool: launch.market.graduated ? pad(`9${launch.token.slice(-3)}`) : ZERO,
      pairToken: ZERO,
      transactionHash: launch.txHash,
      blockNumber: Number(launch.blockNumber),
      launchedAt: launch.launchedAt,
      initialBuyWei: launch.developerBuy,
      name: launch.name,
      symbol: launch.symbol,
      logo: launch.logo,
      description: launch.description,
      priceUsd: launch.market.priceUsd,
      marketCapUsd: launch.market.marketCapUsd,
      liquidityUsd: null,
      graduated: launch.market.graduated,
      graduatedAt: launch.market.graduated ? "2026-09-07T10:10:27.000Z" : null,
      graduatedBlockNumber: launch.market.graduated ? 56752077 : null,
      graduationProgressPct: launch.market.graduationProgressPct,
      pairedPrincipalEth: launch.market.pairedPrincipalEth,
      graduationThresholdEth: GRADUATION_ETH,
      latestBuyAt: null,
      latestBuyBlockNumber: null,
      quoteAsset: {
        address: ZERO,
        symbol: "ETH",
        name: "Ether",
        decimals: 18,
        isNative: true,
        assetClass: "native",
      },
      venue: launch.market.graduated ? "pool" : "curve",
    },
    fees: {
      token: launch.token,
      feeEscrow: pad(`e${launch.token.slice(-3)}`),
      recipient: launch.splitter,
      quoteAsset: { address: ZERO, symbol: "ETH", decimals: 18, isNative: true },
      earnedForToken: launch.market.graduated ? earned : "0",
      claimableForWallet: launch.market.graduated ? claimable : "0",
      sweepCount: launch.market.graduated ? 90 : 0,
      nothingToClaim: !launch.market.graduated,
    },
  };
}
