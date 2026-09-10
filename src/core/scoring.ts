/**
 * What a run was worth, as a breakdown. **Stage 4.8, item 4.**
 *
 * A run used to end in a binary: eight gyms, or dead at gym N. That is the least
 * informative possible answer to "am I doing well", and it is the thing a
 * leaderboard will eventually read.
 *
 * Pure. No RNG, no DOM, no clock, no dex lookup. The same `RunState` gives the
 * same breakdown forever, which is what makes it liftable into the simulator and
 * assertable byte for byte in a test.
 *
 * ## A breakdown, never a bare number
 *
 * `scoreRun` returns the components *and* the total, and the total is the weighted
 * sum of the components it returns — not a separately computed figure that happens
 * to agree. A caller that wanted one number could add them up; a caller handed one
 * number could never take it apart, and "why did I score that" is the whole reason
 * a player looks at this.
 *
 * Every component is computed and returned **regardless of its weight**. A weight
 * of zero contributes zero points and still appears, because the column existing
 * is what lets a later pass read history out of it. See `data/scoring.ts`.
 *
 * ## Derived, and that is the determinism claim
 *
 * Every count here comes from `RunState`, which a replay rebuilds from the
 * decision log. So the score reconstructs identically, consumes no RNG, and needs
 * no field of its own in the log — the reason `RUN_LOG_VERSION` does not move for
 * this item. Nothing here is stored; `scoreRun` is called when a screen or a
 * report wants it.
 *
 * ## Part 4, and the one prohibition that matters
 *
 * Score is a *verdict* — it is the game's judgement of a finished run — which is
 * exactly why it may only appear once the run is finished. A projected score on a
 * node card ("+30") would turn the risk decision into a scoreboard hint and make
 * the tier badge an instruction. `test/scoring.test.ts` asserts per surface that
 * no node card, tier badge or reward card can reach this module.
 */
import { gymsCleared, type RunState } from './run';
import {
  SCORE_COMPONENTS,
  SCORE_LABELS,
  SCORE_WEIGHTS,
  type ScoreComponentId,
} from '../data/scoring';

/** One line of a breakdown: what was counted, what it pays, what it paid. */
export interface ScoreComponent {
  id: ScoreComponentId;
  /** What the result screen calls it. From `data/scoring.ts`. */
  label: string;
  /** How many of the thing the run did. Always computed, whatever the weight. */
  count: number;
  /** What one is worth. Zero is a real answer and still renders. */
  weight: number;
  /** `count * weight`. Zero whenever either is. */
  points: number;
}

export interface ScoreBreakdown {
  /** Every component, in `SCORE_COMPONENTS` order. Never a subset. */
  components: ScoreComponent[];
  /** The weighted sum of `components`. Not computed any other way. */
  total: number;
}

/**
 * Count the components of a run, before any weight is applied.
 *
 * Separate from the weighting so that a test can check the *counts* against a run
 * it built by hand without also agreeing with the balance numbers, and so the
 * simulator can report counts beside scores.
 */
export function scoreCounts(state: RunState): Readonly<Record<ScoreComponentId, number>> {
  const visits = state.history;

  return {
    gymsCleared: gymsCleared(state),

    /*
     * Tier counted off the node actually entered, so a tier declined costs
     * nothing and a tier taken pays whether or not the fight went well. Reading
     * the tier of the *options* would pay for being offered risk.
     */
    eliteNodes: visits.filter((visit) => visit.node.tier === 'elite').length,
    hardNodes: visits.filter((visit) => visit.node.tier === 'hard').length,

    /*
     * **Members caught and still held**, which is a narrower thing than captures
     * made and is named that way on the screen for that reason.
     *
     * `joinedSegment === 0` is the starter, which is the convention the codebase
     * already reads this field by. It conflates one case — a capture made in
     * segment 0 — and it cannot see a member caught and later released or lost,
     * because neither is in `RunState` any more. Both under-count, never over, and
     * the alternative was logging a counter, which would put a derived number in
     * the run log to save an adjective here.
     */
    captures: state.party.filter((member) => member.joinedSegment > 0).length,

    relics: state.relics.length,

    /*
     * Standing at the end, not party size: a wipe scores zero here rather than
     * scoring its corpses. `fainted` is the same field `isWiped` reads.
     */
    survivors: state.party.filter((member) => !member.fainted).length,

    /*
     * Every turn of every battle the run actually fought, summed off the visits.
     * Recorded at weight zero — see `data/scoring.ts` for why the column exists
     * before the decision about pace does.
     */
    turns: visits.reduce((sum, visit) => sum + (visit.result?.turns ?? 0), 0),
  };
}

/**
 * Score a run.
 *
 * The total is built by summing the components as they are returned, in one pass,
 * so there is no second expression that could disagree with the list a player is
 * reading. `test/scoring.test.ts` asserts that identity directly.
 */
export function scoreRun(state: RunState): ScoreBreakdown {
  const counts = scoreCounts(state);

  const components: ScoreComponent[] = SCORE_COMPONENTS.map((id) => {
    const count = counts[id];
    const weight = SCORE_WEIGHTS[id];
    return { id, label: SCORE_LABELS[id], count, weight, points: count * weight };
  });

  return {
    components,
    total: components.reduce((sum, component) => sum + component.points, 0),
  };
}
