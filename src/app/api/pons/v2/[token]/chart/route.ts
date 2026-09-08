import type { NextRequest } from "next/server";
import type { ChartRange } from "@/lib/pons";
import { tokenChart } from "@/lib/market";
import { isAddress } from "@/lib/format";

type Ctx = { params: Promise<{ token: string }> };

const RANGES: ChartRange[] = ["5m", "1h", "6h", "1d", "all"];

export async function GET(request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  if (!isAddress(token)) {
    return Response.json({ ok: false, error: "token must be a 0x address" }, { status: 400 });
  }
  const wanted = request.nextUrl.searchParams.get("range") ?? "1h";
  const range: ChartRange = (RANGES as string[]).includes(wanted) ? (wanted as ChartRange) : "1h";
  try {
    const chart = await tokenChart(token, range);
    if (!chart) return Response.json({ ok: false, error: "unknown token" }, { status: 404 });
    return Response.json(chart, { headers: { "cache-control": "public, max-age=15" } });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "chain unreachable" },
      { status: 502 },
    );
  }
}
