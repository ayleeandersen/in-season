# Build Spec: Color Season Checker

You are building a small web app from scratch. Read this whole spec before writing code. Work **one phase at a time**, in order. At the end of each phase, run the tests and confirm every acceptance criterion before you start the next phase. If anything here is ambiguous, pick the simplest option that meets the acceptance criteria and note it in `DECISIONS.md`.

---

## 1. What the app does

It answers two questions about any color:

1. **"Is this in my season?"** The user has saved one of the 12 seasonal color-analysis seasons (e.g., Soft Summer). Given a color, the app returns **Great / Okay / Avoid**, the 3 closest swatches from that season's palette, and a one-line reason.
2. **"Which season is this?"** Given a color, the app ranks all 12 seasons by match %.

A color can come from a **hex code**, a **color picker**, or a **tap on an uploaded photo**.

The primary user checks clothes while shopping, so the app is phone-first.

### Non-goals (do NOT build)

- No backend, no database, no accounts, no login, no analytics.
- No AI or vision API calls. All math runs locally in the browser.
- No determining a *person's* season from a selfie. The app classifies *colors* only.
- No live camera in the MVP. That comes in phase 4.

---

## 2. Tech stack (fixed)

| Concern | Use |
|---|---|
| Framework | React 18 + Vite + TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Color math | `culori` (LCh conversion, `differenceCiede2000`) |
| Tests | Vitest |
| Storage | `localStorage` (wrap every access in try/catch) |
| PWA | `vite-plugin-pwa` (phase 3) |
| Hosting | Vercel (static build) |

Don't add any other runtime dependencies without writing the reason in `DECISIONS.md`.

---

## 3. Project structure

```
src/
  data/
    seasons.ts         // season definitions + ranges (Section 4)
    palettes.ts        // hex swatches per season (Section 5)
  lib/
    color.ts           // hex/RGB <-> LCh helpers, sampling math
    score.ts           // PURE scoring module, no React, no DOM
    config.ts          // all tunable thresholds (Section 6)
  components/
    SeasonPicker.tsx
    ColorInput.tsx      // hex field + native color picker
    PhotoSampler.tsx    // phase 2
    VerdictCard.tsx
    SeasonRanking.tsx
  App.tsx
  main.tsx
tests/
  score.test.ts
  color.test.ts
  palettes.test.ts
scripts/
  generate-seed-palettes.ts
DECISIONS.md
README.md
```

`score.ts` must stay pure (input in, results out) so it can be reused later in a browser extension.

---

## 4. Season definitions (`src/data/seasons.ts`)

```ts
export type SeasonId =
  | 'light-spring' | 'true-spring' | 'bright-spring'
  | 'light-summer' | 'true-summer' | 'soft-summer'
  | 'soft-autumn' | 'true-autumn' | 'dark-autumn'
  | 'dark-winter' | 'true-winter' | 'bright-winter';

export type Undertone = 'warm' | 'warm-neutral' | 'cool' | 'cool-neutral';

export interface Season {
  id: SeasonId;
  name: string;           // "Soft Summer"
  family: 'spring' | 'summer' | 'autumn' | 'winter';
  undertone: Undertone;
  value: string;          // human label, e.g. "Medium"
  chroma: string;         // human label, e.g. "Muted"
  lRange: [number, number]; // L* min/max
  cRange: [number, number]; // C* min/max
}
```

Use these starting values. They are approximate and will be tuned later, so keep them in data, not hard-coded in logic.

| id | name | undertone | value | chroma | L* range | C* range |
|---|---|---|---|---|---|---|
| light-spring | Light Spring | warm-neutral | Light | Medium | 65–90 | 25–55 |
| true-spring | True Spring | warm | Medium | Bright | 50–80 | 45–80 |
| bright-spring | Bright Spring | warm-neutral | Medium | Very bright | 45–75 | 55–90 |
| light-summer | Light Summer | cool-neutral | Light | Soft–medium | 65–90 | 15–40 |
| true-summer | True Summer | cool | Light–medium | Soft–medium | 45–80 | 15–45 |
| soft-summer | Soft Summer | cool-neutral | Medium | Muted | 35–75 | 8–30 |
| soft-autumn | Soft Autumn | warm-neutral | Medium | Muted | 35–75 | 10–35 |
| true-autumn | True Autumn | warm | Medium–dark | Medium | 30–65 | 25–55 |
| dark-autumn | Dark Autumn | warm-neutral | Dark | Medium–rich | 15–50 | 25–60 |
| dark-winter | Dark Winter | cool-neutral | Dark | Medium–rich | 15–50 | 25–65 |
| true-winter | True Winter | cool | Medium–dark | Bright | 20–70 | 45–85 |
| bright-winter | Bright Winter | cool-neutral | Medium | Very bright | 25–75 | 55–95 |

