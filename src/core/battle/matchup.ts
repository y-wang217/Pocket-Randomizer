/**
 * How good a matchup is, as one number. **Pure, no RNG, no calc, no dex.**
 *
 * Ported from `SimpleHeuristicsPlayer`, the poke-env baseline that sits far
 * above every other published heuristic bot, and diverged in one place that
 * matters more here than anything else in the port.
 *
 * ## The randomizer divergence, and why the reference cannot be copied
 *
 * The reference estimates a matchup from **species types**: the best multiplier
 * my types get on yours, minus the best yours get on mine. That works because
 * in a normal game a Pokemon's types predict its moves — a Fire type carries
 * Fire moves, and STAB makes them the ones it uses.
 *
 * **Under full move randomization that is fiction.** A Gyarados in this game
 * may hold four Grass moves and no Water one, and the reference would still
 * read it as a Water threat. We have been here twice before: the playtest round
 * 2 effectiveness hint read species typing where it meant per-move typing, and
 * the 4.7 archetype labels read base stats and "lie sometimes under full move
 * randomization".
 *
 * So the port is split down the middle, and the split is the rule:
 *
 *   - **Offence is read from the four slotted moves.** What I can actually do
 *     to you is what I am actually carrying.
 *   - **Defence is read from species types.** What I resist is a fact about
 *     what I am, and the randomizer does not touch it.
 *
 * The same divergence is recorded in `docs/engine-notes.md` next to the gender
 * finding, because it is the kind of thing that gets rediscovered by someone
 * porting the reference again.
 *
 * ## What this decides, and what it does not
 *
 * This function is a **gate**: it answers "is this matchup bad enough to leave,
 * and is there anywhere better to go". It is not the score a choice is ranked
 * by — that is `ai.ts`'s race model, which is in turns of advantage and is what
 * makes a switch comparable to a move. Two matchup models in one scorer would
 * be two AIs; these two do different jobs, and the header on `ai.ts` says why
 * the ranking one has to be the race.
 */
import { MATCHUP } from '../../data/ai';
import { typeMultiplier } from './driver';

/** One side of a matchup, in the only terms this function reads. */
export interface MatchupSide {
  /** Species types. Defence is read from these, always. */
  types: readonly string[];
  /**
   * The types of the damaging moves this side is *known* to hold.
   *
   * Empty means nothing is known, and the fallback is the species types — which
   * is the reference implementation's assumption, used here only where the
   * knowledge level leaves no alternative. A `seenKnowledge` opponent fills
   * this in from what the battle has shown it; its own side is always complete.
   */
  attackTypes: readonly string[];
  hpFraction: number;
  speed: number;
}

/**
 * Positive when `mine` is winning this matchup, negative when it is losing.
 *
 * Deterministic in its arguments and nothing else: the same two sides always
 * produce the same number, which is what makes a switch decision reproducible
 * from a seed.
 */
export function estimateMatchup(mine: MatchupSide, theirs: MatchupSide): number {
  let score = bestMultiplier(mine, theirs) - bestMultiplier(theirs, mine);
  score += mine.speed > theirs.speed ? MATCHUP.speed : mine.speed < theirs.speed ? -MATCHUP.speed : 0;
  score += MATCHUP.hp * mine.hpFraction;
  score -= MATCHUP.hp * theirs.hpFraction;
  return score;
}

/** The best type multiplier `attacker` can reach `defender` with, from what is known. */
function bestMultiplier(attacker: MatchupSide, defender: MatchupSide): number {
  // The fallback, and the only place the reference's assumption survives: with
  // nothing revealed, a side is assumed to attack with what it is.
  const types = attacker.attackTypes.length > 0 ? attacker.attackTypes : attacker.types;
  let best = 0;
  for (const type of types) best = Math.max(best, typeMultiplier(type, defender.types));
  return best;
}

/** True when the matchup is bad enough to leave, given somewhere better to go. */
export function shouldLeave(current: number, bestSwitchIn: number): boolean {
  return current < MATCHUP.switchOut && bestSwitchIn > 0;
}
