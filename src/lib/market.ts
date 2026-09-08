import { formatEther, parseAbiItem, type Address } from "viem";
import { chainClient } from "@/lib/chainClient";
import { cached } from "@/lib/cache";
import { ROUTER_ADDRESS, routerAbi } from "@/lib/contracts";
import { curveAbi, escrowAbi } from "@/lib/ponsAbi";
import type {
  ChartPoint,
  ChartRange,
  ChartResponse,
  Launch,
  MarketSummary,
  FeeSummary,
  Trade,
} from "@/lib/pons";

/**
 * Everything the site knows about a launch, read from the chain: the
 * router for the list and the metadata, the Pons curve for reserves and
 * graduation, the fee escrow for pending creator fees. No indexer.
 */

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const ETH_USD_TTL = 60_000;
const LIST_TTL = 12_000;
const SUMMARY_TTL = 10_000;
const TRADES_TTL = 15_000;

const RANGE_SECONDS: Record<ChartRange, number> = {
  "5m": 5 * 60,
  "1h": 60 * 60,
  "6h": 6 * 60 * 60,
  "1d": 24 * 60 * 60,
  all: Number.MAX_SAFE_INTEGER,
};

const RANGE_INTERVAL: Record<ChartRange, number> = {
  "5m": 15,
  "1h": 15,
  "6h": 60,
  "1d": 300,
  all: 900,
};

const wei = (v: bigint) => Number(formatEther(v));

/** ETH/USD from Coinbase's public spot endpoint; null when unreachable. */
export function ethUsd(): Promise<number | null> {
  return cached("ethUsd", ETH_USD_TTL, async () => {
    try {
      const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
        next: { revalidate: 60 },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: { amount?: string } };
      const n = Number(json.data?.amount);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  });
}

type CurveState = {
  quote: bigint;
  tokens: bigint;
  realQuote: bigint;
  threshold: bigint;
  graduated: boolean;
  launchSupply: bigint;
};

async function readCurves(curves: Address[]): Promise<CurveState[]> {
  if (curves.length === 0) return [];
  const client = chainClient();
  const results = await client.multicall({
    allowFailure: true,
    contracts: curves.flatMap((address) => [
      { address, abi: curveAbi, functionName: "getReserves" } as const,
      { address, abi: curveAbi, functionName: "realQuoteReserve" } as const,
      { address, abi: curveAbi, functionName: "graduationThreshold" } as const,
      { address, abi: curveAbi, functionName: "graduated" } as const,
      { address, abi: curveAbi, functionName: "launchSupply" } as const,
    ]),
  });
  return curves.map((_, i) => {
    const r = results.slice(i * 5, i * 5 + 5);
    const reserves = (r[0].status === "success" ? r[0].result : [0n, 0n]) as readonly [bigint, bigint];
    return {
      quote: reserves[0],
      tokens: reserves[1],
      realQuote: r[1].status === "success" ? (r[1].result as bigint) : 0n,
      threshold: r[2].status === "success" ? (r[2].result as bigint) : 0n,
      graduated: r[3].status === "success" ? (r[3].result as boolean) : false,
      launchSupply: r[4].status === "success" ? (r[4].result as bigint) : 0n,
    };
  });
}

/** ETH per token from the curve's (virtual) reserves. */
function priceEth(c: CurveState): number {
  if (c.tokens === 0n) return 0;
  return wei(c.quote) / wei(c.tokens);
}

function marketOf(c: CurveState, usd: number | null) {
  const p = priceEth(c);
  const supply = wei(c.launchSupply);
  const raised = wei(c.realQuote);
  const threshold = wei(c.threshold);
  const progress = c.graduated
    ? 100
    : threshold > 0
      ? Math.min(100, (raised / threshold) * 100)
      : 0;
  return {
    priceEth: p,
    priceUsd: usd === null ? null : p * usd,
    marketCapEth: p * supply,
    marketCapUsd: usd === null ? null : p * supply * usd,
    pairedPrincipalEth: raised,
    graduationProgressPct: progress,
    graduated: c.graduated,
  };
}

type RouterInfo = {
  token: Address;
  curve: Address;
  creator: Address;
  splitter: Address;
  creatorTaxBps: number;
  developerBuy: bigint;
  launchedAt: bigint;
  launchBlock: bigint;
  name: string;
  symbol: string;
  logo: string;
  description: string;
};

