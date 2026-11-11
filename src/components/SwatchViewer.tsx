import { useEffect, useRef, type TouchEvent } from 'react';
import { readableTextOn } from '../lib/color';

interface SwatchViewerProps {
  swatches: string[]; // the palette being browsed
  index: number | null; // which swatch is open; null = closed
  seasonName: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const SWIPE_MIN_PX = 50;

/**
 * Full-screen view of one palette color, big enough to hold a fan deck or
 * garment against. Previous/next (buttons, arrow keys or swipe) step through the palette.
 */
export function SwatchViewer({ swatches, index, seasonName, onIndexChange, onClose }: SwatchViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStartX = useRef<number | null>(null);
  const open = index !== null;
  const hex = index !== null ? swatches[index] : undefined;
  const count = swatches.length;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const step = (delta: number) => {
    if (index === null || count === 0) return;
    onIndexChange((index + delta + count) % count);
  };

  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStartX.current;
    const end = e.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (start === null || end === undefined) return;
    if (end - start > SWIPE_MIN_PX) step(-1);
    else if (start - end > SWIPE_MIN_PX) step(1);
  };

  const text = hex ? readableTextOn(hex) : '#000000';
  const buttonClass =
    'rounded-full border-2 px-4 py-2 text-base font-semibold backdrop-blur-sm transition-opacity hover:opacity-80';
  const buttonStyle = { borderColor: text, color: text };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') step(-1);
        if (e.key === 'ArrowRight') step(1);
      }}
      aria-label={hex ? `${seasonName} color ${hex}` : 'Palette color'}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0"
    >
      {hex && (
        <div
          className="flex h-full flex-col justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
          style={{ backgroundColor: hex, color: text }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-2xl font-bold">{hex}</p>
              <p className="text-sm font-medium">
                {seasonName} · {index! + 1} of {count}
              </p>
            </div>
            <button type="button" onClick={onClose} className={buttonClass} style={buttonStyle} autoFocus>
              Close
            </button>
          </div>

          {count > 1 && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => step(-1)}
                className={buttonClass}
                style={buttonStyle}
                aria-label="Previous color"
              >
                <span aria-hidden="true">←</span> Prev
              </button>
              <span className="text-center text-sm font-medium">Swipe to browse</span>
              <button
                type="button"
                onClick={() => step(1)}
                className={buttonClass}
                style={buttonStyle}
                aria-label="Next color"
              >
                Next <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
