import type { TradesResponse } from "@/lib/pons";
import { findSampleLaunch, sampleTrades } from "@/lib/sample";
import { badToken, forward, ponsBase, unknownToken, type TokenContext } from "@/lib/ponsProxy";

export async function GET(_request: Request, ctx: TokenContext) {
  const { token } = await ctx.params;
  const bad = badToken(token);
  if (bad) return bad;

  const base = ponsBase();
  if (base) return forward(base, `${token}/trades`);

  const launch = findSampleLaunch(token);
  if (!launch) return unknownToken();

  const body: TradesResponse = { source: "sample", trades: sampleTrades(launch) };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
