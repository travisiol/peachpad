// Draws the Peach Pad mark — a pixel peach — and writes it as PNG at every
// size the site needs. No image library: the PNG encoder below is ~40 lines
// on top of node's zlib, and the picture itself is a 20×20 character grid,
// so the whole identity lives in this one file and regenerates with
// `npm run logo`.
//
//   public/logo.png        1040×1040  the mark (nav, hero drift, token panel)
//   src/app/icon.png         52×52    favicon
//   src/app/apple-icon.png  182×182   apple touch icon
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// One character per cell. Read the legend as light → dark across the fruit:
// the highlight sits top-left where the light lands, the crease runs down
// the right of centre, and the deepest tone hugs the bottom-right edge.
const GRID = [
  ".........S..........",
  "........SS.LLL......",
  "........S.LLLLL.....",
  ".....MMMMSLGGLL.....",
  "...MMHHMMOOGGOOO....",
  "..MHHHMMMOOOOOOOO...",
  ".MHHHMMMMOOODOOOOD..",
  ".MHHMMMMMOOODOOOOD..",
  ".MHHMMMMMOOODOOOODD.",
  ".MHMMMMMMOOODOOOODD.",
  ".MMMMMMMMOOODOOOODD.",
  ".MMMMMMMOOOODOOOODD.",
  "..MMMMMMOOOODOOOOD..",
  "..MMMMMOOOOODOOOOD..",
  "...MMMOOOOOODOOOD...",
  "....MOOOOOOODOOE....",
  ".....OOOOOOODOE.....",
  ".......OOOOEE.......",
  ".........EE.........",
  "....................",
];

const PALETTE = {
  H: [255, 200, 150], // highlight
  M: [255, 160, 92], // mid
  O: [242, 107, 29], // peach — the site accent
  D: [212, 82, 15], // shade / crease
  E: [168, 66, 11], // deep — the site's deep accent
  L: [108, 192, 74], // leaf light
  G: [62, 142, 47], // leaf dark
  S: [122, 74, 30], // stem
};

for (const row of GRID) {
  if (row.length !== GRID.length) throw new Error("grid must be square");
}

// The reference strawberry sits in a lot of air — the fruit is about half
// the width of its box — which is what keeps fifteen of them behind the
// hero from reading as a wall. Three empty cells on every side does the
// same for the peach.
const PAD = 3;
const SIZE = GRID.length + PAD * 2;
const CELLS = Array.from({ length: SIZE }, (_, y) =>
  y < PAD || y >= SIZE - PAD
    ? ".".repeat(SIZE)
    : ".".repeat(PAD) + GRID[y - PAD] + ".".repeat(PAD),
);

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = new Int32Array(256).map((_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  }));
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Render the grid at `px` device pixels, `cell` pixels per grid cell. */
function render(px) {
  const cell = px / SIZE;
  if (!Number.isInteger(cell)) throw new Error(`${px} is not a multiple of ${SIZE}`);
  const rgba = Buffer.alloc(px * px * 4);
  for (let gy = 0; gy < SIZE; gy++) {
    for (let gx = 0; gx < SIZE; gx++) {
      const colour = PALETTE[CELLS[gy][gx]];
      if (!colour) continue;
      for (let y = gy * cell; y < (gy + 1) * cell; y++) {
        for (let x = gx * cell; x < (gx + 1) * cell; x++) {
          const i = (y * px + x) * 4;
          rgba[i] = colour[0];
          rgba[i + 1] = colour[1];
          rgba[i + 2] = colour[2];
          rgba[i + 3] = 255;
        }
      }
    }
  }
  return encodePng(px, px, rgba);
}

// Sizes are multiples of the 26-cell grid so every cell stays a whole
// number of device pixels — no resampling, no soft edges.
const outputs = [
  ["public/logo.png", 1040],
  ["src/app/icon.png", 52],
  ["src/app/apple-icon.png", 182],
];

for (const [file, px] of outputs) {
  const path = resolve(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, render(px));
  console.log(`wrote ${file} (${px}×${px})`);
}
