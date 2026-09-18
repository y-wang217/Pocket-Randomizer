/**
 * Every reward kind renders. **The gap that let two kinds ship blank.**
 *
 * `renderRewardCard`'s switch had no `case 'relic'` and no `case 'technique'`,
 * so both fell through and drew their `KIND_LABELS` chip over an empty name and
 * an empty detail. A playtest screenshot caught the relic; the technique had
 * been blank since `generation.md` section 31 made status moves reachable and
 * nobody had seen one.
 *
 * It shipped because the only two tests that called `renderRewardCard` —
 * `test/chip.test.ts` and `test/band-badge.test.ts` — both passed
 * `{ kind: 'tm' }`, which is one of the five kinds that already worked. So the
 * assertion here is deliberately not "the relic card renders": it is **every
 * member of the `Reward` union renders**, driven off the union itself, so the
 * sixth kind cannot be forgotten the way the fifth was.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { renderRewardCard } from '../src/ui/screens/reward';
import { createRun } from '../src/core/run';
import type { Reward } from '../src/core/rewards';
import { RELICS } from '../src/data/relics';
import { PREMIUM_ITEMS } from '../src/data/items';

/**
 * One of every kind.
 *
 * Typed as `Record<Reward['kind'], Reward>` on purpose: adding a kind to the
 * union makes this table fail to compile, which is the only mechanism that
 * would have caught the original defect at the moment it was introduced.
 */
const ONE_OF_EACH: Record<Reward['kind'], Reward> = {
  item: { kind: 'item', item: PREMIUM_ITEMS[0]!.id },
  currency: { kind: 'currency', amount: 159 },
  heal: { kind: 'heal', fraction: 1 },
  tm: { kind: 'tm', move: 'Ice Beam' },
  tutor: { kind: 'tutor', move: 'Hydro Pump' },
  technique: { kind: 'technique', move: 'Leech Seed' },
  relic: {
    kind: 'relic',
    relic: RELICS[0]!.id,
    alternates: [],
    fallback: { kind: 'currency', amount: 1 },
  },
};

describe('the reward card', () => {
  it('gives every kind a name the player can read', () => {
    const state = createRun('REWARD-CARD-KINDS');
    for (const [kind, reward] of Object.entries(ONE_OF_EACH)) {
      const card = renderRewardCard(reward, state, () => undefined);
      const label = card.querySelector('.reward__kind')?.textContent ?? '';
      const name = card.querySelector('.reward__name')?.textContent ?? '';
      expect(label, `${kind} has no kind label`).not.toBe('');
      expect(name, `${kind} renders a blank name`).not.toBe('');
    }
  });

  /*
   * The detail line is asserted for every kind but `heal` and the move kinds,
   * which carry theirs as `Prose` through `setProse` rather than as text, and
   * for `item`, whose blurb is the item table's to supply. What matters here is
   * that nothing renders a card with *neither* a name nor a body.
   */
  it('gives every kind something under the name', () => {
    const state = createRun('REWARD-CARD-BODY');
    for (const [kind, reward] of Object.entries(ONE_OF_EACH)) {
      const card = renderRewardCard(reward, state, () => undefined);
      const body = (card.textContent ?? '').replace(/\s+/g, ' ').trim();
      const name = card.querySelector('.reward__name')?.textContent ?? '';
      expect(body.length, `${kind} renders an empty card`).toBeGreaterThan(name.length);
    }
  });

  /*
   * The ruling's own words: "relics should show you what they are. On the
   * card." A name is not what it is — the effect text is, and it already
   * exists on the table.
   */
  it('says what a relic does, not only what it is called', () => {
    const state = createRun('REWARD-CARD-RELIC');
    const relic = RELICS[0]!;
    const card = renderRewardCard(ONE_OF_EACH.relic, state, () => undefined);
    expect(card.querySelector('.reward__name')?.textContent).toBe(relic.name);
    expect(card.querySelector('.reward__detail')?.textContent).toBe(relic.playerDescription);
  });

  /*
   * A technique is a status move, and the one thing the card must not let a
   * player assume is that it attacks. `REWARD_COPY.tm` would have read "a new
   * move", which is true and misleading; this asserts the distinction survives
   * a future copy edit.
   */
  it('tells a technique apart from a TM in the copy, not only in the label', () => {
    const state = createRun('REWARD-CARD-TECHNIQUE');
    const technique = renderRewardCard(ONE_OF_EACH.technique, state, () => undefined);
    const tm = renderRewardCard(ONE_OF_EACH.tm, state, () => undefined);
    const detailOf = (card: HTMLElement): string =>
      card.querySelector('.reward__detail')?.textContent ?? '';
    expect(detailOf(technique)).not.toBe('');
    expect(detailOf(technique)).not.toBe(detailOf(tm));
    expect(detailOf(technique).toLowerCase()).toContain('no damage');
  });
});
