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
import { beforeEach, describe, expect, it } from 'vitest';

import { describeSpecCard } from '../src/core/battle/driver';
import { createRun, chooseStarter, type RunState } from '../src/core/run';
import { createParty } from '../src/core/party';
import type { PokemonState } from '../src/core/types';
import { STAT_ORDER, statInfo } from '../src/data/statInfo';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { memberCardContents } from '../src/ui/member-card';
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
  return [...card.querySelectorAll('.stats--party .stat')].map((row) => ({
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
      [...card.querySelectorAll('.stats--party .stat__value')].map((node) => node.textContent);
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
