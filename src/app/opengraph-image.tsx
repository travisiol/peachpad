import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { site } from "@/lib/site";

export const alt = `${site.name} - ${site.domain}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The share card: the domain in the pixel face on cream fading to soft
// peach, one big mark beside it and a scatter of faded ones — the same
// composition as the reference banner, in this fruit.
const SCATTER: { x: number; y: number; s: number; o: number; r: number }[] = [
  { x: 60, y: 60, s: 90, o: 0.45, r: -20 },
  { x: 560, y: 30, s: 110, o: 0.5, r: 12 },
  { x: 930, y: 40, s: 150, o: 0.95, r: 18 },
  { x: 1090, y: 120, s: 90, o: 0.45, r: -14 },
  { x: 90, y: 440, s: 100, o: 0.55, r: -30 },
  { x: 470, y: 470, s: 90, o: 0.5, r: 8 },
  { x: 800, y: 500, s: 90, o: 0.55, r: -10 },
  { x: 1080, y: 400, s: 110, o: 0.6, r: 24 },
];

export default async function Image() {
  const [font, logo] = await Promise.all([
    readFile(join(process.cwd(), "src/app/fonts/Jersey15-Regular.ttf")),
    readFile(join(process.cwd(), "public/logo.png")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          backgroundImage: "linear-gradient(180deg, #fff8f2 0%, #fff8f2 55%, #ffcfa3 100%)",
          fontFamily: "Jersey15",
        }}
      >
        {SCATTER.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={logoSrc}
            alt=""
            width={p.s}
            height={p.s}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              opacity: p.o,
              transform: `rotate(${p.r}deg)`,
            }}
          />
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" width={260} height={260} style={{ transform: "rotate(-12deg)" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 118, color: "#f26b1d", letterSpacing: 4, lineHeight: 1 }}>
              {site.domain.toUpperCase()}
            </div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 40, color: "#1c1410", letterSpacing: 3, opacity: 0.7 }}>
              LAUNCH MIDDLEWARE · SUCCESS LAYER
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Jersey15", data: font, weight: 400, style: "normal" }],
    },
  );
}
