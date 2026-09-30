/**
 * Tap selects, the band claims. **Stage 5.0/3, D69, bible Rev 17.**
 *
 * The plan asked for *"selection cursor on the picked card, confirm to
 * claim"*. D69 ruled how that stays an attribute rather than a verdict: no
 * card is selected at rest, a tap selects and opens the shared band with the
 * card as its content, the band's commit is the claim, and its cancel returns
 * to the cards without leaving the offer. The selection never reaches the
 * run: the pick is answered once, on the commit.
 *
 * Then the two long-press panels the coins and restore cards' words moved to
 * (D66), because a fact that leaves a face must still be one press away (C2).
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';

import { createRun } from '../src/core/run';
import type { Reward, RewardOffer } from '../src/core/rewards';
import { DEFAULT_DISPLAY_TUNING } from '../src/data/displayTuning';
import { PREMIUM_ITEMS } from '../src/data/items';
import { openBandOf } from '../src/ui/band';
import { createResultScreen } from '../src/ui/screens/result';
import { renderOfferCards } from '../src/ui/screens/reward';
import { createTooltips } from '../src/ui/tooltips';

const OFFER: readonly Reward[] = [
  { kind: 'item', item: PREMIUM_ITEMS[0]!.id },
  { kind: 'currency', amount: 40 },
  { kind: 'heal', fraction: 0.5 },
];

afterEach(() => {
  openBandOf()?.close();
  document.body.replaceChildren();
});

function mountCards(onClaim: (index: number) => void): HTMLElement[] {
  const cards = renderOfferCards(OFFER, createRun('REWARD-CLAIM'), onClaim);
  const row = document.createElement('div');
  row.className = 'rewards';
  row.append(...cards);
  document.body.append(row);
  return cards;
}

const band = (): HTMLElement | null => document.body.querySelector('.confirm-band');
const commit = (): void => band()?.querySelector<HTMLElement>('.primary-action')?.click();
const back = (): void => band()?.querySelector<HTMLElement>('.button--hollow')?.click();

describe('the claim', () => {
  it('selects nothing at rest', () => {
    const cards = mountCards(() => undefined);
    for (const card of cards) {
      expect(card.getAttribute('aria-pressed')).toBe('false');
      expect(card.dataset['selected']).toBeUndefined();
    }
    expect(band()).toBeNull();
  });

  it('selects on a tap and opens the band with the card as its content, claiming nothing yet', () => {
    const claims: number[] = [];
    const cards = mountCards((index) => claims.push(index));
    cards[1]!.click();
    expect(cards.map((card) => card.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(band()).not.toBeNull();
    const content = band()?.querySelector('.confirm-band__content .reward');
    expect(content?.tagName, 'the band copy is a control').toBe('DIV');
    expect(content?.getAttribute('data-kind')).toBe('currency');
    expect(claims).toEqual([]);
  });

  it('returns to the three cards on the way out, and never leaves the offer', () => {
    const claims: number[] = [];
    const cards = mountCards((index) => claims.push(index));
    cards[0]!.click();
    back();
    expect(band()).toBeNull();
    expect(claims).toEqual([]);
    expect(cards.every((card) => card.getAttribute('aria-pressed') === 'false')).toBe(true);
    // And the offer is still live: another card can be taken.
    cards[2]!.click();
    commit();
    expect(claims).toEqual([2]);
  });

  it('claims exactly once, on the commit', () => {
    const claims: number[] = [];
    const cards = mountCards((index) => claims.push(index));
    cards[2]!.click();
    commit();
    expect(claims).toEqual([2]);
    // A second tap after the claim opens nothing and claims nothing.
    cards[0]!.click();
    expect(band()).toBeNull();
    commit();
    expect(claims).toEqual([2]);
  });

  it('reaches the result screen once, with the committed index', () => {
    const screen = createResultScreen();
    document.body.append(screen.root);
    const offer: RewardOffer = { nodeId: 's0-1-0', badge: 'gym', options: [...OFFER] };
    const done: (number | null)[] = [];
    screen.render(null, offer, createRun('REWARD-CLAIM-RESULT'), (index) => done.push(index));
    const cards = [...screen.root.querySelectorAll<HTMLElement>('.rewards .reward')];
    expect(cards).toHaveLength(3);
    cards[1]!.click();
    expect(done).toEqual([]);
    commit();
    expect(done).toEqual([1]);
  });
});

describe('the words that left the coins and restore faces', () => {
  async function inspect(tip: string, data: Record<string, string> = {}): Promise<HTMLElement | null> {
    const host = document.createElement('div');
    document.body.append(host);
    const layer = createTooltips(host, { ...DEFAULT_DISPLAY_TUNING, inspectHoldMs: 0 });
    const node = document.createElement('span');
    node.dataset['tip'] = tip;
    for (const [key, value] of Object.entries(data)) node.dataset[key] = value;
    host.append(node);
    node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const body = host.querySelector<HTMLElement>('.tip__body');
    layer.destroy();
    return body;
  }

  it('names the coins, what they buy, and the balance the caller handed in', async () => {
    const body = await inspect('coins:40', { detail: '13' });
    expect(body?.querySelector('.tip__title')?.textContent).toBe('+40 Coins');
    expect(body?.textContent).toContain('shop');
    expect(body?.textContent).toContain('13');
  });

  it('names a partial restore as partial and a full one as full', async () => {
    const partial = await inspect('restore:50');
    expect(partial?.querySelector('.tip__title')?.textContent).toBe('Restore 50%');
    expect(partial?.textContent).toContain('share');
    const full = await inspect('restore:100');
    expect(full?.querySelector('.tip__title')?.textContent).toBe('Full restore');
  });
});
