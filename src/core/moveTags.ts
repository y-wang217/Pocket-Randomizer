/**
 * Deriving a move's tags from its structured fields.
 *
 * Stage 4.7, Part 6b. `data/moveTags.ts` holds the vocabulary, the priority
 * order and every word that reaches a screen; this file is the derivation
 * between `MoveExplanation` and that table.
 *
 * Pure, no RNG, no DOM, no dex. It reads only fields `describeMove` already
 * returned, which is what keeps the two from disagreeing: there is one place a
 * move is described and one place its tags are decided, and the second is a
 * function of the first.
 */
import {
  MOVE_TAG_PRIORITY,
  type MoveTagId,
  type MoveTagValue,
} from '../data/moveTags';
import type { MoveExplanation } from './types';

/** One tag on a card: which tag, and the number it carries if it carries one. */
export interface MoveTag {
  id: MoveTagId;
  value?: MoveTagValue;
}

/**
 * The holder a move is attached to, when there is one.
 *
 * **STAB is contextual and that is the whole reason this parameter exists.** It
 * is a property of the move *and the holder together*, so it renders on a card
 * attached to a specific Pokemon and is absent on an unassigned reward card
 * until a recipient is chosen. A reward card that claimed STAB before anybody
 * had been picked would be claiming something not yet true.
 */
export interface TagHolder {
  types: readonly string[];
}

/**
 * Every tag a move qualifies for, in table priority order.
 *
 * The full set, uncut. `tagsForFace` is what applies the cap; a caller that
 * wants the whole list — the tap-to-expand explanation — asks this one, so the
 * face and the explanation can never disagree about what a move is.
 */
export function moveTags(move: MoveExplanation, holder?: TagHolder): MoveTag[] {
  const tags: MoveTag[] = [];

  if (move.multiHit) tags.push({ id: 'multiHit', value: { hits: move.multiHit } });

  /*
   * Accuracy and never-misses are the same question from the two ends, and
   * exactly one of them ever applies. The sim reports a never-miss move as
   * `true` rather than as 100, which is the distinction being kept: a move that
   * is *checked* against 100% accuracy can still be made to miss by an evasion
   * stage, and one that bypasses the check cannot.
   */
  if (move.accuracy === true) tags.push({ id: 'neverMisses' });
  else if (move.accuracy < 100) tags.push({ id: 'accuracy', value: { accuracy: move.accuracy } });

  if (move.priority !== 0) tags.push({ id: 'priority', value: { priority: move.priority } });
  if (move.chargeTurns) tags.push({ id: 'charge' });
  if (move.rechargeTurns) tags.push({ id: 'recharge' });

  /*
   * STAB, only when there is a holder to have it, and never on a status move —
   * the bonus multiplies damage, and a status move rolls none.
   */
  if (holder && move.category !== 'Status' && holder.types.includes(move.type)) {
    tags.push({ id: 'stab' });
  }

  if (move.recoil) tags.push({ id: 'recoil' });
  if (move.drain) tags.push({ id: 'drain' });
  if (move.highCrit) tags.push({ id: 'highCrit' });
  if (move.bypassesProtect) tags.push({ id: 'bypassesProtect' });
  if (move.flags.includes('contact')) tags.push({ id: 'contact' });
  if (move.flags.includes('sound')) tags.push({ id: 'sound' });

  return tags.sort((a, b) => MOVE_TAG_PRIORITY[a.id] - MOVE_TAG_PRIORITY[b.id]);
}

/**
 * The tags that fit on a button face: the first `max` in priority order.
 *
 * A prefix of `moveTags`, never a different selection, so a tag on the face is
 * always in the explanation and the explanation is always a superset. A cut
 * that reordered would mean a player learning that the first tag is the most
 * important one and then being wrong about it on the next card.
 */
export function tagsForFace(move: MoveExplanation, max: number, holder?: TagHolder): MoveTag[] {
  return moveTags(move, holder).slice(0, Math.max(0, max));
}

/**
 * Whether this move has a status readout to render. **Part 6a.**
 *
 * A status move renders three empty regions where base power, band and the
 * effectiveness marker sit on a damaging move, so it reads as broken. The fix
 * is that the same region carries an effect readout — and this is the question
 * "is there one", asked once, so the card and any test agree on the answer.
 *
 * Damaging moves return false even when they carry a secondary: the secondary
 * belongs in the explanation, but the region on the face is already occupied by
 * a base power and a band and does not need a second tenant.
 */
export function hasStatusReadout(move: MoveExplanation): boolean {
  return move.category === 'Status' && statusEffectFields(move).length > 0;
}

/**
 * Which structured fields a status move's readout is built from.
 *
 * **Present fields only.** The rule is that an absent field is omitted rather
 * than rendered as an empty row — a status move showing "Boosts: none, Heals:
 * none" would be the same three empty regions this feature exists to remove,
 * just with labels on them.
 *
 * Returned as field *names* rather than as sentences, because the sentences
 * live in `data/moveCopy.ts` and are composed by the UI. `core/` returns data,
 * `data/` holds the wording, `ui/` renders — so a copy change stays a one-file
 * change.
 */
export function statusEffectFields(move: MoveExplanation): StatusEffectField[] {
  const fields: StatusEffectField[] = [];
  if (move.boosts?.length) fields.push('boosts');
  if (move.heal) fields.push('heal');
  if (move.status) fields.push('status');
  if (move.volatile) fields.push('volatile');
  if (move.fieldEffect) fields.push('fieldEffect');
  if (move.priority !== 0) fields.push('priority');
  return fields;
}

export type StatusEffectField = 'boosts' | 'heal' | 'status' | 'volatile' | 'fieldEffect' | 'priority';
