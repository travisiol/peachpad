"use client";

import { useSyncExternalStore } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { robinhoodChain } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

const noop = () => () => {};
/** false during SSR and hydration, true once the client owns the tree. */
const useMounted = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/**
 * Injected-wallet connect in the pixel style. Three states: no wallet,
 * wrong chain, connected. Nothing here sends a transaction.
 */
export function ConnectButton({ className = "" }: { className?: string }) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const mounted = useMounted();

  // Before hydration wagmi has no idea what the wallet is; render the
  // resting state so the server and client markup match.
  if (!mounted) {
    return (
      <button type="button" className={`btn-primary !px-4 !py-2 !text-xs ${className}`} disabled>
        Connect wallet
      </button>
    );
  }

  if (!isConnected || !address) {
    const injected = connectors[0];
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <button
          type="button"
          className="btn-primary !px-4 !py-2 !text-xs"
          disabled={!injected || isPending}
          onClick={() => injected && connect({ connector: injected })}
        >
          {isPending ? "Connecting…" : "Connect wallet"}
        </button>
        {!injected ? (
          <span className="text-xs text-ink/50">No injected wallet found</span>
        ) : error ? (
          <span className="text-xs text-deep-peach">{error.message.split("\n")[0]}</span>
        ) : null}
      </div>
    );
  }

  const wrongChain = chainId !== robinhoodChain.id;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {wrongChain ? (
        <button
          type="button"
          className="btn-primary !px-4 !py-2 !text-xs"
          disabled={switching}
          onClick={() => switchChain({ chainId: robinhoodChain.id })}
        >
          {switching ? "Switching…" : "Switch to Robinhood Chain"}
        </button>
      ) : null}
      <span className="ui-text inline-flex items-center gap-2 border-4 border-ink bg-white px-3 py-1.5 text-xs text-ink">
        <span className={`inline-block h-2 w-2 ${wrongChain ? "bg-deep-peach" : "bg-emerald-700"}`} />
        {shortAddress(address)}
      </span>
      <button type="button" className="btn-secondary !px-3 !py-1.5 !text-xs" onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  );
}
