import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { averagePixels, fitWithin, readableTextOn } from '../lib/color';
import { CONFIG } from '../lib/config';

const LOUPE_CSS_PX = 104;
const LOUPE_ZOOM = 3;
const KEY_STEP = 0.01; // arrow keys move the sample point by 1% of the image (5% with Shift)

interface Point {
  x: number; // 0–1 across the image
  y: number; // 0–1 down the image
}

interface PhotoSamplerProps {
  onSample: (hex: string) => void;
}

export function PhotoSampler({ onSample }: PhotoSamplerProps) {
  const inputId = useId();
  const hintId = useId();
  const offscreenRef = useRef<HTMLCanvasElement | null>(null); // full-res (≤ 2048 px long edge) for sampling
  const displayRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [hasImage, setHasImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [sampled, setSampled] = useState<string | null>(null);

  /** Draw the full-res canvas into the visible one, sized to the container width. */
  const drawDisplay = useCallback(() => {
    const off = offscreenRef.current;
    const display = displayRef.current;
    const wrap = wrapRef.current;
    if (!off || !display || !wrap) return;
    const cssWidth = wrap.clientWidth;
    const cssHeight = (cssWidth * off.height) / off.width;
    const dpr = window.devicePixelRatio || 1;
    display.width = Math.round(cssWidth * dpr);
    display.height = Math.round(cssHeight * dpr);
    display.style.width = `${cssWidth}px`;
    display.style.height = `${cssHeight}px`;
    const ctx = display.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, display.width, display.height);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', drawDisplay);
    return () => window.removeEventListener('resize', drawDisplay);
  }, [drawDisplay]);

  const loadFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setPoint(null);
    setSampled(null);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode(); // modern browsers apply EXIF orientation to naturalWidth/Height
      // Downscale big phone photos (e.g. 12 MP) so sampling stays fast and memory-light.
      const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, CONFIG.maxSamplingEdgePx);
      const off = document.createElement('canvas');
      off.width = width;
      off.height = height;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas not available');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      offscreenRef.current = off;
      setHasImage(true);
    } catch {
      setError("Couldn't open that image. Try a JPEG or PNG.");
      setHasImage(false);
      offscreenRef.current = null;
    } finally {
      URL.revokeObjectURL(url);
      setLoading(false);
    }
  };

  // Draw once the canvas has mounted for a newly loaded image.
  useEffect(() => {
    if (hasImage) drawDisplay();
  }, [hasImage, drawDisplay]);

  const sampleAt = useCallback(
    (p: Point) => {
      const off = offscreenRef.current;
      const ctx = off?.getContext('2d', { willReadFrequently: true });
      if (!off || !ctx) return;
      // Map to full-res coordinates and read a sampleSizePx square around the tap.
      const size = CONFIG.sampleSizePx;
      const cx = Math.round(p.x * (off.width - 1));
      const cy = Math.round(p.y * (off.height - 1));
      const half = Math.floor(size / 2);
      // Pixels outside the image come back transparent and are skipped by averagePixels.
      const { data } = ctx.getImageData(cx - half, cy - half, size, size);
      const hex = averagePixels(data, CONFIG.dropBrightestPct);
      if (!hex) return;
      setPoint(p);
      setSampled(hex);
      onSample(hex);
    },
    [onSample],
  );

  // Redraw the loupe whenever the sample point moves.
  useEffect(() => {
    const off = offscreenRef.current;
    const loupe = loupeRef.current;
    const display = displayRef.current;
    if (!off || !loupe || !display || !point) return;
    const dpr = window.devicePixelRatio || 1;
    loupe.width = Math.round(LOUPE_CSS_PX * dpr);
    loupe.height = Math.round(LOUPE_CSS_PX * dpr);
    const ctx = loupe.getContext('2d');
    if (!ctx) return;

    // Source window: what LOUPE_CSS_PX / zoom CSS pixels of the display cover, in full-res pixels.
    const fullResPerCss = off.width / display.clientWidth;
    const srcSize = (LOUPE_CSS_PX / LOUPE_ZOOM) * fullResPerCss;
    const cx = point.x * off.width;
    const cy = point.y * off.height;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, loupe.width, loupe.height);
    ctx.drawImage(off, cx - srcSize / 2, cy - srcSize / 2, srcSize, srcSize, 0, 0, loupe.width, loupe.height);

    // Outline the area that was actually averaged.
    const sampleBox = (CONFIG.sampleSizePx / srcSize) * loupe.width;
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect((loupe.width - sampleBox) / 2, (loupe.height - sampleBox) / 2, sampleBox, sampleBox);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1 * dpr;
    ctx.strokeRect(
      (loupe.width - sampleBox) / 2 - dpr,
      (loupe.height - sampleBox) / 2 - dpr,
      sampleBox + 2 * dpr,
      sampleBox + 2 * dpr,
    );
  }, [point]);

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
    sampleAt(p);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return; // only drag-sample, not hover
    onPointerDown(e);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step = e.shiftKey ? KEY_STEP * 5 : KEY_STEP;
    const p = point ?? { x: 0.5, y: 0.5 };
    let next: Point | null = null;
    if (e.key === 'ArrowLeft') next = { ...p, x: p.x - step };
    if (e.key === 'ArrowRight') next = { ...p, x: p.x + step };
    if (e.key === 'ArrowUp') next = { ...p, y: p.y - step };
    if (e.key === 'ArrowDown') next = { ...p, y: p.y + step };
    if (e.key === 'Enter' || e.key === ' ') next = p;
    if (!next) return;
    e.preventDefault();
    sampleAt({ x: Math.min(1, Math.max(0, next.x)), y: Math.min(1, Math.max(0, next.y)) });
  };

  // Loupe sits above the finger; flips below near the top edge.
  const loupeStyle = (() => {
    const display = displayRef.current;
    if (!point || !display) return undefined;
    const left = point.x * display.clientWidth - LOUPE_CSS_PX / 2;
    const tapY = point.y * display.clientHeight;
    const above = tapY - LOUPE_CSS_PX - 24;
    const top = above >= 0 ? above : tapY + 24;
    const maxLeft = display.clientWidth - LOUPE_CSS_PX;
    return {
      left: `${Math.min(Math.max(0, left), Math.max(0, maxLeft))}px`,
      top: `${top}px`,
      width: `${LOUPE_CSS_PX}px`,
      height: `${LOUPE_CSS_PX}px`,
    };
  })();

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white hover:bg-indigo-800 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-500 dark:bg-indigo-500 dark:text-stone-950 dark:hover:bg-indigo-400"
        >
          {hasImage ? 'Choose another photo' : 'Choose or take a photo'}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void loadFile(file);
              e.target.value = ''; // allow re-picking the same file
            }}
          />
        </label>
        {loading && <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">Loading photo…</p>}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>

      {hasImage && (
        <>
          <p id={hintId} className="text-sm text-stone-600 dark:text-stone-400">
            Tap the fabric to sample it. Keyboard: arrow keys move the sample point.
          </p>
          <div ref={wrapRef} className="relative w-full touch-none select-none">
            <canvas
              ref={displayRef}
              tabIndex={0}
              role="img"
              aria-label="Uploaded photo. Tap or use arrow keys to sample a color."
              aria-describedby={hintId}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onKeyDown={onKeyDown}
              className="block cursor-crosshair rounded-lg"
            />
            {point && (
              <canvas
                ref={loupeRef}
                aria-hidden="true"
                className="pointer-events-none absolute rounded-full border-4 border-white shadow-lg"
                style={loupeStyle}
              />
            )}
          </div>
          {sampled && (
            <div className="flex items-center gap-3" aria-live="polite">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-lg border border-stone-300 dark:border-stone-700"
                style={{ backgroundColor: sampled, color: readableTextOn(sampled) }}
                aria-hidden="true"
              />
              <span>
                Sampled <span className="font-mono font-semibold">{sampled}</span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
