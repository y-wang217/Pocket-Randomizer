/**
 * The run map: the whole chain, and what the run has cost so far.
 *
 * Two decisions worth naming.
 *
 * **Upcoming steps are shown.** The map reveals node *kinds* for every step,
 * not just the current one. It never reveals contents — what a wild node
 * contains is unknown until you enter it — so this is not a spoiler, it is the
 * difference between a choice and a coin flip: taking a fight now is a
 * different decision when you can see a rest two steps ahead.
 *
 * **The party panel is always on screen.** HP and PP are the resources a run
 * spends, and a rest node is only a real option if the cost of skipping it is
 * visible at the moment you skip it.
 */
import type { NodeSpec, Segment } from '../../core/encounters';
import { hpFraction } from '../../core/party';
import type { NodeVisit, RunState } from '../../core/run';
import type { PokemonState } from '../../core/types';
import { el } from '../scene';
import { typeChip } from './starter-select';

const KIND_LABELS: Record<NodeSpec['kind'], string> = {
  wild: 'Wild',
  trainer: 'Trainer',
  rest: 'Rest',
  gym: 'Gym',
};

const KIND_HINTS: Record<NodeSpec['kind'], string> = {
  wild: 'A wild Pokemon. Cheaper than a trainer, and still costs something.',
  trainer: 'A trained Pokemon. Tougher, and the level band is higher.',
  rest: 'Restore HP, PP and status in full.',
  gym: 'The gym leader. Beat them and the run is won.',
};

export interface RunMap {
  root: HTMLElement;
  /** Redraw from state. `onChoose` fires with the index of a current option. */
  render(state: RunState, onChoose: (index: number) => void): void;
}

export function createRunMap(): RunMap {
  const root = el('section', 'screen screen--map');
  const heading = el('div', 'map__heading');
  const title = el('h2', 'screen__title');
  const subtitle = el('p', 'screen__blurb');
  heading.append(title, subtitle);

  const chain = el('ol', 'chain');
  const party = el('div', 'party');

  root.append(heading, chain, party);

  return {
    root,
    render(state, onChoose) {
      const segment = state.segments[state.currentSegment];
      if (!segment) return;

      title.textContent = `Segment ${state.currentSegment + 1} — ${segment.leader}'s Gym`;
      subtitle.replaceChildren(
        document.createTextNode(`${segment.steps.length} steps, then the gym. `),
        typeChip(segment.type),
      );

      chain.replaceChildren(...renderChain(state, segment, onChoose));
      party.replaceChildren(...state.party.map(renderMember));
    },
  };
}

function renderChain(
  state: RunState,
  segment: Segment,
  onChoose: (index: number) => void,
): HTMLElement[] {
  // History is the whole run, and a step's visit is the one at that index —
  // true for as long as one step produces one visit, which the gym does not.
  const visits = state.history.filter((visit) => visit.node.kind !== 'gym');

  const rows = segment.steps.map((step) => {
    const done = visits[step.index];
    if (done) return renderStep(step.index, [done.node], 'done', done);
    if (step.index === state.position && !state.outcome) {
      return renderStep(step.index, step.options, 'current', undefined, onChoose);
    }
    return renderStep(step.index, step.options, 'upcoming');
  });

  const gymVisit = state.history.find((visit) => visit.node.kind === 'gym');
  const gymPhase = gymVisit ? 'done' : state.position >= segment.steps.length ? 'current' : 'upcoming';
  rows.push(renderStep(segment.steps.length, [segment.gym], gymPhase, gymVisit));
  return rows;
}

type Phase = 'done' | 'current' | 'upcoming';

function renderStep(
  index: number,
  options: readonly NodeSpec[],
  phase: Phase,
  visit?: NodeVisit,
  onChoose?: (index: number) => void,
): HTMLElement {
  const row = el('li', `step step--${phase}`);

  const marker = el('span', 'step__marker');
  marker.textContent = String(index + 1);

  const nodes = el('div', 'step__nodes');
  nodes.append(
    ...options.map((node, option) =>
      renderNode(node, phase, visit, onChoose ? () => onChoose(option) : undefined),
    ),
  );

  row.append(marker, nodes);
  return row;
}

function renderNode(
  node: NodeSpec,
  phase: Phase,
  visit?: NodeVisit,
  onChoose?: () => void,
): HTMLElement {
  const interactive = Boolean(onChoose);
  const element = interactive ? document.createElement('button') : el('div', '');
  if (element instanceof HTMLButtonElement) element.type = 'button';
  element.className = `node node--${node.kind} node--${phase}`;

  const label = el('span', 'node__label');
  // The gym is named; the rest are a kind, because naming them would reveal
  // what a node contains before the player has chosen it.
  label.textContent = node.kind === 'gym' ? node.label : KIND_LABELS[node.kind];

  const detail = el('span', 'node__detail');
  if (visit?.result) {
    // Past nodes name what was fought. That is information the player already
    // has, and it turns the chain into a record of the run rather than a
    // progress bar.
    const turns = `${visit.result.turns} turn${visit.result.turns === 1 ? '' : 's'}`;
    detail.textContent = node.encounter ? `${node.encounter.opponent} · ${turns}` : turns;
  } else if (visit) {
    detail.textContent = 'restored';
  } else {
    detail.textContent = phase === 'current' ? KIND_HINTS[node.kind] : '';
  }

  element.append(label, detail);
  if (onChoose) element.addEventListener('click', onChoose);
  return element;
}

function renderMember(member: PokemonState): HTMLElement {
  const card = el('div', 'party__member');

  const header = el('div', 'panel__header');
  const name = el('span', 'panel__name');
  name.textContent = member.spec.species;
  const level = el('span', 'panel__level');
  level.textContent = `Lv${member.spec.level}`;
  header.append(name, level);

  const track = el('div', 'hp');
  const fill = el('div', 'hp__fill');
  const fraction = hpFraction(member);
  fill.style.width = `${fraction * 100}%`;
  fill.dataset['band'] = fraction > 0.5 ? 'high' : fraction > 0.2 ? 'mid' : 'low';
  track.append(fill);

  const meta = el('div', 'panel__meta');
  const hp = el('span', 'panel__hp-text');
  hp.textContent = `${member.hp} / ${member.maxHp} HP`;
  meta.append(hp);
  if (member.status) {
    const status = el('span', 'badge badge--status');
    status.dataset['status'] = member.status;
    status.textContent = member.status.toUpperCase();
    meta.append(status);
  }

  const moves = el('ul', 'party__moves');
  moves.replaceChildren(
    ...member.moves.map((move) => {
      const row = el('li', 'party__move');
      const label = el('span', '');
      label.textContent = move.name;
      const pp = el('span', 'move__pp');
      pp.textContent = `${move.pp}/${move.maxPp}`;
      if (move.maxPp > 0 && move.pp / move.maxPp <= 0.25) pp.classList.add('move__pp--low');
      row.append(label, pp);
      return row;
    }),
  );

  card.append(header, track, meta, moves);
  return card;
}
