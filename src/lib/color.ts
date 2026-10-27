import { converter, differenceCiede2000, formatHex, inGamut } from 'culori';

export interface Lch {
  l: number; // L* 0–100
  c: number; // C* 0–~130
  h: number; // hue in degrees, 0–360 (0 for neutral grays)
}

// culori's plain `lch` mode is D50. The spec asks for D65, which is `lch65`.
const toLch65 = converter('lch65');
const toRgb = converter('rgb');
const isInSrgb = inGamut('rgb');
const deltaE2000 = differenceCiede2000();

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Accepts `#abc`, `abc`, `#aabbcc`, `aabbcc` (any case, surrounding spaces ok).
 * Returns normalized lowercase `#rrggbb`, or null if the input isn't a hex color.
 */
export function parseHex(input: string): string | null {
  const match = HEX_RE.exec(input.trim());
  if (!match) return null;
  let digits = match[1]!.toLowerCase();
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((d) => d + d)
      .join('');
  }
  return `#${digits}`;
}

function requireHex(hex: string): string {
  const parsed = parseHex(hex);
  if (!parsed) throw new Error(`Invalid hex color: ${hex}`);
  return parsed;
}

export function hexToLch(hex: string): Lch {
  const c = toLch65(requireHex(hex));
  if (!c) throw new Error(`Could not convert ${hex}`);
  return { l: c.l, c: c.c, h: c.h ?? 0 };
}

/** Returns `#rrggbb`, or null when the LCh color is outside the sRGB gamut. */
export function lchToHex({ l, c, h }: Lch): string | null {
  const color = { mode: 'lch65' as const, l, c, h };
  if (!isInSrgb(color)) return null;
  return formatHex(toRgb(color));
}

/** CIEDE2000 color difference between two hex colors. */
export function deltaE(hexA: string, hexB: string): number {
  return deltaE2000(requireHex(hexA), requireHex(hexB));
}

/** Convert a 0–255 hex string to 0–255 RGB components. */
export function hexToRgb255(hex: string): [number, number, number] {
  const h = requireHex(hex);
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function rgb255ToHex(r: number, g: number, b: number): string {
  const to2 = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

// ---------------------------------------------------------------------------
// Photo sampling math (pure: no DOM, so it can be unit-tested)
// ---------------------------------------------------------------------------

/** sRGB 0–255 channel to linear 0–1. */
export function srgbToLinear(v255: number): number {
  const v = v255 / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Linear 0–1 channel to sRGB 0–255. */
export function linearToSrgb(lin: number): number {
  const v = lin <= 0.0031308 ? lin * 12.92 : 1.055 * lin ** (1 / 2.4) - 0.055;
  return v * 255;
}

/** Minimal shape of canvas ImageData, so tests don't need a DOM. */
export interface PixelGrid {
  data: ArrayLike<number>; // RGBA, 4 bytes per pixel
  width: number;
  height: number;
}

/**
 * Average the pixels in an RGBA buffer, ignoring the brightest `dropPct`
 * (highlights, sheen). Averaging happens in linear RGB. Fully transparent
 * pixels are skipped.
 */
export function averagePixels(data: ArrayLike<number>, dropPct: number): string | null {
  const pixels: { r: number; g: number; b: number; y: number }[] = [];
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = srgbToLinear(data[i]!);
    const g = srgbToLinear(data[i + 1]!);
    const b = srgbToLinear(data[i + 2]!);
    // Relative luminance (Rec. 709 / sRGB primaries)
    pixels.push({ r, g, b, y: 0.2126 * r + 0.7152 * g + 0.0722 * b });
  }
  if (pixels.length === 0) return null;

  pixels.sort((a, b) => a.y - b.y);
  const dropCount = Math.min(pixels.length - 1, Math.ceil(pixels.length * dropPct));
  const kept = pixels.slice(0, pixels.length - dropCount);

  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of kept) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  const n = kept.length;
  return rgb255ToHex(linearToSrgb(r / n), linearToSrgb(g / n), linearToSrgb(b / n));
}

/**
 * Sample a `size` x `size` square centered on (x, y), clipped to the image,
 * and return its averaged hex color.
 */
export function sampleSquare(
  grid: PixelGrid,
  x: number,
  y: number,
  size: number,
  dropPct: number,
): string | null {
  const half = Math.floor(size / 2);
  const x0 = Math.max(0, Math.round(x) - half);
  const y0 = Math.max(0, Math.round(y) - half);
  const x1 = Math.min(grid.width, Math.round(x) - half + size);
  const y1 = Math.min(grid.height, Math.round(y) - half + size);
  if (x1 <= x0 || y1 <= y0) return null;

  const out: number[] = [];
  for (let row = y0; row < y1; row++) {
    for (let col = x0; col < x1; col++) {
      const i = (row * grid.width + col) * 4;
      out.push(grid.data[i]!, grid.data[i + 1]!, grid.data[i + 2]!, grid.data[i + 3]!);
    }
  }
  return averagePixels(out, dropPct);
}

/** Scale (w, h) down so the long edge is at most `maxEdge`. Never upscales. */
export function fitWithin(w: number, h: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** WCAG relative luminance of a hex color (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb255(hex).map(srgbToLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white, whichever has more contrast on top of `hex`. */
export function readableTextOn(hex: string): '#000000' | '#ffffff' {
  const y = relativeLuminance(hex);
  const contrastWithBlack = (y + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (y + 0.05);
  return contrastWithBlack >= contrastWithWhite ? '#000000' : '#ffffff';
}
