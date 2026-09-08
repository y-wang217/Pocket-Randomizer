/**
 * The run map: where you are in the run, where you are in the segment, and what
 * the run has cost so far.
 *
 * Three decisions worth naming.
 *
 * **The whole eight-gym rail is on screen, always.** Stage 1 had one segment and
 * a step chain was the entire map. Eight segments without a rail is a game where
 * the player cannot tell whether they are doing well — "Volta's Gym" means
 * nothing on its own, and "gym 3 of 8, five to go" means everything. The rail
 * also names each leader's type from the start, because a run is planned around
 * type matchups and hiding them would make planning guesswork rather than
 * knowledge.
 *
 * **Upcoming steps are shown.** The map reveals node *kinds* for every step, not
 * just the current one. It never reveals contents — what a wild node contains is
 * unknown until you enter it — so this is not a spoiler, it is the difference
 * between a choice and a coin flip: taking a fight now is a different decision
 * when you can see a rest two steps ahead.
 *
 * **The party panel is always on screen.** HP and PP are the resources a run
 * spends, and a rest node is only a real option if the cost of skipping it is
 * visible at the moment you skip it.
 */
import type { NodeSpec, Segment } from '../../core/encounters';
import { hpFraction } from '../../core/party';
import type { NodeVisit, RunState } from '../../core/run';
import { gymsCleared } from '../../core/run';
import type { PokemonState } from '../../core/types';
import { GYMS } from '../../data/gyms';
import { el } from '../scene';
import { typeChip } from './starter-select';

const KIND_LABELS: Record<NodeSpec['kind'], string> = {
  wild: 'Wild',
  trainer: 'Trainer',
  rest: 'Rest',
  gym: 'Gym',
  shop: 'Shop',
  event: '?',
};

const KIND_HINTS: Record<NodeSpec['kind'], string> = {
  wild: 'A wild Pokemon. Cheaper than a trainer, and still costs something.',
  trainer: 'A trained Pokemon. Tougher, and the level band is higher.',
  rest: 'Restore HP, PP and status in full.',
  gym: 'The gym leader. Beat them and the segment is over.',
  shop: 'Spend coins on items, healing and moves.',
  event: 'Something happens. You choose what to do about it.',
};

export interface RunMap {
  root: HTMLElement;
  /** Redraw from state. `onChoose` fires with the index of a current option. */
  render(state: RunState, onChoose: (index: number) => void): void;
}

export function createRunMap(): RunMap {
  const root = el('section', 'screen screen--map');

  const rail = el('ol', 'rail');

  const heading = el('div', 'map__heading');
  const title = el('h2', 'screen__title');
  const subtitle = el('p', 'screen__blurb');
  const blurb = el('p', 'map__blurb');
  heading.append(title, subtitle, blurb);

  const chain = el('ol', 'chain');
  const party = el('div', 'party');

  root.append(rail, heading, chain, party);

  return {
    root,
    render(state, onChoose) {
      const segment = state.segments[state.currentSegment];
      if (!segment) return;

      rail.replaceChildren(...renderRail(state));

      const gym = segment.gymDefinition;
      const team = segment.gym.encounter?.team.length ?? 1;
      title.textContent = `Gym ${state.currentSegment + 1} of ${state.segments.length} — ${gym.leader}`;
      subtitle.replaceChildren(
        typeChip(gym.type),
        // The gym's team size is public and the level band is not. Size changes
        // how the fight is *approached* — a solo Pokemon against three has to
        // budget PP — so hiding it would hide the decision rather than create one.
        document.createTextNode(
          ` · ${team} Pokemon · ${segment.steps.length} steps before the gym`,
        ),
      );
      blurb.textContent = gym.blurb;

      chain.replaceChildren(...renderChain(state, segment, onChoose));
      party.replaceChildren(...state.party.map(renderMember));
    },
  };
}

/**
 * The eight-gym rail.
 *
 * Cleared gyms are marked from `gymsCleared` rather than from the segment index,
 * because those are different numbers the moment a run ends at a gym: you are
 * *at* segment 3 having cleared 2.
 */
function renderRail(state: RunState): HTMLElement[] {
  const cleared = gymsCleared(state);

  return GYMS.map((gym, index) => {
    const phase = index < cleared ? 'done' : index === state.currentSegment ? 'current' : 'upcoming';
    const item = el('li', `rail__gym rail__gym--${phase}`);

    const number = el('span', 'rail__number');
    number.textContent = phase === 'done' ? '✓' : String(index + 1);

    const label = el('span', 'rail__label');
    label.textContent = gym.leader;

    item.append(number, label, typeChip(gym.type));
    item.title = `${gym.leader} — ${gym.type}. ${gym.blurb}`;
    return item;
  });
}

function renderChain(
  state: RunState,
  segment: Segment,
  onChoose: (index: number) => void,
): HTMLElement[] {
  // Only this segment's visits. History is the whole run now, so filtering by
  // segment is what keeps step 1 of segment 4 from reading step 1 of segment 1's
  // result — the bug the Stage 1 version would have had the moment there were
  // two segments.
  const visits = state.history.filter(
    (visit) => visit.segment === state.currentSegment && visit.node.kind !== 'gym',
  );

  const rows = segment.steps.map((step) => {
    const done = visits[step.index];
    if (done) return renderStep(step.index, [done.node], 'done', done);
    if (step.index === state.position && !state.outcome) {
      return renderStep(step.index, step.options, 'current', undefined, onChoose);
    }
    return renderStep(step.index, step.options, 'upcoming');
  });

  const gymVisit = state.history.find(
    (visit) => visit.segment === state.currentSegment && visit.node.kind === 'gym',
  );
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
  // what a node contains before the player has chosen it. A gym's team size is
  // named too — see the heading.
  const size = node.encounter?.team.length ?? 0;
  label.textContent =
    node.kind === 'gym'
      ? `${node.label}${size > 1 ? ` · ${size} Pokemon` : ''}`
      : KIND_LABELS[node.kind];

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

  // The ability is on the party panel and not only on the starter screen. In a
  // randomizer it is not flavour — it is half of what the Pokemon *is*, it was
  // rolled rather than chosen, and it is the thing a player forgets between the
  // starter select and segment 6.
  const ability = el('span', 'party__ability');
  ability.textContent = member.spec.ability;
  header.append(ability);

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
