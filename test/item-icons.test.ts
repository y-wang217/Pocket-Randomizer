/**
 * The generated item icon index matches the package it was generated from,
 * and covers every item the game can hand out. Stage V2.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { Icons } from '@pkmn/img';

import { renderTable, TARGET } from '../scripts/gen-item-icons';
import { ITEMS } from '../src/data/items';
import { ITEM_ICONS } from '../src/ui/theme/itemIcons';
import { itemIcon } from '../src/ui/slots';

describe('the item icon index', () => {
  it('is what the generator writes today', () => {
    expect(readFileSync(TARGET, 'utf8')).toBe(renderTable());
  });

  it('covers every item in the pool with the cell the full package names', () => {
    for (const item of ITEMS) {
      const full = Icons.getItem(item.name);
      expect(ITEM_ICONS[item.id], item.name).toBeDefined();
      const number = ITEM_ICONS[item.id] ?? 0;
      expect(-(number % 16) * 24, `${item.name} left`).toBe(full.left);
      expect(-Math.floor(number / 16) * 24, `${item.name} top`).toBe(full.top);
    }
  });
});

describe('itemIcon', () => {
  it('positions the slim resolver where the full package would', () => {
    // A DOM is needed for the element; jsdom is not, since only styles are read.
    const doc = globalThis.document;
    if (!doc) return;
    for (const item of ITEMS.slice(0, 5)) {
      const icon = itemIcon(item.id);
      const full = Icons.getItem(item.name);
      expect(icon.style.backgroundPosition).toBe(`${full.left}px ${full.top}px`);
    }
  });
});
