// PURE scoring module: input in, results out. No React, no DOM, no storage.
// Kept self-contained so it can be reused later (e.g. in a browser extension).
import { converter, differenceCiede2000, type Lab65 } from 'culori';
import type { Palette } from '../data/palettes';
import { undertoneFamily, type Season, type SeasonId } from '../data/seasons';
import { hexToLch, parseHex, type Lch } from './color';
import { CONFIG } from './config';

export interface SeasonScore {
  seasonId: SeasonId;
  deltaE: number; // mean ΔE2000 of K nearest swatches
  matchPct: number; // 0–100, rounded to integer
  nearest: { hex: string; deltaE: number }[]; // K nearest, ascending
}

export type VerdictLevel = 'great' | 'okay' | 'avoid';

export interface Verdict {
  level: VerdictLevel;
  reason: string;
}

type Config = typeof CONFIG;

const toLab65 = converter('lab65');
const ciede2000 = differenceCiede2000();

// Swatch hex -> Lab, cached so repeated scoring doesn't re-parse every swatch.
const labCache = new Map<string, Lab65>();

function labOf(hex: string): Lab65 {
  let lab = labCache.get(hex);
  if (!lab) {
    const normalized = parseHex(hex);
    if (!normalized) throw new Error(`Invalid hex color: ${hex}`);
    const converted = toLab65(normalized);
    if (!converted) throw new Error(`Could not convert ${hex}`);
    lab = converted;
    labCache.set(hex, lab);
  }
  return lab;
}

/** match% = max(0, round(100 - slope * ΔE)), clamped to 0–100. */
export function matchPctFor(deltaE: number, config: Config = CONFIG): number {
  return Math.min(100, Math.max(0, Math.round(100 - config.matchPctSlope * deltaE)));
}

/** Great: ΔE < greatMax. Okay: greatMax ≤ ΔE ≤ okayMax. Avoid: ΔE > okayMax. */
export function levelForDeltaE(deltaE: number, config: Config = CONFIG): VerdictLevel {
  if (deltaE < config.greatMaxDeltaE) return 'great';
  if (deltaE <= config.okayMaxDeltaE) return 'okay';
  return 'avoid';
}

/** Score one color against one palette. */
export function scorePalette(hex: string, palette: Palette, config: Config = CONFIG): SeasonScore {
  const input = labOf(hex);
  const distances = palette.swatches
    .map((swatch) => ({ hex: swatch, deltaE: ciede2000(input, labOf(swatch)) }))
    .sort((a, b) => a.deltaE - b.deltaE);
  const nearest = distances.slice(0, config.nearestK);
  const deltaE = nearest.length
    ? nearest.reduce((sum, n) => sum + n.deltaE, 0) / nearest.length
    : Number.POSITIVE_INFINITY;
  return { seasonId: palette.seasonId, deltaE, matchPct: matchPctFor(deltaE, config), nearest };
}

/** Score a color against every season's palette. Sorted best (lowest ΔE) first. */
export function scoreAllSeasons(hex: string, palettes: Palette[], config: Config = CONFIG): SeasonScore[] {
  return palettes.map((p) => scorePalette(hex, p, config)).sort((a, b) => a.deltaE - b.deltaE);
}

/**
 * One-line reason, checked in the spec's priority order (Section 7, step 6).
 * Values are rounded to integers before comparing, so the message never reads
 * like "L* 75 vs max 75".
 */
export function reasonFor(color: Lch, season: Season, bestSeason: Season, level: VerdictLevel): string {
  const l = Math.round(color.l);
  const c = Math.round(color.c);
  const [lMin, lMax] = season.lRange;
  const [cMin, cMax] = season.cRange;

  if (l > lMax) return `Too light: L* ${l} vs ${season.name} max ${lMax}`;
  if (l < lMin) return `Too dark: L* ${l} vs ${season.name} min ${lMin}`;
  if (c > cMax) return `Too bright: C* ${c} vs ${season.name} max ${cMax}`;
  if (c < cMin) return `Too muted: C* ${c} vs ${season.name} min ${cMin}`;

  const bestFamily = undertoneFamily(bestSeason.undertone);
  if (bestFamily !== undertoneFamily(season.undertone)) {
    return `Leans ${bestFamily}: closest to ${bestSeason.name}`;
  }

  if (level === 'great') return 'Close to your palette';
  if (level === 'okay') return 'Near the edge of your palette';
  return 'Far from your palette'; // not specified in the spec; see DECISIONS.md
}

export function verdictFor(
  hex: string,
  seasonId: SeasonId,
  palettes: Palette[],
  seasons: Season[],
  config: Config = CONFIG,
): { score: SeasonScore; verdict: Verdict; ranking: SeasonScore[] } {
  const ranking = scoreAllSeasons(hex, palettes, config);
  const score = ranking.find((s) => s.seasonId === seasonId);
  const season = seasons.find((s) => s.id === seasonId);
  if (!score || !season) throw new Error(`No palette or season data for ${seasonId}`);

  const best = seasons.find((s) => s.id === ranking[0]!.seasonId)!;
  const level = levelForDeltaE(score.deltaE, config);
  const reason = reasonFor(hexToLch(hex), season, best, level);
  return { score, verdict: { level, reason }, ranking };
}
