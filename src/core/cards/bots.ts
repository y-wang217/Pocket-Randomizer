/**
 * `randomBot`: a random legal action. The fuzz and speed gates drive it,
 * and it is the floor any later bot is measured against. Its draws come
 * from its own seed under `CARD_BOT_KEY` on `policy`, never from the battle's
 * stream, so a bot's choices cannot move what the battle draws.
 */
import { createRng, type RngStream } from '../rng';
import { CARD_BOT_KEY } from '../streamKeys';
import { createBattle } from './create';
import type { BattleEvent } from './events';
import { completeChoices, playersOf } from './legal';
import { newLog, type BattleLog } from './log';
import type { Action, BattleState, UnitId } from './state';
import { step, type StepResult } from './step';

export function botStream(botSeed: string): RngStream {
  return createRng(botSeed).policy.at(CARD_BOT_KEY);
}

/**
 * A random legal action, or `null` once the battle is over. It picks among
 * End Turn, each planned play to take back, and each card-and-unit pair in
 * hand; a pair with no legal choice is struck and it picks again, and a pair
 * that has some takes one of them at random. Not uniform over every action,
 * deliberately: weighting by pair keeps it from spending most of its moves
 * on whichever card has the most tiles, and it never has to list every
 * action to make one.
 */
export function randomBot(state: BattleState, stream: RngStream): Action | null {
  if (state.phase !== 'plan') return null;
  type Pick = Action | { card: string; unit: UnitId };
  const menu: Pick[] = [{ type: 'commit' }];
  state.plan.forEach((_, planIndex) => menu.push({ type: 'unselect', planIndex }));
  for (const card of state.piles.hand) {
    if (state.plan.some((p) => p.card === card)) continue;
    for (const unit of playersOf(state, card)) menu.push({ card, unit });
  }
  while (menu.length > 0) {
    const index = stream.nextInt(menu.length);
    const pick = menu[index]!;
    if ('type' in pick) return pick;
    const choices = completeChoices(state, pick.card, pick.unit);
    if (choices.length > 0) {
      const choice = choices[stream.nextInt(choices.length)];
      return choice ? { type: 'select', card: pick.card, unit: pick.unit, choice } : { type: 'select', card: pick.card, unit: pick.unit };
    }
    menu.splice(index, 1);
  }
  return null;
}

export interface BotBattle {
  log: BattleLog;
  state: BattleState;
  events: BattleEvent[];
  steps: number;
}

/**
 * One battle played out by a policy. `onStep` sees every step, accepted or
 * not, with the state it was applied to; the fuzz gate checks invariants
 * there. A battle the engine never ends stops at `maxSteps` and says so by
 * returning a state still in `plan`.
 */
export function playBattle(
  encounterId: string,
  seed: string,
  policy: (state: BattleState) => Action | null,
  onStep?: (before: BattleState, action: Action, result: StepResult) => void,
  maxSteps = 5000,
): BotBattle {
  const created = createBattle(encounterId, seed);
  if (!created.ok) throw new Error(`unknown encounter ${encounterId}`);
  let state = created.state;
  const events = [...created.events];
  const log = newLog(seed, encounterId, created.state.deckId);
  let steps = 0;
  while (state.phase === 'plan' && steps < maxSteps) {
    const action = policy(state);
    if (!action) break;
    const result = step(state, action);
    onStep?.(state, action, result);
    steps++;
    if (!result.ok) continue;
    log.actions.push(action);
    events.push(...result.events);
    state = result.state;
  }
  return { log, state, events, steps };
}
