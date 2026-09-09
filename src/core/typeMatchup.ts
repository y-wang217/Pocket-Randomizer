/**
 * Which types hit this party hard, and which of those the party cannot hit back.
 *
 * ## The question, and the two it is not
 *
 * Three effectiveness surfaces exist and they answer different questions. The
 * per-move markers (`core/battle/effectiveness.ts`) answer *what does this
 * button do to the thing in front of me*, at move selection. The type wheel
 * (`ui/tooltips.ts`) answers *what does the Rock type do in general*, on
 * demand. This file answers *which types beat my team and I cannot answer* —
 * a standing property of the party, read between nodes.
 *
 * It is deliberately not about the current opponent, the next node, or any
 * individual move decision, and the signature is the guard: **it takes a party
 * and nothing else**. There is no encounter parameter to accidentally thread a
 * gym's type identity through, which is Part 4's hardest prohibition to
 * violate on purpose and its easiest to violate by accident.
 *
 * ## The two relations, which share a key space and are not the same relation
 *
 * `hitsHard(T)` is indexed by **attacking** type and evaluated against the
 * party's **defensive** typing. `punished(T)` is indexed by **defending** type
 * and evaluated against the party's **offensive** moves. They are not two
 * readings of one matrix and they must not be collapsed into one, because the
 * type chart is not symmetric: Ground hits Electric for double and Electric
 * does nothing to Ground.
 *
 * `punished` is not reimplemented here. It is membership in
 * `coverage.offensiveCoverage(party)`, exactly — that function unions
 * `typeChart().strongAgainst`, which is built per *single* type, so it already
 * means "super effective against a mono-`T` defender". A second implementation
 * would be a second answer waiting to disagree with the species card's
 * coverage line, which is the same set rendered a different way.
 *
 * ## What counts, and why
 *
 *   - **Fainted members count.** They revive at `tuning.reviveHpPercent` at the
 *     next node, so they are part of the team walking into the next fight. A
 *     readout that dropped them would flicker on every faint and would be
 *     reporting the last battle rather than the party.
 *   - **PP is ignored.** A move at 0 PP still answers a type. PP is transient
 *     and this readout is structural — the same reasoning `coverage.ts` gives,
 *     and the reason this calls that function rather than filtering it.
 *   - **Damaging is by category.** Status moves never contribute to `punished`,
 *     consistent with the rule that a status move carries no effectiveness at
 *     all rather than a neutral one.
 *   - **Abilities are folded in, always.** Not behind a `RevealPolicy` the way
 *     `moveEffectiveness` folds the *opponent's* ability: this is the player's
 *     own party and their abilities are on screen beside this line. Under full
 *     ability randomization a Ground weakness that Levitate cancels is a false
 *     alarm the player will not forgive twice.
 *   - **Only the eighteen standard types**, which is `driver.WHEEL_TYPES` — it
 *     already excludes Stellar, and documents why where that decision belongs.
 *
 * ## The one thing this cannot see
 *
 * `applyAbilityEffects` also resolves immunities keyed on a move's dex *flags*
 * — Bulletproof, Soundproof — and a type-level question has no move to read
 * flags off, so `NO_FLAGS` is passed and those never fire. That is correct
 * rather than a gap: Bulletproof does not resist Dark, it resists Dark *bullet
 * moves*, and a party-level line claiming otherwise would be wrong about
 * seventeen of the eighteen Dark moves in the pool. The per-move markers are
 * where a flag gets its say, on a button where there is a move to ask about.
 *
 * ## Purity
 *
 * No RNG, no clock, no tuning, no state beyond the party handed in. Not wired
 * into the simulator, for the same reason `offensiveCoverage` is not: whether a
 * threat-aware node policy beats a tier-greedy one is a real question and it is
 * not answered by a patch that adds a readout. Keeping it pure is what leaves
 * that question askable later.
 */
import { abilityEffects } from '../data/abilityEffects';
import { describeSpecCard, typeMultiplier, WHEEL_TYPES } from './battle/driver';
import { applyAbilityEffects } from './battle/effectiveness';
import { offensiveCoverage } from './coverage';
import type { PokemonState, TypeName } from './types';

/**
 * The multiplier at which a type counts as hitting a member hard.
 *
 * **Not in `data/tuning.ts`, and that is a decision rather than an oversight.**
 * `Tuning` is what a sweep varies per run, and this is not a dial: it is the
 * type chart's own step, the same 2x the game has meant by "super effective"
 * since Stage 0. A knob here would let a balance sweep change what the word
 * means — and it could not be reached anyway, because the signature is
 * deliberately `(party)` and threading a `Tuning` in is precisely the door
 * through which an encounter would eventually arrive.
 *
 * A 4x weakness is one member at `>= 2`, counted once. The net product across
 * both slots of a dual type is computed once, so 2x on one slot and 0.5x on the
 * other is 1x and is not counted at all.
 */
