/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { parseEther } from "viem";
import { useAccount, useBalance, useReadContract, useWriteContract } from "wagmi";
import { site, percent } from "@/lib/site";
import { ROUTER_ADDRESS, routerAbi } from "@/lib/contracts";
import { robinhoodChain } from "@/lib/chain";
import { isAddress } from "@/lib/format";
import { ConnectButton } from "@/components/ConnectButton";
import { TokenLogo } from "@/components/TokenLogo";

const LINK_RE = /(https?:\/\/|www\.|t\.me\/|\.(com|io|xyz|fun|app|org|net)\b)/i;

type Fields = {
  name: string;
  ticker: string;
  description: string;
  x: string;
  telegram: string;
  devBuy: string;
  feeRecipient: string;
  creatorTaxBps: string;
};

const EMPTY: Fields = {
  name: "",
  ticker: "",
  description: "",
  x: "",
  telegram: "",
  devBuy: "0",
  feeRecipient: "",
  creatorTaxBps: "0",
};

function validate(f: Fields) {
  const errors: Partial<Record<keyof Fields, string>> = {};
  if (!f.name.trim()) errors.name = "Required";
  else if (f.name.length > 32) errors.name = "32 characters max";
  if (!f.ticker.trim()) errors.ticker = "Required";
  else if (!/^[A-Z0-9]{1,10}$/.test(f.ticker)) errors.ticker = "A–Z and 0–9 only";
  if (f.description.length > 256) errors.description = "256 characters max";
  else if (LINK_RE.test(f.description)) errors.description = "No links in the description";
  if (f.devBuy.trim() && !/^\d*\.?\d*$/.test(f.devBuy)) errors.devBuy = "Decimal ETH amount";
  if (f.feeRecipient.trim() && !isAddress(f.feeRecipient.trim()))
    errors.feeRecipient = "Must be a 0x address";
  const bps = Number.parseInt(f.creatorTaxBps || "0", 10);
  if (!Number.isFinite(bps) || bps < 0 || bps > 500) errors.creatorTaxBps = "0 to 500 bps";
  return errors;
}

