/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef } from "react";

type Peach = {
  left: number;
  top: number;
  z: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  fx: number;
  fy: number;
  amp: number;
  rotate: number;
  flip?: boolean;
};

// Positions are the reference layout verbatim: two big fruit anchoring the
// left and right edges, a row of mid-size ones along the bottom, and a
// scatter of faint small ones up top where the headline sits.
const PEACHES: Peach[] = [
  { left: -4, top: 70, z: 3, size: 276, opacity: 0.72, duration: 9, delay: 0, fx: 8, fy: -14, amp: 6, rotate: -28 },
  { left: 6, top: 32, z: 2, size: 168, opacity: 1, duration: 7.5, delay: 0.2, fx: 10, fy: -16, amp: 8, rotate: -18 },
  { left: 10, top: 52, z: 1, size: 84, opacity: 0.41, duration: 12.5, delay: 2, fx: -6, fy: -10, amp: 4, rotate: 15 },
  { left: 4, top: 88, z: 2, size: 132, opacity: 0.92, duration: 7.8, delay: 0.5, fx: -8, fy: -14, amp: 9, rotate: -32, flip: true },
  { left: 96, top: 20, z: 3, size: 252, opacity: 0.68, duration: 10.5, delay: 0.4, fx: -10, fy: -14, amp: 5, rotate: 32, flip: true },
  { left: 94, top: 76, z: 3, size: 240, opacity: 0.72, duration: 8.5, delay: 1.1, fx: 8, fy: -12, amp: 7, rotate: 18 },
  { left: 28, top: 90, z: 2, size: 120, opacity: 0.88, duration: 10, delay: 1.8, fx: 10, fy: -12, amp: 5, rotate: -8 },
  { left: 52, top: 94, z: 2, size: 144, opacity: 0.9, duration: 8.8, delay: 0.35, fx: 9, fy: -10, amp: 4, rotate: -6 },
  { left: 72, top: 88, z: 2, size: 132, opacity: 0.95, duration: 9, delay: 1.4, fx: 8, fy: -14, amp: 6, rotate: 12 },
  { left: 14, top: 14, z: 1, size: 72, opacity: 0.34, duration: 13, delay: 1.4, fx: 5, fy: -8, amp: 3, rotate: -30 },
  { left: 78, top: 12, z: 1, size: 60, opacity: 0.34, duration: 13, delay: 1, fx: -5, fy: -10, amp: 3, rotate: -25 },
  { left: 32, top: 30, z: 1, size: 84, opacity: 0.34, duration: 11, delay: 0.6, fx: 7, fy: -12, amp: 4, rotate: -12 },
  { left: 28, top: 64, z: 2, size: 108, opacity: 0.65, duration: 8.6, delay: 1.7, fx: 9, fy: -13, amp: 6, rotate: -22 },
  { left: 44, top: 78, z: 1, size: 72, opacity: 0.34, duration: 10.8, delay: 2.1, fx: 5, fy: -11, amp: 4, rotate: -10, flip: true },
  { left: 22, top: 48, z: 2, size: 96, opacity: 0.55, duration: 10.2, delay: 0.3, fx: -6, fy: -12, amp: 5, rotate: 14 },
];

/**
 * The drift layer behind the hero. Fifteen copies of the mark, each with its
 * own float loop. The animations pause when the hero leaves the viewport so
 * fifteen infinite transforms are not running under the launches grid.
 */
export function FloatingPeaches() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => el.classList.toggle("peach-float-paused", !entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{ contain: "strict" }}
      aria-hidden="true"
    >
      {PEACHES.map((p, i) => (
        <div
          key={i}
          className="peach-float pointer-events-none absolute"
          style={
            {
              left: `${p.left}%`,
              top: `${p.top}%`,
              zIndex: p.z,
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              opacity: p.opacity,
              "--peach-duration": `${p.duration}s`,
              "--peach-delay": `${p.delay}s`,
              "--peach-float-x": `${p.fx}px`,
              "--peach-float-y": `${p.fy}px`,
              "--peach-rotate-amp": `${p.amp}deg`,
              imageRendering: "pixelated",
            } as React.CSSProperties
          }
        >
          <div
            className="h-full w-full"
            style={{
              transform: `rotate(${p.rotate}deg)${p.flip ? " scaleX(-1)" : ""}`,
              imageRendering: "pixelated",
            }}
          >
            <img
              src="/logo.png"
              alt=""
              className="h-full w-full object-contain"
              style={{ imageRendering: "pixelated" }}
              draggable={false}
              decoding="async"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
