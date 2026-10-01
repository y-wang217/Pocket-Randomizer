/**
 * The starter screen's compact cards and detail panel. **Bible Rev 19, D78 to
 * D80** (`docs/spec/gymrun-patch-starter-select-redesign.md`); the panel over
 * the selected card's moves and its band bars, **Rev 21, D88 and D89**
 * (`docs/spec/gymrun-stage5.1-band-bars-and-starter-fit.md`).
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { describeSpecCard, statBandAt } from '../src/core/battle/driver';
import { moveCoverage, typeVulnerabilities } from '../src/core/coverage';
import { createRun } from '../src/core/run';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { STARTER_LABELS } from '../src/ui/copy/screens';
import { createStarterSelect } from '../src/ui/screens/starter-select';
import { bandFraction } from '../src/ui/stat-block';

const SEED = 'STARTER-DETAIL';

function mounted() {
  const options = createRun(SEED, DEFAULT_TUNING).starterOptions;
  const picks: number[] = [];
  const screen = createStarterSelect();
  screen.render(options, (index) => picks.push(index));
  document.body.replaceChildren(screen.root);
  const cards = [...screen.root.querySelectorAll<HTMLButtonElement>('.starter')];
  const panels = cards.map((card) => card.querySelector<HTMLElement>('.starter-detail')!);
  const choose = screen.root.querySelector<HTMLButtonElement>('.starter-select__choose')!;
  return { options, picks, cards, panels, choose };
}

describe('at rest', () => {
  it('selects nothing, fills no panel and offers no commit (D69, C1)', () => {
    const { cards, panels, choose } = mounted();
    expect(cards).toHaveLength(DEFAULT_TUNING.starterOptionCount);
    for (const card of cards) expect(card.getAttribute('aria-pressed')).toBe('false');
    for (const panel of panels) {
      expect(panel.hidden).toBe(true);
      expect(panel.childElementCount).toBe(0);
    }
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
  it('selects the card, opens the panel over its moves with the numbers, the bars and the coverage, and never picks', () => {
    const { options, picks, cards, panels, choose } = mounted();
    cards[1]!.click();

    expect(cards.map((card) => card.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(picks).toEqual([]);
    expect(panels.map((panel) => panel.hidden)).toEqual([true, false, true]);
    expect(cards[1]!.dataset['view']).toBe('detail');
    // The panel is the card's, over its move column (D89): the moves stay in the card.
    expect(panels[1]!.parentElement).toBe(cards[1]);
    expect(cards[1]!.querySelectorAll('.move--chip')).toHaveLength(4);

    const card = describeSpecCard(options[1]!);
    const stats = panels[1]!.querySelector('.stats');
    expect(stats, 'the stat block with its numbers at rest (D79)').not.toBeNull();
    const rows = [...stats!.querySelectorAll<HTMLElement>('.stat')];
    const values = Object.fromEntries(rows.map((row) => [row.dataset['row'], row.querySelector('.stat__value')?.textContent]));
    expect(values['hp']).toBe(String(card.maxHp));
    expect(values['spe']).toBe(String(card.baseStatsAtLevel.spe));
    // Every number has its band bar at the starter's level (D88).
    const band = statBandAt(card.level);
    expect(stats!.getAttribute('data-level')).toBe(String(card.level));
    for (const row of rows) {
      expect(row.querySelector('.stat__bar-fill')).not.toBeNull();
      const range = band[row.dataset['row'] as keyof typeof band];
      expect(Number(row.dataset['fraction'])).toBeCloseTo(bandFraction(Number(row.querySelector('.stat__value')?.textContent), range), 3);
    }

    const effective = panels[1]!.querySelector('.starter-detail__row--effective');
    const vulnerable = panels[1]!.querySelector('.starter-detail__row--vulnerable');
    const covered = moveCoverage(card.moves);
    const exposed = typeVulnerabilities(card.types);
    expect(effective === null).toBe(covered.length === 0);
    expect(vulnerable === null).toBe(exposed.length === 0);
    if (effective) expect(effective.querySelectorAll('.type')).toHaveLength(covered.length);
    if (vulnerable) expect(vulnerable.querySelectorAll('.type')).toHaveLength(exposed.length);

    expect(choose.hidden).toBe(false);
    expect(choose.textContent).toBe(STARTER_LABELS.choose(card.species));
  });

  it('flips the selected card between the panel and its moves, and keeps the selection (C2)', () => {
    const { picks, cards, panels, choose } = mounted();
    cards[0]!.click();
    cards[0]!.click();
    expect(cards[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(cards[0]!.dataset['view']).toBe('moves');
    expect(panels[0]!.hidden).toBe(true);
    expect(choose.hidden).toBe(false);
    cards[0]!.click();
    expect(cards[0]!.dataset['view']).toBe('detail');
    expect(panels[0]!.hidden).toBe(false);
    expect(picks).toEqual([]);
  });

  it('moves the selection, and the panel follows it', () => {
    const { options, cards, panels, choose } = mounted();
    cards[0]!.click();
    cards[2]!.click();
    expect(cards.map((card) => card.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    expect(panels.map((panel) => panel.hidden)).toEqual([true, true, false]);
    expect(panels[0]!.childElementCount, 'a card that loses the selection empties its panel').toBe(0);
    expect(cards[0]!.dataset['view']).toBe('moves');
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
