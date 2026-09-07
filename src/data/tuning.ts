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

/**
 * Difficulty tier, carried on every node.
 *
 * Stage 1 sets `normal` everywhere and never displays it. It exists now because
 * Stage 3 keys reward pools to it, and retrofitting a field onto generated map
 * data would invalidate every seed recorded before the change.
 */
export type NodeTier = 'normal' | 'elite' | 'boss';

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

  // --- levels --------------------------------------------------------------

  /** The level a starter enters the run at. */
  starterLevel: number;
  /** Added to every encounter level per segment index. Stage 1 passes 0. */
  levelPerSegment: number;
  /** Encounter level relative to the segment's base level, per node kind. */
  levelOffset: Record<NodeKind, Range>;

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
 * The numbers Stage 1 ships with.
 *
 * The level spread was measured, not guessed. `npm run sweep` plays a few
 * hundred runs under three playstyles and reports what happened; these offsets
 * are the ones where the map does work:
 *
 *   playstyle          win   HP at gym   reached gym
 *   rest when offered  62%   94%         92%
 *   never rest         35%   35%         52%
 *   always trainers    17%   53%         27%
 *
 * Every encounter sits *below* the player, which sounds generous and is not:
 * the spread is what makes a fight winnable-but-not-free, and attrition rather
 * than any single fight is what ends a run. Narrower spreads were tried and
 * turned each node into a coin flip on the matchup — see docs/generation.md.
 */
export const DEFAULT_TUNING: Tuning = {
  stepsPerSegment: { min: 6, max: 8 },
  nodeChoiceCount: { min: 2, max: 3 },
  nodeWeights: { wild: 5, trainer: 3, rest: 2 },
  restEarliestStep: 1,
  distinctKindsPerStep: true,
  minRestSteps: 2,

  starterLevel: 30,
  levelPerSegment: 6,
  levelOffset: {
    wild: { min: -8, max: -6 },
    trainer: { min: -7, max: -5 },
    rest: { min: 0, max: 0 },
    gym: { min: -3, max: -3 },
  },

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
