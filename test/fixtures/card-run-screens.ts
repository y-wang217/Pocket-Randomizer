/**
 * Run logs that stop on a given screen of the card run, for the browser tests
 * of step 7b (`test/visual-card-run.test.ts`). Each is played by the run bot
 * (`core/cards/cardrunBot.ts`) with two fixed preferences, so a seed always
 * reaches the same screen: a Town at every stop, and Concuss whenever an offer
 * holds it. Nothing here draws.
 */
import { createRun, stepRun, type CardRunState, type RunAction, type RunLog } from '../../src/core/cards/cardrun';
import { runBotAction } from '../../src/core/cards/cardrunBot';
import { guardBot } from '../../src/core/cards/guard';
import { select } from '../../src/core/cards/plan';
import { viewOf } from '../../src/core/cards/view';

export interface RunAt {
  log: RunLog;
  run: CardRunState;
}

/** The town-going, Concuss-taking bot's run on `seed`, up to the first state `until` holds for. */
export function runTo(seed: string, until: (s: CardRunState) => boolean, limit = 20_000): RunAt {
  const bot = guardBot();
  let run = createRun(seed);
  const actions: RunAction[] = [];
  for (let i = 0; i < limit; i++) {
    if (until(run)) return { log: { version: run.version, seed, actions }, run };
    let action: RunAction | null;
    if (run.screen.k === 'route') action = { type: 'go', to: 'town' };
    else if (run.screen.k === 'cards') action = { type: 'pick', index: Math.max(0, run.screen.offer.indexOf('concuss')) };
    else action = runBotAction(run, bot);
    if (!action) break;
    const result = stepRun(run, action);
    if (!result.ok) throw new Error(`${JSON.stringify(action)}: ${result.reason}`);
    actions.push(action);
    run = result.state;
  }
  throw new Error(`run ${seed} never reached the screen`);
}

/** A run battle in act 2 or later, planning, where the Gunner's Concuss would stun a veteran. */
export function concussOnVeteran(s: CardRunState): boolean {
  const battle = s.battle?.state;
  if (s.screen.k !== 'battle' || !battle || battle.phase !== 'plan' || battle.plan.length > 0) return false;
  const node = s.nodes[s.at];
  if (!node || node.act < 1) return false;
  const card = battle.piles.hand.find((iid) => battle.cards[iid]!.def === 'concuss');
  if (!card) return false;
  const planned = select(battle, { type: 'select', card, unit: 'B' });
  if (!planned.ok) return false;
  return viewOf(planned.state).enemies.some((e) => e.veteranOf !== null && (e.planned?.stun ?? 0) > 0);
}
