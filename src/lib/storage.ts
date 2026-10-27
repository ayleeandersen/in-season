import { isSeasonId, type SeasonId } from '../data/seasons';

const MY_SEASON_KEY = 'colorSeason.mySeason';

// localStorage can throw (private mode, blocked storage), so every access is guarded.
export function loadMySeason(): SeasonId | null {
  try {
    const value = window.localStorage.getItem(MY_SEASON_KEY);
    return isSeasonId(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveMySeason(id: SeasonId): void {
  try {
    window.localStorage.setItem(MY_SEASON_KEY, id);
  } catch {
    // Storage unavailable: the choice still works for this session.
  }
}
