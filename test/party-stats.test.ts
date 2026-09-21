/**
 * @vitest-environment jsdom
 *
 * The six numbers on a member card are the member's own. **Patch 4.7.2.**
 *
 * The browser half of this promise is `test/visual-stat-bars.test.ts`, which
 * asks whether a bar is *painted* and at the right share — the question jsdom
 * cannot answer and the one the 4.7.2 bug turned on. This is the other half,
 * and it is the cheap exact one: whether the numbers on the card are the
 * numbers the adapter computed for that Pokemon, row by row, in order.
 *
 * Kept apart deliberately. A single browser test asserting both would compare
 * on-screen text against on-screen text and never touch `describeSpecCard`, so
 * a card populated from the wrong member would satisfy it perfectly.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { describeSpecCard } from '../src/core/battle/driver';
import { createRun, chooseStarter, type RunState } from '../src/core/run';
import { createParty } from '../src/core/party';
import type { PokemonState } from '../src/core/types';
import { STAT_ORDER, statInfo } from '../src/data/statInfo';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { memberCardContents } from '../src/ui/member-card';
import { statBlock } from '../src/ui/stat-block';
import { resetSettings, setDensity } from '../src/ui/settings';

function started(): RunState {
  return chooseStarter(createRun('PARTY-STATS', DEFAULT_TUNING), 0);
}

/** A member whose six stats are all different, so a swapped row cannot pass. */
function distinctMember(): PokemonState {
  const [member] = createParty([
    { species: 'Alakazam', ability: 'Synchronize', moves: ['Psychic', 'Recover'], level: 42 },
  ]);
  if (!member) throw new Error('no member');
  return member;
}

function rowsOf(member: PokemonState): { label: string; value: string; declared: string }[] {
  const card = memberCardContents(member, { holding: null, tuning: DEFAULT_TUNING });
  return [...card.querySelectorAll('.stats--grid .stat')].map((row) => ({
    // The long form; the short form is beside it for Simple. Density patch.
    label: row.querySelector('.stat__label-long')?.textContent ?? '',
    value: row.querySelector('.stat__value')?.textContent ?? '',
    declared: (row.querySelector('.stat__bar-fill') as HTMLElement | null)?.style.width ?? '',
  }));
}

describe('the six stat rows on a member card', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    resetSettings();
  });

  it('renders one row per stat, in STAT_ORDER', () => {
    const rows = rowsOf(distinctMember());
    expect(rows).toHaveLength(STAT_ORDER.length);
    expect(rows.map((row) => row.label)).toEqual(
      STAT_ORDER.map((stat) => statInfo(stat)?.label ?? stat.toUpperCase()),
    );
  });

  /**
   * The values are the member's, not a plausible-looking six.
   *
   * `baseStatsAtLevel` carries the five boostable stats and `maxHp` supplies
   * HP, because HP-the-stat and HP-the-resource are the same number outside a
   * battle. Alakazam at 42 has six genuinely different numbers, so a row read
   * off the wrong key fails rather than coinciding.
   */
  it('prints the values describeSpecCard computed for that member', () => {
    const member = distinctMember();
    const spec = describeSpecCard(member.spec);
    const expected: Record<string, number> = { ...spec.baseStatsAtLevel, hp: member.maxHp };

    const rows = rowsOf(member);
    for (const [index, stat] of STAT_ORDER.entries()) {
      expect(rows[index]?.value, `${stat} row`).toBe(String(expected[stat]));
    }
    // And the six really are distinct, or the assertion above proves less than
    // it appears to.
    expect(new Set(STAT_ORDER.map((stat) => expected[stat])).size).toBeGreaterThan(3);
  });

  it('asks for a bar width proportional to each value, capped at the ceiling', () => {
    const member = distinctMember();
    const spec = describeSpecCard(member.spec);
    const values: Record<string, number> = { ...spec.baseStatsAtLevel, hp: member.maxHp };
    const CEILING = 200;

    const rows = rowsOf(member);
    for (const [index, stat] of STAT_ORDER.entries()) {
      const share = Math.min(100, ((values[stat] ?? 0) / CEILING) * 100);
      expect(rows[index]?.declared, `${stat} bar`).toBe(`${share}%`);
    }
  });

  /*
   * The card is the same card on every surface that draws one.
   *
   * `memberCardContents` is the shared component since 4.7 Part 1, and ruling 1
   * of this patch confirms it is *the* stat component now that V5.3 removed the
   * battle panel's block. A reduced variant is where a verdict gets smuggled in
   * as an emphasis choice, so the contents being identical is the property.
   */
  it('draws the same six rows whatever the caller', () => {
    const member = distinctMember();
    const asLead = memberCardContents(member, { holding: null, tuning: DEFAULT_TUNING, isLead: true, index: 0 });
    const asBench = memberCardContents(member, { holding: null, tuning: DEFAULT_TUNING });
    const values = (card: HTMLElement) =>
      [...card.querySelectorAll('.stats--grid .stat__value')].map((node) => node.textContent);
    expect(values(asLead)).toEqual(values(asBench));
    expect(values(asLead)).toHaveLength(6);
  });

  it('keeps the run its numbers came from playable, so the fixture is real', () => {
    const state = started();
    const member = state.party[0];
    expect(member).toBeDefined();
    expect(rowsOf(member as PokemonState)).toHaveLength(6);
  });

  /*
   * Density is asserted here only as far as the component settles it: the
   * bar's width is computed in every mode, because the component writes it
   * before deciding what to show. Which is *visible* is the stylesheet's, and
   * `test/visual-density.test.ts` owns it in a browser.
   */
  it('computes the bar width in both modes, since the mode decides display and not data', () => {
    const member = distinctMember();
    setDensity('detailed');
    const detailed = rowsOf(member).map((row) => row.declared);
    setDensity('simple');
    const simple = rowsOf(member).map((row) => row.declared);
    expect(detailed).toEqual(simple);
    expect(detailed.every((declared) => declared.endsWith('%'))).toBe(true);
  });
});

