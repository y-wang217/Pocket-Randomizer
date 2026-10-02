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

/**
 * The sim's hard ceiling on a side. Team sizes are clamped to it.
 *
 * Exported from Stage 4.8, because it stopped being an implementation detail:
 * `EXPECTED_PARTY_SIZE` must stay strictly under it or the tier gradient in team
 * size has nowhere to go, and `test/tiers.test.ts` asserts that relationship
 * against this name rather than against a literal six.
 */
export const MAX_TEAM_SIZE = 6;

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
  /**
   * Opponent level relative to `playerLevel`, drawn per encounter.
   *
   * **Wild below, trainer nearer, gym exactly level. 2026-09-17.** A wild
   * Pokemon is a step on the road; a trainer is the fight the road is for; a
   * gym is the segment's exam, sized to the party and played by the hard AI.
   *
   * The gym column is zero in both directions at every segment, and it is the
   * one column in this table that is not a tuning number. **A gym is never
   * above the party and never below it**, which makes it the only fight in the
   * run whose speed tie is decided by the Pokemon rather than by the level —
   * see the note on the table below for why that is the point.
   *
   * Stage 4.9 had it positive and growing, to +2/+4 by segment 7, on the
   * argument that a gym is sized to the party and should read as an exam. The
   * argument was sound and the lever was wrong: a level advantage in Gen 3
   * scales every stat at once, and the stat it decides fights with is Speed.
   * The gym keeps its exam difficulty — the full roster (`opponentTeamSize`),
   * the band bonus (`GYM_MOVE_BAND_BONUS`) and the hard AI (`data/ai.ts`) are
   * all untouched — and pays for none of it in levels.
   *
   * **Wild two lower, gyms 1 to 3 one lower. 2026-09-25.** A playtest read
   * wild encounters as too strong, and the lever is the level rather than a
   * band: a capture keeps the species and moveset it was fought with and
   * re-levels to the party (`core/acquisition.ts`), so a lower band is a
   * weaker catch for the rest of the run while a lower level is the same
   * catch fought at a discount. Every wild row moves down by two at both ends.
   * The same brief asked for gyms 1 to 3 one level lower, so those three rows'
   * gym columns move down by one at both ends: the ace sits one under the
   * party and the spread keeps its shape. The rule the column carries is
   * unchanged — a gym is never *above* the player — and `max` at `-1` is
   * inside it; what was pinned as exact parity is now pinned as a ceiling.
   */
  levelOffset: Record<BattleKind, Range>;
  /**
   * How likely each species band is in this segment. **A distribution, not a
   * window, from Stage 4.9**, for the reason `moveBandWeights` gave in 4.6b:
   * a window is a staircase and a distribution is a slope. Low bands never
   * leave the table, so the roster the player meets is the whole dex below
   * the ceiling rather than one slice of it; a high band appears early with a
   * low weight rather than not at all. The stage gate (`data/evolution.ts`)
   * is what keeps an evolved form out until the level allows it, whatever
   * its band's weight — the band says how bulky, the level says how grown.
   *
   * A band with no entry has weight zero and cannot be drawn.
   */
  speciesBandWeights: Readonly<Record<number, number>>;
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
   * keeps the top bands out of the opening segments — the same idiom
   * `tuning.tierBands` uses to keep `elite` out of them. From the five-band
   * recut that is bands 3 and up through segment 1, and band 5 until segment 5.
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
  teamAdvantage: Record<Exclude<BattleKind, 'gym'>, number>;
}

