/**
 * The sim adapter. This is the ONLY file in the repo that imports @pkmn/sim
 * (format.ts shares the import for its dex lookup, and nothing else may).
 *
 * We are not writing a battle engine. Pokemon Showdown's engine is the
 * reference implementation of thirty years of mechanics and reimplementing any
 * part of it would be a slow way to be wrong. What this file does instead is
 * translate: TeamSpec in, sim `PokemonSet` out; sim `Pokemon` in, `BattleView`
 * out; `Choice` in, `"move 3"` out. Everything above this file speaks
 * core/types.ts and never sees a protocol string or a sim object.
 */
import { Battle, Dex, extractChannelMessages } from '@pkmn/sim';
import type { Pokemon as SimPokemon, PokemonSet, SideID } from '@pkmn/sim';

import type { RngStream, SimSeed } from '../rng';
import { createRng } from '../rng';
import {
  BOOST_NAMES,
  emptyStatStages,
  opposingSide,
  type ActiveView,
  type BattleResult,
  type BattleView,
  type BoostName,
  type Choice,
  type BattleLog,
  type Decision,
  type Gender,
  type ItemId,
  type MoveSpec,
  type MoveState,
  type MoveView,
  type PokemonState,
  type SideId,
  type StatName,
  type StatStages,
  type StatusName,
  type PokemonSpec,
  type SwitchView,
  type TeamSpec,
} from '../types';
import { GYMRUN_GEN, TURN_LIMIT, gymrunFormat } from './format';
import type { Policy } from './policy';
import { statsAtLevel } from './stats';
import { rejectionReason } from './switching';
import type { ActiveFacts, BattleFacts, MoveFacts } from './view';

/**
 * Bumped whenever a change would make an older RunLog replay differently.
 *
 * `0.2.0` is Stage 4. A battle log now carries voluntary switches, which
 * consume turns and battle-stream rolls that a Stage 3 log never spent, so the
 * same decision sequence replayed against this build would be a different
 * battle rather than the same one. That is the failure the version exists to
 * refuse.
 *
 * `0.3.0` is Stage 4.5.1, and the cause is one line in `toPokemonSet`. Specs
 * now carry a gender, and a named gender short-circuits the
 * `battle.sample(['M', 'F'])` the sim was making per Pokemon at team
 * construction. Every battle stream is therefore offset by one draw per
 * gendered body on both sides — the same decisions, a different battle, from
 * the very first turn.
 */
export const ENGINE_VERSION = 'gymrun-0.3.0';

const SIDES: readonly SideId[] = ['p1', 'p2'];
const VALID_STATUSES: readonly string[] = ['brn', 'par', 'slp', 'frz', 'psn', 'tox'];

// ---------------------------------------------------------------------------
// TeamSpec -> sim
// ---------------------------------------------------------------------------

/**
 * Turn a declarative spec into the sim's `PokemonSet`.
 *
 * Note what is *not* here: no export-string parsing, no legality check. Custom
 * Game applies no team validator, so a spec asking for Magikarp with Levitate
 * and Boomburst gets exactly that. Stage 2's randomizer depends on it.
 *
 * EVs, IVs and natures are out of scope for Stage 0, so every Pokemon gets the
 * neutral baseline: Serious nature, 31 IVs, 0 EVs. That is deliberate — it also
 * means the AI's damage estimate of the opponent is exact rather than a guess,
 * which keeps Stage 0's AI honest without giving it hidden information.
 */
export function toPokemonSet(spec: PokemonSpec): PokemonSet {
  return {
    name: spec.nickname ?? spec.species,
    species: spec.species,
    item: spec.item ?? '',
    ability: spec.ability,
    moves: spec.moves.slice(0, 4),
    nature: 'Serious',
    /*
     * The spec's gender, or the sim's own coin flip when nothing rolled one.
     *
     * **A concrete value here removes a draw from the battle PRNG**, which is
     * why this line moved a whole `ENGINE_VERSION`. Showdown assigns an unnamed
     * gender with `battle.sample(['M', 'F'])` at team construction, so every
     * gendered Pokemon on both sides used to consume one value before the
     * battle started. Naming it short-circuits that branch — the stream is
     * shorter by one draw per Pokemon, and every recorded battle log replays
     * differently.
     *
     * `null` is genderless and maps to `''`, which is what the sim expects: it
     * falls through to `species.gender` ('N'), recognises it, and consumes no
     * draw. `undefined` — a spec built by hand in a test — also maps to `''`
     * and gets the sim's flip for a gendered species, which is the old
     * behaviour and is fine for a spec nobody replays.
     */
    gender: spec.gender ?? '',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: spec.level,
    shiny: false,
    happiness: 255,
  };
}

function toTeam(spec: TeamSpec): PokemonSet[] {
  return spec.map(toPokemonSet);
}

// ---------------------------------------------------------------------------
// Spec vitals: what a spec's HP and PP *are*, before a battle exists
// ---------------------------------------------------------------------------

/** The derived numbers a party member needs before it has ever fought. */
export interface SpecVitals {
  maxHp: number;
  moves: MoveState[];
}

/**
 * Everything a screen needs to show a Pokemon it cannot fight yet.
 *
 * The starter select has to render types, base powers and PP for three
 * Pokemon that have never been in a battle, and `ui/` may not import the sim.
 * So the adapter answers the question, in the display types `ui/` already
 * speaks — `MoveView` is the same shape the move buttons take mid-battle, so
 * a starter card and a move button read the same data.
 */
export interface SpecCard {
  species: string;
  name: string;
  level: number;
  /**
   * The spec's own gender, carried straight through.
   *
   * **Not read off the probe battle, and the distinction matters.** The probe
   * runs on a fixed seed, so asking it would give every Pokemon in the game the
   * same answer for its species — and a different one from whatever the real
   * battle shows. The spec is the source of truth outside a battle; `undefined`
   * (a hand-built spec that nobody rolled a gender for) reads as genderless
   * here rather than inventing one.
   */
  gender: Gender;
  ability: string;
  /** The ability's dex id, so a screen can raise its tooltip. */
  abilityId: string;
  types: string[];
  maxHp: number;
  /**
   * The five boostable stats at this level, as the sim computed them.
   *
   * **Read off the probe rather than recomputed**, for the reason the rest of
   * this function exists: the stat formula is five lines this repo could be
   * subtly wrong about forever, and `describeSpecCard` already has a fully
   * constructed Pokemon to ask. The party screen shows these; the battle panel
   * shows the live ones off `ActiveFacts`, which include stat stages.
   *
   * HP is not here. It is `maxHp`, because HP-the-stat and HP-the-resource are
   * the same number outside a battle.
   */
  baseStatsAtLevel: Record<StatName, number>;
  moves: MoveView[];
}

const vitalsCache = new Map<string, SpecCard>();

/** A fixed seed: nothing is ever rolled here, but Battle wants one. */
const PROBE_SEED: SimSeed = `sodium,${'0'.repeat(64)}`;

