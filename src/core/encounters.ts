/**
 * Map generation.
 *
 * One rule dominates this file: **the whole map is generated in one pass at run
 * creation, before the player has made a single decision.** Not lazily, not at
 * node entry. Lazy draws make the roll order a function of player behaviour,
 * and the moment Stage 3 inserts a reward draw between two nodes, every seed
 * recorded before that change replays as a different map. Generating eagerly
 * costs a few hundred microseconds and buys seed compatibility that survives
 * three more stages.
 *
 * The passes, in order, are the contract. Reordering them changes what every
 * recorded seed produces, so they are written down in docs/generation.md as
 * well as here:
 *
 *   1. `map` stream: segment length, then per step the option count and the
 *      node kinds, then the rest-availability fix-up, then per step the tiers
 *      of that step's battle nodes.
 *   2. `randomizer` stream: encounter contents — species, level, ability and
 *      moves — for every node in index order, including options the player will
 *      never take.
 *   3. `battle` stream: one sim seed per battle node, in the same index order.
 *   4. `rewards` stream: per node in index order — the three-card offer for a
 *      node with a tier, the stock for a shop, the resolved outcomes for an
 *      event. One sweep, so all three share one draw order.
 *   5. `rewards` stream again: one roll per wild node, in index order, for
 *      whether it offers its species. Always exactly one roll per wild node,
 *      whether or not the offer appears — a check that only rolled when it
 *      might succeed would make the draw count depend on the tier table.
 *
 * Stage 3 added the tier draw, and its position inside pass 1 is the contract:
 * *after* the rest fix-up, because the fix-up rewrites node kinds and a tier
 * drawn for a node that then became a rest would be a draw stranded in the
 * middle of the sequence. Tier belongs to `map` and not to `randomizer` because
 * it is part of the shape of the choice the player is offered — the map screen
 * shows it before anything about the encounter is known — and because the
 * randomizer must stay free to add draws without moving it.
 *
 * Pass 2 moved from the `map` stream to the `randomizer` stream in Stage 2, and
 * that is the change the whole stage rests on. A randomizer adds draws
 * constantly — a fourth move slot, a tier modifier, a bigger gym team — and
 * every one of them would otherwise have shifted the *shape* of every map
 * generated after it. Now the shape is fixed by `map` and the contents by
 * `randomizer`, and neither can move the other.
 *
 * Pass 3 is separate again so that changing what a node *contains* cannot shift
 * the damage rolls of a node earlier in the map.
 *
 * Pass 4 is Stage 3's, and it is at map generation for the reason the whole
 * document exists. Drawing an offer when the node is *completed* would make the
 * roll depend on how the battle went — how many turns it ran, how many damage
 * rolls the sim consumed — and the reward a seed pays out would quietly become
 * a function of play.
 *
 * Pass 5 is Stage 4's: one roll per wild node for whether it offers the species
 * it just fielded. Same rule as pass 4 and the same stream, and a *separate
 * sweep* rather than a branch inside it — because appending is the only edit to
 * this list that cannot move what came before it. Folding the roll into pass 4
 * would produce identical output today and couple the two draw orders forever,
 * so the next change to reward offers would silently reshuffle every
 * acquisition in every recorded seed.
 *
 * Each new pass goes on the end for exactly that reason. That is the whole
 * discipline: the list only ever grows downward.
 */
import {
  generateGymTeam,
  generateStarters,
  generateTrainerTeam,
  generateWildTeam,
} from './randomizer';
import { generateEncounterAcquisition, type AcquisitionOffer } from './acquisition';
import { generateShopStock, type ShopStock } from './economy';
import { generateEvent, type EventInstance } from './events';
import { generateRewardOffer, type RewardOffer } from './rewards';
import type { Rng, RngStream, SimSeed } from './rng';
import type { PokemonSpec, TeamSpec, Tier } from './types';
import { gymForSegment, type GymDefinition } from '../data/gyms';
import { starterLevel } from '../data/scaling';
import { tierWeightsFor, type ChoosableKind, type NodeKind, type Range, type Tuning } from '../data/tuning';

