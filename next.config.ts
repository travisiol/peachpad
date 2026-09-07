import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The reference pad serves /launch/ and /token/ with a trailing slash and
  // links to them that way; keep the URL shape identical.
  trailingSlash: true,
  images: {
    // Token logos come back from the Pons IPFS gateway; nothing else is
    // remote. Plain <img> is used for them anyway (see TokenLogo), this is
    // only here so next/image can be adopted later without a config change.
    remotePatterns: [
      { protocol: "https", hostname: "www.ponsfamily.com" },
    ],
  },
};

export default nextConfig;
