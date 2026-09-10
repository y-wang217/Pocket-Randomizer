/**
 * Naming a Pokemon, from a keyed stream. **Stage 4.8, item 5.**
 *
 * One function, and the reason it is a function rather than an inline
 * `stream.pick(NICKNAMES)` at three call sites is the usual one: three copies of
 * "how a name is drawn" are three things to keep in agreement, and the failure
 * would be a name that changed depending on which route a Pokemon arrived by.
 *
 * Pure in the sense everything in `core/` is: it draws from the stream it is
 * handed and touches nothing else. The stream is opened under `nicknameKey`, which
 * nothing else consumes, so **this draw shifts no other key's output** — the
 * property that let item 5 add a name to every Pokemon in the game without moving
 * a single recorded map.
 *
 * ## Where a name is attached, and why it is there rather than at acquisition
 *
 * On the `PokemonSpec`, at map generation, beside the draw that created the spec.
 * Not in `createPartyMember`, which is where a member is built and would have been
 * the tidier-looking home: that function has no stream, and handing it one would
 * mean a name drawn at the moment a player pressed a button. A key must name a
 * thing that draws, never a moment in time — so the thing that draws is "the
 * Pokemon this node offers", and the node id is what identifies it.
 */
import type { RngStream } from './rng';
import { NICKNAMES } from '../data/nicknames';

/**
 * One name, drawn from the pool.
 *
 * Consumes exactly one value from the stream, whatever the pool's size, so
 * appending a name to `NICKNAMES` costs no draw and shifts nothing after it.
 */
export function drawNickname(stream: RngStream): string {
  const name = NICKNAMES[stream.nextInt(NICKNAMES.length)];
  if (!name) throw new RangeError('The nickname pool is empty');
  return name;
}

/**
 * A spec with a name on it, leaving the original alone.
 *
 * Returns a copy because specs are shared — a wild node's lead spec *is* the
 * encounter's, and naming it in place would name the opponent the player is about
 * to fight. `moves` is copied for the same reason `generateEncounterAcquisition`
 * copies it.
 */
export function named<T extends { nickname?: string; moves: string[] }>(spec: T, stream: RngStream): T {
  return { ...spec, moves: [...spec.moves], nickname: drawNickname(stream) };
}
