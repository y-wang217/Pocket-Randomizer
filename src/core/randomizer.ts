/**
 * The randomizer: how a Pokemon is rolled.
 *
 * Every function here is pure and takes an explicit `Rng`. Nothing in this file
 * reads global state, nothing caches a draw between calls, and nothing decides
 * *what* the pools contain — that is data/, and the split is the point. If a
 * balance pass ever needs to edit this file, the split has failed: the numbers
 * live in data/scaling.ts, the inventory in data/speciesPools.ts and
 * data/movePools.ts, and the exceptions in data/blacklists.ts.
 *
 * Three rules the spec is specific about, and where each one is enforced:
 *
 *   - **Species are filtered by segment, never drawn from the raw dex.** A
 *     Stage 1 gym cannot roll a pseudo-legendary because `speciesBandsFor`
 *     never returns band 4 for segment 0. See `speciesFor`.
 *   - **Abilities come from the full ability pool, not the species' legal
 *     abilities.** That is the loudest thing about a randomizer and the reason
 *     the engine runs Custom Game with no validator. See `rollAbility`.
 *   - **Every moveset has at least one damaging move.** Guaranteed by
 *     construction rather than by retry: slot one is always an attack. See
 *     `rollMoveset`.
 *
 * ## The stream
 *
 * Every draw comes from `rng.randomizer` and nothing else. That is the
 * protection against the failure mode this stage introduces: adding a draw here
 * must not shift a map shape or a damage roll for a seed recorded before the
 * change, and a Stage 3 reward draw must not shift what a species roll produced.
 * Streams are domain-separated by name in core/rng.ts, so the isolation is a
 * property of the construction rather than of discipline — but it is asserted
 * directly in test/randomizer.test.ts anyway, because it is the failure that
 * would be silent.
 *
 * ## The draw order
 *
 * Within a spec the order is: species, level, ability, then moves in slot
 * order. Within a team: member by member, in team order. Both are contracts.
 * Changing either reinterprets every recorded seed, which is what
 * `RANDOMIZER_VERSION` exists to make loud rather than silent.
 */
import type { Rng, RngStream } from './rng';
import type { Gender, PokemonSpec, TeamSpec, Tier } from './types';
import {
  isAbilityBlacklisted,
  isMoveBlacklisted,
  isSpeciesBlacklisted,
  toId,
} from '../data/blacklists';
import { ABILITY_POOL } from '../data/abilities';
import type { GymDefinition } from '../data/gyms';
import { DAMAGING_MOVES, STATUS_MOVES, type MoveEntry } from '../data/movePools';
import {
  MOVESET,
  moveBandsFor,
  opponentLevel,
  opponentTeamSize,
  speciesBandsFor,
} from '../data/scaling';
import { SPECIES_POOL, type SpeciesEntry } from '../data/speciesPools';
import { getStarterPool, STARTER_MOVE_BANDS } from '../data/starters';

/**
 * The version of *what a seed rolls*.
 *
 * Bump this whenever a change would make the same seed produce a different
 * team: a regenerated pool, a moved band window, a new draw inside
 * `rollMoveset`, a reordered data table. It is stamped into every `RunLog` and
 * checked on replay (see `assertReplayable` in core/run.ts), because a replay
 * that silently reinterprets a seed is worse than one that refuses.
 *
 * It is deliberately *not* derived from a hash of the data files. A hash would
 * fire on a comment change and would not fire on a change to draw order in
 * this file, which is exactly backwards.
 *
 * Went to 2 when the first balance pass moved the band windows and the level
 * curve in data/scaling.ts. Not one draw changed position; every seed rolled a
 * different team anyway, which is precisely the class of change this string
 * exists to catch.
 *
 * Went to 3 when Stage 3 turned tiers on. That change is worth spelling out
 * because it is the mirror image of the last one: this time draws *did* move.
 * `assignTiers` added draws to the `map` stream, so every seed's map shape
 * moved, and the tiers those draws produce feed `speciesBandsFor` and
 * `opponentLevel`, so every encounter moved with it. Despite living outside
 * this file, it is the same failure this string guards — a recorded decision
 * sequence that still replays cleanly and is no longer the run it recorded.
 *
 * Went to 4 for Stage 3's tuning pass, which is the plainest case yet: the tier
 * modifiers, the level curve, the species bands, the tier distribution and
 * `STARTER_MOVE_BANDS` all moved. Not one draw changed position and every seed
 * rolls a different run.
 */
export const RANDOMIZER_VERSION = 'gymrun-randomizer-5';

// ---------------------------------------------------------------------------
// Pools, filtered
// ---------------------------------------------------------------------------