/** What a battle node fights. Generated eagerly; see the header. */
export interface EncounterSpec {
  team: TeamSpec;
  /** Shown once the encounter starts, not on the map. */
  opponent: string;
  /**
   * The sim PRNG seed for this battle.
   *
   * Drawn at generation rather than at battle start, because `createBattle`
   * derives its own seed from the *run* seed and would therefore hand every
   * battle in a run the identical PRNG — the same crits, on the same turns,
   * eight nodes running.
   */
  simSeed: SimSeed;
}

export interface NodeSpec {
  /** Stable within a run: `s<segment>-<step>-<option>`, or `s<segment>-gym`. */
  id: string;
  kind: NodeKind;
  /**
   * Difficulty tier, or **null for a node that does not have one**.
   *
   * Rest nodes and gyms are null, and that is a type decision rather than a
   * data one. Stage 2 wrote `normal` on every node including those, which was
   * harmless while nothing read the field and stops being harmless the moment
   * Stage 3 keys a reward pool off it: `REWARD_POOLS[node.tier]` would then
   * compile perfectly and quietly hand a rest node a normal-tier reward. Modelling
   * "no tier" as absent rather than as a value makes that a type error at the
   * call site instead of a bug on the reward screen.
   *
   * A gym is null for the second reason `generateGymTeam` takes no tier: a gym
   * is the segment's difficulty statement, and a second dial on the same number
   * is a dial the balance report cannot attribute.
   */
  tier: Tier | null;
  /** What the map shows. Deliberately says the kind and not the contents. */
  label: string;
  /** Null for nodes that are not a fight. */
  encounter: EncounterSpec | null;
  /**
   * The three cards this node pays out, drawn at map generation.
   *
   * Null wherever `tier` is null, and for the same reason: a reward pool is
   * keyed by tier, so a node without one has nothing to draw from. Gyms
   * therefore pay no cards — a cleared gym already pays the segment heal and
   * the level, which is a larger reward than any card in any pool.
   *
   * Present on the node rather than held in run state because it is part of
   * what the seed fixed. The player is shown it only after winning; see
   * `playRun`.
   */
  reward: RewardOffer | null;
  /** The shelf, for a shop node. Null for everything else. */
  shop: ShopStock | null;
  /**
   * The prompt and its already-resolved outcomes, for an event node.
   *
   * Resolved at map generation, which is the point: an event that reads
   * "might be a trap" has already flipped its coin, so reloading a save cannot
   * reroll it and two players on the same seed making the same choice get the
   * same result.
   */
  event: EventInstance | null;
  /**
   * The Pokemon this node offers if the player wins, or null.
   *
   * Wild nodes only, and drawn at map generation like every other offer — see
   * `core/acquisition.ts`. **Whether it appears cannot depend on how the battle
   * went, only on whether it was won.** A rate check rolled at node completion
   * would make the number of `rewards` draws a function of play, and every seed
   * recorded before a change to battle length would replay with a different set
   * of acquisitions.
   */
  acquisition: AcquisitionOffer | null;
}

export interface Step {
  index: number;
  options: NodeSpec[];
}

export interface Segment {
  index: number;
  /** The gym that caps this segment, for display. */
  leader: string;
  type: string;
  /** The full leader record, so a screen can show the blurb without a lookup. */
  gymDefinition: GymDefinition;
  steps: Step[];
  /** Not an option: reaching the end of the steps means fighting this. */
  gym: NodeSpec;
}

/** Every node in a segment, in the order generation visited them. */
export function nodesOf(segment: Segment): NodeSpec[] {
  return [...segment.steps.flatMap((step) => step.options), segment.gym];
}

// ---------------------------------------------------------------------------
// Draws
// ---------------------------------------------------------------------------

/** Uniform inclusive integer from a range. */
function drawRange(stream: RngStream, range: Range): number {
  const span = range.max - range.min;
  if (span < 0) throw new RangeError(`Invalid range ${range.min}..${range.max}`);
  return range.min + stream.nextInt(span + 1);
}

/**
 * The kinds a step may offer, in a fixed sample order.
 *
 * The order is a draw order — `sampleWeighted` walks it — so appending is safe
 * and reordering reshuffles every recorded map. Stage 3's `shop` and `event`
 * are therefore appended rather than slotted in next to `rest` where they
 * would read more naturally.
 */
const CHOOSABLE_KINDS: readonly ChoosableKind[] = ['wild', 'trainer', 'rest', 'shop', 'event'];

