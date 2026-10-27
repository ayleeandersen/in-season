/**
 * Generates the PLACEHOLDER (seed) palettes for every season and writes them to
 * src/data/palettes.seed.ts, a backup the app doesn't use. It never touches
 * src/data/palettes.ts, which holds the palettes the app uses.
 * Run with: npm run seed
 *
 * See spec Section 5. Uses the spec's original season ranges and density target
 * (below), so the output stays the same even after seasons.ts and config.ts are tuned.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SEASONS, type Season, type SeasonId } from '../src/data/seasons';
import { deltaE, lchToHex } from '../src/lib/color';

/** The spec's original L* and C* ranges (Section 4), which the seed palettes are built from. */
export const SPEC_SEASON_RANGES: Record<SeasonId, { lRange: [number, number]; cRange: [number, number] }> = {
  'light-spring': { lRange: [65, 90], cRange: [25, 55] },
  'true-spring': { lRange: [50, 80], cRange: [45, 80] },
  'bright-spring': { lRange: [45, 75], cRange: [55, 90] },
  'light-summer': { lRange: [65, 90], cRange: [15, 40] },
  'true-summer': { lRange: [45, 80], cRange: [15, 45] },
  'soft-summer': { lRange: [35, 75], cRange: [8, 30] },
  'soft-autumn': { lRange: [35, 75], cRange: [10, 35] },
  'true-autumn': { lRange: [30, 65], cRange: [25, 55] },
  'dark-autumn': { lRange: [15, 50], cRange: [25, 60] },
  'dark-winter': { lRange: [15, 50], cRange: [25, 65] },
  'true-winter': { lRange: [20, 70], cRange: [45, 85] },
  'bright-winter': { lRange: [25, 75], cRange: [55, 95] },
};
/** The spec's original Great threshold, used as the seed palettes' density target. */
const SEED_DENSITY_MAX_DELTA_E = 6;

const MIN_SWATCHES = 40;
const MAX_SWATCHES = 60;
const TARGET_DENSITY = 0.95;
const WARM_TARGET_HUE = 70; // yellow
const COOL_TARGET_HUE = 260; // blue

function hueShiftFor(season: Season): { target: number; amount: number } {
  const amount = season.undertone === 'warm' || season.undertone === 'cool' ? 15 : 8;
  const target = season.undertone.startsWith('warm') ? WARM_TARGET_HUE : COOL_TARGET_HUE;
  return { target, amount };
}

/** Move `hue` up to `amount` degrees toward `target` along the shorter arc, never overshooting. */
export function shiftHueToward(hue: number, target: number, amount: number): number {
  // Signed shortest distance from hue to target, in (-180, 180].
  let diff = (((target - hue) % 360) + 540) % 360 - 180;
  if (diff === -180) diff = 180;
  const step = Math.sign(diff) * Math.min(Math.abs(diff), amount);
  return (((hue + step) % 360) + 360) % 360;
}

/** `count` values evenly spaced strictly inside [min, max] (endpoints excluded). */
export function evenlyInside(min: number, max: number, count: number): number[] {
  const step = (max - min) / (count + 1);
  return Array.from({ length: count }, (_, i) => min + step * (i + 1));
}

export interface GridSpec {
  hueStep: number; // degrees between sampled hues
  lCount: number; // L* levels inside lRange
  cCount: number; // C* levels inside cRange
}

/** Sample one LCh grid for a season. Out-of-gamut colors are dropped, not clamped. */
export function sampleGrid(season: Season, grid: GridSpec): string[] {
  const { target, amount } = hueShiftFor(season);
  const lValues = evenlyInside(season.lRange[0], season.lRange[1], grid.lCount);
  const cValues = evenlyInside(season.cRange[0], season.cRange[1], grid.cCount);

  const seen = new Set<string>();
  const swatches: string[] = [];
  for (let hue = 0; hue < 360; hue += grid.hueStep) {
    const h = shiftHueToward(hue, target, amount);
    for (const l of lValues) {
      for (const c of cValues) {
        const hex = lchToHex({ l, c, h });
        if (!hex || seen.has(hex)) continue;
        seen.add(hex);
        swatches.push(hex);
      }
    }
  }
  return swatches;
}

/** Share of swatches whose nearest other swatch is within `maxDeltaE` (leave-one-out density). */
export function density(swatches: string[], maxDeltaE = SEED_DENSITY_MAX_DELTA_E): number {
  if (swatches.length < 2) return 0;
  const dense = swatches.filter((a, i) => swatches.some((b, j) => i !== j && deltaE(a, b) < maxDeltaE));
  return dense.length / swatches.length;
}