/**
 * The species a segment may draw, at a tier.
 *
 * Blacklist filtering happens **here**, at draw time, rather than by removing
 * entries from data/speciesPools.ts. That keeps the generated pool a faithful
 * record of the dex and keeps the exceptions in one auditable file — and it
 * means un-banning something is a one-line revert rather than a regeneration.
 */
function speciesFor(segment: number, tier: Tier): SpeciesEntry[] {
  const bands = new Set(speciesBandsFor(segment, tier));
  return SPECIES_POOL.filter((entry) => bands.has(entry.band) && !isSpeciesBlacklisted(entry.id));
}

/** The species a gym may draw: its own type, its own restrictions, its segment's bands. */
function gymSpeciesFor(gym: GymDefinition, segment: number, tier: Tier): SpeciesEntry[] {
  const allow = gym.allow ? new Set(gym.allow.map(toId)) : null;
  const deny = gym.deny ? new Set(gym.deny.map(toId)) : null;

  const matching = speciesFor(segment, tier).filter(
    (entry) =>
      entry.types.includes(gym.type) &&
      (!allow || allow.has(entry.id)) &&
      (!deny || !deny.has(entry.id)),
  );
  if (matching.length > 0) return matching;

  /*
   * A gym whose type has nothing in its segment's bands.
   *
   * This should not happen — the type coverage of every band is asserted in
   * test/randomizer.test.ts — but "should not happen" is not a plan. Widening
   * to every band of the right type keeps the *identity* intact, which is the
   * promise the player was made, and gives up the *level band*, which is the
   * one the curve can absorb. Throwing here would turn a data gap into a
   * crashed run.
   */
  const anyBand = SPECIES_POOL.filter(
    (entry) =>
      entry.types.includes(gym.type) &&
      !isSpeciesBlacklisted(entry.id) &&
      (!allow || allow.has(entry.id)) &&
      (!deny || !deny.has(entry.id)),
  );
  if (anyBand.length === 0) throw new RangeError(`No species available for a ${gym.type} gym`);
  return anyBand;
}

function damagingFor(segment: number, tier: Tier): MoveEntry[] {
  return damagingInBands(moveBandsFor(segment, tier));
}

/**
 * Damaging moves in a band window, blacklist applied.
 *
 * Exported for `core/rewards.ts`, which draws TM and tutor rewards from the
 * same inventory an encounter draws from. That sharing is the point: a reward
 * that handed out moves from a separate table would be a second move pool to
 * keep balanced, and the first band change that missed one would make rewards
 * quietly stronger or weaker than the fights they are paid for.
 */
export function damagingInBands(allowed: readonly number[]): MoveEntry[] {
  const bands = new Set(allowed);
  const inBand = DAMAGING_MOVES.filter((move) => bands.has(move.band) && !isMoveBlacklisted(move.id));
  // Every band has all eighteen types (asserted in test/randomizer.test.ts), so
  // this is a guard against a blacklist emptying a window rather than a
  // routine path.
  return inBand.length > 0 ? inBand : DAMAGING_MOVES.filter((move) => !isMoveBlacklisted(move.id));
}

const STATUS_AVAILABLE: readonly MoveEntry[] = STATUS_MOVES.filter((move) => !isMoveBlacklisted(move.id));

const ABILITIES_AVAILABLE: readonly string[] = ABILITY_POOL.filter((name) => !isAbilityBlacklisted(name));

// ---------------------------------------------------------------------------
// The rolls
// ---------------------------------------------------------------------------

/**
 * An ability, from the whole pool.
 *
 * Not the species' legal abilities. Rhydon can roll Wonder Guard, Magikarp can
 * roll Levitate, and the sim takes both because GYMRUN runs Custom Game with
 * the team validator switched off (see core/battle/driver.ts). This is the
 * single line that makes it a randomizer rather than a shuffler, and
 * test/randomizer.test.ts asserts the ability does not merely survive
 * validation but actually *fires* in a battle.
 */
function rollAbility(stream: RngStream): string {
  if (ABILITIES_AVAILABLE.length === 0) throw new RangeError('Every ability is blacklisted');
  return stream.pick(ABILITIES_AVAILABLE);
}

/**
 * Four moves: at least one damaging, at least one of the species' own types.
 *
 * The shape comes from data/scaling.ts `MOVESET` and the contents from the
 * segment's move bands. Slots fill in a fixed order and duplicates are drawn
 * out rather than re-rolled, so the number of draws depends only on the number
 * of slots — a re-roll loop would make draw count depend on what was drawn,
 * which is a subtle way to make a seed's later rolls depend on its earlier ones
 * in a way nobody can reason about.
 *
 * "Type-plausible" is what `stab` buys. A pool of every move in the band would
 * be more random and less interesting: the encounter that matters is the one
 * whose typing tells you something true about what it will do.
 */
