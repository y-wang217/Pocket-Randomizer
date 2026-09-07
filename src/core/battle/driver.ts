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
  type Decision,
  type MoveView,
  type RunLog,
  type SideId,
  type StatStages,
  type StatusName,
  type PokemonSpec,
  type TeamSpec,
} from '../types';
import { GYMRUN_GEN, TURN_LIMIT, gymrunFormat } from './format';
import type { Policy } from './policy';

/** Bumped whenever a change would make an older RunLog replay differently. */
export const ENGINE_VERSION = 'gymrun-0.1.0';

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
  /** The replayable record of this battle. */
  toRunLog(): RunLog;
}

export interface BattleOptions {
  teams: Record<SideId, TeamSpec>;
  /** The run seed. The sim's PRNG seed is derived from its `battle` stream. */
  seed: string;
  /** Override the derived sim seed. Only used by replay. */
  simSeed?: SimSeed;
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

  const battle = new Battle({
    format,
    formatid: format.id,
    seed: simSeed,
    strictChoices: true,
    p1: { name: 'Player', team: toTeam(options.teams.p1) },
    p2: { name: 'Opponent', team: toTeam(options.teams.p2) },
  });

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
    return {
      side,
      turn: battle.turn,
      ended: battle.ended,
      me: toActiveView(activeOf(battle, side), true),
      foe: toActiveView(activeOf(battle, opposingSide(side)), false),
      moves: awaiting ? readMoves(battle, side) : [],
      awaitingChoice: awaiting,
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
    submit(side, choice) {
      if (battle.ended) throw new Error('Battle has already ended');
      decisions.push({ turn: battle.turn, side, choice });
      const accepted = battle.choose(side as SideID, encodeChoice(choice));
      if (!accepted) throw new Error(`Sim rejected choice ${encodeChoice(choice)} for ${side}`);
      const fresh = drain();
      if (fresh.length > 0 || battle.ended) notify(fresh);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toRunLog: () => ({ seed: options.seed, version: ENGINE_VERSION, decisions: [...decisions] }),
  };

  return session;
}

function battleStreamFor(seed: string): RngStream {
  return createRng(seed).battle;
}

/** `Choice` -> the sim's choice grammar. The only place that string is built. */
export function encodeChoice(choice: Choice): string {
  return `move ${choice.slot}`;
}

// ---------------------------------------------------------------------------
// Running a battle to completion
// ---------------------------------------------------------------------------

export interface BattleRun {
  result: BattleResult;
  runLog: RunLog;
  /** Full protocol from p1's perspective. */
  protocol: string[];
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
  return { result, runLog: session.toRunLog(), protocol: [...session.protocolFor('p1')], session };
}

/**
 * Replay a `RunLog` against the teams it was recorded with.
 *
 * The log holds a seed and a decision sequence and nothing derived, so replay
 * is just: rebuild the battle from the seed, feed the decisions back in order.
 * If this ever disagrees with the original run, either the engine changed or
 * something unseeded leaked in — both are bugs we want loudly, which is why
 * test/replay.test.ts asserts the reconstructed protocol byte for byte.
 */
export function replayRunLog(log: RunLog, teams: Record<SideId, TeamSpec>): BattleSession {
  if (log.version !== ENGINE_VERSION) {
    throw new Error(`RunLog was recorded on ${log.version}, this build is ${ENGINE_VERSION}`);
  }
  const session = createBattle({ teams, seed: log.seed });
  for (const decision of log.decisions) {
    if (session.ended) break;
    session.submit(decision.side, decision.choice);
  }
  return session;
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
