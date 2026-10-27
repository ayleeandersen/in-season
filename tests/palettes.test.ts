import { describe, expect, test } from 'vitest';
import { SPEC_SEASON_RANGES } from '../scripts/generate-seed-palettes';
import { PALETTES, type Palette } from '../src/data/palettes';
import { SEED_PALETTES } from '../src/data/palettes.seed';
import { SEASONS } from '../src/data/seasons';
import { hexToLch } from '../src/lib/color';

const RANGE_TOLERANCE = 1;

function commonChecks(palettes: Palette[], min: number, max: number) {
  test('there is exactly one palette per season', () => {
    const ids = palettes.map((p) => p.seasonId).sort();
    expect(ids).toEqual(SEASONS.map((s) => s.id).sort());
  });

  describe.each(palettes)('$seasonId', (palette) => {
    test(`has ${min}–${max} swatches`, () => {
      expect(palette.swatches.length).toBeGreaterThanOrEqual(min);
      expect(palette.swatches.length).toBeLessThanOrEqual(max);
    });

    test('every swatch is a valid #RRGGBB', () => {
      for (const hex of palette.swatches) expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    test('has no duplicate swatches', () => {
      const normalized = palette.swatches.map((h) => h.toLowerCase());
      expect(new Set(normalized).size).toBe(normalized.length);
    });
  });
}

describe('palettes used by the app (src/data/palettes.ts)', () => {
  commonChecks(PALETTES, 40, 250);
});

describe('placeholder backup (src/data/palettes.seed.ts)', () => {
  commonChecks(SEED_PALETTES, 40, 60);

  test('every swatch is marked as seed', () => {
    for (const p of SEED_PALETTES) expect(p.source).toBe('seed');
  });

  describe.each(SEED_PALETTES)('$seasonId', (palette) => {
    test("swatches fall inside the spec's original L*/C* ranges (±1)", () => {
      const { lRange, cRange } = SPEC_SEASON_RANGES[palette.seasonId];
      for (const hex of palette.swatches) {
        const { l, c } = hexToLch(hex);
        expect(l, `${hex} L*`).toBeGreaterThanOrEqual(lRange[0] - RANGE_TOLERANCE);
        expect(l, `${hex} L*`).toBeLessThanOrEqual(lRange[1] + RANGE_TOLERANCE);
        expect(c, `${hex} C*`).toBeGreaterThanOrEqual(cRange[0] - RANGE_TOLERANCE);
        expect(c, `${hex} C*`).toBeLessThanOrEqual(cRange[1] + RANGE_TOLERANCE);
      }
    });
  });
});
