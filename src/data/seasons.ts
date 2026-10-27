export type SeasonId =
  | 'light-spring' | 'true-spring' | 'bright-spring'
  | 'light-summer' | 'true-summer' | 'soft-summer'
  | 'soft-autumn' | 'true-autumn' | 'dark-autumn'
  | 'dark-winter' | 'true-winter' | 'bright-winter';

export type Undertone = 'warm' | 'warm-neutral' | 'cool' | 'cool-neutral';

export type SeasonFamily = 'spring' | 'summer' | 'autumn' | 'winter';

export interface Season {
  id: SeasonId;
  name: string;           // "Soft Summer"
  family: SeasonFamily;
  undertone: Undertone;
  value: string;          // human label, e.g. "Medium"
  chroma: string;         // human label, e.g. "Muted"
  lRange: [number, number]; // L* min/max
  cRange: [number, number]; // C* min/max
}

// L*/C* ranges cover the middle 90% (5th–95th percentile) of each season's
// curated palette in palettes.ts. They drive the "Too light / Too bright" reason
// line. The spec's original starting values are recorded in DECISIONS.md.
// Tune them here rather than in any logic.
export const SEASONS: Season[] = [
  { id: 'light-spring', name: 'Light Spring', family: 'spring', undertone: 'warm-neutral', value: 'Light', chroma: 'Medium', lRange: [41, 87], cRange: [7, 53] },
  { id: 'true-spring', name: 'True Spring', family: 'spring', undertone: 'warm', value: 'Medium', chroma: 'Bright', lRange: [37, 87], cRange: [10, 61] },
  { id: 'bright-spring', name: 'Bright Spring', family: 'spring', undertone: 'warm-neutral', value: 'Medium', chroma: 'Very bright', lRange: [31, 85], cRange: [7, 62] },
  { id: 'light-summer', name: 'Light Summer', family: 'summer', undertone: 'cool-neutral', value: 'Light', chroma: 'Soft–medium', lRange: [38, 80], cRange: [4, 52] },
  { id: 'true-summer', name: 'True Summer', family: 'summer', undertone: 'cool', value: 'Light–medium', chroma: 'Soft–medium', lRange: [32, 81], cRange: [4, 42] },
  { id: 'soft-summer', name: 'Soft Summer', family: 'summer', undertone: 'cool-neutral', value: 'Medium', chroma: 'Muted', lRange: [33, 81], cRange: [5, 46] },
  { id: 'soft-autumn', name: 'Soft Autumn', family: 'autumn', undertone: 'warm-neutral', value: 'Medium', chroma: 'Muted', lRange: [35, 83], cRange: [6, 40] },
  { id: 'true-autumn', name: 'True Autumn', family: 'autumn', undertone: 'warm', value: 'Medium–dark', chroma: 'Medium', lRange: [29, 82], cRange: [11, 53] },
  { id: 'dark-autumn', name: 'Dark Autumn', family: 'autumn', undertone: 'warm-neutral', value: 'Dark', chroma: 'Medium–rich', lRange: [27, 82], cRange: [7, 51] },
  { id: 'dark-winter', name: 'Dark Winter', family: 'winter', undertone: 'cool-neutral', value: 'Dark', chroma: 'Medium–rich', lRange: [24, 83], cRange: [2, 53] },
  { id: 'true-winter', name: 'True Winter', family: 'winter', undertone: 'cool', value: 'Medium–dark', chroma: 'Bright', lRange: [29, 88], cRange: [2, 59] },
  { id: 'bright-winter', name: 'Bright Winter', family: 'winter', undertone: 'cool-neutral', value: 'Medium', chroma: 'Very bright', lRange: [29, 86], cRange: [3, 65] },
];

export const SEASON_IDS: SeasonId[] = SEASONS.map((s) => s.id);

export function getSeason(id: SeasonId, seasons: Season[] = SEASONS): Season {
  const season = seasons.find((s) => s.id === id);
  if (!season) throw new Error(`Unknown season: ${id}`);
  return season;
}

export function isSeasonId(value: unknown): value is SeasonId {
  return typeof value === 'string' && (SEASON_IDS as string[]).includes(value);
}

/** Warm vs cool family, ignoring the "-neutral" qualifier. */
export function undertoneFamily(u: Undertone): 'warm' | 'cool' {
  return u.startsWith('warm') ? 'warm' : 'cool';
}
