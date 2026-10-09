/**
 * @vitest-environment jsdom
 *
 * The sandbox screen driven by taps in jsdom: it opens, every tap it offers
 * goes through the engine, the log records what was accepted, and it closes
 * clean. **Card battle engine, checkpoint 5.** Layout and fit are the browser
 * test's (`test/visual-card-battle.test.ts`).
 */
import { describe, expect, it, vi } from 'vitest';

import { createBattle } from '../src/core/cards/create';
import { replay, type BattleLog } from '../src/core/cards/log';
import { openSandbox } from '../src/ui/cardbattle/sandbox';

const all = (root: HTMLElement, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];
/** A tap anywhere: it skips a round's playback to the end, as any first tap does. */
const skip = (root: HTMLElement) => root.dispatchEvent(new Event('pointerdown'));
/** Deployment's Start: the default placement stands. */
const begin = (root: HTMLElement) => (all(root, '.cb-btn--primary')[0] as HTMLButtonElement).click();

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
    expect(all(root, '.cb-tile')).toHaveLength(21);
    expect(all(root, '.cb-card').length).toBeGreaterThanOrEqual(5);
    begin(root);

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
      skip(root);
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

  it('a Neutral asks who plays it even when one unit can, and a unit that cannot says why', () => {
    // Round 1 of the bug report's seed: only A has the MP for Attack.
    const sandbox = openSandbox(document.body, { seed: 'X5A72HUA', encounter: 'test' });
    const root = sandbox.root;
    begin(root);
    const panel = (id: string) => all(root, '.cb-panel--unit').find((p) => p.querySelector('.cb-panel-name')!.textContent!.startsWith(`${id} `))!;
    const filled = (id: string) => panel(id).querySelectorAll('.cb-slot--filled').length;

    all(root, '.cb-card[data-card="attack"]')[0]!.click();
    expect(filled('A')).toBe(0);
    expect(root.querySelector('.cb-note')!.textContent).toBe('Pick who plays it · B, C: Not enough MP');
    expect(panel('A').dataset['target']).toBe('true');
    expect(panel('B').dataset['blocked']).toBe('true');

    panel('B').click();
    expect(root.querySelector('.cb-note')!.textContent).toBe('B: Not enough MP');
    expect(filled('B')).toBe(0);

    panel('A').click();
    expect(filled('A')).toBe(1);
    sandbox.close();
  });

  it('plays a committed round back step by step, a tap skips it, and the round log keeps it', () => {
    const sandbox = openSandbox(document.body, { seed: 'X5A72HUA', encounter: 'test' });
    const root = sandbox.root;
    begin(root);
    const panel = (id: string) => all(root, '.cb-panel--unit').find((p) => p.querySelector('.cb-panel-name')!.textContent!.startsWith(`${id} `))!;
    all(root, '.cb-card[data-card="shoot"]')[0]!.click();
    all(root, '.cb-card[data-card="attack"]')[0]!.click();
    panel('A').click();
    // Each placed card wears its place in the order.
    expect(panel('B').querySelector('.cb-slot-order')!.textContent).toBe('1');
    expect(panel('A').querySelector('.cb-slot-order')!.textContent).toBe('2');

    all(root, '.cb-btn--primary')[0]!.click();
    const banner = root.querySelector('.cb-banner')!;
    expect(banner.getAttribute('data-on')).toBe('true');
    expect(banner.querySelector('.cb-banner-count')!.textContent).toMatch(/^1\/\d+$/);
    expect(banner.querySelector('.cb-banner-title')!.textContent).toBe('B · Shoot');
    expect(root.querySelector('.cb-round')!.textContent).toBe('Round 1');

    // A click during playback skips it and lands on nothing.
    all(root, '.cb-actions .cb-btn').at(-1)!.click();
    expect(banner.getAttribute('data-on')).toBeNull();
    expect((root.querySelector('.cb-sheet') as HTMLElement).hidden).toBe(true);
    expect(root.querySelector('.cb-round')!.textContent).toBe('Round 2');

    all(root, '.cb-actions .cb-btn').at(-1)!.click();
    all(root, '.cb-sheet .cb-btn').find((b) => b.textContent === 'Round log')!.click();
    const titles = all(root, '.cb-roundlog-title').map((t) => t.textContent);
    expect(titles.slice(0, 2)).toEqual(['B · Shoot', 'A · Attack']);
    sandbox.close();
  });

  it('a tap on an unplayable card plays nothing and says why', () => {
    const sandbox = openSandbox(document.body, { seed: 'JSDOM2' });
    const root = sandbox.root;
    begin(root);
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

  it('opens in deployment: a unit and a home tile place it, a unit swaps, Start begins round 1, and the log keeps it all', async () => {
    let copied = '';
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async (text: string) => void (copied = text)) },
    });
    const sandbox = openSandbox(document.body, { seed: 'DEPLOY1' });
    const root = sandbox.root;
    const tile = (lane: number, col: number) => root.querySelector<HTMLElement>(`.cb-tile[data-lane="${lane}"][data-col="${col}"]`)!;
    const unitOn = (lane: number, col: number) => tile(lane, col).querySelector('.cb-token--unit')?.getAttribute('data-id') ?? null;
    expect(root.querySelector('.cb-note')!.textContent).toBe('Place your units on the home rows, then Start');
    expect(root.querySelector('.cb-btn--primary')!.textContent).toBe('Start');
    expect(all(root, '.cb-pill')).toHaveLength(0);

    // A to the back row.
    tile(1, 2).click();
    expect(all(root, '.cb-tile').filter((t) => t.querySelector('.cb-ov--selectable'))).toHaveLength(5);
    tile(1, 1).click();
    expect(unitOn(1, 1)).toBe('A');
    // C onto B's tile: they swap.
    tile(3, 2).click();
    tile(2, 2).click();
    expect([unitOn(2, 2), unitOn(3, 2)]).toEqual(['C', 'B']);
    // A card is not played before the start.
    all(root, '.cb-card')[0]!.click();
    expect(all(root, '.cb-slot--filled')).toHaveLength(0);

    begin(root);
    expect(root.querySelector('.cb-btn--primary')!.textContent).toBe('End Turn');
    expect(all(root, '.cb-pill').length).toBeGreaterThan(0);

    all(root, '.cb-actions .cb-btn').at(-1)!.click();
    all(root, '.cb-sheet .cb-btn').find((b) => b.textContent === 'Copy log')!.click();
    await Promise.resolve();
    const log = JSON.parse(copied) as BattleLog;
    expect(log.encounterId).toBe('skirmish');
    expect(log.actions.map((a) => a.type)).toEqual(['place', 'place', 'start']);
    expect(replay(log).state.phase).toBe('plan');
    sandbox.close();
  });

  it('Bot turn places the units, then plays a round, and the log keeps every action it took', () => {
    const sandbox = openSandbox(document.body, { seed: 'BOTTURN' });
    const root = sandbox.root;
    const botTurn = () => {
      all(root, '.cb-actions .cb-btn').at(-1)!.click();
      all(root, '.cb-sheet .cb-btn').find((b) => b.textContent === 'Bot turn')!.click();
      skip(root);
    };
    botTurn();
    expect(root.querySelector('.cb-btn--primary')!.textContent).toBe('End Turn');
    expect(root.querySelector('.cb-tile[data-col="1"] .cb-token[data-id="A"]')).not.toBeNull();
    botTurn();
    expect(root.querySelector('.cb-round')!.textContent).toBe('Round 2');
    sandbox.close();
  });

  it('the menu lists every scenario, and a tap opens it', () => {
    const sandbox = openSandbox(document.body, { seed: 'SCEN1' });
    const root = sandbox.root;
    all(root, '.cb-actions .cb-btn').at(-1)!.click();
    const names = all(root, '.cb-scenario').map((b) => b.getAttribute('aria-label'));
    // Each with its grade total, a seeded-spawn scenario's included.
    expect(names).toEqual([
      'Skirmish, Grade 5',
      'Front line, Grade 5',
      'Staggered, Grade 5',
      'Turret Alley, Grade 5',
      'Wall and Gun, Grade 7',
      'The Pack, Grade 6',
    ]);
    expect(all(root, '.cb-scenario-grade').map((g) => g.textContent)).toEqual(['Grade 5', 'Grade 5', 'Grade 5', 'Grade 5', 'Grade 7', 'Grade 6']);
    all(root, '.cb-scenario').find((b) => b.getAttribute('aria-label') === 'Staggered, Grade 5')!.click();
    const enemyRows = all(root, '.cb-token--enemy').map((t) => t.closest<HTMLElement>('.cb-tile')!.dataset['col']).sort();
    expect(enemyRows).toEqual(['6', '7', '7']);
    all(root, '.cb-actions .cb-btn').at(-1)!.click();
    all(root, '.cb-scenario').find((b) => b.getAttribute('aria-label') === 'The Pack, Grade 6')!.click();
    expect(all(root, '.cb-token--enemy').map((t) => t.getAttribute('aria-label'))).toEqual(['P4', 'H1', 'H2', 'H3']);
    sandbox.close();
  });

  it('marks every card, panel and token with its owner, a Neutral with no letter, and a Fast enemy with its badge', () => {
    const sandbox = openSandbox(document.body, { seed: 'COLOUR1', encounter: 'the-pack' });
    const root = sandbox.root;
    for (const card of all(root, '.cb-card')) {
      const owner = card.dataset['owner'];
      expect(['A', 'B', 'C', 'neutral']).toContain(owner);
      expect(card.querySelector('.cb-card-edge')).not.toBeNull();
      expect(card.querySelector('.cb-card-owner')?.textContent ?? null).toBe(owner === 'neutral' ? null : owner);
    }
    expect(all(root, '.cb-panel--unit').map((p) => p.dataset['owner'])).toEqual(['A', 'B', 'C']);
    expect(all(root, '.cb-token--unit').map((t) => t.dataset['owner']).sort()).toEqual(['A', 'B', 'C']);
    // Three Hounds are Fast, the Pikeman is not: on the token and on the panel.
    expect(all(root, '.cb-token--enemy .cb-token-fast')).toHaveLength(3);
    expect(all(root, '.cb-panel--enemy .cb-fast')).toHaveLength(3);
    begin(root);
    // Round 1: each telegraph chip names the enemy it is from.
    const from = new Set(all(root, '.cb-threat-from').map((c) => c.textContent));
    expect([...from].every((label) => /^[HP][1-4]$/.test(label!))).toBe(true);
    sandbox.close();
  });

  it('a tapped unit filters the hand to what it can play, skips who-plays-it, and clears three ways', () => {
    // A seed whose round 1 hand holds the Neutral Move, which B can play.
    const seed = Array.from({ length: 200 }, (_, i) => `FILTER${i}`).find((candidate) => {
      const created = createBattle('test', candidate);
      return created.ok && created.state.piles.hand.some((iid) => created.state.cards[iid]!.def === 'move');
    })!;
    const sandbox = openSandbox(document.body, { seed, encounter: 'test' });
    const root = sandbox.root;
    begin(root);
    const panel = (id: string) => all(root, '.cb-panel--unit').find((p) => p.dataset['id'] === id)!;
    const hand = () => all(root, '.cb-card').map((c) => c.dataset['card']);
    const full = hand();

    panel('B').click();
    expect(panel('B').dataset['filter']).toBe('true');
    expect(root.querySelector('.cb-filter-showing')!.textContent).toBe('Showing B · Show all');
    const shown = all(root, '.cb-card');
    expect(shown.length).toBeGreaterThan(0);
    for (const card of shown) expect(['B', 'neutral']).toContain(card.dataset['owner']);
    expect(shown.some((c) => c.dataset['card'] === 'move')).toBe(true);
    const other = root.querySelector('.cb-filter-other');
    expect(other?.textContent ?? '+0 other').toBe(`+${full.length - shown.length} other`);

    // The filter names who plays the Neutral: no "Pick who plays it".
    all(root, '.cb-card[data-card="move"]')[0]!.click();
    expect(root.querySelector('.cb-note')!.textContent).not.toBe('Pick who plays it');
    all(root, '.cb-tile').find((t) => t.querySelector('.cb-ov--selectable'))!.click();
    expect(panel('B').querySelectorAll('.cb-slot--filled')).toHaveLength(1);
    expect(root.querySelector('.cb-filter-showing')).not.toBeNull();

    // Show all clears it; the same unit again clears it; End Turn clears it.
    (root.querySelector('.cb-filter-showing') as HTMLElement).click();
    expect(root.querySelector('.cb-filter')).toBeNull();
    expect(hand()).toEqual(full);
    panel('A').click();
    expect(root.querySelector('.cb-filter-showing')!.textContent).toBe('Showing A · Show all');
    panel('A').click();
    expect(root.querySelector('.cb-filter')).toBeNull();
    panel('C').click();
    (all(root, '.cb-btn--primary')[0] as HTMLButtonElement).click();
    skip(root);
    expect(root.querySelector('.cb-filter')).toBeNull();
    sandbox.close();
  });

  it('shows the new rules: the round 1 grace note, an enemy entry under Inspect, and a Blast card naming its friendly fire', () => {
    // A seed whose round 1 hand holds Fire!.
    const seed = Array.from({ length: 200 }, (_, i) => `RULES${i}`).find((candidate) => {
      const created = createBattle('the-pack', candidate);
      return created.ok && created.state.piles.hand.some((iid) => created.state.cards[iid]!.def === 'fire');
    })!;
    const sandbox = openSandbox(document.body, { seed, encounter: 'the-pack' });
    const root = sandbox.root;
    begin(root);
    expect(root.querySelector('.cb-note')!.textContent).toBe('Round 1: enemies are getting into position');
    const inspectButton = () => all(root, '.cb-actions .cb-btn').find((b) => b.textContent === 'Inspect')!;
    const entry = () => root.querySelector('.cb-inspect')!.textContent;

    inspectButton().click();
    all(root, '.cb-panel--enemy')[0]!.click();
    expect(entry()).toContain('Hound 1');
    expect(entry()).toContain('Grade 1');
    expect(entry()).toContain('Fast: attacks from round 1, for 1.');
    inspectButton().click();
    all(root, '.cb-panel--enemy')[3]!.click();
    expect(entry()).toContain('Pikeman 4');
    expect(entry()).toContain('Round 1: most enemies set up instead of attacking.');
    inspectButton().click();
    all(root, '.cb-card[data-card="fire"]')[0]!.click();
    expect(entry()).toContain('Blast hits allies on its tiles too. Not the unit that plays it.');
    sandbox.close();
  });

  it('Restart deals the same battle again, New seed a different one', () => {
    const sandbox = openSandbox(document.body, { seed: 'JSDOM4' });
    const root = sandbox.root;
    const hand = () => all(root, '.cb-card').map((c) => c.dataset['card']).join(',');
    const first = hand();
    begin(root);
    all(root, '.cb-btn--primary')[0]!.click();
    skip(root);
    all(root, '.cb-actions .cb-btn').at(-1)!.click();
    all(root, '.cb-sheet .cb-btn').find((b) => b.textContent === 'Restart')!.click();
    expect(root.querySelector('.cb-round')!.textContent).toBe('Round 1');
    expect(hand()).toBe(first);
    sandbox.close();
  });
});
