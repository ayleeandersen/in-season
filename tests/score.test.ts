import { describe, expect, test } from 'vitest';
import { PALETTES, type Palette } from '../src/data/palettes';
import { SEASONS, getSeason } from '../src/data/seasons';
import { deltaE, parseHex } from '../src/lib/color';
import { CONFIG } from '../src/lib/config';
import {
  levelForDeltaE,
  matchPctFor,
  reasonFor,
  scoreAllSeasons,
  scorePalette,
  verdictFor,
} from '../src/lib/score';

describe('swatch self-match', () => {
  test("every swatch's nearest match in its own season is itself (ΔE < 0.5)", () => {
    for (const palette of PALETTES) {
      for (const hex of palette.swatches) {
        const nearest = scorePalette(hex, palette).nearest[0]!;
        expect(nearest.deltaE, `${palette.seasonId} ${hex}`).toBeLessThan(0.5);
        expect(nearest.hex).toBe(hex);
      }
    }
  });
});

describe('palette density (leave-one-out)', () => {
  test(`≥ 95% of swatches have another swatch in their season within ΔE ${CONFIG.greatMaxDeltaE}`, () => {
    let total = 0;
    let dense = 0;
    const perSeason: Record<string, string> = {};
    for (const palette of PALETTES) {
      let seasonDense = 0;
      palette.swatches.forEach((hex, i) => {
        const others: Palette = { ...palette, swatches: palette.swatches.filter((_, j) => j !== i) };
        const nearest = scorePalette(hex, others).nearest[0]!;
        if (nearest.deltaE < CONFIG.greatMaxDeltaE) seasonDense++;
      });
      total += palette.swatches.length;
      dense += seasonDense;
      perSeason[palette.seasonId] = `${seasonDense}/${palette.swatches.length}`;
    }
    console.log('Leave-one-out density by season:', perSeason, `overall ${((100 * dense) / total).toFixed(1)}%`);
    expect(dense / total).toBeGreaterThanOrEqual(0.95);
  });
});

describe('verdict boundaries', () => {
  test.each([
    [5.99, 'great'],
    [6, 'okay'],
    [12, 'okay'],
    [12.01, 'avoid'],
    [0, 'great'],
    [40, 'avoid'],
  ] as const)('ΔE %s → %s', (d, level) => {
    expect(levelForDeltaE(d)).toBe(level);
  });
});

describe('matchPct', () => {
  test('stays within 0–100 for any ΔE', () => {
    for (const d of [0, 0.001, 1, 5.5, 19.9, 20, 20.1, 50, 1000, Number.POSITIVE_INFINITY]) {
      const pct = matchPctFor(d);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
      expect(Number.isInteger(pct)).toBe(true);
    }
  });

  test('stays within 0–100 for real colors, including extremes', () => {
    for (const hex of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080', '#7a8a99']) {
      for (const s of scoreAllSeasons(hex, PALETTES)) {
        expect(s.matchPct).toBeGreaterThanOrEqual(0);
        expect(s.matchPct).toBeLessThanOrEqual(100);
      }
    }
  });

  test('is 100 for an exact palette swatch in its own season', () => {
    const palette = PALETTES[0]!;
    // K nearest includes the swatch itself plus its neighbors, so just check the formula
    expect(matchPctFor(0)).toBe(100);
    expect(scorePalette(palette.swatches[0]!, palette).matchPct).toBeGreaterThan(0);
  });
});

describe('scoreAllSeasons', () => {
  const ranking = scoreAllSeasons('#7a8a99', PALETTES);

  test('returns all 12 seasons sorted best first', () => {
    expect(ranking).toHaveLength(12);
    for (let i = 1; i < ranking.length; i++) {
      expect(ranking[i]!.deltaE).toBeGreaterThanOrEqual(ranking[i - 1]!.deltaE);
    }
  });

  test('returns K nearest swatches per season, ascending, averaged into deltaE', () => {
    for (const s of ranking) {
      expect(s.nearest).toHaveLength(CONFIG.nearestK);
      for (let i = 1; i < s.nearest.length; i++) {
        expect(s.nearest[i]!.deltaE).toBeGreaterThanOrEqual(s.nearest[i - 1]!.deltaE);
      }
      const mean = s.nearest.reduce((a, n) => a + n.deltaE, 0) / s.nearest.length;
      expect(s.deltaE).toBeCloseTo(mean, 10);
    }
  });

  test('scores one color in under 50 ms', () => {
    scoreAllSeasons('#123456', PALETTES); // warm the swatch cache, like the app does after first use
    const start = performance.now();
    scoreAllSeasons('#c08497', PALETTES);
    const coldColor = performance.now() - start;
    console.log(`scoreAllSeasons took ${coldColor.toFixed(2)} ms`);
    expect(coldColor).toBeLessThan(50);
  });
});

