/**
 * The difficulty curve: eight rows, one per segment, and nothing else.
 *
 * This is the file a balance pass edits. If tuning the game ever requires
 * editing `core/randomizer.ts`, the split between them is wrong — the
 * randomizer is *how* a Pokemon is rolled and this table is *what it is rolled
 * from*, and the simulator only produces useful numbers if the second can move
 * without the first.
 *
 * Three things live here that used to be elsewhere or nowhere:
 *
 *   - **Levels.** Stage 1 kept `starterLevel` and `levelPerSegment` in
 *     data/tuning.ts as two numbers and a multiplication. A multiplication is a
 *     straight line, and a straight line is the one difficulty curve you cannot
 *     bend at segment 5 when the report says segment 5 is a cliff. It is a
 *     table now.
 *   - **Band windows.** Which species and which move powers a segment may draw.
 *     This is the real difficulty lever, more than levels are: Stage 1 measured
 *     that at level 30 a fully evolved Pokemon's best move one-shots another
 *     one, so the level gap mostly decides *who* one-shots. Capping base power
 *     early is what buys a fight that lasts more than a turn.
 *   - **Team sizes**, as a function of PARTY_SIZE. See below.
 */
import type { PokemonSpec, TeamSpec, Tier } from '../core/types';
import { DAMAGING_MOVES } from './movePools';
import { SPECIES_POOL } from './speciesPools';
import { PARTY_SIZE } from './partyTuning';
import type { BattleKind, Range } from './tuning';

/*
 * `PARTY_SIZE` used to be declared here and now lives in `data/partyTuning.ts`,
 * next to the join level and the revive rules. Stage 4 made it a balance
 * question rather than a structural constant — how much a faint costs, how far
 * below the curve an acquisition arrives, and how many slots there are are one
 * question asked three ways — and this file is still the only place that turns
 * it into opponent team sizes.
 */

/** The sim's hard ceiling on a side. Team sizes are clamped to it. */
const MAX_TEAM_SIZE = 6;

/** How many segments a run is. Eight gyms, eight segments. */
export const SEGMENT_COUNT = 8;

export interface SegmentScaling {
  /** Which segment this row describes, for readability at the call site. */
  segment: number;
  /**
   * The level the player's whole party sits at for this segment.
   *
   * There is no XP system and no grinding (design rule 2). Encounters chosen
   * within a segment affect *what you get*, not *how strong you are*, so the
   * player's level is a pure function of progress and this column is it.
   * That is a decision, not a constraint: it is one table away from being
   * something else if playtesting disagrees.
   */
  playerLevel: number;
  /** Opponent level relative to `playerLevel`, drawn per encounter. */
  levelOffset: Record<BattleKind, Range>;
  /** Species bands (data/speciesPools.ts) this segment may draw from. */
  speciesBands: readonly number[];
  /** Damaging-move bands (data/movePools.ts) this segment may draw from. */
  moveBands: readonly number[];
  /**
   * Extra Pokemon the opponent fields *beyond the player's party size*.
   *
   * **At ordinary nodes this is zero everywhere, and team size comes from the
   * tier instead.** Stage 3's first tuning pass is the reason. Segments 5-7 had
   * `trainer: 1`, which stacked with `elite`'s own `team: 1` to produce a
   * *three*-Pokemon ordinary node — a gym-sized fight with an ordinary node's
   * reward. Per-segment survival collapsed to 62% there and nowhere else, which
   * is as clean a signal as the simulator has ever produced.
   *
   * The rule it settled into is worth keeping: the segment sets level and stat
   * quality, the tier sets team size, and only a gym breaks both at once. That
   * also makes an `elite` node legible — it is *the* two-Pokemon fight, at every
   * point in the run.
   *
   * The number that matters is the difference, not the count. A gym with six
   * Pokemon against a solo player is not a difficulty curve, it is a wall; the
   * same gym against a party of six is an even fight. So the table stores the
   * advantage and `opponentTeamSize` adds `PARTY_SIZE`, which means Stage 4
   * raising the party keeps the *shape* of the curve rather than trivialising
   * the back half of the run.
   */
  teamAdvantage: Record<BattleKind, number>;
}

