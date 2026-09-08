import type { NextRequest } from "next/server";
import type { LaunchesResponse } from "@/lib/pons";
import { listLaunches } from "@/lib/market";

/**
 * GET /api/launches?limit=24 — tokens launched through the Peach Pad
 * router, newest first, with their curve market read live from the chain.
 */
export async function GET(request: NextRequest) {
  const raw = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "24", 10);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 100) : 24;
  try {
    const launches = await listLaunches(limit);
    const body: LaunchesResponse = { ok: true, launches };
    return Response.json(body, { headers: { "cache-control": "public, max-age=10" } });
  } catch (e) {
    return Response.json(
      { ok: false, launches: [], error: e instanceof Error ? e.message : "chain unreachable" },
      { status: 502 },
    );
  }
}
