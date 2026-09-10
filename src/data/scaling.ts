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
 *   - **Team sizes**, as a function of the slot schedule. See below.
 */
import type { PokemonSpec, TeamSpec, Tier } from '../core/types';
import { MAX_MOVE_BAND, MIN_MOVE_BAND } from './moveOverrides';
import { SPECIES_POOL } from './speciesPools';
import { MAX_PARTY_CAPACITY, partyCapacityAfter } from './partyTuning';
import type { BattleKind, Range } from './tuning';

/*
 * The party's size used to be declared here and now lives in `data/partyTuning.ts`,
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
  /**
   * How likely each damaging-move band is in this segment. **A distribution,
   * not a window, from Stage 4.6b.**
   *
   * It was `moveBands: readonly number[]` — a flat set every move slot drew
   * uniformly from — and the change is the whole of the stage's ramp. A window
   * makes the run a *staircase*: every opponent in segments 4-5 draws from
   * exactly bands 2 and 3, half and half, so the moment the segment index ticks
   * over, everything the player meets steps up together. A distribution makes
   * it a slope: segment 4 is mostly band 3 with band 2 still showing up, so the
   * opponent that hits like a truck arrives *before* the segment where every
   * opponent does.
   *
   * It also gives a tuning pass a dial it did not have. A window can only be
   * widened or moved; a weight can be moved by a tenth.
   *
   * A band with no entry has weight zero and cannot be drawn, which is what
   * keeps band 4 out of the opening segments — the same idiom `tuning.tierBands`
   * uses to keep `elite` out of them.
   */
  moveBandWeights: Readonly<Record<number, number>>;
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
   * advantage and `opponentTeamSize` adds the player's own party, which means Stage 4
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
    levelOffset: { wild: { min: -11, max: -9 }, trainer: { min: -10, max: -8 }, gym: { min: -3, max: -2 } },
    speciesBands: [0, 1],
    moveBandWeights: { 1: 1 },
    teamAdvantage: { wild: 0, trainer: 0, gym: 0 },
  },
  {
    segment: 1,
    playerLevel: 36,
    levelOffset: { wild: { min: -13, max: -10 }, trainer: { min: -11, max: -9 }, gym: { min: -4, max: -3 } },
    speciesBands: [0, 1, 2],
    moveBandWeights: { 1: 1 },
    teamAdvantage: { wild: 0, trainer: 0, gym: 0 },
  },
  {
    segment: 2,
    playerLevel: 42,
    levelOffset: { wild: { min: -18, max: -15 }, trainer: { min: -16, max: -13 }, gym: { min: -8, max: -6 } },
    speciesBands: [1, 2],
    moveBandWeights: { 1: 1 },
    teamAdvantage: { wild: 0, trainer: 0, gym: 1 },
  },
  {
    segment: 3,
    playerLevel: 48,
    levelOffset: { wild: { min: -20, max: -16 }, trainer: { min: -17, max: -14 }, gym: { min: -9, max: -7 } },
    speciesBands: [1, 2],
    moveBandWeights: { 1: 3, 2: 5 },
    teamAdvantage: { wild: 0, trainer: 0, gym: 1 },
  },
  {
    segment: 4,
    playerLevel: 54,
    levelOffset: { wild: { min: -21, max: -17 }, trainer: { min: -19, max: -15 }, gym: { min: -12, max: -10 } },
    speciesBands: [2, 3],
    moveBandWeights: { 1: 3, 2: 5 },
    teamAdvantage: { wild: 0, trainer: 0, gym: 1 },
  },
  {
    segment: 5,
    playerLevel: 60,
    levelOffset: { wild: { min: -23, max: -18 }, trainer: { min: -20, max: -16 }, gym: { min: -14, max: -11 } },
    speciesBands: [2, 3],
    moveBandWeights: { 2: 5, 3: 3 },
    teamAdvantage: { wild: 0, trainer: 0, gym: 2 },
  },
  {
    segment: 6,
    playerLevel: 66,
    levelOffset: { wild: { min: -25, max: -20 }, trainer: { min: -22, max: -17 }, gym: { min: -14, max: -11 } },
    speciesBands: [2, 3],
    moveBandWeights: { 2: 3, 3: 5 },
    teamAdvantage: { wild: 0, trainer: 0, gym: 2 },
  },
  {
    segment: 7,
    playerLevel: 72,
    levelOffset: { wild: { min: -26, max: -21 }, trainer: { min: -23, max: -18 }, gym: { min: -15, max: -12 } },
    speciesBands: [2, 3],
    moveBandWeights: { 3: 3, 4: 5 },
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
 * The highest species band the generated pool actually contains.
 *
 * Derived rather than written down, because the pool is a generated file and a
 * regenerated pool that added a band would otherwise leave a hardcoded ceiling
 * silently wrong. It is the ceiling `shift` clamps to.
 *
 * The move-band ceiling is `MAX_MOVE_BAND` in `data/moveOverrides.ts`, which is
 * where banding lives from Stage 4.6b — a band can now come from an override
 * rather than from the generated entry, so the ceiling has to be derived where
 * the overrides are.
 */
export const MAX_SPECIES_BAND = SPECIES_POOL.reduce((top, entry) => Math.max(top, entry.band), 0);

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

/**
 * The band distribution a segment draws damaging moves from, tier applied.
 *
 * The tier shifts the whole distribution up by `TIER_MODIFIERS[tier].moveBand`,
 * clamped at the ceiling — so a `hard` node in segment 4 is mostly band 4 where
 * an ordinary one is mostly band 3, and the weights keep their shape rather
 * than being replaced by a different table per tier.
 *
 * Two bands that collide at the ceiling have their weights **summed**, which is
 * the honest reading of "shift a distribution into a wall": the probability
 * mass has to go somewhere, and the top band is where it goes.
 */
export function moveBandWeightsFor(segment: number, tier: Tier): Readonly<Record<number, number>> {
  return shiftWeights(segmentScaling(segment).moveBandWeights, TIER_MODIFIERS[tier].moveBand);
}

/**
 * The bands a segment can actually draw, tier applied. Sorted, no weights.
 *
 * What a *pool* wants, as opposed to what a draw wants: `damagingInBands`
 * filters the move list, and a reward that reaches "one band above" reaches a
 * set. A band with weight zero is not in it, because a band that cannot be
 * drawn is not a band this segment has.
 */
export function moveBandsFor(segment: number, tier: Tier): readonly number[] {
  return Object.entries(moveBandWeightsFor(segment, tier))
    .filter(([, weight]) => weight > 0)
    .map(([band]) => Number(band))
    .sort((a, b) => a - b);
}

/**
 * The band a segment is *at* — the one carrying the most weight.
 *
 * The spec's "the segment's current band", which the reward pools are keyed
 * against: a normal node pays a move in it, a hard node one above, an elite two
 * above. The modal band rather than the mean, because a band is a label and
 * there is no such thing as band 2.4.
 *
 * Ties go to the **higher** band. A tie means the segment is mid-transition,
 * and a reward that rounds a transition downward is a reward that arrives a
 * segment late.
 */
export function segmentMoveBand(segment: number, tier: Tier = 'normal'): number {
  const weights = moveBandWeightsFor(segment, tier);
  let best = MIN_MOVE_BAND;
  let bestWeight = -1;
  for (const [band, weight] of Object.entries(weights)) {
    if (weight >= bestWeight) {
      bestWeight = weight;
      best = Number(band);
    }
  }
  return best;
}

/**
 * Shift a band distribution up, clamped at the ceiling, weights summed on
 * collision.
 *
 * The move-band mirror of `shift`, and a separate function rather than a
 * generalisation of it because the two do different things to a collision. A
 * *window* that runs into the ceiling is widened back downward, so an elite
 * node in the last segment still draws from more than the top eighteen species;
 * a *distribution* that runs into the ceiling piles up there, which is what
 * "everything you meet hits like a truck" is supposed to mean at the end of a
 * run.
 */
function shiftWeights(
  weights: Readonly<Record<number, number>>,
  by: number,
): Readonly<Record<number, number>> {
  if (by === 0) return weights;
  const shifted: Record<number, number> = {};
  for (const [band, weight] of Object.entries(weights)) {
    const raised = Math.max(MIN_MOVE_BAND, Math.min(MAX_MOVE_BAND, Number(band) + by));
    shifted[raised] = (shifted[raised] ?? 0) + weight;
  }
  return shifted;
}

/**
 * How often an opponent walks in holding a berry, by segment.
 *
 * **Stage 4.6b, and the shape of the curve is the point.** Berries are the low
 * denomination: they matter when a health bar is small and fade as HP totals
 * scale, so an opponent holding one is a real complication in segment 1 and
 * noise by segment 7. Weighting the rate the same way means the *player* meets
 * the mechanic while it still teaches something — a fight that goes one turn
 * longer than it should is how you learn to read `-enditem` on the battle log.
 *
 * A trainer holds them far more often than a wild Pokemon. A trainer prepared;
 * a wild Pokemon is holding whatever it was holding. That is flavour, and it is
 * also the lever that keeps the guaranteed wild encounter from becoming the
 * hardest node in the segment.
 *
 * Gym leaders are not on this table and hold nothing. A gym is the segment's
 * difficulty statement and it already draws at `GYM_MOVE_BAND_BONUS`; a second
 * dial on the same fight is a dial the balance report cannot attribute.
 */
export const BERRY_HOLD_RATE: readonly { trainer: number; wild: number }[] = [
  { trainer: 0.5, wild: 0.25 },
  { trainer: 0.5, wild: 0.25 },
  { trainer: 0.4, wild: 0.2 },
  { trainer: 0.4, wild: 0.2 },
  { trainer: 0.3, wild: 0.15 },
  { trainer: 0.3, wild: 0.15 },
  { trainer: 0.2, wild: 0.1 },
  { trainer: 0.2, wild: 0.1 },
];

/** The chance a `kind` opponent in this segment holds a berry. Gyms hold none. */
export function berryHoldRate(kind: BattleKind, segment: number): number {
  if (kind === 'gym') return 0;
  const row = BERRY_HOLD_RATE[Math.max(0, Math.min(BERRY_HOLD_RATE.length - 1, segment))];
  return row ? row[kind] : 0;
}

/**
 * What band a move reward pays at, by the tier that paid it.
 *
 * **The reward half of Stage 4.6b's ramp, as three numbers.** A move card is
 * drawn at the segment's own current band plus this, so:
 *
 * - **normal** pays *in* band: same power, different type. A sidegrade, which
 *   is a coverage decision rather than an upgrade — and the tier that costs
 *   nothing should not hand out power.
 * - **hard** pays one band above, which is the smallest step that is visibly a
 *   step.
 * - **elite** pays two, which is the reason to take an elite node at all when
 *   the item on the same card is a coin flip.
 *
 * One rule rather than a `bandOffset` on every pool entry, because it *is* one
 * rule: "what did you risk" is exactly the question a tier answers, and
 * spreading the answer across twenty table rows is twenty places to make the
 * same edit. An entry may still add its own offset on top; only the gym pool
 * does, to stay strictly better than elite.
 */
export const REWARD_BAND_OFFSET: Record<Tier, number> = { normal: 0, hard: 1, elite: 2 };

/**
 * The band bonus a gym leader draws at. **The difficulty spike, as one number.**
 *
 * A gym takes no tier — it is the segment's difficulty statement, and a second
 * dial on the same number is a dial the balance report cannot attribute — so
 * the spike it *does* get has to be visible somewhere, and this is the somewhere.
 * At +1 a gym in segment 4 draws mostly band 4 while the trainers around it draw
 * mostly band 3.
 *
 * It applies to the move band only. Level, team size and species band come from
 * the segment's own gym columns, which were tuned before this existed.
 */
export const GYM_MOVE_BAND_BONUS = 1;

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
 * How big the player's party actually is at this point in the run.
 *
 * **Not the slot count, and the difference is the largest single finding of the
 * Stage 4 balance pass.** A run starts with one Pokemon and grows toward its
 * slots by acquiring; it does not begin full. Sizing every opponent against the
 * slot count therefore aimed the entire difficulty curve at a player who does
 * not exist for the first third of the run. Stage 4.8 made the slot count itself
 * a curve, which changes nothing about that argument: a ceiling that rises is
 * still a ceiling, and this is still the measurement under it.
 *
 * The simulator was blunt about it. At a flat three slots the first baseline
 * produced an *inverted* curve — 74% clear at gym 1 rising to 96% at gym 8 —
 * because the opening was a solo Pokemon against three while the back half was
 * a full party against three. Mean party size walking into a battle was 1.54.
 * Runs that ever filled the party completed 68% of the time; runs that did not
 * completed 2%. That is not a difficulty curve with a bad slope, it is a curve
 * measured against the wrong quantity.
 *
 * So the curve reads *this* table, and `teamAdvantage` goes back to meaning
 * what it says: Pokemon the opponent fields **beyond what the player has**.
 *
 * It is a table rather than a formula for the reason every other curve here is
 * one: the growth is not linear and does not have to be. It is also a
 * *claim*, and the simulator's `sizeBySegment` section is what holds it to
 * account — it prints the measured party beside this column, segment by
 * segment.
 *
 * **The third row is 2 because that is what the measurement said, and the first
 * cut had it at 3.** With a 3 there, segment 2's opponents were sized for a
 * full party against a real one of 2.34, and gym 3 was the only cliff left in
 * the curve — 72% clear against 83% and 89% on either side of it. Nothing about
 * that gym was harder; the curve was simply aimed a whole Pokemon ahead of the
 * player. Fixing the assumption is the honest repair: difficulty belongs in the
 * levels and the band windows, where a balance pass can see it, not in a
 * mis-stated premise.
 */
const EXPECTED_PARTY_SIZE: readonly number[] = [1, 2, 2, 3, 4, 4, 5, 5];

/*
 * **Stage 4.8 moved the back half of that table, and only the back half.**
 *
 * Item 1 put party slots on a schedule — three, then four at gym 2, five at gym
 * 4, six at gym 6 — so from segment 4 on, a player who has been capturing fields
 * more than three. The old rows said 3 for all five of those segments, which
 * would have re-created the inverted curve this section exists to describe,
 * pointing the other way: opponents sized for three against a real party of five
 * makes the back half *easier* as the roster widens, which is the opposite of
 * what growth is for.
 *
 * Segments 0 to 3 are **unchanged, to the number**, so the early benchmark rows
 * stay comparable across the patch and a change in them is attributable to
 * something else. The four rows that moved track the schedule one unlock behind
 * it, because a slot is capacity and filling it takes a wild encounter — there
 * is one guaranteed per segment and a player may decline it, which is the same
 * lag the original rows measured when the ceiling was three.
 *
 * It is still a *claim*, and still held to account by the simulator's
 * `party.sizeBySegment` section, which prints the measured party beside this
 * column. The benchmark at the end of 4.8 is what says whether the lag is right.
 */

/**
 * The party size the curve assumes at a segment, capped at the slots it has.
 *
 * **Two different quantities, and the cap is the only place they meet.** The row
 * is what the player is *measured* to field; the cap is what the slot schedule
 * *allows*. Stage 4.8 made the second a curve of its own, and reading it here is
 * what makes `partyCapacityAfter` the single source of the ceiling — edit the
 * schedule and this follows, with no second table to keep in agreement.
 *
 * Capped by gyms cleared rather than by segment index as a separate idea: at
 * segment N the run has cleared N gyms, because clearing gym N is what opens
 * segment N+1. So the segment index *is* the gym count here, and passing it
 * straight through is correct rather than convenient.
 *
 * The cap is also what keeps this honest when the ceiling moves: at
 * `GYMRUN_PARTY_SIZE=1` every row collapses to 1 and the Stage 3 curve is
 * reproduced exactly, which is what makes that sweep a valid comparison rather
 * than a different game.
 */
export function expectedPartySize(segment: number): number {
  const row = EXPECTED_PARTY_SIZE[Math.min(segment, EXPECTED_PARTY_SIZE.length - 1)] ?? MAX_PARTY_CAPACITY;
  return Math.max(1, Math.min(partyCapacityAfter(segment), row));
}

/**
 * How many Pokemon an opponent fields.
 *
 * `expectedPartySize(segment) + advantage`, clamped to the sim's six. Read this
 * rather than writing a literal: a hardcoded team size is the single-mon
 * assumption wearing a different hat.
 *
 * `override` is the gym's own `teamSize`, which is an absolute count rather
 * than an advantage — a gym leader fields what the gym table says.
 */
export function opponentTeamSize(kind: BattleKind, segment: number, tier: Tier, override?: number): number {
  const advantage = override ?? segmentScaling(segment).teamAdvantage[kind] + TIER_MODIFIERS[tier].team;
  return Math.max(1, Math.min(MAX_TEAM_SIZE, expectedPartySize(segment) + advantage));
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
  return [rewardMoveBand(segment, tier, offset)];
}

/**
 * The single band a move reward pays at: the segment's own, plus the tier's
 * offset, plus whatever the entry adds.
 *
 * **One band, not a window, and that is the change.** A window meant a normal
 * node's TM could land anywhere the *encounter* could, so "what does this tier
 * pay" had no answer a player could learn. One band per tier is a rule that can
 * be read off the card, which is what makes the reward screen's band label
 * (Stage 4.6b's UI) worth printing at all.
 *
 * Computed from the segment's band rather than from the tier-shifted encounter
 * window, deliberately. The tier is already in this sum once; taking it from
 * the encounter as well would pay `hard` twice and make an elite card in a late
 * segment indistinguishable from a gym's.
 */
export function rewardMoveBand(segment: number, tier: Tier, offset = 0): number {
  const band = segmentMoveBand(segment) + REWARD_BAND_OFFSET[tier] + offset;
  return Math.max(MIN_MOVE_BAND, Math.min(MAX_MOVE_BAND, band));
}

/*
 * `rewardSpeciesBands` was here, and it went with the species reward kind in
 * Stage 4.6b. Nothing draws a species outside an encounter now — a party member
 * arrives by capture, which reads a species the map already generated.
 */

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