/**
 * The curve. Every number here is the output of `npm run sim`, not of taste.
 *
 * The starting hypothesis was the right shape and the wrong numbers, which is
 * what the simulator is for. What it measured, in the order the report found it:
 *
 * **Team size is the dominant lever at PARTY_SIZE 1, and it has to be paid
 * for.** Gyms 1-3 at one or two Pokemon and 6-8 at three was the guess. It is
 * still the shape below — but the first cut kept the gym's level offset flat
 * across that step, and the clear rate fell 42 points at gym 3 and to zero at
 * gym 6. A solo Pokemon beating three at its own level is not a difficulty
 * curve. So each step up in team size is paid for with a step down in level:
 * one Pokemon at the player's level, two around nine levels below, three around
 * sixteen to twenty-one below. That turns team size into *texture* — more
 * matchups, more PP spent, more turns — instead of a multiplier.
 *
 * **Offsets have to grow with level.** A flat -8 is 27% of the level at segment
 * 1 and 11% of it at segment 8, so a flat curve gets harder for a reason nobody
 * chose. Every offset column below widens as the run goes on, and that single
 * change moved the per-fight death rate from 9% to 4%.
 *
 * **Move bands matter more than levels.** Stage 1 found that a fully evolved
 * Pokemon's best move one-shots another one, so a level gap only decides who
 * does the one-shotting. Capping opponent base power early is what buys a fight
 * that lasts more than a turn; the shipped bands keep segments 1-2 under 55 BP
 * and only let band 3 — the 100+ BP moves — into the last two segments, where
 * the level gap is wide enough to absorb them.
 *
 * The two changes that were *not* in this table and mattered most are recorded
 * where they live: `STARTER_MOVE_BANDS` in data/starters.ts and
 * `gymClearHealFraction` in data/tuning.ts. docs/balance.md has the report.
 */
export const SEGMENTS: readonly SegmentScaling[] = [
  {
    segment: 0,
    playerLevel: 30,
    levelOffset: { wild: { min: -8, max: -6 }, trainer: { min: -7, max: -5 }, gym: { min: -1, max: 0 } },
    speciesBands: [0, 1],
    moveBands: [0],
    teamAdvantage: { wild: 0, trainer: 0, gym: 0 },
  },
  {
    segment: 1,
    playerLevel: 36,
    levelOffset: { wild: { min: -10, max: -7 }, trainer: { min: -8, max: -6 }, gym: { min: -2, max: -1 } },
    speciesBands: [0, 1, 2],
    moveBands: [0],
    teamAdvantage: { wild: 0, trainer: 0, gym: 0 },
  },
  {
    segment: 2,
    playerLevel: 42,
    levelOffset: { wild: { min: -15, max: -12 }, trainer: { min: -13, max: -10 }, gym: { min: -9, max: -7 } },
    speciesBands: [1, 2],
    moveBands: [0, 1],
    teamAdvantage: { wild: 0, trainer: 0, gym: 1 },
  },
  {
    segment: 3,
    playerLevel: 48,
    levelOffset: { wild: { min: -17, max: -13 }, trainer: { min: -14, max: -11 }, gym: { min: -10, max: -8 } },
    speciesBands: [1, 2],
    moveBands: [0, 1],
    teamAdvantage: { wild: 0, trainer: 0, gym: 1 },
  },
  {
    segment: 4,
    playerLevel: 54,
    levelOffset: { wild: { min: -18, max: -14 }, trainer: { min: -16, max: -12 }, gym: { min: -16, max: -13 } },
    speciesBands: [2, 3],
    moveBands: [1, 2],
    teamAdvantage: { wild: 0, trainer: 0, gym: 1 },
  },
  {
    segment: 5,
    playerLevel: 60,
    levelOffset: { wild: { min: -20, max: -15 }, trainer: { min: -17, max: -13 }, gym: { min: -20, max: -16 } },
    speciesBands: [2, 3],
    moveBands: [1, 2],
    teamAdvantage: { wild: 0, trainer: 0, gym: 2 },
  },
  {
    segment: 6,
    playerLevel: 66,
    levelOffset: { wild: { min: -22, max: -17 }, trainer: { min: -19, max: -14 }, gym: { min: -21, max: -17 } },
    speciesBands: [2, 3],
    moveBands: [1, 2, 3],
    teamAdvantage: { wild: 0, trainer: 0, gym: 2 },
  },
  {
    segment: 7,
    playerLevel: 72,
    levelOffset: { wild: { min: -23, max: -18 }, trainer: { min: -20, max: -15 }, gym: { min: -23, max: -18 } },
    speciesBands: [2, 3],
    moveBands: [1, 2, 3],
    teamAdvantage: { wild: 0, trainer: 0, gym: 2 },
  },
];

