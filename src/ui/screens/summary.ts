/**
 * The run summary: the seed, how far you got, what you were, and what killed you.
 *
 * **The seed is the headline rather than a footnote**, and it has a copy button.
 * It is the only thing that makes a run shareable, comparable or reportable — a
 * summary that buries it throws the run away, and one that makes it
 * hand-transcribable throws away most of it.
 *
 * The other three panels answer the three questions a player actually has when
 * a run ends:
 *
 *   - *How far did I get?* Gyms cleared out of eight, named, so "four" is
 *     "Garnet, Marina, Volta, Fern" rather than a number.
 *   - *What was I?* The final team with species, ability and every move. In a
 *     randomizer this is most of the run's identity, and it is the part a player
 *     wants to screenshot.
 *   - *What killed me?* Which gym, which opposing Pokemon, which move. "You
 *     lost" is not a summary; "Vesper's Chandelure, Sacred Fire, at gym 7" is
 *     something to plan against next time.
 */
import { hpState } from '../../core/hpCopy';
import { describeSpecCard } from '../../core/battle/driver';
import { causeOfDeath, gymsCleared, type CauseOfDeath, type RunResult, type RunState } from '../../core/run';
import { GYMS } from '../../data/gyms';
import { el } from '../scene';
import { typeChip } from './starter-select';

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

  const seedRow = el('div', 'summary__seed');
  const seedLabel = el('span', 'summary__seed-label');
  seedLabel.textContent = 'seed';
  const seedValue = el('code', 'summary__seed-value');
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'button button--small';
  copy.textContent = 'Copy';
  seedRow.append(seedLabel, seedValue, copy);

  const progress = el('div', 'summary__progress');
  const cause = el('p', 'summary__cause');
  const teamHeading = el('h3', 'summary__section');
  teamHeading.textContent = 'Final team';
  const team = el('div', 'summary__team');
  const nodesHeading = el('h3', 'summary__section');
  nodesHeading.textContent = 'The run';
  const list = el('ol', 'summary__nodes');

  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'button button--primary';
  replay.textContent = 'Rematch this seed';

  const fresh = document.createElement('button');
  fresh.type = 'button';
  fresh.className = 'button';
  fresh.textContent = 'New seed';

  const actions = el('div', 'summary__actions');
  actions.append(replay, fresh);
  card.append(title, detail, seedRow, progress, cause, actions, teamHeading, team, nodesHeading, list);
  root.append(card);

  let seed = '';

  copy.addEventListener('click', () => {
    // Best effort, and a visible fallback. `navigator.clipboard` is absent on
    // insecure origins and can reject when the page is not focused, and a copy
    // button that silently does nothing is worse than no copy button — so on
    // failure the seed is selected instead, which leaves Ctrl-C one key away.
    const done = (ok: boolean): void => {
      copy.textContent = ok ? 'Copied' : 'Select and copy';
      setTimeout(() => {
        copy.textContent = 'Copy';
      }, 1500);
    };
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard) {
      selectText(seedValue);
      done(false);
      return;
    }
    clipboard.writeText(seed).then(
      () => done(true),
      () => {
        selectText(seedValue);
        done(false);
      },
    );
  });

  return {
    root,
    render(result) {
      const state = result.state;
      const won = result.outcome === 'victory';
      const cleared = gymsCleared(state);
      seed = state.seed;

      root.dataset['outcome'] = result.outcome;
      title.textContent = won ? 'Champion' : 'Run over';
      detail.textContent = describeRun(state, cleared);
      seedValue.textContent = seed;

      progress.replaceChildren(...renderProgress(cleared));

      const death = causeOfDeath(state);
      cause.textContent = death ? describeDeath(death) : 'All eight gyms cleared. Nothing killed you.';
      cause.hidden = won && !death;

      team.replaceChildren(...state.party.map(renderMember));
      list.replaceChildren(...state.history.map((visit) => renderVisit(visit, state)));
    },
    onReplaySeed: (handler) => replay.addEventListener('click', () => handler(seed)),
    onNewSeed: (handler) => fresh.addEventListener('click', () => handler()),
  };
}