/**
 * Max HP and max PP for a spec, asked of the engine rather than recomputed.
 *
 * The HP formula and the "x8/5 for three PP Ups" rule are both things this
 * repo could reimplement in ten lines and be subtly wrong about forever
 * (Shedinja, moves flagged `noPPBoosts`, a generation change when the gen-lock
 * lands). So instead: build a `Battle`, hand it the team, and *never start it*.
 * `setPlayer` fully constructs the side's Pokemon — stats, HP, move slots — and
 * only starts the battle once both sides exist. Reading a half-built battle is
 * the cheapest exact answer available, and the result is cached because
 * building one is not free.
 */
export function describeSpec(spec: PokemonSpec): SpecVitals {
  const card = describeSpecCard(spec);
  return {
    maxHp: card.maxHp,
    moves: card.moves.map((move) => ({ id: move.id, name: move.name, pp: move.pp, maxPp: move.maxPp })),
  };
}

/** The full card. Same probe, same cache; `describeSpec` is the narrow view of it. */
export function describeSpecCard(spec: PokemonSpec): SpecCard {
  const key = JSON.stringify([spec.species, spec.ability, spec.moves, spec.level, spec.item ?? '']);
  const cached = vitalsCache.get(key);
  if (cached) return cached;

  const format = gymrunFormat();
  const battle = new Battle({ format, formatid: format.id, seed: PROBE_SEED, strictChoices: true });
  battle.setPlayer('p1', { name: 'Probe', team: [toPokemonSet(spec)] });
  const mon = battle.sides[0]?.pokemon[0];
  if (!mon) throw new Error(`Could not describe ${spec.species}`);

  const dex = Dex.forGen(GYMRUN_GEN);
  const card: SpecCard = {
    species: mon.species.name,
    name: mon.name,
    level: mon.level,
    gender: spec.gender ?? null,
    ability: dex.abilities.get(mon.ability).name,
    abilityId: dex.abilities.get(mon.ability).id,
    types: mon.getTypes(),
    maxHp: mon.maxhp,
    baseStatsAtLevel: {
      atk: mon.storedStats.atk,
      def: mon.storedStats.def,
      spa: mon.storedStats.spa,
      spd: mon.storedStats.spd,
      spe: mon.storedStats.spe,
    },
    moves: mon.moveSlots.map((slot, index) => {
      const data = dex.moves.get(slot.id);
      return {
        slot: index + 1,
        id: slot.id,
        name: slot.move,
        type: data.type,
        category: data.category,
        basePower: data.basePower,
        accuracy: data.accuracy,
        pp: slot.pp,
        maxPp: slot.maxpp,
        usable: true,
      };
    }),
  };
  battle.destroy();
  vitalsCache.set(key, card);
  return card;
}

/**
 * One move, described without a Pokemon to hold it.
 *
 * For the reward and replacement screens, which have to show an *offer* — a
 * move nobody knows yet — next to four moves somebody does. Both sides come out
 * of the same dex read here, so a Thunderbolt on a reward card carries the same
 * type, base power, category and PP as the Thunderbolt on the battle screen.
 * Part 5's rule is that a move looks identical everywhere the player sees it,
 * and two lookup paths is how that stops being true.
 *
 * **`maxPp` is asked of the engine rather than computed, and the first attempt
 * at computing it was wrong within four moves.** The x8/5 three-PP-Ups rule
 * looks like two lines until Trump Card, which the sim excludes by *id* on the
 * line next to `noPPBoosts` (`sim/pokemon.ts`: `move.noPPBoosts || move.id ===
 * 'trumpcard' ? 0 : 3`). A reimplementation gets 8 where the battle gets 5, and
 * the reward card then advertises PP the move will never have. That is the
 * exact failure the header of this file describes: ten lines this repo could be
 * subtly wrong about forever.
 *
 * So it goes through `describeSpecCard`, which builds a real half-started
 * battle and reads the move slot the sim constructed. The probe species is
 * arbitrary and irrelevant — Custom Game applies no team validator, so anything
 * can be handed any move — and the result is cached by that function, so the
 * cost is one battle per distinct move for the life of the process.
 */
export function describeMove(nameOrId: string): MoveSpec | null {
  const data = Dex.forGen(GYMRUN_GEN).moves.get(nameOrId);
  if (!data.exists) return null;

  const probe = describeSpecCard({
    species: PP_PROBE_SPECIES,
    ability: PP_PROBE_ABILITY,
    moves: [data.name],
    level: 50,
  });
  const slot = probe.moves[0];
  if (!slot) return null;

  return {
    id: slot.id,
    name: slot.name,
    type: slot.type,
    category: slot.category,
    basePower: slot.basePower,
    accuracy: slot.accuracy,
    maxPp: slot.maxPp,
  };
}

/**
 * The body `describeMove` hands its move to. Nothing about it is read.
 *
 * A plain single-form species with no signature move and no form change, so
 * that nothing about the *holder* can affect the move slot the sim builds.
 */
const PP_PROBE_SPECIES = 'Ditto';
const PP_PROBE_ABILITY = 'Limber';

// ---------------------------------------------------------------------------
// sim -> BattleView
// ---------------------------------------------------------------------------

/**
 * Whether a dex effect implements a given event handler.
 *
 * `Ability` in @pkmn/sim's typings is the metadata half of the object — name,
 * rating, flags — while the handlers arrive at runtime from `AbilityData`,
 * which the class does not re-declare. So this is a narrow structural read
 * rather than a property access, cast through `unknown` rather than `any`
 * because core/ bans `any` and exactly one field is needed.
 */
function hasHandler(effect: object, handler: string): boolean {
  return typeof (effect as Record<string, unknown>)[handler] === 'function';
}

function readStatStages(pokemon: SimPokemon): StatStages {
  const stages = emptyStatStages();
  for (const name of BOOST_NAMES) {
    stages[name] = pokemon.boosts[name as BoostName] ?? 0;
  }
  return stages;
}

function readStatus(pokemon: SimPokemon): StatusName | null {
  const status = pokemon.status as string;
  return VALID_STATUSES.includes(status) ? (status as StatusName) : null;
}

function toActiveView(pokemon: SimPokemon, revealAbility: boolean): ActiveView {
  const maxHp = pokemon.maxhp || 1;
  return {
    species: pokemon.species.name,
    name: pokemon.name,
    level: pokemon.level,
    types: pokemon.getTypes(),
    hp: pokemon.hp,
    maxHp: pokemon.maxhp,
    hpFraction: Math.max(0, Math.min(1, pokemon.hp / maxHp)),
    status: readStatus(pokemon),
    statStages: readStatStages(pokemon),
    fainted: pokemon.fainted,
    ability: revealAbility ? Dex.forGen(GYMRUN_GEN).abilities.get(pokemon.ability).name : null,
  };
}


// ---------------------------------------------------------------------------
// sim -> BattleFacts (the battle screen's projection input)
// ---------------------------------------------------------------------------

