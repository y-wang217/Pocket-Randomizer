/**
 * The tag vocabulary: one table, and the order that decides what survives the
 * cut on a button face.
 *
 * ## The problem
 *
 * A multi-hit move looks identical to a single-hit move of the same base power,
 * which makes the band badge look like a bug: Population Bomb reads `20 BP` and
 * `BAND 4` on the same card, and both numbers are right. A move that can miss
 * says nothing about it until it misses, at which point the game reads as
 * having cheated. A move that needs a charge turn announces that by wasting one.
 *
 * All of it is in the dex and none of it was on screen.
 *
 * ## The line between these and Release C's flag words
 *
 * **These are properties of a move before it is selected — a forecast.** Flag
 * words are what actually happened after resolution, read off the protocol.
 * The two systems are not merged, neither derives from the other, and one's
 * absence does not imply the other's.
 *
 * The *vocabulary* is deliberately identical where the concept is, so a player
 * learns one word set: a move tagged `priority` that then resolves as bracket
 * driven surfaces the same word afterwards. A move tagged `priority` whose
 * bracket did not decide the turn surfaces no flag word at all, per the
 * existing priority marking rule — which is the difference between "this move
 * has a bracket" and "the bracket is why you moved first".
 *
 * ## Part 4 applies to every word here
 *
 * `Hits 2-5 times` is correct; `high damage potential` is not. `Accuracy 85%`
 * is correct; `risky` is not. `Raises Attack by 2` is correct; `great before a
 * sweep` is not. Every label below is a restatement of a field, and none of
 * them is an opinion about when to press the button.
 *
 * ## This table must never enter `contentHash`
 *
 * Same argument as `data/archetypes.ts`: no RNG, no generation, and two players
 * on one seed with different copies of this file play the identical run. When
 * `contentHash` is built its input must be an explicit file list, not a glob.
 */

/**
 * Every tag a move card can carry.
 *
 * `accuracy` is the odd one out and is the most important one in the set: it is
 * the single field most likely to make a player think the game cheated, and it
 * is the only tag whose label carries a number.
 */
export type MoveTagId =
  | 'multiHit'
  | 'priority'
  | 'accuracy'
  | 'neverMisses'
  | 'stab'
  | 'charge'
  | 'recharge'
  | 'recoil'
  | 'drain'
  | 'highCrit'
  | 'bypassesProtect'
  | 'contact'
  | 'sound';

export interface MoveTagDefinition {
  id: MoveTagId;
  /**
   * How it reads on a button face. Short, because it shares a 2x2 grid cell
   * with a move name, a type, a base power and a band badge.
   */
  short: string;
  /** How it reads in the explanation, where there is room for a sentence. */
  long: string;
  /** What the tag is claiming. A fact about the move and nothing else. */
  blurb: string;
}

/**
 * The vocabulary, **in priority order**: index 0 survives the face cut first.
 *
 * The order is a judgement call, and it is the first thing to revisit if
 * playtesters miss a tag that got cut. The reasoning behind this ordering:
 *
 *   1. `multiHit` and `accuracy` first, because both explain a number the
 *      player can already see and would otherwise misread — a band badge that
 *      disagrees with base power, and a move that missed.
 *   2. `priority`, `charge` and `recharge` next: they change *when* the move
 *      happens, which is the thing a player cannot recover after the fact.
 *   3. `stab`, `recoil` and `drain`: they change how much, which the damage
 *      roll shows anyway.
 *   4. `highCrit`, `bypassesProtect`, `contact` and `sound` last: real, and
 *      rarely the reason a turn went the way it did.
 *
 * `neverMisses` sits with `accuracy` because they are the same question asked
 * from the two ends, and a player who has learned to look for one should find
 * the other in the same place.
 */
