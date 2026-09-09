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
 * Every draw comes from the `randomizer` stream and nothing else. That is the
 * protection against the failure mode this stage introduces: adding a draw here
 * must not shift a map shape or a damage roll for a seed recorded before the
 * change, and a Stage 3 reward draw must not shift what a species roll produced.
 * Streams are domain-separated by name in core/rng.ts, so the isolation is a
 * property of the construction rather than of discipline — but it is asserted
 * directly in test/randomizer.test.ts anyway, because it is the failure that
 * would be silent.
 *
 * **Stage 4.6a hands these functions an `RngStream` rather than the whole
 * `Rng`.** Two things change with it. The caller now says *which* sub-stream a
 * team is rolled from — `core/encounters.ts` keys one per node — so a team
 * whose draw count changes cannot move the team next to it. And the rule that
 * the randomizer draws from one stream stops being a comment: a function handed
 * one stream has no other to reach for.
 *
 * ## The draw order
 *
 * Within a spec the order is: species, level, ability, then moves in slot
 * order. Within a team: member by member, in team order. Both are contracts.
 * Changing either reinterprets every recorded seed, which is what
 * `RANDOMIZER_VERSION` exists to make loud rather than silent.
 */
import type { RngStream } from './rng';
import type { Gender, PokemonSpec, TeamSpec, Tier } from './types';
import {
  isAbilityBlacklisted,
  isMoveBlacklisted,
  isSpeciesBlacklisted,
  toId,
} from '../data/blacklists';
import { ABILITY_POOL } from '../data/abilities';
import type { GymDefinition } from '../data/gyms';
import type { BattleKind } from '../data/tuning';
import { localeAdmits, type LocaleId } from '../data/locales';
import { DAMAGING_MOVES, STATUS_MOVES, type MoveEntry } from '../data/movePools';
import { BERRIES } from '../data/items';
import {
  berryHoldRate,
  GYM_MOVE_BAND_BONUS,
  MOVESET,
  moveBandsFor,
  moveBandWeightsFor,
  opponentLevel,
  opponentTeamSize,
  speciesBandsFor,
} from '../data/scaling';
import { bandOf, MAX_MOVE_BAND, MIN_MOVE_BAND } from '../data/moveOverrides';
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
 *
 * Went to 6 in Stage 4.5.2 for the gym clear offer, and this one is the case
 * the file's opening paragraph describes most literally: `generateSegment`
 * gained a sixth pass that draws three cards from the `rewards` stream at the
 * end of every segment. Nothing about *how* a Pokemon is rolled changed, and no
 * draw ahead of it moved — pass 6 is appended precisely so it cannot — but
 * every `rewards` draw in every segment after the first now sits one offer
 * further along the stream. A 4.5.1 log would replay cleanly and hand out
 * different cards at every node from the second segment on.
 *
 * (5 was Stage 4.5.1's relocated gender draw. See the README section on it —
 * the engine was rolling gender off the battle PRNG with a flat coin flip.)
 *
 * Went to 7 in Stage 4.6a for the keyed sub-stream refactor, and this is the
 * broadest bump the string has ever carried: **every draw in the game moved to
 * a different sequence.** Not one line of what a Pokemon *is* changed, and not
 * one draw changed position within its own function — but a draw that used to
 * be the four hundredth value off `randomizer` is now the third value off
 * `randomizer#node/s2-1-0`, so every seed rolls a different run.
 *
 * It is the bump the whole refactor was done to spend *once*. 4.6b and 4.6c add
 * draws under new keys and inside existing ones, and neither can move a draw
 * this version stamps — see `gymrun-seeds-and-mappability.md` for why that is a
 * property of the construction rather than a promise.
 *
 * The rest of 4.6a rides on the same 7: locales narrow the wild species pool,
 * a segment generates a route per offered locale, and every segment guarantees
 * a wild step. All of it lands inside the same version because it lands inside
 * the same stage — the string says "a seed recorded before this rolls something
 * else now", and one bump says that exactly as well as three.
 *
 * Went to 8 in Stage 4.6b for move banding. Three changes at once, and each
 * alone would have earned it: move bands were renumbered 0-3 to 1-4, multi-hit
 * moves are banded on what they apply in a turn rather than per hit, and a
 * moveset now draws a *band per slot* from a weighted distribution instead of
 * picking four moves out of one flat window. The third is the one that moves
 * draws: every slot costs a band draw it did not cost before, so every roll
 * after the first moveset in a seed sits somewhere new.
 */
