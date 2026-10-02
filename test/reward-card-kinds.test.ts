/**
 * Every reward kind renders. **The gap that let two kinds ship blank.**
 *
 * ## Rewritten by M5.1, and deliberately not weakened
 *
 * These assertions used to read the kind label, the name and the detail line
 * off every card, because that is what a card was. D36 ruled that section 3 —
 * *"the single source of truth for how each attribute renders at rest"* —
 * puts the name, the effect line and a relic's capability **on inspect**, and
 * leaves the face as a sprite. So the old assertions describe a contract the
 * bible does not want.
 *
 * What survives is the thing this file exists for: **every member of the
 * `Reward` union renders something, driven off the union itself.** Each kind
 * is now asserted against its own encoding rather than against one shared
 * shape — which is a stronger test, because a kind that fell through the
 * switch would now render an empty `<button>` and every one of these would
 * catch it.
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
import { relicCopy } from '../src/data/itemCopy';
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
  it('renders a face for every kind in the union', () => {
    const state = createRun('REWARD-CARD-KINDS');
    for (const [kind, reward] of Object.entries(ONE_OF_EACH)) {
      const card = renderRewardCard(reward, state, () => undefined);
      expect(card.children.length, `${kind} renders an empty card`).toBeGreaterThan(0);
    }
  });

  /*
   * The encoding per kind, from section 3 and section 4. This is the
   * replacement for the old "every kind has a label and a name" pass: it says
   * what each face *is* rather than asserting one shape across six kinds that
   * the bible encodes three different ways.
   */
  it('encodes each kind the way the bible asks at rest', () => {
    const state = createRun('REWARD-CARD-ENCODING');

    // Held item: the sprite in a fixed slot, and the press that opens the name
    // and the effect line. Section 3's Held item row.
    const item = renderRewardCard(ONE_OF_EACH.item, state, () => undefined);
    const slot = item.querySelector<HTMLElement>('.reward__sprite');
    expect(slot, 'the item card draws no sprite').not.toBeNull();
    expect(slot?.dataset['tip'], 'the item sprite opens no inspect panel').toBe(`item:${PREMIUM_ITEMS[0]!.id}`);
    expect(item.querySelector('.reward__detail'), 'the item card kept an effect line at rest').toBeNull();
    expect(item.querySelector('.reward__kind'), 'the item card kept a kind label').toBeNull();

    // Relic: the manifest's icon and the capability glyph it satisfies, the
    // map node's own mark (Stage 5.0/3, D65 and D66, bible Rev 17). The name
    // was the face while no relic art existed (D36, generation.md §66); it is
    // on the press now with the capability and what the relic pays.
    const relic = renderRewardCard(ONE_OF_EACH.relic, state, () => undefined);
    const icon = relic.querySelector<HTMLElement>('.reward__relic');
    expect(icon?.querySelector('[data-asset]')?.getAttribute('data-asset'), 'the relic card draws no icon').toBe(`relic:${RELICS[0]!.id}`);
    expect(icon?.dataset['tip'], 'the relic icon opens no inspect panel').toBe(`relic:${RELICS[0]!.id}`);
    expect(relic.querySelector(`[data-tip="capability:${RELICS[0]!.grants}"]`), 'the relic card draws no capability glyph').not.toBeNull();
    expect(relic.textContent, 'the relic card kept its name at rest').not.toContain(RELICS[0]!.name);

    // The three move kinds mount the move card and nothing else. Section 4:
    // "Move card (reward, TM shelf, recipient, replacement, confirm) | 0".
    for (const kind of ['tm', 'tutor', 'technique'] as const) {
      const card = renderRewardCard(ONE_OF_EACH[kind], state, () => undefined);
      expect(card.querySelector('.move'), `${kind} mounts no move card`).not.toBeNull();
      expect(card.querySelector('.reward__kind'), `${kind} kept a kind label`).toBeNull();
    }
  });

  /*
   * **The shop card is the same component.** D29: section 4 has always said a
   * shop card "follows the reward card, plus price number", and until M5.1
   * `screens/shop.ts` built its own. The price is a bare number, which section
   * 4's counting rule excludes, so it costs nothing against the budget.
   */
  it('takes a price without taking a word', () => {
    const state = createRun('REWARD-CARD-PRICE');
    const priced = renderRewardCard(ONE_OF_EACH.item, state, () => undefined, { price: 150 });
    expect(priced.querySelector('.reward__price')?.textContent).toBe('150');
    const free = renderRewardCard(ONE_OF_EACH.item, state, () => undefined);
    expect(free.querySelector('.reward__price'), 'a reward card drew a price').toBeNull();
  });

  /*
   * The detail line is asserted for every kind but `heal` and the move kinds,
   * which carry theirs as `Prose` through `setProse` rather than as text, and
   * for `item`, whose blurb is the item table's to supply. What matters here is
   * that nothing renders a card with *neither* a name nor a body.
   */
  /*
   * **Coins and restore are a mark and a bare number. Stage 5.0/3, D66.**
   *
   * Until Rev 17 they kept a kind label, a name and a line, because section 4
   * had no row for either (M5.1, generation.md §66). Rev 17 gives each a row
   * at 0: `+N` beside the currency glyph, `+N%` beside a bar. The words are
   * on the press, which is what this asserts is still reachable.
   */
  it('draws coins and restore as a mark beside a bare number', () => {
    const state = createRun('REWARD-CARD-BODY');
    const coins = renderRewardCard(ONE_OF_EACH.currency, state, () => undefined);
    expect(coins.textContent).toBe('+159');
    expect(coins.querySelector('[data-glyph="currency-coin"]'), 'the coins card draws no currency glyph').not.toBeNull();
    expect(coins.dataset['tip']).toBe('coins:159');

    const restore = renderRewardCard(ONE_OF_EACH.heal, state, () => undefined);
    expect(restore.textContent).toBe('+100%');
    expect(restore.querySelector('.hp'), 'the restore card draws no bar').not.toBeNull();
    expect(restore.dataset['tip']).toBe('restore:100');
  });

  /*
   * The ruling's own words: "relics should show you what they are. On the
   * card." A name is not what it is — the effect text is, and it already
   * exists on the table.
   */
  it('still says what a relic does, through the press rather than on the face', () => {
    /*
     * The R19 ruling's words were *"relics should show you what they are. On
     * the card."* D36 moved where: section 3 puts a relic's name and the
     * capability it satisfies on inspect, and `RELIC_COPY` goes with them. The
     * fact is not dropped — C2 forbids that — it is reached by the `relic:`
     * tip, which is the same panel the party screen's relic list and the
     * drawer's chips open. This asserts the route exists and that the copy
     * behind it is non-empty, which is what the ruling was actually protecting.
     */
    const state = createRun('REWARD-CARD-RELIC');
    const relic = RELICS[0]!;
    const card = renderRewardCard(ONE_OF_EACH.relic, state, () => undefined);
    // The icon carries the press since Stage 5.0/3 (D66); it was the name.
    const icon = card.querySelector<HTMLElement>('.reward__relic');
    expect(icon?.dataset['tip']).toBe(`relic:${relic.id}`);
    expect(icon?.getAttribute('aria-label')).toBe(relic.name);
    expect(relicCopy(relic.id), 'the relic has no description to open').not.toBe('');
  });

  /*
   * A technique is a status move, and the one thing the card must not let a
   * player assume is that it attacks. `REWARD_COPY.tm` would have read "a new
   * move", which is true and misleading; this asserts the distinction survives
   * a future copy edit.
   */
  it('tells a technique apart from a TM by the glyph, not by a sentence', () => {
    /*
     * **The fact survives; the channel changed, which is C2 working.** The
     * sentence that used to carry it — "a status move: it does no damage" —
     * was a sentence at rest on a card section 4 budgets at zero, and M5.1
     * removed it. What tells the two apart now is the move card's **category
     * glyph**, which is section 2's second family, costs no words, and was
     * already on both cards saying the same thing twice (R3).
     *
     * Asserted off `data-category`, which `ui/scene.ts` sets from the move's
     * own category, so this fails if a technique ever stops reading as status.
     */
    const state = createRun('REWARD-CARD-TECHNIQUE');
    const categoryOf = (reward: Reward): string | undefined =>
      renderRewardCard(reward, state, () => undefined).querySelector<HTMLElement>('[data-category]')?.dataset[
        'category'
      ];
    expect(categoryOf(ONE_OF_EACH.technique), 'a technique does not read as a status move').toBe('status');
    expect(categoryOf(ONE_OF_EACH.tm), 'the TM fixture is not a damaging move').not.toBe('status');
  });
});
