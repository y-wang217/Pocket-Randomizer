/**
 * The run: a state machine over a generated map, and one function that plays it.
 *
 * Two seams matter more than anything else in this file.
 *
 * **`RunPolicy` mirrors the battle `Policy`.** A run is a sequence of decisions
 * — which starter, which node, which move — and a policy is a function from
 * "what I can see" to "what I do". The UI is a run policy whose promises
 * resolve on clicks. A scripted bot is a run policy. A recorded log replayed
 * back is a run policy. `playRun` takes one and cannot tell which it has, which
 * is what makes Stage 2's thousand-seed sweep a loop around a function that
 * already exists rather than a second implementation of the run loop that
 * drifts out of agreement with the one players use.
 *
 * **Everything is a list.** `segments`, not "the segment". `party`, not "the
 * starter". Stage 1 generates one segment and puts one Pokemon in the party,
 * and every function here is written as though it were eight and six, because
 * the version that special-cases the singular keeps passing its tests right up
 * until the day it silently does the wrong thing.
 *
 * State transitions return new state. A run is reconstructed by replaying a
 * decision log, and shared mutable state is the fastest way to make a replay
 * disagree with the run it replays.
 */
import { greedyAiPolicy } from './battle/ai';
import { ENGINE_VERSION, runBattle, type BattleSession, type Casualty } from './battle/driver';
import type { Policy } from './battle/policy';
import { generateSegment, generateStarterOptions, type NodeSpec, type Segment } from './encounters';
import {
  applyBattleState,
  battleTeamFor,
  betweenNodes,
  carryOverFor,
  createParty,
  isWiped,
  levelParty,
  restParty,
} from './party';
import { RANDOMIZER_VERSION } from './randomizer';
import { createRng } from './rng';
import type { BattleResult, PokemonSpec, PokemonState, RunDecision, RunLog } from './types';
import { SEGMENT_COUNT, playerLevel } from '../data/scaling';
import { DEFAULT_TUNING, type Tuning } from '../data/tuning';

/**
 * Bumped whenever a recorded decision sequence would replay differently.
 *
 * It carries the engine version because a run log is only replayable against
 * the mons, generation and sim it was recorded with. Stage 0's logs are
 * `gymrun-0.1.0` and do not match, which is the explicit rejection the widened
 * log format calls for.
 */
export const RUN_LOG_VERSION = `gymrun-run-3/${ENGINE_VERSION}`;

export type RunOutcome = 'victory' | 'defeat';

/** Where a run is: picking a starter, on the map, or finished. */
export type RunPhase = 'starter' | 'map' | 'complete';

/** One node the run actually went through. Display only; never serialized. */
export interface NodeVisit {
  node: NodeSpec;
  /** Which segment it belonged to, so the summary can say where a run ended. */
  segment: number;
  /** Null for nodes that were not a fight. */
  result: BattleResult | null;
  /** Party HP after the node resolved, for the summary. */
  hpAfter: number;
  /**
   * The player's losses in this node, with what caused them.
   *
   * Derived from the battle protocol by the adapter, not reconstructed here.
   * It is what the summary means by "cause of death" and what the balance
   * simulator counts.
   */
  casualties: Casualty[];
}

export interface RunState {
  seed: string;
  tuning: Tuning;
  /** Stage 1 generates one. The type is the same either way, deliberately. */
  segments: Segment[];
  currentSegment: number;
  /**
   * Index into the current segment's steps.
   *
   * Equal to `steps.length` means the steps are done and the gym is next. The
   * gym is not a step because it is not a choice.
   */
  position: number;
  party: PokemonState[];
  starterOptions: PokemonSpec[];
  starterIndex: number | null;
  history: NodeVisit[];
  outcome: RunOutcome | null;
}

// ---------------------------------------------------------------------------
// Creating and reading a run
// ---------------------------------------------------------------------------

/**
 * Build a run from a seed. Nothing is drawn after this point.
 *
 * Starter options come first and the map second, so that adding a starter to
 * the pool later does not reshape a recorded seed's map.
 */
