import { site } from "@/lib/site";
import { PEACH_TOKEN_ADDRESS } from "@/lib/contracts";
import { explorer } from "@/lib/chain";
import { Reveal } from "@/components/Reveal";
import { PeachMark } from "@/components/PeachMark";
import { CopyButton } from "@/components/CopyButton";

/** The pad's own token. The CA reads TBA until NEXT_PUBLIC_PEACH_TOKEN is set. */
export function TokenSection() {
  const address = PEACH_TOKEN_ADDRESS;
  return (
    <section id="token" className="relative scroll-mt-24 overflow-hidden px-5 py-16 sm:px-8 sm:py-24">
      <div className="relative mx-auto max-w-3xl">
        <Reveal className="pixel-panel relative px-6 py-10 text-center sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute left-3 top-3 h-3 w-3 bg-peach" />
          <div className="pointer-events-none absolute bottom-3 right-3 h-2 w-2 bg-peach-soft" />

          <p className="pixel-badge mx-auto mb-5 w-fit">Token</p>
          <div className="mx-auto mb-5 flex justify-center">
            <PeachMark size={64} />
          </div>
          <h2 className="font-display text-2xl text-ink sm:text-3xl md:text-4xl">{site.tokenName}</h2>
          <p className="mt-2 font-display text-lg text-peach sm:text-xl">{site.ticker}</p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink/65 sm:text-base">
            Official {site.ticker} contract on Robinhood Chain. Always verify the
            CA below before buying.
          </p>

          <div className="mt-8 text-left">
            <p className="mb-2 font-display text-xs text-ink/50">Contract Address (CA)</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <div className="flex-1 overflow-x-auto border-4 border-ink bg-cream-deep px-3 py-3 font-display text-xs text-ink/70 sm:text-sm">
                <code className="whitespace-nowrap">{address ?? "TBA"}</code>
              </div>
              {address ? (
                <CopyButton value={address} className="shrink-0 !px-4 !py-3 !text-xs" />
              ) : null}
            </div>
            {address ? (
              <a
                href={explorer.address(address)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block font-display text-xs text-peach underline-offset-2 hover:underline"
              >
                View on explorer
              </a>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
