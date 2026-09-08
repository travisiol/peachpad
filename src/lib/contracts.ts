import type { Abi } from "viem";
import routerJson from "@/lib/abi/PeachRouter.json";
import splitterJson from "@/lib/abi/FeeSplitter.json";

/**
 * On-chain surface. Addresses come from the environment and are null until
 * deployed; the ABIs are exported by `contracts/` on every compile.
 */

function envAddress(value: string | undefined): `0x${string}` | null {
  const v = value?.trim();
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : null;
}

/** The Peach Pad router: launch → Pons V2 + per-token 90/10 splitter. */
export const ROUTER_ADDRESS = envAddress(process.env.NEXT_PUBLIC_PEACHPAD_ROUTER);

/** The pad's own token, shown in the Token section once it exists. */
export const PEACH_TOKEN_ADDRESS = envAddress(process.env.NEXT_PUBLIC_PEACH_TOKEN);

export const routerAbi = routerJson as Abi;
export const splitterAbi = splitterJson as Abi;