/**
 * What a difficulty tier does to a generated encounter. **This is the whole of
 * tier logic, and it is deliberately three numbers in one table.**
 *
 * The spec's rule for Stage 3 is that tier does exactly two things: it scales
 * the encounter, and it selects a reward pool. The first of those is this
 * table, and the reason it is here rather than scattered through
 * `core/randomizer.ts` is that a difficulty lever the simulator cannot move
 * without a code change is not a lever.
 *
 * The three columns are the three axes the spec names — level offset, stat
 * quality, and team size — and they interact, which is why the numbers below
 * are not simply "more of everything as you go up":
 *
 * **`hard` buys difficulty with levels and stat quality. `elite` buys it with
 * a second Pokemon and pays for that with levels.** That is the Stage 2 finding
 * applied at node scale: team size is the dominant lever at `PARTY_SIZE` 1, and
 * a step up in team size that is *not* paid for with a step down in level is
 * not a difficulty curve, it is a wall. The first Stage 3 cut proved it — see
 * the note on the `elite` row below — and the fix was to make elite's level
 * modifier *negative*.
 *
 * Crucially, a tier shifts *values* and never consumes a draw. A `hard` node
 * and a `normal` node in the same map position roll the same number of times,
 * so the tier a node carries cannot reshuffle anything downstream of it.
 */
export interface TierModifier {
  /** Added to the drawn opponent level. */
  level: number;
  /**
   * Added to the species band window — how *bulky and strong* the opponent is.
   */
  speciesBand: number;
  /**
   * Added to the damaging-move band window — how *hard it hits*.
   *
   * **Split from `speciesBand` by the Stage 3 tuning pass, and the split earned
   * itself immediately.** One `band` number moved both windows at once, so
   * `hard` landed a base-stat jump and a move-power jump together: at segment 0
   * it took opponents from ~350 average BST with sub-55 BP moves to ~445 BST
   * with 60-75 BP moves, which is the single largest difficulty step anywhere in
   * the game and it sat on the *first* tier a player ever meets.
   *
   * The simulator measured it as a nine-point hole in per-segment survival for
   * `tier-greedy` in the opening segments — enough to sink the whole risk
   * gradient, because a reward pool cannot pay back nine points a segment.
   * Two knobs let `hard` be a stat check and `elite` be a damage check, which
   * is also the more legible pair to play against.
   */
  moveBand: number;
  /** Extra opponents, on top of the segment's own advantage. */
  team: number;
}

export const TIER_MODIFIERS: Record<Tier, TierModifier> = {
  normal: { level: 0, speciesBand: 0, moveBand: 0, team: 0 },
  /** A stat check: bulkier, higher level, hitting with the same move pool. */
  hard: { level: 1, speciesBand: 1, moveBand: 0, team: 0 },
  /*
   * Elite fields one Pokemon more than the player and pays for it with *three
   * levels below the segment baseline* — not above it.
   *
   * The first Stage 3 cut had `{ level: 1, band: 2, team: 1 }`, and the
   * simulator was blunt about it: `tier-greedy` died before gym 2 in 52% of runs
   * against `tier-averse`'s 35%, and completed no more often. An extra Pokemon
   * *above* the curve at an ordinary node is not a risky fight, it is a gym
   * without the reward, and no pool can be tuned to pay for it.
   *
   * Below the curve, the same extra Pokemon is texture instead: more matchups,
   * more PP spent, more turns to be outplayed in, and a real chance to lose if
   * the player walks in damaged. That is the Stage 2 team-size finding applied
   * exactly as it was written down — every step up in team size is paid for
   * with a step down in level.
   *
   * **The payment shrank from eight levels to three in Stage 4, and the reason
   * is arithmetic rather than taste.** `team: 1` is a fixed *number* of extra
   * Pokemon, so what it buys depends entirely on `PARTY_SIZE`: at 1 it was a
   * second body against a lone player, a 100% increase in the opposition, and
   * eight levels was the price of that. At 3 the same `+1` is a fourth body
   * against three — a 33% increase — while eight levels went on costing exactly
   * as much as before. Scaling the payment by what it now buys gives
   * `-8 x (1/3) ≈ -3`.
   *
   * Left un-scaled it does not merely mis-price the tier, it *inverts* it:
   * `test/tiers.test.ts` measured elite at 84% of hard's encounter power at
   * `PARTY_SIZE` 3, which is an "elite" node that is strictly easier than the
   * `hard` one beside it and a reward pool paying more for it. Three restores
   * the ordering with about eleven points of margin.
   *
   * This is a *monotonicity* repair, not the Stage 4 balance pass. It makes the
   * tier ordering true again at the new party size; whether -3 is the right
   * steepness is a clear-rate question, and docs/balance.md records what the
   * simulator said about it.
   */
  elite: { level: -3, speciesBand: 1, moveBand: 1, team: 1 },
};

