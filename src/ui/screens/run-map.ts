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
 * visible at the moment you skip it. From Stage 4 it is a *party* panel rather
 * than one Pokemon: every member, the lead marked, held items shown, and a way
 * into the party screen — because the lead decides who walks into the node you
 * are about to choose, which makes it a decision that belongs next to the map.
 *
 * **Stage 3: every offered fight shows its tier and what it pays, before you
 * commit.** This is the most important pixel in the game. A tier that the
 * player discovers only after walking into it is not a risk they took, it is a
 * thing that happened to them — and the whole stage is the claim that the step
 * between two nodes is a decision. So a current node carries three things: the
 * tier, the exact coin payout (which is a pure function of kind, tier and
 * segment, so it can be shown without spoiling anything), and a one-line read
 * on what the reward pool behind it is like.
 *
 * What it deliberately does *not* show is the three cards themselves. They were
 * drawn when the map was built and could be displayed — but a step where you
 * can read both futures in full is an optimisation problem, not a decision.
 * Tier and payout is the amount of information that leaves a judgement to make.
 */
import type { NodeSpec, Segment } from '../../core/encounters';
import { heldItem } from '../../core/items';
import { FAINTED, hpState } from '../../core/hpCopy';
import { hpFraction } from '../../core/party';
import type { NodeVisit, RunState } from '../../core/run';
import { gymsCleared } from '../../core/run';
import { nodePayout } from '../../core/economy';
import type { PokemonState, Tier } from '../../core/types';
import { GYMS } from '../../data/gyms';
import { PARTY_SIZE } from '../../data/partyTuning';
import { el } from '../scene';
import { tierBadge } from './reward';
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

/**
 * What a tier means, in one line, in the player's terms.
 *
 * Not "+3 levels and a band shift" — that is `data/scaling.ts` talking to a
 * balance pass. This is what the number feels like from the outside.
 */
const TIER_HINTS: Record<Tier, string> = {
  normal: 'Ordinary. Modest reward.',
  hard: 'Bulkier and a level up on you. Better reward.',
  elite: 'Two of them. The best rewards in the game.',
};

export interface RunMap {
  root: HTMLElement;
  /** Redraw from state. `onChoose` fires with the index of a current option. */
  /**
   * Draw the map. `onChoose` picks a node; `onManage` opens the party screen.
   *
   * Two callbacks rather than one because they are different *kinds* of thing:
   * a node pick is a run decision that `playRun` is waiting on, and managing the
   * party is not a decision at all — it edits state between them. Collapsing
   * them into one handler would hide that difference from the one file that has
   * to keep it straight.
   */
  render(state: RunState, onChoose: (index: number) => void, onManage: () => void): void;
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
    render(state, onChoose, onManage) {
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
      // Coins live next to the party, with the other resources a run spends.
      // A shop node saying "from 55" is only a decision if this is on screen.
      /*
       * The party HUD, which is now a *party* rather than one Pokemon.
       *
       * The button to open the party screen lives here rather than in a menu,
       * because reordering is how the battle lead is set and the lead only
       * matters at the moment you are choosing which node to walk into. Putting
       * it anywhere else would make it a setting instead of a decision.
       */
      party.replaceChildren(
        renderWallet(state),
        renderPartyHeader(state.party.length, onManage),
        ...state.party.map((member, index) => renderMember(member, index)),
      );
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
    if (done) return renderStep(step.index, [done.node], 'done', segment.index, done);
    if (step.index === state.position && !state.outcome) {
      return renderStep(step.index, step.options, 'current', segment.index, undefined, onChoose);
    }
    return renderStep(step.index, step.options, 'upcoming', segment.index);
  });

  const gymVisit = state.history.find(
    (visit) => visit.segment === state.currentSegment && visit.node.kind === 'gym',
  );
  const gymPhase = gymVisit ? 'done' : state.position >= segment.steps.length ? 'current' : 'upcoming';
  rows.push(renderStep(segment.steps.length, [segment.gym], gymPhase, segment.index, gymVisit));
  return rows;
}

type Phase = 'done' | 'current' | 'upcoming';

function renderStep(
  index: number,
  options: readonly NodeSpec[],
  phase: Phase,
  segment: number,
  visit?: NodeVisit,
  onChoose?: (index: number) => void,
): HTMLElement {
  const row = el('li', `step step--${phase}`);

  const marker = el('span', 'step__marker');
  marker.textContent = String(index + 1);

  const nodes = el('div', 'step__nodes');
  nodes.append(
    ...options.map((node, option) =>
      renderNode(node, phase, segment, visit, onChoose ? () => onChoose(option) : undefined),
    ),
  );

  row.append(marker, nodes);
  return row;
}

