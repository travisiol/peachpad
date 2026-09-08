import type { TradesResponse } from "@/lib/pons";
import { tokenInfo, tokenTrades } from "@/lib/market";
import { isAddress } from "@/lib/format";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  if (!isAddress(token)) {
    return Response.json({ ok: false, error: "token must be a 0x address" }, { status: 400 });
  }
  try {
    if (!(await tokenInfo(token))) {
      return Response.json({ ok: false, error: "unknown token" }, { status: 404 });
    }
    const body: TradesResponse = { trades: await tokenTrades(token) };
    return Response.json(body, { headers: { "cache-control": "public, max-age=15" } });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "chain unreachable" },
      { status: 502 },
    );
  }
}
