# In Season

A phone-first web app that answers two questions about any color:

1. **Is this in my season?** Gives Great / Okay / Avoid for your saved season, the 3 closest swatches in your palette, and a one-line reason.
2. **Which season is this?** Ranks all 12 seasons by match %.

You can give it a color by hex code, the color picker, or a tap on a photo. Everything runs in the browser. There's no backend and no account, and it works offline once installed.

## Run it

Requires Node 20 or newer.

```bash
npm install
npm run dev       # local dev server at http://localhost:5173
npm test          # run the test suite
npm run build     # type-check and build to dist/
npm run preview   # serve the production build locally
```

Other scripts:

```bash
npm run seed      # rebuild the placeholder backup in src/data/palettes.seed.ts
npm run icons     # regenerate the PWA icons in public/
```

To try it on your phone during development, run `npm run dev -- --host` and open the "Network" URL on a phone on the same Wi-Fi.

## Where the palettes come from

All 12 palettes were sampled from the gradient palette charts published by [Elemental Colour](https://elementalcolour.com.au/blog/soft-summer) (one blog post per season, fetched 2026-10-27). Each season has 156–222 evenly spaced swatches taken along those gradients. The source page is noted above each palette in `src/data/palettes.ts`. These are for personal use. The colors belong to Elemental Colour's work, so check with them before publishing the app.

Each season's L\*/C\* range in `src/data/seasons.ts` covers the middle 90% of its palette.

## Replace a season's palette with your own hex codes

To use your own swatches for a season, for example from a palette card:

1. Open `src/data/palettes.ts`.
2. Find the block for the season, for example `seasonId: 'soft-summer'`.
3. Replace the `swatches` array with your hex codes. Use `"#RRGGBB"` format, with 40–250 colors and no duplicates. Aim for even spacing, with no big jumps between similar shades.
4. Make sure it says `source: 'curated'`.
5. Run `npm test`.

```ts
  {
    seasonId: 'soft-summer',
    source: 'curated',
    swatches: [
      '#8a9bb0', '#a3878f', '#6f7f8f', // ...your colors
    ],
  },
```

### Switch back to the placeholder palettes

The original generated placeholder palettes are kept in `src/data/palettes.seed.ts`. The app doesn't use them.
- **One season:** copy that season's block from `palettes.seed.ts` into `palettes.ts`, replacing the existing block for that season.
- **All seasons:** in `palettes.ts`, replace everything inside `PALETTES = [ ... ]` with everything inside `SEED_PALETTES = [ ... ]`.

The placeholders were built for the spec's original season ranges and a Great cut-off of 6. If you switch back, also restore those values: the original ranges are listed in `DECISIONS.md` (item 35), and the cut-off is `greatMaxDeltaE` in `src/lib/config.ts`. `npm run seed` rebuilds this backup file and never touches `palettes.ts`.

The tests check every palette, curated ones included. One check is **palette density**: at least 95% of swatches, counted across all seasons, need another swatch in the same season closer than the Great cut-off (ΔE 4). If it fails, your palette has gaps. Fill them with in-between shades rather than changing the threshold.

## Tuning

- **Thresholds** (Great/Okay cut-offs, match % slope, sample size, tie window) are in `src/lib/config.ts`.
- **Season L\*/C\* ranges and undertones** are in `src/data/seasons.ts`.

No other file holds numbers that affect scoring.

## How scoring works

The input color and every swatch are converted to CIE Lab (D65). For each season, the app measures the CIEDE2000 distance (ΔE) from the input to each swatch and averages the 3 nearest. A lower ΔE is a better match.

- **Great:** ΔE < 4
- **Okay:** ΔE 4–12
- **Avoid:** ΔE > 12
- **Match %:** 100 − 5 × ΔE, clamped to the range 0–100

The core logic is in `src/lib/score.ts`. It's a pure module with no React or DOM code, so it can be reused later, for example in a browser extension.

## Live site (GitHub Pages)

The app is live at **https://ayleeandersen.github.io/in-season/**. Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which runs the tests, builds the app under the `/in-season/` path (`BASE_PATH`) and publishes it. A failing test stops the deploy. Progress shows in the repo's **Actions** tab.

## Deploy to Vercel (alternative)

1. Push this folder to a GitHub, GitLab or Bitbucket repo.
2. At [vercel.com/new](https://vercel.com/new), **import** that repo.
3. For **Framework Preset**, choose **Vite**. Vercel fills in the defaults: build command `npm run build` and output directory `dist`.
4. Click **Deploy**.

Each push to the main branch redeploys. The service worker updates itself, so phones get the new version on their next visit.

To install it on a phone, open the deployed URL. On iOS Safari, use Share → Add to Home Screen. On Android Chrome, use ⋮ → Install app.

## Project layout

```
src/data/       seasons.ts (definitions + ranges), palettes.ts (swatches)
src/lib/        color.ts (conversions, photo sampling math), score.ts (pure scoring),
                config.ts (all thresholds), storage.ts (localStorage, guarded)
src/components/ SeasonPicker, ColorInput, PhotoSampler, VerdictCard, SeasonRanking
tests/          score, color and palette tests (Vitest)
scripts/        seed palette and icon generators
```

See `DECISIONS.md` for every judgment call made during the build.
