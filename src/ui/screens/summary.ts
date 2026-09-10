/**
 * The run summary: the end of the run, and the most designed screen in the
 * game. Stage V4.
 *
 * Top to bottom: the outcome as one word, gyms cleared as a large number over
 * eight, the route the run walked drawn across the eight locale bands, the
 * tier table with the player's row bold, the final party in slots, the
 * coverage wheel, the cause of death as a band, and two actions. Rematch is
 * the one accent on the screen; copy seed is hollow.
 *
 * **Everything here is read from run state and the decision log through
 * `core/`'s existing readers.** `gymsCleared`, `causeOfDeath`,
 * `offensiveCoverage`, `routeAt` and the history are what the screen has; the
 * V4.1 report lists them. Nothing was added to `core/` for it. The copy lives
 * in `ui/copy/summary.ts`, under `ui/` because `data/` is hashed.
 *
 * The seed stays a headline with a copy button, as it has been since Stage 1:
 * it is the only thing that makes a run shareable, comparable or reportable.
 *
 * Attributes, not verdicts: the tier row is where the run landed and says so
 * in one line; the coverage wheel is which types the party's moves reach and
 * nothing about whether that was enough; the route is what was walked.
 */
import { describeSpecCard, describeMove } from '../../core/battle/driver';
import { offensiveCoverage } from '../../core/coverage';
import { routeAt } from '../../core/encounters';
import { hpState } from '../../core/hpCopy';
import { causeOfDeath, gymsCleared, type CauseOfDeath, type RunResult, type RunState } from '../../core/run';
import { GYMS } from '../../data/gyms';
import { localeById } from '../../data/locales';
import { WHEEL_TYPES } from '../../core/battle/driver';
import { neutralChip, typeChip } from '../chip';
import { OUTCOME_WORDS, TIER_ROWS, tierRowFor } from '../copy/summary';
import { el, moveCard } from '../scene';
import { itemIcon, slotNumber } from '../slots';
import { spriteImg } from '../sprites';
import { archetypeChip } from '../archetype-chip';

export interface Summary {
  root: HTMLElement;
  render(result: RunResult): void;
  onReplaySeed(handler: (seed: string) => void): void;
  onNewSeed(handler: () => void): void;
}

export function createSummary(): Summary {
  const root = el('section', 'screen screen--summary');
  const card = el('div', 'summary');

  const outcome = el('h2', 'summary__outcome');
  const count = el('p', 'summary__gyms');
  const detail = el('p', 'summary__detail');

  const seedRow = el('div', 'summary__seed');
  const seedLabel = el('span', 'summary__seed-label');
  seedLabel.textContent = 'seed';
  const seedValue = el('code', 'summary__seed-value');
  seedRow.append(seedLabel, seedValue);

  const route = el('ol', 'route');
  route.setAttribute('aria-label', 'The route');

  const tiers = el('ol', 'tiers');
  tiers.setAttribute('aria-label', 'Gyms cleared, in five ranges');

  const cause = el('p', 'summary__cause strip');

  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'button primary-action';
  replay.textContent = 'Rematch this seed';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'button button--hollow';
  copy.textContent = 'Copy seed';
  const fresh = document.createElement('button');
  fresh.type = 'button';
  fresh.className = 'button button--hollow';
  fresh.textContent = 'New seed';
  const actions = el('div', 'summary__actions');
  actions.append(replay, copy, fresh);

  const teamHeading = el('h3', 'summary__section');
  teamHeading.textContent = 'Final party';
  const team = el('div', 'summary__team');
  const coverageHeading = el('h3', 'summary__section');
  coverageHeading.textContent = 'Coverage';
  const coverage = el('div', 'coverage');
  const nodesHeading = el('h3', 'summary__section');
  nodesHeading.textContent = 'The run';
  const list = el('ol', 'summary__nodes');

  card.append(outcome, count, detail, seedRow, route, tiers, cause, actions, teamHeading, team, coverageHeading, coverage, nodesHeading, list);
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
        copy.textContent = 'Copy seed';
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
      const cleared = gymsCleared(state);
      seed = state.seed;

      root.dataset['outcome'] = result.outcome;
      outcome.textContent = OUTCOME_WORDS[result.outcome];
      count.replaceChildren(numberOf(cleared), fractionOf(GYMS.length));
      count.setAttribute('aria-label', `${cleared} of ${GYMS.length} gyms cleared`);
      detail.textContent = describeRun(state, cleared);
      seedValue.textContent = seed;

      route.replaceChildren(...renderRoute(state));
      tiers.replaceChildren(...renderTiers(cleared));

      const death = causeOfDeath(state);
      cause.textContent = death ? describeDeath(death) : '';
      // Absent on victory: hidden, and empty, so nothing reads a stale line.
      cause.hidden = !death;

      team.replaceChildren(...state.party.map(renderMember));
      coverage.replaceChildren(renderCoverage(state));
      list.replaceChildren(...state.history.map((visit) => renderVisit(visit, state)));
    },
    onReplaySeed: (handler) => replay.addEventListener('click', () => handler(seed)),
    onNewSeed: (handler) => fresh.addEventListener('click', () => handler()),
  };
}

