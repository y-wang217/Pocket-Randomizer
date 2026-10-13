/**
 * The panels' three meters (`docs/spec/gymrun-patch-card-battle-hearts-and-tutorial.md`):
 * HP as hearts, shields as bubbles, and the shared MP pool as a bar of cells
 * (its one ult-star per unit went with the per-unit pools). They replace the `HP 2/3 · Sh 1+1` line, its bar, and the MP
 * pips, and keep every fact those carried:
 *
 *   - HP and max HP: a full heart per HP, an empty one per HP lost. Past
 *     `HEART_ROW` (the Colossus's 12) one heart and the numbers, so a panel
 *     never wraps.
 *   - The card shield and the base shield, apart: a filled bubble for each
 *     point of card shield (it wears off), a ringed one for each point of base
 *     shield (used once). Past `BUBBLE_ROW`, one of each kind with its count.
 *   - The pool's MP free, MP held by planned cards, and its max: a cell each,
 *     filled, dimmed or empty, and the free count over the max.
 *
 * Shape tells each apart, never colour alone, and each meter carries its
 * numbers as its accessible name. No rules: every number is the view's.
 */
import { CARD_COPY } from '../../cardData/copy';
import type { BattleView } from '../../core/cards/view';

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

/**
 * The shared MP bar (`docs/spec/gymrun-patch-card-battle-shared-mana.md`): one
 * pool every unit's cards pay from, so one bar, in the status beside the
 * round. A cell per MP the pool holds or refills to, free, held by a planned
 * card, or empty; a cell past the max is bonus MP a card queued, ringed gold.
 * Its numbers are its accessible name and its count.
 */
export function manaBar(mana: BattleView['mana']): HTMLElement {
  const free = Math.max(0, mana.mp - mana.reserved);
  const row = span('cb-mana');
  row.dataset['coach'] = 'mana';
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', CARD_COPY.meters.mana(free, mana.reserved, mana.max));
  row.append(span('cb-mana-label', CARD_COPY.cost));
  const cells = span('cb-mana-cells');
  for (let i = 0; i < Math.max(mana.max, mana.mp); i++) {
    const cell = span('cb-mana-cell');
    cell.dataset['state'] = i < free ? 'free' : i < mana.mp ? 'held' : 'empty';
    if (i >= mana.max) cell.dataset['bonus'] = 'true';
    cells.append(cell);
  }
  row.append(cells, span('cb-meter-count', `${free}/${mana.max}`));
  return row;
}
