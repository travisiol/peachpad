/* eslint-disable @next/next/no-img-element */

/**
 * The peach in its ink frame with the hard 4px drop. `size` is the frame in
 * px; the mark inside is 80% of it, which is what the reference's 40/32 and
 * 64/48 pairs work out to.
 */
export function PeachMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  const inner = Math.round(size * 0.8);
  return (
    <span
      className={`relative flex items-center justify-center border-4 border-ink bg-cream shadow-[4px_4px_0_0_#1c1410] ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/logo.png"
        alt=""
        width={inner}
        height={inner}
        style={{ width: inner, height: inner, imageRendering: "pixelated" }}
        aria-hidden="true"
        draggable={false}
      />
    </span>
  );
}