/**
 * The highest band each generated pool actually contains.
 *
 * Derived rather than written down, because both pools are generated files and
 * a regenerated pool that added a band would otherwise leave a hardcoded
 * ceiling silently wrong. It is the ceiling `shift` clamps to.
 */
export const MAX_SPECIES_BAND = SPECIES_POOL.reduce((top, entry) => Math.max(top, entry.band), 0);
export const MAX_MOVE_BAND = DAMAGING_MOVES.reduce((top, move) => Math.max(top, move.band), 0);

/**
 * How a generated moveset is shaped.
 *
 * Not per segment: the *contents* of a moveset scale through `moveBands`, and
 * making the shape scale as well would give a balance pass two knobs that move
 * the same number. The rule the spec cares about is `stabSlots >= 1` together
 * with slot one always being damaging, which is what makes "no generated spec
 * has zero damaging moves" true by construction rather than by retry.
 */
export const MOVESET = {
  slots: 4,
  /** Leading slots that must be a damaging move of one of the species' types. */
  stabSlots: 1,
  /** Chance the final slot is a status move rather than another attack. */
  statusChance: 0.55,
  /** Chance a coverage slot re-rolls as STAB instead of open coverage. */
  stabBias: 0.3,
} as const;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The row for a segment. Throws rather than clamping: an out-of-range segment is a bug. */
export function segmentScaling(segment: number): SegmentScaling {
  const row = SEGMENTS[segment];
  if (!row) throw new RangeError(`No scaling defined for segment ${segment} (have 0..${SEGMENTS.length - 1})`);
  return row;
}

/** The level the player's party sits at during a segment. */
export function playerLevel(segment: number): number {
  return segmentScaling(segment).playerLevel;
}

/** The level a starter enters the run at. Segment 0's player level, by definition. */
export function starterLevel(): number {
  return playerLevel(0);
}

/** Bands a segment may draw species from, shifted by tier. */
export function speciesBandsFor(segment: number, tier: Tier): readonly number[] {
  return shift(segmentScaling(segment).speciesBands, TIER_MODIFIERS[tier].speciesBand, MAX_SPECIES_BAND);
}

/** Bands a segment may draw damaging moves from, shifted by tier. */
export function moveBandsFor(segment: number, tier: Tier): readonly number[] {
  return shift(segmentScaling(segment).moveBands, TIER_MODIFIERS[tier].moveBand, MAX_MOVE_BAND);
}

/**
 * Raise a band window by a tier's band modifier, without letting it run off the
 * top of the table.
 *
 * The naive version — `bands.map((band) => band + by)` — is what Stage 2
 * shipped, and it was safe only because every tier modifier was zero. Turning
 * tiers on makes it wrong in two ways at once. At segment 7 the species window
 * is `[3, 4]`, so an `elite` shift of +2 asks for bands 5 and 6, **neither of
 * which exists**: the filtered pool comes back empty and `stream.pick` throws
 * mid-generation. One band lower it does not throw and does something worse —
 * `[4, 5]` collapses to the eighteen species in band 4, so the hardest nodes in
 * the run would draw from the narrowest pool in the game and every elite
 * encounter in segment 7 would start to look like the same fight.
 *
 * So: clamp to the real ceiling, then widen back downward to the window's
 * original *width* wherever there is room. A tier that has run out of headroom
 * therefore stops raising stat quality and keeps raising level and team size,
 * which is a curve that flattens rather than one that crashes. Segments 6 and 7
 * are where that bites, and it is the honest answer — the table has five
 * species bands and the last segment already draws from the top two.
 */
