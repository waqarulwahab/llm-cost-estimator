// Generates images/icon.png (128x128) with zero dependencies — just Node's
// built-in zlib for PNG compression. Produces a gold "$" coin on an indigo
// gradient, which reads as a "cost" mark at Marketplace sizes.
//
// Regenerate with: npm run generate-icon
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const SIZE = 128;
const px = Buffer.alloc(SIZE * SIZE * 4); // RGBA

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = a;
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// Rounded-square mask (modern app-icon silhouette).
const CORNER = 24;
function insideRoundedRect(x, y) {
  const corners = [
    [CORNER, CORNER],
    [SIZE - 1 - CORNER, CORNER],
    [CORNER, SIZE - 1 - CORNER],
    [SIZE - 1 - CORNER, SIZE - 1 - CORNER],
  ];
  if (x >= CORNER && x <= SIZE - 1 - CORNER) return true;
  if (y >= CORNER && y <= SIZE - 1 - CORNER) return true;
  for (const [cx, cy] of corners) {
    const inXCorner = (x < CORNER) === cx < CORNER;
    const inYCorner = (y < CORNER) === cy < CORNER;
    if (inXCorner && inYCorner) {
      return Math.hypot(x - cx, y - cy) <= CORNER;
    }
  }
  return false;
}

// 1) Background: vertical indigo -> violet gradient inside the rounded square.
const TOP = [79, 70, 229]; // #4F46E5
const BOTTOM = [124, 58, 237]; // #7C3AED
for (let y = 0; y < SIZE; y++) {
  const t = y / (SIZE - 1);
  const r = lerp(TOP[0], BOTTOM[0], t);
  const g = lerp(TOP[1], BOTTOM[1], t);
  const b = lerp(TOP[2], BOTTOM[2], t);
  for (let x = 0; x < SIZE; x++) {
    if (insideRoundedRect(x, y)) {
      setPixel(x, y, r, g, b, 255);
    } else {
      setPixel(x, y, 0, 0, 0, 0); // transparent outside
    }
  }
}

// 2) Gold coin.
const COIN = [250, 204, 21]; // #FACC15
const GLYPH = [49, 46, 129]; // #312E81 (dark indigo)
const cx = 64;
const cy = 64;
const radius = 42;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    if (Math.hypot(x - cx, y - cy) <= radius) {
      setPixel(x, y, COIN[0], COIN[1], COIN[2], 255);
    }
  }
}

// 3) "$" glyph: a seven-segment "S" plus a vertical bar through the middle.
function fillRect(x0, x1, y0, y1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (Math.hypot(x - cx, y - cy) <= radius) {
        setPixel(x, y, GLYPH[0], GLYPH[1], GLYPH[2], 255);
      }
    }
  }
}
// S segments
fillRect(52, 76, 42, 48); // top
fillRect(50, 56, 44, 64); // upper-left
fillRect(52, 76, 61, 67); // middle
fillRect(72, 78, 64, 84); // lower-right
fillRect(52, 76, 80, 86); // bottom
// vertical bar of the "$"
fillRect(61, 67, 36, 92);

// ---- PNG encoding --------------------------------------------------------
function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// Raw image data: one filter byte (0) per scanline.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (SIZE * 4 + 1);
  raw[rowStart] = 0;
  px.copy(raw, rowStart + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

const outDir = path.resolve(__dirname, "..", "images");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "icon.png");
fs.writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes, ${SIZE}x${SIZE})`);
