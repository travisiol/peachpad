import { isAddress } from "@/lib/format";

/**
 * Shared plumbing for /api/pons/v2/<token>/{summary,trades,chart}. Each
 * route either forwards to `${PONS_API_BASE}/<token>/<leaf>` or answers from
 * the sample set for a sample token. Anything else is a 404, never a guess.
 */

export function ponsBase(): string | null {
  const base = process.env.PONS_API_BASE?.trim();
  return base ? base.replace(/\/$/, "") : null;
}

export function badToken(token: string): Response | null {
  if (!isAddress(token)) {
    return Response.json({ ok: false, error: "token must be a 0x address" }, { status: 400 });
  }
  return null;
}

export async function forward(base: string, path: string, revalidate = 10): Promise<Response> {
  try {
    const res = await fetch(`${base}/${path}`, { next: { revalidate } });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
        "cache-control": `public, max-age=${revalidate}`,
      },
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "upstream unreachable" },
      { status: 502 },
    );
  }
}

export const unknownToken = () =>
  Response.json({ ok: false, error: "unknown token" }, { status: 404 });

export type TokenContext = { params: Promise<{ token: string }> };
