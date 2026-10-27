import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { parseHex } from '../lib/color';
import { PhotoSampler } from './PhotoSampler';

type Tab = 'manual' | 'photo';

const TABS: { id: Tab; label: string }[] = [
  { id: 'manual', label: 'Hex / Picker' },
  { id: 'photo', label: 'Photo' },
];

const DEFAULT_PICKER_HEX = '#7a8a99';

interface ColorInputProps {
  hex: string | null;
  onChange: (hex: string) => void;
}

export function ColorInput({ hex, onChange }: ColorInputProps) {
  const [tab, setTab] = useState<Tab>('manual');
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ manual: null, photo: null });
  const baseId = useId();

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = TABS.length - 1;
    const nextTab = TABS[next]!.id;
    setTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return (
    <section
      aria-label="Color to check"
      className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
    >
      <div role="tablist" aria-label="Color input method" className="mb-4 flex rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={onTabKeyDown}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                selected
                  ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-950 dark:text-stone-100'
                  : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-manual`}
        aria-labelledby={`${baseId}-tab-manual`}
        hidden={tab !== 'manual'}
      >
        <HexAndPicker hex={hex} onChange={onChange} />
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-photo`}
        aria-labelledby={`${baseId}-tab-photo`}
        hidden={tab !== 'photo'}
      >
        <PhotoSampler onSample={onChange} />
      </div>
    </section>
  );
}

function HexAndPicker({ hex, onChange }: ColorInputProps) {
  const [text, setText] = useState(hex ?? '');
  const [showError, setShowError] = useState(false);
  const inputId = useId();
  const errorId = useId();
  const pickerId = useId();

  // Keep the text field in sync when the color changes elsewhere (picker, photo).
  useEffect(() => {
    if (hex && parseHex(text) !== hex) {
      setText(hex);
      setShowError(false);
    }
    // Only react to outside changes of `hex`, not to typing.
  }, [hex]);

  const parsed = parseHex(text);
  const invalid = text.trim() !== '' && parsed === null;

  const handleText = (value: string) => {
    setText(value);
    const next = parseHex(value);
    if (next) {
      setShowError(false);
      if (next !== hex) onChange(next);
    }
  };

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
          Hex code
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="#7a8a99"
          value={text}
          onChange={(e) => handleText(e.target.value)}
          onBlur={() => setShowError(invalid)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setShowError(invalid);
          }}
          aria-invalid={showError && invalid}
          aria-describedby={errorId}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 font-mono text-base dark:bg-stone-950 ${
            showError && invalid
              ? 'border-red-700 dark:border-red-400'
              : 'border-stone-400 dark:border-stone-600'
          }`}
        />
        <p id={errorId} aria-live="polite" className="mt-1 min-h-5 text-sm text-red-700 dark:text-red-300">
          {showError && invalid ? 'Use 3 or 6 hex digits, like #7a8a99 or 7a8.' : ''}
        </p>
      </div>
      <div className="mb-6 flex flex-col items-center">
        <label htmlFor={pickerId} className="mb-1 block text-sm font-medium">
          Picker
        </label>
        <input
          id={pickerId}
          type="color"
          value={hex ?? DEFAULT_PICKER_HEX}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="h-11 w-14 cursor-pointer rounded-lg border border-stone-400 bg-transparent p-1 dark:border-stone-600"
        />
      </div>
    </div>
  );
}
