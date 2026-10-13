/**
 * The root README's tuning sheet lists both starting decks card by card. It is
 * for reading, so this only checks it has not drifted: every card id and its
 * cost, in the order the deck holds them, once per distinct card.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { CARDS, DECKS } from '../src/cardData/cards';
import { STARTING_DECK } from '../src/cardData/cardrunTables';

const readme = readFileSync('README.md', 'utf8');
const sheet = readme.slice(readme.indexOf("## The card battler's starting decks"));

/** The ids in a table of the sheet, in order, with the MP column beside each. */
function rows(after: string): [string, number][] {
  const start = sheet.indexOf(after);
  const lines = sheet.slice(start).split('\n').filter((l) => l.startsWith('| ') && l.includes('`'));
  const out: [string, number][] = [];
  for (const line of lines) {
    const cells = line.split('|').map((c) => c.trim());
    const id = cells[2]!.replace(/`/g, '');
    if (out.some(([seen]) => seen === id)) break;
    out.push([id, Number(cells[4])]);
  }
  return out;
}

const distinct = (ids: readonly string[]) => [...new Set(ids)].map((id): [string, number] => [id, CARDS[id]!.cost]);

describe("the README's starting decks", () => {
  it('lists the card run deck as the data deals it', () => {
    expect(sheet).toContain(`**The card run** (${STARTING_DECK.length} cards`);
    expect(rows('**The card run**').slice(0, distinct(STARTING_DECK).length)).toEqual(distinct(STARTING_DECK));
  });

  it("lists the Puppeteer's deck as the data deals it", () => {
    const deck = DECKS['puppeteer']!.cards;
    expect(sheet).toContain(`(${deck.length} cards;`);
    expect(rows("**The sandbox's Puppeteer deck**").slice(0, distinct(deck).length)).toEqual(distinct(deck));
  });
});
