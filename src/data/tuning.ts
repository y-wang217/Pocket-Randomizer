/**
 * Every balance number in the game, in one typed object.
 *
 * The rule this file exists to enforce: nothing under core/ may reach in here
 * for a constant. `Tuning` is *passed* into generation and into the run state
 * machine, never imported from deep inside a function. Stage 2 sweeps these
 * values programmatically — a thousand runs at `stepsPerSegment: 6` against a
 * thousand at 8 — and that is only possible if every number is reachable from
 * a value the caller controls.
 *
 * If you find yourself writing a literal number in core/, it belongs here.
 */

/** The kinds of node a step can offer. `gym` is never an option, only a cap. */
export type NodeKind = 'wild' | 'trainer' | 'rest' | 'gym';

/** An inclusive integer range, drawn uniformly. */
export interface Range {
  min: number;
  max: number;
}

export interface Tuning {
  // --- map shape -----------------------------------------------------------

  /** Steps before the gym. Each step is one choice between nodes. */
  stepsPerSegment: Range;
  /** How many nodes a step offers. The spec calls for 2 or 3. */
  nodeChoiceCount: Range;
  /** Relative frequency of each node kind when filling a step's options. */
  nodeWeights: Record<Exclude<NodeKind, 'gym'>, number>;
  /**
   * First step index that may offer a rest.
   *
   * A rest on step 0 is a wasted choice — nothing has happened yet — and a step
   * whose only interesting option is a no-op teaches the player that the map
   * does not matter. Stage 1 has no rewards to create the tension instead.
   */
  restEarliestStep: number;
  /**
   * Whether a step's options must all be different kinds.
   *
   * On, because the map hides encounter contents: two wild nodes side by side
   * read as one option printed twice. It also caps a step's option count at the
   * number of kinds available, so an early step where rest is not yet allowed
   * offers two rather than silently offering a duplicate.
   */
  distinctKindsPerStep: boolean;
  /**
   * Minimum steps in a segment that offer a rest.
   *
   * Weighted draws can produce a segment with no rest at all. A run whose seed
   * decided there was nowhere to heal is not a hard run, it is a run the player
   * had no hand in, so generation guarantees a floor.
   */
  minRestSteps: number;

  // --- persistence between nodes ------------------------------------------

  /**
   * Fraction of max HP a rest node restores. 1 is a full heal.
   *
   * Partial restore is a Stage 3 question: it only becomes an interesting
   * decision once rewards give skipping a rest a real opportunity cost.
   */
  restHpFraction: number;
  /** Fraction of max PP a rest node restores. */
  restPpFraction: number;
  /** Whether a rest node also clears status. */
  restClearsStatus: boolean;
  /**
   * Clear status when a node ends.
   *
   * On by default, and it is a real balance decision rather than a shortcut.
   * A whole segment carried on one Pokemon means a turn-two freeze or a sleep
   * that outlasts the fight is not a decision the player made, it is a coin
   * flip that ends the run. HP and PP attrition is the interesting pressure;
   * status is a per-battle problem. Flip this to false to feel the difference.
   */
  clearStatusBetweenNodes: boolean;
  /**
   * Revive fainted party members at the start of the next node.
   *
   * Irrelevant in Stage 1, where a fainted party member means an empty party
   * and the run is already over. It is encoded now so that wipe — *every*
   * member fainted — stays the only death rule when Stage 4 adds slots.
   */
  reviveFaintedBetweenNodes: boolean;

  // --- selection -----------------------------------------------------------

  /** How many species the starter screen offers. */
  starterOptionCount: number;
}

/**
 * The numbers the game ships with.
 *
 * Levels and bands used to live here and now live in data/scaling.ts, which is
 * a per-segment table rather than two numbers and a multiplication. What is
 * left is the *shape of a segment*: how long it is, what it offers, and what
 * survives a node boundary. Those are the same at segment 1 and segment 8, so
 * they stay one object rather than eight rows.
 *
 * Measured with `npm run sim`, not guessed; docs/balance.md carries the report.
 */
export const DEFAULT_TUNING: Tuning = {
  stepsPerSegment: { min: 6, max: 8 },
  nodeChoiceCount: { min: 2, max: 3 },
  nodeWeights: { wild: 5, trainer: 3, rest: 2 },
  restEarliestStep: 1,
  distinctKindsPerStep: true,
  minRestSteps: 2,

  restHpFraction: 1,
  restPpFraction: 1,
  restClearsStatus: true,
  clearStatusBetweenNodes: true,
  reviveFaintedBetweenNodes: true,

  starterOptionCount: 3,
};

/** A tuning derived from the default. Stage 2's sweep builds variants this way. */
export function withTuning(overrides: Partial<Tuning>): Tuning {
  return { ...DEFAULT_TUNING, ...overrides };
}
