/**
 * The settings store a driven browser is seeded with when it must **not** be
 * a first launch.
 *
 * ## Why this is one file and not two copies
 *
 * `scripts/smoke.mjs` and `scripts/visual/browser.mjs` each hand-rolled the
 * same JSON — `{ density, tutorial: { skipped: true, seen: [] } }` — and the
 * intro panel proved what that costs. It landed with the coach marks covered
 * in both copies and the greeting covered in neither, so every driven test in
 * the project ran into a modal: 5 of the 9 legs of `npm run check` failed on
 * "subtree intercepts pointer events", none of them about the thing they were
 * testing.
 *
 * The next surface that shows itself once will be added here, once. That is
 * the whole argument, and it is `src/data/moveFactCeiling.mjs`'s: two scripts
 * stating one fact is one place for them to disagree.
 *
 * ## Why it is `.mjs` rather than `.ts`
 *
 * `scripts/smoke.mjs` is plain ESM run under Node against a **built** bundle
 * and cannot import a TypeScript module. `moveFactCeiling.mjs` records the
 * same constraint. Plain ESM is importable from both sides.
 *
 * ## Why the intro version is a ceiling rather than the real number
 *
 * `INTRO_VERSION` lives in `src/data/intro.ts`, where the app reads it, and
 * this file deliberately does not restate it. A harness that seeded the
 * current version would be a harness that needed editing every time the
 * greeting was reworded — and would silently stop suppressing the panel on
 * the release somebody forgot.
 *
 * `Number.MAX_SAFE_INTEGER` says something stronger and permanently true:
 * this context has already seen every intro there will ever be. A driven
 * browser is not a player, and there is no version of the greeting it wants.
 */

/** Seen every greeting there will ever be. See the header. */
export const SEEN_EVERY_INTRO = Number.MAX_SAFE_INTEGER;

/**
 * Past the third exposure of every glyph family. **Milestone M6.1.**
 *
 * R7's labels are the third thing that shows itself on a first launch, after
 * the coach marks and the greeting, so they go here for the reason the header
 * gives. A driven browser measures the steady-state face section 4 budgets
 * (D44), and every height baseline was taken on it. The families are named
 * rather than imported because this file cannot import TypeScript; a family
 * added to `src/data/glyphFamilies.ts` and not here starts at zero, labels
 * appear in every driven run, and the height gates say so on the first run.
 */
export const EXPOSED_FAMILIES = [
  'type',
  'category',
  'band',
  'pp',
  'accuracy',
  'priority',
  'effectiveness',
  'status',
  'stat',
  'capability',
  'node',
  'field',
];
const PAST_EVERY_LABEL = 1_000;

/**
 * The store, as the string `localStorage.setItem` takes.
 *
 * `density` is the caller's, because a visual context sets
 * the mode it is measuring; the two first-run surfaces are not optional and
 * take no argument — a caller that wanted the marks would not be calling
 * this.
 */
export function notFirstLaunch({ density = 'detailed' } = {}) {
  return JSON.stringify({
    density,
    tutorial: { skipped: true, seen: [] },
    intro: { seenVersion: SEEN_EVERY_INTRO },
    exposure: { counts: Object.fromEntries(EXPOSED_FAMILIES.map((family) => [family, PAST_EVERY_LABEL])) },
  });
}
