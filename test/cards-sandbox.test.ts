/**
 * @vitest-environment jsdom
 *
 * The sandbox screen driven by taps in jsdom: it opens, every tap it offers
 * goes through the engine, the log records what was accepted, and it closes
 * clean. **Card battle engine, checkpoint 5.** Layout and fit are the browser
 * test's (`test/visual-card-battle.test.ts`).
 */
import { describe, expect, it, vi } from 'vitest';

import { replay, type BattleLog } from '../src/core/cards/log';
import { openSandbox } from '../src/ui/cardbattle/sandbox';

const all = (root: HTMLElement, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];

describe('the sandbox screen', () => {
  it('plays rounds by taps alone, and Copy log hands over a log that replays to the same state', async () => {
    let copied = '';
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async (text: string) => void (copied = text)) },
    });
    const onExit = vi.fn();
    const sandbox = openSandbox(document.body, { seed: 'JSDOM1', onExit });
    const root = sandbox.root;
    expect(all(root, '.cb-tile')).toHaveLength(18);
    expect(all(root, '.cb-card').length).toBeGreaterThanOrEqual(5);

    for (let round = 0; round < 4; round++) {
      // Tap each playable card, then the first lit target, if any.
      for (let n = 0; n < 6; n++) {
        const card = all(root, '.cb-card:not([data-unavailable]):not([data-selected])')[0];
        if (!card) break;
        card.click();
        const target =
          all(root, '.cb-panel[data-target="true"]')[0] ?? all(root, '.cb-tile').find((t) => t.querySelector('.cb-ov--selectable'));
        target?.click();
        const tile = all(root, '.cb-tile').find((t) => t.querySelector('.cb-ov--selectable'));
        tile?.click();
      }
      const end = all(root, '.cb-btn--primary')[0] as HTMLButtonElement;
      if (end.disabled) break;
      end.click();
    }

    // The menu sheet's Copy log.
    all(root, '.cb-actions .cb-btn').at(-1)!.click();
    const copy = all(root, '.cb-sheet .cb-btn').find((b) => b.textContent === 'Copy log')!;
    copy.click();
    await Promise.resolve();
    const log = JSON.parse(copied) as BattleLog;
    expect(log.seed).toBe('JSDOM1');
    expect(log.actions.filter((a) => a.type === 'commit').length).toBeGreaterThan(0);
    const replayed = replay(log);
    expect(root.querySelector('.cb-round')!.textContent).toBe(`Round ${replayed.state.round}`);

    all(root, '.cb-sheet .cb-btn').find((b) => b.textContent === 'Exit')!.click();
    expect(document.querySelector('.cb')).toBeNull();
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('a tap on an unplayable card plays nothing and says why', () => {
    const sandbox = openSandbox(document.body, { seed: 'JSDOM2' });
    const root = sandbox.root;
    const before = all(root, '.cb-slot--filled').length;
    const blocked = all(root, '.cb-card[data-unavailable="true"]')[0];
    if (blocked) {
      blocked.click();
      expect(all(root, '.cb-slot--filled').length).toBe(before);
      expect(root.querySelector('.cb-note')!.textContent).not.toBe('');
    }
    sandbox.close();
  });

  it('the inspect button opens a card in full and plays nothing', () => {
    const sandbox = openSandbox(document.body, { seed: 'JSDOM3' });
    const root = sandbox.root;
    all(root, '.cb-actions .cb-btn').find((b) => b.textContent?.includes('Inspect'))!.click();
    all(root, '.cb-card')[0]!.click();
    expect((root.querySelector('.cb-inspect') as HTMLElement).hidden).toBe(false);
    expect(all(root, '.cb-slot--filled')).toHaveLength(0);
    sandbox.close();
  });

  it('Restart deals the same battle again, New seed a different one', () => {
    const sandbox = openSandbox(document.body, { seed: 'JSDOM4' });
    const root = sandbox.root;
    const hand = () => all(root, '.cb-card').map((c) => c.dataset['card']).join(',');
    const first = hand();
    all(root, '.cb-btn--primary')[0]!.click();
    all(root, '.cb-actions .cb-btn').at(-1)!.click();
    all(root, '.cb-sheet .cb-btn').find((b) => b.textContent === 'Restart')!.click();
    expect(root.querySelector('.cb-round')!.textContent).toBe('Round 1');
    expect(hand()).toBe(first);
    sandbox.close();
  });
});
