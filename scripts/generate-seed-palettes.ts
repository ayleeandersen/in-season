/**
 * Generates PLACEHOLDER palettes for every season and writes src/data/palettes.ts.
 * Run with: npm run seed
 *
 * See spec Section 5. Curated palettes from the owner replace these later.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SEASONS, type Season } from '../src/data/seasons';
import { deltaE, lchToHex } from '../src/lib/color';
import { CONFIG } from '../src/lib/config';

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
export function density(swatches: string[], maxDeltaE = CONFIG.greatMaxDeltaE): number {
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
export function generateSeedPalette(season: Season): { swatches: string[]; grid: GridSpec; density: number } {
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

function render(results: { season: Season; swatches: string[]; grid: GridSpec }[]): string {
  const blocks = results.map(({ season, swatches, grid }) => {
    const rows: string[] = [];
    for (let i = 0; i < swatches.length; i += 8) {
      rows.push('      ' + swatches.slice(i, i + 8).map((s) => `'${s}'`).join(', ') + ',');
    }
    return [
      '  {',
      `    // grid: ${grid.hueStep}° hue step, ${grid.lCount} L* levels, ${grid.cCount} C* levels`,
      `    seasonId: '${season.id}',`,
      `    source: 'seed',`,
      '    swatches: [',
      ...rows,
      '    ],',
      '  },',
    ].join('\n');
  });

  return `// AUTO-GENERATED by scripts/generate-seed-palettes.ts (npm run seed).
// These are PLACEHOLDER palettes. To use a curated palette for a season, replace
// its \`swatches\` array with your hex codes and change \`source\` to 'curated'.
// Note: re-running \`npm run seed\` overwrites this whole file.
import type { SeasonId } from './seasons';

export interface Palette {
  seasonId: SeasonId;
  source: 'seed' | 'curated'; // 'seed' = generated placeholder
  swatches: string[]; // "#RRGGBB", 40–60 per season
}

export const PALETTES: Palette[] = [
${blocks.join('\n')}
];
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outPath = fileURLToPath(new URL('../src/data/palettes.ts', import.meta.url));
  const results = SEASONS.map((season) => ({ season, ...generateSeedPalette(season) }));
  writeFileSync(outPath, render(results));
  for (const r of results) {
    const g = r.grid;
    console.log(
      `${r.season.id.padEnd(14)} ${String(r.swatches.length).padStart(2)} swatches  ` +
        `grid ${g.hueStep}°/${g.lCount}L/${g.cCount}C  density ${(r.density * 100).toFixed(0)}%`,
    );
  }
  console.log(`Wrote ${outPath}`);
}
