/**
 * Which flag the strip shows when a turn produced several. **Milestone M4.1,
 * rule R9, discrepancy rows D23 and D24.**
 *
 * ## Why this is a table and not a comparison function
 *
 * R9's enforcement clause: *"the mapper returns a list; the renderer takes the
 * first by precedence. Precedence order lives in data."* The mapper reads the
 * protocol and says what was true; this says which of those truths is the one
 * the strip has room for. Those are different jobs with different reasons to
 * change — a tuning pass reorders a table, it does not re-read a protocol —
 * and the split is the same one `flagWords.ts` already makes for the words.
 *
 * ## Why this file rather than `data/tuning.ts`
 *
 * R9's enforce line names `tuning.ts`, and **D12 ruled against it** before this
 * item started: `tuning.ts` is inside `contentHash` because `core/` reads it,
 * so a precedence reorder would refuse every seed recorded before it. The
 * per-file split is the third way `build-config/content-hash.ts` documents and
 * `displayTuning.ts` is its precedent — a file no `core/` module imports at any
 * depth is excluded by a mechanical rule that `test/content-hash.test.ts`
 * walks the import graph to hold.
 *
 * So this file may be read by `ui/` and by nothing under `core/`, forever. The
 * `FlagKind` import is a type and disappears at build time; the dependency runs
 * from here to `core/`, never the other way, which is the direction the
 * architecture already requires.
 *
 * ## Two channels, which is D23
 *
 * R9 ranks what happens **on a target**: no effect, miss, super effective or
 * not very effective, critical, status inflicted, berry fired, stat stage
 * changed. It was written a release before the abnormality vocabulary, and six
 * of the fifteen kinds the mapper now emits are not outcomes on a target at
 * all. `field` is about neither Pokemon. `priority` is about turn order.
 * `prevented` describes a turn in which no hit happened — the class exists
 * precisely because a flinched turn draws no damage, no chunk and no beat, so
 * without a word it is indistinguishable from a turn that did not happen.
 *
 * Ranking those against `crit` would rank things that never compete, and the
 * flinch would lose the only channel it has. D23 ruled instead that they are a
 * **second channel**, rendered beside the one hit flag and bounded the same
 * way: one per side. Section 4 carries the budget, section 5 the canon.
 *
 * **`volatile` is the debatable member and it is here deliberately.** Confusion
 * is inflicted on a target and reads like `status`; Substitute and Focus Energy
 * are things a Pokemon did to itself. R9's "status inflicted" names the six
 * major statuses that the panel draws as chips, and D19 put the volatiles in
 * the Status *glyph* family without putting them in R9's precedence. One kind
 * cannot sit in both channels, so it sits in the one where every member is
 * true of it.
 *
 * ## There is no weight here, and there must not be
 *
 * A rank is which flag is shown when only one fits. It is not how loudly the
 * survivor is drawn: every chip is one recipe, one size, one weight, and
 * `styles.css` holds that. A `weight` column would be the first place C1 broke
 * and it would break silently — the same argument `flagWords.ts` makes against
 * a colour column, and the same one D27 sharpened when the effectiveness
 * kinds took the forecast's hue.
 */
import type { FlagKind } from '../core/battle/flags';

/**
 * Which channel a kind belongs to. **Exhaustive by type**, so a flag kind added
 * to the mapper cannot reach the strip without a decision being made here.
 */
export type FlagChannel = 'hit' | 'second';

/** Every kind, in its channel. The rank is `HIT_PRECEDENCE` below. */
export const FLAG_CHANNEL: Record<FlagKind, FlagChannel> = {
  // R9's eight, in its own words.
  immune: 'hit',
  miss: 'hit',
  super: 'hit',
  resisted: 'hit',
  crit: 'hit',
  status: 'hit',
  berry: 'hit',
  boost: 'hit',
  unboost: 'hit',
  // D23's six: true of the turn, not of a hit on a target.
  priority: 'second',
  prevented: 'second',
  failed: 'second',
  ability: 'second',
  volatile: 'second',
  field: 'second',
};

/**
 * R9's precedence, highest first, and **only** the kinds R9 names.
 *
 * Two pairs share a rank because they cannot co-occur on one hit and neither
 * outranks the other: `super` against `resisted` is one multiplier reported
 * two ways, and `boost` against `unboost` is one stat stage moving. Where two
 * flags tie, the protocol's own order decides, which `flags.ts` argues is the
 * one ordering that is a fact rather than an opinion.
 */
export const HIT_PRECEDENCE: readonly (readonly FlagKind[])[] = [
  ['immune'],
  ['miss'],
  ['super', 'resisted'],
  ['crit'],
  ['status'],
  ['berry'],
  ['boost', 'unboost'],
];

/**
 * A kind's rank, lower first. `Infinity` for anything outside the hit channel,
 * so a caller that ranks the wrong list gets a stable answer rather than a
 * crash and `test/flag-precedence.test.ts` can say so.
 */
export function hitRank(kind: FlagKind): number {
  const index = HIT_PRECEDENCE.findIndex((tier) => tier.includes(kind));
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}
