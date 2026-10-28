import type { Palette } from '../data/palettes';
import type { Season } from '../data/seasons';

interface PaletteViewProps {
  season: Season;
  palette: Palette | undefined;
  highlight?: string[]; // hex codes to outline, e.g. the nearest swatches to the current color
}

/** The whole palette for a season, so a fan deck or garment can be compared by eye. */
export function PaletteView({ season, palette, highlight = [] }: PaletteViewProps) {
  if (!palette) return null;
  const marked = new Set(highlight.map((h) => h.toLowerCase()));

  return (
    <section
      aria-labelledby="palette-heading"
      className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
    >
      <h2 id="palette-heading" className="text-sm font-semibold tracking-wide text-stone-600 uppercase dark:text-stone-400">
        Your palette
      </h2>
      <p className="mt-1 mb-4 text-sm text-stone-600 dark:text-stone-400">
        All {palette.swatches.length} {season.name} colors.
        {marked.size > 0 && ' Outlined: the closest matches to your color.'}
      </p>
      <ul
        className="grid grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] gap-1"
        aria-label={`${season.name} palette, ${palette.swatches.length} colors`}
      >
        {palette.swatches.map((hex) => {
          const isMarked = marked.has(hex.toLowerCase());
          return (
            <li
              key={hex}
              title={hex}
              className={`aspect-square rounded ${
                isMarked
                  ? 'ring-2 ring-stone-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-stone-900'
                  : ''
              }`}
              style={{ backgroundColor: hex }}
            />
          );
        })}
      </ul>
    </section>
  );
}