// The spec's grid (15° hues, 3 L*, 2 C*) comes first. The rest are fallbacks for
// seasons where that grid gives too many / too few in-gamut colors, or leaves gaps.
// Ordered from "closest to the spec" to "furthest". See DECISIONS.md.
const SPEC_GRID: GridSpec = { hueStep: 15, lCount: 3, cCount: 2 };
const CANDIDATE_GRIDS: GridSpec[] = [SPEC_GRID];
for (const hueStep of [15, 18, 20, 24, 30, 36, 40, 45]) {
  for (const lCount of [3, 2, 4, 5]) {
    for (const cCount of [2, 3, 4]) {
      if (hueStep === 15 && lCount === 3 && cCount === 2) continue;
      CANDIDATE_GRIDS.push({ hueStep, lCount, cCount });
    }
  }
}

/**
 * Pick the first candidate grid that yields MIN–MAX swatches with at least
 * TARGET_DENSITY leave-one-out density. If none qualifies, use the in-range
 * grid with the best density.
 */
export function generateSeedPalette(liveSeason: Season): { swatches: string[]; grid: GridSpec; density: number } {
  const season: Season = { ...liveSeason, ...SPEC_SEASON_RANGES[liveSeason.id] };
  let best: { swatches: string[]; grid: GridSpec; density: number } | null = null;
  for (const grid of CANDIDATE_GRIDS) {
    const swatches = sampleGrid(season, grid);
    if (swatches.length < MIN_SWATCHES || swatches.length > MAX_SWATCHES) continue;
    const d = density(swatches);
    if (d >= TARGET_DENSITY) return { swatches, grid, density: d };
    if (!best || d > best.density) best = { swatches, grid, density: d };
  }
  if (!best) throw new Error(`No grid gives ${MIN_SWATCHES}–${MAX_SWATCHES} in-gamut swatches for ${season.id}`);
  return best;
}

export interface PaletteEntry {
  seasonId: string;
  source: 'seed' | 'curated';
  swatches: string[];
  comment?: string;
}

/** Writes the full text of src/data/palettes.ts. Shared with one-off palette importers. */
export function renderPalettesFile(entries: PaletteEntry[]): string {
  const blocks = entries.map(({ seasonId, source, swatches, comment }) => {
    const rows: string[] = [];
    for (let i = 0; i < swatches.length; i += 8) {
      rows.push('      ' + swatches.slice(i, i + 8).map((s) => `'${s}'`).join(', ') + ',');
    }
    return [
      '  {',
      ...(comment ? [`    // ${comment}`] : []),
      `    seasonId: '${seasonId}',`,
      `    source: '${source}',`,
      '    swatches: [',
      ...rows,
      '    ],',
      '  },',
    ].join('\n');
  });

  return `// Swatch palettes for each season.
// - source: 'seed'    = generated placeholder (scripts/generate-seed-palettes.ts)
// - source: 'curated' = real palette colors. \`npm run seed\` never touches these.
// To use your own palette for a season, replace its \`swatches\` array with your
// hex codes and set \`source\` to 'curated'.
import type { SeasonId } from './seasons';

export interface Palette {
  seasonId: SeasonId;
  source: 'seed' | 'curated'; // 'seed' = generated placeholder
  swatches: string[]; // "#RRGGBB", 40–250 per season
}

export const PALETTES: Palette[] = [
${blocks.join('\n')}
];
`;
}

/** Writes the full text of src/data/palettes.seed.ts (the placeholder backup). */
export function renderSeedFile(entries: PaletteEntry[]): string {
  const body = renderPalettesFile(entries);
  const array = body.slice(body.indexOf('export const PALETTES: Palette[] = ['));
  return `// AUTO-GENERATED by scripts/generate-seed-palettes.ts (npm run seed).
// Backup of the generated PLACEHOLDER palettes. The app does NOT use this file;
// it uses src/data/palettes.ts. See the README to switch a season back.
import type { Palette } from './palettes';

${array.replace('export const PALETTES: Palette[]', 'export const SEED_PALETTES: Palette[]')}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outPath = fileURLToPath(new URL('../src/data/palettes.seed.ts', import.meta.url));
  const entries: PaletteEntry[] = SEASONS.map((season) => {
    const r = generateSeedPalette(season);
    const g = r.grid;
    console.log(
      `${season.id.padEnd(14)} ${String(r.swatches.length).padStart(2)} swatches  ` +
        `grid ${g.hueStep}°/${g.lCount}L/${g.cCount}C  density ${(r.density * 100).toFixed(0)}%`,
    );
    return {
      seasonId: season.id,
      source: 'seed',
      swatches: r.swatches,
      comment: `grid: ${g.hueStep}° hue step, ${g.lCount} L* levels, ${g.cCount} C* levels`,
    };
  });
  writeFileSync(outPath, renderSeedFile(entries));
  console.log(`Wrote ${outPath}`);
}