/**
 * One side's active Pokemon as the plain data `core/battle/view.ts` consumes.
 *
 * The split of responsibility is the point. This function reads the engine and
 * emits numbers; `view.ts` decides what the player is allowed to see and how it
 * reads. That is why the ability and item are reported *unconditionally* here
 * and gated there — a projection that could not see the ability could not
 * decide to hide it, and the `revealed` flag on the way out would have nothing
 * behind it.
 *
 * `own` selects where the stat spread comes from, and the asymmetry is the one
 * the protocol imposes:
 *
 *   - **Your side**: `storedStats`, which is byte-for-byte what the `|request|`
 *     payload carries in `side.pokemon[].stats`. Read off the Pokemon rather
 *     than off the request because the request is absent between turns and the
 *     panel still has to render; `test/stats.test.ts` asserts the two agree.
 *   - **The opponent**: computed by `stats.ts` from species base stats and
 *     level. The protocol sends nothing, and in a game with one fixed spread
 *     the computation is exact rather than an estimate. `test/stats.test.ts`
 *     cross-checks it against the engine over a sweep of species and levels, so
 *     the two paths cannot drift apart silently.
 */
function toActiveFacts(pokemon: SimPokemon, own: boolean): ActiveFacts {
  const dex = Dex.forGen(GYMRUN_GEN);
  const base = pokemon.species.baseStats;
  const level = pokemon.level;

  const computed = statsAtLevel(base, level, pokemon.species.maxHP);
  const stats: Record<StatName, number> = own
    ? {
        atk: pokemon.storedStats.atk,
        def: pokemon.storedStats.def,
        spa: pokemon.storedStats.spa,
        spd: pokemon.storedStats.spd,
        spe: pokemon.storedStats.spe,
      }
    : { atk: computed.atk, def: computed.def, spa: computed.spa, spd: computed.spd, spe: computed.spe };

  const ability = pokemon.ability ? dex.abilities.get(pokemon.ability) : null;
  const item = pokemon.item ? dex.items.get(pokemon.item) : null;

  return {
    species: pokemon.species.name,
    name: pokemon.name,
    level,
    // The sim reports genderless as an empty string; the display layer wants a
    // value it can branch on, and `null` is the one `Gender` names.
    gender: pokemon.gender === 'M' || pokemon.gender === 'F' ? pokemon.gender : null,
    types: pokemon.getTypes(),
    hp: pokemon.hp,
    maxHp: pokemon.maxhp,
    fainted: pokemon.fainted,
    status: readStatus(pokemon),
    stats,
    baseStats: { atk: base.atk, def: base.def, spa: base.spa, spd: base.spd, spe: base.spe },
    boosts: readStatStages(pokemon),
    volatiles: Object.keys(pokemon.volatiles),
    ability: ability?.exists ? { id: ability.id, name: ability.name } : null,
    item: item?.exists ? { id: item.id, name: item.name } : null,
    speed: {
      /*
       * The engine's own answer, not a reimplementation.
       *
       * `getStat('spe')` runs the `ModifySpe` event, which is where paralysis,
       * Choice Scarf, Swift Swim, Chlorophyll, Quick Feet, Unburden, Slow Start
       * and every other speed modifier in the generation actually live. The
       * speed readout is the highest-value thing on the battle screen and it is
       * worthless the moment it disagrees with the turn order it describes, so
       * it is asked rather than derived.
       */
      engine: pokemon.getStat('spe'),
      /*
       * Whether an ability is contributing to that number.
       *
       * Every speed-modifying ability in the generation implements
       * `onModifySpe`, including Quick Feet — which cancels the paralysis cut
       * from inside the same event — so one check covers the whole set. It
       * exists only so `view.ts` can refuse to leak a hidden ability through
       * the speed arrow; at the default tuning the ability is revealed and this
       * flag is never read.
       */
      abilityModified: !!ability?.exists && hasHandler(ability, 'onModifySpe'),
    },
  };
}

/**
 * The moves offered this turn, read off the sim's own choice request rather
 * than off the Pokemon's move slots.
 *
 * This matters: the request is what the sim will actually accept. It already
 * accounts for Disable, Choice lock, Encore, Torment, zero PP, and the
 * Struggle substitution. Rebuilding that logic from move slots is how a UI
 * ends up offering a move the engine then rejects.
 */
function readMoves(battle: Battle, side: SideId): MoveView[] {
  const request = battle.sides[sideIndex(side)]?.activeRequest;
  if (!request || !('active' in request) || !request.active) return [];
  const active = request.active[0];
  if (!active) return [];

  return active.moves.map((entry, index) => {
    const data = Dex.forGen(GYMRUN_GEN).moves.get(entry.id);
    const maxPp = entry.maxpp ?? 0;
    return {
      slot: index + 1,
      id: entry.id,
      name: entry.move,
      type: data.type,
      category: data.category,
      basePower: data.basePower,
      accuracy: data.accuracy,
      pp: entry.pp ?? maxPp,
      maxPp,
      usable: !entry.disabled && (entry.pp === undefined || entry.pp > 0),
    };
  });
}

/**
 * Whether the sim will refuse to let this side switch out, and why.
 *
 * **Reads both `trapped` and `maybeTrapped`, and the second one is the whole
 * reason this is a function.** The sim sets `trapped` when the thing holding
 * you is public knowledge and `maybeTrapped` when it is not — an unrevealed
 * Arena Trap reports the latter, which is a client's cue to offer the switch
 * and let the server say no. This driver runs with `strictChoices`, where a
 * refused choice is a thrown error in the middle of a battle, so it has to
 * treat both as blocking. `battle/switching.ts` records what that trades away.
 *
 * Null outside a choice request, and null on a forced switch: trapping does not
 * apply when the active Pokemon has already fainted.
 */
function readTrapping(request: unknown): 'trapped' | 'maybe-trapped' | null {
  if (!request || typeof request !== 'object') return null;
  if ('forceSwitch' in request) return null;
  if (!('active' in request)) return null;
  const active = (request as { active?: ({ trapped?: boolean; maybeTrapped?: boolean } | null)[] }).active?.[0];
  if (!active) return null;
  if (active.trapped) return 'trapped';
  return active.maybeTrapped ? 'maybe-trapped' : null;
}

/**
 * The side's bench, as a policy may see it.
 *
 * Read off the live `side.pokemon` array rather than off the request, because
 * `switch N` is an index into *that* array and the sim reorders it on every
 * switch — the Pokemon that came in moves to index 0. Deriving the slot from
 * anything else is a choice the sim will reject on the second switch of a
 * battle and accept on the first, which is the worst kind of bug to find.
 *
 * `usable` means "the sim would accept `switch N` right now", and `block` says
 * which of the four reasons it does not. Trapping is honoured — a randomizer
 * that rolls Arena Trap onto anything will produce trapped turns — but only
 * outside a forced switch, where it does not apply.
 */