function shift(bands: readonly number[], by: number, ceiling: number): readonly number[] {
  if (by === 0) return bands;

  const raised = [...new Set(bands.map((band) => Math.max(0, Math.min(ceiling, band + by))))].sort(
    (a, b) => a - b,
  );
  while (raised.length < bands.length && (raised[0] ?? 0) > 0) {
    raised.unshift((raised[0] ?? 0) - 1);
  }
  return raised;
}

/**
 * How many Pokemon an opponent fields.
 *
 * `PARTY_SIZE + advantage`, clamped to the sim's six. Read this rather than
 * writing a literal: a hardcoded team size is the single-mon assumption
 * wearing a different hat.
 */
export function opponentTeamSize(kind: BattleKind, segment: number, tier: Tier, override?: number): number {
  const advantage = override ?? segmentScaling(segment).teamAdvantage[kind] + TIER_MODIFIERS[tier].team;
  return Math.max(1, Math.min(MAX_TEAM_SIZE, PARTY_SIZE + advantage));
}

/** The opponent level band for a node kind in a segment, tier applied. */
export function opponentLevel(kind: BattleKind, segment: number, tier: Tier): Range {
  const row = segmentScaling(segment);
  const offset = row.levelOffset[kind];
  const bonus = TIER_MODIFIERS[tier].level;
  return { min: row.playerLevel + offset.min + bonus, max: row.playerLevel + offset.max + bonus };
}

/**
 * The move bands a reward at this node may draw from.
 *
 * A reward pool entry carries a `bandOffset` and this applies it *on top of*
 * the node's own tier shift, so an elite node's tutor reaches two bands above
 * an elite node's encounter rather than merely matching it. Both shifts go
 * through the same clamp-and-widen rule, so a reward pool cannot ask for a band
 * that does not exist any more than an encounter can.
 *
 * This is the second of the two things a tier does — the first is scaling the
 * encounter, above — and putting both in one file is deliberate: the risk and
 * the reward are one curve, and a balance pass that can only see half of it is
 * tuning blind.
 */
export function rewardMoveBands(segment: number, tier: Tier, offset: number): readonly number[] {
  return shift(moveBandsFor(segment, tier), offset, MAX_MOVE_BAND);
}

/** The species bands a species reward at this node may draw from. */
export function rewardSpeciesBands(segment: number, tier: Tier, offset: number): readonly number[] {
  return shift(speciesBandsFor(segment, tier), offset, MAX_SPECIES_BAND);
}

// ---------------------------------------------------------------------------
// The metric a tier is monotonic in
// ---------------------------------------------------------------------------

/**
 * Base stat total by species name, for the metric below.
 *
 * Keyed by `species` rather than by id because that is what a `PokemonSpec`
 * carries. Built once: the pool is a thousand entries and the simulator asks
 * this question for every member of every team in a thousand runs.
 */
const BST_BY_SPECIES = new Map(SPECIES_POOL.map((entry) => [entry.species, entry.bst]));

/**
 * How strong a generated encounter is, as one number.
 *
 * **The point of this function is that "elite is harder than hard" is a claim
 * that has to be falsifiable.** The spec asks for tier scaling to be monotonic,
 * and monotonic in *what* is not a detail — a metric that read only level would
 * report `elite` (+1 level, +1 Pokemon) as weaker than `hard` (+3 levels), and
 * a metric that read only team size would report them as incomparable at every
 * node where both field one.
 *
 * `level x base stat total`, summed over the team, is the smallest number that
 * moves with all three columns of `TIER_MODIFIERS` at once: level directly,
 * stat quality through the band window that decides which species are drawable,
 * and team size through the sum. It is not a damage model and does not try to
 * be one — a Pokemon's moves and ability matter enormously in a fight and not
 * at all here. It is the *encounter budget*, and it is what
 * test/tiers.test.ts asserts the ordering of across many seeds.
 *
 * Species outside the pool contribute their level alone rather than throwing:
 * this is a measurement, and a measurement that crashes on an unexpected input
 * is one nobody runs.
 */
export function encounterPower(team: TeamSpec): number {
  return team.reduce((total, member) => total + specPower(member), 0);
}

/** One Pokemon's contribution to `encounterPower`. */
export function specPower(spec: PokemonSpec): number {
  return spec.level * (BST_BY_SPECIES.get(spec.species) ?? 1);
}
