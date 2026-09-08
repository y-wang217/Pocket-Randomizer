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
  type MoveState,
  type MoveView,
  type PokemonState,
  type SideId,
  type StatStages,
  type StatusName,
  type PokemonSpec,
  type SwitchView,
  type TeamSpec,
} from '../types';
import { GYMRUN_GEN, TURN_LIMIT, gymrunFormat } from './format';
import type { Policy } from './policy';
import { rejectionReason } from './switching';

/**
 * Bumped whenever a change would make an older RunLog replay differently.
 *
 * `0.2.0` is Stage 4. A battle log now carries voluntary switches, which
 * consume turns and battle-stream rolls that a Stage 3 log never spent, so the
 * same decision sequence replayed against this build would be a different
 * battle rather than the same one. That is the failure the version exists to
 * refuse.
 */
export const ENGINE_VERSION = 'gymrun-0.2.0';

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
    gender: '',
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
  ability: string;
  types: string[];
  maxHp: number;
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
    ability: dex.abilities.get(mon.ability).name,
    types: mon.getTypes(),
    maxHp: mon.maxhp,
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

// ---------------------------------------------------------------------------
// sim -> BattleView
// ---------------------------------------------------------------------------

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
  viewFor(side: SideId): BattleView;
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
    viewFor: buildView,
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
      const refusal = rejectionReason(buildView(side), choice);
      if (refusal) {
        throw new Error(`Illegal choice ${encodeChoice(choice)} for ${side}: ${refusal}`);
      }
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
// Running a battle to completion
// ---------------------------------------------------------------------------

export interface BattleRun {
  result: BattleResult;
  battleLog: BattleLog;
  /** Full protocol from p1's perspective. */
  protocol: string[];
  /** Every faint in the battle, with what caused it. Drives the run summary. */
  casualties: Casualty[];
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
  return { result, battleLog: session.toBattleLog(), protocol, casualties: readCasualties(protocol), session };
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
