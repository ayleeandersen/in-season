import { useEffect, useRef } from 'react';
import { PALETTES } from '../data/palettes';
import { SEASONS, type SeasonFamily, type SeasonId } from '../data/seasons';

const FAMILIES: { id: SeasonFamily; label: string }[] = [
  { id: 'spring', label: 'Spring' },
  { id: 'summer', label: 'Summer' },
  { id: 'autumn', label: 'Autumn' },
  { id: 'winter', label: 'Winter' },
];

const STRIP_SIZE = 8;

/** A few swatches spread evenly through the palette, as a preview strip. */
function previewStrip(seasonId: SeasonId): string[] {
  const swatches = PALETTES.find((p) => p.seasonId === seasonId)?.swatches ?? [];
  if (swatches.length <= STRIP_SIZE) return swatches;
  return Array.from({ length: STRIP_SIZE }, (_, i) => swatches[Math.floor((i * swatches.length) / STRIP_SIZE)]!);
}

interface SeasonListProps {
  selected: SeasonId | null;
  onSelect: (id: SeasonId) => void;
}

function SeasonList({ selected, onSelect }: SeasonListProps) {
  return (
    <div className="space-y-5">
      {FAMILIES.map((family) => (
        <fieldset key={family.id}>
          <legend className="mb-2 text-sm font-semibold tracking-wide text-stone-600 uppercase dark:text-stone-400">
            {family.label}
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SEASONS.filter((s) => s.family === family.id).map((season) => {
              const isSelected = season.id === selected;
              return (
                <button
                  key={season.id}
                  type="button"
                  aria-pressed={isSelected}
                  data-season={season.id}
                  onClick={() => onSelect(season.id)}
                  className={`flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600 dark:border-indigo-400 dark:bg-indigo-950 dark:ring-indigo-400'
                      : 'border-stone-300 bg-white hover:border-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:hover:border-stone-500'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{season.name}</span>
                    {isSelected && (
                      <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Selected</span>
                    )}
                  </span>
                  <span className="text-sm text-stone-600 dark:text-stone-400">
                    {season.value} · {season.chroma} · {season.undertone.replace('-', ' ')}
                  </span>
                  <span className="flex h-4 overflow-hidden rounded" aria-hidden="true">
                    {previewStrip(season.id).map((hex) => (
                      <span key={hex} className="flex-1" style={{ backgroundColor: hex }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/** Full-page picker shown on first launch, before anything else. */
export function SeasonPickerPage({ onSelect }: { onSelect: (id: SeasonId) => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
        Which season are you?
      </h1>
      <p className="mt-2 mb-6 text-stone-600 dark:text-stone-400">
        Pick your color season. You can change it any time from the top of the screen.
      </p>
      <SeasonList selected={null} onSelect={onSelect} />
    </main>
  );
}

interface SeasonPickerDialogProps {
  open: boolean;
  selected: SeasonId;
  onSelect: (id: SeasonId) => void;
  onClose: () => void;
}

/** Modal picker opened from the header chip. Native <dialog> gives focus trapping and Escape. */
export function SeasonPickerDialog({ open, selected, onSelect, onClose }: SeasonPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>(`[data-season="${selected}"]`)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, selected]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose(); // click on the backdrop
      }}
      aria-labelledby="season-picker-title"
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl bg-stone-50 p-0 text-stone-900 shadow-xl dark:bg-stone-950 dark:text-stone-100"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-3 dark:border-stone-800 dark:bg-stone-950">
        <h2 id="season-picker-title" className="text-lg font-bold">
          Choose your season
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          Close
        </button>
      </div>
      <div className="p-4">
        <SeasonList selected={selected} onSelect={onSelect} />
      </div>
    </dialog>
  );
}
