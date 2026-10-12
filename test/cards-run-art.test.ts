/**
 * @vitest-environment jsdom
 *
 * The card run's art slots (`docs/spec/gymrun-card-run-menus-art.md`,
 * `ui/cardrun/assets.ts`): every file in `src/ui/assets/cardrun/` is a slot's,
 * a slot draws its file when it has one and a fallback when it does not, and
 * each screen asks for the slots the mock puts on it. The prompt that
 * generates the files is `docs/reports/card-run-menus-asset-prompt.md`.
 */
import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { createRun, stepRun, type CardRunState, type RunAction } from '../src/core/cards/cardrun';
import { runBotAction } from '../src/core/cards/cardrunBot';
import { guardBot } from '../src/core/cards/guard';
import { RUN_ASSETS, runAsset, strayRunFiles, type RunAssetId } from '../src/ui/cardrun/assets';
import { mountCardRun } from '../src/ui/cardrun/shell';

const SAVE = 'gymrun.cardrun.v1';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

describe('the slots', () => {
  it('holds no file in the folder that is not a slot', () => {
    expect(strayRunFiles()).toEqual([]);
  });

  it('gives every icon a fallback and the sign its slice', () => {
    for (const [id, def] of Object.entries(RUN_ASSETS)) {
      if (def.kind === 'icon') expect('fallback' in def && def.fallback, id).toBeTruthy();
      if (def.kind === 'sign') expect('slice' in def && def.slice.length, id).toBe(4);
    }
  });

  it('draws a missing file as its fallback, never as text in a label', () => {
    const icon = runAsset('stop-city', {});
    expect(icon.dataset['missing']).toBe('true');
    expect(icon.dataset['fallback']).toBe('⌂');
    expect(icon.textContent).toBe('');
    expect([icon.style.width, icon.style.height]).toEqual(['48px', '48px']);
    expect(runAsset('bg-route', {}).dataset['missing']).toBe('true');
  });

  it('draws a file that has arrived: a picture, or the sign cut nine ways', () => {
    const icon = runAsset('stop-city', { '../assets/cardrun/stop-city.svg': '/stop-city.svg' });
    expect(icon.dataset['missing']).toBeUndefined();
    expect(icon.style.getPropertyValue('--cr-asset-image')).toBe('url("/stop-city.svg")');
    const sign = runAsset('sign-plank', { '../assets/cardrun/sign-plank.svg': '/sign.svg' });
    expect(sign.style.borderImage).toContain('/sign.svg');
    expect([sign.style.borderTopWidth, sign.style.borderRightWidth, sign.style.borderBottomWidth, sign.style.borderLeftWidth]).toEqual(['30px', '33px', '19px', '33px']);
  });

  it('agrees with the prompt: every slot is named there with its viewBox', () => {
    const prompt = readFileSync('docs/reports/card-run-menus-asset-prompt.md', 'utf8');
    for (const [id, def] of Object.entries(RUN_ASSETS)) {
      expect(prompt, id).toContain(`\`${id}.svg\``);
      expect(prompt, id).toContain(`${def.viewBox[0]} × ${def.viewBox[1]}`);
    }
  });
});

/** The bot's run on `seed` up to `until`, resumed in the shell. */
async function resumeAt(seed: string, until: (s: CardRunState) => boolean): Promise<HTMLElement> {
  const bot = guardBot();
  let run = createRun(seed);
  const actions: RunAction[] = [];
  while (run.screen.k === 'battle' || !until(run)) {
    const action = runBotAction(run, bot);
    if (!action) throw new Error('the run ended first');
    const result = stepRun(run, action);
    if (!result.ok) throw new Error(result.reason);
    actions.push(action);
    run = result.state;
  }
  localStorage.setItem(SAVE, JSON.stringify({ version: run.version, seed, actions }));
  const host = document.createElement('div');
  document.body.append(host);
  const { root } = mountCardRun(host);
  [...root.querySelectorAll<HTMLElement>('.cr-btn')].find((b) => b.textContent === 'Continue run')!.click();
  await tick();
  return root;
}

const slots = (root: ParentNode, selector: string): RunAssetId[] =>
  [...root.querySelectorAll<HTMLElement>(`${selector} .cr-asset, ${selector}.cr-asset`)].map((n) => n.dataset['asset'] as RunAssetId);

describe('each screen asks for its slots', () => {
  it('the route: its backdrop, the sign, a pin per stop, the scout', async () => {
    const root = await resumeAt('STEP7A', (s) => s.screen.k === 'route');
    expect(slots(root, '.cr-backdrop')).toEqual(['bg-route']);
    expect(slots(root, '.cr-heading')).toEqual(['sign-plank']);
    expect(slots(root, '.cr-choices')).toEqual(['stop-city', 'stop-town', 'stop-wild']);
    expect(slots(root, '.cr-foot')).toEqual(['char-scout']);
    expect(slots(root, '.cr-header')).toEqual(['icon-supplies', 'icon-deck']);
  });

  it('the City: its backdrop, the market and the defense quest rows, the trader saying its line', async () => {
    const root = await resumeAt('STEP7A', (s) => s.screen.k === 'city');
    expect(slots(root, '.cr-backdrop')).toEqual(['bg-city']);
    expect(slots(root, '.cr-choices')).toEqual(['city-market', 'city-defense']);
    expect(slots(root, '.cr-foot')).toEqual(['char-trader']);
    expect(root.querySelector('.cr-says')!.textContent).toBe('Take a look! Good gear makes the road easier.');
  });

  it('the offer: the market backdrop and the trader; each card its picture from the battle', async () => {
    const root = await resumeAt('STEP7A', (s) => s.screen.k === 'cards');
    expect(slots(root, '.cr-backdrop')).toEqual(['bg-market']);
    expect(slots(root, '.cr-foot')).toEqual(['char-trader']);
    expect(root.querySelectorAll('.cr-cards .cr-card-art')).toHaveLength(3);
  });

  it('the boss: a portrait beside every offer and a star on each talent', async () => {
    const root = await resumeAt('STEP7A', (s) => s.screen.k === 'boost');
    const offers = [...root.querySelectorAll('.cr-choice--unit')];
    expect(offers.length).toBe(3);
    for (const offer of offers) expect(offer.querySelector('.cr-portrait [data-asset^="portrait-"]')).not.toBeNull();
    expect(root.querySelectorAll('.cr-choice--unit .cr-choice-name [data-asset="icon-star"]').length).toBeGreaterThan(0);
    expect(slots(root, '.cr-foot')).toEqual(['char-party']);
  });
});
