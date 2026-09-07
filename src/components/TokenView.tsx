"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAccount, useWriteContract } from "wagmi";
import {
  CHART_RANGES,
  TOKEN_SUPPLY,
  type ChartRange,
  type ChartResponse,
  type SummaryResponse,
  type TradesResponse,
} from "@/lib/pons";
import { site, percent } from "@/lib/site";
import { explorer, ponsTradeUrl, robinhoodChain } from "@/lib/chain";
import { ROUTER_ADDRESS, routerAbi } from "@/lib/contracts";
import {
  formatDateTime,
  formatPct,
  formatPriceUsd,
  formatTokenAmount,
  formatUsdCompact,
  formatWei,
  formatWeiExact,
  isAddress,
  shortAddress,
} from "@/lib/format";
import { SAMPLE_ETH_USD } from "@/lib/sample";
import { TokenLogo } from "@/components/TokenLogo";
import { ConnectButton } from "@/components/ConnectButton";
import { SampleNote } from "@/components/SampleNote";
import { MarketCapChart } from "@/components/MarketCapChart";

const btnSmall = "btn-secondary !px-4 !py-2 !text-xs";

export function TokenView() {
  const params = useSearchParams();
  const a = (params.get("a") ?? "").trim();
  const token = isAddress(a) ? a : null;

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [trades, setTrades] = useState<TradesResponse | null>(null);
  const [chart, setChart] = useState<ChartResponse | null>(null);
  const [range, setRange] = useState<ChartRange>("1h");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [s, t] = await Promise.all([
          fetch(`/api/pons/v2/${token}/summary/`).then(async (r) => {
            if (!r.ok) throw new Error(r.status === 404 ? "Unknown token" : `HTTP ${r.status}`);
            return (await r.json()) as SummaryResponse;
          }),
          fetch(`/api/pons/v2/${token}/trades/`).then(async (r) =>
            r.ok ? ((await r.json()) as TradesResponse) : { source: "pons" as const, trades: [] },
          ),
        ]);
        if (cancelled) return;
        setSummary(s);
        setTrades(t);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/pons/v2/${token}/chart/?range=${range}`)
      .then(async (r) => (r.ok ? ((await r.json()) as ChartResponse) : null))
      .then((c) => {
        if (!cancelled) setChart(c);
      })
      .catch(() => {
        if (!cancelled) setChart(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, range]);

  if (!token) {
    return (
      <Shell>
        <p className="pixel-panel mx-auto max-w-md px-6 py-8 text-center text-sm text-ink/60">
          Missing token address. Open a launch from the{" "}
          <Link href="/#launches" className="text-peach underline-offset-2 hover:underline">
            launches list
          </Link>
          .
        </p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <p className="pixel-panel mx-auto max-w-md px-6 py-8 text-center text-sm text-ink/60">{error}</p>
      </Shell>
    );
  }

  if (!summary) {
    return (
      <main className="flex min-h-[100svh] items-center justify-center bg-cream text-sm text-ink/50">
        Loading token…
      </main>
    );
  }

  const m = summary.market;
  const fees = summary.fees;
  const isSample = summary.source === "sample";

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto grid w-full max-w-5xl gap-6 pt-12 lg:grid-cols-[1.4fr_1fr]"
      >
        <section className="space-y-4">
          {isSample ? <SampleNote what="Sample token" /> : null}

          <div className="pixel-panel px-5 py-6 sm:px-7">
            <div className="flex flex-wrap items-start gap-4">
              <TokenLogo logo={m.logo} symbol={m.symbol} size={64} />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-2xl text-peach sm:text-3xl">
                  {m.name} <span className="text-ink/40">${m.symbol}</span>
                </h1>
                <p className="ui-text mt-1 break-all text-xs text-ink/45">{m.token}</p>
                {m.description ? (
                  <p className="mt-3 text-sm leading-relaxed text-ink/65">{m.description}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={ponsTradeUrl(m.token)} target="_blank" rel="noopener noreferrer" className="btn-primary !px-4 !py-2 !text-xs">
                    Trade on {site.firstPad}
                    <span aria-hidden="true">↗</span>
                  </a>
                  <a href={explorer.address(m.token)} target="_blank" rel="noopener noreferrer" className={btnSmall}>
                    Explorer
                  </a>
                  <a href={site.x} target="_blank" rel="noopener noreferrer" className={btnSmall}>
                    X
                  </a>
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 border-t-4 border-ink/10 pt-5 sm:grid-cols-4">
              <Stat label="Price" value={formatPriceUsd(m.priceUsd)} />
              <Stat label="MCap" value={formatUsdCompact(m.marketCapUsd)} />
              <Stat label="Curve ETH" value={m.pairedPrincipalEth.toFixed(4)} />
              <Stat label="Graduate" value={m.graduated ? "Done" : `${Math.floor(m.graduationProgressPct)}%`} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              {CHART_RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={`border-2 border-ink px-3 py-1 font-display text-xs ${
                    range === r.key ? "bg-peach text-white" : "bg-white text-ink hover:bg-cream-deep"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <ChartPanel chart={chart} rangeLabel={CHART_RANGES.find((r) => r.key === range)?.label ?? ""} summary={summary} />
          </div>

          <div className="pixel-panel px-5 py-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="pixel-badge w-fit">Recent trades</p>
              <p className="ui-text text-[11px] text-ink/40">via {site.firstPad}</p>
            </div>
            {trades && trades.trades.length > 0 ? (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {trades.trades.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 pb-2 text-xs last:border-0">
                    <div className="min-w-0 text-left">
                      <span className={`font-display ${t.side === "buy" ? "text-emerald-700" : "text-deep-peach"}`}>
                        {t.side === "buy" ? "BUY" : "SELL"}
                      </span>
                      <span className="ml-2 text-ink/70">
                        {formatTokenAmount(t.tokenAmount)} · {formatWei(t.quoteAmount, 5)} ETH
                      </span>
                      <p className="ui-text mt-0.5 text-[10px] text-ink/40">
                        {shortAddress(t.account)} · {formatDateTime(t.timestamp)}
                      </p>
                    </div>
                    <a href={explorer.tx(t.transactionHash)} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] text-peach hover:underline">
                      tx
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink/50">No trades yet.</p>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="pixel-panel px-5 py-6">
            <p className="pixel-badge mb-4 w-fit">Owner</p>
            <p className="break-all font-display text-sm text-ink">{shortAddress(m.deployer)}</p>
            <p className="ui-text mt-1 break-all text-[11px] text-ink/40">{m.deployer}</p>
            {fees ? (
              <p className="ui-text mt-4 text-[11px] text-ink/40">Fee splitter {shortAddress(fees.recipient)}</p>
            ) : null}
          </div>

          <CreatorFees token={m.token} fees={fees} feesError={summary.feesError} />
        </aside>
      </motion.div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-cream px-5 py-12 sm:py-16">
      <div className="absolute left-4 top-4 z-20 flex gap-2 sm:left-8 sm:top-8">
        <Link href="/" className={btnSmall}>
          ← Home
        </Link>
        <Link href="/launch/" className={btnSmall}>
          Launch
        </Link>
      </div>
      <div className="pt-12">{children}</div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="ui-text text-[10px] text-ink/40">{label}</p>
      <p className="font-display text-sm text-ink">{value}</p>
    </div>
  );
}

function ChartPanel({
  chart,
  rangeLabel,
  summary,
}: {
  chart: ChartResponse | null;
  rangeLabel: string;
  summary: SummaryResponse;
}) {
  const m = summary.market;
  const series = useMemo(() => {
    if (!chart || chart.points.length === 0) return null;
    const last = chart.points[chart.points.length - 1];
    // ETH/USD is implied by the summary's USD price over the last chart
    // price; the sample set has no summary-vs-chart drift so it falls back
    // to its fixed rate.
    const ethUsd = last.price > 0 && m.priceUsd > 0 ? m.priceUsd / last.price : SAMPLE_ETH_USD;
    return chart.points.map((p) => ({ t: p.t, value: p.price * TOKEN_SUPPLY * ethUsd }));
  }, [chart, m.priceUsd]);

  const change =
    series && series.length > 1 && series[0].value > 0
      ? ((series[series.length - 1].value - series[0].value) / series[0].value) * 100
      : null;

  return (
    <div className="border-4 border-ink bg-white shadow-[4px_4px_0_0_#1c1410]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-4 border-ink px-4 py-3">
        <div>
          <p className="ui-text text-[10px] uppercase tracking-wide text-ink/40">Market cap</p>
          <p className="font-display text-2xl text-ink">{formatUsdCompact(m.marketCapUsd)}</p>
          {change !== null ? (
            <p className={`text-xs ${change < 0 ? "text-deep-peach" : "text-emerald-700"}`}>
              {formatPct(change)} {rangeLabel}
            </p>
          ) : null}
        </div>
        <p className="ui-text text-[11px] text-ink/40">
          via {site.firstPad} indexer{summary.source === "sample" ? " (sample)" : ""}
        </p>
      </div>
      {series ? (
        <MarketCapChart points={series} />
      ) : (
        <div className="flex h-[220px] items-center justify-center text-xs text-ink/40">
          {chart ? "No trades in this range." : "Loading chart…"}
        </div>
      )}
    </div>
  );
}

function CreatorFees({
  token,
  fees,
  feesError,
}: {
  token: string;
  fees: SummaryResponse["fees"];
  feesError: string | null;
}) {
  const { isConnected, chainId } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [status, setStatus] = useState<string | null>(null);

  const claimable = fees ? BigInt(fees.claimableForWallet || "0") : 0n;
  const toCreator = (claimable * BigInt(site.creatorShareBps)) / 10000n;
  const toPad = claimable - toCreator;
  const canCollect = ROUTER_ADDRESS !== null && isConnected && chainId === robinhoodChain.id && claimable > 0n;

  async function collect() {
    if (!ROUTER_ADDRESS) return;
    setStatus(null);
    try {
      const hash = await writeContractAsync({
        address: ROUTER_ADDRESS,
        abi: routerAbi,
        functionName: "collect",
        args: [token as `0x${string}`],
        chainId: robinhoodChain.id,
      });
      setStatus(`Submitted: ${hash}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message.split("\n")[0] : "Collect failed");
    }
  }

  return (
    <div className="pixel-panel px-5 py-6">
      <p className="pixel-badge mb-4 w-fit">Creator fees</p>
      <p className="text-xs text-ink/55">
        Pending on-chain (collect → {percent.creator} you / {percent.pad} pad)
      </p>
      {fees ? (
        <>
          <p className="mt-2 font-display text-2xl text-peach">{formatWeiExact(claimable)} ETH</p>
          <ul className="mt-3 space-y-1 text-xs text-ink/60">
            <li>You: {formatWeiExact(toCreator)} ETH</li>
            <li>Pad: {formatWeiExact(toPad)} ETH</li>
          </ul>
          <p className="mt-3 text-[11px] text-ink/45">
            {site.firstPad} indexed earned: {formatWeiExact(fees.earnedForToken)} ETH
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-deep-peach">{feesError ?? "Fee data unavailable."}</p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ConnectButton />
        {isConnected ? (
          <button type="button" className="btn-secondary !px-4 !py-2 !text-xs" disabled={!canCollect || isPending} onClick={collect}>
            {isPending ? "Confirm…" : "Collect"}
          </button>
        ) : null}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-ink/45">
        {ROUTER_ADDRESS === null
          ? "Collecting needs the router (NEXT_PUBLIC_PEACHPAD_ROUTER)."
          : "Connect the creator wallet to collect fees."}
      </p>
      {status ? <p className="ui-text mt-2 break-all text-[11px] text-ink/60">{status}</p> : null}
    </div>
  );
}
