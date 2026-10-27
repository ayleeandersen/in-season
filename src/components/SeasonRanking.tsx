import { SEASONS, type SeasonId } from '../data/seasons';
import { CONFIG } from '../lib/config';
import type { SeasonScore } from '../lib/score';

interface SeasonRankingProps {
  ranking: SeasonScore[]; // sorted best first
  mySeasonId: SeasonId;
}

const nameOf = (id: SeasonId) => SEASONS.find((s) => s.id === id)?.name ?? id;

export function SeasonRanking({ ranking, mySeasonId }: SeasonRankingProps) {
  const [first, second] = ranking;
  if (!first) return null;
  const isTie = second !== undefined && first.matchPct - second.matchPct <= CONFIG.tieWindowPct;

  return (
    <section
      aria-labelledby="ranking-heading"
      className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
    >
      <h2 id="ranking-heading" className="text-sm font-semibold tracking-wide text-stone-600 uppercase dark:text-stone-400">
        Which season is this?
      </h2>
      <p className="mt-1 mb-4 text-lg font-semibold">
        {isTie ? `Between ${nameOf(first.seasonId)} and ${nameOf(second.seasonId)}` : nameOf(first.seasonId)}
      </p>
      <ol className="space-y-2">
        {ranking.map((s) => {
          const mine = s.seasonId === mySeasonId;
          return (
            <li
              key={s.seasonId}
              className={`rounded-lg px-2 py-1.5 ${mine ? 'bg-indigo-50 ring-2 ring-indigo-600 dark:bg-indigo-950 dark:ring-indigo-400' : ''}`}
            >
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className={mine ? 'font-bold' : 'font-medium'}>
                  {nameOf(s.seasonId)}
                  {mine && <span className="ml-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Your season</span>}
                </span>
                <span className="font-mono tabular-nums">{s.matchPct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800" aria-hidden="true">
                <div
                  className={`h-full rounded-full ${mine ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-stone-500 dark:bg-stone-400'}`}
                  style={{ width: `${s.matchPct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
