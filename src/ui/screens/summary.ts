/**
 * The summary: seed, what happened, and how it ended.
 *
 * The seed is the headline rather than a footnote. It is the only thing that
 * makes a run shareable, comparable or reportable, and a summary that buries it
 * is a summary that throws the run away.
 */
import type { RunResult, RunState } from '../../core/run';
import { el } from '../scene';

export interface Summary {
  root: HTMLElement;
  render(result: RunResult): void;
  onReplaySeed(handler: (seed: string) => void): void;
  onNewSeed(handler: () => void): void;
}

export function createSummary(): Summary {
  const root = el('section', 'screen screen--summary');

  const card = el('div', 'summary');
  const title = el('h2', 'summary__title');
  const detail = el('p', 'summary__detail');
  const seedLine = el('p', 'summary__seed');
  const list = el('ol', 'summary__nodes');

  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'button button--primary';
  replay.textContent = 'Run this seed again';

  const fresh = document.createElement('button');
  fresh.type = 'button';
  fresh.className = 'button';
  fresh.textContent = 'New seed';

  const actions = el('div', 'summary__actions');
  actions.append(replay, fresh);
  card.append(title, detail, seedLine, list, actions);
  root.append(card);

  let seed = '';

  return {
    root,
    render(result) {
      const won = result.outcome === 'victory';
      seed = result.state.seed;

      root.dataset['outcome'] = result.outcome;
      title.textContent = won ? 'Gym cleared' : 'Run over';
      detail.textContent = describe(result.state, won);
      seedLine.textContent = `seed ${seed}`;

      list.replaceChildren(...result.state.history.map(renderVisit));
    },
    onReplaySeed: (handler) => replay.addEventListener('click', () => handler(seed)),
    onNewSeed: (handler) => fresh.addEventListener('click', () => handler()),
  };
}

function describe(state: RunState, won: boolean): string {
  const fights = state.history.filter((visit) => visit.result);
  const turns = fights.reduce((total, visit) => total + (visit.result?.turns ?? 0), 0);
  const rests = state.history.filter((visit) => visit.node.kind === 'rest').length;
  const ending = won ? 'the gym fell' : 'the party was wiped';

  return `${state.history.length} nodes · ${fights.length} fights · ${turns} turns · ${rests} rests — ${ending}.`;
}

function renderVisit(visit: RunState['history'][number]): HTMLElement {
  const row = el('li', `summary__node summary__node--${visit.node.kind}`);

  const label = el('span', 'summary__node-label');
  label.textContent = visit.node.encounter?.opponent ?? visit.node.label;

  const outcome = el('span', 'summary__node-outcome');
  if (visit.result) {
    const won = visit.result.winner === 'p1';
    outcome.textContent = `${won ? 'won' : 'lost'} in ${visit.result.turns}`;
    outcome.dataset['won'] = String(won);
  } else {
    outcome.textContent = 'rested';
  }

  const hp = el('span', 'summary__node-hp');
  hp.textContent = `${visit.hpAfter} HP`;

  row.append(label, outcome, hp);
  return row;
}
