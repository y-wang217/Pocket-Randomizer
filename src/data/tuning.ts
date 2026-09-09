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

import type { Tier } from '../core/types';
import { PARTY_SIZE } from './partyTuning';

/**
 * The kinds of node a step can offer. `gym` is never an option, only a cap.
 *
 * Stage 3 added `shop` and `event`. Both are choosable, neither is a fight, and
 * neither carries a tier — a tier scales an encounter and selects a reward
 * pool, and a node with no encounter and no reward has nothing for one to do.
 */
export type NodeKind = 'wild' | 'trainer' | 'rest' | 'gym' | 'shop' | 'event';

/**
 * The kinds of node that are actually a fight.
 *
 * Introduced in Stage 3 to narrow the curve tables in `data/scaling.ts`. Those
 * were `Record<NodeKind, …>`, which meant every non-battle kind carried a level
 * offset and a team size that could never be read — `rest: { min: 0, max: 0 }`
 * was already meaningless filler, and adding `shop` and `event` would have
 * tripled it across eight rows. Narrowing the key is the version where the type
 * system says which kinds have a difficulty and which do not.
 */
export type BattleKind = Extract<NodeKind, 'wild' | 'trainer' | 'gym'>;

/** The kinds a step may actually offer as a choice. */
export type ChoosableKind = Exclude<NodeKind, 'gym'>;

/**
 * How likely each tier is over a stretch of the run.
 *
 * A band rather than a per-segment row because the thing being described is a
 * *phase* of the run — "the opening", "the middle", "the back half" — and eight
 * rows of three numbers would be eight places to make the same edit and one
 * place to get it wrong. `data/scaling.ts` is per segment because a level curve
 * genuinely bends at one segment; a risk appetite does not.
 */
