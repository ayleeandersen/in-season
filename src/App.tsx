import { useMemo, useRef, useState } from 'react';
import { ColorInput } from './components/ColorInput';
import { SeasonPickerDialog, SeasonPickerPage } from './components/SeasonPicker';
import { SeasonRanking } from './components/SeasonRanking';
import { VerdictCard } from './components/VerdictCard';
import { PALETTES } from './data/palettes';
import { SEASONS, getSeason, type SeasonId } from './data/seasons';
import { verdictFor } from './lib/score';
import { loadMySeason, saveMySeason } from './lib/storage';

export default function App() {
  const [mySeason, setMySeason] = useState<SeasonId | null>(() => loadMySeason());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hex, setHex] = useState<string | null>(null);
  const chipRef = useRef<HTMLButtonElement>(null);

  const chooseSeason = (id: SeasonId) => {
    setMySeason(id);
    saveMySeason(id);
    setPickerOpen(false);
    chipRef.current?.focus();
  };

  const result = useMemo(
    () => (hex && mySeason ? verdictFor(hex, mySeason, PALETTES, SEASONS) : null),
    [hex, mySeason],
  );

  // First launch: show the picker before anything else.
  if (!mySeason) return <SeasonPickerPage onSelect={chooseSeason} />;

  const season = getSeason(mySeason);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-lg font-bold">In Season</h1>
          <button
            ref={chipRef}
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Your season: ${season.name}. Change season`}
            className="shrink-0 rounded-full border border-indigo-600 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-200 dark:hover:bg-indigo-900"
          >
            {season.name} <span aria-hidden="true">▾</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-4 pb-12">
        <ColorInput hex={hex} onChange={setHex} />

        {result && hex ? (
          <>
            <VerdictCard
              hex={hex}
              season={season}
              score={result.score}
              verdict={result.verdict}
            />
            <SeasonRanking ranking={result.ranking} mySeasonId={mySeason} />
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-stone-400 p-6 text-center text-stone-600 dark:border-stone-600 dark:text-stone-400">
            Enter a hex code, use the picker, or tap a photo to check a color against {season.name}.
          </p>
        )}
      </main>

      <SeasonPickerDialog
        open={pickerOpen}
        selected={mySeason}
        onSelect={chooseSeason}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