function renderNode(
  node: NodeSpec,
  phase: Phase,
  segment: number,
  visit?: NodeVisit,
  onChoose?: () => void,
): HTMLElement {
  const interactive = Boolean(onChoose);
  const element = interactive ? document.createElement('button') : el('div', '');
  if (element instanceof HTMLButtonElement) element.type = 'button';
  element.className = `node node--${node.kind} node--${phase}${node.tier ? ` node--tier-${node.tier}` : ''}`;

  const label = el('span', 'node__label');
  // The gym is named; the rest are a kind, because naming them would reveal
  // what a node contains before the player has chosen it. A gym's team size is
  // named too — see the heading.
  const size = node.encounter?.team.length ?? 0;
  label.textContent =
    node.kind === 'gym'
      ? `${node.label}${size > 1 ? ` · ${size} Pokemon` : ''}`
      : KIND_LABELS[node.kind];

  // The tier, on the label line, on every step the player can still see. Not
  // only the current one: taking a fight now is a different decision when you
  // can see an elite two steps ahead.
  if (node.tier) label.append(document.createTextNode(' '), tierBadge(node.tier));

  const detail = el('span', 'node__detail');
  if (visit?.result) {
    // Past nodes name what was fought. That is information the player already
    // has, and it turns the chain into a record of the run rather than a
    // progress bar.
    const turns = `${visit.result.turns} turn${visit.result.turns === 1 ? '' : 's'}`;
    detail.textContent = node.encounter ? `${node.encounter.opponent} · ${turns}` : turns;
  } else if (visit) {
    detail.textContent = 'restored';
  } else if (phase === 'current') {
    /*
     * The trade, spelled out before the click.
     *
     * The coin payout is exact rather than a range, because it *is* exact — a
     * pure function of kind, tier and segment, computed by the same
     * `nodePayout` that pays it out. Showing a number the player can plan
     * against costs nothing in surprise and buys the whole decision.
     */
    const payout = nodePayout(node, segment);
    const parts: string[] = [];
    if (payout > 0) parts.push(`${payout} coins`);
    if (node.tier) parts.push(TIER_HINTS[node.tier]);
    else parts.push(KIND_HINTS[node.kind]);
    if (node.kind === 'shop' && node.shop) {
      const cheapest = Math.min(...node.shop.items.map((item) => item.price));
      parts.push(`${node.shop.items.length} on the shelf, from ${cheapest}`);
    }
    detail.textContent = parts.join(' · ');
  } else {
    detail.textContent = '';
  }

  element.append(label, detail);
  if (onChoose) element.addEventListener('click', onChoose);
  return element;
}

function renderWallet(state: RunState): HTMLElement {
  const card = el('div', 'party__wallet');
  const label = el('span', 'party__wallet-label');
  label.textContent = 'Coins';
  const value = el('span', 'party__wallet-value');
  value.textContent = String(state.currency);
  card.append(label, value);
  return card;
}

/** The party's own heading, with the way into the party screen. */
function renderPartyHeader(size: number, onManage: () => void): HTMLElement {
  const row = el('div', 'party__header');
  const label = el('span', 'party__wallet-label');
  label.textContent = `Party ${size} / ${PARTY_SIZE}`;
  const manage = document.createElement('button');
  manage.type = 'button';
  manage.className = 'button button--small';
  manage.textContent = 'Manage';
  manage.addEventListener('click', () => onManage());
  row.append(label, manage);
  return row;
}

function renderMember(member: PokemonState, index: number): HTMLElement {
  const card = el('div', 'party__member');
  // The lead is marked on the map, not only on the party screen: it is the
  // Pokemon that walks into whichever node you are about to pick.
  if (index === 0) card.classList.add('party__member--lead');
  if (member.fainted) card.classList.add('party__member--fainted');

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
  if (index === 0) {
    const lead = el('span', 'badge badge--lead');
    lead.textContent = 'Lead';
    header.append(lead);
  }

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
  hp.textContent = member.fainted ? FAINTED : hpState(member.hp, member.maxHp);
  meta.append(hp);
  // What they are holding, because Stage 4 lets the player choose who holds
  // what and a targeting decision you cannot audit is one you cannot learn from.
  const item = heldItem(member);
  if (item) {
    const chip = el('span', 'badge badge--item');
    chip.textContent = item.name;
    meta.append(chip);
  }
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
