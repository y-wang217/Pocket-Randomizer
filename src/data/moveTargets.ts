/**
 * What a move's target keyword means, in words. **Patch 4.7.2.**
 *
 * `@pkmn/sim` reports a move's target as one of a small set of keywords —
 * `normal`, `self`, `allAdjacentFoes`, `randomNormal` and so on — and
 * `MoveExplanation.target` carries the keyword through unchanged, because
 * `core/` returns data and never prose. This is where the keyword becomes a
 * line a player can read.
 *
 * Here rather than in the component that renders it, for the reason
 * `data/statInfo.ts`, `data/categoryInfo.ts` and `data/statusInfo.ts` all give:
 * **a sentence describing a mechanic, written in the file that draws it, drifts
 * from the mechanic.** A wording change is a change to this file and nothing
 * else.
 *
 * ## Part 4 applies
 *
 * Every entry says *what a move can be aimed at*. None of them says whether
 * that is good, which moves want it, or what to do about it. `Both foes` is a
 * fact about the move; "great in a double battle" would be a verdict, and this
 * game has no double battles anyway.
 *
 * ## Unknown keywords fall through rather than throwing
 *
 * The reader prints the raw keyword when a target is not listed. GYMRUN runs
 * single battles, so most of the multi-target keywords below can only be
 * reached by a randomizer handing a Pokemon a move nobody would carry — which
 * is precisely a thing this game does on purpose. An unlisted keyword rendering
 * as `allySide` is ugly and honest; a missing row would be a fact quietly
 * withheld, and a throw would take the card down over a label.
 */

/** Keyed by the sim's own `target` string. */
export const TARGET_WORDS: Readonly<Record<string, string>> = {
  normal: 'One adjacent Pokemon',
  self: 'The user',
  adjacentAlly: 'One adjacent ally',
  adjacentAllyOrSelf: 'The user or one adjacent ally',
  adjacentFoe: 'One adjacent foe',
  any: 'Any one Pokemon, adjacent or not',
  randomNormal: 'One adjacent foe, chosen at random',
  allAdjacentFoes: 'Every adjacent foe',
  allAdjacent: 'Every adjacent Pokemon, allies included',
  all: 'The whole field',
  allySide: "The user's side of the field",
  foeSide: "The opposing side of the field",
  allyTeam: "The user's whole team",
  scripted: 'Whatever the move itself decides',
  allies: 'Every ally',
};

/** The words for a target keyword, or the keyword itself when it is unlisted. */
export function targetWords(target: string): string {
  return TARGET_WORDS[target] ?? target;
}
