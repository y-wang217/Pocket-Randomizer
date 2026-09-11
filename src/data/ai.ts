/**
 * The opponent's three skill tiers, and every number a tuning pass would touch.
 *
 * **What tier means, and what it does not.** A tier is a *flag set*, not a
 * difficulty multiplier. Every tier runs the same scorer in `core/battle/ai.ts`
 * over the same information; what differs is which pieces of that scorer it is
 * allowed to use, and how often it takes a lesser choice. That is how every
 * reference family builds skill — pokeemerald-expansion's per-trainer flags,
 * Pokemon Essentials' cumulative skill bands — and the reason is the same in
 * all of them: three algorithms are three things to keep honest, and a report
 * cannot say which one it measured.
 *
 * **No tier anywhere gets a stat, a damage roll or a hidden number.** Not one.
 * A hard opponent is hard because it reads the board better and remembers what
 * it has seen, and if that turns out not to be hard enough, the answer is a
 * scaling table and not a thumb on this scale. Every prior stage has handled it
 * that way and this one does not get an exception.
 *
 * **Cumulative, with one exception that is the point.** Medium is easy's flags
 * plus more; hard is medium's plus more. What easy holds *extra* is the
 * handicap, `crudeDamage` — the calc taken away. The baseline of this project
 * has had a real damage calculation since Stage 0, so "does full damage" cannot
 * be a feature to add without describing the tree backwards. See
 * `core/battle/ai.ts`, `AiFlag`.
 *
 * The tier a fight is played at comes from `aiTierFor` at the bottom, keyed by
 * node kind, node tier and segment. No generator has any logic about it.
 */
import type { AiFlag, AiProfile } from '../core/battle/ai';
import type { Tier } from '../core/types';
import type { NodeKind } from './tuning';

export type AiTier = 'easy' | 'medium' | 'hard';

/**
 * Easy: the floor, and it is built by restriction.
 *
 * Holds the one rule every reference implementation's floor holds — do not pick
 * the move that cannot do anything — and nothing else. No knockout instinct, no
 * priority, no switching in either direction, and a damage estimate made of
 * base power and the type chart. Essentials' wild tier picks uniformly at
 * random; this is a step above that and deliberately so, because a wild
 * Pokemon that plays *randomly* reads as broken rather than as weak.
 *
 * The noise is the largest in the table. An easy opponent should be visibly
 * beatable in a way a player can name: it uses the wrong move often enough to
 * notice, and the wrong move is still a move that made some sense.
 */
const EASY: AiProfile = {
  flags: ['avoidFailingMoves', 'crudeDamage'],
  noise: 0.35,
  switchFailure: 0,
};

/**
 * Medium: the normal trainer, and the rung `AI_FLAG_BASIC_TRAINER` describes as
 * "should feel like normal trainers".
 *
 * Everything easy holds minus the handicap, plus the knockout instinct and the
 * priority layer in front of it, plus HP sense, plus what the battle has
 * actually shown it, plus the item it can see. It switches, and it chooses its
 * send-in by matchup. This is roughly where the reference `SimpleHeuristicsPlayer`
 * sits, except that its damage model is better than that bot's and its matchup
 * model is worse — see `docs/engine-notes.md` on why a randomizer breaks the
 * reference's type-based matchup estimate.
 */
const MEDIUM: AiProfile = {
  flags: [
    'avoidFailingMoves',
    'takeTheKo',
    'hpAware',
    'itemAware',
    'seenKnowledge',
    'smartSendIn',
    'smartSwitching',
  ],
  noise: 0.12,
  switchFailure: 0.15,
};

/**
 * Hard: medium plus one step of lookahead.
 *
 * The published ladder says this is the rung worth having — max base power to
 * one-step lookahead is the largest single gap in the PokeChamp table, larger
 * than every heuristic refinement between them put together. It is the only
 * thing hard gets, and it gets no information medium does not have.
 *
 * **Omniscience was cut.** The brief proposed a `fullKnowledge` flag that reads
 * the player's spec. It needs a privileged channel that does not exist, and the
 * moment it exists the symmetry rule above depends on the player-side simulator
 * bot getting the identical construction. If a later report says hard is not
 * hard enough, that flag is the next thing to build and it gets its own pass.
 *
 * The noise is low and **not zero**. A deterministic hard opponent is a puzzle
 * with one solution; the switch failure rate is what stops a gym leader being
 * baited on every turn by a player who has learned it never stays in.
 */
const HARD: AiProfile = {
  flags: [...MEDIUM.flags, 'oneStepLookahead'],
  noise: 0.05,
  switchFailure: 0.08,
};

export const AI_TIERS: Record<AiTier, AiProfile> = { easy: EASY, medium: MEDIUM, hard: HARD };

/** Every flag a tier holds, for a report or a test that wants to name them. */
export function flagsOf(tier: AiTier): readonly AiFlag[] {
  return AI_TIERS[tier].flags;
}

/**
 * Matchup coefficients, ported from `SimpleHeuristicsPlayer` and diverged where
 * the randomizer forces it. `core/battle/matchup.ts` is the function.
 */
export const MATCHUP = {
  /** What being faster is worth, in the units the type comparison produces. */
  speed: 0.1,
  /** What a full HP bar is worth, either side of the comparison. */
  hp: 0.4,
  /** Below this, the current matchup is bad enough to leave if there is somewhere to go. */
  switchOut: -2,
};

/**
 * Which tier plays which fight.
 *
 * **The first time node tier changes how a fight plays rather than only what it
 * pays.** Stage 3 built the risk gradient into the reward pools and nowhere
 * else, so an elite node was a better payout for a fight that played
 * identically to a normal one. It is now a better payout for a harder fight,
 * which is what a risk gradient is.
 *
 * A gym has no node tier — a gym *is* the segment's difficulty statement — so
 * it is keyed by segment instead, and the back half of the run is where the
 * leaders start playing the board rather than their move list.
 *
 * A starting table, to be moved by a report and not by taste.
 */
export function aiTierFor(kind: NodeKind, tier: Tier | null, segment: number): AiTier {
  if (kind === 'gym') return segment >= 4 ? 'hard' : 'medium';
  if (kind === 'wild') return 'easy';
  if (kind === 'trainer') {
    if (tier === 'elite') return 'hard';
    if (tier === 'hard') return 'medium';
    return 'easy';
  }
  // Rest, shop and event nodes do not fight. Answering rather than throwing
  // because a caller asking about a node with no encounter is asking a question
  // with an obvious answer, and the alternative is a guard at every call site.
  return 'easy';
}

/**
 * What the player is told they are facing.
 *
 * **An attribute, never a verdict.** The editorial rule allows the fact and
 * forbids the judgement: the card may say what kind of opponent this is, the
 * way it already says the node's tier and the segment's band, and it may not
 * say that one is a better idea than another. So these are names for who is
 * across the field, not ratings of how hard they will be — no stars, no
 * numbers, no "tough".
 */
export const AI_TIER_LABEL: Record<AiTier, string> = {
  easy: 'Rookie',
  medium: 'Seasoned',
  hard: 'Ace',
};

/** The one-line readout, for a tooltip or the battle panel's detail line. */
export const AI_TIER_DETAIL: Record<AiTier, string> = {
  easy: 'Reads base power and type matchups. Stays in.',
  medium: 'Reads the damage it will do, remembers what it has seen, and switches.',
  hard: 'Plays the turn after this one, and switches on a bad matchup.',
};