export const RANDOMIZER_VERSION = 'gymrun-randomizer-8';

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

/**
 * The species a **wild** node may draw: its segment's bands, narrowed to the
 * locale's four types.
 *
 * Stage 4.6a, and it is the only thing a locale decides. A species qualifies on
 * either of its types, so the Marsh fields a Gyarados on Water alone — see
 * `LocaleDefinition.types` for why both-types would collapse each locale to a
 * handful of monotypes.
 *
 * The fallback is the same shape `gymSpeciesFor` uses and exists for the same
 * reason: every band carries all eighteen types (asserted in
 * test/randomizer.test.ts), so an empty window means a blacklist has emptied
 * it, and a data gap should widen the pool rather than crash a run. It is
 * asserted never to fire in practice — `test/locales.test.ts` checks that every
 * wild species across many seeds really does match its locale.
 */
function wildSpeciesFor(segment: number, tier: Tier, locale?: LocaleId): SpeciesEntry[] {
  const pool = speciesFor(segment, tier);
  if (!locale) return pool;
  const matching = pool.filter((entry) => localeAdmits(locale, entry.types));
  return matching.length > 0 ? matching : pool;
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

/** The banded pool a segment draws opponent movesets from. */
function damagingFor(segment: number, tier: Tier): BandedMovePool {
  return bandedMovePool(segment, tier);
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
  const inBand = DAMAGING_AVAILABLE.filter((move) => bands.has(bandOf(move) ?? 0));
  // Every band has all eighteen types (asserted in test/randomizer.test.ts), so
  // this is a guard against a blacklist emptying a window rather than a
  // routine path.
  return inBand.length > 0 ? inBand : [...DAMAGING_AVAILABLE];
}

/** Every damaging move the blacklist allows. The base every pool filters. */
const DAMAGING_AVAILABLE: readonly MoveEntry[] = DAMAGING_MOVES.filter(
  (move) => !isMoveBlacklisted(move.id),
);

/**
 * Damaging moves in one band, memoized.
 *
 * A pure function of two constant tables, asked once per move slot — four times
 * per Pokemon, fifty-odd Pokemon per segment — so the cache is the difference
 * between filtering four hundred moves twice per member and doing it four times
 * per run.
 */
const BY_BAND = new Map<number, readonly MoveEntry[]>();

function damagingInBand(band: number): readonly MoveEntry[] {
  const cached = BY_BAND.get(band);
  if (cached) return cached;
  const pool = DAMAGING_AVAILABLE.filter((move) => bandOf(move) === band);
  BY_BAND.set(band, pool);
  return pool;
}

/**
 * What a segment draws its damaging moves from: the bands, their weights, and
 * everything as a fallback.
 *
 * **Stage 4.6b, and it replaces a flat pool.** A moveset used to be four picks
 * from one filtered list; it is now four picks each preceded by a band draw, so
 * a segment "mostly band 3, some band 2" produces a Pokemon with a band-2 move
 * beside its band-3 ones rather than a Pokemon that is uniformly one or the
 * other. The ramp is a property of each moveset, not only of the population.
 */
export interface BandedMovePool {
  weights: Readonly<Record<number, number>>;
  /** Every move in any band this pool can draw. The fallback, and rewards' view. */
  all: readonly MoveEntry[];
}

/**
 * A pool over a fixed set of bands, weighted evenly.
 *
 * What a starter draws from, and a species reward: neither belongs to a
 * segment's ramp — a starter is the run's opening position and a reward card is
 * paid at the level of the card, not of the map. Even weights because there is
 * no ramp to express: `STARTER_MOVE_BANDS` says which bands, and this says they
 * are equally likely.
 */
export function flatPool(bands: readonly number[]): BandedMovePool {
  const weights: Record<number, number> = {};
  for (const band of bands) weights[band] = 1;
  return { weights, all: damagingInBands(bands) };
}

export function bandedMovePool(segment: number, tier: Tier): BandedMovePool {
  const weights = moveBandWeightsFor(segment, tier);
  return { weights, all: damagingInBands(moveBandsFor(segment, tier)) };
}

/**
 * A gym leader's pool: the segment's distribution, one band higher.
 *
 * `GYM_MOVE_BAND_BONUS` is the whole of the gym difficulty spike and it is one
 * number in `data/scaling.ts`. Applied here rather than by passing a tier,
 * because a gym takes no tier — see `generateGymTeam`.
 */
export function gymMovePool(segment: number): BandedMovePool {
  const weights = moveBandWeightsFor(segment, 'normal');
  const shifted: Record<number, number> = {};
  for (const [band, weight] of Object.entries(weights)) {
    const raised = Math.min(MAX_MOVE_BAND, Number(band) + GYM_MOVE_BAND_BONUS);
    shifted[raised] = (shifted[raised] ?? 0) + Number(weight);
  }
  return { weights: shifted, all: damagingInBands(Object.keys(shifted).map(Number)) };
}

/**
 * One band, drawn from a weighted distribution. **Exactly one draw, always.**
 *
 * The same walk `sampleWeighted` in `core/encounters.ts` uses, and the same
 * rule: one `nextFloat` per pick whatever the weights are, so retuning
 * `moveBandWeights` changes which band a slot gets and never how many draws the
 * moveset costs.
 */
function drawBand(weights: Readonly<Record<number, number>>, stream: RngStream): number {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = stream.nextFloat() * total;
  let chosen = entries.at(-1)?.[0];
  for (const [band, weight] of entries) {
    roll -= weight;
    if (roll < 0) {
      chosen = band;
      break;
    }
  }
  return chosen === undefined ? MIN_MOVE_BAND : Number(chosen);
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
function rollMoveset(entry: SpeciesEntry, pool: BandedMovePool, stream: RngStream): string[] {
  const types = new Set(entry.types);
  const taken = new Set<string>();

  /** Draw one move from `from`, skipping anything already taken. Null if exhausted. */
  const take = (from: readonly MoveEntry[]): MoveEntry | null => {
    const available = from.filter((move) => !taken.has(move.id));
    if (available.length === 0) return null;
    const move = stream.pick(available);
    taken.add(move.id);
    return move;
  };

  /**
   * One slot's band, then one move from it.
   *
   * The band draw happens on **every** slot, including the ones that go on to
   * take a status move and ignore it. That is what keeps the draw count a
   * function of `MOVESET.slots` alone: a version that only drew a band when it
   * needed one would make the number of draws depend on the status coin flip,
   * and every roll after it in the seed would move with `statusChance`.
   */
  const takeDamaging = (stabOnly: boolean): MoveEntry | null => {
    const band = drawBand(pool.weights, stream);
    const inBand = damagingInBand(band);
    const from = stabOnly ? inBand.filter((move) => types.has(move.type)) : inBand;
    // Falls back out of the band before it falls back out of STAB: a species
    // with no in-band move of its own types should still hit something hard,
    // and a band is a strength statement where STAB is a flavour one.
    return take(from) ?? take(inBand) ?? take(pool.all);
  };

  const moves: MoveEntry[] = [];

  // Leading slots: STAB where the species has any, otherwise open coverage. A
  // species whose types have no move in this band still gets an attack.
  for (let slot = 0; slot < MOVESET.stabSlots; slot++) {
    const move = takeDamaging(true);
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
      // The band draw still happens, and is discarded — see `takeDamaging`.
      drawBand(pool.weights, stream);
      const move = take(STATUS_AVAILABLE) ?? take(pool.all);
      if (move) moves.push(move);
      continue;
    }
    const move = takeDamaging(wantsStab) ?? take(STATUS_AVAILABLE);
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
 * A held berry, or nothing. **Exactly one draw either way.**
 *
 * Stage 4.6b, appended to the spec draw order for the reason gender was: any
 * insertion point reshuffles every recorded seed and costs the same version
 * bump, so the end is the position that makes the history readable.
 *
 * The draw happens whether or not the rate can succeed — a gym's rate is zero
 * and it still costs a value — so the per-Pokemon draw count is a constant and
 * retuning `BERRY_HOLD_RATE` cannot move a single roll that follows it. That is
 * the same rule `rollGender` follows for a genderless species, and the same one
 * `drawBand` follows for a slot that ends up taking a status move.
 *
 * Two draws rather than one, and the second is spent unconditionally for the
 * same reason: which berry is a separate question from whether, and folding
 * them into one weighted pick over "nothing plus fifteen berries" would make
 * the count depend on the outcome.
 */
function rollBerry(kind: BattleKind, segment: number, stream: RngStream): string | undefined {
  const roll = stream.nextFloat();
  const berry = stream.pick(BERRIES);
  return roll < berryHoldRate(kind, segment) ? berry.id : undefined;
}

/**
 * One Pokemon.
 *
 * The draw order — species, level, ability, moves, gender, berry — is a
 * contract.
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
  damaging: BandedMovePool,
  level: { min: number; max: number },
  stream: RngStream,
  holding?: { kind: BattleKind; segment: number },
): PokemonSpec {
  const entry = stream.pick(pool);
  const spec: PokemonSpec = {
    species: entry.species,
    level: Math.max(1, Math.min(100, stream.inRange(level))),
    ability: rollAbility(stream),
    moves: rollMoveset(entry, damaging, stream),
    gender: rollGender(entry, stream),
  };
  /*
   * The berry draw is skipped entirely for a Pokemon nobody is holding one
   * for — a starter, and (before 4.6b removed it) a reward species.
   *
   * That is a *different* rule from the draw-and-discard inside `rollBerry`,
   * and the distinction matters: within a population that can hold berries the
   * count is constant, so the rate is free to move. A starter is not in that
   * population at all, and giving it a discarded draw would be paying for a
   * question nobody asked.
   */
  if (!holding) return spec;
  const item = rollBerry(holding.kind, holding.segment, stream);
  return item ? { ...spec, item } : spec;
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
export function generateWildMon(
  segment: number,
  tier: Tier,
  stream: RngStream,
  locale?: LocaleId,
): PokemonSpec {
  const pool = wildSpeciesFor(segment, tier, locale);
  const damaging = damagingFor(segment, tier);
  return rollSpec(pool, damaging, opponentLevel('wild', segment, tier), stream, {
    kind: 'wild',
    segment,
  });
}

/** A trainer's team. Size comes from the curve, which is a function of PARTY_SIZE. */
export function generateTrainerTeam(segment: number, tier: Tier, stream: RngStream): TeamSpec {
  const pool = speciesFor(segment, tier);
  const damaging = damagingFor(segment, tier);
  const level = opponentLevel('trainer', segment, tier);
  const size = opponentTeamSize('trainer', segment, tier);

  return Array.from({ length: size }, () =>
    rollSpec(pool, damaging, level, stream, { kind: 'trainer', segment }),
  );
}

/**
 * A gym leader's team: every member of the leader's type.
 *
 * No `tier` parameter, and that is deliberate rather than an oversight. A gym
 * is the segment's difficulty statement; letting a node tier modify it would
 * mean two dials on the same number, and the report could not tell them apart.
 */
export function generateGymTeam(gym: GymDefinition, segment: number, stream: RngStream): TeamSpec {
  const tier: Tier = 'normal';
  const pool = gymSpeciesFor(gym, segment, tier);
  /*
   * The one place a move pool is not the segment's own: a gym leader draws one
   * band higher (`GYM_MOVE_BAND_BONUS`). That is the difficulty spike, and it
   * is a move band rather than a tier because a gym takes no tier — see this
   * function's own note on why.
   */
  const damaging = gymMovePool(segment);
  const level = opponentLevel('gym', segment, tier);
  const size = opponentTeamSize('gym', segment, tier, gym.teamSize);

  // `holding` is passed even though a gym's rate is zero, so a gym member costs
  // the same draws as any other opponent and the table is the only thing
  // deciding what it holds.
  return Array.from({ length: size }, () =>
    rollSpec(pool, damaging, level, stream, { kind: 'gym', segment }),
  );
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
export function generateWildTeam(
  segment: number,
  tier: Tier,
  stream: RngStream,
  locale?: LocaleId,
): TeamSpec {
  const pool = wildSpeciesFor(segment, tier, locale);
  const damaging = damagingFor(segment, tier);
  const level = opponentLevel('wild', segment, tier);
  const size = opponentTeamSize('wild', segment, tier);

  return Array.from({ length: size }, () =>
    rollSpec(pool, damaging, level, stream, { kind: 'wild', segment }),
  );
}

/*
 * `generateRewardSpecies` was here and went with the species reward card in
 * Stage 4.6b. It was the second path by which a Pokemon could come into
 * existence — rolled at the player's level, from the reward pool's band window,
 * with a starter's move range — and the first divergence between it and
 * `generateWildTeam` would have been invisible. Capture reads back a species
 * the map already generated, so there is one path again.
 */

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
  stream: RngStream,
  unlocked?: readonly string[],
): PokemonSpec[] {
  const pool = getStarterPool(unlocked);
  // The whole run's move range, not segment 0's. The player cannot upgrade this
  // kit until Stage 3 adds rewards; see STARTER_MOVE_BANDS for the measurement
  // that made this the largest single balance change of the stage.
  const damaging = flatPool(STARTER_MOVE_BANDS);
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