/** Node kinds that are a fight, and therefore the only ones that carry a tier. */
const BATTLE_KINDS: readonly ChoosableKind[] = ['wild', 'trainer'];

/**
 * Weighted sample, optionally without replacement. One draw per item picked.
 *
 * Two callers, and both want the "without replacement" half for the same
 * reason. A step offering "wild or wild" is not a choice — the contents are
 * hidden on the map, so two nodes of the same kind read as one option printed
 * twice — and a step offering "hard or hard" is not a choice either, because
 * the tier is the whole of what the player can see about the trade. Stage 3
 * generalised the Stage 2 kind sampler rather than writing the same loop a
 * second time, because two copies of a weighted draw are two draw orders to
 * keep in agreement forever.
 *
 * `count` is capped by the caller at the number of items available, so the rule
 * cannot fail silently on an early step where rest is not yet allowed.
 *
 * The draw order is unchanged from Stage 2's `sampleKinds`: same loop, same one
 * `nextFloat` per pick, same tie-breaking. That is deliberate — a refactor here
 * that consumed a different number of draws would have reshuffled every
 * recorded map on a stage that has quite enough of that already.
 */
function sampleWeighted<T>(
  stream: RngStream,
  allowed: readonly T[],
  weightOf: (item: T) => number,
  count: number,
  distinct: boolean,
): T[] {
  const picked: T[] = [];
  let pool = [...allowed];

  for (let i = 0; i < count; i++) {
    if (pool.length === 0) break;
    const total = pool.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0);
    if (total <= 0) break;
    let roll = stream.nextFloat() * total;
    // Falls back to the last entry *with weight* only for floating-point
    // residue at the very top of the range, never as an unweighted default.
    // Reading `pool[pool.length - 1]` unconditionally, as Stage 2 did, was safe
    // only because no kind had weight zero; a zero-weight tier is exactly what
    // `tierBands` uses to keep elite out of the opening segments.
    let chosen = pool.filter((item) => weightOf(item) > 0).at(-1);
    for (const item of pool) {
      roll -= Math.max(0, weightOf(item));
      if (roll < 0) {
        chosen = item;
        break;
      }
    }
    if (chosen === undefined) break;
    const picked_ = chosen;
    picked.push(picked_);
    if (distinct) pool = pool.filter((item) => item !== picked_);
  }
  return picked;
}

/** The tiers a battle node may carry, in a fixed draw order. */
const TIERS: readonly Tier[] = ['normal', 'hard', 'elite'];

// ---------------------------------------------------------------------------
// Starters
// ---------------------------------------------------------------------------

/**
 * The Pokemon the starter screen offers.
 *
 * Drawn from the `randomizer` stream and drawn *first*, before the map, so that
 * widening the starter pool does not reshape a recorded seed's map. Species,
 * ability and moveset are all rolled — the player's Pokemon is randomized like
 * everything else, which is the difference between a randomizer and a game
 * about reacting to one.
 */