function numberOf(cleared: number): HTMLElement {
  const big = el('span', 'summary__gyms-count');
  big.textContent = String(cleared);
  return big;
}

function fractionOf(total: number): HTMLElement {
  const of = el('span', 'summary__gyms-of');
  of.textContent = ` / ${total}`;
  return of;
}

function selectText(node: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = globalThis.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/**
 * The route: eight bands, one per segment, in the locale the segment was
 * walked through (neutral for one never reached), one dot per node taken,
 * the gym dot larger, the death point marked. The decision log drawn.
 *
 * Dots come from the history, which is the list of nodes the run went
 * through; every non-gym entry is one logged `node` decision, and
 * `test/summary.test.ts` holds the two counts against each other.
 */
function renderRoute(state: RunState): HTMLElement[] {
  const death = causeOfDeath(state);
  const lastIndex = state.history.length - 1;
  let seen = 0;
  return state.segments.map((segment, index) => {
    const choice = state.localeChoices[index];
    const locale = choice == null ? null : routeAt(segment, choice).locale;
    const band = el('li', `route__band${locale ? ` locale--${locale}` : ' route__band--unreached'}`);
    band.dataset['segment'] = String(index + 1);
    band.title = locale ? `${localeById(locale).name} · ${segment.leader}` : segment.leader;
    const visits = state.history.filter((visit) => visit.segment === index);
    for (const visit of visits) {
      const dot = el('span', `route__dot${visit.node.kind === 'gym' ? ' route__dot--gym' : ''}`);
      dot.dataset['kind'] = visit.node.kind;
      const position = seen++;
      if (death && position === lastIndex) dot.classList.add('route__dot--death');
      band.append(dot);
    }
    return band;
  });
}

/** The five rows, the player's bold. */
function renderTiers(cleared: number): HTMLElement[] {
  const here = tierRowFor(cleared);
  return TIER_ROWS.map((row) => {
    const item = el('li', `tiers__row${row === here ? ' tiers__row--here' : ''}`);
    if (row === here) item.setAttribute('aria-current', 'true');
    const icon = el('span', 'tiers__icon');
    icon.innerHTML = row.icon;
    const range = el('span', 'tiers__range');
    range.textContent = row.range;
    const copy = el('span', 'tiers__copy');
    copy.textContent = row.copy;
    item.append(icon, range, copy);
    return item;
  });
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
 * A party member as it finished, in a numbered slot: sprite, level, types,
 * ability, every move through the shared move card, and the held item.
 *
 * `describeSpecCard` is asked for the typing and move data rather than the
 * party state, because `ui/` may not import the sim and a screen that showed
 * moves without their types would be hiding the half of a randomizer roll
 * that makes it interesting.
 */
function renderMember(member: RunState['party'][number], index: number): HTMLElement {
  const card = el('div', 'summary__member');
  card.dataset['slot'] = String(index + 1);
  const detail = describeSpecCard(member.spec);

  const header = el('div', 'summary__member-header');
  const name = el('span', 'starter__name');
  name.textContent = detail.species;
  const level = el('span', 'starter__level');
  level.textContent = `Lv${detail.level}`;
  const types = el('span', 'panel__types');
  types.replaceChildren(...detail.types.map((type) => typeChip(type)));
  header.append(slotNumber(index), name, level, archetypeChip(detail.baseStats), types);

  const figure = el('div', 'summary__member-figure');
  figure.append(spriteImg(detail.species));

  const meta = el('div', 'summary__member-meta');
  meta.append(neutralChip(detail.ability, 'ability', { tip: `ability:${detail.abilityId}` }));
  if (member.item) {
    const held = el('span', 'summary__member-item');
    held.append(itemIcon(member.item));
    held.dataset['tip'] = `item:${member.item}`;
    meta.append(held);
  }
  const hp = el('span', 'summary__member-hp');
  hp.textContent = hpState(member.hp, member.maxHp);
  meta.append(hp);

  const moves = el('div', 'summary__member-moves');
  moves.replaceChildren(
    ...member.moves.map((move) => {
      const facts = describeMove(move.name);
      return facts ? moveCard({ ...facts, maxPp: move.maxPp }) : el('span', 'move move--card');
    }),
  );

  card.append(header, figure, meta, moves, renderContribution(member));
  return card;
}

/**
 * The coverage wheel: eighteen spokes, one per type in the chart's order,
 * the ones the party's damaging moves reach filled. Read from
 * `offensiveCoverage` and nothing else. No score, no count, no colour that
 * says whether eleven of eighteen is good.
 */
function renderCoverage(state: RunState): HTMLElement {
  const covered = new Set(offensiveCoverage(state.party));
  const size = 120;
  const centre = size / 2;
  const spokes = WHEEL_TYPES.map((type, index) => {
    const angle = (index / WHEEL_TYPES.length) * Math.PI * 2 - Math.PI / 2;
    const x = centre + Math.cos(angle) * (centre - 14);
    const y = centre + Math.sin(angle) * (centre - 14);
    const hit = covered.has(type);
    return (
      `<line x1="${centre}" y1="${centre}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="coverage__spoke${hit ? ' coverage__spoke--covered' : ''}" data-type="${type}"/>` +
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hit ? 4 : 2}" class="coverage__tip${hit ? ' coverage__tip--covered' : ''}" data-type="${type}"><title>${type}${hit ? '' : ' (not reached)'}</title></circle>`
    );
  });
  const wheel = el('div', 'coverage__wheel');
  wheel.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Types the party's moves reach">${spokes.join('')}</svg>`;
  const legend = el('p', 'coverage__legend');
  legend.textContent = covered.size === 0 ? 'No damaging moves.' : `Reaches ${[...covered].join(', ')}.`;
  const box = el('div', 'coverage__box');
  box.append(wheel, legend);
  return box;
}

/**
 * What this member did across the whole run. **Stage 4.7, Part 5.**
 *
 * The run summary is the first of contribution's three surfaces, and it is the
 * one the numbers were built for: the question is whether the run had a party
 * or a solo carry with three passengers, and this is where a player finds out.
 *
 * **Raw counts, in party order, with no share and no score.** Percentages are
 * computed at render *when a denominator has been agreed on*, and this row has
 * not agreed on one — damage dealt as a share of what? The run's total? The
 * party's? A composite would hide the arithmetic inside a single number, which
 * is a verdict wearing a statistic.
 *
 * The Part 4 amendment is what makes this allowed at all: a factual readout of
 * what has already happened is an attribute. What stays forbidden, here and
 * everywhere: calling a member underperforming, marking a swap candidate,
 * ordering this list by contribution, or projecting any of it forward.
 */
function renderContribution(member: RunState['party'][number]): HTMLElement {
  const row = el('div', 'party__contribution');
  const counters = member.contribution;
  const entries: [string, number][] = [
    ['Dealt', counters.damageDealt],
    ['Taken', counters.damageTaken],
    ['KOs', counters.kos],
    ['Faints', counters.faints],
    ['Turns', counters.turnsOnField],
  ];
  for (const [label, value] of entries) {
    const cell = el('span', 'party__contribution-cell');
    const name = el('span', 'party__contribution-label');
    name.textContent = label;
    const count = el('span', 'party__contribution-value');
    count.textContent = String(value);
    cell.append(name, count);
    row.append(cell);
  }
  return row;
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
