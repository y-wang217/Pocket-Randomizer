/**
 * The party screen: what you are carrying, and the two things you can do to it.
 *
 * Reorder to set the battle lead, and release a member. That is the whole
 * surface, and it is small on purpose — a party screen that also healed, or
 * moved items, or taught moves would be a second reward system with no cost
 * attached to any of it.
 *
 * **Reordering is not cosmetic.** `party.battleMembersFor` sends the party in
 * order, so slot 0 leads the next fight. Leading with the member that answers
 * the encounter you can see on the map is most of what a party is for, which is
 * why the buttons say "Lead" rather than "Move up".
 *
 * **Release is permanent and says so.** There is no box (see
 * `core/acquisition.ts`), so the confirm step is the only thing between a
 * misclick and a Pokemon that is gone for the run.
 *
 * Nothing here talks to `playRun`. The party screen is *between* decisions
 * rather than one of them — it changes run state directly, the way the map
 * screen changes nothing and the reward screen answers a question. That is a
 * deliberate limit: a reorder is not recorded in the run log, so a replayed run
 * reproduces the party the decisions produced rather than the order a player
 * dragged it into. Making it a logged decision is the honest way to change
 * that, and it is not free — every screen that can be opened at any time would
 * need a decision point of its own.
 */
import { describeSpecCard } from '../../core/battle/driver';
import { heldItem } from '../../core/items';
import { hpFraction, ppTotals } from '../../core/party';
import type { PokemonState } from '../../core/types';
import { el } from '../scene';
import { typeChip } from './starter-select';

export interface PartyScreen {
  root: HTMLElement;
  /**
   * Draw the party.
   *
   * `onReorder` and `onRelease` mutate run state through `core/party.ts`;
   * `onDone` closes the screen. All three are handed in rather than owned here,
   * because `ui/` deciding what a release *means* is the seam the whole project
   * is built to avoid.
   */
  render(
    party: readonly PokemonState[],
    handlers: {
      onReorder: (from: number, to: number) => void;
      onRelease: (slot: number) => void;
      onDone: () => void;
    },
  ): void;
}

export function createPartyScreen(): PartyScreen {
  const root = el('section', 'screen screen--party');

  const title = el('h2', 'screen__title');
  title.textContent = 'Your party';
  const blurb = el('p', 'screen__blurb');
  blurb.textContent = 'The first member leads the next battle. Releasing is permanent.';

  const list = el('div', 'party party--manage');

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'button button--primary';
  done.textContent = 'Back to the map';

  root.append(title, blurb, list, done);

  let onDone: () => void = () => undefined;
  done.addEventListener('click', () => onDone());

  return {
    root,
    render(party, handlers) {
      onDone = handlers.onDone;
      list.replaceChildren(
        ...party.map((member, index) => renderManaged(member, index, party.length, handlers)),
      );
    },
  };
}

function renderManaged(
  member: PokemonState,
  index: number,
  size: number,
  handlers: {
    onReorder: (from: number, to: number) => void;
    onRelease: (slot: number) => void;
  },
): HTMLElement {
  const card = el('div', 'party__member');
  if (index === 0) card.classList.add('party__member--lead');
  if (member.fainted) card.classList.add('party__member--fainted');

  const spec = describeSpecCard(member.spec);

  const header = el('div', 'panel__header');
  const name = el('span', 'panel__name');
  name.textContent = spec.species;
  const level = el('span', 'panel__level');
  level.textContent = `Lv${spec.level}`;
  header.append(name, level, ...spec.types.map(typeChip));
  if (index === 0) {
    const lead = el('span', 'badge badge--lead');
    lead.textContent = 'Lead';
    header.append(lead);
  }

  const ability = el('span', 'party__ability');
  ability.textContent = spec.ability;
  header.append(ability);

  const track = el('div', 'hp');
  const fill = el('div', 'hp__fill');
  const fraction = hpFraction(member);
  fill.style.width = `${fraction * 100}%`;
  fill.dataset['band'] = fraction > 0.5 ? 'high' : fraction > 0.2 ? 'mid' : 'low';
  track.append(fill);

  const meta = el('div', 'panel__meta');
  const hp = el('span', 'panel__hp-text');
  const pp = ppTotals(member);
  hp.textContent = member.fainted
    ? `Fainted · PP ${pp.pp}/${pp.maxPp}`
    : `${member.hp} / ${member.maxHp} HP · PP ${pp.pp}/${pp.maxPp}`;
  meta.append(hp);

  if (member.status) {
    const status = el('span', 'badge badge--status');
    status.dataset['status'] = member.status;
    status.textContent = member.status.toUpperCase();
    meta.append(status);
  }

  // The held item is on the card because Stage 4 lets the player *choose* who
  // holds what, and a targeting decision you cannot audit afterwards is a
  // decision you cannot learn from.
  const item = heldItem(member);
  const itemChip = el('span', 'badge badge--item');
  itemChip.textContent = item ? item.name : 'No item';
  if (!item) itemChip.classList.add('badge--muted');
  meta.append(itemChip);

  const moves = el('ul', 'party__moves');
  moves.replaceChildren(
    ...member.moves.map((move) => {
      const row = el('li', 'party__move');
      const label = el('span', '');
      label.textContent = move.name;
      const count = el('span', 'move__pp');
      count.textContent = `${move.pp}/${move.maxPp}`;
      if (move.maxPp > 0 && move.pp / move.maxPp <= 0.25) count.classList.add('move__pp--low');
      row.append(label, count);
      return row;
    }),
  );

  const actions = el('div', 'party__actions');

  const lead = document.createElement('button');
  lead.type = 'button';
  lead.className = 'button button--small';
  lead.textContent = 'Lead';
  // Disabled rather than hidden on the member that already leads: a button that
  // disappears from one row and not the others reads as a bug.
  lead.disabled = index === 0;
  lead.addEventListener('click', () => handlers.onReorder(index, 0));

  const release = document.createElement('button');
  release.type = 'button';
  release.className = 'button button--small button--danger';
  release.textContent = 'Release';
  // The last member cannot be released: an empty party is neither wiped nor
  // alive, which is a state reached by a button rather than by losing.
  release.disabled = size <= 1;
  release.addEventListener('click', () => {
    if (release.dataset['confirm'] === 'true') {
      handlers.onRelease(index);
      return;
    }
    release.dataset['confirm'] = 'true';
    release.textContent = 'Release for good?';
  });

  actions.append(lead, release);
  card.append(header, track, meta, moves, actions);
  return card;
}
