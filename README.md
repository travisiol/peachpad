# Peach Pad

Launch middleware on Robinhood Chain. We don’t run a factory: a token
launched through Peach Pad goes live on Pons V2, the creator keeps 90% of
creator fees, the pad takes 10%, and optional tools (site, marketing,
utilities) are there when the project needs them.

Pixel launchpad, peach edition — `peachpad.fun`, `$PEACH`.

## Layout

```
src/         Next 16 site (app router, route handlers, wagmi)
contracts/   Hardhat package: PeachRouter, FeeSplitter, mocks, tests, fork scripts
```

## Run the site

```bash
npm install
npm run dev -- --port 3070
```

`npm run build` and `npm run lint` must both pass. `npm run logo` regenerates
the mark from the grid in `scripts/make-logo.mjs`.

## Contracts

```bash
cd contracts
npm install
npm test                       # 23 unit tests against a mock Pons
FORK_URL=https://rpc.mainnet.chain.robinhood.com npx hardhat run scripts/fork-check.ts
```

`PeachRouter.launch(params)` deploys a `FeeSplitter` for the creator,
launches the token on the real Pons V2 factory with the splitter as the
creator-fee recipient, and — when there is a developer buy — goes through
Pons’ own launch-and-buy forwarder so the buy is atomic and snipe-tax
exempt. `collectFees(token)` is open to anyone and pays 90% to the creator,
10% to the treasury. The router never holds fees or tokens.

The Pons interfaces in `contracts/contracts/interfaces/IPonsV2.sol` were
recovered from the deployed contracts and confirmed by replaying a real
launch on a fork (`scripts/trace-launch.ts`). `fork-check.ts` launches
through the router against the live factory on a fork and verifies the fee
recipient, the snipe-tax exemptions, the developer buy and a collect.

Creator fees accrue on the Pons curve and are swept into the Pons fee
escrow by Pons; a collect claims the escrow balance and splits it.

### Deploy

```bash
cd contracts
cp .env.example .env            # DEPLOYER_PRIVATE_KEY, TREASURY_ADDRESS, OWNER_ADDRESS
npm run deploy:robinhood
```

The script prints the router address and writes
`contracts/deployments/robinhood.json`. Put the address in the site’s
`NEXT_PUBLIC_PEACHPAD_ROUTER` and everything lights up: the launches list,
the token pages, the launch form.

Every compile re-exports the ABIs to `src/lib/abi/` so the site and the
contracts cannot drift.

## Routes

| Route | What |
| --- | --- |
| `/` | Landing: hero, launches, the model, builder tools, token, CTA |
| `/launch/` | Launch form → router → Pons V2, plus a collect-fees box |
| `/token/?a=0x…` | One launch: market, chart, trades, owner, creator fees |
| `GET /api/launches?limit=` | Launches from the router, market from the curves |
| `GET /api/pons/v2/:token/summary` | Market + fee summary |
| `GET /api/pons/v2/:token/trades` | Curve trades from the chain logs |
| `GET /api/pons/v2/:token/chart?range=` | Price points, `5m` `1h` `6h` `1d` `all` |
| `POST /api/upload` | Token image → IPFS (needs `PONS_IPFS_UPLOAD_URL`) |

All data is read straight from Robinhood Chain — the router for the list
and the metadata, the Pons curve for reserves and graduation, the fee
escrow for pending fees. ETH/USD comes from Coinbase’s public spot price;
without it the site shows ETH figures.

## Configuration

See `.env.example`. With `NEXT_PUBLIC_PEACHPAD_ROUTER` unset the launches
list is empty and the Launch button is disabled; with `NEXT_PUBLIC_PEACH_TOKEN`
unset the Token section shows `TBA`.

## Stack

Next 16, Tailwind 4, wagmi 3 + viem, framer-motion; Hardhat 2 +
OpenZeppelin 5 for the contracts. Jersey 15 (OFL) is bundled in
`src/app/fonts/` and served through `next/font/local`.
