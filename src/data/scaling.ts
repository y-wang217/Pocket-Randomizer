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
import type { Tier } from '../core/types';
import type { NodeKind, Range } from './tuning';

/**
 * How many Pokemon the player fields.
 *
 * **Stage 4 raises this, and raising it must not require a rewrite.** Every
 * place that would otherwise assume a single player Pokemon reads this
 * constant instead: `party.battleTeamFor`, `party.carryOverFor`, and the
 * opponent team sizes below. The driver already grew a switch choice for the
 * same reason (see `Choice` in core/types.ts), so a party of three is a
 * configuration change rather than a new run loop.
 *
 * The one thing it does not yet buy is a *player-facing* switch: at party size
 * one the player is never asked, so the UI has no switch button to press. That
 * is the honest remaining Stage 4 work.
 */
export const PARTY_SIZE = 1;

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
  levelOffset: Record<NodeKind, Range>;
  /** Species bands (data/speciesPools.ts) this segment may draw from. */
  speciesBands: readonly number[];
  /** Damaging-move bands (data/movePools.ts) this segment may draw from. */
  moveBands: readonly number[];
  /**
   * Extra Pokemon the opponent fields *beyond the player's party size*.
   *
   * The number that matters is the difference, not the count. A gym with six
   * Pokemon against a solo player is not a difficulty curve, it is a wall; the
   * same gym against a party of six is an even fight. So the table stores the
   * advantage and `opponentTeamSize` adds `PARTY_SIZE`, which means Stage 4
   * raising the party keeps the *shape* of the curve rather than trivialising
   * the back half of the run.
   */
  teamAdvantage: Record<NodeKind, number>;
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
    levelOffset: { wild: { min: -8, max: -6 }, trainer: { min: -7, max: -5 }, rest: { min: 0, max: 0 }, gym: { min: -1, max: 0 } },
    speciesBands: [0, 1],
    moveBands: [0],
    teamAdvantage: { wild: 0, trainer: 0, rest: 0, gym: 0 },
  },
  {
    segment: 1,
    playerLevel: 36,
    levelOffset: { wild: { min: -10, max: -7 }, trainer: { min: -8, max: -6 }, rest: { min: 0, max: 0 }, gym: { min: -2, max: -1 } },
    speciesBands: [0, 1, 2],
    moveBands: [0],
    teamAdvantage: { wild: 0, trainer: 0, rest: 0, gym: 0 },
  },
  {
    segment: 2,
    playerLevel: 42,
    levelOffset: { wild: { min: -12, max: -9 }, trainer: { min: -10, max: -7 }, rest: { min: 0, max: 0 }, gym: { min: -9, max: -7 } },
    speciesBands: [1, 2],
    moveBands: [0, 1],
    teamAdvantage: { wild: 0, trainer: 0, rest: 0, gym: 1 },
  },
  {
    segment: 3,
    playerLevel: 48,
    levelOffset: { wild: { min: -14, max: -10 }, trainer: { min: -11, max: -8 }, rest: { min: 0, max: 0 }, gym: { min: -10, max: -8 } },
    speciesBands: [1, 2],
    moveBands: [0, 1],
    teamAdvantage: { wild: 0, trainer: 0, rest: 0, gym: 1 },
  },
  {
    segment: 4,
    playerLevel: 54,
    levelOffset: { wild: { min: -15, max: -11 }, trainer: { min: -13, max: -9 }, rest: { min: 0, max: 0 }, gym: { min: -16, max: -13 } },
    speciesBands: [2, 3],
    moveBands: [1, 2],
    teamAdvantage: { wild: 0, trainer: 0, rest: 0, gym: 1 },
  },
  {
    segment: 5,
    playerLevel: 60,
    levelOffset: { wild: { min: -17, max: -12 }, trainer: { min: -14, max: -10 }, rest: { min: 0, max: 0 }, gym: { min: -18, max: -14 } },
    speciesBands: [2, 3],
    moveBands: [1, 2],
    teamAdvantage: { wild: 0, trainer: 1, rest: 0, gym: 2 },
  },
  {
    segment: 6,
    playerLevel: 66,
    levelOffset: { wild: { min: -19, max: -14 }, trainer: { min: -16, max: -11 }, rest: { min: 0, max: 0 }, gym: { min: -19, max: -15 } },
    speciesBands: [3, 4],
    moveBands: [1, 2, 3],
    teamAdvantage: { wild: 0, trainer: 1, rest: 0, gym: 2 },
  },
  {
    segment: 7,
    playerLevel: 72,
    levelOffset: { wild: { min: -20, max: -15 }, trainer: { min: -17, max: -12 }, rest: { min: 0, max: 0 }, gym: { min: -21, max: -16 } },
    speciesBands: [3, 4],
    moveBands: [1, 2, 3],
    teamAdvantage: { wild: 0, trainer: 1, rest: 0, gym: 2 },
  },
];

/**
 * What a difficulty tier does to a generated encounter.
 *
 * Stage 2 passes `normal` everywhere, so every number in that row is zero and
 * every seed this stage records is unaffected by the whole mechanism. The
 * parameter is built and the tier *UI* and reward pools are not: Stage 3 makes
 * the choice visible and keys rewards to it.
 *
 * Crucially, a tier shifts *values* and never consumes a draw. A `hard` node
 * and a `normal` node in the same map position roll the same number of times,
 * so turning tiers on in Stage 3 cannot reshuffle anything downstream of them.
 */
export interface TierModifier {
  /** Added to the drawn opponent level. */
  level: number;
  /** Added to every species and move band the segment allows. */
  band: number;
  /** Extra opponents, on top of the segment's own advantage. */
  team: number;
}

export const TIER_MODIFIERS: Record<Tier, TierModifier> = {
  normal: { level: 0, band: 0, team: 0 },
  hard: { level: 2, band: 1, team: 0 },
  elite: { level: 4, band: 1, team: 1 },
};

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
  return shift(segmentScaling(segment).speciesBands, TIER_MODIFIERS[tier].band);
}

/** Bands a segment may draw damaging moves from, shifted by tier. */
export function moveBandsFor(segment: number, tier: Tier): readonly number[] {
  return shift(segmentScaling(segment).moveBands, TIER_MODIFIERS[tier].band);
}

function shift(bands: readonly number[], by: number): readonly number[] {
  return by === 0 ? bands : bands.map((band) => band + by);
}

/**
 * How many Pokemon an opponent fields.
 *
 * `PARTY_SIZE + advantage`, clamped to the sim's six. Read this rather than
 * writing a literal: a hardcoded team size is the single-mon assumption
 * wearing a different hat.
 */
export function opponentTeamSize(kind: NodeKind, segment: number, tier: Tier, override?: number): number {
  const advantage = override ?? segmentScaling(segment).teamAdvantage[kind] + TIER_MODIFIERS[tier].team;
  return Math.max(1, Math.min(MAX_TEAM_SIZE, PARTY_SIZE + advantage));
}

/** The opponent level band for a node kind in a segment, tier applied. */
export function opponentLevel(kind: NodeKind, segment: number, tier: Tier): Range {
  const row = segmentScaling(segment);
  const offset = row.levelOffset[kind];
  const bonus = TIER_MODIFIERS[tier].level;
  return { min: row.playerLevel + offset.min + bonus, max: row.playerLevel + offset.max + bonus };
}
