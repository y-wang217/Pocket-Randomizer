/**
 * @vitest-environment jsdom
 *
 * The card run's screens driven by taps in jsdom (`ui/cardrun/shell.ts`):
 * the title starts a run, its first battle opens over the run, stepping out
 * shows the run, the battle's actions step the run, and a reload resumes it
 * from the saved log. `docs/generation.md` 125r.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { createRun, replayRun, type RunLog } from '../src/core/cards/cardrun';
import { mountCardRun } from '../src/ui/cardrun/shell';

const all = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];
const byText = (root: ParentNode, selector: string, text: string) => all(root, selector).find((n) => n.textContent === text);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const SAVE = 'gymrun.cardrun.v1';

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

describe('the card run screens', () => {
  it('starts a run from the title, opens its first battle over the run, and saves every action', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const { root } = mountCardRun(host);
    expect(byText(root, '.cr-btn', 'Continue run')).toBeUndefined();
    byText(root, '.cr-btn', 'New run')!.click();
    await tick();
    // The first fight's battle is open over the run, in its run mode: no restart, a Run button.
    const battle = document.querySelector<HTMLElement>('.cb')!;
    expect(battle).not.toBeNull();
    expect(byText(battle, '.cb-btn-label', 'Run')).toBeDefined();
    // Start the battle: the run saves the action.
    (all(battle, '.cb-btn--primary')[0] as HTMLButtonElement).click();
    const saved = JSON.parse(localStorage.getItem(SAVE)!) as RunLog;
    expect(saved.actions).toEqual([{ type: 'battle', action: { type: 'start' } }]);
    expect(replayRun(saved).battle!.state.phase).toBe('plan');
    // Step out to the run: the battle screen closes and the run offers it again.
    (byText(battle, '.cb-btn-label', 'Run')!.parentElement as HTMLButtonElement).click();
    await tick();
    expect(document.querySelector('.cb')).toBeNull();
    expect(root.querySelector('.cr-screen')!.getAttribute('data-screen')).toBe('battle');
    expect(byText(root, '.cr-btn', 'Return to the battle')).toBeDefined();
  });

  it('resumes a saved run from the title, at the decision it was waiting on', async () => {
    // A run on its first stop: its first battle won by the bot, decisions saved.
    const { playRunBot } = await import('../src/core/cards/cardrunBot');
    const seed = 'SHELL1';
    const played = playRunBot(createRun(seed), 400);
    const firstStop = played.actions.findIndex((a) => a.type === 'go');
    const log: RunLog = { version: createRun(seed).version, seed, actions: played.actions.slice(0, firstStop) };
    expect(replayRun(log).screen.k).toBe('route');
    localStorage.setItem(SAVE, JSON.stringify(log));

    const host = document.createElement('div');
    document.body.append(host);
    const { root } = mountCardRun(host);
    byText(root, '.cr-btn', 'Continue run')!.click();
    await tick();
    expect(root.querySelector('.cr-screen')!.getAttribute('data-screen')).toBe('route');
    expect(all(root, '.cr-choice').map((c) => c.dataset['kind'])).toEqual(['city', 'town', 'wild']);
    // The Wild pays at once; its supplies are on the header.
    const before = Number(root.querySelector('.cr-supplies-n')!.textContent);
    all(root, '.cr-choice')[2]!.click();
    expect(root.querySelector('.cr-screen')!.getAttribute('data-screen')).toBe('wild');
    expect(Number(root.querySelector('.cr-supplies-n')!.textContent)).toBeGreaterThan(before);
  });

  it('drops a save from another version loudly and offers a new run', () => {
    localStorage.setItem(SAVE, JSON.stringify({ version: 'cardrun-0.0.0', seed: 'OLD', actions: [] }));
    const host = document.createElement('div');
    document.body.append(host);
    const { root } = mountCardRun(host);
    byText(root, '.cr-btn', 'Continue run')!.click();
    expect(root.querySelector('.cr-message')!.textContent).toMatch(/another version/);
    expect(localStorage.getItem(SAVE)).toBeNull();
    expect(byText(root, '.cr-btn', 'New run')).toBeDefined();
  });
});
