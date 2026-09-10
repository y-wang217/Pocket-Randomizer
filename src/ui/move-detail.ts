/**
 * One function every screen outside a battle uses to describe a move.
 *
 * Stage 4.7, Part 6. The battle buttons get their tags and status readout on
 * the projection, because `src/ui/scene.ts` may not reach past it. Every other
 * surface — the reward card, the replacement screen, the party screen, the
 * drawer — is free to ask the adapter directly, and this is the one place that
 * asks, so all four agree about what a move is.
 *
 * That is Part 6's "one insertion point" from the other side of the boundary:
 * `scene.moveFacts` is the one component that *draws* a move card, and this is
 * the one function that fills it in.
 */
import { describeMove } from '../core/battle/driver';
import { moveTags, tagsForFace, hasStatusReadout } from '../core/moveTags';
import type { MoveTag } from '../data/moveTags';
import type { MoveEffectFields } from '../data/moveCopy';
import type { MoveExplanation } from '../core/types';
import type { Tuning } from '../data/tuning';

/** Everything a move card needs, in the shape `scene.moveCard` takes. */
export interface MoveCardData {
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  basePower: number;
  maxPp: number;
  tags: readonly MoveTag[];
  effect: MoveEffectFields | null;
  /**
   * The base-power band, 1 to 4, or null. **R12.**
   *
   * Read straight off the explanation, which took it from `bandOfMove`. Every
   * surface outside a battle fills its card through this function, so this is
   * the one place a band is resolved for all of them — and the reward card no
   * longer calls `bandOfMove` itself, which was the second path.
   */
  band: number | null;
  /** The full set, for the tap-to-expand explanation. A superset of `tags`. */
  allTags: readonly MoveTag[];
  /** The explanation itself, for a caller that wants a field the card omits. */
  explanation: MoveExplanation | null;
}

/**
 * Describe one move for a card.
 *
 * `holder` is the Pokemon the card is attached to, when there is one. **It is
 * optional and that is the STAB rule**: STAB is a property of the move and its
 * holder together, so a reward card with no recipient chosen yet passes nothing
 * and gets no STAB tag. Passing a holder that has not actually been chosen
 * would be claiming something not yet true.
 */
export function moveCardData(
  move: { name: string; type: string; category: 'Physical' | 'Special' | 'Status'; basePower: number; maxPp: number },
  tuning: Tuning,
  holder?: { types: readonly string[] },
): MoveCardData {
  const explanation = describeMove(move.name);
  if (!explanation) {
    return { ...move, tags: [], effect: null, band: null, allTags: [], explanation: null };
  }

  return {
    name: move.name,
    band: explanation.band,
    type: move.type,
    category: move.category,
    basePower: move.basePower,
    maxPp: move.maxPp,
    tags: tagsForFace(explanation, tuning.maxMoveTagsOnFace, holder ? { types: holder.types } : undefined),
    allTags: moveTags(explanation, holder ? { types: holder.types } : undefined),
    effect: hasStatusReadout(explanation) ? effectFieldsOf(explanation) : null,
    explanation,
  };
}

/** The structured subset a status readout is composed from. */
function effectFieldsOf(move: MoveExplanation): MoveEffectFields {
  return {
    ...(move.boosts ? { boosts: move.boosts } : {}),
    ...(move.heal ? { heal: move.heal } : {}),
    ...(move.status ? { status: move.status } : {}),
    ...(move.volatile ? { volatile: move.volatile } : {}),
    ...(move.fieldEffect ? { fieldEffect: move.fieldEffect } : {}),
    priority: move.priority,
  };
}
