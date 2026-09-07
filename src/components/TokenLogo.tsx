/* eslint-disable @next/next/no-img-element */
import { logoUrl } from "@/lib/pons";

type Props = {
  logo: string | null | undefined;
  symbol: string;
  /** Square size in px. Cards use 48, the token page 64. */
  size?: number;
  className?: string;
};

/**
 * A launch's image, or — when it has none — its first letter on cream in
 * the pixel face. The sample set has no images on purpose: nothing borrowed,
 * nothing invented.
 */
export function TokenLogo({ logo, symbol, size = 48, className = "" }: Props) {
  const url = logoUrl(logo);
  const border = size >= 64 ? "border-4" : "border-2";
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 ${border} border-ink bg-cream-deep object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center ${border} border-ink bg-cream-deep font-display text-peach ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
    >
      {symbol.slice(0, 1).toUpperCase()}
    </span>
  );
}
