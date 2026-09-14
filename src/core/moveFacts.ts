/**
 * The fact strip on a move card face. **Patch 4.8.0.3, item 2.**
 *
 * `describeMove` returns a structured explanation and the card face rendered a
 * slice of it as a wrapping row of word badges. Words are wide. The battle
 * screen's vertical budget is the tightest surface in the game — four move
 * buttons have to finish above the fold on a 390x844 phone — and a row that
 * wraps to two lines on one button and one on the next is also a ragged grid.
 *
 * So the face carries icons with their numbers, and the words stay one tap
 * away in the explanation, which already prints every one of them.
 *
 * ## Why this is in `core/` and not beside the icons
 *
 * Same reason `moveTags` is. The battle buttons cannot reach `describeMove` —
 * `test/boundaries.test.ts` holds `ui/scene.ts` to the projection — so the
 * derivation has to happen where the projection is built, and the six card
 * surfaces outside a battle go through `ui/move-detail.ts`. One function, both
 * paths, or the face means something different inside a fight than outside it.
 *
 * This file knows nothing about glyphs. Which icon stands for contact is copy
 * and lives in `data/moveFactInfo.ts`, which `core/` does not import.
 *
 * ## What is here and what is not
 *
 * On the face: accuracy, secondary-effect chance, contact, a non-zero priority
 * bracket, charge, recharge, recoil, drain, multi-hit range. Everything else a
 * move can be — STAB, high crit, bypasses Protect, sound, the dex line — stays
 * behind the tap. That split is the patch's, and the rule it follows is that
 * the face carries what changes the arithmetic of *this* turn.
 *
 * **Flags render as flags.** `chargeTurns` is derived from the sim's `charge`
 * flag and is therefore always 1, so rendering it as "1 turn" would be
 * printing a number the field does not actually measure. It is a flag, and so
 * is anything else derived the same way.
 */
import type { MoveExplanation } from './types';

/**
 * The nine fields the face can carry, **in strip order**.
 *
 * Order is fixed rather than sorted by salience, because a strip whose icons
 * moved between cards would have to be read left to right every time instead
 * of glanced at. Accuracy first: it is the field the whole explanation layer
 * exists for.
 */
export const MOVE_FACT_IDS = [
  'accuracy',
  'secondary',
  'priority',
  'multiHit',
  'charge',
  'recharge',
  'recoil',
  'drain',
  'contact',
] as const;

export type MoveFactId = (typeof MOVE_FACT_IDS)[number];

export interface MoveFact {
  id: MoveFactId;
  /**
   * The number beside the icon, already formatted, or `''` for a flag.
   *
   * Empty means the icon stands alone — the fact is that the move *is* this
   * thing, and there is no quantity. It does not mean "unknown", which is why
   * an absent fact is absent from the list rather than present with an empty
   * value.
   */
  value: string;
}

/** A percentage of damage, as the strip prints it. */
function share(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * Every face fact this move has, in strip order.
 *
 * A move with none returns an empty array and the strip renders nothing at
 * all — no empty slots, no greyed placeholders. A status move with no
 * secondary and no priority is the common case of that.
 */
export function moveFactsOf(move: MoveExplanation): MoveFact[] {
  const facts = new Map<MoveFactId, string>();

  /*
   * A never-miss move has `accuracy: true` and contributes nothing here.
   *
   * That is not the field being dropped: `true` and `100` mean different
   * things — a 100% move is still checked and can be made to miss by an
   * evasion stage, a never-miss move is not checked at all — and an icon
   * reading `100` for both would collapse exactly the distinction the strip
   * sits on the face to preserve. The `neverMisses` tag says it in words, one
   * tap away, where there is room to say it correctly.
   */
  if (typeof move.accuracy === 'number') facts.set('accuracy', `${move.accuracy}`);

  if (move.secondary) facts.set('secondary', `${move.secondary.chance}%`);
  if (move.priority !== 0) facts.set('priority', `${move.priority > 0 ? '+' : ''}${move.priority}`);

  if (move.multiHit) {
    const [min, max] = move.multiHit;
    facts.set('multiHit', min === max ? `${min}` : `${min}-${max}`);
  }

  // Both are flag-derived and both are therefore flags. See the header.
  if (move.chargeTurns) facts.set('charge', '');
  if (move.rechargeTurns) facts.set('recharge', '');

  if (move.recoil) facts.set('recoil', share(move.recoil));
  if (move.drain) facts.set('drain', share(move.drain));

  // Read out of `flags[]`, not off a named field. The adapter does not gain a
  // `contact` property for this.
  if (move.flags.includes('contact')) facts.set('contact', '');

  return MOVE_FACT_IDS.filter((id) => facts.has(id)).map((id) => ({ id, value: facts.get(id) ?? '' }));
}
