# Peach Pad

Launch middleware on Robinhood Chain. We don’t run a factory: a token
launched through Peach Pad goes live on Pons V2, the creator keeps 90% of
creator fees, the pad takes 10%, and optional tools (site, marketing,
utilities) are there when the project needs them.

Pixel launchpad, peach edition — `peachpad.fun`, `$PEACH`.

## Run

```bash
npm install
npm run dev -- --port 3070
```

`npm run build` and `npm run lint` must both pass. `npm run logo` regenerates
the mark (`public/logo.png`, the favicon and the apple icon) from the grid in
`scripts/make-logo.mjs`.

## Routes

| Route | What |
| --- | --- |
| `/` | Landing: hero, launches, the model, builder tools, token, CTA |
| `/launch/` | Launch form → router → Pons V2, plus a collect-fees box |
| `/token/?a=0x…` | One launch: market, chart, trades, owner, creator fees |
| `GET /api/launches?limit=` | Tokens launched through the router |
| `GET /api/pons/v2/:token/summary` | Market + fee summary |
| `GET /api/pons/v2/:token/trades` | Recent trades |
| `GET /api/pons/v2/:token/chart?range=` | Price points, `5m` `1h` `6h` `1d` `all` |
| `POST /api/upload` | Token image → Pons IPFS (501 until configured) |

## What is and isn’t live

Nothing is deployed. Every on-chain address comes from the environment (see
`.env.example`) and is `null` until set:

- **`NEXT_PUBLIC_PEACHPAD_ROUTER`** — the middleware contract. While unset,
  Launch and Collect are disabled and say why.
- **`NEXT_PUBLIC_PEACH_TOKEN`** — the pad’s token. While unset, the Token
  section shows *not deployed* instead of a contract address.
- **`PEACHPAD_INDEXER_URL`** / **`PONS_API_BASE`** — data. While unset, the
  API serves a bundled sample set and flags every response
  `source: "sample"`; the UI shows a *sample data* note next to those
  numbers. Sample addresses are all visibly synthetic `0x0000…`.

## Stack

Next 16 (app router, route handlers, file-based metadata), Tailwind 4,
wagmi 3 + viem, framer-motion. Jersey 15 (OFL) is bundled in
`src/app/fonts/` and served through `next/font/local`, so neither the build
nor the browser talks to Google Fonts. No other runtime dependency.