export interface TierBand {
  /** The last segment index this row covers. Rows are read in order. */
  throughSegment: number;
  /**
   * Relative frequency of each tier. Zero locks a tier out of the band
   * entirely, which is what keeps `elite` off the opening segments.
   */
  weights: Record<Tier, number>;
}

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
  nodeWeights: Record<ChoosableKind, number>;
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

  // --- difficulty tiers ----------------------------------------------------

  /**
   * The tier distribution, by phase of the run. Read in order; the first row
   * whose `throughSegment` covers the segment wins.
   */
  tierBands: readonly TierBand[];
  /**
   * Whether the battle nodes in one step must all carry different tiers.
   *
   * **On, and it is the single rule that makes Stage 3 a decision rather than a
   * label.** A step is a choice, and a step whose two fights are both `hard` is
   * a choice between two identical risks with two identical reward pools — the
   * tier is then decoration printed twice. Drawing without replacement means
   * every step that offers two fights offers two *different* trades, which is
   * the same reasoning as `distinctKindsPerStep` applied one level down.
   *
   * Turning it off gives independent weighted draws per node, which is the
   * honest comparison for a simulator run that wants to know whether the spread
   * is doing any work.
   */
  distinctTiersPerStep: boolean;

  // --- shops and events ----------------------------------------------------

  /** How many things a shop stocks. Drawn per shop at map generation. */
  shopStockSize: Range;
  /**
   * Fraction of max HP an event may never take a party member below.
   *
   * **An event cannot end a run, and that is a rule rather than a tuning
   * accident.** An event is a node with no battle in it; a player who loses a
   * run to one has lost it to a coin flip they could see but not play. The risk
   * an event carries is that you arrive at the *next* fight nearly dead, which
   * is a cost the player can then make decisions about.
   *
   * It is also what keeps the death rule coherent: `isWiped` reads `fainted`,
   * and HP driven to zero without a faint would be a party in a state no other
   * code expects.
   */
  eventDamageFloor: number;

  // --- rewards -------------------------------------------------------------

  /**
   * Whether reward pools may offer a Pokemon to add to the party.
   *
   * **On from Stage 4, and the flag stays because it is now a real lever
   * rather than a gate.** Stage 3 typed the kind, wrote the pool entries, and
   * left this false with a note: at party size 1 a species reward was not an
   * addition, it was a forced swap of the run's only Pokemon — either the most
   * interesting decision in the game or an instant run-ender, and nothing short
   * of playing it would say which.
   *
   * A party is the condition that note was waiting for. Taking one now costs a
   * slot, or costs a member if the party is full, and declining is always
   * legal — so the card is a decision rather than a coin flip. It keeps the
   * flag so the simulator can measure a run of the game *without* reward
   * acquisitions against one with them, which is how the two routes get told
   * apart: wild nodes offer members too, and if the reward pools are turned off
   * and parties still fill, these cards are not the reason.
   */
  allowSpeciesRewards: boolean;
  /**
   * Whether a won wild node may offer the species it just fielded.
   *
   * The second acquisition route, with its own switch for the same reason the
   * first has one: they are two sources of the same decision, and a report that
   * cannot turn one off cannot say which of them fills a party. The rate itself
   * is keyed to tier in `data/rewardPools.ts` — this is on or off, not a
   * multiplier, because a multiplier here and a table there would be two dials
   * on one number.
   *
   * **Turning it off does not skip the roll.** `generateEncounterAcquisition`
   * draws first and discards, so a map generated with this off consumes exactly
   * the same `rewards` draws as one with it on. A flag that skipped the draw
   * would make every later reward in every seed depend on it, and the two
   * configurations would no longer be comparable — which is the one thing this
   * flag exists to make them.
   */
  allowEncounterAcquisitions: boolean;

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
  /**
   * Fraction of max HP and PP restored when a gym falls and a segment ends.
   *
   * The knob that made an eight-segment run survivable on one Pokemon, and the
   * second-largest balance finding of Stage 2. The simulator's diagnosis was
   * unambiguous: 80% of the runs that ended at an ordinary node entered that
   * node already damaged, and half of those below 40% HP. Attrition was not
   * pressure, it was a countdown — every segment started poorer than the last
   * and the run was decided somewhere around segment 3 regardless of play.
   *
   * Healing at the gym makes each segment its own attrition budget instead of
   * one eight-segment budget. That is also what the genre it is borrowing from
   * does: you clear a gym, you visit the Pokemon Center. Rest nodes still carry
   * the *within*-segment tension, which is where a choice between two nodes can
   * actually be interesting.
   *
   * Set below 1 to make late segments start on a deficit; set to 0 for the
   * original behaviour, which the simulator measured at a 2.5% completion rate
   * against a 5-15% target.
   */
  gymClearHealFraction: number;
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
  /**
   * Fraction of max HP a revived member returns at. Floored at 1 point.
   *
   * **Moved here from `partyTuning.reviveHpFraction` in Stage 4.5.1, and the
   * move is the point.** Stage 4 introduced partial revival as its headline
   * attrition lever and then put it somewhere a sweep cannot reach: module
   * scope in `data/partyTuning.ts`, read by a `reviveHpFor` that took no
   * tuning. So the one number the balance report kept blaming (docs/balance.md
   * §7.6: "partial free revival makes preservation cheap to skip") was the one
   * number `withTuning` could not vary, and every claim about it was an opinion
   * rather than a measurement.
   *
   * It also absorbs the old `freeRevive` boolean, which was `reviveHpPercent:
   * 1` written as a second knob. Two dials on one number is how the two answers
   * drift apart — see the note this file's header makes about `nodeWeights`.
   *
   * Half is still the shipped hypothesis. Lower makes a faint hurt for longer
   * than the node it happened on; 1 is the Stage 1 behaviour, where the bench
   * is three health bars rather than three Pokemon.
   */
  reviveHpPercent: number;

  // --- the backpack --------------------------------------------------------

  /**
   * How many *loose* items the run may carry. Held items do not count.
   *
   * Party size plus two, which is the smallest number that is still a decision:
   * enough to re-equip a full party from scratch, plus two spare to choose
   * between. Counting only loose items is the deliberate half — a capacity that
   * counted held ones would make equipping a Pokemon a way to dodge the limit,
   * and the limit exists so that *acquisition* stays a choice rather than pure
   * accumulation.
   *
   * Stage 3 refused to build a bag at all, on the grounds that a bag needs "a
   * screen, a capacity rule, and an answer to what happens on a wipe". This is
   * the capacity rule. The screen is the party screen, which is where items are
   * assigned; the answer on a wipe is that the run is over and the backpack
   * goes with it.
   *
   * If the simulator later shows players never reaching the cap, that is this
   * number being wrong, not the cap being pointless — see the note in
   * `core/items.ts` on why the finite version is the interesting one.
   */
  backpackCapacity: number;

  // --- selection -----------------------------------------------------------

  /** How many species the starter screen offers. */
  starterOptionCount: number;

  // --- what the battle screen may show ------------------------------------

  /**
   * Whether the opponent's ability is named on the battle screen.
   *
   * **On, and the reason is the randomizer rather than a preference for
   * generosity.** In a normal Pokemon game a hidden ability is still something
   * a player can reason about: a species has two or three legal abilities, the
   * set is public, and narrowing it from what the opponent does is a skill.
   * Stage 2 draws abilities from the *whole pool* off-species, so there is no
   * set to narrow and no meta knowledge to infer from. Hiding it does not
   * create a deduction, it converts a skill decision into a coin flip.
   *
   * That is the same reasoning Stage 1 used to clear status between encounters:
   * a difficulty that comes from the player not being told the rules is not
   * difficulty.
   *
   * It is a flag rather than a constant so the opposite can be playtested
   * cheaply. `ActiveUiView.ability.revealed` carries the value through, so the
   * effectiveness badge and the tooltip layer both respect it from one source
   * — a UI that hid the ability in one place and leaked it through a `0x` in
   * another would be worse than either choice made consistently.
   */
  revealOpponentAbility: boolean;

  /**
   * Whether the opponent's held item is named on the battle screen.
   *
   * Same argument, one step weaker: items come from a curated whitelist of
   * about twenty rather than the whole item dex, so a player could in principle
   * learn the list. But the list is *ours*, not the games', and Stage 3 hands
   * items to opponents from reward-tier pools the player never sees drawn. On
   * for the same reason, separable because the case is not identical.
   */
  revealOpponentItem: boolean;
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
  // Six to eight steps was sized for Stage 1's *single* segment. Eight of those
  // is a sixty-node run on one Pokemon, which the simulator measured as an
  // attrition countdown rather than a curve. Four to five puts a full run at
  // roughly forty nodes, which is the length the genre actually uses.
  stepsPerSegment: { min: 4, max: 5 },
  nodeChoiceCount: { min: 2, max: 3 },
  /*
   * Shops and events are deliberately scarcer than fights.
   *
   * A run is a sequence of fights with pressure between them; a map where every
   * other step is a shop is a map where the pressure never accumulates. These
   * weights put a shop in roughly one step in six and an event in one in four,
   * which is often enough to plan around and rare enough to be worth planning
   * around.
   */
  nodeWeights: { wild: 5, trainer: 3, rest: 2, shop: 1.5, event: 2.5 },
  restEarliestStep: 1,
  distinctKindsPerStep: true,
  minRestSteps: 2,

  /*
   * Elite is locked out of segments 0-1 and the weight climbs from there.
   *
   * Not because an early elite node would be unfair — the player can decline it
   * — but because it would be *illegible*. A player two steps into their first
   * run has no baseline for what a normal fight costs, so a tier label they
   * cannot price is a coin flip dressed as a decision. By segment 2 they have
   * fought a dozen nodes and the word means something.
   *
   * The back half raises the elite share so that declining risk gets steadily
   * harder to do. It does not *invert* the weights, which was the first cut:
   * `{3, 4, 4}` put 73% of late nodes above normal, and combined with
   * `distinctTiersPerStep` it meant a risk-averse player frequently had no safe
   * option at all. The simulator read that as a run dying to attrition it never
   * chose — per-segment survival around 62%, which compounds to a 1% clear over
   * eight segments.
   */
  tierBands: [
    { throughSegment: 1, weights: { normal: 7, hard: 3, elite: 0 } },
    { throughSegment: 4, weights: { normal: 5, hard: 5, elite: 1 } },
    { throughSegment: 7, weights: { normal: 4, hard: 5, elite: 2 } },
  ],
  distinctTiersPerStep: true,

  shopStockSize: { min: 3, max: 4 },
  eventDamageFloor: 0.05,

  allowSpeciesRewards: true,
  allowEncounterAcquisitions: true,

  restHpFraction: 1,
  restPpFraction: 1,
  gymClearHealFraction: 1,
  restClearsStatus: true,
  clearStatusBetweenNodes: true,
  reviveFaintedBetweenNodes: true,
  reviveHpPercent: 0.5,

  backpackCapacity: PARTY_SIZE + 2,

  starterOptionCount: 3,

  revealOpponentAbility: true,
  revealOpponentItem: true,
};

/** A tuning derived from the default. Stage 2's sweep builds variants this way. */
export function withTuning(overrides: Partial<Tuning>): Tuning {
  return { ...DEFAULT_TUNING, ...overrides };
}

/**
 * The tier weights that apply to a segment.
 *
 * Falls back to the last row rather than throwing, so a `SEGMENT_COUNT` raised
 * without a matching band row keeps generating instead of crashing a run.
 */
export function tierWeightsFor(tuning: Tuning, segment: number): Record<Tier, number> {
  const row =
    tuning.tierBands.find((band) => segment <= band.throughSegment) ??
    tuning.tierBands[tuning.tierBands.length - 1];
  if (!row) throw new RangeError('Tuning has no tier bands');
  return row.weights;
}