export function createRun(seed: string, tuning: Tuning = DEFAULT_TUNING): RunState {
  const rng = createRng(seed);
  const starterOptions = generateStarterOptions(rng, tuning);
  const segments = Array.from({ length: SEGMENTS_PER_RUN }, (_, index) => generateSegment(index, rng, tuning));

  return {
    seed,
    tuning,
    segments,
    currentSegment: 0,
    position: 0,
    party: [],
    starterOptions,
    starterIndex: null,
    history: [],
    outcome: null,
  };
}

/**
 * How many segments a run is.
 *
 * Stage 1 was one and this was a named constant precisely so that Stage 2 would
 * change a number rather than a loop. It did, and the number now comes from
 * data/scaling.ts, which is also where the eight rows describing those segments
 * live — one source rather than a constant here that has to agree with a table
 * there.
 */
export const SEGMENTS_PER_RUN = SEGMENT_COUNT;

export function phaseOf(state: RunState): RunPhase {
  if (state.outcome) return 'complete';
  return state.starterIndex === null ? 'starter' : 'map';
}

export function segmentOf(state: RunState): Segment {
  const segment = state.segments[state.currentSegment];
  if (!segment) throw new RangeError(`No segment ${state.currentSegment}`);
  return segment;
}

/** True when the steps are done and the only thing left is the gym. */
export function atGym(state: RunState): boolean {
  return state.position >= segmentOf(state).steps.length;
}

/**
 * The nodes the player is being offered.
 *
 * Empty at the gym: the gym is not a choice, so it must not arrive at
 * `chooseNode` as a list of one. A policy asked to pick from one option is a
 * decision recorded in the log that the player never made.
 */
export function nodeOptions(state: RunState): NodeSpec[] {
  if (state.outcome || atGym(state)) return [];
  return segmentOf(state).steps[state.position]?.options ?? [];
}

/** The node that will be played next, choice or not. */
export function nextNode(state: RunState, choice: number): NodeSpec {
  if (atGym(state)) return segmentOf(state).gym;
  const options = nodeOptions(state);
  const node = options[choice];
  if (!node) throw new RangeError(`Node choice ${choice} out of range (${options.length} offered)`);
  return node;
}

/**
 * How many gyms this run has beaten. Zero to eight.
 *
 * Derived from history rather than counted into state, because a counter and a
 * history that disagree is a bug that only shows up on the summary screen.
 */
export function gymsCleared(state: RunState): number {
  return state.history.filter((visit) => visit.node.kind === 'gym' && visit.result?.winner === 'p1').length;
}

/**
 * What ended the run, in the terms the summary screen wants.
 *
 * Null for a victory, and for the rare defeat with nothing to point at (a
 * turn-limit draw against a gym leader is a loss with no casualty).
 */
export interface CauseOfDeath {
  /** Segment index the run ended in, 0-based. */
  segment: number;
  /** The gym leader guarding that segment. */
  leader: string;
  /** The node kind that did it: a gym, a trainer, or a wild encounter. */
  kind: NodeSpec['kind'];
  /** The party member that fell. */
  species: string;
  /** What killed it, and how. Nulls where the protocol did not say. */
  bySpecies: string | null;
  byMove: string | null;
  indirect: string | null;
}

export function causeOfDeath(state: RunState): CauseOfDeath | null {
  if (state.outcome !== 'defeat') return null;
  const last = state.history[state.history.length - 1];
  if (!last) return null;
  const casualty = last.casualties[last.casualties.length - 1];
  const leader = state.segments[last.segment]?.leader ?? '';

  return {
    segment: last.segment,
    leader,
    kind: last.node.kind,
    species: casualty?.name ?? state.party[0]?.spec.species ?? '',
    bySpecies: casualty?.bySpecies ?? null,
    byMove: casualty?.byMove ?? null,
    indirect: casualty?.indirect ?? null,
  };
}

