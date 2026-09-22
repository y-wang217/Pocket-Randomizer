/**
 * Every event fits the event screen's budget. **Milestone M5.6, D33.**
 *
 * M5.6's done-when asks for *"a lint at build"* over every event in
 * `data/events.ts` rather than over the one the census happens to render, and
 * this is it: `scripts/check.mjs` runs the suite, so a row that goes over
 * stops the build the same way a type error does.
 *
 * ## The number, and where it came from
 *
 * Design bible section 4's event row said **40**, composed as *"prompt under
 * 30, choices under 6 each, outcome one line"* — 30 plus four sixes is 54
 * before the outcome, so the row's own composition exceeded the row's own
 * total, and the row never mentioned the four hints that are the whole of the
 * overflow. That is discrepancy **D33**, ruled option 1 on 2026-09-22: name
 * the hints and re-derive the number.
 *
 * The composition below is the ruling's, and the numbers under it are what the
 * tree measured *before* the copy was rewritten, so the budget is derived from
 * the corpus rather than guessed at and then enforced:
 *
 * | | min | p50 | p90 | max |
 * |---|---:|---:|---:|---:|
 * | hook | 6 | 9 | 12 | 12 |
 * | label | 2 | 4 | 6 | 7 |
 * | hint | 7 | 10 | 13 | 15 |
 *
 * The hooks already fit at 12, twenty-four out of twenty-four. The labels fit
 * at 4 in sixty-eight of ninety-six. **No hint fit at 6, and none was close**,
 * which is why M5.6 is a copy rewrite and not a copy edit.
 *
 * ## The row is 59, and the copy is 52 of it
 *
 * D33's composition is the copy alone, and its arithmetic — 12 plus four
 * fours plus four sixes — comes to 52 exactly, with nothing left for anything
 * else on the screen. That is the defect D33 was filed about, one revision
 * later, so the amended row names every part: the copy's 52, the Toll's price
 * chip at 5, and the control at 2. Fifty-nine, and it adds up.
 *
 * The requirement, the band and the reward tier cost nothing because they are
 * glyphs since M5.6 — section 3's own encodings, mounted rather than redrawn.
 * The revealed outcome lines are drawn from the pools rather than authored and
 * cannot be read from these tables; the **census** is what covers them, on the
 * wordiest event in the tree.
 */
import { describe, expect, it } from 'vitest';

import { describeToll } from '../src/core/events';
import { EVENTS } from '../src/data/events';
import { eventHint, eventHook, eventLabel } from '../src/data/eventCopy';
import { EVENT_ARCHETYPES } from '../src/data/eventPools';

/** Design bible section 4, event row, as amended by D33. */
const BUDGET = { hook: 12, label: 4, hint: 6, copy: 52, price: 5, control: 2, screen: 59 } as const;

/** The one control the screen carries after a pick, and the one label left. */
const CONTROL = 'Carry on';
const PRICE_LABEL = 'Costs';

/** Words as the census counts them, minus its proper-noun rule: every token. */
function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Deliberately stricter than the census.
 *
 * The census drops a capitalised token whose lowercase form is a species, move,
 * ability, item or locale name, so `Cross and keep going` counts as three words
 * there and four here. Counting every token means the budget cannot be met by
 * an accident of vocabulary — a label that fits only because `Reach` happens to
 * be half of an ability name is not a label that fits.
 */
describe('every event fits section 4', () => {
  it('keeps every hook inside the hook budget', () => {
    for (const event of EVENTS) {
      expect(words(eventHook(event.id)), `${event.id} hook`).toBeLessThanOrEqual(BUDGET.hook);
    }
  });

  it('keeps every label and every hint inside theirs', () => {
    for (const event of EVENTS) {
      for (const archetype of EVENT_ARCHETYPES) {
        expect(words(eventLabel(event.id, archetype)), `${event.id} ${archetype} label`).toBeLessThanOrEqual(
          BUDGET.label,
        );
        expect(words(eventHint(event.id, archetype)), `${event.id} ${archetype} hint`).toBeLessThanOrEqual(BUDGET.hint);
      }
    }
  });

  it('keeps the whole authored screen inside the row', () => {
    for (const event of EVENTS) {
      const total =
        words(eventHook(event.id)) +
        EVENT_ARCHETYPES.reduce(
          (running, archetype) =>
            running + words(eventLabel(event.id, archetype)) + words(eventHint(event.id, archetype)),
          0,
        );
      expect(total, `${event.id} total`).toBeLessThanOrEqual(BUDGET.copy);
    }
  });

  /**
   * The whole surface, not only the copy: the Toll's price is a word the
   * screen spends and `Carry on` is the control it spends after the pick.
   */
  it('keeps the whole screen inside the row, price and control included', () => {
    for (const event of EVENTS) {
      const price = words(`${PRICE_LABEL} ${describeToll(event.toll)}`);
      expect(price, `${event.id} price`).toBeLessThanOrEqual(BUDGET.price);

      const total =
        words(eventHook(event.id)) +
        EVENT_ARCHETYPES.reduce(
          (running, archetype) =>
            running + words(eventLabel(event.id, archetype)) + words(eventHint(event.id, archetype)),
          0,
        ) +
        price +
        words(CONTROL);
      expect(total, `${event.id} screen`).toBeLessThanOrEqual(BUDGET.screen);
    }
  });

  /**
   * The sub-budgets have to be able to add up to the row, or the row repeats
   * D33's own defect one revision later.
   */
  it('has a composition that sums to the row', () => {
    expect(BUDGET.hook + EVENT_ARCHETYPES.length * (BUDGET.label + BUDGET.hint)).toBe(BUDGET.copy);
    expect(BUDGET.copy + BUDGET.price + BUDGET.control).toBe(BUDGET.screen);
    expect(words(CONTROL)).toBe(BUDGET.control);
  });
});
