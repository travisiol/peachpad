/**
 * Brand and copy that spells the name out. Everything that says "Peach" or
 * "$PEACH" reads from here, so a rename is a one-file change.
 */
export const site = {
  name: "Peach Pad",
  /** The two halves of the wordmark: `Peach` in ink, `Pad` in peach. */
  wordmark: ["Peach", "Pad"] as const,
  domain: "peachpad.fun",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://peachpad.fun",
  ticker: "$PEACH",
  tokenName: "Peach Pad Token",
  tagline: "Launch middleware & success tools",
  description:
    "We don’t run a factory. Peach Pad launches tokens on proven platforms like Pons, takes 10% of creator fees, and offers optional tools (sites, marketing, utilities) to raise your odds of success.",
  keywords: ["Peach Pad", "Web3", "launchpad", "crypto", "token launch"],
  x: process.env.NEXT_PUBLIC_X_URL ?? "https://x.com/Peachpad_",
  /** Fee split, in basis points of creator fees. */
  padShareBps: 1000,
  creatorShareBps: 9000,
  /** Pons V2 graduation threshold in ETH. Display only; Pons is the source. */
  graduationEth: 4.2,
  tradeFeePct: "1.00%",
  launchFeeEth: process.env.NEXT_PUBLIC_LAUNCH_FEE_ETH ?? "0.0005",
  firstPad: "Pons",
} as const;

export const percent = {
  creator: `${site.creatorShareBps / 100}%`,
  pad: `${site.padShareBps / 100}%`,
} as const;
