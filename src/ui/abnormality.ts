/**
 * Which abnormality beat each side gets, reduced out of a turn's flags.
 *
 * **This file exists because of a boundary, and the boundary is the point.**
 * `test/boundaries.test.ts` forbids `ui/scene.ts` from reading `.flags` or
 * `.residual` at all, and says why: "the stage's beats read `action.side` and
 * the bar's chunk boolean, and nothing else. A beat that read `flags` would be
 * one step from a recoil that grew with the multiplier, which is a verdict
 * drawn on the board."
 *
 * Branch 3B's first build ignored that and read flags in `beats()`. Every
 * comment it wrote promised not to rank them — which is exactly the kind of
 * promise the rule exists to replace with a guarantee. So the reduction happens
 * here, and the scene is **handed** a class and a slot rather than taking them.
 * It cannot weight a beat by severity because it cannot see severity; that is
 * true by construction rather than by care, which is the same standard the rest
 * of the battle UI is held to.
 *
 * The scene's own allowance is phrased that way too: it "may name the shape;
 * the moment it calls the reader it has become the second source of truth".
 * `screens/battle.ts` still reads the protocol exactly once and now hands the
 * result to three consumers instead of two.
 */
import type { Flag, FlaggedTurn, FlagKind } from '../core/battle/flags';
import type { ActorSide } from '../core/battle/turnOrder';

/**
 * The five classes the stage can draw.
 *
 * Classes, not the seventeen kinds: the stage says *something abnormal
 * happened, and roughly what sort*, and the strip beside it says exactly what.
 * Seventeen motions would be a vocabulary to learn rather than a signal to read.
 */
export type AbnormalityClass = 'prevented' | 'stage' | 'trait' | 'volatile' | 'field';

export interface AbnormalityMark {
  side: ActorSide;
  klass: AbnormalityClass;
  /** The beat slot it rides, so it costs the turn no extra time. */
  slot: number;
}

/**
 * Which class a kind belongs to, or `null` for one the stage already answers.
 *
 * A hit, a faint and a chunk have beats of their own, so the kinds that
 * describe one — the effectiveness pair, the crit, the miss, the status and
 * the berry — return `null` here and are animated by the stage. `priority` is
 * the turn order, which the lunge already draws. STAB and contact were named in
 * this list until M4.1 deleted the two kinds.
 */
function classOf(kind: FlagKind): AbnormalityClass | null {
  switch (kind) {
    // A turn that produced nothing, either because the Pokemon could not move
    // or because the move did nothing. Both are the absence of an outcome.
    case 'prevented':
    case 'failed':
      return 'prevented';
    /*
     * Both directions share a class, deliberately. Which way a stat went is a
     * word on the strip and a chip on the panel; a beat that rose for a boost
     * and fell for a drop would be the board taking a view on which is better.
     */
    case 'boost':
    case 'unboost':
      return 'stage';
    case 'ability':
      return 'trait';
    case 'volatile':
      return 'volatile';
    case 'field':
      return 'field';
    default:
      return null;
  }
}

/**
 * The marks for the turn just resolved, at most one per side.
 *
 * **The group is not always the one the lunges came from**, and the first build
 * missed it in the one case the `prevented` class exists for. `|cant|` replaces
 * the `|move|` line rather than accompanying it, so a prevented turn has no
 * action at all and its flag lands in `residual` — picking the last group with
 * actions therefore marked nothing on exactly the turn that already leaves no
 * other trace.
 *
 * `ui/flag-strip.ts` had already solved that, so this mirrors its rule rather
 * than inventing a second one: prefer the last group carrying flags, fall back
 * to the last with actions. The strip and the stage now answer "which turn is
 * being shown" identically, which is what stops them disagreeing about a turn.
 */
export function abnormalityMarks(turns: readonly FlaggedTurn[] | undefined): AbnormalityMark[] {
  if (!turns || turns.length === 0) return [];
  const reversed = [...turns].reverse();
  const group =
    reversed.find((turn) => turn.actions.some((each) => each.flags.length > 0) || turn.residual.length > 0) ??
    reversed.find((turn) => turn.actions.length > 0);
  if (!group) return [];

  /*
   * The order the sides acted, which is what the beat slots are numbered by.
   * Computed the same way `beats()` computes it — by first action, capped at
   * two — so a mark's delay lands exactly on the lunge or hit it accompanies
   * and the turn gains no time.
   */
  const seen: ActorSide[] = [];
  for (const { action } of group.actions) {
    if (!seen.includes(action.side)) seen.push(action.side);
  }

  /**
   * First in protocol order wins.
   *
   * This said "and the strip carries the rest" until M4.1, when R9 and D23 cut
   * the strip to one flag per side per channel. The rest is in the log sheet
   * now, one tap away, which is where C2's re-encoding of what leaves the board
   * lives. The beat is unchanged: one mark per side either way.
   */
  const marks = new Map<ActorSide, AbnormalityMark>();
  const note = (flag: Flag, slot: number): void => {
    const klass = classOf(flag.kind);
    /*
     * Not a ranking. `flags.ts` calls protocol order "the one ordering that is
     * a fact rather than an opinion", which is exactly what makes taking the
     * first of several safe: it is the order the engine produced them in, not a
     * judgement about which mattered most.
     */
    if (!klass || marks.has(flag.side)) return;
    marks.set(flag.side, { side: flag.side, klass, slot });
  };

  for (const { action, flags } of group.actions) {
    const slot = Math.max(1, seen.indexOf(action.side) + 1);
    for (const flag of flags) note(flag, slot);
  }
  /*
   * Residual flags hung on no action — a berry at end of turn, weather
   * settling — so they ride the last slot rather than earning a fifth. A fifth
   * slot is the added time this whole arrangement exists to avoid.
   */
  for (const flag of group.residual) note(flag, Math.max(seen.length, 1));

  return [...marks.values()];
}
