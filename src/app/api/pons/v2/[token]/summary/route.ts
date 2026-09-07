import type { SummaryResponse } from "@/lib/pons";
import { findSampleLaunch, sampleSummary } from "@/lib/sample";
import { badToken, forward, ponsBase, unknownToken, type TokenContext } from "@/lib/ponsProxy";

export async function GET(_request: Request, ctx: TokenContext) {
  const { token } = await ctx.params;
  const bad = badToken(token);
  if (bad) return bad;

  const base = ponsBase();
  if (base) return forward(base, `${token}/summary`);

  const launch = findSampleLaunch(token);
  if (!launch) return unknownToken();

  const { market, fees } = sampleSummary(launch);
  const body: SummaryResponse = { ok: true, source: "sample", market, fees, feesError: null };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