function rollMoveset(entry: SpeciesEntry, damaging: readonly MoveEntry[], stream: RngStream): string[] {
  const types = new Set(entry.types);
  const stab = damaging.filter((move) => types.has(move.type));
  const taken = new Set<string>();

  /** Draw one move from `pool`, skipping anything already taken. Null if exhausted. */
  const take = (pool: readonly MoveEntry[]): MoveEntry | null => {
    const available = pool.filter((move) => !taken.has(move.id));
    if (available.length === 0) return null;
    const move = stream.pick(available);
    taken.add(move.id);
    return move;
  };

  const moves: MoveEntry[] = [];

  // Leading slots: STAB where the species has any, otherwise open coverage. A
  // species whose types have no move in this band still gets an attack.
  for (let slot = 0; slot < MOVESET.stabSlots; slot++) {
    const move = take(stab) ?? take(damaging);
    if (move) moves.push(move);
  }

  for (let slot = moves.length; slot < MOVESET.slots; slot++) {
    const last = slot === MOVESET.slots - 1;
    // Both rolls happen on every slot whether or not the slot can use them, so
    // the draw count is a function of `MOVESET.slots` alone. Tuning
    // `statusChance` or `stabBias` is then a value change and never a
    // draw-count change, which is what keeps a tuning pass from reshuffling
    // every roll that comes after it in the same seed.
    const wantsStatus = stream.nextFloat() < MOVESET.statusChance;
    const wantsStab = stream.nextFloat() < MOVESET.stabBias;

    if (last && wantsStatus) {
      const move = take(STATUS_AVAILABLE) ?? take(damaging);
      if (move) moves.push(move);
      continue;
    }
    const move = (wantsStab ? take(stab) : null) ?? take(damaging) ?? take(STATUS_AVAILABLE);
    if (move) moves.push(move);
  }

  return moves.map((move) => move.name);
}

/**
 * Gender, from the species' own ratio. **Stage 4.5.1, and it is a relocated
 * draw rather than a new one.**
 *
 * The sim would otherwise roll this itself at team construction, with
 * `battle.sample(['M', 'F'])` — a flat coin flip that ignores `genderRatio`
 * entirely, taken from the *battle* PRNG, and therefore re-rolled every fight.
 * Rolling it here makes it a property of the Pokemon rather than of the
 * encounter, and handing the sim a concrete value short-circuits the draw it
 * was making, so the total number of draws in a run goes *down*.
 *
 * **A genderless species draws and discards.** It costs a value it cannot use,
 * which looks wasteful and is deliberate: it makes the per-Pokemon draw cost a
 * constant, so a blacklist edit that changes which species are drawable cannot
 * also change how many draws each one costs.
 *
 * Exported for `test/gender.test.ts` alone. The draw-and-discard is the part
 * worth a direct test — it is invisible from the outside, and a version that
 * skipped the draw would pass every observable assertion while quietly making
 * the draw count a function of the species pool.
 */
export function rollGender(entry: SpeciesEntry, stream: RngStream): Gender {
  const roll = stream.nextFloat();
  if (entry.maleChance === null) return null;
  return roll < entry.maleChance ? 'M' : 'F';
}

/**
 * One Pokemon.
 *
 * The draw order — species, level, ability, moves, gender — is a contract.
 * Everything that generates a team goes through here so there is exactly one
 * order to remember.
 *
 * Gender is last because it was added last (Stage 4.5.1). Position within the
 * order is arbitrary — any insertion point reshuffles every recorded seed and
 * costs the same `RANDOMIZER_VERSION` bump — so the end is the position that
 * makes the history of the contract readable.
 */
function rollSpec(
  pool: readonly SpeciesEntry[],
  damaging: readonly MoveEntry[],
  level: { min: number; max: number },
  stream: RngStream,
): PokemonSpec {
  const entry = stream.pick(pool);
  return {
    species: entry.species,
    level: Math.max(1, Math.min(100, stream.inRange(level))),
    ability: rollAbility(stream),
    moves: rollMoveset(entry, damaging, stream),
    gender: rollGender(entry, stream),
  };
}

// ---------------------------------------------------------------------------
// The public surface
// ---------------------------------------------------------------------------

/**
 * A wild encounter: one Pokemon, from the segment's bands.
 *
 * Singular by definition rather than by party size — a wild Pokemon is one
 * Pokemon. `opponentTeamSize` is still asked, so that a tier or a Stage 4
 * party change that should produce a horde produces one.
 */
export function generateWildMon(segment: number, tier: Tier, rng: Rng): PokemonSpec {
  const pool = speciesFor(segment, tier);
  const damaging = damagingFor(segment, tier);
  return rollSpec(pool, damaging, opponentLevel('wild', segment, tier), rng.randomizer);
}

