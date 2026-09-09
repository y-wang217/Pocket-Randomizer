/**
 * Offensive type coverage: what a party can hit hard, as a set of types.
 *
 * One question, asked of a whole party rather than of a Pokemon: **which of the
 * eighteen types can this team hit super effectively right now?** A species
 * reward card uses it to say, in one line, what taking the offer would change.
 *
 * ## Why this is a fact and not a verdict
 *
 * Part 4 of the Stage 4.5.1 spec governs everything a reward card renders: the
 * UI presents attributes, never verdicts. Coverage is right on that line, and
 * this file is where the line is held. The function returns a **set of type
 * names** — not a score, not a count, not a rating. "Adds Dragon and Steel,
 * loses Ghost" is a readout the player judges. "Improves your coverage" is the
 * UI deciding for them, and there is deliberately no number here for anyone to
 * dress up as one.
 *
 * `coverageDelta` exists for the same reason. A caller that diffed two sets
 * itself would sooner or later diff their *sizes*, and a card reading "+2
 * coverage" is a score wearing a fact's clothes.
 *
 * ## What counts, and what deliberately does not
 *
 * A type is covered if any party member knows a damaging move whose type is
 * super effective against it. Three exclusions, each a decision:
 *
 *   - **Status moves do not count.** Thunder Wave hits Water for nothing.
 *   - **Remaining PP does not count.** A move at 0 PP still counts as coverage.
 *     A species swap is a decision about the *shape of the team*, and one whose
 *     readout changed depending on how the last fight went would be noise on a
 *     build decision — the same reasoning that keeps HP out of this.
 *   - **Fainted members still count.** They revive at the next node. A party
 *     that appeared to lose its Ghost coverage because someone went down would
 *     be reporting the fight, not the team.
 *
 * ## Purity
 *
 * No RNG, no tuning, no state beyond the party handed in. The same party gives
 * the same answer forever, which is what makes it liftable into the simulator
 * later — the spec defers that wiring, and this file does not anticipate it.
 *
 * The one impure-looking thing is `describeSpecCard`, which builds a probe
 * battle to read a spec's moves. It is a cached pure function of the spec (see
 * `core/battle/driver.ts`), and it is how every other part of this codebase
 * turns a `PokemonSpec` into move data — reimplementing the lookup from
 * `data/movePools.ts` would be a second source for what a move's type is.
 */
import { describeSpecCard, typeChart } from './battle/driver';
import type { PokemonState, TypeName } from './types';

/**
 * The types this party can hit super effectively, sorted.
 *
 * Sorted rather than in discovery order, because the result is rendered and
 * compared: a set whose order depended on party order would make the same team
 * read differently after a reorder, and would make `coverageDelta` produce
 * spurious changes.
 */
export function offensiveCoverage(party: readonly PokemonState[]): TypeName[] {
  const chart = typeChart();
  const covered = new Set<TypeName>();

  for (const member of party) {
    for (const move of describeSpecCard(member.spec).moves) {
      if (move.category === 'Status') continue;
      const row = chart.find((entry) => entry.type === move.type);
      if (!row) continue;
      for (const target of row.strongAgainst) covered.add(target);
    }
  }

  return [...covered].sort();
}

/** What changed between two coverage sets. Both directions, no arithmetic. */
export interface CoverageDelta {
  /** Types the after-set covers and the before-set did not, sorted. */
  added: TypeName[];
  /** Types the before-set covered and the after-set does not, sorted. */
  lost: TypeName[];
}

/**
 * The difference between two coverage sets.
 *
 * Deliberately returns the two *lists* and nothing else. No count, no net, no
 * boolean saying whether the change was good — Part 4 again: the player can see
 * that trading one Ghost move for a Dragon and a Steel is probably worth it,
 * and the UI does not get to say so.
 *
 * Takes sets rather than parties so a caller can compute the before-set once
 * and diff it against several candidate afters, which is exactly what the
 * species card does as the player moves between swap targets.
 */
export function coverageDelta(
  before: readonly TypeName[],
  after: readonly TypeName[],
): CoverageDelta {
  const had = new Set(before);
  const has = new Set(after);
  return {
    added: after.filter((type) => !had.has(type)).sort(),
    lost: before.filter((type) => !has.has(type)).sort(),
  };
}

/**
 * The coverage a party would have with one member replaced, without replacing
 * them.
 *
 * The species card needs this for a party that is already full: the player is
 * choosing *who to drop*, and the line has to update as they move between
 * members. Building the hypothetical party here rather than at the call site
 * keeps the card from having to know that a swap is a splice.
 *
 * `slot` out of range returns the coverage of the party plus the newcomer,
 * which is the empty-slot case — so a card that has not yet highlighted a
 * target renders the additive reading rather than a crash.
 */
export function coverageAfterSwap(
  party: readonly PokemonState[],
  incoming: PokemonState,
  slot: number,
): TypeName[] {
  const next = [...party];
  if (slot >= 0 && slot < next.length) next[slot] = incoming;
  else next.push(incoming);
  return offensiveCoverage(next);
}
