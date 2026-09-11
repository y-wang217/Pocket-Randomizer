/**
 * What a node's tier means, for a player reading the map before they commit.
 *
 * The map is where the trade is weighed, so these three lines are the copy the
 * whole risk gradient is communicated through. They are here rather than in
 * `screens/run-map.ts` for the reason `data/bandInfo.ts` and
 * `data/categoryInfo.ts` are: a sentence describing a mechanic, written in the
 * file that renders it, drifts from the mechanic. Every number below is a
 * restatement of `TIER_MODIFIERS` and `REWARD_BAND_OFFSET` in `data/scaling.ts`,
 * so a tuning pass that moves a tier edits two files in one directory rather
 * than hunting through `ui/`.
 *
 * ## Why the wording changed in Release 0.5
 *
 * These lines used to read "Ordinary. Modest reward.", "Bulkier and a level up
 * on you. Better reward." and "Two of them. The best rewards in the game."
 *
 * **Part 4 forbids the last one outright** — a superlative naming one option as
 * the best does the player's weighing for them, on the one screen that exists
 * for them to do it themselves. But the defect was never the *ranking*. Stage 3
 * requires the map to convey that elite pays more than hard pays more than
 * normal; disclosing the ordering is the feature. The defect was that the copy
 * editorialised in prose where it should have stated an attribute. "Modest",
 * "better" and "best" are the screen holding an opinion about a system it is
 * there to describe.
 *
 * So all three are one parallel set now: same grammatical shape, each stating
 * the encounter shift and the reward band it draws from, in numbers. The
 * ordering stays visible because +1 and +2 are visibly different numbers, which
 * is how it should have been conveyed in the first place.
 *
 * **"A level up on you" was also simply false.** A tier's level modifier is
 * added to the segment's own `levelOffset`, which is already eight to eleven
 * levels *below* the player at every segment. A `hard` node is one level above
 * the ordinary node beside it, never above the player. The deltas below are all
 * stated against a `normal` node in the same map position, which is what they
 * actually are.
 */
import type { Tier } from '../core/types';

/**
 * Keyed by tier, and every tier has an entry.
 *
 * `normal` states its shifts as "no shift" rather than being left blank: it is
 * the baseline the other two are quoted against, and a player who reads three
 * lines in one shape learns the axis from the set. `test/tiers.test.ts` asserts
 * the modifiers themselves and that every tier is covered here, because a
 * missing entry renders as `undefined` on the most important pixel in the
 * game.
 */
export const TIER_INFO: Readonly<Record<Tier, string>> = {
  normal: 'One Pokemon, no level or band shift. Pays a move in its own band.',
  hard: 'One Pokemon, +1 level and +1 species band. Pays a move one band up.',
  elite: 'Two Pokemon, -3 levels, +1 species band and +1 move band. Pays a move two bands up.',
};

/**
 * The same three facts in fewer words, for Simple and Pocket. Density modes
 * patch: the short form sits beside the long one in the table it lives in.
 */
export const TIER_INFO_SHORT: Readonly<Record<Tier, string>> = {
  normal: 'One Pokemon. Pays its own band.',
  hard: 'One Pokemon, +1 level, +1 band. Pays one band up.',
  elite: 'Two Pokemon, -3 levels, +1 band. Pays two bands up.',
};
