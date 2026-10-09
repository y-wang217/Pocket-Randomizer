/**
 * The battle log, replay, and the playtest readout.
 *
 * A log is the seed, the encounter, and every accepted action in order,
 * selects and unselects included. Replaying it reproduces the final state and
 * the full event stream exactly, because the battle draws only from its own
 * seed and a step is a pure function of state and action.
 *
 * `CARD_ENGINE_VERSION` is stamped on every log. It is not one of the run's
 * four version axes and none of them moves with it. A log from another
 * version is refused loudly, naming both values; it is never reinterpreted.
 */
import { CARDS } from '../../cardData/cards';
import { createBattle } from './create';
import type { BattleEvent } from './events';
import { legalActions } from './legal';
import { cardDefOf, livingUnits, project } from './plan';
import type { Action, BattleState, UnitId } from './state';
import { step } from './step';
import { inDanger } from './zones';

/** Bumps when a logged action, a rule or a resolver changes what a log replays to. */
export const CARD_ENGINE_VERSION = 'cards-0.3.0';

export interface BattleLog {
  engineVersion: string;
  seed: string;
  encounterId: string;
  deckId: string;
  actions: Action[];
}

export function newLog(seed: string, encounterId: string, deckId: string): BattleLog {
  return { engineVersion: CARD_ENGINE_VERSION, seed, encounterId, deckId, actions: [] };
}

export interface Replayed {
  state: BattleState;
  events: BattleEvent[];
}

/**
 * Replay a log. Throws, loudly, on a version mismatch, an unknown encounter,
 * or an action the engine refuses: a log that does not replay is a bug report,
 * not something to paper over. `onStep` sees every accepted step.
 */
export function replay(log: BattleLog, onStep?: (before: BattleState, action: Action, after: BattleState, events: BattleEvent[]) => void): Replayed {
  if (log.engineVersion !== CARD_ENGINE_VERSION) {
    throw new Error(`card engine version mismatch: the log was written by ${log.engineVersion}, this build is ${CARD_ENGINE_VERSION}`);
  }
  const created = createBattle(log.encounterId, log.seed);
  if (!created.ok) throw new Error(`the log names an unknown encounter: ${log.encounterId}`);
  if (created.state.deckId !== log.deckId) {
    throw new Error(`deck mismatch: the log was played with ${log.deckId}, encounter ${log.encounterId} deals ${created.state.deckId}`);
  }
  let state = created.state;
  const events = [...created.events];
  log.actions.forEach((action, index) => {
    const result = step(state, action);
    if (!result.ok) throw new Error(`the log does not replay: action ${index} (${JSON.stringify(action)}) refused: ${result.reason}`);
    onStep?.(state, action, result.state, result.events);
    events.push(...result.events);
    state = result.state;
  });
  return { state, events };
}

/** The card whose casts the readout tracks: the slice's one banked payoff. */
const BANKED_CARD = 'moon-strike';

/** The numbers the fun test asks about. Counts only, no judgement. */
export interface PlaytestReadout {
  engineVersion: string;
  seed: string;
  encounterId: string;
  outcome: 'won' | 'lost' | 'unfinished';
  /** The round the battle ended on, or the round it stands on. */
  rounds: number;
  /** Rounds each unit stood in the danger zone when its round resolved. */
  dangerRounds: Record<UnitId, number>;
  /** Telegraphed damaging actions that found nobody, against those that hit. */
  telegraphs: { dodged: number; taken: number };
  /** Cards played in each committed round, in order. */
  cardsPerRound: number[];
  /** Rounds whose plan began with no card the player could play. */
  noChoiceRounds: number[];
  /** The round of each Moon Strike cast. */
  moonStrikes: number[];
  /** Neutral cards played, by the unit that played them. */
  neutralsByUnit: Record<UnitId, number>;
}

export function summarize(log: BattleLog): PlaytestReadout {
  const readout: PlaytestReadout = {
    engineVersion: log.engineVersion,
    seed: log.seed,
    encounterId: log.encounterId,
    outcome: 'unfinished',
    rounds: 0,
    dangerRounds: { A: 0, B: 0, C: 0 },
    telegraphs: { dodged: 0, taken: 0 },
    cardsPerRound: [],
    noChoiceRounds: [],
    moonStrikes: [],
    neutralsByUnit: { A: 0, B: 0, C: 0 },
  };
  const roundStart = (s: BattleState): void => {
    if (s.phase === 'plan' && !legalActions(s).some((a) => a.type === 'select')) readout.noChoiceRounds.push(s.round);
  };
  // Round 1's plan begins when the player starts the battle.
  const { state } = replay(log, (before, action, after, events) => {
    if (action.type === 'start') roundStart(after);
    if (action.type !== 'commit') return;
    const positions = project(before);
    for (const unit of livingUnits(before)) if (inDanger(positions[unit.id]!)) readout.dangerRounds[unit.id] += 1;
    let played = 0;
    for (const event of events) {
      if (event.t === 'played') {
        played++;
        const def = cardDefOf(before, event.card);
        if (def?.id === BANKED_CARD) readout.moonStrikes.push(before.round);
        if (def?.owner === 'neutral') readout.neutralsByUnit[event.unit] += 1;
      }
      if (event.t === 'enemyActed' && event.act !== 'shield' && event.act !== 'none') readout.telegraphs.taken += 1;
      if (event.t === 'enemyMissed') {
        readout.telegraphs.dodged += 1;
        readout.telegraphs.taken -= 1;
      }
    }
    readout.cardsPerRound.push(played);
    roundStart(after);
  });
  readout.outcome = state.phase === 'plan' || state.phase === 'deploy' ? 'unfinished' : state.phase;
  readout.rounds = state.round;
  return readout;
}

/** The readout as lines of text, for the replay script. */
export function formatReadout(r: PlaytestReadout): string {
  const units = (record: Record<string, number>) => Object.entries(record).map(([id, n]) => `${id} ${n}`).join(', ');
  return [
    `card engine ${r.engineVersion}  seed ${r.seed}  encounter ${r.encounterId}`,
    `outcome            ${r.outcome} on round ${r.rounds}`,
    `danger zone rounds ${units(r.dangerRounds)}`,
    `telegraphs         ${r.telegraphs.dodged} dodged, ${r.telegraphs.taken} taken`,
    `cards per round    ${r.cardsPerRound.join(' ') || '-'}`,
    `no-choice rounds   ${r.noChoiceRounds.join(' ') || 'none'}`,
    `${`${CARDS[BANKED_CARD]!.name} casts`.padEnd(18)} ${r.moonStrikes.length ? `rounds ${r.moonStrikes.join(' ')}` : 'none'}`,
    `neutrals by unit   ${units(r.neutralsByUnit)}`,
  ].join('\n');
}
