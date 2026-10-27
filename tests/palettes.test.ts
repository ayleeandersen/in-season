import { describe, expect, test } from 'vitest';
import { PALETTES } from '../src/data/palettes';
import { SEASONS } from '../src/data/seasons';
import { hexToLch } from '../src/lib/color';

const RANGE_TOLERANCE = 1;

describe('palettes', () => {
  test('there is exactly one palette per season', () => {
    const ids = PALETTES.map((p) => p.seasonId).sort();
    expect(ids).toEqual(SEASONS.map((s) => s.id).sort());
  });

  describe.each(PALETTES)('$seasonId', (palette) => {
    const season = SEASONS.find((s) => s.id === palette.seasonId)!;

    test('has 40–60 swatches', () => {
      expect(palette.swatches.length).toBeGreaterThanOrEqual(40);
      expect(palette.swatches.length).toBeLessThanOrEqual(60);
    });

    test('every swatch is a valid #RRGGBB', () => {
      for (const hex of palette.swatches) expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    test('has no duplicate swatches', () => {
      const normalized = palette.swatches.map((h) => h.toLowerCase());
      expect(new Set(normalized).size).toBe(normalized.length);
    });

    // Curated palettes are the owner's judgment and may stray outside the
    // approximate ranges; only generated seed swatches must stay inside.
    test('seed swatches fall inside the season L*/C* ranges (±1)', () => {
      if (palette.source !== 'seed') return;
      for (const hex of palette.swatches) {
        const { l, c } = hexToLch(hex);
        expect(l, `${hex} L*`).toBeGreaterThanOrEqual(season.lRange[0] - RANGE_TOLERANCE);
        expect(l, `${hex} L*`).toBeLessThanOrEqual(season.lRange[1] + RANGE_TOLERANCE);
        expect(c, `${hex} C*`).toBeGreaterThanOrEqual(season.cRange[0] - RANGE_TOLERANCE);
        expect(c, `${hex} C*`).toBeLessThanOrEqual(season.cRange[1] + RANGE_TOLERANCE);
      }
    });
  });
});
