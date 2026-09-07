import Link from "next/link";
import { site, percent } from "@/lib/site";
import { Reveal } from "@/components/Reveal";

export function Cta() {
  return (
    <section id="cta" className="relative scroll-mt-24 overflow-hidden px-5 py-16 sm:px-8 sm:py-24">
      <Reveal className="pixel-panel-peach relative mx-auto max-w-5xl px-6 py-14 text-center sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute left-3 top-3 h-3 w-3 bg-white" />
        <div className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 bg-deep-peach" />
        <div className="pointer-events-none absolute right-3 top-3 h-2 w-2 bg-peach-soft" />
        <div className="relative">
          <h2 className="font-display text-2xl text-white sm:text-4xl md:text-5xl">
            Launch where liquidity lives. Grow with us.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/90 sm:text-base">
            Deploy through {site.wordmark[0]} onto {site.firstPad} today. Keep{" "}
            {percent.creator} of creator fees. Add the tools when you’re ready to
            push for a real outcome.
          </p>
          <Link href="/launch/" className="btn-secondary mt-8">
            Launch on {site.firstPad}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