/** Newest first. Empty until the router exists and someone launches. */
export function listLaunches(limit: number): Promise<Launch[]> {
  if (!ROUTER_ADDRESS) return Promise.resolve([]);
  const router = ROUTER_ADDRESS;
  return cached(`launches:${limit}`, LIST_TTL, async () => {
    const client = chainClient();
    const [page, usd] = await Promise.all([
      client.readContract({ address: router, abi: routerAbi, functionName: "launches", args: [0n, BigInt(limit)] }) as Promise<readonly RouterInfo[]>,
      ethUsd(),
    ]);
    const curves = await readCurves(page.map((l) => l.curve));
    return page.map((l, i) => {
      const m = marketOf(curves[i], usd);
      return {
        token: l.token,
        curve: l.curve,
        creator: l.creator,
        splitter: l.splitter,
        creatorTaxBps: l.creatorTaxBps,
        developerBuy: l.developerBuy.toString(),
        name: l.name,
        symbol: l.symbol,
        logo: l.logo,
        description: l.description,
        blockNumber: l.launchBlock.toString(),
        launchedAt: new Date(Number(l.launchedAt) * 1000).toISOString(),
        market: {
          priceEth: m.priceEth,
          priceUsd: m.priceUsd,
          marketCapEth: m.marketCapEth,
          marketCapUsd: m.marketCapUsd,
          pairedPrincipalEth: m.pairedPrincipalEth,
          graduationProgressPct: m.graduationProgressPct,
          graduated: m.graduated,
        },
      };
    });
  });
}

export async function tokenInfo(token: Address): Promise<RouterInfo | null> {
  if (!ROUTER_ADDRESS) return null;
  const router = ROUTER_ADDRESS;
  return cached(`info:${token.toLowerCase()}`, 60_000, async () => {
    try {
      return (await chainClient().readContract({
        address: router,
        abi: routerAbi,
        functionName: "infoOf",
        args: [token],
      })) as RouterInfo;
    } catch {
      return null;
    }
  });
}

export function tokenSummary(token: Address): Promise<{ market: MarketSummary; fees: FeeSummary } | null> {
  return cached(`summary:${token.toLowerCase()}`, SUMMARY_TTL, async () => {
    const info = await tokenInfo(token);
    if (!info || !ROUTER_ADDRESS) return null;
    const client = chainClient();
    const [[curve], usd, escrow] = await Promise.all([
      readCurves([info.curve]),
      ethUsd(),
      client.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "feeEscrow" }) as Promise<Address>,
    ]);
    const [inEscrow, pending, onCurve, protocolShareBps] = await Promise.all([
      client.readContract({ address: escrow, abi: escrowAbi, functionName: "balanceOf", args: [info.splitter] }) as Promise<bigint>,
      client.readContract({ address: ROUTER_ADDRESS, abi: routerAbi, functionName: "pendingFees", args: [token] }) as Promise<bigint>,
      client.readContract({ address: info.curve, abi: curveAbi, functionName: "quoteFeeBalance" }).catch(() => 0n) as Promise<bigint>,
      client.readContract({ address: info.curve, abi: curveAbi, functionName: "protocolFeeShareBps" }).catch(() => 0n) as Promise<bigint>,
    ]);
    // Fees sit on the curve until Pons sweeps them; the creator's share is
    // whatever is left after the protocol's cut.
    const accruing = (onCurve * (10_000n - protocolShareBps)) / 10_000n;
    const m = marketOf(curve, usd);
    const market: MarketSummary = {
      token: info.token,
      curve: info.curve,
      deployer: info.creator,
      splitter: info.splitter,
      launchBlock: Number(info.launchBlock),
      launchedAt: new Date(Number(info.launchedAt) * 1000).toISOString(),
      developerBuy: info.developerBuy.toString(),
      name: info.name,
      symbol: info.symbol,
      logo: info.logo,
      description: info.description,
      priceEth: m.priceEth,
      priceUsd: m.priceUsd,
      marketCapEth: m.marketCapEth,
      marketCapUsd: m.marketCapUsd,
      graduated: m.graduated,
      graduationProgressPct: m.graduationProgressPct,
      pairedPrincipalEth: m.pairedPrincipalEth,
      graduationThresholdEth: wei(curve.threshold),
      launchSupply: wei(curve.launchSupply),
      ethUsd: usd,
      venue: m.graduated ? "pool" : "curve",
    };
    const fees: FeeSummary = {
      token: info.token,
      feeEscrow: escrow,
      recipient: info.splitter,
      inEscrowWei: inEscrow.toString(),
      pendingWei: pending.toString(),
      accruingWei: accruing.toString(),
    };
    return { market, fees };
  });
}