/**
 * The curve. **Rewritten at Stage 4.9**, and every number in it is a first
 * pass the simulator is asked to move; `docs/balance.md` section 0 has the
 * baseline it is read against.
 *
 * **Levels start at 15 and end at 58.** Emerald pace rather than Kaizo pace,
 * stretched: vanilla Emerald's gyms are 15, 19, 24, 29, 31, 33, 42, 46 and its
 * Champion is 58. Gyms 1 and 2 are taken from that list; the middle is
 * stretched because Emerald's own is flat — 29, 31, 33 across three gyms — and
 * the dex's final-evolution mass sits at 30 to 36 with a median of 35, so the
 * vanilla curve parks *under* the entire cluster for three gyms and shows the
 * player nothing. Gym 8 takes the Champion's 58 rather than the eighth gym's
 * 46, because this game's eighth gym is its final fight and because 46 is below
 * every pseudo-legendary's threshold: at 46 a Tyranitar or Dragonite line could
 * never finish in any run.
 *
 * Measured against the starter pool, the curve reaches 36% of lines fully
 * evolved by gym 4, 89% by gym 6 and 97% by gym 7. The two goals it misses are
 * recorded rather than chased: stage 1 by gym 2 reaches 20% (dex stage-1 levels
 * cluster at 16 to 30, and a majority needs gym 2 at about 26, which makes the
 * opening a sprint), and Tyranitar and Dragonite at a *real* dex 55 finish at
 * gym 8 rather than gym 7 — `data/evolutionThresholds.ts` may not raise a real
 * dex level, and the Dragon gym is arguably where they belong.
 *
 * **Raising the level does not soften the early swing; it sharpens it.** The
 * damage formula's level term is `floor(2L/5) + 2`, which doubles from 4 to 8
 * between level 7 and level 15, while median starter HP grows from 26 to 44 —
 * a factor of 1.69. Damage outgrows HP because the flat `+10` in the HP formula
 * dominates at very low level and stops mattering by 15. Gym 1's chance that a
 * STAB super-effective hit one-shots goes 14.2% to 22.3% across this patch: the
 * band work took it *down* to 11.3% and the level raise took it back up. The
 * curve is justified on evolution pacing and on nothing else. Accepted
 * deliberately — the counterplay is the segment's guaranteed wild encounter,
 * which is what makes catching for gym 1 a decision now that the starter is a
 * band-0 base form. `docs/reports/early-game-band-and-curve.md` section 5.
 *
 * **Both of those readings are per-slot damage statistics, and the benchmark
 * disagreed with them.** Gym 1 clears more often after this patch, not less,
 * because closing `MOVESET.stabWindow` matters more than the level term: the
 * opening fields 83/17/0 where the leak was producing 61/34/5. A likelier
 * one-shot per slot and a lower win rate are not the same measurement.
 *
 * **And the gym column went to zero in the same merge**, for a playtest
 * complaint about the same mechanic from the other side — see `levelOffset`
 * above. So a gym now sits at exactly the level this column gives the party,
 * and the stretched curve moves both of them together rather than opening a gap.
 * The two changes were built on separate branches for separate reasons and both
 * push the early game the same way; the `randomizer-19` row of
 * `docs/balance.md` is measured on the merged tree and is the only reading that
 * describes what ships.
 *
 * **Offsets still grow with level for the two node kinds that have one**, the
 * Stage 3 finding kept: wild roughly a fifth to a third below, trainer a sixth
 * to a quarter below. The old rule that every step up in team size is paid for
 * with a step down in level stays **deleted for gyms, 2026-09-15**: a gym
 * fields the player's roster (`opponentTeamSize`) and plays the hard AI at
 * every segment (`data/ai.ts`), and pays for neither.
 *
 * **The gym column is a ceiling at parity with a spread below it, 2026-09-18.**
 * Stage 4.9 made it positive and growing — +0/+1 early to +2/+4 at segment 7 —
 * and a playtest reported the consequence rather than the number: *"gyms have
 * mons at higher level than the player, which makes speed nearly impossible to
 * compete against."* The column went to a flat zero on 2026-09-17 for that, and
 * **the half of that ruling which survives is `max`.**
 *
 * The argument, unchanged: a level in Gen 3 raises every stat at once, and among
 * them Speed, which is the only stat read as a *comparison* rather than as a
 * quantity — two points of Speed and two hundred buy exactly the same thing, the
 * first move, and a gym a level above the party takes it in every tie the party
 * would otherwise win. So a gym *above* the player does not cost what it looks
 * like it costs in the damage race; it deletes a whole axis of team building,
 * since a fast Pokemon picked to outrun the exam cannot outrun it at any level
 * the player can reach. **`max` is therefore pinned at zero and is not a tuning
 * number.**
 *
 * What was wrong was `min`. Pinning the whole team at parity gave every gym
 * Pokemon the status a real gym gives exactly one of them. Nuzlocke convention
 * sets the player's cap at the leader's **ace** — so the ace is at parity by
 * definition and every other member is below it, and across all sixteen gyms of
 * FireRed and Emerald the team mean sits at **0.91** of the cap, flat, early and
 * late alike. GYMRUN's player curve is already a stretched Emerald (see below),
 * so it had taken the reference's cap numbers and then handed them to the whole
 * roster.
 *
 * `min` is `round(-0.18 x playerLevel)`, which puts the uniform-draw team mean
 * at 0.910 to 0.914 of the player's level at every segment — the reference
 * figure, to three digits. It is a rule rather than eight tuned numbers, and the
 * row is derivable from the column beside it.
 *
 * **The ace is emergent, not guaranteed, and the rule is stated as a ceiling
 * for that reason.** A uniform draw over `[min, 0]` lands nothing at `max` about
 * 56% of the time at both ends of the run — `(3/4)²` at a two-member gym 1 and
 * `(10/11)⁶` at a six-member gym 8. So the rule is *a gym is never above the
 * player, and its team mean sits at 0.91*; what pushes a member back up to the
 * cap is `rollSpec`'s clamp to its own evolution level, which is how a real gym
 * team gets its ace in the first place. See `core/randomizer.ts`.
 *
 * The exam is unchanged otherwise. `GYM_MOVE_BAND_BONUS` still gives a leader
 * one band of move power over the segment, the roster is still the player's
 * own slot count, and the AI is still the hard tier.
 *
 * **Species bands are a distribution** (see the field), with band 4 first
 * carrying weight at segment 6 so the pseudo-legendaries are a late-gym
 * exclusive; a gym draws the segment's own distribution.
 *
 * **Move bands are rewritten, and for the first time against something
 * external.** They had to be: `POWER_CUTS` went from three cuts to four, so the
 * old band 3 (76-95) splits across the new bands 3 and 4 and every row means
 * something different than it did. There was no option to hold them still.
 *
 * The shares below are fitted to what a real Pokemon actually carries at each
 * of these levels — gen-9 level-up learnsets for all 900 pool species, pre-evo
 * chains walked, scored as the four most recently learned damaging moves. That
 * measurement says two things the old table got wrong in opposite directions:
 * the opening weights were already about right (real games give 58/18 at level
 * 15 against a written 80/20, and the 61/34 this game *measured* was the STAB
 * window leaking, not the weights), and the back half was the under-specified
 * end — real gym 8 is 38% top-band and the old table had no top band to give.
 *
 * So segment 7 is the first row whose modal band is the ceiling. `gymMovePool`
 * and `segmentMoveBand` both read the mode, and ties go to the higher band, so
 * gym 8 draws and pays band 5. That is the epic conclusion, as one row.
 *
 * `docs/reports/early-game-band-and-curve.md` section 3 carries the table these
 * are fitted to and the seed counts behind the measured shares.
 */
