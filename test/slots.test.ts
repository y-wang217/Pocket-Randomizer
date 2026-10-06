/**
 * Numbered slots render in position order and follow the state. Stage V2.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { createPartyMember, reorderParty } from '../src/core/party';
import type { PokemonState } from '../src/core/types';
import { backpackCapacity } from '../src/core/items';
import { partyCapacityAfter } from '../src/data/partyTuning';

/** The slots a run opens with. **Stage 4.8**, was `OPENING_SLOTS`. */
const OPENING_SLOTS = partyCapacityAfter(0);
/** Enough slots for the three-member fixtures below: the first widening gym's count. */
const THREE_UP = Math.max(OPENING_SLOTS, 3);
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createPartyScreen } from '../src/ui/screens/party';
import { renderSlots } from '../src/ui/slots';

function member(species: string, item?: string): PokemonState {
  const state = createPartyMember({ species, ability: 'Overgrow', moves: ['Tackle'], level: 30 });
  return item ? { ...state, item } : state;
}

const handlers = { onReorder: () => undefined, onRelease: () => undefined, onPlan: () => undefined, onTeach: () => undefined, onDone: () => undefined };

function labels(root: ParentNode, selector: string): string[] {
  return [...root.querySelectorAll(`${selector} .slot`)].map((slot) => slot.querySelector('.slot__label')?.textContent ?? '');
}

describe('renderSlots', () => {
  it('draws capacity slots, numbered from 1, the tail empty', () => {
    const bar = renderSlots('backpack', [{ label: 'Leftovers', item: 'leftovers' }], 5);
    const slots = [...bar.querySelectorAll('.slot')];
    expect(slots).toHaveLength(5);
    expect(slots.map((slot) => slot.querySelector('.slot__number')?.textContent)).toEqual(['1', '2', '3', '4', '5']);
    expect(slots.map((slot) => slot.classList.contains('slot--empty'))).toEqual([false, true, true, true, true]);
    expect(slots[0]?.querySelector('.slot__icon')?.getAttribute('aria-label')).toBe('Leftovers');
  });

  it('styles a berry and a held item identically', () => {
    const bar = renderSlots('backpack', [{ label: 'Sitrus Berry', item: 'sitrusberry' }, { label: 'Leftovers', item: 'leftovers' }], 2);
    const [berry, item] = [...bar.querySelectorAll('.slot')];
    expect(berry?.className).toBe(item?.className);
    expect(berry?.querySelector('.slot__icon')?.className).toBe(item?.querySelector('.slot__icon')?.className);
  });
});

describe('the party screen', () => {
  /*
   * **The party hotbar left the party screen with bible Rev 23 (D97).** The
   * Bag's held list names each member's item at rest, and a hotbar beside it
   * was the same fact in a second channel (R3). The list keeps what the
   * hotbar held this test to: state order, the item in its member's row, and
   * a reorder followed rather than sorted.
   */
  it('renders the held list and backpack slots in state order, and reorders with the state', () => {
    const screen = createPartyScreen();
    let party = [member('Bulbasaur', 'leftovers'), member('Charmander'), member('Squirtle', 'sitrusberry')];
    const view = {
      party,
      backpack: ['oranberry', 'charcoal'],
      tms: [],
      teachable: new Set([]),
      relics: [],
      tuning: DEFAULT_TUNING,
      // Three members need at least three slots; the opening width is two
      // from Stage 4.9, so this view is a run one widening gym in.
      slots: THREE_UP,
      backTo: 'Back to the map',
      plan: null,
    };
    const held = (): string[] => [...screen.root.querySelectorAll('.held__item')].map((row) => `${row.querySelector('.held__member')?.textContent}:${row.querySelector('.held__name')?.textContent}`);

    screen.render(view, handlers);
    expect(screen.root.querySelectorAll('.slots--party')).toHaveLength(0);
    expect(held()).toEqual(['Bulbasaur:Leftovers', 'Charmander:Nothing held', 'Squirtle:Sitrus Berry']);
    // The cards on the Team half carry the same slot numbers in the same order.
    expect([...screen.root.querySelectorAll('.party--manage .party__member .slot__number')].map((n) => n.textContent)).toEqual(['1', '2', '3']);

    const backpackSlots = [...screen.root.querySelectorAll('.slots--backpack .slot')];
    expect(backpackSlots).toHaveLength(backpackCapacity(THREE_UP, DEFAULT_TUNING));
    expect(labels(screen.root, '.slots--backpack').slice(0, 2)).toEqual(['Oran Berry', 'Charcoal']);
    expect(backpackSlots.slice(2).every((slot) => slot.classList.contains('slot--empty'))).toBe(true);

    // Reorder the state: slot 3 to the lead. The list follows, nothing sorts.
    party = reorderParty(party, 2, 0);
    screen.render({ ...view, party }, handlers);
    expect(held()).toEqual(['Squirtle:Sitrus Berry', 'Bulbasaur:Leftovers', 'Charmander:Nothing held']);
  });

  /*
   * **The party lead at rest patch, 2026-10-06.** Lead was drawn into the
   * card's fold under the four move cards, and the author found no way to
   * change the lead. It is at rest now, outside the party row component;
   * Release stays in the fold.
   */
  it('draws Lead at rest under each card, outside the fold, and Release inside it', () => {
    const screen = createPartyScreen();
    const party = [member('Bulbasaur'), member('Charmander'), member('Squirtle')];
    const reorders: [number, number][] = [];
    screen.render(
      { party, backpack: [], tms: [], teachable: new Set([]), relics: [], tuning: DEFAULT_TUNING, slots: THREE_UP, backTo: 'Back to the map', plan: null },
      { ...handlers, onReorder: (from, to) => reorders.push([from, to]) },
    );
    const leads = [...screen.root.querySelectorAll<HTMLButtonElement>('.party--manage .party__lead')];
    expect(leads.map((lead) => lead.textContent)).toEqual(['Lead', 'Lead', 'Lead']);
    expect(leads.every((lead) => !lead.closest('.collapse__body') && !lead.closest('.party__member'))).toBe(true);
    expect(leads.map((lead) => lead.disabled)).toEqual([true, false, false]);
    leads[2]?.click();
    expect(reorders).toEqual([[2, 0]]);

    const releases = [...screen.root.querySelectorAll('.party--manage .party__actions .button--danger')];
    expect(releases).toHaveLength(3);
    expect(releases.every((release) => release.closest('.collapse__body'))).toBe(true);
  });

  it('draws no Lead while a node resolves', () => {
    const screen = createPartyScreen();
    screen.render(
      { party: [member('Bulbasaur'), member('Charmander')], backpack: [], tms: [], teachable: new Set([]), relics: [], tuning: DEFAULT_TUNING, slots: THREE_UP, backTo: 'Back', plan: null, canEditParty: false },
      handlers,
    );
    expect(screen.root.querySelectorAll('.party__lead, .party__actions')).toHaveLength(0);
  });
});