export const MOVE_TAGS: readonly MoveTagDefinition[] = [
  {
    id: 'multiHit',
    short: 'Multi-hit',
    long: 'Multi-hit',
    blurb: 'Strikes more than once per use. The band is cut from the total power of all hits, so it will not match the per-hit base power on the card.',
  },
  {
    id: 'accuracy',
    short: 'Acc',
    long: 'Accuracy below 100%',
    blurb: 'This move can miss. The percentage is the chance it lands, before any accuracy or evasion stages.',
  },
  {
    id: 'neverMisses',
    short: 'Never misses',
    long: 'Never misses',
    blurb: 'Bypasses the accuracy check entirely. Accuracy and evasion stages do not apply.',
  },
  {
    id: 'priority',
    short: 'Priority',
    long: 'Priority bracket',
    blurb: 'Sits outside the ordinary bracket. A higher bracket moves before every lower one regardless of Speed; a lower one moves after.',
  },
  {
    id: 'charge',
    short: 'Charge',
    long: 'Charge turn',
    blurb: 'Spends a turn charging before it lands.',
  },
  {
    id: 'recharge',
    short: 'Recharge',
    long: 'Recharge turn',
    blurb: 'The user cannot act on the turn after this one.',
  },
  {
    id: 'stab',
    short: 'STAB',
    long: 'Same-type attack bonus',
    blurb: 'The user shares this move’s type, which multiplies its damage by 1.5.',
  },
  {
    id: 'recoil',
    short: 'Recoil',
    long: 'Recoil',
    blurb: 'The user takes a share of the damage dealt.',
  },
  {
    id: 'drain',
    short: 'Drain',
    long: 'Drain',
    blurb: 'The user recovers a share of the damage dealt.',
  },
  {
    id: 'highCrit',
    short: 'High crit',
    long: 'Raised critical-hit rate',
    blurb: 'Critical hits land more often than the ordinary rate.',
  },
  {
    id: 'bypassesProtect',
    short: 'Thru Protect',
    long: 'Bypasses Protect',
    blurb: 'Lands even when the target has protected itself.',
  },
  {
    id: 'contact',
    short: 'Contact',
    long: 'Makes contact',
    blurb: 'Makes contact, so contact-triggered abilities and items on the target apply.',
  },
  {
    id: 'sound',
    short: 'Sound',
    long: 'Sound-based',
    blurb: 'Sound-based, so it passes through a Substitute and is blocked by Soundproof.',
  },
];

/** Lookup by id, for a renderer that has a tag and wants its words. */
export const MOVE_TAG_BY_ID: Record<MoveTagId, MoveTagDefinition> = Object.fromEntries(
  MOVE_TAGS.map((tag) => [tag.id, tag]),
) as Record<MoveTagId, MoveTagDefinition>;

/** Where a tag sits in the face-cut order. Lower survives. */
export const MOVE_TAG_PRIORITY: Record<MoveTagId, number> = Object.fromEntries(
  MOVE_TAGS.map((tag, index) => [tag.id, index]),
) as Record<MoveTagId, number>;

/**
 * The face label for a tag, given the value it carries.
 *
 * Two tags carry a number and the rest do not, which is why this is a function
 * rather than a string on the definition. Keeping the formatting here rather
 * than in the renderer is the same rule the rest of `data/` follows: a copy
 * change is a one-file change.
 */
export function moveTagLabel(id: MoveTagId, value?: MoveTagValue): string {
  const tag = MOVE_TAG_BY_ID[id];
  if (id === 'accuracy' && typeof value?.accuracy === 'number') return `${value.accuracy}%`;
  if (id === 'multiHit' && value?.hits) {
    const [min, max] = value.hits;
    return min === max ? `Hits ${min}x` : `Hits ${min}-${max}`;
  }
  if (id === 'priority' && typeof value?.priority === 'number') {
    return value.priority > 0 ? `+${value.priority} priority` : `${value.priority} priority`;
  }
  return tag.short;
}

/** The numbers a tag may carry, when it carries any. */
export interface MoveTagValue {
  accuracy?: number;
  hits?: readonly [number, number];
  priority?: number;
}

/**
 * The one line a multi-hit move needs next to its band badge.
 *
 * Both numbers or the badge reads as a bug — Population Bomb is band 4 at 20
 * base power and neither number is wrong. This is the sentence that says so.
 */
export function multiHitLine(hits: readonly [number, number], perHitPower: number): string {
  const count = hits[0] === hits[1] ? `${hits[0]} times` : `${hits[0]} to ${hits[1]} times`;
  return `Hits ${count}, ${perHitPower} base power each.`;
}
