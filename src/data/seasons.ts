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

// Starting values from the spec (Section 4). These are approximate and meant
// to be tuned, so edit them here rather than in any logic.
export const SEASONS: Season[] = [
  { id: 'light-spring', name: 'Light Spring', family: 'spring', undertone: 'warm-neutral', value: 'Light', chroma: 'Medium', lRange: [65, 90], cRange: [25, 55] },
  { id: 'true-spring', name: 'True Spring', family: 'spring', undertone: 'warm', value: 'Medium', chroma: 'Bright', lRange: [50, 80], cRange: [45, 80] },
  { id: 'bright-spring', name: 'Bright Spring', family: 'spring', undertone: 'warm-neutral', value: 'Medium', chroma: 'Very bright', lRange: [45, 75], cRange: [55, 90] },
  { id: 'light-summer', name: 'Light Summer', family: 'summer', undertone: 'cool-neutral', value: 'Light', chroma: 'Soft–medium', lRange: [65, 90], cRange: [15, 40] },
  { id: 'true-summer', name: 'True Summer', family: 'summer', undertone: 'cool', value: 'Light–medium', chroma: 'Soft–medium', lRange: [45, 80], cRange: [15, 45] },
  { id: 'soft-summer', name: 'Soft Summer', family: 'summer', undertone: 'cool-neutral', value: 'Medium', chroma: 'Muted', lRange: [35, 75], cRange: [8, 30] },
  { id: 'soft-autumn', name: 'Soft Autumn', family: 'autumn', undertone: 'warm-neutral', value: 'Medium', chroma: 'Muted', lRange: [35, 75], cRange: [10, 35] },
  { id: 'true-autumn', name: 'True Autumn', family: 'autumn', undertone: 'warm', value: 'Medium–dark', chroma: 'Medium', lRange: [30, 65], cRange: [25, 55] },
  { id: 'dark-autumn', name: 'Dark Autumn', family: 'autumn', undertone: 'warm-neutral', value: 'Dark', chroma: 'Medium–rich', lRange: [15, 50], cRange: [25, 60] },
  { id: 'dark-winter', name: 'Dark Winter', family: 'winter', undertone: 'cool-neutral', value: 'Dark', chroma: 'Medium–rich', lRange: [15, 50], cRange: [25, 65] },
  { id: 'true-winter', name: 'True Winter', family: 'winter', undertone: 'cool', value: 'Medium–dark', chroma: 'Bright', lRange: [20, 70], cRange: [45, 85] },
  { id: 'bright-winter', name: 'Bright Winter', family: 'winter', undertone: 'cool-neutral', value: 'Medium', chroma: 'Very bright', lRange: [25, 75], cRange: [55, 95] },
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