/** Total current HP across the party. */
export function partyHp(party: readonly PokemonState[]): number {
  return party.reduce((total, member) => total + member.hp, 0);
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/** Commit the starter pick. The party is a list from the first moment. */
export function chooseStarter(state: RunState, index: number): RunState {
  const spec = state.starterOptions[index];
  if (!spec) throw new RangeError(`Starter choice ${index} out of range`);
  return { ...state, starterIndex: index, party: createParty([spec]) };
}

/**
 * What a node produced. Facts only — no rules applied.
 *
 * The split matters: reading HP and PP out of a finished battle is the sim
 * adapter's job, and deciding what that means for the run is this file's. A
 * battle screen that applied rest, revival and wipe detection itself is a
 * battle screen Stage 3 would have to teach about rewards.
 */
export interface NodeResult {
  node: NodeSpec;
  /** Present for battle nodes: the outcome, and the party as the sim left it. */
  battle?: {
    result: BattleResult;
    party: PokemonState[];
    /**
     * Every faint on either side, as the adapter read them off the protocol.
     *
     * Optional because `resolveNode` is also called directly by tests that
     * construct a battle outcome by hand and have no protocol to read. A
     * missing list means "nothing recorded", never "nobody fainted".
     */
    casualties?: Casualty[];
  };
}

/**
 * Fold a finished node into the run. **This is Stage 3's hook for rewards.**
 *
 * Everything that happens between two nodes happens here and nowhere else:
 * the battle's damage is folded in, rest is applied, the run's two end
 * conditions are checked, and only then does the party heal its status and
 * revive. The ordering is the interesting part — the wipe check runs *before*
 * revival, or `reviveFaintedBetweenNodes` would quietly resurrect a run that
 * had already ended.
 */
export function resolveNode(state: RunState, result: NodeResult): RunState {
  if (state.outcome) throw new Error('Run has already ended');

  let party = state.party;
  if (result.battle) party = applyBattleState(party, result.battle.party);
  if (result.node.kind === 'rest') party = restParty(party, state.tuning);

  const history: NodeVisit[] = [
    ...state.history,
    {
      node: result.node,
      segment: state.currentSegment,
      result: result.battle?.result ?? null,
      hpAfter: partyHp(party),
      casualties: (result.battle?.casualties ?? []).filter((casualty) => casualty.side === 'p1'),
    },
  ];

  // The one death rule, checked before anything can undo it.
  if (isWiped(party)) return { ...state, party, history, outcome: 'defeat' };

  if (result.node.kind === 'gym') {
    // A gym that did not end in a win ends the run, wipe or not: a turn-limit
    // draw against a gym leader is a gym the player did not beat.
    if (result.battle?.result.winner !== 'p1') {
      return { ...state, party, history, outcome: 'defeat' };
    }
    const nextSegment = state.currentSegment + 1;
    if (nextSegment >= state.segments.length) {
      return { ...state, party, history, outcome: 'victory' };
    }
    /*
     * Clearing a gym is the only thing that levels the party.
     *
     * There is no XP and no grinding: the level is a function of segment index
     * (data/scaling.ts). Levelling happens *after* the node's damage has been
     * folded in and after the wipe check, so a gym won on one HP is a segment
     * started on the same share of a bigger bar rather than a free heal.
     */
    return {
      ...state,
      party: levelParty(betweenNodes(party, state.tuning), playerLevel(nextSegment)),
      history,
      currentSegment: nextSegment,
      position: 0,
    };
  }

  return {
    ...state,
    party: betweenNodes(party, state.tuning),
    history,
    position: state.position + 1,
  };
}

// ---------------------------------------------------------------------------
// Playing a run
// ---------------------------------------------------------------------------

/**
 * The run-level mirror of `Policy`.
 *
 * Three decisions, because a run has three kinds of decision. `battle` is the
 * Stage 0 policy unchanged, which is what lets the same move-picking code serve
 * a click, a bot and a replay.
 */
export interface RunPolicy {
  chooseStarter: (options: PokemonSpec[]) => Promise<number>;
  chooseNode: (options: NodeSpec[]) => Promise<number>;
  battle: Policy;
}

export interface PlayRunOptions {
  /** Fired after every transition, so a UI can render without owning the loop. */
  onState?: (state: RunState) => void;
  /**
   * Fired after every decision with the log as it stands.
   *
   * This is what makes a mid-run save possible without the caller
   * reimplementing the loop: the log is complete and replayable at every point
   * it fires, so writing it straight to storage is enough to resume.
   */
  onDecision?: (log: RunLog) => void;
  /** Fired synchronously with a live session the moment a battle starts. */
  onBattle?: (session: BattleSession, node: NodeSpec, state: RunState) => void;
  /** The opponent. Defaults to the greedy AI; a sweep may want something else. */
  opponent?: Policy;
}

export interface RunResult {
  state: RunState;
  outcome: RunOutcome;
  /** Seed plus the decision sequence. Nothing derived. */
  log: RunLog;
}

/**
 * Play a run to its end under a policy.
 *
 * Must complete headless under Node with no DOM. That is not a nice-to-have:
 * it is the precursor to Stage 2's balance sweep, and a run loop that can only
 * run inside a page is one that has to be written twice.
 */
export async function playRun(
  seed: string,
  policy: RunPolicy,
  tuning: Tuning = DEFAULT_TUNING,
  options: PlayRunOptions = {},
): Promise<RunResult> {
  const decisions: RunDecision[] = [];
  const opponent = options.opponent ?? greedyAiPolicy;

  const record = (decision: RunDecision): void => {
    decisions.push(decision);
    options.onDecision?.(makeLog(seed, [...decisions]));
  };

  let state = createRun(seed, tuning);
  options.onState?.(state);

  const starterIndex = await policy.chooseStarter(state.starterOptions);
  record({ kind: 'starter', index: starterIndex });
  state = chooseStarter(state, starterIndex);
  options.onState?.(state);

  // A generated map is finite, so this loop is too; the guard exists to fail
  // loudly if a future transition ever forgets to advance rather than hanging
  // a browser tab.
  for (let guard = 0; guard <= maxNodes(state); guard++) {
    if (state.outcome) break;

    let node: NodeSpec;
    if (atGym(state)) {
      node = segmentOf(state).gym;
    } else {
      const choice = await policy.chooseNode(nodeOptions(state));
      record({ kind: 'node', index: choice });
      node = nextNode(state, choice);
    }

    const result = await playNode(state, node, policy, record, opponent, options);
    state = resolveNode(state, result);
    options.onState?.(state);
  }

  if (!state.outcome) throw new Error('Run did not reach an outcome');
  return {
    state,
    outcome: state.outcome,
    log: makeLog(seed, decisions),
  };
}

/** The one place a `RunLog` is built, so every stamp on it agrees. */
function makeLog(seed: string, decisions: RunDecision[]): RunLog {
  return { seed, version: RUN_LOG_VERSION, randomizerVersion: RANDOMIZER_VERSION, decisions };
}

function maxNodes(state: RunState): number {
  return state.segments.reduce((total, segment) => total + segment.steps.length + 1, 0);
}

/**
 * Play one node.
 *
 * Rest nodes resolve without a decision — the choice to rest *was* the
 * decision, and asking the player to confirm it would put a second entry in the
 * log for one act.
 */
async function playNode(
  state: RunState,
  node: NodeSpec,
  policy: RunPolicy,
  record: (decision: RunDecision) => void,
  opponent: Policy,
  options: PlayRunOptions,
): Promise<NodeResult> {
  if (!node.encounter) return { node };

  // Record the player's choices as they are made. Only the player's: the
  // opponent is a deterministic policy over a view it is handed, so recording
  // its answers would be recording the engine's output as though it were input.
  const recording: Policy = async (view) => {
    const choice = await policy.battle(view);
    record({ kind: 'battle', choice });
    return choice;
  };

  const run = await runBattle(
    battleTeamFor(state.party),
    node.encounter.team,
    state.seed,
    recording,
    opponent,
    {
      simSeed: node.encounter.simSeed,
      carryOver: carryOverFor(state.party),
      onStart: (session) => options.onBattle?.(session, node, state),
    },
  );

  return { node, battle: { result: run.result, party: run.session.partyState('p1'), casualties: run.casualties } };
}

// ---------------------------------------------------------------------------
// Scripted policies
// ---------------------------------------------------------------------------

/**
 * A run policy that always takes the first option and the first usable move.
 *
 * The baseline a sweep measures against, and the cheapest possible proof that
 * `playRun` needs no DOM.
 */
export function scriptedRunPolicy(battle: Policy): RunPolicy {
  return {
    chooseStarter: async () => 0,
    chooseNode: async () => 0,
    battle,
  };
}

// ---------------------------------------------------------------------------
// Save, resume, replay
// ---------------------------------------------------------------------------

/** Whether a stored log was recorded against this build, engine and randomizer. */
export function isReplayable(log: RunLog): boolean {
  return log.version === RUN_LOG_VERSION && log.randomizerVersion === RANDOMIZER_VERSION;
}

/**
 * Reject an incompatible log loudly.
 *
 * Stage 0's logs are a different format under a different version string, and
 * a Stage 3 log will be different again. Replaying one of those against this
 * build would not fail — it would produce a plausible run that is not the run
 * the player recorded, which is the worst available outcome. So: refuse, and
 * say what was found.
 */
export function assertReplayable(log: RunLog): void {
  if (log.version !== RUN_LOG_VERSION) {
    throw new Error(`RunLog was recorded on ${log.version}, this build replays ${RUN_LOG_VERSION}`);
  }
  if (log.randomizerVersion !== RANDOMIZER_VERSION) {
    // Separate message from the one above, because the fix is different: an
    // engine mismatch means the log is old, and a randomizer mismatch means a
    // tuning pass moved the data under a log that is otherwise perfectly
    // replayable. Silently replaying that one produces a run the player never
    // played, on their own seed, which is the failure this whole check exists
    // to prevent.
    throw new Error(
      `RunLog was recorded on randomizer ${log.randomizerVersion ?? '(none)'}, ` +
        `this build rolls ${RANDOMIZER_VERSION}. The same seed no longer produces the same run.`,
    );
  }
}

/** A run policy backed by a recorded log, optionally handing over when it runs dry. */
export interface ReplayRunPolicy extends RunPolicy {
  /** Decisions not yet consumed. */
  remaining(): number;
}

/**
 * Turn a recorded log back into a policy.
 *
 * This is the whole of replay, and the reason it is this small is that a run
 * *is* a seed plus a decision sequence. There is no saved state to restore and
 * nothing derived to reconcile: replaying the decisions against the seed
 * reconstructs the run, or the run was never a function of its inputs.
 *
 * `live` is what makes resume different from replay. With it, the log is
 * consumed first and the player takes over at exactly the point they left off;
 * without it, running past the end of the log is an error rather than a
 * silently improvised continuation.
 */
export function replayRunPolicy(log: RunLog, live?: RunPolicy): ReplayRunPolicy {
  assertReplayable(log);
  let cursor = 0;

  const next = (kind: RunDecision['kind']): RunDecision | null => {
    const decision = log.decisions[cursor];
    if (!decision) return null;
    if (decision.kind !== kind) {
      throw new Error(`RunLog is out of step: expected a ${kind} decision at ${cursor}, found ${decision.kind}`);
    }
    cursor++;
    return decision;
  };

  const exhausted = (kind: string): never => {
    throw new Error(`RunLog ran out at decision ${cursor}, but the run wanted a ${kind}`);
  };

  return {
    remaining: () => Math.max(0, log.decisions.length - cursor),
    chooseStarter: async (options) => {
      const decision = next('starter');
      if (!decision) return live ? live.chooseStarter(options) : exhausted('starter');
      return decision.kind === 'starter' ? decision.index : exhausted('starter');
    },
    chooseNode: async (options) => {
      const decision = next('node');
      if (!decision) return live ? live.chooseNode(options) : exhausted('node');
      return decision.kind === 'node' ? decision.index : exhausted('node');
    },
    battle: async (view) => {
      const decision = next('battle');
      if (!decision) return live ? live.battle(view) : exhausted('battle');
      return decision.kind === 'battle' ? decision.choice : exhausted('battle');
    },
  };
}

/** Replay a complete log. The result must match the run that produced it. */
export function replayRun(
  log: RunLog,
  tuning: Tuning = DEFAULT_TUNING,
  options: PlayRunOptions = {},
): Promise<RunResult> {
  return playRun(log.seed, replayRunPolicy(log), tuning, options);
}

/**
 * Resume a partial log: replay what was recorded, then hand control to `live`.
 *
 * The returned log is the whole run, replayed part included, so saving it again
 * is the same operation as saving during the original run.
 */
export function resumeRun(
  log: RunLog,
  live: RunPolicy,
  tuning: Tuning = DEFAULT_TUNING,
  options: PlayRunOptions = {},
): Promise<RunResult> {
  return playRun(log.seed, replayRunPolicy(log, live), tuning, options);
}