const BUY = parseAbiItem(
  "event CurveBuy(address indexed sender, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 snipeTax)",
);
const SELL = parseAbiItem(
  "event CurveSell(address indexed sender, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 snipeTax)",
);

const TRADES_WANTED = 60;
const CHUNK = 100_000n;
const MAX_CHUNKS = 24;

/**
 * Curve trades, newest first, scanned backwards from the head in block
 * windows until enough are found or the launch block is reached. Trades
 * after graduation happen in the pool and are not listed here.
 */
export function tokenTrades(token: Address): Promise<Trade[]> {
  return cached(`trades:${token.toLowerCase()}`, TRADES_TTL, async () => {
    const info = await tokenInfo(token);
    if (!info) return [];
    const client = chainClient();
    const head = await client.getBlockNumber();
    const floor = info.launchBlock;
    const found: { log: { blockNumber: bigint; transactionHash: `0x${string}`; logIndex: number }; side: "buy" | "sell"; tokens: bigint; quote: bigint; account: Address }[] = [];
    let to = head;
    for (let i = 0; i < MAX_CHUNKS && to >= floor && found.length < TRADES_WANTED; i++) {
      const from = to - CHUNK + 1n > floor ? to - CHUNK + 1n : floor;
      const [buys, sells] = await Promise.all([
        client.getLogs({ address: info.curve, event: BUY, fromBlock: from, toBlock: to }),
        client.getLogs({ address: info.curve, event: SELL, fromBlock: from, toBlock: to }),
      ]);
      for (const l of buys) found.push({ log: l, side: "buy", tokens: l.args.tokensOut!, quote: l.args.quoteIn!, account: l.args.recipient! });
      for (const l of sells) found.push({ log: l, side: "sell", tokens: l.args.tokensIn!, quote: l.args.quoteOut!, account: l.args.sender! });
      to = from - 1n;
    }
    found.sort((a, b) => (a.log.blockNumber === b.log.blockNumber ? b.log.logIndex - a.log.logIndex : Number(b.log.blockNumber - a.log.blockNumber)));
    const top = found.slice(0, TRADES_WANTED);
    const blocks = [...new Set(top.map((t) => t.log.blockNumber))];
    const stamps = new Map<bigint, number>();
    await Promise.all(
      blocks.map(async (n) => {
        const b = await client.getBlock({ blockNumber: n });
        stamps.set(n, Number(b.timestamp));
      }),
    );
    return top.map((t) => ({
      id: `${t.log.transactionHash}:${t.log.logIndex}`,
      venue: "curve" as const,
      side: t.side,
      tokenAmount: t.tokens.toString(),
      quoteAmount: t.quote.toString(),
      account: t.account,
      transactionHash: t.log.transactionHash,
      blockNumber: Number(t.log.blockNumber),
      timestamp: stamps.get(t.log.blockNumber) ?? 0,
    }));
  });
}

/**
 * Price points for the chart, derived from the same trades: one point per
 * trade inside the range, ETH per token. The route turns them into a market
 * cap with the live ETH/USD.
 */
export async function tokenChart(token: Address, range: ChartRange): Promise<ChartResponse | null> {
  const [trades, summary] = await Promise.all([tokenTrades(token), tokenSummary(token)]);
  if (!summary) return null;
  const now = Math.floor(Date.now() / 1000);
  const since = range === "all" ? 0 : now - RANGE_SECONDS[range];
  const inRange = trades.filter((t) => t.timestamp >= since).reverse();
  const points: ChartPoint[] = inRange.map((t) => {
    const tokens = Number(t.tokenAmount) / 1e18;
    const quote = Number(t.quoteAmount) / 1e18;
    return {
      t: t.timestamp,
      price: tokens > 0 ? quote / tokens : 0,
      blockNumber: t.blockNumber,
      volumeQuote: quote,
      tradeCount: 1,
    };
  });
  // Always end on the live price so the last point matches the summary.
  points.push({
    t: now,
    price: summary.market.priceEth,
    blockNumber: 0,
    volumeQuote: 0,
    tradeCount: 0,
  });
  return {
    token,
    range,
    intervalSeconds: RANGE_INTERVAL[range],
    ethUsd: summary.market.ethUsd,
    launchSupply: summary.market.launchSupply,
    points,
  };
}

export { ZERO };
