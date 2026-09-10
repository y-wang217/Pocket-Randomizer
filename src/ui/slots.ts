/**
 * Numbered slots. Stage V2.
 *
 * A collection the run carries renders as a hotbar: one slot per position up
 * to the collection's capacity, numbered from 1, empty slots drawn empty. The
 * party fills slots 1 to its size out of `PARTY_SIZE`; the backpack fills its
 * loose items out of `tuning.backpackCapacity`.
 *
 * **The number is a position, never a rank.** Slots render in the order the
 * state holds them and nothing here sorts. Reorder the party and the slots
 * reorder with it; `test/slots.test.ts` asserts exactly that.
 *
 * Item icons resolve through `@pkmn/img`, which maps an item name to a
 * position on Showdown's icon sheet. The sheet is fetched from the sprite
 * CDN at render time (the plan's asset rule: nothing raster ships in the
 * repo). A berry's slot and a held item's slot are the same slot: there is no
 * consumable marking here, because the slot is chrome and a berry is not
 * lesser chrome.
 */
import { Icons } from '@pkmn/img';

import type { ItemId } from '../core/types';
import { itemById } from '../data/items';
import { el } from './scene';

export interface SlotContent {
  /** The line under the number. A species, or an item name. */
  label: string;
  /** An item to draw as an icon: the held item on a party slot, the item itself on a backpack slot. */
  item?: ItemId | null;
  /** A `data-tip` key for the slot, so a tap names what is in it. */
  tip?: string;
}

/** The icon element for an item, positioned on the sheet by @pkmn/img. */
export function itemIcon(id: ItemId): HTMLElement {
  const entry = itemById(id);
  const icon = el('span', 'slot__icon');
  const sprite = Icons.getItem(entry?.name ?? id);
  icon.style.backgroundImage = `url(${sprite.url})`;
  icon.style.backgroundPosition = `${sprite.left}px ${sprite.top}px`;
  icon.setAttribute('role', 'img');
  icon.setAttribute('aria-label', entry?.name ?? id);
  return icon;
}

/**
 * A hotbar of `capacity` slots, the first `contents.length` of them filled.
 *
 * `kind` names the collection for the stylesheet and for tests; the slots
 * themselves are the same element either way.
 */
export function renderSlots(kind: 'party' | 'backpack', contents: readonly SlotContent[], capacity: number): HTMLElement {
  const bar = el('ol', `slots slots--${kind}`);
  bar.setAttribute('aria-label', kind === 'party' ? 'Party slots' : 'Backpack slots');
  const count = Math.max(capacity, contents.length);
  for (let index = 0; index < count; index++) {
    const content = contents[index];
    const slot = el('li', `slot${content ? '' : ' slot--empty'}`);
    slot.dataset['slot'] = String(index + 1);
    const number = el('span', 'slot__number');
    number.textContent = String(index + 1);
    slot.append(number);
    if (content) {
      if (content.item) slot.append(itemIcon(content.item));
      const label = el('span', 'slot__label');
      label.textContent = content.label;
      slot.append(label);
      if (content.tip) {
        slot.dataset['tip'] = content.tip;
        slot.tabIndex = 0;
        slot.setAttribute('role', 'button');
      }
    }
    bar.append(slot);
  }
  return bar;
}

/** The slot number as a small marker for a card that stands for the slot. */
export function slotNumber(index: number): HTMLElement {
  const marker = el('span', 'slot__number');
  marker.textContent = String(index + 1);
  marker.setAttribute('aria-label', `Slot ${index + 1}`);
  return marker;
}
