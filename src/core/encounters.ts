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
 *   2. `map` stream: encounter contents — species and level — for every node in
 *      index order, including options the player will never take.
 *   3. `battle` stream: one sim seed per battle node, in the same index order.
 *
 * Pass 3 is separate so that changing what a node *contains* cannot shift the
 * damage rolls of a node earlier in the map. Pass 1 is separate from pass 2 so
 * that the rest fix-up, which rewrites a node's kind, happens before anything
 * has been drawn for that node's contents.
 */
import { gymForSegment } from '../data/gyms';
import { TRAINER_POOL, WILD_POOL, toSpec, type MonEntry } from '../data/mons';
import { getStarterPool } from '../data/starters';
import type { NodeKind, NodeTier, Range, Tuning } from '../data/tuning';
import type { Rng, RngStream, SimSeed } from './rng';
import type { PokemonSpec, TeamSpec } from './types';

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
   * Difficulty tier. Stage 1 writes `normal` everywhere and never shows it.
   * Stage 3 populates it and keys reward pools to it.
   */
  tier: NodeTier;
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
// Levels
// ---------------------------------------------------------------------------

/** The level band a segment fights at. Stage 1 always passes index 0. */
export function segmentBaseLevel(index: number, tuning: Tuning): number {
  return tuning.starterLevel + index * tuning.levelPerSegment;
}

function encounterLevel(kind: NodeKind, segment: number, stream: RngStream, tuning: Tuning): number {
  return Math.max(1, segmentBaseLevel(segment, tuning) + drawRange(stream, tuning.levelOffset[kind]));
}

// ---------------------------------------------------------------------------
// Starters
// ---------------------------------------------------------------------------

/**
 * The species the starter screen offers.
 *
 * Drawn from the `map` stream and drawn *first*, before the map itself, so that
 * adding a starter to the pool does not reshape a recorded seed's map. Distinct
 * entries: three buttons showing the same Pokemon is not a choice.
 */
export function generateStarterOptions(rng: Rng, tuning: Tuning, unlocked?: readonly string[]): PokemonSpec[] {
  const pool = [...getStarterPool(unlocked)];
  const count = Math.min(tuning.starterOptionCount, pool.length);
  const picked: PokemonSpec[] = [];

  for (let i = 0; i < count; i++) {
    const index = rng.map.nextInt(pool.length);
    const [entry] = pool.splice(index, 1);
    if (entry) picked.push(toSpec(entry, tuning.starterLevel));
  }
  return picked;
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

/**
 * Generate one segment.
 *
 * Takes `index` and uses it — for the level band and for the gym lookup — even
 * though Stage 1 only ever passes 0. A `generateTheSegment()` that closed over
 * a constant would be a function Stage 2 has to rewrite rather than call in a
 * loop, which is the mistake this signature exists to prevent.
 */
export function generateSegment(index: number, rng: Rng, tuning: Tuning): Segment {
  const gymDef = gymForSegment(index);

  // --- pass 1: shape ------------------------------------------------------
  const stepCount = drawRange(rng.map, tuning.stepsPerSegment);
  const shape: Exclude<NodeKind, 'gym'>[][] = [];

  for (let step = 0; step < stepCount; step++) {
    const allowed = CHOOSABLE_KINDS.filter((kind) => kind !== 'rest' || step >= tuning.restEarliestStep);
    const wanted = drawRange(rng.map, tuning.nodeChoiceCount);
    const count = tuning.distinctKindsPerStep ? Math.min(wanted, allowed.length) : wanted;
    shape.push(sampleKinds(rng.map, allowed, tuning.nodeWeights, count, tuning.distinctKindsPerStep));
  }

  ensureRests(shape, rng.map, tuning);

  // --- pass 2: contents ---------------------------------------------------
  const steps: Step[] = shape.map((kinds, step) => ({
    index: step,
    options: kinds.map((kind, option) =>
      buildNode(`s${index}-${step}-${option}`, kind, index, rng.map, tuning),
    ),
  }));

  const gym: NodeSpec = {
    id: `s${index}-gym`,
    kind: 'gym',
    tier: 'normal',
    label: `${gymDef.leader}'s Gym`,
    encounter: {
      team: gymDef.team.map((entry: MonEntry) =>
        toSpec(entry, encounterLevel('gym', index, rng.map, tuning)),
      ),
      opponent: `${gymDef.leader} (${gymDef.type})`,
      // Filled by pass 3.
      simSeed: PLACEHOLDER_SEED,
    },
  };

  const segment: Segment = { index, leader: gymDef.leader, type: gymDef.type, steps, gym };

  // --- pass 3: sim seeds --------------------------------------------------
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

function buildNode(
  id: string,
  kind: Exclude<NodeKind, 'gym'>,
  segment: number,
  stream: RngStream,
  tuning: Tuning,
): NodeSpec {
  if (kind === 'rest') {
    return { id, kind, tier: 'normal', label: 'Rest site', encounter: null };
  }

  const pool = kind === 'wild' ? WILD_POOL : TRAINER_POOL;
  const entry = stream.pick(pool);
  const level = encounterLevel(kind, segment, stream, tuning);

  return {
    id,
    kind,
    tier: 'normal',
    label: kind === 'wild' ? 'Wild encounter' : 'Trainer battle',
    encounter: {
      team: [toSpec(entry, level)],
      opponent: kind === 'wild' ? `Wild ${entry.species}` : entry.species,
      simSeed: PLACEHOLDER_SEED,
    },
  };
}
