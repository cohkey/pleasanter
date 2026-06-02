import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function createPng(width, height, painter) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = painter(x + 0.5, y + 0.5, width, height);
      const offset = 1 + x * 4;
      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
      row[offset + 3] = a;
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const teal = [15, 118, 110, 255];
const white = [255, 255, 255, 255];
const amber = [245, 158, 11, 255];

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  const cx = Math.max(left + radius, Math.min(x, right - radius));
  const cy = Math.max(top + radius, Math.min(y, bottom - radius));
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function insideRect(x, y, left, top, right, bottom) {
  return x >= left && x < right && y >= top && y < bottom;
}

function insideCircle(x, y, cx, cy, radius) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function paint(x, y, width) {
  const scale = width / 64;
  const sx = x / scale;
  const sy = y / scale;

  if (!insideRoundedRect(sx, sy, 0, 0, 64, 64, 14)) return [0, 0, 0, 0];
  let color = teal;

  if (
    insideRoundedRect(sx, sy, 10, 12, 54, 52, 5) ||
    insideRoundedRect(sx, sy, 4, 47, 60, 54, 4)
  ) {
    color = white;
  }

  if (insideRect(sx, sy, 16, 18, 48, 43)) color = teal;
  if (insideRect(sx, sy, 29, 18, 35, 43) || insideRect(sx, sy, 16, 30, 48, 36)) {
    color = white;
  }

  if (insideCircle(sx, sy, 49, 49, 8)) color = amber;
  if (insideCircle(sx, sy, 49, 49, 3)) color = white;

  return color;
}

for (const size of [16, 32, 64]) {
  writeFileSync(new URL(`./madoguchi-favicon-${size}.png`, import.meta.url), createPng(size, size, paint));
}