/**
 * **One component, mounted everywhere. Milestone M3.2, discrepancy D20.**
 *
 * Section 5 canonises one stat block and closes with the sentence this
 * describe block holds: *"A component that exists twice, or a screen that
 * draws a stat without the stat block, is the defect this document exists to
 * prevent."* There were three — the member card's private one, `statLine` on
 * the pick screens, and the rows M3.1 added to the inspect layer — and each
 * carried its own copy of the bar ceiling.
 *
 * The tests below are about the property rather than the refactor: the same
 * six numbers produce the same markup wherever they are drawn, and the thing
 * drawing them cannot know what decision the player is about to make.
 */
describe('the one stat block', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    resetSettings();
  });

  it('is the only thing in the tree that draws a six-stat readout', () => {
    const sources = readdirSync(join(process.cwd(), 'src/ui'), { recursive: true, encoding: 'utf8' })
      .filter((name) => typeof name === 'string' && name.endsWith('.ts'))
      .map((name) => [name, readFileSync(join(process.cwd(), 'src/ui', name), 'utf8')] as const);

    // `.statline` was the second one. Nothing may build it again — not the
    // class, not a hand-rolled row of six cells under another name.
    const statline = sources.filter(([, text]) => text.includes('statline'));
    expect(statline.map(([name]) => name), 'the pick-screen copy is gone').toEqual(['stat-block.ts']);

    // And exactly one file builds the block's rows. A second `stat__bar-fill`
    // in the tree is a second component by another name.
    const builders = sources.filter(([, text]) => text.includes("'stat__bar-fill'"));
    expect(builders.map(([name]) => name)).toEqual(['stat-block.ts']);
  });

  it('draws the same markup for the same numbers, whatever the layout', () => {
    const values = { hp: 111, atk: 60, def: 80, spa: 135, spd: 95, spe: 120 };
    const grid = statBlock(values);
    const row = statBlock(values, { layout: 'row' });
    const cells = (block: HTMLElement): string[] =>
      [...block.querySelectorAll('.stat')].map(
        (stat) =>
          [
            stat.getAttribute('data-row'),
            stat.querySelector('.glyph')?.getAttribute('data-glyph'),
            stat.querySelector('.stat__value')?.textContent,
            (stat.querySelector('.stat__bar-fill') as HTMLElement).style.width,
          ].join('|'),
      );
    // Only the modifier differs. The layout is a stylesheet decision; what a
    // stat *is* is not, which is why the two were never two components.
    expect(cells(grid)).toEqual(cells(row));
    expect(grid.className).toBe('stats stats--grid');
    expect(row.className).toBe('stats stats--row');
  });

  /**
   * **R10, in the form the rule is actually written in.**
   *
   * *"Bars compare members, never options... Emphasising the stat that matches
   * the current decision is a verdict."* The milestone asks for a test that no
   * stat row carries a sort or a conditional emphasis under any incoming move.
   *
   * The strongest version of that assertion is not a comparison of two
   * renders — it is that the component **cannot** take the incoming move. Six
   * numbers and a layout are its whole input, so there is nothing for a caller
   * to pass that would let it emphasise anything, and no call site can opt in.
   * The render comparison below is the belt to that braces: every row comes
   * out at the same weight, in `STAT_ORDER`, whatever the numbers say.
   */
  it('cannot be told what decision the player is making, and marks no row', () => {
    const lopsided = { hp: 40, atk: 200, def: 5, spa: 5, spd: 5, spe: 5 };
    const flat = { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 };
    for (const values of [lopsided, flat]) {
      const block = statBlock(values);
      const rows = [...block.querySelectorAll('.stat')];
      expect(rows).toHaveLength(6);
      // No sort: `STAT_ORDER`, never the numbers' order.
      expect(rows.map((row) => row.getAttribute('data-row'))).toEqual([...STAT_ORDER]);
      // No conditional emphasis: every row is the same element with the same
      // classes, and the only thing that differs down the column is the value.
      expect(new Set(rows.map((row) => row.className))).toEqual(new Set(['stat']));
      expect(new Set(rows.map((row) => row.querySelector('.stat__value')?.className))).toEqual(
        new Set(['stat__value']),
      );
      expect(new Set(rows.map((row) => (row.querySelector('.stat__bar-fill') as HTMLElement).className))).toEqual(
        new Set(['stat__bar-fill']),
      );
    }
  });

  it('carries the mark, and the words behind it for the two modes that keep them', () => {
    const block = statBlock({ hp: 111, atk: 60, def: 80, spa: 135, spd: 95, spe: 120 });
    const marks = [...block.querySelectorAll('.stat__label .glyph')];
    expect(marks.map((mark) => mark.getAttribute('data-glyph'))).toEqual(
      STAT_ORDER.map((stat) => `stat-${stat}`),
    );
    // The mark names the stat, because in Pocket it is the only thing that
    // does. The words do not, or a reader hears the stat twice in the modes
    // that still render one.
    expect(marks.every((mark) => mark.getAttribute('aria-label'))).toBe(true);
    expect(block.querySelectorAll('.stat__label-long')).toHaveLength(6);
    expect(block.querySelectorAll('.stat__label-short')).toHaveLength(6);
  });
});

