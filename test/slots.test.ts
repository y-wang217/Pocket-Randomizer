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
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createPartyScreen } from '../src/ui/screens/party';
import { renderSlots } from '../src/ui/slots';

function member(species: string, item?: string): PokemonState {
  const state = createPartyMember({ species, ability: 'Overgrow', moves: ['Tackle'], level: 30 });
  return item ? { ...state, item } : state;
}

const handlers = { onReorder: () => undefined, onRelease: () => undefined, onPlan: () => undefined, onDone: () => undefined };

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
  it('renders party and backpack slots in state order, and reorders with the state', () => {
    const screen = createPartyScreen();
    let party = [member('Bulbasaur', 'leftovers'), member('Charmander'), member('Squirtle', 'sitrusberry')];
    const view = { party, backpack: ['oranberry', 'charcoal'], relics: [], tuning: DEFAULT_TUNING, slots: OPENING_SLOTS, plan: null };

    screen.render(view, handlers);
    expect(labels(screen.root, '.slots--party')).toEqual(['Bulbasaur', 'Charmander', 'Squirtle', ...Array(OPENING_SLOTS - 3).fill('')]);
    expect(screen.root.querySelectorAll('.slots--party .slot')).toHaveLength(OPENING_SLOTS);
    // The held item rides in its member's slot.
    const partySlots = [...screen.root.querySelectorAll('.slots--party .slot')];
    expect(partySlots[0]?.querySelector('.slot__icon')?.getAttribute('aria-label')).toBe('Leftovers');
    expect(partySlots[1]?.querySelector('.slot__icon')).toBeNull();
    // The cards beneath carry the same numbers in the same order.
    expect([...screen.root.querySelectorAll('.party--manage .party__member .slot__number')].map((n) => n.textContent)).toEqual(['1', '2', '3']);

    const backpackSlots = [...screen.root.querySelectorAll('.slots--backpack .slot')];
    expect(backpackSlots).toHaveLength(backpackCapacity(OPENING_SLOTS, DEFAULT_TUNING));
    expect(labels(screen.root, '.slots--backpack').slice(0, 2)).toEqual(['Oran Berry', 'Charcoal']);
    expect(backpackSlots.slice(2).every((slot) => slot.classList.contains('slot--empty'))).toBe(true);

    // Reorder the state: slot 3 to the lead. The slots follow, nothing sorts.
    party = reorderParty(party, 2, 0);
    screen.render({ ...view, party }, handlers);
    expect(labels(screen.root, '.slots--party').slice(0, 3)).toEqual(['Squirtle', 'Bulbasaur', 'Charmander']);
    expect([...screen.root.querySelectorAll('.slots--party .slot')][0]?.querySelector('.slot__icon')?.getAttribute('aria-label')).toBe('Sitrus Berry');
  });
});
