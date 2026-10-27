/**
 * Generates the app icons (a simple color wheel) into public/.
 * Run with: npm run icons. No image libraries needed: writes PNGs directly.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { converter } from 'culori';

const toRgb = converter('rgb');
const BACKGROUND: [number, number, number] = [250, 250, 249]; // stone-50
const SUPERSAMPLE = 4;

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * A ring of 12 hue wedges (one per season, loosely) around a soft gray center.
 * `wheelScale` is the wheel's radius as a share of half the icon (smaller for maskable safe zone).
 */
function colorWheel(size: number, wheelScale: number, transparentBackground: boolean): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const c = size / 2;
  const outer = c * wheelScale;
  const inner = outer * 0.42;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const dx = x + (sx + 0.5) / SUPERSAMPLE - c;
          const dy = y + (sy + 0.5) / SUPERSAMPLE - c;
          const dist = Math.hypot(dx, dy);
          let px: [number, number, number] | null = null;
          if (dist <= inner) {
            px = [122, 138, 153]; // #7a8a99, a soft-summer gray-blue
          } else if (dist <= outer) {
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90; // start at top
            const wedge = Math.floor((((angle % 360) + 360) % 360) / 30);
            const rgb = toRgb({ mode: 'oklch', l: 0.72, c: 0.15, h: wedge * 30 + 15 });
            px = [rgb.r, rgb.g, rgb.b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)) as [number, number, number];
          } else if (!transparentBackground) {
            px = BACKGROUND;
          }
          if (px) {
            r += px[0]; g += px[1]; b += px[2]; a += 255;
          }
        }
      }
      const n = SUPERSAMPLE * SUPERSAMPLE;
      const i = (y * size + x) * 4;
      const covered = a / 255;
      out[i] = covered ? Math.round(r / covered) : 0;
      out[i + 1] = covered ? Math.round(g / covered) : 0;
      out[i + 2] = covered ? Math.round(b / covered) : 0;
      out[i + 3] = Math.round(a / n);
    }
  }
  return out;
}

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
mkdirSync(publicDir, { recursive: true });
const icons: [string, number, number, boolean][] = [
  ['pwa-192x192.png', 192, 0.94, true],
  ['pwa-512x512.png', 512, 0.94, true],
  ['maskable-512x512.png', 512, 0.72, false], // content inside the 80% safe zone
  ['apple-touch-icon.png', 180, 0.84, false], // iOS doesn't do transparency
  ['favicon-32x32.png', 32, 1, true],
];
for (const [name, size, scale, transparent] of icons) {
  writeFileSync(publicDir + name, encodePng(size, size, colorWheel(size, scale, transparent)));
  console.log(`wrote public/${name}`);
}
