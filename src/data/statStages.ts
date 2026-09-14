/**
 * Stat stages as multipliers. **Patch 4.8.0.3, item 1.**
 *
 * A stage integer is a number only a Pokemon player can read. `+2` means
 * nothing to someone who has never seen the boost table; `2.0x` means the same
 * thing to anybody. So the panel prints the multiplier and keeps the stage as
 * the ladder's position rather than as the headline.
 *
 * ## Two tables, not one formula
 *
 * The main stats and the accuracy/evasion pair use different ladders, and the
 * difference is not cosmetic: `+1` Attack is x1.5 while `+1` accuracy is x1.33.
 * A single formula with a parameter would be a third thing to be wrong about,
 * so both are written out.
 *
 * Both share the same *shape*, and the shape is the mechanic rather than a
 * simplification of it: a raise multiplies by the table, a drop **divides** by
 * it. That is why a single drop is x0.7 (2/3) and not x0.5 — the naive reading
 * that a drop is the mirror of a raise is wrong in the direction that matters,
 * because it makes Growl look twice as good as it is.
 *
 * ## The mechanics win, and a test holds them to it
 *
 * `core/battle/stats.ts` owns the numbers the engine actually applies —
 * `BOOST_TABLE`, transcribed from `Pokemon#getStat`, floor and all.
 * `MAIN_STAGE_TABLE` below is the same series, and
 * `test/battle-readout.test.ts` asserts it entry for entry against
 * `BOOST_TABLE` across the full -6..+6 range. If the two ever disagree the test fails rather than the panel quietly
 * printing a multiplier the battle does not use.
 *
 * The accuracy table has no counterpart in `core/` to check against, because
 * accuracy is rolled inside the sim and this repo never reimplements it. It is
 * transcribed from the same source as the main table: gen 3 onward, `(3+n)/3`
 * for a raise and its reciprocal for a drop.
 *
 * ## Excluded from `contentHash`, and why that is allowed
 *
 * The exclusion rule in `build-config/content-hash.ts` admits a file only if
 * nothing under `core/` imports it at any depth. Nothing does: this is display
 * vocabulary, the engine's own copy of these numbers is `BOOST_TABLE`, and a
 * seed made before this patch and a seed made after it are the same seed.
 * `test/content-hash.test.ts` walks the import graph and holds that.
 */

/** Stages are clamped to this range by the engine, so the display clamps too. */
export const MAX_STAGE = 6;

/**
 * Attack, Defense, Sp. Atk, Sp. Def and Speed, indexed by absolute stage.
 *
 * Must equal `core/battle/stats.ts`'s `BOOST_TABLE`. Held by test.
 */
export const MAIN_STAGE_TABLE: readonly number[] = [1, 1.5, 2, 2.5, 3, 3.5, 4];

/**
 * Accuracy and evasion, indexed by absolute stage.
 *
 * `(3 + n) / 3`. Written as fractions rather than as decimals because 4/3 and
 * 7/3 do not terminate and a rounded literal here would be a second rounding
 * on top of the one the display already does.
 */
export const ACCURACY_STAGE_TABLE: readonly number[] = [1, 4 / 3, 5 / 3, 6 / 3, 7 / 3, 8 / 3, 9 / 3];

/** Which ladder a boostable name sits on. */
export type StageKind = 'main' | 'accuracy';

const TABLES: Record<StageKind, readonly number[]> = {
  main: MAIN_STAGE_TABLE,
  accuracy: ACCURACY_STAGE_TABLE,
};

/**
 * The multiplier a stage applies, as a number.
 *
 * Raise multiplies, drop divides. Clamped, because the engine clamps and a
 * display that ran past the table would print a multiplier no battle can
 * produce.
 */
export function stageMultiplier(stage: number, kind: StageKind = 'main'): number {
  const table = TABLES[kind];
  const clamped = Math.max(-MAX_STAGE, Math.min(MAX_STAGE, stage));
  const entry = table[Math.abs(clamped)] ?? 1;
  return clamped >= 0 ? entry : 1 / entry;
}

/**
 * The multiplier as the panel prints it: one decimal, `x` suffixed.
 *
 * One decimal is a deliberate loss of precision. -5 and -6 both read `0.3x`,
 * and that is the truth at the resolution a player can act on; the ladder
 * beside it is what tells the two apart.
 */
export function formatStageMultiplier(stage: number, kind: StageKind = 'main'): string {
  return `${stageMultiplier(stage, kind).toFixed(1)}x`;
}

/**
 * The stage itself, signed, for the label a ladder carries to a screen reader.
 *
 * Not shown as text on the face. It is the fact the ladder draws, and a face
 * that printed both would be spending width to say one thing twice.
 */
export function formatStage(stage: number): string {
  return `${stage > 0 ? '+' : ''}${stage}`;
}

/** The two names on the accuracy ladder, in the order the panel prints them. */
export const ACCURACY_STAGE_NAMES = ['accuracy', 'evasion'] as const;

export type AccuracyStageName = (typeof ACCURACY_STAGE_NAMES)[number];

/**
 * Short labels, in the same register as `STAT_LABELS`.
 *
 * `Acc` and `Eva` rather than the full words, because they sit on the same row
 * as `Atk` and `SpD` and a row where two chips are twice the width of the rest
 * reads as two kinds of thing.
 */
export const ACCURACY_STAGE_LABELS: Record<AccuracyStageName, string> = {
  accuracy: 'Acc',
  evasion: 'Eva',
};

/**
 * The collapsed marker's label in Pocket, where the chips themselves do not
 * fit. A count of what changed, which is an attribute; not "boosted", which
 * would be a reading of whether the change was good.
 */
export function stageMarkerLabel(count: number): string {
  return `STAGES ${count}`;
}

/**
 * One row of the collapsed stage panel: the multiplier, then the stage.
 *
 * Here rather than in `ui/tooltips.ts` because that file is a lookup and a
 * positioner and carries no text of its own — `test/boundaries.test.ts` holds
 * it to that, and a format string assembled in the renderer is exactly the
 * kind of wording that drifts from the mechanic it describes.
 *
 * The stage is spelled out here where the inline chip leaves it to the ladder.
 * A panel that has already cost a tap has room for it, and `+2` is the form a
 * player will meet in every other Pokemon document they read.
 */
export function stageRowValue(multiplier: string, stage: string): string {
  return `${multiplier}  (${stage})`;
}
