# Six-Part IQ Test

A timed, browser-only IQ test with six subtests and alternate forms, so it can be retaken without repeating questions.
It is self-contained in this folder and separate from the Christmas trivia app at the repo root.

## Running it

```bash
cd iq-tester
npm install
npm run dev            # http://localhost:5173
npm run build          # static site in dist/ (deploy anywhere, e.g. Vercel with root directory "iq-tester")
npm run build:artifact # one self-contained page in dist-artifact/iq-test.html
```

## What's in the test

| Subtest | Items (full / short) | Item types |
| --- | --- | --- |
| Verbal Reasoning | 6 / 3 | analogies (3 levels), odd one out, vocabulary, anagram |
| Quantitative Reasoning | 6 / 3 | number series (3 levels), word problems (3 levels) |
| Logical Reasoning | 6 / 3 | deduction, ordering, letter series, codes, knights & knaves, relationships |
| Matrix Reasoning | 6 / 2 | Raven-style 3×3 matrices, difficulty 1–5 |
| Spatial Reasoning | 4 / 1 | mental rotation (incl. a marked-square version), mirror reflection |
| Working Memory | 7 / 2 | digit span forward/backward, word-list recall, grid memory, letter–number sequencing, passage detail, exact phrase |

- **Full battery:** 35 items, about 20–25 minutes. **Short form:** 14 items, about 8–10 minutes.
- **Alternate forms:** every item slot has 6 hand-written versions or 10 generated ones. The app remembers which versions you've seen (in
  `localStorage`) and always serves unseen ones, so the full battery can be taken 6 times with no repeats. After that it reuses the versions
  you saw longest ago.
- **Timing:** each item has its own clock (20–105 s). When time runs out, whatever you've entered is submitted. Memory items show the
  digits, words, phrase or grid for a few seconds (4–12 s) and then hide it before the question appears. Relaxed mode gives 1.5× answer
  time, and the score is labelled as relaxed.
- **Scoring:** items are weighted by difficulty. Select-all and grid items get partial credit (hits minus false alarms), and the exact-phrase
  item gives half credit for one wrong word. The weighted score is mapped to the IQ scale (mean 100, SD 15) using assumed norms
  (`NORM` in `src/engine/scoring.ts`), clamped to 55–145, and reported with a likely range, percentile, band and subtest profile. This is
  an informal estimate, not a normed clinical instrument.

## Code map

- `src/bank/` – the question bank. `hand.ts` turns hand-written items into slots; `pattern.ts` (matrices), `spatial.ts` (polyominoes),
  `memory.ts`, plus the series and code generators, build items from a seeded RNG so every variant is reproducible.
- `src/engine/` – types, seeded RNG, test assembly (`builder.ts`), scoring, `localStorage` persistence.
- `src/components/` – home, test runner (intro → memorize → answer phases), answer inputs, SVG figures, results.

To add a variant to a hand-written slot, append an item to its `items` array (correct choice first; options are shuffled at runtime). The
tests check it automatically.

## Tests

```bash
npm test          # unit: bank integrity, answer keys, matrix solver, spatial checks, no-repeat assembly, scoring
npm run test:e2e  # Playwright, desktop + phone: perfect/zero runs, timers, memorize-then-hide, retakes, quitting
```

The matrix test re-solves every generated puzzle independently and fails if any cell attribute could be completed in more than one way.