---

## 5. Palette data (`src/data/palettes.ts`)

```ts
export interface Palette {
  seasonId: SeasonId;
  source: 'seed' | 'curated';  // 'seed' = generated placeholder
  swatches: string[];           // "#RRGGBB", 40–60 per season
}
```

**The owner will supply curated palettes later.** Until then, write `scripts/generate-seed-palettes.ts` to produce **placeholder** palettes:

- For each season, sample LCh points: hue 0–345 in steps of 15, three L* values evenly spaced inside `lRange`, and two C* values inside `cRange`.
- Bias the hue toward warm or cool. For `warm`/`warm-neutral` seasons, shift each hue 10° toward 70° (yellow). For `cool`/`cool-neutral`, shift 10° toward 260° (blue). Use 15° for pure `warm`/`cool` and 8° for the neutrals.
- Convert to sRGB, drop out-of-gamut colors (don't clamp them), dedupe, and keep up to 60 per season.
- Write the output to `palettes.ts` with `source: 'seed'`.

The UI must show a small "Placeholder palette" badge for any season whose `source` is `'seed'`.

The owner must be able to replace any season's swatches by editing one array. Add instructions for that to the README.

---

## 6. Tunable config (`src/lib/config.ts`)

```ts
export const CONFIG = {
  sampleSizePx: 15,          // square averaged around a photo tap
  dropBrightestPct: 0.10,    // ignore highlights/sheen when sampling
  nearestK: 3,               // swatches averaged per season score
  greatMaxDeltaE: 6,         // < 6  => Great
  okayMaxDeltaE: 12,         // 6–12 => Okay, > 12 => Avoid
  matchPctSlope: 5,          // match% = max(0, 100 - slope * deltaE)
  tieWindowPct: 3,           // show top-2 when within this many points
};
```

All thresholds live here. No magic numbers anywhere else.

---

## 7. Scoring algorithm (`src/lib/score.ts`)

```ts
export interface SeasonScore {
  seasonId: SeasonId;
  deltaE: number;           // mean ΔE2000 of K nearest swatches
  matchPct: number;         // 0–100, rounded to integer
  nearest: { hex: string; deltaE: number }[]; // K nearest, ascending
}

export interface Verdict {
  level: 'great' | 'okay' | 'avoid';
  reason: string;
}

export function scoreAllSeasons(hex: string, palettes: Palette[]): SeasonScore[]; // sorted best first
export function verdictFor(hex: string, seasonId: SeasonId, palettes: Palette[], seasons: Season[]): { score: SeasonScore; verdict: Verdict };
```

Steps:

1. Convert the input hex to LCh (culori `lch`, D65).
2. For each season, compute ΔE2000 (`differenceCiede2000()`) from the input to every swatch. Take the K nearest and average them to get `deltaE`.
3. `matchPct = max(0, round(100 - matchPctSlope * deltaE))`.
4. Sort the seasons by `deltaE` ascending.
5. **Verdict level** comes from the saved season's `deltaE` and the config thresholds.
6. **Reason** (one line, plain English). Check in this order and report the first that applies:
   - L* above `lRange[1]` → `"Too light: L* {x} vs {season} max {y}"`
   - L* below `lRange[0]` → `"Too dark: …"`
   - C* above `cRange[1]` → `"Too bright: C* {x} vs {season} max {y}"`
   - C* below `cRange[0]` → `"Too muted: …"`
   - If the best-matching season has the opposite undertone family (warm vs cool) → `"Leans {warm|cool}: closest to {best season}"`
   - Otherwise, for Great → `"Close to your palette"`, and for Okay → `"Near the edge of your palette"`.
   - Round the numbers in reasons to integers.

---

## 8. Photo sampling (`PhotoSampler.tsx`, phase 2)

- Accept an image upload (`accept="image/*"`, so phones can use the camera roll or camera).
- Draw it to a canvas scaled to fit the screen width. Keep a full-resolution offscreen canvas for sampling.
- On tap or click, map the tap to full-res coordinates. Read a `sampleSizePx` × `sampleSizePx` square with `getImageData`.
- Sort those pixels by luminance, drop the brightest `dropBrightestPct`, and average the rest in **linear RGB** (convert from sRGB, average, convert back).
- Show a circular loupe (about 3× zoom) at the tap point and the resulting swatch with its hex code.
- Feed the hex into the same scoring as the hex input.

---

## 9. UI

Single page, phone-first (designed at 375 px wide, usable up to desktop), with a light theme and a dark theme that follows the system setting.

1. **Header.** App name, plus the saved season as a tappable chip that opens the SeasonPicker.
2. **SeasonPicker.** 12 options grouped by family. The choice persists to `localStorage` under `colorSeason.mySeason`. On first launch, show the picker before anything else.
3. **ColorInput.** Tabs: *Hex / Picker* | *Photo*. A hex field accepts `#abc`, `abc`, `#aabbcc` and `aabbcc`, and shows inline validation.
4. **VerdictCard.** The sampled color as a big swatch, the verdict label (Great = green, Okay = amber, Avoid = red, always shown with text and never by color alone), the reason line, and the 3 nearest swatches with their ΔE.
5. **SeasonRanking.** All 12 seasons as horizontal bars of match %, best first, with the user's season highlighted. If the top 2 are within `tieWindowPct`, show "Between {A} and {B}".

Accessibility: all controls keyboard-reachable, visible focus rings, labels on inputs, and text contrast of at least 4.5:1.

---

## 10. Phases and acceptance criteria

### Phase 0: Scaffold and data

- [ ] Vite + React + TS + Tailwind + Vitest scaffolded; `npm run dev`, `npm run build` and `npm test` all work.
- [ ] `seasons.ts` matches Section 4 exactly.
- [ ] Seed generator runs (`npm run seed`) and writes `palettes.ts`.
- [ ] `palettes.test.ts`: every season has 40–60 valid `#RRGGBB` swatches, there are no duplicates within a season, and every seed swatch falls inside its season's L*/C* ranges (±1 tolerance).

### Phase 1: Hex input and scoring

- [ ] `score.ts` is implemented per Section 7, with no imports from React or the DOM.
- [ ] `score.test.ts` covers:
  - Every swatch's nearest match in its own season is itself (ΔE < 0.5).
  - **Palette density (leave-one-out):** remove each swatch from its own palette, then find its nearest remaining swatch in that season. ΔE must be below `greatMaxDeltaE` for ≥ 95% of swatches across all seasons. If this fails, the palette has gaps, so add swatches rather than loosening the threshold.
  - Verdict boundaries: ΔE 5.99 → great, 6 → okay, 12 → okay, 12.01 → avoid.
  - `matchPct` never goes below 0 or above 100.
  - Reason priority order follows Section 7, step 6.
  - Hex parsing handles 3- and 6-digit input, with or without `#`, and is case-insensitive.
- [ ] UI from Section 9 works with hex and picker input.
- [ ] Scoring for one color finishes in under 50 ms (log `performance.now()` in a test).

### Phase 2: Photo sampling

- [ ] Section 8 is implemented.
- [ ] `color.test.ts`: sampling a synthetic image that's a solid `#7a8a99` with 10% pure-white pixels returns within ΔE 1 of `#7a8a99`.
- [ ] Works with phone photos up to 12 MP without freezing (downscale the offscreen canvas to a max of 2048 px on the long edge).

### Phase 3: PWA and deploy

- [ ] `vite-plugin-pwa` added: manifest, icons (simple generated color-wheel icon), offline caching of the app shell.
- [ ] Lighthouse PWA "installable" passes, and the app loads offline after the first visit.
- [ ] README has Vercel deploy steps (import repo → framework: Vite → deploy).

### Phase 4: Later (only when asked)

Live camera preview, white-balance correction by tapping a white/gray card, dominant colors via k-means (k = 3–5) for prints, multiple family profiles, and saved finds.

---

## 11. Definition of done (MVP = phases 0–3)

- `npm test` passes with no skipped tests.
- `npm run build` has no TypeScript errors or warnings.
- No network requests at runtime except loading the app itself.
- README covers how to run it, how to deploy it, and **how to replace a season's placeholder palette with curated hex codes**.
- `DECISIONS.md` lists every judgment call you made.

---

## 12. Context for tuning (not for building)

- The owner is a Soft Summer. Accuracy matters most for Soft Summer vs. its neighbors: True Summer, Light Summer and especially **Soft Autumn**, which differs only in undertone.
- After the MVP, the owner will test 50 real clothing items she has already judged by eye. The target is ≥ 80% agreement and ≤ 10% Soft Summer/Soft Autumn confusion. Thresholds in `config.ts` and ranges in `seasons.ts` will be tuned from that, so keep them easy to change.
