import type { Season } from '../data/seasons';
import { readableTextOn } from '../lib/color';
import type { SeasonScore, Verdict, VerdictLevel } from '../lib/score';
import { PlaceholderBadge } from './PlaceholderBadge';

// Always text + symbol, never color alone. Colors chosen for ≥ 4.5:1 contrast in both themes.
const LEVEL_STYLE: Record<VerdictLevel, { label: string; symbol: string; className: string }> = {
  great: {
    label: 'Great',
    symbol: '✓',
    className: 'bg-green-100 text-green-900 border-green-700 dark:bg-green-950 dark:text-green-200 dark:border-green-500',
  },
  okay: {
    label: 'Okay',
    symbol: '~',
    className: 'bg-amber-100 text-amber-900 border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-500',
  },
  avoid: {
    label: 'Avoid',
    symbol: '✕',
    className: 'bg-red-100 text-red-900 border-red-700 dark:bg-red-950 dark:text-red-200 dark:border-red-500',
  },
};

interface VerdictCardProps {
  hex: string;
  season: Season;
  score: SeasonScore;
  verdict: Verdict;
  isPlaceholder: boolean;
}

export function VerdictCard({ hex, season, score, verdict, isPlaceholder }: VerdictCardProps) {
  const style = LEVEL_STYLE[verdict.level];
  return (
    <section
      aria-labelledby="verdict-heading"
      className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
    >
      <div
        className="flex h-36 items-end justify-between p-4"
        style={{ backgroundColor: hex, color: readableTextOn(hex) }}
      >
        <span className="font-mono text-lg font-semibold">{hex}</span>
        <span className="text-sm font-medium">Sampled color</span>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <h2 id="verdict-heading" className="text-sm font-semibold tracking-wide text-stone-600 uppercase dark:text-stone-400">
            Is this in my season?
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-lg font-bold ${style.className}`}
            >
              <span aria-hidden="true">{style.symbol}</span>
              {style.label}
            </span>
            <span className="text-stone-700 dark:text-stone-300">
              for {season.name} · {score.matchPct}% match
            </span>
          </div>
          <p className="mt-2 text-base" aria-live="polite">
            {verdict.reason}
          </p>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Closest in your palette
            </h3>
            {isPlaceholder && <PlaceholderBadge />}
          </div>
          <ul className="grid grid-cols-3 gap-2">
            {score.nearest.map((n) => (
              <li key={n.hex} className="overflow-hidden rounded-lg border border-stone-200 dark:border-stone-700">
                <div className="h-12" style={{ backgroundColor: n.hex }} aria-hidden="true" />
                <div className="px-2 py-1.5 text-xs">
                  <div className="font-mono">{n.hex}</div>
                  <div className="text-stone-600 dark:text-stone-400">ΔE {n.deltaE.toFixed(1)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
