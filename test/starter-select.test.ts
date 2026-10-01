/**
 * The starter screen's compact cards and detail panel. **Bible Rev 19, D78 to
 * D80** (`docs/spec/gymrun-patch-starter-select-redesign.md`).
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { describeSpecCard } from '../src/core/battle/driver';
import { moveCoverage, typeVulnerabilities } from '../src/core/coverage';
import { createRun } from '../src/core/run';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { STARTER_LABELS } from '../src/ui/copy/screens';
import { createStarterSelect } from '../src/ui/screens/starter-select';

const SEED = 'STARTER-DETAIL';

function mounted() {
  const options = createRun(SEED, DEFAULT_TUNING).starterOptions;
  const picks: number[] = [];
  const screen = createStarterSelect();
  screen.render(options, (index) => picks.push(index));
  document.body.replaceChildren(screen.root);
  const cards = [...screen.root.querySelectorAll<HTMLButtonElement>('.starter')];
  const detail = screen.root.querySelector<HTMLElement>('.starter-detail')!;
  const choose = screen.root.querySelector<HTMLButtonElement>('.starter-select__choose')!;
  return { options, picks, cards, detail, choose };
}

describe('at rest', () => {
  it('selects nothing, fills no panel and offers no commit (D69, C1)', () => {
    const { cards, detail, choose } = mounted();
    expect(cards).toHaveLength(DEFAULT_TUNING.starterOptionCount);
    for (const card of cards) expect(card.getAttribute('aria-pressed')).toBe('false');
    expect(detail.hidden).toBe(true);
    expect(detail.childElementCount).toBe(0);
    expect(choose.hidden).toBe(true);
  });

  it('carries four move chips per card and no move card (D78)', () => {
    const { cards } = mounted();
    for (const card of cards) {
      expect(card.querySelectorAll('.move--chip')).toHaveLength(4);
      expect(card.querySelector('.move--card')).toBeNull();
      expect(card.querySelector('.stats')).toBeNull();
    }
  });
});

describe('a tap', () => {
  it('selects the card, fills the panel with the numbers and the coverage, and never picks', () => {
    const { options, picks, cards, detail, choose } = mounted();
    cards[1]!.click();

    expect(cards.map((card) => card.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(picks).toEqual([]);
    expect(detail.hidden).toBe(false);

    const card = describeSpecCard(options[1]!);
    const stats = detail.querySelector('.stats');
    expect(stats, 'the stat block with its numbers at rest (D79; every call site since D82)').not.toBeNull();
    const values = Object.fromEntries(
      [...stats!.querySelectorAll<HTMLElement>('.stat')].map((row) => [row.dataset['row'], row.querySelector('.stat__value')?.textContent]),
    );
    expect(values['hp']).toBe(String(card.maxHp));
    expect(values['spe']).toBe(String(card.baseStatsAtLevel.spe));

    const effective = detail.querySelector('.starter-detail__row--effective');
    const vulnerable = detail.querySelector('.starter-detail__row--vulnerable');
    const covered = moveCoverage(card.moves);
    const exposed = typeVulnerabilities(card.types);
    expect(effective === null).toBe(covered.length === 0);
    expect(vulnerable === null).toBe(exposed.length === 0);
    if (effective) expect(effective.querySelectorAll('.type')).toHaveLength(covered.length);
    if (vulnerable) expect(vulnerable.querySelectorAll('.type')).toHaveLength(exposed.length);

    expect(choose.hidden).toBe(false);
    expect(choose.textContent).toBe(STARTER_LABELS.choose(card.species));
  });

  it('moves the selection, and the panel follows it', () => {
    const { options, cards, detail, choose } = mounted();
    cards[0]!.click();
    cards[2]!.click();
    expect(cards.map((card) => card.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    expect(detail.querySelector('.starter-detail__name')?.textContent).toBe(describeSpecCard(options[2]!).species);
    expect(choose.textContent).toBe(STARTER_LABELS.choose(describeSpecCard(options[2]!).species));
  });
});

describe('the Choose control', () => {
  it('commits the selected starter, once', () => {
    const { picks, cards, choose } = mounted();
    cards[2]!.click();
    choose.click();
    choose.click();
    cards[0]!.click();
    choose.click();
    expect(picks).toEqual([2]);
  });
});

describe('the copy', () => {
  it('spends no hedge word (section 8)', () => {
    expect(`${STARTER_LABELS.effective} ${STARTER_LABELS.vulnerable}`).not.toMatch(/\b(weak|strong|best|good)\b/i);
  });
});
