import Link from "next/link";
import type { Launch } from "@/lib/pons";
import {
  formatEth,
  formatGraduation,
  formatPriceUsd,
  formatUsdCompact,
  shortAddress,
} from "@/lib/format";
import { TokenLogo } from "@/components/TokenLogo";
import { CopyButton } from "@/components/CopyButton";

export function LaunchCard({ launch }: { launch: Launch }) {
  const m = launch.market;
  return (
    <Link
      href={`/token/?a=${launch.token}`}
      className="group flex flex-col border-4 border-ink bg-white p-3.5 shadow-[4px_4px_0_0_#1c1410] transition-transform duration-75 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#1c1410]"
    >
      <div className="flex items-center gap-3">
        <TokenLogo logo={launch.logo} symbol={launch.symbol} size={48} />
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-baseline gap-2">
            <p className="truncate font-display text-base text-ink group-hover:text-peach sm:text-lg">
              {launch.name}
            </p>
            <p className="shrink-0 text-xs uppercase tracking-wide text-ink/45">
              ${launch.symbol}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="ui-text text-xs text-ink/45">{shortAddress(launch.token)}</span>
            <CopyButton value={launch.token} variant="icon" />
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5 border-t-2 border-ink/10 pt-2.5 text-left">
        <Stat label="MC" value={formatUsdCompact(m.marketCapUsd)} />
        <Stat label="Price" value={formatPriceUsd(m.priceUsd)} />
        <Stat label="Curve" value={formatEth(m.pairedPrincipalEth)} />
        <Stat label="Grad" value={formatGraduation(m.graduationProgressPct, m.graduated)} />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="ui-text text-[10px] leading-none text-ink/40">{label}</p>
      <p className="mt-1 truncate font-display text-sm leading-tight text-ink">{value}</p>
    </div>
  );
}
