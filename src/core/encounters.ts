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
 *      node kinds, then the rest-availability fix-up.
 *   2. `randomizer` stream: encounter contents — species, level, ability and
 *      moves — for every node in index order, including options the player will
 *      never take.
 *   3. `battle` stream: one sim seed per battle node, in the same index order.
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
 */
import {
  generateGymTeam,
  generateStarters,
  generateTrainerTeam,
  generateWildTeam,
} from './randomizer';
import type { Rng, RngStream, SimSeed } from './rng';
import type { PokemonSpec, TeamSpec, Tier } from './types';
import { gymForSegment, type GymDefinition } from '../data/gyms';
import { starterLevel } from '../data/scaling';
import type { NodeKind, Range, Tuning } from '../data/tuning';

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
   * Difficulty tier. Stage 2 writes `normal` everywhere and never shows it.
   * Stage 3 exposes it to the player and keys reward pools to it.
   */
  tier: Tier;
  /** What the map shows. Deliberately says the kind and not the contents. */
  label: string;
  /** Null for nodes that are not a fight. */
  encounter: EncounterSpec | null;
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

const CHOOSABLE_KINDS: readonly Exclude<NodeKind, 'gym'>[] = ['wild', 'trainer', 'rest'];

/**
 * Weighted sample without replacement.
 *
 * Without replacement because a step offering "wild or wild" is not a choice —
 * the contents are hidden on the map, so two nodes of the same kind read as one
 * option printed twice. `tuning.distinctKindsPerStep` turns it off, and the
 * count is capped at the number of kinds available so the rule cannot fail
 * silently on an early step where rest is not yet allowed.
 */
function sampleKinds(
  stream: RngStream,
  allowed: readonly Exclude<NodeKind, 'gym'>[],
  weights: Record<Exclude<NodeKind, 'gym'>, number>,
  count: number,
  distinct: boolean,
): Exclude<NodeKind, 'gym'>[] {
  const picked: Exclude<NodeKind, 'gym'>[] = [];
  let pool = [...allowed];

  for (let i = 0; i < count; i++) {
    if (pool.length === 0) break;
    const total = pool.reduce((sum, kind) => sum + Math.max(0, weights[kind]), 0);
    if (total <= 0) break;
    let roll = stream.nextFloat() * total;
    // Falls back to the last entry only for floating-point residue at the very
    // top of the range, never as an unweighted default.
    let chosen = pool[pool.length - 1];
    for (const kind of pool) {
      roll -= Math.max(0, weights[kind]);
      if (roll < 0) {
        chosen = kind;
        break;
      }
    }
    if (!chosen) break;
    picked.push(chosen);
    if (distinct) pool = pool.filter((kind) => kind !== chosen);
  }
  return picked;
}

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
  const shape: Exclude<NodeKind, 'gym'>[][] = [];

  for (let step = 0; step < stepCount; step++) {
    const allowed = CHOOSABLE_KINDS.filter((kind) => kind !== 'rest' || step >= tuning.restEarliestStep);
    const wanted = drawRange(rng.map, tuning.nodeChoiceCount);
    const count = tuning.distinctKindsPerStep ? Math.min(wanted, allowed.length) : wanted;
    shape.push(sampleKinds(rng.map, allowed, tuning.nodeWeights, count, tuning.distinctKindsPerStep));
  }

  ensureRests(shape, rng.map, tuning);

  // --- pass 2: contents, from the `randomizer` stream ---------------------
  const steps: Step[] = shape.map((kinds, step) => ({
    index: step,
    options: kinds.map((kind, option) => buildNode(`s${index}-${step}-${option}`, kind, index, rng)),
  }));

  const gym: NodeSpec = {
    id: `s${index}-gym`,
    kind: 'gym',
    tier: 'normal',
    label: `${gymDef.leader}'s Gym`,
    encounter: {
      team: generateGymTeam(gymDef, index, rng),
      opponent: `${gymDef.leader} (${gymDef.type})`,
      // Filled by pass 3.
      simSeed: PLACEHOLDER_SEED,
    },
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
  shape: Exclude<NodeKind, 'gym'>[][],
  stream: RngStream,
  tuning: Tuning,
): void {
  const hasRest = (kinds: readonly Exclude<NodeKind, 'gym'>[]): boolean => kinds.includes('rest');
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
  kind: Exclude<NodeKind, 'gym'>,
  segment: number,
  rng: Rng,
): NodeSpec {
  if (kind === 'rest') {
    return { id, kind, tier: 'normal', label: 'Rest site', encounter: null };
  }

  const tier: Tier = 'normal';
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
  };
}

/** What the log and the summary call this opponent. */
function describeOpponent(kind: Exclude<NodeKind, 'gym'>, team: TeamSpec, lead: PokemonSpec): string {
  if (kind === 'wild') return `Wild ${lead.species}`;
  return team.length === 1 ? `Trainer's ${lead.species}` : `Trainer (${team.length})`;
}
