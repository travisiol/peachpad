"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  value: string;
  className?: string;
  /** `"icon"` renders the small clipboard glyph; `"label"` a pixel button. */
  variant?: "icon" | "label";
  label?: string;
  disabled?: boolean;
};

export function CopyButton({
  value,
  className = "",
  variant = "label",
  label = "Copy",
  disabled = false,
}: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
      } catch {
        /* clipboard blocked — nothing to show */
      }
    },
    [value, disabled],
  );

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={copy}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center text-ink/40 transition-colors hover:text-peach ${className}`}
        aria-label="Copy contract address"
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? (
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 8.5l3 3 7-7" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="5.5" y="5.5" width="8" height="8" rx="0.5" />
            <path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button type="button" onClick={copy} disabled={disabled} className={`btn-secondary ${className}`}>
      {copied ? "Copied" : label}
    </button>
  );
}
