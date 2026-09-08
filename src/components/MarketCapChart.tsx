"use client";

import { useState } from "react";
import { formatClock, formatUsdCompact } from "@/lib/format";

type Point = { t: number; value: number };

const W = 640;
const H = 220;
const X0 = 8;
const X1 = 584;
const Y0 = 18;
const Y1 = 202;
const PEACH = "#f26b1d";
const INK = "#1c1410";

/**
 * Market cap over the selected range as an area line. Same frame as the
 * reference (640×220, three dotted gridlines with right-aligned labels,
 * four clock ticks along the bottom) with a hover column per point.
 */
export function MarketCapChart({
  points,
  format = formatUsdCompact,
}: {
  points: Point[];
  format?: (v: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max || 1;
  const n = points.length;

  const x = (i: number) => (n === 1 ? X1 : X0 + ((X1 - X0) * i) / (n - 1));
  const y = (v: number) => Y1 - ((v - min) / span) * (Y1 - Y0);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${X1.toFixed(1)},${(Y1 + 10).toFixed(1)} L${X0.toFixed(1)},${(Y1 + 10).toFixed(1)} Z`;

  const grid = [max, (max + min) / 2, min];
  const ticks = [0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

  const hovered = active !== null ? points[active] : null;
  const boxX = active !== null ? Math.min(Math.max(x(active) - 44, X0), X1 - 88) : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[220px] w-full"
      role="img"
      aria-label="Token market cap chart"
      onMouseLeave={() => setActive(null)}
    >
      <defs>
        <linearGradient id="padChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PEACH} stopOpacity="0.28" />
          <stop offset="100%" stopColor={PEACH} stopOpacity="0" />
        </linearGradient>
      </defs>

      {grid.map((v, i) => (
        <g key={i}>
          <line x1={X0} x2={X1} y1={y(v)} y2={y(v)} stroke={INK} strokeOpacity="0.08" strokeDasharray="3 4" />
          <text x={632} y={y(v) - 4} textAnchor="end" className="fill-ink/40" style={{ fontSize: 10 }}>
            {format(v)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#padChartFill)" />
      <path d={line} fill="none" stroke={PEACH} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={i === n - 1 || i === active ? 5 : 0} fill={PEACH} />
      ))}

      {points.map((_, i) => (
        <rect key={`h${i}`} x={x(i) - 14} y={0} width={28} height={H} fill="transparent" onMouseEnter={() => setActive(i)} />
      ))}

      {hovered && active !== null ? (
        <g pointerEvents="none">
          <line x1={x(active)} x2={x(active)} y1={Y0} y2={Y1} stroke={INK} strokeOpacity="0.25" strokeDasharray="2 3" />
          <rect x={boxX} y={Y0 + 6} width={88} height={30} fill="#fff" stroke={INK} strokeWidth="2" />
          <text x={boxX + 44} y={Y0 + 19} textAnchor="middle" className="fill-ink" style={{ fontSize: 11, fontWeight: 600 }}>
            {format(hovered.value)}
          </text>
          <text x={boxX + 44} y={Y0 + 31} textAnchor="middle" className="fill-ink/50" style={{ fontSize: 9 }}>
            {formatClock(hovered.t)}
          </text>
        </g>
      ) : null}

      {ticks.map((i) => (
        <text key={`t${i}`} x={x(i)} y={214} textAnchor="middle" className="fill-ink/40" style={{ fontSize: 10 }}>
          {formatClock(points[i].t)}
        </text>
      ))}
    </svg>
  );
}