function readSwitches(battle: Battle, side: SideId): SwitchView[] {
  const simSide = battle.sides[sideIndex(side)];
  if (!simSide) return [];
  const trapping = readTrapping(simSide.activeRequest);
  const dex = Dex.forGen(GYMRUN_GEN);

  return simSide.pokemon.map((mon, index) => {
    const maxHp = mon.maxhp || 1;
    // Ordered so the reason the player can see wins: a fainted member reads as
    // fainted even on a turn where the whole side is also trapped.
    const block: SwitchView['block'] = mon.fainted
      ? 'fainted'
      : mon.isActive
        ? 'active'
        : trapping;
    return {
      slot: index + 1,
      species: mon.species.name,
      name: mon.name,
      level: mon.level,
      gender: mon.gender === 'M' || mon.gender === 'F' ? mon.gender : null,
      types: mon.getTypes(),
      ability: dex.abilities.get(mon.ability).name,
      moves: mon.moveSlots.map((slot) => slot.id),
      hp: mon.hp,
      maxHp: mon.maxhp,
      hpFraction: Math.max(0, Math.min(1, mon.hp / maxHp)),
      status: readStatus(mon),
      fainted: mon.fainted,
      usable: block === null,
      block,
    };
  });
}

function sideIndex(side: SideId): number {
  return side === 'p1' ? 0 : 1;
}