/**
 * **The party row at rest. Milestone M3.2.**
 *
 * Section 4 budgets it at zero plus the ability name, with the species and the
 * nickname surviving. Each test names the word it keeps off the card, because
 * a census total cannot say which element regained one three patches from now.
 */
describe('the party row at rest', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    resetSettings();
  });

  const cardFor = (): HTMLElement =>
    memberCardContents(distinctMember(), { holding: null, tuning: DEFAULT_TUNING, isLead: true, index: 0 });

  it('prints the level as a number, with no field label welded to it', () => {
    const level = cardFor().querySelector('.panel__level')?.textContent ?? '';
    expect(level).not.toContain('Lv');
    expect(level).toMatch(/^42( [♀♂])?$/);
  });

  it('draws no archetype label, because the bars are on the card', () => {
    const card = cardFor();
    expect(card.querySelector('.badge--archetype')).toBeNull();
    expect(card.querySelectorAll('.stats--grid .stat')).toHaveLength(6);
  });

  it('marks the lead with its slot number rather than a second word for it', () => {
    const card = cardFor();
    expect(card.querySelector('.badge--lead'), 'the chip was the slot number said twice').toBeNull();
    expect(card.querySelector('.slot__number')?.textContent).toBe('1');
    expect(card.getAttribute('aria-label')).toContain('leading');
    expect(card.classList.contains('party__member--lead')).toBe(true);
  });

  it('renders nothing at all in the item slot when there is no item', () => {
    const slot = cardFor().querySelector('.party__item-slot') as HTMLElement;
    expect(slot, 'the slot is always built, so its position never moves').not.toBeNull();
    expect(slot.hidden).toBe(true);
    expect(slot.childElementCount).toBe(0);
    expect(cardFor().querySelector('.party__item')?.textContent).toBe('');
  });

  it('draws a held item as a sprite, with the name and the effect line behind the press', () => {
    const card = memberCardContents(distinctMember(), {
      holding: 'leftovers',
      tuning: DEFAULT_TUNING,
    });
    const slot = card.querySelector('.party__item-slot') as HTMLElement;
    expect(slot.hidden).toBe(false);
    const icon = slot.querySelector('.slot__icon') as HTMLElement;
    expect(icon, 'the sprite, not the name').not.toBeNull();
    expect(icon.style.backgroundImage).toContain('url(');
    expect(slot.textContent).toBe('');
    expect(slot.dataset['tip']).toBe('item:leftovers');
    // The effect line was a sentence at rest on a surface budgeted at zero.
    expect(card.querySelector('.party__item-effect')).toBeNull();
  });
});
