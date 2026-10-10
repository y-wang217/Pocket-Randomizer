/**
 * A scripted player for the card run, for tests and the bench
 * (`npm run cards:run`): the guard bot fights every battle, and a fixed
 * order of preferences makes every other decision. It draws nothing: a stop
 * choice is a function of the run state, so a run it plays is a function of
 * the seed alone.
 *
 * It is not a good player of the run, only a complete one. Nothing a person
 * plays reads it.
 */
import { EVENTS } from '../../cardData/cardrunTables';
import type { Action, BattleState } from './state';
import { campPrice, currentStop, eventOptionOpen, stepRun, upgradable, type CardRunState, type RunAction, type StopKind } from './cardrun';
import { guardBot } from './guard';

/** The stop the bot picks at its n-th stop: it cycles, so a run sees all three. */
const STOP_CYCLE: readonly StopKind[] = ['town', 'wild', 'city'];

export interface RunBotResult {
  state: CardRunState;
  actions: RunAction[];
}

/** The decision the bot makes on the screen the run shows. `null` once the run is over. */
export function runBotAction(s: CardRunState, battle: (state: BattleState) => Action | null = guardBot()): RunAction | null {
  const screen = s.screen;
  switch (screen.k) {
    case 'over':
      return null;
    case 'battle': {
      const action = s.battle && battle(s.battle.state);
      return action ? { type: 'battle', action } : null;
    }
    case 'route':
    case 'market':
    case 'wild':
      // The camp first, whenever an upgrade is affordable.
      if (campPrice(s).payable) return { type: 'upgrade', index: upgradable(s)[0]! };
      if (screen.k === 'route') {
        const stops = s.nodes.slice(0, s.at).filter((n) => n.kind === 'stop').length;
        return { type: 'go', to: STOP_CYCLE[stops % STOP_CYCLE.length]! };
      }
      if (screen.k === 'market') {
        const stop = currentStop(s)!;
        const index = stop.city.market.findIndex((item, i) => !screen.bought.includes(i) && item.price <= s.supplies);
        return index >= 0 ? { type: 'buy', index } : { type: 'leave' };
      }
      {
        const event = currentStop(s)!.wild.event;
        if (!event) return { type: 'leave' };
        const option = EVENTS[event]!.options.findIndex((o) => eventOptionOpen(s, o).open);
        return { type: 'event', option };
      }
    case 'city':
      return s.supplies >= 2 ? { type: 'market' } : { type: 'defend' };
    case 'cards':
    case 'boost':
      return { type: 'pick', index: 0 };
    case 'upgrade':
      return { type: 'upgrade', index: upgradable(s)[0]! };
    case 'remove':
      return { type: 'remove', index: 0 };
  }
}

/** Play a run to its end, or until `limit` actions. Throws if the run refuses a bot action: a bug either way. */
export function playRunBot(s: CardRunState, limit = 20_000, battle = guardBot()): RunBotResult {
  const actions: RunAction[] = [];
  let state = s;
  for (let i = 0; i < limit; i++) {
    const action = runBotAction(state, battle);
    if (!action) break;
    const result = stepRun(state, action);
    if (!result.ok) throw new Error(`card run bot: ${JSON.stringify(action)} refused: ${result.reason} ${result.battleReason ?? ''}`);
    actions.push(action);
    state = result.state;
  }
  return { state, actions };
}