export function generateStarterOptions(rng: Rng, tuning: Tuning, unlocked?: readonly string[]): PokemonSpec[] {
  return generateStarters(tuning.starterOptionCount, starterLevel(), rng, unlocked);
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

/**
 * Generate one segment.
 *
 * Stage 1 called this once with `index: 0`; Stage 2 calls it eight times, and
 * the signature did not change. That was the whole reason it took an index it
 * did not yet need.
 */
export function generateSegment(index: number, rng: Rng, tuning: Tuning): Segment {
  const gymDef = gymForSegment(index);

  // --- pass 1: shape, from the `map` stream -------------------------------
  const stepCount = drawRange(rng.map, tuning.stepsPerSegment);
  const shape: ChoosableKind[][] = [];

  for (let step = 0; step < stepCount; step++) {
    const allowed = CHOOSABLE_KINDS.filter((kind) => kind !== 'rest' || step >= tuning.restEarliestStep);
    const wanted = drawRange(rng.map, tuning.nodeChoiceCount);
    const count = tuning.distinctKindsPerStep ? Math.min(wanted, allowed.length) : wanted;
    shape.push(
      sampleWeighted(rng.map, allowed, (kind) => tuning.nodeWeights[kind], count, tuning.distinctKindsPerStep),
    );
  }

  ensureRests(shape, rng.map, tuning);

  // Tiers, still pass 1 and still the `map` stream, but only once the kinds are
  // final. See the header: the rest fix-up rewrites kinds, so a tier drawn
  // before it could belong to a node that is no longer a fight.
  const tiers = shape.map((kinds) => assignTiers(kinds, index, rng.map, tuning));

  // --- pass 2: contents, from the `randomizer` stream ---------------------
  const steps: Step[] = shape.map((kinds, step) => ({
    index: step,
    options: kinds.map((kind, option) =>
      buildNode(`s${index}-${step}-${option}`, kind, tiers[step]?.[option] ?? null, index, rng),
    ),
  }));

  const gym: NodeSpec = {
    id: `s${index}-gym`,
    kind: 'gym',
    tier: null,
    label: `${gymDef.leader}'s Gym`,
    encounter: {
      team: generateGymTeam(gymDef, index, rng),
      opponent: `${gymDef.leader} (${gymDef.type})`,
      // Filled by pass 3.
      simSeed: PLACEHOLDER_SEED,
    },
    reward: null,
    shop: null,
    event: null,
    acquisition: null,
  };

  const segment: Segment = {
    index,
    leader: gymDef.leader,
    type: gymDef.type,
    gymDefinition: gymDef,
    steps,
    gym,
  };

  // --- pass 3: sim seeds, from the `battle` stream -------------------------
  for (const node of nodesOf(segment)) {
    if (node.encounter) node.encounter.simSeed = rng.battle.nextSimSeed();
  }

  // --- pass 4: reward offers, from the `rewards` stream --------------------
  // A separate loop rather than a branch inside pass 3, so that the two streams
  // are consumed in two independent index-ordered sweeps. Interleaving them
  // would be identical today and would couple their draw orders forever.
  for (const node of nodesOf(segment)) {
    if (node.tier) node.reward = generateRewardOffer(node.id, node.tier, index, rng, tuning);
    else if (node.kind === 'shop') node.shop = generateShopStock(node.id, index, rng, tuning);
    else if (node.kind === 'event') node.event = generateEvent(node.id, rng, tuning);
  }

  // --- pass 5: encounter acquisitions, also from the `rewards` stream -------
  /*
   * A fifth sweep rather than a branch inside pass 4, and appended rather than
   * interleaved, for the reason the whole contract exists: appending a pass
   * cannot move the four that came before it. Folding the roll into pass 4
   * would be identical output today and would couple the two draw orders
   * forever — the next change to reward offers would silently reshuffle every
   * acquisition in every recorded seed.
   *
   * Wild nodes only: a trainer does not hand over their Pokemon, and a gym
   * leader certainly does not.
   */
  for (const node of nodesOf(segment)) {
    const lead = node.encounter?.team[0];
    if (node.kind !== 'wild' || !node.tier || !lead) continue;
    node.acquisition = generateEncounterAcquisition(node.id, lead, node.tier, index, rng.rewards);
  }
  return segment;
}

/** Overwritten in pass 3; never reaches a battle. */
const PLACEHOLDER_SEED: SimSeed = `sodium,${'0'.repeat(64)}`;

/**
 * Guarantee the segment offers somewhere to heal.
 *
 * Weighted draws can produce a segment with no rest in it at all, and eight
 * fights with no way to spend a turn recovering is not a hard run, it is a run
 * whose seed decided the outcome. This converts the last option of a
 * deterministically chosen eligible step, which is why it runs in pass 1:
 * nothing has been drawn for those nodes' contents yet.
 */
function ensureRests(
  shape: ChoosableKind[][],
  stream: RngStream,
  tuning: Tuning,
): void {
  const hasRest = (kinds: readonly ChoosableKind[]): boolean => kinds.includes('rest');
  let short = tuning.minRestSteps - shape.filter(hasRest).length;

  while (short > 0) {
    const eligible = shape
      .map((kinds, step) => ({ kinds, step }))
      .filter(({ kinds, step }) => step >= tuning.restEarliestStep && !hasRest(kinds) && kinds.length > 0);
    if (eligible.length === 0) return;
    const target = eligible[stream.nextInt(eligible.length)];
    if (!target) return;
    target.kinds[target.kinds.length - 1] = 'rest';
    short--;
  }
}

/**
 * The tiers for one step's options, aligned to the step's kind list.
 *
 * `null` at an index whose kind is a rest, a tier at every index that is a
 * fight. The alignment is what lets `buildNode` take its tier by position
 * rather than by a second lookup.
 *
 * **The draw count depends only on how many fights the step has, never on what
 * was drawn.** That is the property the whole eager-generation contract rests
 * on: a weighted re-roll loop here would make a segment's later map draws
 * depend on its earlier ones, which is a dependency nobody can reason about
 * and every recorded seed would rest on.
 *
 * Without replacement by default, so a step's two fights are two different
 * trades rather than the same trade offered twice. See
 * `tuning.distinctTiersPerStep` for why that is the rule and not the option.
 */
function assignTiers(
  kinds: readonly ChoosableKind[],
  segment: number,
  stream: RngStream,
  tuning: Tuning,
): (Tier | null)[] {
  const battleSlots = kinds.filter((kind) => BATTLE_KINDS.includes(kind)).length;
  if (battleSlots === 0) return kinds.map(() => null);

  const weights = tierWeightsFor(tuning, segment);
  const available = TIERS.filter((tier) => weights[tier] > 0);
  const wanted = tuning.distinctTiersPerStep ? Math.min(battleSlots, available.length) : battleSlots;
  const drawn = sampleWeighted(stream, available, (tier) => weights[tier], wanted, tuning.distinctTiersPerStep);

  /*
   * A step with more fights than the band has distinct tiers.
   *
   * Unreachable at the shipped tuning — `distinctKindsPerStep` caps a step at
   * one wild and one trainer, so two fights at most against three tiers — but
   * only unreachable *because of another knob*, which is not a guarantee. The
   * fallback repeats the softest tier drawn rather than dropping a node or
   * throwing: a map that refuses to generate because two dials disagree is a
   * far worse failure than a step that briefly offers the same trade twice.
   */
  const fallback = drawn[drawn.length - 1] ?? 'normal';

  let next = 0;
  return kinds.map((kind) => (BATTLE_KINDS.includes(kind) ? (drawn[next++] ?? fallback) : null));
}

/**
 * One node's contents.
 *
 * The kind decides which randomizer entry point is called and nothing else.
 * Note that a wild node asks for a *team* rather than a Pokemon: at the shipped
 * curve that team has one member, and writing `[generateWildMon(...)]` here
 * would be the single-mon assumption written down one more time in the one file
 * whose job is to not do that.
 */
function buildNode(
  id: string,
  kind: ChoosableKind,
  tier: Tier | null,
  segment: number,
  rng: Rng,
): NodeSpec {
  if (kind === 'rest' || kind === 'shop' || kind === 'event') {
    // Contents for these are pass 4's job: a shop's shelf and an event's
    // outcomes both come off the `rewards` stream, and drawing them here would
    // interleave that stream with the `randomizer` draws around it.
    return {
      id,
      kind,
      tier: null,
      label: NON_BATTLE_LABELS[kind],
      encounter: null,
      reward: null,
      shop: null,
      event: null,
      acquisition: null,
    };
  }
  if (!tier) throw new Error(`Battle node ${id} was generated without a tier`);

  const team = kind === 'wild' ? generateWildTeam(segment, tier, rng) : generateTrainerTeam(segment, tier, rng);
  const lead = team[0];
  if (!lead) throw new Error(`Generated an empty ${kind} team at segment ${segment}`);

  return {
    id,
    kind,
    tier,
    label: kind === 'wild' ? 'Wild encounter' : 'Trainer battle',
    encounter: {
      team,
      opponent: describeOpponent(kind, team, lead),
      simSeed: PLACEHOLDER_SEED,
    },
    // Filled by pass 4.
    reward: null,
    shop: null,
    event: null,
    acquisition: null,
  };
}

/** What the map calls a node that is not a fight. */
const NON_BATTLE_LABELS: Record<'rest' | 'shop' | 'event', string> = {
  rest: 'Rest site',
  shop: 'Shop',
  event: 'Something happens',
};

/** What the log and the summary call this opponent. */
function describeOpponent(kind: ChoosableKind, team: TeamSpec, lead: PokemonSpec): string {
  if (kind === 'wild') return `Wild ${lead.species}`;
  return team.length === 1 ? `Trainer's ${lead.species}` : `Trainer (${team.length})`;
}