function selectText(node: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = globalThis.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** The eight badges, filled in as far as the run got. */
function renderProgress(cleared: number): HTMLElement[] {
  const count = el('span', 'summary__count');
  count.textContent = `${cleared} / ${GYMS.length} gyms`;

  const badges = GYMS.map((gym, index) => {
    const badge = el('span', `summary__badge summary__badge--${index < cleared ? 'won' : 'missed'}`);
    badge.textContent = gym.leader;
    badge.title = `${gym.leader} — ${gym.type}`;
    return badge;
  });

  return [count, ...badges];
}

function describeRun(state: RunState, cleared: number): string {
  const fights = state.history.filter((visit) => visit.result);
  const turns = fights.reduce((total, visit) => total + (visit.result?.turns ?? 0), 0);
  const rests = state.history.filter((visit) => visit.node.kind === 'rest').length;
  return `${cleared} gyms · ${state.history.length} nodes · ${fights.length} fights · ${turns} turns · ${rests} rests`;
}

/**
 * The cause of death, in one sentence.
 *
 * Falls back through what the protocol actually reported. A faint with no
 * killing move is a real outcome — poison, recoil, a burn — and saying
 * "something" is more honest than inventing an attacker.
 */
function describeDeath(death: CauseOfDeath): string {
  const where =
    death.kind === 'gym'
      ? `fighting ${death.leader} at gym ${death.segment + 1}`
      : `at a ${death.kind} node in segment ${death.segment + 1}, on the way to ${death.leader}`;

  if (death.byMove && death.bySpecies) {
    return `${death.species} fainted to ${death.bySpecies}'s ${death.byMove}, ${where}.`;
  }
  if (death.indirect) {
    return `${death.species} fainted to ${death.indirect}, ${where}.`;
  }
  return `${death.species} fainted ${where}.`;
}

/**
 * A party member as it finished: species, typing, ability, and all four moves
 * with the PP left on them.
 *
 * `describeSpecCard` is asked for the typing and move data rather than the
 * party state, because `ui/` may not import the sim and a screen that showed
 * moves without their types would be hiding the half of a randomizer roll that
 * makes it interesting.
 */
function renderMember(member: RunState['party'][number]): HTMLElement {
  const card = el('div', 'summary__member');
  const detail = describeSpecCard(member.spec);

  const header = el('div', 'starter__header');
  const name = el('span', 'starter__name');
  name.textContent = detail.species;
  const level = el('span', 'starter__level');
  level.textContent = `Lv${detail.level}`;
  const types = el('span', 'panel__types');
  types.replaceChildren(...detail.types.map(typeChip));
  header.append(name, level, types);

  const meta = el('div', 'starter__meta');
  meta.textContent = `${detail.ability} · ${hpState(member.hp, member.maxHp)}`;

  const moves = el('ul', 'starter__moves');
  moves.replaceChildren(
    ...detail.moves.map((move, index) => {
      const row = el('li', 'starter__move');
      const label = el('span', 'starter__move-name');
      label.textContent = move.name;
      const stats = el('span', 'starter__move-stats');
      stats.append(typeChip(move.type));
      const power = el('span', 'move__power');
      power.textContent = move.category === 'Status' ? 'Status' : `${move.basePower} BP`;
      const pp = el('span', 'move__pp');
      const left = member.moves[index];
      pp.textContent = left ? `${left.pp}/${left.maxPp} PP` : `${move.maxPp} PP`;
      stats.append(power, pp);
      row.append(label, stats);
      return row;
    }),
  );

  card.append(header, meta, moves);
  return card;
}

function renderVisit(visit: RunState['history'][number], state: RunState): HTMLElement {
  const row = el('li', `summary__node summary__node--${visit.node.kind}`);

  const segment = el('span', 'summary__node-segment');
  segment.textContent = `${visit.segment + 1}`;
  segment.title = `${state.segments[visit.segment]?.leader ?? ''}'s segment`;

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

  row.append(segment, label, outcome, hp);
  return row;
}
