import type { NextRequest } from "next/server";
import type { ChartRange, ChartResponse } from "@/lib/pons";
import { findSampleLaunch, sampleChart } from "@/lib/sample";
import { badToken, forward, ponsBase, unknownToken, type TokenContext } from "@/lib/ponsProxy";

const RANGES: ChartRange[] = ["5m", "1h", "6h", "1d", "all"];

export async function GET(request: NextRequest, ctx: TokenContext) {
  const { token } = await ctx.params;
  const bad = badToken(token);
  if (bad) return bad;

  const wanted = request.nextUrl.searchParams.get("range") ?? "1h";
  const range: ChartRange = (RANGES as string[]).includes(wanted) ? (wanted as ChartRange) : "1h";

  const base = ponsBase();
  if (base) return forward(base, `${token}/chart?range=${range}`);

  const launch = findSampleLaunch(token);
  if (!launch) return unknownToken();

  const body: ChartResponse = { source: "sample", ...sampleChart(launch, range) };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
