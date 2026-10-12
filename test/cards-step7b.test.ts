/**
 * @vitest-environment jsdom
 *
 * Card run shapes, step 7b (`docs/spec/gymrun-card-run-shapes-prompt.md`):
 * a keyword glossary in the battle's Inspect panel, and every name the card
 * data carries in all eight languages. Machine-drafted, like every other
 * line of the translation tables.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { CARDS } from '../src/cardData/cards';
import { STARTING_DECK } from '../src/cardData/cardrunTables';
import { CARD_COPY_BY_LANGUAGE, CARD_LANGUAGES, nameOf, setCardLanguage } from '../src/cardData/copy';
import { ENCOUNTERS } from '../src/cardData/encounters';
import { ENEMIES } from '../src/cardData/enemies';
import { TALENTS } from '../src/cardData/talents';
import { UNITS } from '../src/cardData/units';
import { createBattle } from '../src/core/cards/create';
import { newLog } from '../src/core/cards/log';
import type { BattleState } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { openSandbox } from '../src/ui/cardbattle/sandbox';

afterEach(() => {
  setCardLanguage('en');
  document.body.replaceChildren();
});

/** Every name a player can read off the card data: cards (an upgrade reads its card's), units, enemies, fights and talents. */
const NAMES = [
  ...new Set([
    ...Object.values(CARDS).map((c) => c.name.replace(/\+$/, '')),
    ...Object.values(UNITS).map((u) => u.name),
    ...Object.values(ENEMIES).map((e) => e.name),
    ...Object.values(ENCOUNTERS).map((e) => e.name),
    ...Object.values(TALENTS).map((t) => t.name),
  ]),
];

describe('the names, in every language', () => {
  it('translates every name the card data carries', () => {
    for (const language of CARD_LANGUAGES) {
      if (language === 'en') continue;
      const names = CARD_COPY_BY_LANGUAGE[language].names;
      expect(NAMES.filter((n) => !names[n]?.trim()), language).toEqual([]);
    }
  });

  it("reads an upgrade as its card's name and a plus", () => {
    setCardLanguage('de');
    expect(nameOf('Baton+')).toBe(`${CARD_COPY_BY_LANGUAGE.de.names['Baton']}+`);
    expect(nameOf('Baton')).toBe(CARD_COPY_BY_LANGUAGE.de.names['Baton']);
    setCardLanguage('en');
    expect(nameOf('Baton+')).toBe('Baton+');
  });

  it('gives each language a glossary line for all six keywords', () => {
    for (const language of CARD_LANGUAGES) {
      const glossary = CARD_COPY_BY_LANGUAGE[language].glossary;
      expect(Object.keys(glossary).sort(), language).toEqual(['cover', 'pull', 'push', 'repair', 'stealth', 'stun']);
      for (const line of Object.values(glossary)) expect(line.trim().length, language).toBeGreaterThan(10);
    }
  });
});

/** A started run-mode battle on the Front line, `cards` in hand. */
function battle(cards: string[]): HTMLElement {
  const created = createBattle('test', 'GLOSS', { cards: [...cards, ...STARTING_DECK] });
  if (!created.ok) throw new Error(created.reason);
  let state: BattleState = created.state;
  const started = step(state, { type: 'start' });
  if (!started.ok) throw new Error(started.reason);
  state = started.state;
  for (const card of cards) {
    const iid = Object.keys(state.cards).find((k) => state.cards[k]!.def === card)!;
    if (state.piles.hand.includes(iid)) continue;
    state.piles.draw = state.piles.draw.filter((c) => c !== iid);
    state.piles.discard = state.piles.discard.filter((c) => c !== iid);
    state.piles.hand.push(iid);
  }
  return openSandbox(document.body, { run: { state, log: newLog('GLOSS', 'test', state.deckId), onAction: () => {} } }).root;
}

function inspect(root: HTMLElement, card: string): string[] {
  [...root.querySelectorAll<HTMLElement>('.cb-actions .cb-btn')].find((b) => b.textContent === 'Inspect')!.click();
  root.querySelector<HTMLElement>(`.cb-card[data-card="${card}"]`)!.click();
  return [...root.querySelectorAll('.cb-inspect .cb-glossary')].map((n) => n.textContent ?? '');
}

describe('the glossary in Inspect', () => {
  it('explains each keyword a card carries, once, and nothing it does not', () => {
    const root = battle(['shove', 'grapple', 'patch-up', 'smoke', 'guard-duty', 'riot-net', 'snipe']);
    const g = CARD_COPY_BY_LANGUAGE.en.glossary;
    expect(inspect(root, 'shove')).toEqual([g.push]);
    expect(inspect(root, 'grapple')).toEqual([g.pull]);
    expect(inspect(root, 'patch-up')).toEqual([g.repair]);
    expect(inspect(root, 'smoke')).toEqual([g.stealth]);
    expect(inspect(root, 'guard-duty')).toEqual([g.cover]);
    expect(inspect(root, 'riot-net')).toEqual([g.stun]);
    expect(inspect(root, 'snipe')).toEqual([]);
  });
});
