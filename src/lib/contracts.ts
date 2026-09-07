/**
 * Everything on-chain that this front end can call. Both addresses come
 * from the environment and are null until deployed; every button that
 * would send a transaction checks for null and says so instead of
 * pretending. No placeholder address is ever rendered.
 */

function envAddress(value: string | undefined): `0x${string}` | null {
  const v = value?.trim();
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : null;
}

/** The Peach Pad middleware router: launch → Pons V2 + per-token 90/10 splitter. */
export const ROUTER_ADDRESS = envAddress(process.env.NEXT_PUBLIC_PEACHPAD_ROUTER);

/** The pad's own token, shown in the Token section once it exists. */
export const PEACH_TOKEN_ADDRESS = envAddress(process.env.NEXT_PUBLIC_PEACH_TOKEN);

export const routerAbi = [
  {
    type: "function",
    name: "launchFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "launch",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "description", type: "string" },
          { name: "logo", type: "string" },
          { name: "xUrl", type: "string" },
          { name: "telegramUrl", type: "string" },
          { name: "developerBuy", type: "uint256" },
        ],
      },
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "splitter", type: "address" },
    ],
  },
  {
    type: "function",
    name: "collect",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "toCreator", type: "uint256" },
      { name: "toPad", type: "uint256" },
    ],
  },
] as const;