/** A trainer's team. Size comes from the curve, which is a function of PARTY_SIZE. */
export function generateTrainerTeam(segment: number, tier: Tier, rng: Rng): TeamSpec {
  const pool = speciesFor(segment, tier);
  const damaging = damagingFor(segment, tier);
  const level = opponentLevel('trainer', segment, tier);
  const size = opponentTeamSize('trainer', segment, tier);

  return Array.from({ length: size }, () => rollSpec(pool, damaging, level, rng.randomizer));
}

/**
 * A gym leader's team: every member of the leader's type.
 *
 * No `tier` parameter, and that is deliberate rather than an oversight. A gym
 * is the segment's difficulty statement; letting a node tier modify it would
 * mean two dials on the same number, and the report could not tell them apart.
 */
export function generateGymTeam(gym: GymDefinition, segment: number, rng: Rng): TeamSpec {
  const tier: Tier = 'normal';
  const pool = gymSpeciesFor(gym, segment, tier);
  const damaging = damagingFor(segment, tier);
  const level = opponentLevel('gym', segment, tier);
  const size = opponentTeamSize('gym', segment, tier, gym.teamSize);

  return Array.from({ length: size }, () => rollSpec(pool, damaging, level, rng.randomizer));
}

/**
 * A wild horde, or a single wild Pokemon.
 *
 * `generateWildMon` is the spec's signature and returns one Pokemon; this is
 * what a wild *node* actually needs, because a node fights a team. At the
 * shipped curve `teamAdvantage.wild` is zero in every segment, so the two agree
 * — but a wild node that hardcoded `[generateWildMon(...)]` would be the
 * single-mon assumption written down one more time.
 */
export function generateWildTeam(segment: number, tier: Tier, rng: Rng): TeamSpec {
  const pool = speciesFor(segment, tier);
  const damaging = damagingFor(segment, tier);
  const level = opponentLevel('wild', segment, tier);
  const size = opponentTeamSize('wild', segment, tier);

  return Array.from({ length: size }, () => rollSpec(pool, damaging, level, rng.randomizer));
}

/**
 * One Pokemon for a species reward, at the player's own level.
 *
 * Not `generateWildMon`: a reward is the player's Pokemon and is rolled at the
 * player's level from the reward pool's band window, with a moveset drawn from
 * the starter's move range for exactly the reason `STARTER_MOVE_BANDS` exists —
 * a Pokemon the player will carry for the rest of the run cannot be handed the
 * kit of a segment-1 opponent.
 *
 * Gated off by `tuning.allowSpeciesRewards`; see data/rewardPools.ts for why.
 */
export function generateRewardSpecies(
  bands: readonly number[],
  level: number,
  rng: Rng,
): PokemonSpec {
  const bandSet = new Set(bands);
  const pool = SPECIES_POOL.filter((entry) => bandSet.has(entry.band) && !isSpeciesBlacklisted(entry.id));
  if (pool.length === 0) throw new RangeError(`No species available in bands ${bands.join(',')}`);
  const damaging = damagingInBands(STARTER_MOVE_BANDS);
  const stream = rng.rewards;
  const entry = stream.pick(pool);
  return {
    species: entry.species,
    level,
    ability: rollAbility(stream),
    moves: rollMoveset(entry, damaging, stream),
    gender: rollGender(entry, stream),
  };
}

/**
 * The starter options a run offers.
 *
 * Randomized like everything else, but from a *narrower* window than a wild
 * encounter of the same segment: the player carries this one Pokemon through a
 * whole segment, so a roll that cannot win is a lost run the player never had a
 * hand in. The narrowing lives in data/starters.ts, which is also Stage 5's
 * unlock seam.
 *
 * Distinct species, because three buttons showing the same Pokemon is not a
 * choice.
 */
export function generateStarters(
  count: number,
  level: number,
  rng: Rng,
  unlocked?: readonly string[],
): PokemonSpec[] {
  const pool = getStarterPool(unlocked);
  // The whole run's move range, not segment 0's. The player cannot upgrade this
  // kit until Stage 3 adds rewards; see STARTER_MOVE_BANDS for the measurement
  // that made this the largest single balance change of the stage.
  const damaging = damagingInBands(STARTER_MOVE_BANDS);
  const stream = rng.randomizer;
  const picked: PokemonSpec[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    const available = pool.filter((entry) => !seen.has(entry.id));
    if (available.length === 0) break;
    const entry = stream.pick(available);
    seen.add(entry.id);
    picked.push({
      species: entry.species,
      level,
      ability: rollAbility(stream),
      moves: rollMoveset(entry, damaging, stream),
      gender: rollGender(entry, stream),
    });
  }
  return picked;
}
