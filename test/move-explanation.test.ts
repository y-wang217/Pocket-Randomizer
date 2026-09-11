/**
 * @vitest-environment jsdom
 *
 * `describeMove`, and the explanation built from it. **Patch 4.7.2, step 5.**
 *
 * Three properties, in the order they matter:
 *
 *   1. **`describeMove` is correct**, over a sweep that includes a never-miss
 *      move, a priority move, a stat-change move, a multi-hit move and a recoil
 *      move — the five the brief names — plus the cases that turned out to be
 *      the interesting ones.
 *   2. **It is pure.** Identical input, identical output, and no RNG.
 *   3. **The panel it feeds says the same things**, and opening one submits
 *      nothing.
 *
 * The sixth-surface count and the "never advances a turn" assertion on a real
 * screen belong to `test/visual-move-cards.test.ts`, which has a browser.
 */
import { describe, expect, it } from 'vitest';

import { describeMove } from '../src/core/battle/driver';
import { moveTags } from '../src/core/moveTags';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { moveExplanation, moveExplanationRows } from '../src/ui/move-explanation';
import { moveCardData } from '../src/ui/move-detail';
import { moveCard } from '../src/ui/scene';

/** The explanation for a move, or a failure that names it. */
function explain(name: string) {
  const move = describeMove(name);
  if (!move) throw new Error(`no dex entry for ${name}`);
  return move;
}

const rowsFor = (name: string): Record<string, string[]> => {
  const move = explain(name);
  const out: Record<string, string[]> = {};
  for (const row of moveExplanationRows(move, moveTags(move))) {
    out[row.label] = [...(out[row.label] ?? []), row.value];
  }
  return out;
};

describe('describeMove over the sweep the brief names', () => {
  it('reports a never-miss move as never missing, not as 100%', () => {
    // The sim spells "does not check accuracy" as `true`, which is a different
    // fact from 100% — a 100% move can still be made to miss.
    expect(explain('Swift').accuracy).toBe(true);
    expect(explain('Aerial Ace').accuracy).toBe(true);
    expect(rowsFor('Swift')['Accuracy']).toEqual(['Never misses']);
  });

  it('reports a priority move by its bracket', () => {
    expect(explain('Quick Attack').priority).toBe(1);
    expect(explain('Feint').priority).toBe(2);
    expect(explain('Extreme Speed').priority).toBe(2);
    expect(rowsFor('Quick Attack')['Priority']).toEqual(['Moves in the +1 priority bracket']);
  });

  it('reports a stat-change move with the stat, the stages and the side', () => {
    expect(explain('Swords Dance').boosts).toEqual([{ stat: 'atk', stages: 2, target: 'self' }]);
    expect(explain('Growl').boosts).toEqual([{ stat: 'atk', stages: -1, target: 'foe' }]);
    expect(rowsFor('Swords Dance')['Stat change']).toEqual(["Raises Attack by 2 stages"]);
  });

  it('reports a multi-hit move as a range', () => {
    expect(explain('Icicle Spear').multiHit).toEqual([2, 5]);
    expect(explain('Population Bomb').multiHit).toEqual([10, 10]);
    expect(explain('Tackle').multiHit).toBeUndefined();
  });

  it('reports recoil and drain as fractions of the damage dealt', () => {
    expect(explain('Double-Edge').recoil).toBeCloseTo(1 / 3, 2);
    expect(explain('Giga Drain').drain).toBeCloseTo(1 / 2, 2);
    expect(explain('Tackle').recoil).toBeUndefined();
    expect(rowsFor('Giga Drain')['Drain']).toEqual(['The user recovers half of the damage dealt']);
  });

  it('reports a secondary as a chance and an effect', () => {
    expect(explain('Flamethrower').secondary).toEqual({ chance: 10, status: 'brn' });
    expect(rowsFor('Flamethrower')['Secondary']).toEqual(['10% chance to burn the target']);
    expect(explain('Tackle').secondary).toBeUndefined();
  });

  it('reports the behavioural flags by the sim’s own names', () => {
    expect(explain('Tackle').flags).toContain('contact');
    expect(explain('Boomburst').flags).toContain('sound');
    expect(explain('Feint').bypassesProtect).toBe(true);
    expect(explain('Slash').highCrit).toBe(true);
  });

  it('carries the short dex description, and it is last', () => {
    const rows = moveExplanationRows(explain('Toxic'), moveTags(explain('Toxic')));
    expect(rows.at(-1)?.label).toBe('Dex');
    expect(rows.at(-1)?.value).toMatch(/poison/i);
  });

  /**
   * Test 7 of the brief, and the case it was written for.
   *
   * Banding happens on a multi-hit move's *total* power, so Population Bomb is
   * band 4 at 20 base power. Both numbers are right and a card showing one
   * without the other reads as a bug — so the panel carries both, plus the line
   * that reconciles them.
   */
  it('reports Population Bomb at 20 base power and band 4, and says why', () => {
    const move = explain('Population Bomb');
    expect(move.basePower).toBe(20);
    expect(move.band).toBe(4);

    const rows = rowsFor('Population Bomb');
    expect(rows['Base power']).toEqual(['20']);
    expect(rows['Band']).toEqual(['4']);
    expect(rows['Multi-hit']).toEqual(['Hits 10 times, 20 base power each.']);
  });

  it('omits an absent field rather than rendering an empty row', () => {
    const rows = rowsFor('Tackle');
    expect(rows['Recoil']).toBeUndefined();
    expect(rows['Secondary']).toBeUndefined();
    expect(rows['Stat change']).toBeUndefined();
    expect(rows['Priority']).toBeUndefined();
    // Every rendered row has a non-empty value, which is the general form.
    const move = explain('Tackle');
    for (const row of moveExplanationRows(move, moveTags(move))) {
      expect(row.value.trim(), row.label).not.toBe('');
    }
  });

  it('renders no base power row for a status move, which has none', () => {
    expect(rowsFor('Swords Dance')['Base power']).toBeUndefined();
    expect(rowsFor('Tackle')['Base power']).toEqual(['40']);
  });
});