describe('reason priority (Section 7, step 6)', () => {
  const softSummer = getSeason('soft-summer'); // L 35–75, C 8–30, cool-neutral
  const softAutumn = getSeason('soft-autumn'); // warm-neutral
  const trueSummer = getSeason('true-summer'); // cool

  test('1. too light wins over everything', () => {
    // Also too bright, and the best season is warm: "too light" must still win.
    expect(reasonFor({ l: 82.4, c: 50, h: 70 }, softSummer, softAutumn, 'avoid')).toBe(
      'Too light: L* 82 vs Soft Summer max 75',
    );
  });

  test('2. too dark comes next', () => {
    expect(reasonFor({ l: 20.6, c: 50, h: 70 }, softSummer, softAutumn, 'avoid')).toBe(
      'Too dark: L* 21 vs Soft Summer min 35',
    );
  });

  test('3. too bright beats too muted / undertone', () => {
    expect(reasonFor({ l: 50, c: 44.6, h: 70 }, softSummer, softAutumn, 'avoid')).toBe(
      'Too bright: C* 45 vs Soft Summer max 30',
    );
  });

  test('4. too muted', () => {
    expect(reasonFor({ l: 50, c: 3.2, h: 70 }, softSummer, softAutumn, 'avoid')).toBe(
      'Too muted: C* 3 vs Soft Summer min 8',
    );
  });

  test('5. opposite undertone family of the best season', () => {
    expect(reasonFor({ l: 50, c: 20, h: 70 }, softSummer, softAutumn, 'okay')).toBe(
      'Leans warm: closest to Soft Autumn',
    );
    expect(reasonFor({ l: 50, c: 20, h: 250 }, softAutumn, softSummer, 'okay')).toBe(
      'Leans cool: closest to Soft Summer',
    );
  });

  test('same undertone family (cool vs cool-neutral) does not count as leaning', () => {
    expect(reasonFor({ l: 50, c: 20, h: 250 }, softSummer, trueSummer, 'great')).toBe('Close to your palette');
  });

  test('6. otherwise falls back by level', () => {
    expect(reasonFor({ l: 50, c: 20, h: 250 }, softSummer, softSummer, 'great')).toBe('Close to your palette');
    expect(reasonFor({ l: 50, c: 20, h: 250 }, softSummer, softSummer, 'okay')).toBe('Near the edge of your palette');
  });

  test('compares rounded values, so a value that rounds to the limit is in range', () => {
    expect(reasonFor({ l: 75.4, c: 20, h: 250 }, softSummer, softSummer, 'great')).toBe('Close to your palette');
  });
});

describe('verdictFor', () => {
  test('a palette swatch is Great in its own season', () => {
    for (const palette of PALETTES) {
      const { verdict, score } = verdictFor(palette.swatches[10]!, palette.seasonId, PALETTES, SEASONS);
      expect(score.seasonId).toBe(palette.seasonId);
      expect(verdict.level, `${palette.seasonId}`).toBe('great');
    }
  });

  test('pure white is not Great for Soft Summer and explains why', () => {
    const { verdict } = verdictFor('#ffffff', 'soft-summer', PALETTES, SEASONS);
    expect(verdict.level).not.toBe('great');
    expect(verdict.reason).toMatch(/^Too light: L\* 100 vs Soft Summer max 75$/);
  });

  test('level matches the saved season deltaE', () => {
    const { score, verdict } = verdictFor('#c08497', 'soft-summer', PALETTES, SEASONS);
    expect(verdict.level).toBe(levelForDeltaE(score.deltaE));
  });
});

describe('hex parsing', () => {
  test.each([
    ['#abc', '#aabbcc'],
    ['abc', '#aabbcc'],
    ['#aabbcc', '#aabbcc'],
    ['aabbcc', '#aabbcc'],
    ['#ABC', '#aabbcc'],
    ['AbCdEf', '#abcdef'],
    ['  #7A8A99 ', '#7a8a99'],
  ])('%s → %s', (input, expected) => {
    expect(parseHex(input)).toBe(expected);
  });

  test.each(['', '#', '#ab', '#abcd', '#abcde', '#abcdefa', 'ggg', '#12345g', 'red', '##abc'])(
    'rejects %j',
    (input) => {
      expect(parseHex(input)).toBeNull();
    },
  );

  test('scoring accepts any valid hex form and gives identical results', () => {
    const forms = ['#abc', 'abc', '#AABBCC', 'aabbcc'];
    const results = forms.map((f) => scoreAllSeasons(f, PALETTES).map((s) => s.deltaE));
    for (const r of results) expect(r).toEqual(results[0]);
    expect(deltaE('#abc', '#aabbcc')).toBe(0);
  });
});
