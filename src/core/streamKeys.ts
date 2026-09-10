/**
 * Every RNG sub-stream key in the game, in one file.
 *
 * **Stage 4.6a, and it is the other half of the keyed-stream refactor.** The
 * mechanism lives in `core/rng.ts`; this is the *namespace*. A key is a string,
 * and a string typed at a call site is a string that can be typed differently
 * at the next one — two keys that were meant to be the same sequence, silently
 * drawing two.
 *
 * ## The rule
 *
 * A key names a *thing that draws*, never a moment in time. `node('s3-cave-2-0')`
 * is a key; "the fourth draw of segment 3" is not. That is what makes a key
 * stable: the same node in the same seed opens the same sequence however much
 * generation around it changes.
 *
 * ## Why the purposes are separated
 *
 * A node's reward offer, its shop stock and its event outcomes could share one
 * key — they never co-occur on the same node. They do not share one, because
 * "never co-occur" is a property of today's node kinds and a key is forever.
 * Separate purposes mean a stage that lets an event node also pay a card adds a
 * draw to a sequence nothing else reads.
 *
 * ## What this buys the next two sub-stages
 *
 * 4.6b adds banded reward draws and 4.6c adds three-band event outcomes. Both
 * add draws *inside* a key that already exists, or under a new key. The first
 * moves only that node's own later draws in that one purpose; the second moves
 * nothing. Neither can reach the map shape, the teams or the battle seeds.
 * `docs/spec/gymrun-seeds-and-mappability.md` is the long form of that argument.
 */

/** The starter options, drawn once per run before the map. */
export const STARTERS_KEY = 'starters';

/**
 * One node's contents, on `randomizer`, and its sim seed, on `battle`.
 *
 * The same key on two streams is deliberate and safe: the streams are already
 * domain-separated by name, so `randomizer#node/x` and `battle#node/x` are two
 * unrelated sequences. Using one key for both is what makes "everything about
 * node x" one thing to reason about.
 */
export function nodeKey(nodeId: string): string {
  return `node/${nodeId}`;
}

/** What a node pays, on `rewards`. One purpose per key; see the header. */
export function nodeRewardKey(nodeId: string, purpose: 'offer' | 'shop' | 'event' | 'capture'): string {
  return `node/${nodeId}/${purpose}`;
}

/** The locales a segment offers, on `map`. */
export function localeOfferKey(segment: number): string {
  return `seg${segment}/locale-offer`;
}

/**
 * One route's shape, on `map`: step count, kinds, the composition fix-ups and
 * the tiers.
 *
 * Keyed by locale as well as segment because a segment generates a route for
 * **every** locale it offers and the player keeps one. Two locales drawing off
 * one sequence would make the road through the Cave depend on whether the Marsh
 * was offered beside it — a dependency nobody can see and every recorded seed
 * would rest on.
 */
export function routeKey(segment: number, locale: string): string {
  return `seg${segment}/${locale}/route`;
}

/** The gym clear offer, on `rewards`. */
export function gymRewardKey(segment: number): string {
  return `seg${segment}/gym-reward`;
}
