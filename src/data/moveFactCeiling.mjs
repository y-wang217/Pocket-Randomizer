/**
 * The most facts one move face may carry. **Patch 4.8.0.3 closeout, check 3.**
 *
 * ## Why this is a file and not a line in the smoke script
 *
 * It was `const MAX_MOVE_FACTS = 5` inline in `scripts/smoke.mjs`, which is
 * the one place in this repo a number like it must not live: every copy or
 * balance number a tuning pass would touch lives in `data/`, and a ceiling
 * asserted against the phone is exactly such a number. The smoke script reads
 * it from here now.
 *
 * ## Why it is `.mjs` rather than `.ts`
 *
 * `scripts/smoke.mjs` is plain ESM run under Node against a *built* bundle. It
 * cannot import a TypeScript module, which is precisely why the number it
 * replaced — `tuning.maxMoveTagsOnFace` — was restated inline with a comment
 * apologising for it. Plain ESM is importable from both sides, so the
 * restatement is gone rather than moved.
 *
 * Nothing under `src/` imports this. The app does not cap the strip; the cap
 * is an assertion about a viewport, and its only consumer is the smoke run.
 *
 * ## Why five
 *
 * **It is a measured ceiling, not a configured one.** `MOVE_FACT_IDS` bounds
 * the strip at nine and the fields are whatever the move has, so nothing in
 * the app reads a cap and cuts to it — unlike the tag row this replaced, which
 * really was cut to `tuning.maxMoveTagsOnFace`.
 *
 * The worst real case is four: **Fake Out** carries an accuracy the move can
 * miss on, a 100% secondary, a +3 priority bracket and contact. One spare is
 * the margin that makes this an assertion about the phone rather than a
 * restatement of the dex — a move that broke it would mean the strip had grown
 * a field, and that is a change that should have to come back through here.
 *
 * ## And why the number it replaced is still in `data/tuning.ts`
 *
 * `tuning.maxMoveTagsOnFace` is computed and unread since the strip replaced
 * the tag row on the face. It is stranded rather than deleted because
 * `src/data/tuning.ts` is read by `core/` and is therefore hashed, so removing
 * it **moves `contentHash`** — which patch 4.8.0.3 is required not to do.
 * `docs/generation.md` section 12n records that, and the pass that is allowed
 * to move the hash owns the deletion.
 *
 * ## Excluded from `contentHash`
 *
 * Listed in `build-config/content-hash.ts`. The rule there is mechanical —
 * nothing under `core/` may import an excluded file — and nothing imports this
 * at all. A ceiling a smoke run asserts against cannot change what a seed
 * generates.
 */
export const MAX_MOVE_FACTS = 5;
