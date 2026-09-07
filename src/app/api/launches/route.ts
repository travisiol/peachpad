import type { NextRequest } from "next/server";
import type { Launch, LaunchesResponse } from "@/lib/pons";
import { SAMPLE_LAUNCHES } from "@/lib/sample";

/**
 * GET /api/launches?limit=24
 *
 * Tokens launched through the Peach Pad router. With PEACHPAD_INDEXER_URL
 * set the indexer answers; otherwise the bundled sample set does, flagged
 * `source: "sample"` so the page can say so beside the cards.
 */
export async function GET(request: NextRequest) {
  const raw = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "24", 10);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 100) : 24;

  const upstream = process.env.PEACHPAD_INDEXER_URL?.trim();
  if (upstream) {
    try {
      const url = new URL(upstream);
      url.searchParams.set("limit", String(limit));
      const res = await fetch(url, { next: { revalidate: 15 } });
      if (!res.ok) {
        return Response.json(
          { ok: false, source: "indexer", launches: [], error: `indexer HTTP ${res.status}` },
          { status: 502 },
        );
      }
      const data = (await res.json()) as { launches?: Launch[] };
      const body: LaunchesResponse = {
        ok: true,
        source: "indexer",
        launches: Array.isArray(data.launches) ? data.launches.slice(0, limit) : [],
      };
      return Response.json(body, { headers: { "cache-control": "public, max-age=15" } });
    } catch (e) {
      return Response.json(
        {
          ok: false,
          source: "indexer",
          launches: [],
          error: e instanceof Error ? e.message : "indexer unreachable",
        },
        { status: 502 },
      );
    }
  }

  const body: LaunchesResponse = {
    ok: true,
    source: "sample",
    launches: SAMPLE_LAUNCHES.slice(0, limit),
  };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