export const HITS_HARD_AT = 2;

/**
 * No move, so no flags. See "The one thing this cannot see" above.
 *
 * Frozen and named rather than a `[]` literal at the call site, so the reason
 * it is empty is attached to the emptiness.
 */
const NO_FLAGS: readonly string[] = Object.freeze([]);

/** One type the party takes hard and cannot hit back. */
export interface ThreatEntry {
  type: TypeName;
  /** Party members taking `>= HITS_HARD_AT` from this type, after abilities. */
  membersHit: number;
  /**
   * The denominator, carried so the UI never recomputes it.
   *
   * On every entry rather than once alongside the list, because a caller that
   * had to pair a list with a separate size would eventually render one against
   * the other's party.
   */
  partySize: number;
}

/**
 * The types that hit this party hard and that nothing on it answers.
 *
 * In `WHEEL_TYPES` order — the canonical dex ordering, which for the eighteen
 * standard types is alphabetical. **Not sorted by `membersHit` or by anything
 * else that implies severity.** A 4x weakness is a fact and the detailed
 * reading shows it; putting it at the top of the list would be the UI telling
 * the player what to be most afraid of, which is a verdict and not a readout.
 *
 * An empty party returns an empty array rather than throwing. So does a party
 * that answers everything that hits it, and the two are the same answer
 * because they are the same fact: there is nothing to list.
 */
export function partyThreats(party: readonly PokemonState[]): ThreatEntry[] {
  if (party.length === 0) return [];

  const answered = new Set(offensiveCoverage(party));

  /*
   * Resolved once per member rather than once per member per type.
   *
   * `describeSpecCard` is cached, but `abilityEffects` is a lookup and the loop
   * below runs it eighteen times a member otherwise. The types come off the
   * card rather than off the species table for the reason the card exists: it
   * is `mon.getTypes()`, which is what the engine will actually defend with.
   */
  const defenders = party.map((member) => {
    const card = describeSpecCard(member.spec);
    return { types: card.types, effects: abilityEffects(card.abilityId) };
  });

  const threats: ThreatEntry[] = [];
  for (const type of WHEEL_TYPES) {
    if (answered.has(type)) continue;

    let membersHit = 0;
    for (const defender of defenders) {
      // The net product across both slots, computed once, then the ability.
      const naive = typeMultiplier(type, defender.types);
      if (applyAbilityEffects(naive, type, NO_FLAGS, defender.effects) >= HITS_HARD_AT) membersHit++;
    }

    if (membersHit > 0) threats.push({ type, membersHit, partySize: party.length });
  }
  return threats;
}

// ---------------------------------------------------------------------------
// The words. One place, per item G.
// ---------------------------------------------------------------------------

/*
 * Here rather than in `ui/`, for the reason `EFFECTIVENESS_LABELS` and
 * `core/hpCopy.ts` are: the wording is the same kind of thing as the readout
 * itself — the names its answers go by — and a screen that spelled them out
 * inline would be a second place for the phrasing to be edited. Two screens
 * render this, which is exactly the count at which a string starts to drift.
 *
 * Every line below is a statement about the player's own party. None of them
 * says the party is weak, bad, vulnerable or in trouble; none is a score, a
 * rating or a grade; none suggests what to do about anything on the list. That
 * is Part 4, and this readout is the closest thing the game contains to advice,
 * so it is the place the line is most worth holding.
 */

/** The heading. Names what the list is, and claims nothing about it. */
export const THREAT_TITLE = 'Watch for';

/** What membership in the list means, in one sentence. */
export const THREAT_EXPLAINER =
  'Types that hit at least one member for double or more, and that no move in your party is strong against.';

/**
 * The empty case, said flatly.
 *
 * Not "your party is covered" or "no weaknesses" — both of those are the UI
 * grading the team. There is nothing to list, and that is all this says.
 */
export const NO_THREATS = 'No types to list.';

/** The simple reading: `Watch for: Fire, Ground, Ice`. */
export function threatLine(threats: readonly ThreatEntry[]): string {
  if (threats.length === 0) return NO_THREATS;
  return `${THREAT_TITLE}: ${threats.map((entry) => entry.type).join(', ')}`;
}

/** The detailed reading for one type, without its name: `hits 3 of 4, unanswered`. */
export function threatDetail(entry: ThreatEntry): string {
  return `hits ${entry.membersHit} of ${entry.partySize}, unanswered`;
}

/** The same with the type named, for a label a badge does not already carry. */
export function threatDetailLine(entry: ThreatEntry): string {
  return `${entry.type}: ${threatDetail(entry)}`;
}
