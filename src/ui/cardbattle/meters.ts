/**
 * The panels' three meters (`docs/spec/gymrun-patch-card-battle-hearts-and-tutorial.md`):
 * HP as hearts, shields as bubbles, MP as a five-cell bar that marks the
 * unit's ult. They replace the `HP 2/3 · Sh 1+1` line, its bar, and the MP
 * pips, and keep every fact those carried:
 *
 *   - HP and max HP: a full heart per HP, an empty one per HP lost. Past
 *     `HEART_ROW` (the Colossus's 12) one heart and the numbers, so a panel
 *     never wraps.
 *   - The card shield and the base shield, apart: a filled bubble for each
 *     point of card shield (it wears off), a ringed one for each point of base
 *     shield (used once). Past `BUBBLE_ROW`, one of each kind with its count.
 *   - MP free, MP held by planned cards, and the cap: a cell each, filled,
 *     dimmed or empty. The ult's cost is a star on its cell, lit once the unit
 *     holds that much MP, planned or not. An ult is a card marked `ult` in
 *     this battle's deck, so an upgrade that cheapens it moves the star, and a
 *     unit whose deck holds none (the Sword dasher, until a card run hands it
 *     one) has no star.
 *
 * Shape tells each apart, never colour alone, and each meter carries its
 * numbers as its accessible name. No rules: every number is the view's.
 */
import { CARDS } from '../../cardData/cards';
import { CARD_COPY, nameOf } from '../../cardData/copy';
import type { CardDef, UnitDefId } from '../../core/cards/defs';
import type { BattleState } from '../../core/cards/state';
import type { UnitView } from '../../core/cards/view';

/** The most hearts or bubbles a meter draws one by one. */
export const HEART_ROW = 6;
export const BUBBLE_ROW = 6;

function span(className: string, text?: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Hearts for HP, then bubbles for shields, on one line. */
export function vitals(hp: number, maxHp: number, shield: number, baseShield: number): HTMLElement {
  const row = span('cb-vitals');
  row.dataset['coach'] = 'vitals';
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', CARD_COPY.meters.vitals(Math.max(0, hp), maxHp, shield, baseShield));
  const hearts = span('cb-hearts');
  if (maxHp > HEART_ROW) {
    hearts.append(heart(true), span('cb-meter-count', `${Math.max(0, hp)}/${maxHp}`));
  } else {
    for (let i = 0; i < maxHp; i++) hearts.append(heart(i < hp));
  }
  row.append(hearts);
  if (shield + baseShield > 0) {
    const bubbles = span('cb-bubbles');
    if (shield + baseShield > BUBBLE_ROW) {
      if (shield > 0) bubbles.append(bubble(false), span('cb-meter-count', String(shield)));
      if (baseShield > 0) bubbles.append(bubble(true), span('cb-meter-count', String(baseShield)));
    } else {
      for (let i = 0; i < shield; i++) bubbles.append(bubble(false));
      for (let i = 0; i < baseShield; i++) bubbles.append(bubble(true));
    }
    row.append(bubbles);
  }
  return row;
}

function heart(full: boolean): HTMLElement {
  const node = span('cb-heart');
  node.dataset['full'] = String(full);
  return node;
}

function bubble(base: boolean): HTMLElement {
  const node = span('cb-bubble');
  if (base) node.dataset['base'] = 'true';
  return node;
}

export interface Ult {
  name: string;
  cost: number;
}

/** Every card in the battle, once per definition: the deck the ults are read from. */
export function deckOf(state: BattleState): CardDef[] {
  return [...new Set(Object.values(state.cards).map((c) => c.def))].flatMap((def) => (CARDS[def] ? [CARDS[def]] : []));
}

/** The unit's ult in this deck, the cheapest if it holds more than one, or `null` when it holds none it could ever pay for. */
export function ultOf(unit: UnitDefId, deck: readonly CardDef[], mpCap: number): Ult | null {
  const ults = deck.filter((card) => card.ult && card.owner === unit && card.cost >= 1 && card.cost <= mpCap);
  const card = ults.sort((a, b) => a.cost - b.cost)[0];
  return card ? { name: card.name, cost: card.cost } : null;
}

/** The MP bar: one cell per MP up to the cap, free, held or empty, and the ult's star. */
export function manaBar(unit: Pick<UnitView, 'id' | 'mp' | 'reserved' | 'mpCap'>, ult: Ult | null): HTMLElement {
  const free = Math.max(0, unit.mp - unit.reserved);
  const row = span('cb-mana');
  row.dataset['coach'] = 'mana';
  row.setAttribute('role', 'img');
  row.setAttribute(
    'aria-label',
    [CARD_COPY.meters.mana(free, unit.reserved, unit.mpCap), ...(ult ? [CARD_COPY.meters.ult(nameOf(ult.name), ult.cost)] : [])].join(', '),
  );
  row.append(span('cb-mana-label', CARD_COPY.cost));
  const cells = span('cb-mana-cells');
  for (let i = 0; i < unit.mpCap; i++) {
    const cell = span('cb-mana-cell');
    cell.dataset['state'] = i < free ? 'free' : i < unit.mp ? 'held' : 'empty';
    if (ult && i === ult.cost - 1) {
      cell.dataset['ult'] = 'true';
      const star = span('cb-mana-star');
      if (unit.mp >= ult.cost) star.dataset['ready'] = 'true';
      cell.append(star);
    }
    cells.append(cell);
  }
  row.append(cells);
  return row;
}