export function LaunchForm() {
  const [f, setF] = useState<Fields>(EMPTY);
  const [advanced, setAdvanced] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  // One object URL per picked file; revoked when the file changes or the
  // form unmounts.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const [collectToken, setCollectToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const { data: balance } = useBalance({ address, chainId: robinhoodChain.id });
  const { data: feeOnChain } = useReadContract({
    address: ROUTER_ADDRESS ?? undefined,
    abi: routerAbi,
    functionName: "launchFee",
    chainId: robinhoodChain.id,
    query: { enabled: ROUTER_ADDRESS !== null },
  });
  const { writeContractAsync, isPending } = useWriteContract();

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const errors = useMemo(() => validate(f), [f]);
  const valid = Object.keys(errors).length === 0;
  const onChain = isConnected && chainId === robinhoodChain.id;
  const routerLive = ROUTER_ADDRESS !== null;

  const feeEth = feeOnChain !== undefined ? formatEthFromWei(feeOnChain) : site.launchFeeEth;

  const blocker = !routerLive
    ? `Router not deployed — set NEXT_PUBLIC_PEACHPAD_ROUTER`
    : !isConnected
      ? "Connect a wallet to launch"
      : !onChain
        ? "Switch to Robinhood Chain"
        : !valid
          ? "Fix the fields above"
          : null;

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: k === "ticker" ? e.target.value.toUpperCase() : e.target.value }));

  const setMax = () => {
    if (!balance) return;
    // Leave the launch fee plus a little gas behind.
    const spare = balance.value - parseEther(feeEth) - parseEther("0.0005");
    setF((prev) => ({ ...prev, devBuy: spare > 0n ? formatEthFromWei(spare, 4) : "0" }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (blocker || !ROUTER_ADDRESS) return;
    setStatus(null);
    try {
      let logo = "";
      if (file) {
        const body = new FormData();
        body.append("file", file);
        const up = await fetch("/api/upload/", { method: "POST", body });
        const json = (await up.json()) as { ok?: boolean; uri?: string; error?: string };
        if (!up.ok || !json.uri) throw new Error(json.error ?? `upload HTTP ${up.status}`);
        logo = json.uri;
      }
      const devBuy = parseEther(f.devBuy.trim() || "0");
      const hash = await writeContractAsync({
        address: ROUTER_ADDRESS,
        abi: routerAbi,
        functionName: "launch",
        args: [
          {
            name: f.name.trim(),
            symbol: f.ticker.trim(),
            description: f.description.trim(),
            logo,
            xUrl: f.x.trim(),
            telegramUrl: f.telegram.trim(),
            developerBuy: devBuy,
          },
        ],
        value: parseEther(feeEth) + devBuy,
        chainId: robinhoodChain.id,
      });
      setStatus(`Submitted: ${hash}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message.split("\n")[0] : "Launch failed");
    }
  }

  async function onCollect() {
    if (!ROUTER_ADDRESS || !isAddress(collectToken.trim())) return;
    setStatus(null);
    try {
      const hash = await writeContractAsync({
        address: ROUTER_ADDRESS,
        abi: routerAbi,
        functionName: "collect",
        args: [collectToken.trim() as `0x${string}`],
        chainId: robinhoodChain.id,
      });
      setStatus(`Collect submitted: ${hash}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message.split("\n")[0] : "Collect failed");
    }
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-cream px-5 py-16">
      <div className="absolute left-4 top-4 z-20 sm:left-8 sm:top-8">
        <Link href="/" className="btn-secondary !px-4 !py-2 !text-xs">
          ← Home
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto grid w-full max-w-5xl gap-6 pt-10 lg:grid-cols-[1fr_280px]"
      >
        <form className="pixel-panel relative px-6 py-8 sm:px-8 sm:py-10" noValidate onSubmit={onSubmit}>
          <div className="pointer-events-none absolute left-3 top-3 h-3 w-3 bg-peach" />

          <div className="mb-6 flex items-center gap-3">
            <img
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10"
              style={{ imageRendering: "pixelated" }}
              aria-hidden="true"
              draggable={false}
            />
            <div>
              <h1 className="font-display text-2xl text-peach sm:text-3xl">Launch token</h1>
              <p className="mt-1 text-xs text-ink/55">
                Via {site.name} → {site.firstPad} V2 · creator fees {percent.creator} you /{" "}
                {percent.pad} pad
              </p>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <ConnectButton />
            <span className={`text-xs ${routerLive ? "text-ink/50" : "text-deep-peach"}`}>
              {routerLive ? `${site.firstPad} gate open` : "Router not deployed"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={errors.name}>
              <input className="pixel-input" maxLength={32} placeholder="Token name" value={f.name} onChange={set("name")} />
            </Field>
            <Field label="Ticker" error={errors.ticker}>
              <input className="pixel-input uppercase" maxLength={10} placeholder="SYMBOL" value={f.ticker} onChange={set("ticker")} />
            </Field>
          </div>

          <Field label="Description" error={errors.description} className="mt-4">
            <textarea
              className="pixel-input min-h-[88px] resize-y"
              maxLength={256}
              placeholder="Short description (no links)"
              value={f.description}
              onChange={set("description")}
            />
            <span className="mt-1 block text-right text-[10px] text-ink/40">{f.description.length}/256</span>
          </Field>

          <div className="mt-4 text-left">
            <span className="mb-2 block font-display text-xs text-ink/70">Token image</span>
            <label className="flex cursor-pointer flex-col items-center justify-center border-4 border-dashed border-ink/30 bg-cream-deep px-4 py-8 transition-colors hover:border-ink hover:bg-white">
              {preview ? (
                <img src={preview} alt="" className="h-20 w-20 border-2 border-ink object-cover" />
              ) : (
                <span className="font-display text-xs text-ink/45">Click to upload</span>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="mt-2 text-xs text-ink/45">
              {file ? `${file.name} · ` : ""}Uploaded via {site.firstPad} IPFS
            </p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="X profile">
              <input className="pixel-input" placeholder="x.com/handle" value={f.x} onChange={set("x")} />
            </Field>
            <Field label="Telegram">
              <input className="pixel-input" placeholder="t.me/community" value={f.telegram} onChange={set("telegram")} />
            </Field>
          </div>

          <div className="mt-4 text-left">
            <span className="mb-2 block font-display text-xs text-ink/70">Paired asset</span>
            <div className="pixel-input flex items-center justify-between !py-3">
              <span className="font-display text-sm">
                ETH{" "}
                <span className="font-sans text-xs font-normal normal-case tracking-normal text-ink/45">
                  (later more available)
                </span>
              </span>
            </div>
            <p className="mt-2 text-xs text-ink/45">Graduates once the curve raises {site.graduationEth} ETH.</p>
          </div>

          <Field label="Developer buy" error={errors.devBuy} className="mt-4">
            <div className="flex gap-2">
              <input className="pixel-input" inputMode="decimal" placeholder="0.00" value={f.devBuy} onChange={set("devBuy")} />
              <button type="button" className="btn-secondary shrink-0 !px-3 !py-2 !text-xs" onClick={setMax} disabled={!balance}>
                Max
              </button>
            </div>
            <p className="mt-2 text-xs text-ink/45">
              Bought in the same launch transaction (atomic via {site.firstPad} launch-and-buy).
            </p>
          </Field>

          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            aria-expanded={advanced}
            className="mt-6 flex w-full items-center justify-between border-4 border-ink bg-cream-deep px-4 py-3 font-display text-xs uppercase tracking-wide"
          >
            Advanced<span aria-hidden="true">{advanced ? "−" : "+"}</span>
          </button>
          {advanced ? (
            <div className="grid gap-4 border-4 border-t-0 border-ink bg-white px-4 py-4 sm:grid-cols-2">
              <Field label="Fee recipient" error={errors.feeRecipient}>
                <input className="pixel-input" placeholder="Defaults to the launching wallet" value={f.feeRecipient} onChange={set("feeRecipient")} />
              </Field>
              <Field label="Creator tax (bps)" error={errors.creatorTaxBps}>
                <input className="pixel-input" inputMode="numeric" placeholder="0" value={f.creatorTaxBps} onChange={set("creatorTaxBps")} />
                <span className="mt-1 block text-[10px] text-ink/40">0–500 · on top of the {site.tradeFeePct} trade fee</span>
              </Field>
            </div>
          ) : null}

          <button type="submit" className="btn-primary mt-6 w-full !py-4" disabled={blocker !== null || isPending}>
            {isPending ? "Confirm in wallet…" : `Launch · ${feeEth} ETH`}
          </button>
          {blocker ? <p className="ui-text mt-2 text-center text-[11px] text-ink/50">{blocker}</p> : null}
          {status ? <p className="ui-text mt-2 break-all text-center text-[11px] text-ink/60">{status}</p> : null}

          <div className="mt-8 border-t-4 border-ink pt-6 text-left">
            <p className="font-display text-xs text-ink/60">Collect creator fees</p>
            <p className="mt-1 text-xs text-ink/45">
              Anyone can trigger. Pays {percent.pad} to {site.wordmark[0]} treasury, {percent.creator} to the
              launch creator.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input className="pixel-input flex-1" placeholder="0x token address" value={collectToken} onChange={(e) => setCollectToken(e.target.value)} />
              <button
                type="button"
                className="btn-secondary shrink-0 !px-4 !py-3 !text-xs"
                disabled={!routerLive || !onChain || !isAddress(collectToken.trim()) || isPending}
                onClick={onCollect}
              >
                Collect
              </button>
            </div>
            {!routerLive ? (
              <p className="ui-text mt-2 text-[11px] text-ink/45">Needs the router too.</p>
            ) : null}
          </div>
        </form>

        <aside className="pixel-panel h-fit px-5 py-6 lg:sticky lg:top-24">
          <div className="flex items-center gap-3 border-b-4 border-ink pb-4">
            {preview ? (
              <img src={preview} alt="" className="h-12 w-12 border-4 border-ink object-cover" />
            ) : f.ticker ? (
              <TokenLogo logo={null} symbol={f.ticker} size={48} />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center border-4 border-ink bg-cream-deep font-display text-xs text-ink/40">?</div>
            )}
            <div className="min-w-0 text-left">
              <p className="truncate font-display text-sm text-ink">{f.name.trim() || "Your token"}</p>
              <p className="truncate text-xs uppercase text-ink/45">{f.ticker || "ticker"}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-3 text-left text-sm">
            <Row k="Launch fee">
              <span className="ui-text font-medium">{feeEth} ETH</span>
            </Row>
            <Row k="Paired with">
              <span className="text-right text-xs leading-snug">
                ETH<br />
                <span className="text-ink/40">(later more)</span>
              </span>
            </Row>
            <Row k="Trade fee">{site.tradeFeePct}</Row>
            <Row k="Graduation">{site.graduationEth} ETH</Row>
            <Row k="Liquidity">Locked</Row>
            <Row k="Creator fees">
              <span className="text-right text-xs leading-snug">
                {percent.creator} you<br />
                {percent.pad} pad
              </span>
            </Row>
          </dl>
        </aside>
      </motion.div>
    </main>
  );
}

function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-left ${className}`}>
      <span className="mb-2 flex items-baseline justify-between font-display text-xs text-ink/70">
        {label}
        {error ? <span className="ui-text text-[10px] font-medium normal-case text-deep-peach">{error}</span> : null}
      </span>
      {children}
    </label>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink/50">{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function formatEthFromWei(wei: bigint, digits = 4): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, "0").slice(0, digits).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
