import { describe, expect, test } from 'vitest';
import {
  averagePixels,
  deltaE,
  fitWithin,
  hexToLch,
  hexToRgb255,
  lchToHex,
  linearToSrgb,
  readableTextOn,
  sampleSquare,
  srgbToLinear,
  type PixelGrid,
} from '../src/lib/color';
import { CONFIG } from '../src/lib/config';

/**
 * Solid-color RGBA image with `whiteFraction` of pixels pure white. White pixels
 * sit on a diagonal pattern so any sample window holds about the same share.
 */
function syntheticImage(width: number, height: number, hex: string, whiteFraction: number): PixelGrid {
  const [r, g, b] = hexToRgb255(hex);
  const data = new Uint8ClampedArray(width * height * 4);
  const period = Math.round(1 / whiteFraction);
  for (let p = 0; p < width * height; p++) {
    const x = p % width;
    const y = Math.floor(p / width);
    const white = whiteFraction > 0 && (x + 3 * y) % period === 0;
    data[p * 4] = white ? 255 : r;
    data[p * 4 + 1] = white ? 255 : g;
    data[p * 4 + 2] = white ? 255 : b;
    data[p * 4 + 3] = 255;
  }
  return { data, width, height };
}

describe('photo sampling', () => {
  test('solid #7a8a99 with 10% pure-white pixels samples within ΔE 1 of #7a8a99', () => {
    const img = syntheticImage(100, 100, '#7a8a99', 0.1);
    const hex = sampleSquare(img, 50, 50, CONFIG.sampleSizePx, CONFIG.dropBrightestPct)!;
    expect(deltaE(hex, '#7a8a99')).toBeLessThan(1);
  });

  test('the same image sampled at several tap points stays within ΔE 1', () => {
    const img = syntheticImage(100, 100, '#7a8a99', 0.1);
    for (const [x, y] of [[10, 10], [33, 71], [90, 5], [99, 99], [0, 0]] as const) {
      const hex = sampleSquare(img, x, y, CONFIG.sampleSizePx, CONFIG.dropBrightestPct)!;
      expect(deltaE(hex, '#7a8a99'), `at ${x},${y}`).toBeLessThan(1);
    }
  });

  test('without dropping highlights the white pixels would skew the result', () => {
    const img = syntheticImage(100, 100, '#7a8a99', 0.1);
    const hex = sampleSquare(img, 50, 50, CONFIG.sampleSizePx, 0)!;
    expect(deltaE(hex, '#7a8a99')).toBeGreaterThan(1);
  });

  test('averages in linear RGB, not gamma-encoded sRGB', () => {
    // Half black, half white. Linear average is 0.5 linear ≈ sRGB 188, not 128.
    const data = [0, 0, 0, 255, 255, 255, 255, 255];
    expect(averagePixels(data, 0)).toBe('#bcbcbc');
  });

  test('skips transparent pixels (e.g. outside the image edge)', () => {
    const data = [10, 20, 30, 255, 255, 255, 255, 0];
    expect(averagePixels(data, 0)).toBe('#0a141e');
    expect(averagePixels([0, 0, 0, 0], 0)).toBeNull();
  });

  test('clips the sample square at image edges', () => {
    const img = syntheticImage(4, 4, '#336699', 0);
    expect(sampleSquare(img, 0, 0, 15, 0)).toBe('#336699');
  });
});

describe('downscaling for large photos', () => {
  test('a 12 MP photo is scaled to 2048 px on the long edge', () => {
    expect(fitWithin(4000, 3000, CONFIG.maxSamplingEdgePx)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3000, 4000, CONFIG.maxSamplingEdgePx)).toEqual({ width: 1536, height: 2048 });
  });

  test('small images are never upscaled', () => {
    expect(fitWithin(800, 600, CONFIG.maxSamplingEdgePx)).toEqual({ width: 800, height: 600 });
  });
});

describe('conversions', () => {
  test('sRGB ↔ linear round-trips', () => {
    for (let v = 0; v <= 255; v += 17) expect(linearToSrgb(srgbToLinear(v))).toBeCloseTo(v, 6);
  });

  test('hex → LCh → hex round-trips', () => {
    for (const hex of ['#7a8a99', '#c08497', '#123456', '#ffffff', '#000000']) {
      expect(lchToHex(hexToLch(hex))).toBe(hex);
    }
  });

  test('out-of-gamut LCh returns null instead of clamping', () => {
    expect(lchToHex({ l: 90, c: 120, h: 260 })).toBeNull();
  });

  test('uses D65 LCh (white is L* 100, C* ≈ 0)', () => {
    const white = hexToLch('#ffffff');
    expect(white.l).toBeCloseTo(100, 1);
    expect(white.c).toBeLessThan(0.5);
  });

  test('readable text picks black on light colors and white on dark', () => {
    expect(readableTextOn('#ffffff')).toBe('#000000');
    expect(readableTextOn('#7a8a99')).toBe('#000000');
    expect(readableTextOn('#1a1a2e')).toBe('#ffffff');
  });
});
