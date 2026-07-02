#!/usr/bin/env node
/* Dependency-free app-icon generator.
   Pixel-draws a white dumbbell glyph on an iOS-blue rounded square and
   hand-encodes PNG (IHDR / IDAT via zlib.deflateSync / IEND). No
   ImageMagick or PIL needed. Run once and commit the generated PNGs:

     node tools/make-icons.js

   Outputs into ../icons:
     apple-touch-icon.png    180  full-bleed (iOS applies its own mask)
     icon-192.png            192  rounded transparent corners
     icon-512.png            512  rounded transparent corners
     icon-maskable-512.png   512  glyph in central safe zone, full bleed
*/
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

const BLUE = [0x00, 0x71, 0xe3];
const WHITE = [0xff, 0xff, 0xff];

// --- PNG encoding -----------------------------------------------------------
const crc32 = typeof zlib.crc32 === 'function'
  ? (buf) => zlib.crc32(buf) >>> 0
  : (() => {
      const table = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
      }
      return (buf) => {
        let c = 0xffffffff;
        for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
      };
    })();

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  // Prefix each scanline with filter byte 0.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// --- Drawing ----------------------------------------------------------------
function makeCanvas(size) {
  return { size, buf: Buffer.alloc(size * size * 4) }; // transparent
}

function setPx(cv, x, y, rgb, a = 255) {
  if (x < 0 || y < 0 || x >= cv.size || y >= cv.size) return;
  const i = (y * cv.size + x) * 4;
  cv.buf[i] = rgb[0];
  cv.buf[i + 1] = rgb[1];
  cv.buf[i + 2] = rgb[2];
  cv.buf[i + 3] = a;
}

// Fill a rounded rectangle (fractional coords 0..1) with a flat color.
function fillRoundRect(cv, fx, fy, fw, fh, fr, rgb) {
  const s = cv.size;
  const x0 = fx * s, y0 = fy * s, w = fw * s, h = fh * s, r = fr * s;
  const x1 = x0 + w, y1 = y0 + h;
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      const cx = x + 0.5, cy = y + 0.5;
      if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
      // Corner rounding: distance test against the nearest corner center.
      let dx = 0, dy = 0;
      if (cx < x0 + r) dx = x0 + r - cx; else if (cx > x1 - r) dx = cx - (x1 - r);
      if (cy < y0 + r) dy = y0 + r - cy; else if (cy > y1 - r) dy = cy - (y1 - r);
      if (dx * dx + dy * dy > r * r) continue;
      setPx(cv, x, y, rgb, 255);
    }
  }
}

// Draw the dumbbell glyph centered, scaled by `scale` (fraction of canvas),
// in white. Built from axis-aligned rounded bars.
function drawDumbbell(cv, scale) {
  const c = 0.5;                 // center
  const barLen = 0.62 * scale;   // central bar full length
  const barTh = 0.085 * scale;   // central bar thickness
  // Central bar
  fillRoundRect(cv, c - barLen / 2, c - barTh / 2, barLen, barTh, barTh / 2, WHITE);

  // Plates: inner (tall) + outer (shorter), mirrored on both ends.
  const innerTh = 0.10 * scale, innerH = 0.42 * scale;
  const outerTh = 0.10 * scale, outerH = 0.28 * scale;
  const gap = 0.012 * scale;
  const innerX = barLen / 2;                 // inner plate starts at bar end
  // left inner
  fillRoundRect(cv, c - innerX - innerTh, c - innerH / 2, innerTh, innerH, 0.03 * scale, WHITE);
  // right inner
  fillRoundRect(cv, c + innerX, c - innerH / 2, innerTh, innerH, 0.03 * scale, WHITE);
  // left outer
  fillRoundRect(cv, c - innerX - innerTh - gap - outerTh, c - outerH / 2, outerTh, outerH, 0.03 * scale, WHITE);
  // right outer
  fillRoundRect(cv, c + innerX + innerTh + gap, c - outerH / 2, outerTh, outerH, 0.03 * scale, WHITE);
}

function buildIcon(size, { fullBleed = false, maskable = false } = {}) {
  const cv = makeCanvas(size);
  if (fullBleed || maskable) {
    // Opaque full square background.
    fillRoundRect(cv, 0, 0, 1, 1, 0, BLUE);
  } else {
    // Rounded background with transparent corners (~22% radius).
    fillRoundRect(cv, 0, 0, 1, 1, 0.22, BLUE);
  }
  // Maskable keeps the glyph within the central ~62% safe zone.
  drawDumbbell(cv, maskable ? 0.62 : 0.82);
  return encodePng(size, size, cv.buf);
}

// --- Write ------------------------------------------------------------------
const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  ['apple-touch-icon.png', 180, { fullBleed: true }],
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
];

for (const [name, size, opts] of targets) {
  const png = buildIcon(size, opts);
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(`wrote icons/${name} (${size}x${size}, ${png.length} bytes)`);
}