export const SEGMENTS: readonly SegmentScaling[] = [
  {
    segment: 0,
    playerLevel: 15,
    levelOffset: { wild: { min: -5, max: -4 }, trainer: { min: -2, max: -1 }, gym: { min: -4, max: -1 } },
    speciesBandWeights: { 0: 5, 1: 1 },
    moveBandWeights: { 1: 4, 2: 1 },
    teamAdvantage: { wild: 0, trainer: 0 },
  },
  {
    segment: 1,
    playerLevel: 20,
    levelOffset: { wild: { min: -7, max: -5 }, trainer: { min: -4, max: -2 }, gym: { min: -5, max: -1 } },
    speciesBandWeights: { 0: 4, 1: 2 },
    moveBandWeights: { 1: 3, 2: 2 },
    teamAdvantage: { wild: 0, trainer: 0 },
  },
  {
    segment: 2,
    playerLevel: 26,
    levelOffset: { wild: { min: -9, max: -7 }, trainer: { min: -5, max: -3 }, gym: { min: -6, max: -1 } },
    speciesBandWeights: { 0: 2, 1: 3, 2: 2 },
    moveBandWeights: { 1: 2, 2: 3, 3: 2 },
    teamAdvantage: { wild: 0, trainer: 0 },
  },
  {
    segment: 3,
    playerLevel: 32,
    levelOffset: { wild: { min: -11, max: -8 }, trainer: { min: -7, max: -4 }, gym: { min: -6, max: 0 } },
    speciesBandWeights: { 0: 1, 1: 3, 2: 3 },
    moveBandWeights: { 1: 1, 2: 3, 3: 4 },
    teamAdvantage: { wild: 0, trainer: 0 },
  },
  {
    segment: 4,
    playerLevel: 38,
    levelOffset: { wild: { min: -13, max: -10 }, trainer: { min: -8, max: -5 }, gym: { min: -7, max: 0 } },
    speciesBandWeights: { 1: 2, 2: 3, 3: 2 },
    moveBandWeights: { 2: 2, 3: 5, 4: 1 },
    teamAdvantage: { wild: 0, trainer: 0 },
  },
  {
    segment: 5,
    playerLevel: 44,
    levelOffset: { wild: { min: -15, max: -11 }, trainer: { min: -10, max: -6 }, gym: { min: -8, max: 0 } },
    speciesBandWeights: { 1: 1, 2: 3, 3: 3 },
    moveBandWeights: { 2: 2, 3: 5, 4: 1, 5: 1 },
    teamAdvantage: { wild: 0, trainer: 0 },
  },
  {
    segment: 6,
    playerLevel: 50,
    levelOffset: { wild: { min: -17, max: -13 }, trainer: { min: -11, max: -7 }, gym: { min: -9, max: 0 } },
    speciesBandWeights: { 2: 2, 3: 3, 4: 1 },
    moveBandWeights: { 3: 4, 4: 2, 5: 2 },
    teamAdvantage: { wild: 0, trainer: 0 },
  },
  {
    segment: 7,
    playerLevel: 58,
    levelOffset: { wild: { min: -19, max: -14 }, trainer: { min: -13, max: -8 }, gym: { min: -10, max: 0 } },
    speciesBandWeights: { 2: 1, 3: 3, 4: 2 },
    moveBandWeights: { 3: 3, 4: 2, 5: 4 },
    teamAdvantage: { wild: 0, trainer: 0 },
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
  /**
   * Added to the drawn opponent level, **as a share of the player's level**,
   * rounded. Stage 4.9: at level 7 the old `elite: -3` was 43% of the level
   * and put a two-body elite at level 2; at level 47 it was the 6% it had
   * been tuned as. A share reproduces the tuned numbers where they were tuned
   * (+1 / -3 at 47 to 55) and rounds small at the bottom of the curve, where a
   * second body against a two-slot party is already the whole of the price.
   * The stretched curve starts at 15 rather than 7, so `hard`'s 0.03 now rounds
   * to 0 at gym 1 and 2 at gym 8 — the level-2 elite the share was introduced
   * to prevent cannot happen at any point on this curve.
   */
  levelShare: number;
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
  normal: { levelShare: 0, speciesBand: 0, moveBand: 0, team: 0 },
  /** A stat check: bulkier, a little higher level, hitting with the same move pool. */
  hard: { levelShare: 0.03, speciesBand: 1, moveBand: 0, team: 0 },
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
  /*
   * **Stage 4.9: elite no longer pays for its body with levels.** The share
   * was -0.06 (the old -3 at 47 to 55). With the stage gate in the draw, a
   * level discount is also a *species* discount: an elite trainer at segment 6
   * drawing at a minimum of 33 cannot field a single form that evolves at 36,
   * while the hard node beside it at 37 fields every one of them, and
   * `test/tiers.test.ts` measured elite at 99% of hard's encounter power. The
   * body, the band and the move band are the price; the level is the segment's.
   */
  elite: { levelShare: 0, speciesBand: 1, moveBand: 1, team: 1 },
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
  /**
   * How many bands **above** the drawn one a STAB-restricted slot may reach.
   *
   * **Zero, and the reason it is zero now is the reason it was one before.**
   *
   * It was added because band 1 was too thin to draw from: at 82 moves it held
   * one Psychic move and one Dragon move, so the forced first slot of those
   * species was not a draw at all — thirteen of the 191 starters opened with a
   * move the seed did not choose, and for Axew at base Attack 87 against base
   * Special Attack 30 that mandatory move was a 40 BP *special*. A dead slot,
   * handed out deterministically.
   * [`docs/reports/moveset-pool-validation.md`](../../docs/reports/moveset-pool-validation.md)
   * section 3b is that measurement.
   *
   * The fix worked and cost more than it looked like it cost. A window reaches a
   * band *up*, so segments 0-2 — written `{ 1: 4, 2: 1 }`, an 80/20 split — were
   * measured fielding **61% band 1, 34% band 2 and 5% band 3** across 600 seeds.
   * The opening was drawing from a table nobody had written, and the leak was
   * invisible at the table because it happens at the slot.
   *
   * So the window closes and the *band* widens instead, which is the same fix
   * applied to the cause rather than the symptom. `POWER_CUTS`'s first cut moved
   * 55 to 60 and band 1 went from 82 moves to 117: types whose whole band-1
   * slice is one attack category drop from six to three, and types with fewer
   * than three band-1 moves from four to two. A wider band gives the forced slot
   * a real draw *without* reaching up into power the segment is not supposed to
   * have.
   *
   * **Three types are still thin, and that is accepted rather than fixed.**
   * Psychic holds exactly one band-1 move (Confusion), Steel two, Fairy three.
   * Every Psychic species' first slot is therefore deterministic again — the
   * defect this field was added to fix, reintroduced knowingly, on the argument
   * that Psychic is a strong typing and ought to cost something to field. The
   * three type gaps the recut opens in the upper bands (band 2 has no Dragon,
   * band 4 no Bug, band 5 no Dark) are pinned in `test/data-tables.test.ts` on
   * the same terms.
   *
   * **Closing it costs no randomness either**, which is what made it a safe
   * lever in both directions: `take()` is a single `pick` whatever the size of
   * the list handed to it, so narrowing the list does not change how many times
   * the stream is read. The draw count stays a function of `MOVESET.slots`
   * alone, which is the property `rollMoveset` exists to protect.
   *
   * The lever still *not* pulled is `stabBias`: section 4 of the same report
   * measures it and declines it, because Normal is 20.7% of band 1 and every
   * slot handed back to open coverage is a one-in-five chance of the worst
   * coverage type in the game.
   *
   * One restores the windowed behaviour exactly.
   */
  stabWindow: 0,
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

/**
 * The band distribution a segment draws species from, tier applied.
 *
 * The tier shifts the whole distribution up by `TIER_MODIFIERS[tier].speciesBand`,
 * clamped at the ceiling with colliding weights summed, exactly as
 * `moveBandWeightsFor` does. A gym draws the segment's own distribution: it
 * takes no tier, and it is the segment's difficulty statement in roster, level
 * and AI rather than in bulk. **The first cut of Stage 4.9 gave the gym a
 * species band of its own, one up, the twin of `GYM_MOVE_BAND_BONUS`, and the
 * simulator killed it inside one sweep: 92.5% of deaths at gym 1, an 11% clear
 * rate, a Relicanth at level 8 against a band-0 starter. The move bonus stays;
 * the species bonus is deleted, 2026-09-15, not set to zero.**
 */
export function speciesBandWeightsFor(segment: number, tier: Tier): Readonly<Record<number, number>> {
  return shiftSpeciesWeights(segmentScaling(segment).speciesBandWeights, TIER_MODIFIERS[tier].speciesBand);
}

/** The bands a segment can actually draw species from, tier applied. Sorted, no weights. */
export function speciesBandsFor(segment: number, tier: Tier): readonly number[] {
  return Object.entries(speciesBandWeightsFor(segment, tier))
    .filter(([, weight]) => weight > 0)
    .map(([band]) => Number(band))
    .sort((a, b) => a - b);
}

function shiftSpeciesWeights(
  weights: Readonly<Record<number, number>>,
  by: number,
): Readonly<Record<number, number>> {
  if (by === 0) return weights;
  const shifted: Record<number, number> = {};
  for (const [band, weight] of Object.entries(weights)) {
    const raised = Math.max(0, Math.min(MAX_SPECIES_BAND, Number(band) + by));
    shifted[raised] = (shifted[raised] ?? 0) + weight;
  }
  return shifted;
}

/**
 * The band distribution a segment draws damaging moves from, tier applied.
 *
 * The tier shifts the whole distribution up by `TIER_MODIFIERS[tier].moveBand`,
 * clamped at the ceiling — so an `elite` node in segment 4 is mostly band 4
 * where an ordinary one is mostly band 3, and the weights keep their shape
 * rather than being replaced by a different table per tier. (`hard` shifts the
 * species band and the level, not the move band; only `elite` moves this one.)
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
 * How often an opponent walks in holding something, by segment.
 *
 * **Stage 4.6b built this for berries, and the R19 rulings widened it to held
 * items and gave it a gym column.** The name moved with the meaning: it was
 * `BERRY_HOLD_RATE`, and a table with a gym column that pays out Leftovers is
 * not a berry table. What it draws *from* is `heldItemPoolFor` in
 * `data/items.ts`; this says only how often.
 *
 * **The two original columns are unchanged, to the number.** Berries are the
 * low denomination: they matter when a health bar is small and fade as HP
 * totals scale, so an opponent holding one is a real complication in segment 1
 * and noise by segment 7. Weighting the rate the same way means the *player*
 * meets the mechanic while it still teaches something — a fight that goes one
 * turn longer than it should is how you learn to read `-enditem` on the battle
 * log. A trainer holds them far more often than a wild Pokemon: a trainer
 * prepared, a wild Pokemon is holding whatever it was holding.
 *
 * ## The gym column runs the other way, and that is the whole point
 *
 * Trainer and wild descend, 0.5 to 0.2 and 0.25 to 0.1. **Gym ascends, 0.25 to
 * 1.0**, and the two directions are not in tension — they are the same idea
 * read from both ends. The road gets less dangerous relative to the player as
 * the player's own options widen; the exam does not.
 *
 * The top of the column is not a taste call. The ruling states it as a target:
 * *"Gym 8 should have 6 mons w 6 battle items equipped"*. `opponentTeamSize`
 * gives gym 8 a roster of six (`partyCapacityAfter(7)`), so **1.0 at segment 7
 * is that sentence written as a number**, and `test/gym-held-items.test.ts`
 * asserts the sentence rather than the number.
 *
 * The superseded rule, recorded rather than deleted: *"Gym leaders are not on
 * this table and hold nothing. A gym is the segment's difficulty statement and
 * it already draws at `GYM_MOVE_BAND_BONUS`; a second dial on the same fight is
 * a dial the balance report cannot attribute."* The first half is now false by
 * decision. The second half is still true and is now a thing to watch: a gym's
 * difficulty moves on two dials, and a balance row that reads a gym clear needs
 * to say which of them moved. `docs/balance.md` is where that is recorded.
 */
export const HELD_ITEM_RATE: readonly { trainer: number; wild: number; gym: number }[] = [
  { trainer: 0.5, wild: 0.25, gym: 0.25 },
  { trainer: 0.5, wild: 0.25, gym: 0.35 },
  { trainer: 0.4, wild: 0.2, gym: 0.45 },
  { trainer: 0.4, wild: 0.2, gym: 0.6 },
  { trainer: 0.3, wild: 0.15, gym: 0.7 },
  { trainer: 0.3, wild: 0.15, gym: 0.8 },
  { trainer: 0.2, wild: 0.1, gym: 0.9 },
  // Gym 8: a full roster, every member holding. The ruling's own target.
  { trainer: 0.2, wild: 0.1, gym: 1 },
];

/**
 * The chance a `kind` opponent in this segment holds an item.
 *
 * **No kind is special-cased any more.** This function used to open with
 * `if (kind === 'gym') return 0;`, which is why the table had no gym column to
 * read; both halves of that arrangement are gone together. Every battle kind is
 * now a column, so changing how often a gym leader holds something is a number
 * in the table above rather than a branch in here.
 */
export function heldItemRate(kind: BattleKind, segment: number): number {
  const row = HELD_ITEM_RATE[Math.max(0, Math.min(HELD_ITEM_RATE.length - 1, segment))];
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
 * At +1 a gym in segment 6 draws mostly band 4 while the trainers around it draw
 * mostly band 3.
 *
 * It applies to the move band only. Level, team size and species band come from
 * the segment's own gym columns, which were tuned before this existed.
 */
export const GYM_MOVE_BAND_BONUS = 1;

/**
 * The first segment whose gym draws at `GYM_MOVE_BAND_BONUS`. **Stage 4.9.**
 *
 * At level 30 a band-2 move was the spike; at level 7, against a base form
 * with twenty HP, a 75 BP Rock Slide with STAB from a two-Pokemon leader is
 * the run. The second sweep of the stage measured gym 1 at a 28% clear rate
 * with 82% of all deaths there, to Ancient Power, Rock Slide and Rock Tomb —
 * band-2 moves the road never showed the player. Gyms 1 and 2 draw the
 * segment's own move band; the spike starts where the player's own kit has
 * begun to climb. The gym clear's *reward* still pays one band up from the
 * first gym (`rewardPools.ts`), which is what lets the kit climb at all.
 *
 * **Held at 2 through the band recut, deliberately, and it is the number to
 * look at first if gym 3 reads as a wall.** The stated reason above is a level-7
 * argument and the curve starts at 15 now, so it no longer carries its own
 * weight — but the *measurement* behind it (gym 1 at 28% clear, 82% of deaths)
 * was real, and moving two dials between one benchmark and the next is how a
 * report stops being attributable. What the recut does change is where the
 * spike lands: segment 2's own weights are `{ 1: 2, 2: 3, 3: 2 }`, so gym 3
 * draws `{ 2: 2, 3: 3, 4: 2 }` — 29% band 2, 43% band 3, 29% band 4 — against a
 * real-game reference at that level of 29/34/30/2/5. Gym 3 is the one fight in
 * the opening that sits materially *above* what a real Pokemon carries, and it
 * is recorded here rather than tuned away before the first playtest.
 *
 * **Softened from the other side by the gym column going to zero**, which
 * landed on its own branch in the same merge. A gym is at exactly the party's
 * level now, so gym 3's band spike is no longer stacked on a level advantage the
 * way it was when this note was written. The band reading above stands — it is a
 * statement about what the leader *holds* — and the fight around it is easier
 * than the numbers alone suggest. Still the first number to move if gym 3 reads
 * as a wall, and still not moved yet.
 */
export const GYM_MOVE_BAND_BONUS_FROM_SEGMENT = 2;

/** The move band bonus a gym at `segment` draws at: the spike, or nothing yet. */
export function gymMoveBandBonus(segment: number): number {
  return segment >= GYM_MOVE_BAND_BONUS_FROM_SEGMENT ? GYM_MOVE_BAND_BONUS : 0;
}

/**
 * How swingy an event node is, by segment. **The event variance ramp.**
 *
 * Each event node draws one rarity at map generation, and rarity decides which
 * tier distribution its Gamble and Attune options roll on — see
 * `data/eventPools.ts`. It is the one number that makes two question marks on
 * the same map worth different amounts before the player has read either.
 *
 * The weights tilt upward as the run goes on, for the same reason
 * `REWARD_BAND_OFFSET` exists: late segments are where a run either has the
 * resources to take a swing or is far enough behind that it has to. A flat
 * table would make the last two segments' events the least interesting nodes on
 * the map, because everything around them has been scaling for seven segments.
 *
 * Rows are read in order and the first whose `throughSegment` covers the
 * segment wins. Weights, not percentages — they are normalised at the draw.
 */
export const EVENT_RARITY_WEIGHTS: readonly {
  throughSegment: number;
  common: number;
  uncommon: number;
  rare: number;
}[] = [
  { throughSegment: 2, common: 60, uncommon: 30, rare: 10 },
  { throughSegment: 5, common: 50, uncommon: 33, rare: 17 },
  { throughSegment: 7, common: 40, uncommon: 35, rare: 25 },
];

/**
 * The rarity weights in force at this segment. **The single accessor.**
 *
 * A segment past the last row falls to the last row rather than to nothing, so
 * a `SEGMENT_COUNT` change cannot leave an event node with no rarity to draw.
 */
export function eventRarityWeights(segment: number): { common: number; uncommon: number; rare: number } {
  const row =
    EVENT_RARITY_WEIGHTS.find((entry) => segment <= entry.throughSegment) ??
    EVENT_RARITY_WEIGHTS[EVENT_RARITY_WEIGHTS.length - 1]!;
  return { common: row.common, uncommon: row.uncommon, rare: row.rare };
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
 * something else. The four rows that moved extend the *rate* the original rows
 * measured rather than inventing one: `[1, 2, 2, 3]` is roughly seven tenths of
 * a Pokemon per segment, not one — a slot is capacity and filling it takes a
 * wild encounter, there is one guaranteed per segment, and players decline.
 * Carried on from 3 at segment 3 that rate gives 3.7, 4.4, 5.1, 5.8, which is
 * the 4, 4, 5, 6 below.
 *
 * **The last row stops one short of the slot ceiling, and that is forced by the
 * engine rather than chosen.** `opponentTeamSize` is
 * `min(MAX_TEAM_SIZE, assumed + advantage)` and `MAX_TEAM_SIZE` is 6, because six
 * a side is the engine's limit. So a row of 6 leaves the clamp with no headroom
 * and **every tier collapses onto the same team size**: at segment 7 a normal, a
 * hard and an elite node would all field six, which is Stage 3's entire risk
 * gradient disappearing at the end of the run. `test/tiers.test.ts` caught it —
 * "orders normal < hard < elite at every segment" is exactly that invariant — and
 * the first cut of this table did end at 6.
 *
 * So the curve deliberately assumes **one fewer than the player may field**, and
 * the slot schedule still reaches six. A player who fills every slot is a Pokemon
 * ahead of what the last two gyms are sized for, which is a reward for having
 * filled it rather than a miscalibration: the alternative is a flat endgame where
 * the elite node and the ordinary one are the same fight.
 *
 * The rule is `EXPECTED_PARTY_SIZE[last] < MAX_TEAM_SIZE`, not the number 5, and
 * `test/party-slots.test.ts` asserts it in that form so that raising either
 * constant cannot quietly reintroduce the flat endgame.
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
 */
export function opponentTeamSize(kind: BattleKind, segment: number, tier: Tier): number {
  /*
   * **A gym fields the player's roster. Stage 4.9.** Not the measured party
   * plus an advantage — the slot count the schedule has given the run at this
   * segment (`SLOT_UNLOCK_SCHEDULE`, 2, 3, 3, 4, 4, 5, 5, 6), so gym 1 is two
   * against at most two and gym 8 is a full six. Levels rise at every gym and
   * the roster widens every other one, which is the smoother curve the stage
   * asked for; a gym takes no tier, so the clamp-headroom argument for
   * ordinary nodes (`EXPECTED_PARTY_SIZE` below) does not apply to it.
   */
  if (kind === 'gym') return Math.max(1, Math.min(MAX_TEAM_SIZE, partyCapacityAfter(segment)));
  const advantage = segmentScaling(segment).teamAdvantage[kind] + TIER_MODIFIERS[tier].team;
  return Math.max(1, Math.min(MAX_TEAM_SIZE, expectedPartySize(segment) + advantage));
}

/**
 * The opponent level band for a node kind in a segment, tier applied.
 *
 * **A gym takes no tier bonus, here rather than only at the call site.**
 * `randomizer.generateGymTeam` passes `normal` and has done since Stage 3, for
 * the reason its own note gives — a gym *is* the segment's difficulty
 * statement, and a node tier modifying it would be two dials on one number. So
 * this changes nothing today. What it changes is what a gym can become: the
 * gym column is pinned at parity because a level advantage is the one
 * difficulty lever that deletes Speed as a build axis rather than scaling it
 * (see `levelOffset`), and a rule that holds only because one caller passes one
 * argument is a rule the next caller repeals by accident.
 *
 * `hard`'s three percent is enough on its own: at segment 2 it rounds to a
 * whole level, which is the entire effect the playtest reported.
 */
export function opponentLevel(kind: BattleKind, segment: number, tier: Tier): Range {
  const row = segmentScaling(segment);
  const offset = row.levelOffset[kind];
  const bonus = kind === 'gym' ? 0 : Math.round(row.playerLevel * TIER_MODIFIERS[tier].levelShare);
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