function activeOf(battle: Battle, side: SideId): SimPokemon {
  const pokemon = battle.sides[sideIndex(side)]?.active[0];
  if (!pokemon) throw new Error(`No active Pokemon for ${side}`);
  return pokemon;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface BattleUpdate {
  /** New protocol lines since the previous update, from `side`'s perspective. */
  protocol: string[];
  views: Record<SideId, BattleView>;
  result: BattleResult | null;
}

export interface BattleSession {
  readonly seed: string;
  /** The sim PRNG seed this battle was started with. Shown for debugging. */
  readonly simSeed: SimSeed;
  readonly ended: boolean;
  readonly result: BattleResult | null;
  readonly turn: number;
  /** Every decision submitted so far, in submission order. */
  readonly decisions: readonly Decision[];
  /**
   * Voluntary switches this battle, per side. **A statistic, not log content.**
   *
   * Counted here rather than derived from `decisions` afterwards because
   * "was that switch forced?" is a question about the *request state at the
   * moment it was submitted*, and that state is gone once the turn resolves.
   * A reader handed only the decision list cannot tell a player leaving a bad
   * matchup from a player replacing something that just fainted, and those are
   * the two things the Stage 4 switch-rate metric exists to separate.
   *
   * Deliberately *not* on `Decision`, which goes into the battle log: the log
   * holds a seed and a decision sequence and nothing derived, and this is
   * derived. Replay reconstructs it by counting again.
   */
  readonly voluntarySwitches: Readonly<Record<SideId, number>>;
  viewFor(side: SideId): BattleView;
  /**
   * The battle screen's projection input, from `side`'s perspective.
   *
   * Separate from `viewFor` and deliberately so. `BattleView` is what a
   * *policy* decides from — restricted to public information, with the foe's
   * ability always null, because a bot that could read hidden state would make
   * the balance sweep measure something that is not the game. `BattleFacts` is
   * what a *screen* renders from, and a screen is allowed to know things a
   * policy is not, because `data/tuning.ts` decides what it then shows.
   *
   * Keeping them apart is what stops this stage from moving a single number in
   * the Stage 2 report: nothing the AI reads changed.
   */
  factsFor(side: SideId): BattleFacts;
  /** All protocol lines so far, from `side`'s perspective. */
  protocolFor(side: SideId): readonly string[];
  /** Submit a decision. Both sides must submit before the turn resolves. */
  submit(side: SideId, choice: Choice): void;
  subscribe(listener: (update: BattleUpdate) => void): () => void;
  /**
   * The side's whole team as carry-over state.
   *
   * This is what a run reads out of a finished battle: HP, PP and status for
   * every member, mapped back onto the specs the battle was built from. It is
   * the only thing that crosses a node boundary.
   */
  partyState(side: SideId): PokemonState[];
  /** The replayable record of this battle. */
  toBattleLog(): BattleLog;
}

export interface BattleOptions {
  teams: Record<SideId, TeamSpec>;
  /** The run seed. The sim's PRNG seed is derived from its `battle` stream. */
  seed: string;
  /**
   * Override the derived sim seed.
   *
   * A run generates one of these per battle node at map-generation time, so
   * two battles in the same run are different fights rather than the same one
   * twice. Replay passes the recorded value.
   */
  simSeed?: SimSeed;
  /**
   * HP, PP and status the player's side carries in from earlier nodes.
   *
   * Applied to p1 only, and that restriction is a real one. A `PokemonSet` has
   * no place to put current HP, so the state has to be written onto the sim's
   * Pokemon objects — and it has to happen *before* the switch-in protocol is
   * emitted, or the log would announce full HP for a Pokemon that does not have
   * it and the log-derived damage percentages would all be measured from the
   * wrong baseline. The opening for that is between the two `setPlayer` calls:
   * the side set first is fully built but not yet on the field, because the
   * battle does not start until both sides exist. p1 is set first, so p1 gets
   * the opening. Opponents are generated fresh at full HP in every stage that
   * currently exists, so nothing needs the other half.
   */
  carryOver?: readonly PokemonState[];
}

/**
 * Start a battle.
 *
 * The sim's PRNG seed comes from the run seed's `battle` stream, never from the
 * run seed directly. That indirection is what lets Stage 2 add map and reward
 * rolls without shifting a single battle roll for an already-recorded seed.
 */
export function createBattle(options: BattleOptions): BattleSession {
  const simSeed = options.simSeed ?? battleStreamFor(options.seed).nextSimSeed();
  const format = gymrunFormat();

  // Deferred player setup, not the one-shot constructor form: see
  // `BattleOptions.carryOver` for why the gap between these two calls matters.
  const battle = new Battle({ format, formatid: format.id, seed: simSeed, strictChoices: true });
  battle.setPlayer('p1', { name: 'Player', team: toTeam(options.teams.p1) });
  if (options.carryOver) applyCarryOver(battle, options.carryOver);
  battle.setPlayer('p2', { name: 'Opponent', team: toTeam(options.teams.p2) });

  /*
   * The team in the order it was *submitted*, captured before anything moves.
   *
   * `side.pokemon` is not a stable array: switching in a Pokemon moves it to
   * index 0. Reading carry-over state back by index would therefore be correct
   * for a party of one, correct until the first switch of a battle, and wrong
   * afterwards — HP written onto the wrong spec, silently. Holding the object
   * references is what makes `readPartyState` mean what it says.
   */
  const submitted: Record<SideId, SimPokemon[]> = {
    p1: [...(battle.sides[0]?.pokemon ?? [])],
    p2: [...(battle.sides[1]?.pokemon ?? [])],
  };

  const protocol: Record<SideId, string[]> = { p1: [], p2: [] };
  const decisions: Decision[] = [];
  const voluntarySwitches: Record<SideId, number> = { p1: 0, p2: 0 };
  const listeners = new Set<(update: BattleUpdate) => void>();
  let logCursor = 0;
  let result: BattleResult | null = null;

  /**
   * Split the newly produced protocol into per-side views.
   *
   * The sim emits `|split|p1` pairs where the first line is what p1 may see and
   * the second is what everyone else sees. `extractChannelMessages` resolves
   * those into per-channel streams so neither side is handed the other's secret
   * information, which is what makes a UI-driven policy and an AI policy able to
   * share the same code path honestly.
   */
  function drain(): string[] {
    const fresh = battle.log.slice(logCursor);
    logCursor = battle.log.length;
    if (fresh.length === 0) return [];
    const channels = extractChannelMessages(fresh.join('\n'), [1, 2]);
    const forP1 = channels[1].filter((line) => line.length > 0);
    const forP2 = channels[2].filter((line) => line.length > 0);
    protocol.p1.push(...forP1);
    protocol.p2.push(...forP2);
    return forP1;
  }

  function readResult(): BattleResult | null {
    if (!battle.ended) return null;
    const winner = battle.winner;
    if (!winner) return { winner: null, turns: battle.turn, cause: 'tie' };
    const side = battle.sides.find((s) => s.name === winner);
    return {
      winner: side ? ((side.id as string) as SideId) : null,
      turns: battle.turn,
      cause: 'faint',
    };
  }

  function notify(fresh: string[]): void {
    result = readResult();
    const update: BattleUpdate = {
      protocol: fresh,
      views: { p1: buildView('p1'), p2: buildView('p2') },
      result,
    };
    for (const listener of listeners) listener(update);
  }

  function buildView(side: SideId): BattleView {
    const request = battle.sides[sideIndex(side)]?.activeRequest;
    const awaiting = !battle.ended && !!request && !('wait' in request && request.wait);
    // A forced switch is a request with no `active` block. `moves` is empty on
    // those turns, which is why `forceSwitch` is a flag a policy branches on
    // rather than something it has to infer from an empty list.
    const forceSwitch = awaiting && !!request && 'forceSwitch' in request && Boolean(request.forceSwitch?.[0]);
    return {
      side,
      turn: battle.turn,
      ended: battle.ended,
      me: toActiveView(activeOf(battle, side), true),
      foe: toActiveView(activeOf(battle, opposingSide(side)), false),
      moves: awaiting ? readMoves(battle, side) : [],
      switches: awaiting ? readSwitches(battle, side) : [],
      forceSwitch,
      awaitingChoice: awaiting,
      trapped: awaiting && !forceSwitch && readTrapping(request) !== null,
    };
  }

  /**
   * The same turn, projected for the screen instead of for a policy.
   *
   * Move facts are read off the request exactly as `readMoves` does — the
   * request is what the sim will accept, and rebuilding it from move slots is
   * how a UI offers a move the engine then rejects. The only thing added is the
   * naive type multiplier against the current defender, which is a dex lookup
   * rather than a decision: `view.ts` layers abilities onto it under the
   * visibility rule.
   */
  function buildFacts(side: SideId): BattleFacts {
    const me = activeOf(battle, side);
    const foe = activeOf(battle, opposingSide(side));
    const request = battle.sides[sideIndex(side)]?.activeRequest;
    const awaiting = !battle.ended && !!request && !('wait' in request && request.wait);
    const defenderTypes = foe.getTypes();

    const moves: MoveFacts[] = (awaiting ? readMoves(battle, side) : []).map((move) => ({
      slot: move.slot,
      id: move.id,
      name: move.name,
      type: move.type,
      category: move.category,
      basePower: move.basePower,
      accuracy: move.accuracy,
      pp: move.pp,
      maxPp: move.maxPp,
      usable: move.usable,
      flags: Object.keys(Dex.forGen(GYMRUN_GEN).moves.get(move.id).flags),
      typeMultiplier: typeMultiplier(move.type, defenderTypes),
    }));

    const forceSwitch =
      awaiting && !!request && 'forceSwitch' in request && Boolean(request.forceSwitch?.[0]);

    return {
      turn: battle.turn,
      ended: battle.ended,
      player: toActiveFacts(me, true),
      opponent: toActiveFacts(foe, false),
      moves,
      switches: awaiting ? readSwitches(battle, side) : [],
      forceSwitch,
      trapped: awaiting && !forceSwitch && readTrapping(request) !== null,
      awaitingChoice: awaiting,
      // Trick Room inverts the comparison rather than the numbers, which is why
      // it is a flag on the facts rather than a modifier folded into a speed.
      invertedSpeed: 'trickroom' in battle.field.pseudoWeather,
    };
  }

  // Drain the opening protocol (team sizes, switch-ins, `|turn|1`) so a
  // subscriber attached after construction still sees a coherent log.
  drain();
  result = readResult();

  const session: BattleSession = {
    seed: options.seed,
    simSeed,
    get ended() {
      return battle.ended || battle.turn > TURN_LIMIT;
    },
    get result(): BattleResult | null {
      if (result) return result;
      if (battle.turn > TURN_LIMIT) return { winner: null, turns: battle.turn, cause: 'turn-limit' };
      return null;
    },
    get turn() {
      return battle.turn;
    },
    decisions,
    voluntarySwitches,
    viewFor: buildView,
    factsFor: buildFacts,
    protocolFor: (side) => protocol[side],
    /*
     * Submit a decision, checked against the view first.
     *
     * The check is not belt and braces over the sim's own validation — it is
     * the only place the error is legible. `strictChoices` makes a refused
     * choice a *throw* out of `battle.choose`, several frames down, reading
     * `[Unavailable choice] Can't switch: The active Pokemon is trapped` with
     * no mention of whose turn it was or what was submitted. `rejectionReason`
     * reads the same view a policy decided from, so a disagreement between the
     * two is reported as the seam failing rather than as the engine complaining.
     */
    submit(side, choice) {
      if (battle.ended) throw new Error('Battle has already ended');
      const view = buildView(side);
      const refusal = rejectionReason(view, choice);
      if (refusal) {
        throw new Error(`Illegal choice ${encodeChoice(choice)} for ${side}: ${refusal}`);
      }
      // Counted here, while the request that would have forced it is still the
      // current one. See `voluntarySwitches`.
      if (choice.kind === 'switch' && !view.forceSwitch) voluntarySwitches[side]++;
      decisions.push({ turn: battle.turn, side, choice });
      battle.choose(side as SideID, encodeChoice(choice));
      const fresh = drain();
      if (fresh.length > 0 || battle.ended) notify(fresh);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    partyState: (side) => readPartyState(submitted[side], options.teams[side]),
    toBattleLog: () => ({ seed: options.seed, version: ENGINE_VERSION, decisions: [...decisions] }),
  };

  return session;
}

/**
 * Write carried HP, PP and status onto a side that has been built but not yet
 * sent out. Must run between the two `setPlayer` calls; see `BattleOptions`.
 *
 * HP is floored at 1. A fainted member never reaches a battle — the run either
 * revives it between nodes or the party is wiped and the run is over — so a
 * zero here would mean the run state machine let something through, and
 * silently sending out a corpse is a worse way to find that out than the
 * battle simply being winnable.
 */
function applyCarryOver(battle: Battle, party: readonly PokemonState[]): void {
  const side = battle.sides[0];
  if (!side) throw new Error('Cannot apply carry-over before p1 exists');

  for (const [index, member] of party.entries()) {
    const mon = side.pokemon[index];
    if (!mon) continue;

    mon.hp = Math.max(1, Math.min(member.hp, mon.maxhp));
    for (const [slot, carried] of member.moves.entries()) {
      const live = mon.moveSlots[slot];
      const base = mon.baseMoveSlots[slot];
      if (!live) continue;
      const pp = Math.max(0, Math.min(carried.pp, live.maxpp));
      live.pp = pp;
      if (base) base.pp = pp;
    }
    // setStatus rather than assignment so the engine's own bookkeeping (sleep
    // counters, toxic stages) is set up. It emits a `|-status|` line ahead of
    // `|start|`, which is cosmetically odd but honest; status carry-over is off
    // by default anyway (tuning.clearStatusBetweenNodes).
    if (member.status) mon.setStatus(member.status);
  }
}

/**
 * Read a side's whole team back out of the sim as carry-over state.
 *
 * Takes the *submitted* order (see `createBattle`), not the live array, so a
 * battle that switched still maps each spec to the Pokemon that was built from
 * it.
 */
function readPartyState(order: readonly SimPokemon[], specs: TeamSpec): PokemonState[] {
  return specs.map((spec, index) => {
    const mon = order[index];
    if (!mon) throw new Error(`No Pokemon at slot ${index} to read back`);
    return {
      spec,
      maxHp: mon.maxhp,
      hp: mon.hp,
      moves: mon.moveSlots.map((slot) => ({ id: slot.id, name: slot.move, pp: slot.pp, maxPp: slot.maxpp })),
      status: readStatus(mon),
      fainted: mon.fainted,
    };
  });
}

function battleStreamFor(seed: string): RngStream {
  return createRng(seed).battle;
}

/** `Choice` -> the sim's choice grammar. The only place those strings are built. */
export function encodeChoice(choice: Choice): string {
  return choice.kind === 'switch' ? `switch ${choice.slot}` : `move ${choice.slot}`;
}


// ---------------------------------------------------------------------------
// Stage 4.5: the dex reads the battle screen needs
// ---------------------------------------------------------------------------

/*
 * Everything below answers a *display* question from the dex, and every one of
 * them lives here for the same reason `describeSpecCard` does: `ui/` may not
 * import @pkmn/sim, and this file is the one adapter that may. The alternative
 * — a second module under core/battle/ with the sim import, and the allow-list
 * in eslint.config.js and test/boundaries.test.ts widened to admit it — would
 * loosen a load-bearing architecture rule to save one section header. Rule 4
 * is unchanged by this stage, and that is deliberate.
 *
 * Nothing here draws from an RNG stream, mutates a battle, or is reachable from
 * the run loop. These are lookups.
 */

/**
 * The type chart, in both directions, for one type.
 *
 * Generated from the dex rather than hand-written. A hand-written chart is a
 * table that can drift from the engine resolving the damage beside it, and the
 * whole argument for showing effectiveness at all is that the number on the
 * button is the number the turn will use.
 */
export interface TypeChartEntry {
  type: string;
  /** Attacking: deals 2x to these. */
  strongAgainst: string[];
  /** Attacking: deals 0.5x to these. */
  weakAgainst: string[];
  /** Attacking: deals nothing to these. */
  noEffectAgainst: string[];
  /** Defending: takes 2x from these. */
  weakTo: string[];
  /** Defending: takes 0.5x from these. */
  resists: string[];
  /** Defending: takes nothing from these. */
  immuneTo: string[];
}

/**
 * Every type the wheel shows.
 *
 * Stellar is excluded. It exists in gen 9 as a Terastal mechanic and is neutral
 * against everything in both directions, so a row for it would be eighteen
 * blanks and a lesson the player cannot use — GYMRUN never terastallizes.
 */
export const WHEEL_TYPES: readonly string[] = Dex.forGen(GYMRUN_GEN)
  .types.all()
  .map((type) => type.name)
  .filter((name) => name !== 'Stellar')
  .sort();

let typeChartCache: TypeChartEntry[] | null = null;

/** The full chart, built once. Both directions for every type. */
export function typeChart(): readonly TypeChartEntry[] {
  if (typeChartCache) return typeChartCache;
  const dex = Dex.forGen(GYMRUN_GEN);

  typeChartCache = WHEEL_TYPES.map((type) => {
    const entry: TypeChartEntry = {
      type,
      strongAgainst: [],
      weakAgainst: [],
      noEffectAgainst: [],
      weakTo: [],
      resists: [],
      immuneTo: [],
    };
    for (const other of WHEEL_TYPES) {
      // Attacking: this type against `other`.
      if (!dex.getImmunity(type, other)) entry.noEffectAgainst.push(other);
      else {
        const mod = dex.getEffectiveness(type, other);
        if (mod > 0) entry.strongAgainst.push(other);
        else if (mod < 0) entry.weakAgainst.push(other);
      }
      // Defending: `other` against this type.
      if (!dex.getImmunity(other, type)) entry.immuneTo.push(other);
      else {
        const mod = dex.getEffectiveness(other, type);
        if (mod > 0) entry.weakTo.push(other);
        else if (mod < 0) entry.resists.push(other);
      }
    }
    return entry;
  });
  return typeChartCache;
}

/**
 * The naive type-chart multiplier, as a plain number rather than a log.
 *
 * `getEffectiveness` returns a base-2 exponent (`1` meaning 2x, `-2` meaning
 * 0.25x) and says nothing about immunity, which is a separate call. Folding
 * both into one number here means `view.ts` never has to know that, and the
 * value it receives is the one the button prints.
 */
export function typeMultiplier(moveType: string, defenderTypes: readonly string[]): number {
  const dex = Dex.forGen(GYMRUN_GEN);
  const types = [...defenderTypes];
  if (!dex.getImmunity(moveType, types)) return 0;
  return 2 ** dex.getEffectiveness(moveType, types);
}

/** An ability, with the dex's one-line description. Null when the id is unknown. */
export interface AbilityInfo {
  id: string;
  name: string;
  shortDesc: string;
}

export function abilityInfo(id: string): AbilityInfo | null {
  const ability = Dex.forGen(GYMRUN_GEN).abilities.get(id);
  if (!ability.exists) return null;
  return { id: ability.id, name: ability.name, shortDesc: ability.shortDesc ?? '' };
}

/** A move's dex flags — `bullet`, `sound`, `contact`, ... */
export function moveFlags(id: string): string[] {
  return Object.keys(Dex.forGen(GYMRUN_GEN).moves.get(id).flags);
}

/**
 * A move's priority bracket, straight off the dex.
 *
 * The one number `core/battle/turnOrder.ts` needs and cannot have: it reads the
 * protocol, which reports *what happened* and never *why*, so a Quick Attack
 * going first is indistinguishable from a fast Pokemon going first unless
 * something supplies the bracket. Priority runs -7 (Trick Room's counter-moves)
 * to +5 (Helping Hand); 0 is every ordinary move.
 *
 * Exported from the adapter rather than read from `data/movePools.ts` for the
 * usual reason: the pools are a generated *subset* the randomizer draws from,
 * and a gym leader's signature move or a Struggle substitution can reach the
 * log without ever having been in a pool. The dex knows about all of them.
 */
export function movePriority(nameOrId: string): number {
  const move = Dex.forGen(GYMRUN_GEN).moves.get(nameOrId);
  return move.exists ? move.priority : 0;
}

/** A move's one-line description, for the move tooltip. */
export function moveShortDesc(id: string): string {
  return Dex.forGen(GYMRUN_GEN).moves.get(id).shortDesc ?? '';
}

/**
 * Ask the engine which types an ability makes its holder immune to.
 *
 * **For tests, not for the UI.** It builds a throwaway battle, which is far too
 * expensive to run on a move button, and it exists so `data/abilityEffects.ts`
 * can be checked against the engine over the whole generated ability pool
 * rather than against somebody's memory of the game.
 *
 * Two mechanisms have to be checked because the engine uses two, and the
 * difference is exactly the kind of gap this stage is about. Most absorbing
 * abilities — Volt Absorb, Flash Fire, Sap Sipper — block in a `TryHit`
 * handler that lives on the ability data. **Levitate has no handler at all**:
 * its Ground immunity is a hardcoded branch in `Pokemon#isGrounded`, so
 * introspecting ability data finds nothing, and a table built that way would
 * have shipped a Levitate the UI could not see. `runImmunity` is what catches
 * it.
 *
 * The probe defender is a **pure Fire type**, and the choice is load-bearing:
 * Fire is immune to nothing on the type chart, so every immunity this reports
 * comes from the ability rather than from the defender's typing. A Normal-type
 * probe would report a Ghost immunity for all 300 abilities.
 */
export interface AbilityImmunityProbe {
  /**
   * The defender's types *after* switch-in.
   *
   * Not always the species' own typing, and that is the point of returning it.
   * Imposter transforms its holder into the opposing Pokemon the moment it
   * switches in, so a Fire-type probe becomes whatever it is facing — and the
   * type-chart immunities that come with it are the *transformed* form's, not
   * the ability's. A caller that assumed the species' typing would read that as
   * a missing table entry. The battle screen has the same information for the
   * same reason: it reads `pokemon.getTypes()` live.
   */
  types: string[];
  /** Types the engine refuses to let through. */
  blocked: string[];
}

export function probeAbilityImmunities(
  abilityId: string,
  defenderSpecies = 'Vulpix',
): AbilityImmunityProbe {
  const format = gymrunFormat();
  const battle = new Battle({ format, formatid: format.id, seed: PROBE_SEED, strictChoices: true });
  try {
    const probe = (species: string, ability: string): PokemonSet =>
      toPokemonSet({ species, ability, moves: ['Tackle'], level: 50 });
    battle.setPlayer('p1', { name: 'A', team: [probe('Ditto', 'Limber')] });
    battle.setPlayer('p2', { name: 'B', team: [probe(defenderSpecies, abilityId)] });

    const target = battle.sides[1]?.active[0];
    const source = battle.sides[0]?.active[0];
    if (!target || !source) return { types: [], blocked: [] };

    const dex = Dex.forGen(GYMRUN_GEN);
    const ability = dex.abilities.get(abilityId);
    const handled = hasHandler(ability, 'onTryHit');
    const blocked: string[] = [];

    for (const [type, moveName] of Object.entries(REPRESENTATIVE_MOVES)) {
      // 1. Grounding and `onImmunity`. Message suppressed so nothing reaches
      //    the log; this is the branch that finds Levitate.
      if (!target.runImmunity(type, false)) {
        blocked.push(type);
        continue;
      }
      // 2. `TryHit` on the ability itself. A handler returning null is an
      //    absorbing ability refusing the hit.
      if (!handled) continue;
      const move = dex.getActiveMove(moveName);
      if (battle.singleEvent('TryHit', ability, target.abilityState, target, source, move) === null) {
        blocked.push(type);
      }
    }
    return { types: target.getTypes(), blocked };
  } finally {
    battle.destroy();
  }
}

/**
 * One ordinary damaging move per type, for the immunity probe.
 *
 * Plain single-target attacks with no secondary behaviour, so the probe
 * measures the ability rather than the move. Each is the type's most
 * unremarkable option on purpose.
 */
export const REPRESENTATIVE_MOVES: Record<string, string> = {
  Bug: 'X-Scissor',
  Dark: 'Crunch',
  Dragon: 'Dragon Claw',
  Electric: 'Thunderbolt',
  Fairy: 'Moonblast',
  Fighting: 'Brick Break',
  Fire: 'Flamethrower',
  Flying: 'Air Slash',
  Ghost: 'Shadow Ball',
  Grass: 'Energy Ball',
  Ground: 'Earthquake',
  Ice: 'Ice Beam',
  Normal: 'Body Slam',
  Poison: 'Sludge Bomb',
  Psychic: 'Psychic',
  Rock: 'Rock Slide',
  Steel: 'Flash Cannon',
  Water: 'Surf',
};

// ---------------------------------------------------------------------------
// Running a battle to completion
// ---------------------------------------------------------------------------

export interface BattleRun {
  result: BattleResult;
  battleLog: BattleLog;
  /** Full protocol from p1's perspective. */
  protocol: string[];
  /** Every faint in the battle, with what caused it. Drives the run summary. */
  casualties: Casualty[];
  /**
   * Items the player's side used up, by dex id, in the order they fired.
   *
   * **Stage 4.6b, and it is the whole of the berry consumption sync.** The sim
   * resolves a berry itself — it is an ordinary held item to Showdown — so
   * nothing above this file has to know how an Oran Berry works. What it does
   * have to know is that the berry is *gone*, and the only place that fact
   * exists is the `-enditem` line the engine emitted when it fired.
   *
   * Player side only. A trainer's berry is spent inside a battle nobody carries
   * state out of, so reading it would be reading the engine's own bookkeeping.
   */
  consumed: ItemId[];
  session: BattleSession;
}

/**
 * Play a battle out under two policies.
 *
 * This signature is the point of the whole policy seam: the human player, the
 * AI, and a scripted policy used for balance sweeps are all the same shape, so
 * this function is callable from a Node test with two AIs and no DOM. Stage 2
 * needs to run a thousand seeds headless, and that capability is nearly free
 * here and nearly impossible to retrofit once the UI owns the battle loop.
 */
export async function runBattle(
  teamA: TeamSpec,
  teamB: TeamSpec,
  seed: string,
  policyA: Policy,
  policyB: Policy,
  options: {
    simSeed?: SimSeed;
    /** Player-side HP/PP/status carried in from an earlier node. */
    carryOver?: readonly PokemonState[];
    /**
     * Called once, synchronously, with the session that is about to be played.
     * The UI needs the session before the battle resolves so it can subscribe
     * to updates; without this hook it would have to reimplement this loop.
     */
    onStart?: (session: BattleSession) => void;
  } = {},
): Promise<BattleRun> {
  const session = createBattle({
    teams: { p1: teamA, p2: teamB },
    seed,
    ...(options.simSeed ? { simSeed: options.simSeed } : {}),
    ...(options.carryOver ? { carryOver: options.carryOver } : {}),
  });
  options.onStart?.(session);
  const policies: Record<SideId, Policy> = { p1: policyA, p2: policyB };

  while (!session.ended) {
    const pending = SIDES.filter((side) => session.viewFor(side).awaitingChoice);
    if (pending.length === 0) break;

    // Ask every waiting policy first, then submit in a fixed p1-before-p2
    // order. Policies may resolve in any order; submission order must not vary
    // or two runs of the same seed could diverge.
    const chosen = await Promise.all(
      pending.map(async (side) => [side, await policies[side](session.viewFor(side))] as const),
    );
    for (const [side, choice] of chosen) session.submit(side, choice);
  }

  const result = session.result ?? { winner: null, turns: session.turn, cause: 'turn-limit' as const };
  const protocol = [...session.protocolFor('p1')];
  return {
    result,
    battleLog: session.toBattleLog(),
    protocol,
    casualties: readCasualties(protocol),
    consumed: readConsumedItems(protocol, 'p1'),
    session,
  };
}

/**
 * Replay a `BattleLog` against the teams it was recorded with.
 *
 * The log holds a seed and a decision sequence and nothing derived, so replay
 * is just: rebuild the battle from the seed, feed the decisions back in order.
 * If this ever disagrees with the original run, either the engine changed or
 * something unseeded leaked in — both are bugs we want loudly, which is why
 * test/replay.test.ts asserts the reconstructed protocol byte for byte.
 */
export function replayBattleLog(
  log: BattleLog,
  teams: Record<SideId, TeamSpec>,
  options: { simSeed?: SimSeed; carryOver?: readonly PokemonState[] } = {},
): BattleSession {
  if (log.version !== ENGINE_VERSION) {
    throw new Error(`BattleLog was recorded on ${log.version}, this build is ${ENGINE_VERSION}`);
  }
  const session = createBattle({
    teams,
    seed: log.seed,
    ...(options.simSeed ? { simSeed: options.simSeed } : {}),
    ...(options.carryOver ? { carryOver: options.carryOver } : {}),
  });
  for (const decision of log.decisions) {
    if (session.ended) break;
    session.submit(decision.side, decision.choice);
  }
  return session;
}

// ---------------------------------------------------------------------------
// Reading a cause of death out of the protocol
// ---------------------------------------------------------------------------

/**
 * One Pokemon fainting, and what did it.
 *
 * Protocol parsing belongs here for the same reason every other translation
 * does: nothing above this file may see a protocol string. The run summary
 * wants to say "Vesper's Gengar, Shadow Ball" rather than "you lost", and the
 * only place that sentence exists is in the log the sim emitted.
 */
export interface Casualty {
  /** The side that lost a Pokemon. */
  side: SideId;
  /** The Pokemon that fainted, by its battle name. */
  name: string;
  /** The opposing Pokemon that landed the blow, or null for indirect damage. */
  bySpecies: string | null;
  /** The move that landed it, or null when nothing did. */
  byMove: string | null;
  /**
   * Indirect cause, when there is no killing move: `psn`, `brn`, `Recoil`,
   * `Life Orb`, `Spikes`. Taken verbatim from the protocol's `[from]` tag.
   */
  indirect: string | null;
}

/**
 * Walk a protocol and pair every faint with what caused it.
 *
 * Deliberately forgiving. The sim has many ways to remove a Pokemon and a
 * parser that insisted on recognising all of them would report nothing at all
 * the first time it met one it did not know; this reports what it can and null
 * for the rest, because "died to something" is a better summary line than a
 * crashed screen.
 */
export function readCasualties(protocol: readonly string[]): Casualty[] {
  const casualties: Casualty[] = [];
  let lastMove: { by: string; move: string; target: string } | null = null;
  let lastIndirect: { target: string; from: string } | null = null;

  for (const line of protocol) {
    const parts = line.split('|');
    const tag = parts[1];

    if (tag === 'move') {
      const by = parts[2] ?? '';
      const move = parts[3] ?? '';
      const target = parts[4] ?? '';
      lastMove = { by: nameOf(by), move, target: nameOf(target) };
      continue;
    }
    if (tag === '-damage' || tag === '-heal') {
      const from = parts.find((part) => part.startsWith('[from]'));
      lastIndirect = from
        ? { target: nameOf(parts[2] ?? ''), from: from.slice('[from]'.length).trim() }
        : null;
      continue;
    }
    if (tag !== 'faint') continue;

    const identifier = parts[2] ?? '';
    const side: SideId = identifier.startsWith('p2') ? 'p2' : 'p1';
    const name = nameOf(identifier);
    // A killing move names its target; anything else is credited as indirect.
    const killedByMove = lastMove && lastMove.target === name ? lastMove : null;

    casualties.push({
      side,
      name,
      bySpecies: killedByMove?.by ?? null,
      byMove: killedByMove?.move ?? null,
      indirect: killedByMove ? null : (lastIndirect?.target === name ? lastIndirect.from : null),
    });
  }
  return casualties;
}

/**
 * Items one side used up, by dex id, in the order the engine spent them.
 *
 * `-enditem` is the sim's own announcement that a held item is gone, and it
 * covers every way that happens: a berry eaten, a Focus Sash spent, an Air
 * Balloon popped, a Knock Off. **All of them, deliberately** — the run's rule
 * is that an item leaves the bag when the battle says it left the Pokemon, and
 * a reader that only recognised berries would quietly keep a spent Focus Sash
 * on the party screen.
 *
 * Ids are normalised the way `data/items.ts` spells them, because that is the
 * key `PokemonState.item` and the backpack are both stored under; the protocol
 * spells them as display names (`Oran Berry`).
 *
 * Deliberately forgiving, like `readCasualties`: an id the whitelist does not
 * know is returned anyway, and `core/items.ts` is where it fails to match
 * anything. Dropping it here would make an unknown item silently permanent.
 */
export function readConsumedItems(protocol: readonly string[], side: SideId): ItemId[] {
  const consumed: ItemId[] = [];
  for (const line of protocol) {
    const parts = line.split('|');
    if (parts[1] !== '-enditem') continue;
    const identifier = parts[2] ?? '';
    const owner: SideId = identifier.startsWith('p2') ? 'p2' : 'p1';
    if (owner !== side) continue;
    const item = parts[3];
    if (item) consumed.push(toItemId(item));
  }
  return consumed;
}

/** `Oran Berry` -> `oranberry`. The spelling `data/items.ts` keys on. */
function toItemId(name: string): ItemId {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** `p2a: Gengar` -> `Gengar`. Empty for a malformed or absent identifier. */
function nameOf(identifier: string): string {
  const split = identifier.indexOf(': ');
  return split === -1 ? '' : identifier.slice(split + 2);
}

/**
 * Strip lines that are not a function of the seed.
 *
 * The sim stamps `|t:|<unix seconds>` into the protocol. It is the one piece of
 * genuinely non-deterministic output, and comparing raw logs across runs that
 * straddle a second boundary would fail for reasons that have nothing to do
 * with the engine. Determinism assertions compare through this.
 */
export function stripNondeterministic(protocol: readonly string[]): string[] {
  return protocol.filter((line) => !line.startsWith('|t:|'));
}