describe('describeMove is pure', () => {
  const SWEEP = ['Swift', 'Quick Attack', 'Swords Dance', 'Icicle Spear', 'Double-Edge', 'Flamethrower', 'Toxic', 'Population Bomb', 'Solar Beam'];

  it('returns identical output for identical input, every time', () => {
    for (const name of SWEEP) {
      const first = JSON.stringify(describeMove(name));
      for (let attempt = 0; attempt < 3; attempt++) {
        expect(JSON.stringify(describeMove(name)), name).toBe(first);
      }
    }
  });

  it('is order independent, so no call leaves state behind for the next', () => {
    const forwards = SWEEP.map((name) => JSON.stringify(describeMove(name)));
    const backwards = [...SWEEP].reverse().map((name) => JSON.stringify(describeMove(name)));
    expect(backwards.reverse()).toEqual(forwards);
  });

  it('takes an id or a name and answers the same', () => {
    expect(describeMove('Quick Attack')).toEqual(describeMove('quickattack'));
  });

  it('returns null for a move that does not exist, rather than throwing', () => {
    expect(describeMove('Not A Move')).toBeNull();
  });

  /**
   * `moveExplanationRows` is pure too, which is what makes the panel testable
   * without a DOM — and what stops a future row reaching for the clock, the
   * run state or anything else that would make one card differ from another
   * showing the same move.
   */
  it('builds identical rows from identical input', () => {
    for (const name of SWEEP) {
      const move = explain(name);
      const once = moveExplanationRows(move, moveTags(move));
      const twice = moveExplanationRows(move, moveTags(move));
      expect(twice, name).toEqual(once);
    }
  });
});

describe('the explanation panel', () => {
  it('starts collapsed and opens on tap', () => {
    const move = explain('Flamethrower');
    const { trigger, panel } = moveExplanation(move, moveTags(move), 'probe');
    expect(panel.hidden).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe('probe');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(panel.hidden).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(panel.hidden).toBe(true);
  });

  /**
   * **Test 10, in the form that can be asserted without a browser.**
   *
   * A move card is drawn inside an element that submits on click — the reward
   * card is the case — so the trigger must stop the event. This builds exactly
   * that arrangement and asserts the outer handler never fires.
   */
  it('never lets the tap reach a control the card sits inside', () => {
    const outer = document.createElement('button');
    let submitted = 0;
    outer.addEventListener('click', () => {
      submitted += 1;
    });

    const facts = explain('Ice Beam');
    outer.append(moveCard(moveCardData({ ...facts, maxPp: facts.maxPp }, DEFAULT_TUNING)));
    document.body.append(outer);

    const trigger = outer.querySelector('.move__explain-toggle');
    expect(trigger, 'the card must carry an expander').not.toBeNull();
    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(outer.querySelector('.move__explain')?.hasAttribute('hidden')).toBe(false);
    expect(submitted, 'opening an explanation submitted the card it sits in').toBe(0);

    // And the card itself still works as a control when tapped anywhere else.
    outer.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(submitted).toBe(1);
    document.body.replaceChildren();
  });

  it('gives each card on a screen its own panel id', () => {
    const a = moveCard(moveCardData({ ...explain('Tackle'), maxPp: 56 }, DEFAULT_TUNING));
    const b = moveCard(moveCardData({ ...explain('Tackle'), maxPp: 56 }, DEFAULT_TUNING));
    const idA = a.querySelector('.move__explain')?.id;
    const idB = b.querySelector('.move__explain')?.id;
    expect(idA).toBeTruthy();
    expect(idA).not.toBe(idB);
    expect(a.querySelector('.move__explain-toggle')?.getAttribute('aria-controls')).toBe(idA);
  });

  it('carries no expander when there is nothing to explain', () => {
    // A card built without going through `moveCardData` has no explanation, and
    // gets no expander rather than an empty one.
    const bare = moveCard({ name: 'Nothing', type: 'Normal', category: 'Physical', basePower: 0, maxPp: 0 });
    expect(bare.querySelector('.move__explain-toggle')).toBeNull();
  });
});
