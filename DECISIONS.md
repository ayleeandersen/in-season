# Decisions

Judgment calls made while building from `color-season-checker-BUILD-SPEC.md`. Each one notes where the spec was ambiguous or where its goals conflicted.

## Stack and dependencies

1. **Tailwind v4 through `@tailwindcss/vite`.** The spec doesn't give a Tailwind version, so I used the current one. It needs no `tailwind.config.js`. Dark mode uses Tailwind's default `dark:` variant, which follows the system setting.
2. **Vite 6, Vitest 3, TypeScript 5 (strict, plus `noUncheckedIndexedAccess`).**
3. **The only runtime dependencies are `react`, `react-dom` and `culori`.** Everything else is a dev dependency: `tsx` runs the TypeScript scripts, plus `vite-plugin-pwa` and the type packages. `puppeteer-core` was used only for local browser checks, from a scratch folder, and isn't part of the project.
4. **Two extra npm scripts:** `npm run icons` regenerates the PWA icons and `npm run test:watch` runs the tests in watch mode.
5. **Files beyond the spec's layout:** `src/lib/storage.ts` holds the guarded `localStorage` access, `src/components/PlaceholderBadge.tsx` is shared by two screens, and `scripts/generate-icons.ts` makes the icons.

## Color math

6. **D65 LCh is `lch65` in culori.** culori's plain `lch` mode is D50, and the spec asks for D65. ΔE2000 is computed on culori's `lab65`.
7. **`score.ts` caches each swatch's Lab value.** The cache doesn't change results. It makes the first call about 2 ms and later calls about 0.1 ms. The module still imports nothing from React or the DOM.
8. **`verdictFor` also returns the full `ranking`.** This adds to the spec's return type without changing it, so the UI doesn't score twice.

## Verdict reasons (Section 7, step 6)

9. **Range checks use rounded values.** A color at L\* 75.4 counts as inside a max of 75. Otherwise the message would read "L\* 75 vs max 75".
10. **The spec left the "…" wordings open.** I filled them in to match the given pattern: `Too dark: L* {x} vs {season} min {y}` and `Too muted: C* {x} vs {season} min {y}`.
11. **"Opposite undertone" compares warm against cool only.** `cool` and `cool-neutral` count as the same family, and so do `warm` and `warm-neutral`.
12. **An Avoid with no other reason says "Far from your palette".** The spec gives no fallback text for Avoid.
13. **The reason order can pair Great with "Leans warm".** For example, `#c08497` is Great for Soft Summer but its closest season is Soft Autumn. I followed the spec's order exactly. Flagged for tuning.

## Seed palettes (Section 5): where the spec conflicts with itself

14. **The spec's grid can't meet all of the spec's checks.** The grid (15° hue steps, 3 L\* levels, 2 C\* levels) produces up to 144 in-gamut colors per season. The checks require 40–60 swatches and ≥ 95% leave-one-out density.
    - "Keep up to 60" done by truncation dropped every hue past about 300°, which removed all pinks and mauves from most palettes.
    - Thinning evenly to 60 kept every hue but dropped density to 73%.
    - Bright Winter had only 35 in-gamut colors, below the minimum of 40.

    **What I did:** the generator tries the spec's grid first, then nearby grids, varying the hue step from 15° to 45° and the number of L\* and C\* levels. For each season it keeps the first grid that gives 40–60 swatches at ≥ 95% density. If no grid qualifies, it keeps the densest grid that gives 40–60 swatches. Every palette covers the full hue circle, with no truncation. Each season's chosen grid is written as a comment in `palettes.ts`.

    **Result:** every season has 46–60 swatches, and overall density is 97.9%. Bright Winter, the only season below 95%, is at 89% (41 of 46). Following the spec, I added swatches rather than loosening the threshold.
15. **"Evenly spaced inside the range" excludes the endpoints.** Three L\* levels in 65–90 are 71.25, 77.5 and 83.75. This keeps every swatch strictly inside the range.
16. **The hue shift is 15° for `warm`/`cool` and 8° for the `-neutral` seasons, as in the spec.** I read the "10°" in the same sentence as a general description. Each shift moves along the shorter arc and never goes past the target. At exactly 180° from the target it moves in the + direction.
17. **Placeholder palettes span every hue for every season.** That's how the spec's recipe works. Until curated palettes exist, the hue verdict is weak, especially Soft Summer vs Soft Autumn: their L\*/C\* ranges almost overlap and only the 8° hue shifts differ. Curated palettes matter most for the owner's accuracy targets.
18. **The palette range test always runs and passes curated palettes without checking them.** This avoids skipped tests, which the definition of done forbids. Curated swatches are the owner's call and may fall outside the approximate ranges.

## Photo sampling (Section 8)

19. **The number of highlight pixels dropped is `ceil(n × dropBrightestPct)`, and never every pixel.** Transparent pixels are skipped. A tap near the image edge reads beyond the canvas, which returns transparent pixels.
20. **The 2048 px limit lives in `CONFIG.maxSamplingEdgePx`.** That keeps it with the other tunable numbers.
21. **Downscaling blurs noise at the scale of single pixels.** A synthetic 12 MP image with 10% *single-pixel* white speckle sampled ΔE 2.9 from the true color once downscaled. The speckle gets smeared into its neighbors, so dropping the brightest pixels can't remove it. Real highlights on fabric cover many pixels, so this shouldn't matter in use. The spec's ΔE < 1 test runs on the sampling function itself, without downscaling, and passes.
22. **Keyboard access on the photo:** the canvas can take focus. Arrow keys move the sample point by 1% (5% with Shift), and Enter or Space samples.
23. **Photos load into an `<img>`, which applies EXIF rotation, and are then drawn to the offscreen canvas.**

## UI (Section 9)

24. **First launch shows a full-page picker. Later changes use a native `<dialog>`.** The dialog provides focus trapping, Escape to close and a backdrop. Clicking the backdrop also closes it.
25. **Hex validation appears on blur or Enter, not while typing.** A partly typed `#7a` isn't flagged mid-entry. A valid value is scored as soon as it's typed.
26. **The "Placeholder palette" badge appears on each seed season in the picker and in the verdict card.**
27. **A tie means the top two match % values differ by ≤ `tieWindowPct` (inclusive).**
28. **Verdict labels always pair text with a symbol: ✓ Great, ~ Okay, ✕ Avoid.** The colors are Tailwind 900-on-100 (light theme) and 200-on-950 (dark theme), all above 4.5:1. Hex text on the big swatch is black or white, whichever contrasts more.
29. **Before a color is entered, the page shows a short prompt instead of a default verdict.**

## PWA (Phase 3)

30. **I checked installability with Chrome's own test, not the Lighthouse PWA audit.** Lighthouse 12 removed its PWA category. I ran Chrome DevTools' `Page.getInstallabilityErrors`, the check behind Chrome's install prompt, against the production build. It returned no errors. Reloading in offline mode loaded the app and scored a color.
31. **`scripts/generate-icons.ts` draws a 12-wedge color wheel and writes the PNGs directly.** No image library is needed. It produces 192, 512, maskable 512 (artwork inside the safe zone), a 180 Apple touch icon and a 32 favicon.
32. **The service worker uses `registerType: 'autoUpdate'`.** A new deploy replaces the cached app shell on the next visit, with no update prompt.
