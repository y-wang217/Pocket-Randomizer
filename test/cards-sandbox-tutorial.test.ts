/**
 * @vitest-environment jsdom
 *
 * Hearts, bubbles, the MP bar and the tutorial, driven by taps in jsdom
 * (`docs/spec/gymrun-patch-card-battle-hearts-and-tutorial.md`). The script
 * itself, headless, is `test/cards-tutorial.test.ts`; fit and touch targets
 * on a phone are the browser test's.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { openCardTest } from '../src/ui/cardbattle-entry';
import { openSandbox } from '../src/ui/cardbattle/sandbox';
import { mountCardRun } from '../src/ui/cardrun/shell';
import { tutorialSeen } from '../src/ui/cardbattle/prefs';

const all = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];
const one = (root: ParentNode, selector: string) => root.querySelector<HTMLElement>(selector)!;
const skipBeats = (root: HTMLElement) => root.dispatchEvent(new Event('pointerdown'));
const begin = (root: HTMLElement) => (all(root, '.cb-btn--primary')[0] as HTMLButtonElement).click();
const panel = (root: HTMLElement, id: string) => one(root, `.cb-panel[data-id="${id}"]`);
const coach = (root: HTMLElement) => one(root, '.cb-coach');
const stepOf = (root: HTMLElement) => (coach(root).hidden ? null : (coach(root).dataset['step'] ?? null));
const menu = (root: HTMLElement) => all(root, '.cb-actions .cb-btn').at(-1)!.click();
const sheetButton = (root: HTMLElement, label: string) => all(root, '.cb-sheet .cb-btn').find((b) => b.textContent === label);

beforeEach(() => {
  globalThis.localStorage.clear();
});

describe('hearts, bubbles and the MP bar', () => {
  it('draws HP as hearts, base shield as ringed bubbles, and a bubble on each shielded piece', () => {
    const sandbox = openSandbox(document.body, { seed: 'METER1', encounter: 'test' });
    const root = sandbox.root;
    // The Sword dasher: 3 HP, base shield 2.
    const c = panel(root, 'C');
    expect(all(c, '.cb-heart[data-full="true"]')).toHaveLength(3);
    expect(all(c, '.cb-heart[data-full="false"]')).toHaveLength(0);
    expect(all(c, '.cb-bubble[data-base="true"]')).toHaveLength(2);
    expect(one(c, '.cb-vitals').getAttribute('aria-label')).toBe('HP 3/3 · Shield 0 · Base 2');
    // A Drone: 3 HP, base 1, on a dark panel.
    const drone = all(root, '.cb-panel--enemy')[0]!;
    expect(all(drone, '.cb-heart')).toHaveLength(3);
    expect(all(drone, '.cb-bubble')).toHaveLength(1);
    // The old line and bar are gone.
    expect(root.querySelector('.cb-panel .cb-stat, .cb-panel .cb-bar')).toBeNull();
    // Every piece here has a base shield: a dashed dome and its count.
    const token = one(root, '.cb-token[data-id="C"]');
    expect(one(token, '.cb-token-bubble').dataset['kind']).toBe('base');
    expect(one(token, '.cb-token-shield').textContent).toBe('2');
    expect(one(token, '.cb-token-hp').textContent).toBe('3');
    sandbox.close();
  });

  it('draws MP as five cells with the ult starred at its cost, and none for the Sword dasher', () => {
    const sandbox = openSandbox(document.body, { seed: 'TUTOR1', encounter: 'tutorial' });
    const root = sandbox.root;
    begin(root);
    const cells = (id: string) => all(panel(root, id), '.cb-mana-cell');
    expect(cells('A')).toHaveLength(5);
    // The Commander opens round 1 on 1 MP; Moon Strike costs 4.
    expect(cells('A').map((c) => c.dataset['state'])).toEqual(['free', 'empty', 'empty', 'empty', 'empty']);
    expect(cells('A').findIndex((c) => c.dataset['ult'] === 'true')).toBe(3);
    expect(one(panel(root, 'A'), '.cb-mana-star').dataset['ready']).toBeUndefined();
    expect(one(panel(root, 'A'), '.cb-mana').getAttribute('aria-label')).toBe('MP 1 free, 0 held, of 5, Moon Strike at 4');
    expect(cells('B').findIndex((c) => c.dataset['ult'] === 'true')).toBe(3);
    expect(panel(root, 'C').querySelector('.cb-mana-star')).toBeNull();

    // Call Medic on the Gunner holds the Commander's one MP.
    one(root, '.cb-card[data-card="call-medic"]').click();
    panel(root, 'B').click();
    expect(cells('A').map((c) => c.dataset['state'])).toEqual(['held', 'empty', 'empty', 'empty', 'empty']);
    sandbox.close();
  });
});

describe('the tutorial', () => {
  it('walks placement, Start, the hand, the meters, a Move, the slots, an attack and End Turn, then the dummy falls', () => {
    const sandbox = openSandbox(document.body, { tutorial: true });
    const root = sandbox.root;
    expect(all(root, '.cb-panel--enemy')).toHaveLength(1);
    expect(one(root, '.cb-panel--enemy .cb-panel-name').textContent).toBe('Target Dummy 1');

    // Placement waits: a tap on the panel passes nothing, and lands on nothing under it.
    expect(stepOf(root)).toBe('place');
    expect(one(root, '[data-coach="units"]').dataset['coachTarget']).toBe('true');
    expect(one(root, '.cb-coach-skip').hidden).toBe(false);
    expect(one(root, '.cb-coach-next').textContent).toBe('Skip step');
    one(root, '.cb-coach-text').click();
    expect(stepOf(root)).toBe('place');

    one(root, '.cb-tile[data-lane="1"][data-col="2"]').click();
    one(root, '.cb-tile[data-lane="1"][data-col="1"]').click();
    expect(stepOf(root)).toBe('start');
    expect(one(root, '[data-coach="end"]').dataset['coachTarget']).toBe('true');
    begin(root);

    // Three steps a tap passes.
    expect(stepOf(root)).toBe('hand');
    expect(one(root, '.cb-coach-skip').hidden).toBe(true);
    coach(root).click();
    expect(stepOf(root)).toBe('vitals');
    expect(one(root, '.cb-panel[data-id="A"] [data-coach="vitals"]').dataset['coachTarget']).toBe('true');
    coach(root).click();
    expect(stepOf(root)).toBe('mana');
    expect(one(root, '.cb-coach-text').textContent).toContain('Moon Strike at 4');
    coach(root).click();

    // Move: the card, who plays it, a lit tile.
    expect(stepOf(root)).toBe('move');
    expect(one(root, '.cb-card[data-card="move"]').dataset['coachTarget']).toBe('true');
    one(root, '.cb-card[data-card="move"]').click();
    panel(root, 'C').click();
    all(root, '.cb-tile').find((t) => t.querySelector('.cb-ov--selectable'))!.click();
    expect(stepOf(root)).toBe('slots');
    expect(one(root, '.cb-slot--filled').dataset['coachTarget']).toBe('true');
    coach(root).click();

    expect(stepOf(root)).toBe('attack');
    one(root, '.cb-card[data-card="shoot"]').click();
    expect(stepOf(root)).toBe('end');
    begin(root);
    skipBeats(root);
    expect(stepOf(root)).toBe('finish');
    expect(one(root, '.cb-token--enemy').dataset['coachTarget']).toBe('true');
    // Shoot popped the dummy's bubble.
    expect(all(root, '.cb-panel--enemy .cb-bubble')).toHaveLength(0);
    expect(tutorialSeen()).toBe(false);

    for (let round = 0; round < 10 && !sheetButton(root, 'Play Skirmish'); round++) {
      menu(root);
      sheetButton(root, 'Bot turn')!.click();
      const end = all(root, '.cb-btn--primary')[0] as HTMLButtonElement;
      if (!end.disabled) end.click();
      skipBeats(root);
    }
    expect(one(root, '.cb-sheet-title').textContent).toMatch(/^Won/);
    expect(one(root, '.cb-sheet-tutorial').textContent).toBe('Tutorial complete: the dummy is down.');
    expect(coach(root).hidden).toBe(true);
    expect(tutorialSeen()).toBe(true);

    // Play Skirmish leaves the dummy for the default scenario.
    sheetButton(root, 'Play Skirmish')!.click();
    expect(all(root, '.cb-panel--enemy')).toHaveLength(3);
    expect(stepOf(root)).toBeNull();
    sandbox.close();
  });

  it('passes steps the player already did, and Skip step passes a waiting one', () => {
    const sandbox = openSandbox(document.body, { tutorial: true });
    const root = sandbox.root;
    // Start without placing: the placement step passes with it.
    begin(root);
    expect(stepOf(root)).toBe('hand');
    one(root, '.cb-coach-next').click();
    one(root, '.cb-coach-next').click();
    one(root, '.cb-coach-next').click();
    expect(stepOf(root)).toBe('move');
    // Skip step on a waiting step.
    one(root, '.cb-coach-next').click();
    expect(stepOf(root)).toBe('slots');
    // Nothing is planned: the slots step points at the Commander's empty slots.
    expect(one(root, '[data-coach="slots"]').dataset['coachTarget']).toBe('true');
    coach(root).click();
    expect(stepOf(root)).toBe('attack');
    sandbox.close();
  });

  it('Skip tutorial records it seen and opens the default scenario; the Menu opens it again, out of the scenario list', () => {
    const sandbox = openSandbox(document.body, { tutorial: true });
    const root = sandbox.root;
    one(root, '.cb-coach-skip').click();
    expect(tutorialSeen()).toBe(true);
    expect(stepOf(root)).toBeNull();
    expect(all(root, '.cb-panel--enemy')).toHaveLength(3);

    menu(root);
    expect(all(root, '.cb-scenario').map((b) => b.textContent)).not.toContainEqual(expect.stringContaining('Tutorial'));
    sheetButton(root, 'Tutorial')!.click();
    expect(stepOf(root)).toBe('place');
    expect(one(root, '.cb-panel--enemy .cb-panel-name').textContent).toBe('Target Dummy 1');
    // Restart keeps the tutorial; New seed leaves it, on the same battle.
    menu(root);
    sheetButton(root, 'Restart')!.click();
    expect(stepOf(root)).toBe('place');
    menu(root);
    sheetButton(root, 'New seed')!.click();
    expect(stepOf(root)).toBeNull();
    sandbox.close();
  });

  it('hides while a round plays back, and never opens without being asked', () => {
    const plain = openSandbox(document.body, { seed: 'JSDOM1' });
    expect(stepOf(plain.root)).toBeNull();
    plain.close();

    const sandbox = openSandbox(document.body, { tutorial: true });
    const root = sandbox.root;
    begin(root);
    // Hand, vitals, mana, Move (skipped), slots: then Shoot.
    for (let i = 0; i < 5; i++) one(root, '.cb-coach-next').click();
    one(root, '.cb-card[data-card="shoot"]').click();
    expect(stepOf(root)).toBe('end');
    begin(root);
    // Mid-playback: jsdom has no matchMedia, so motion is not reduced.
    expect(root.querySelector('.cb-banner[data-on="true"]')).not.toBeNull();
    expect(coach(root).hidden).toBe(true);
    skipBeats(root);
    expect(stepOf(root)).toBe('finish');
    sandbox.close();
  });

  it('opens from the hidden entry on a first visit only', async () => {
    await openCardTest(document.body);
    const first = one(document, '.cb');
    expect(stepOf(first)).toBe('place');
    one(first, '.cb-coach-skip').click();
    one(first, '.cb-exit').click();
    expect(document.querySelector('.cb')).toBeNull();

    await openCardTest(document.body);
    const again = one(document, '.cb');
    expect(stepOf(again)).toBeNull();
    expect(all(again, '.cb-panel--enemy')).toHaveLength(3);
    one(again, '.cb-exit').click();
  });

  it("leads the card run's title on a first visit, and hands back to the title when skipped or done", () => {
    const host = document.createElement('div');
    document.body.append(host);
    const { root } = mountCardRun(host);
    const titleButtons = () => all(root, '.cr-title .cr-btn').map((b) => `${b.textContent}${b.classList.contains('cr-btn--primary') ? '*' : ''}`);
    expect(titleButtons()).toEqual(['Tutorial*', 'New run', 'Sandbox']);

    all(root, '.cr-btn').find((b) => b.textContent === 'Tutorial')!.click();
    const battle = one(document, '.cb');
    expect(stepOf(battle)).toBe('place');
    one(battle, '.cb-coach-skip').click();
    // Skip leaves the battle screen for the title, not for Skirmish.
    expect(document.querySelector('.cb')).toBeNull();
    expect(tutorialSeen()).toBe(true);
    expect(titleButtons()).toEqual(['New run*', 'Tutorial', 'Sandbox']);

    // Finished from the title: the result sheet's button is Exit.
    all(root, '.cr-btn').find((b) => b.textContent === 'Tutorial')!.click();
    const again = one(document, '.cb');
    begin(again);
    for (let round = 0; round < 12 && !again.querySelector('.cb-sheet-tutorial'); round++) {
      menu(again);
      sheetButton(again, 'Bot turn')!.click();
      const end = all(again, '.cb-btn--primary')[0] as HTMLButtonElement;
      if (!end.disabled) end.click();
      skipBeats(again);
    }
    expect(sheetButton(again, 'Play Skirmish')).toBeUndefined();
    all(again, '.cb-sheet .cb-btn--primary')[0]!.click();
    expect(document.querySelector('.cb')).toBeNull();
    host.remove();
  });
});
