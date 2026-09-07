"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LaunchesResponse } from "@/lib/pons";
import { site } from "@/lib/site";
import { Reveal } from "@/components/Reveal";
import { LaunchCard } from "@/components/LaunchCard";
import { SampleNote } from "@/components/SampleNote";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: LaunchesResponse };

export function Launches() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    // Trailing slash: the app serves every route that way, and a bare
    // path would cost a 308 on each poll.
    fetch("/api/launches/?limit=24")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as LaunchesResponse;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({ status: "error", message: e instanceof Error ? e.message : "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      id="launches"
      className="relative scroll-mt-24 overflow-hidden border-y-4 border-ink bg-cream-deep py-20 sm:py-28"
    >
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="pixel-badge mx-auto mb-5 w-fit">Launches</p>
          <h2 className="font-display text-2xl text-ink sm:text-4xl md:text-[2.5rem]">
            Launched through {site.wordmark[0]}
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-ink/65 sm:text-base">
            Live on {site.firstPad} via our middleware. Trade on their markets,
            manage fees and tools here.
          </p>
        </Reveal>

        <div className="mt-12">
          {state.status === "loading" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse border-4 border-ink/15 bg-white" />
              ))}
            </div>
          ) : state.status === "error" ? (
            <p className="mx-auto w-fit border-4 border-ink bg-white px-4 py-3 text-sm text-ink/60">
              Could not load launches ({state.message}).
            </p>
          ) : state.data.launches.length === 0 ? (
            <p className="mx-auto w-fit border-4 border-ink bg-white px-4 py-3 text-sm text-ink/60">
              Nothing launched yet. Yours could be first.
            </p>
          ) : (
            <>
              {state.data.source === "sample" ? (
                <div className="mb-4 flex justify-center">
                  <SampleNote what="Sample launches" />
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {state.data.launches.map((l, i) => (
                  <Reveal key={l.token} delay={Math.min(i, 5) * 0.05}>
                    <LaunchCard launch={l} />
                  </Reveal>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-10 text-center">
          <Link href="/launch/" className="btn-secondary inline-flex">
            Launch a token
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
