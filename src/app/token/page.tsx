import type { Metadata } from "next";
import { Suspense } from "react";
import { site } from "@/lib/site";
import { TokenView } from "@/components/TokenView";

export const metadata: Metadata = {
  title: `Token - ${site.name}`,
  description: `A token launched through ${site.name} on ${site.firstPad}: market, trades and creator fees.`,
};

/** `/token/?a=0x…` — the address rides in the query, like the reference. */
export default function TokenPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100svh] items-center justify-center bg-cream text-sm text-ink/50">
          Loading token…
        </main>
      }
    >
      <TokenView />
    </Suspense>
  );
}
