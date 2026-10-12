/**
 * The card run's screens in a real browser at phone size (card run shapes,
 * step 7b, item 14, `docs/spec/gymrun-card-run-shapes-prompt.md`): the offer,
 * replace and boss screens, and a battle with a veteran on the board and a
 * stun planned against it. Each resumes a run log played by the fixture's bot
 * (`test/fixtures/card-run-screens.ts`) on the built app.
 *
 * Like the battle's own browser tests (`test/visual-card-battle.test.ts`),
 * these assert what a screenshot is taken to check, at 390x844: no page
 * scroll sideways, every touch target at least 44px, and step 7a's marks on
 * screen. `GYMRUN_CB_SHOTS=<dir>` saves each screen for a look by eye. There
 * is no pixel baseline: the run is set in the system font stack, which
 * differs between machines (`test/visual/harness.ts`).
 */
import { mkdirSync } from 'node:fs';

import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RUN_COPY_BY_LANGUAGE } from '../src/cardData/cardrunCopy';
import { CARD_LANGUAGES, type CardLanguage } from '../src/cardData/copy';
import type { CardRunState, RunLog } from '../src/core/cards/cardrun';
import { concussOnVeteran, runTo } from './fixtures/card-run-screens';
import { openHarness, type Harness } from './visual/harness';

const PHONE = { width: 390, height: 844 };
const SAVE = 'gymrun.cardrun.v1';
const PREFS = 'gymrun.cardbattle.prefs';
const shots = process.env['GYMRUN_CB_SHOTS'];
if (shots) mkdirSync(shots, { recursive: true });

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 180_000);

afterAll(async () => {
  await harness?.close();
});

/** The built app with `log` saved, resumed from the title: the run stands on the screen the log stopped at. */
async function resume(log: RunLog, language: CardLanguage = 'en'): Promise<{ page: Page; errors: string[]; close: () => Promise<void> }> {
  const context = await harness.browser.newContext({ viewport: PHONE, hasTouch: true });
  await context.addInitScript(([key, value]) => globalThis.localStorage.setItem(key!, value!), [SAVE, JSON.stringify(log)]);
  await context.addInitScript(([key, value]) => globalThis.localStorage.setItem(key!, value!), [PREFS, JSON.stringify({ language, palette: 'standard' })]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${harness.url}/`, { waitUntil: 'load' });
  await page.getByRole('button', { name: RUN_COPY_BY_LANGUAGE[language].continueRun }).click();
  return { page, errors, close: () => context.close() };
}

/** Sideways scroll, and the run's touch targets under 44px. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const d = globalThis.document.documentElement;
    const small = [...globalThis.document.querySelectorAll<HTMLElement>('.cr button, .cr .cr-card--tap, .cb button, .cb .cb-card, .cb .cb-tile')]
      .filter((node) => node.offsetParent !== null && !(node as HTMLButtonElement).disabled)
      .map((node) => ({ what: `${node.className} ${node.textContent?.slice(0, 16) ?? ''}`, r: node.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 44 || r.height < 44)
      .map(({ what }) => what);
    return { overflowX: d.scrollWidth - globalThis.innerWidth, small };
  });
}

async function shoot(page: Page, name: string): Promise<void> {
  if (shots) await page.screenshot({ path: `${shots}/run-${name}.png`, fullPage: true });
}

describe('the card run at 390x844', () => {
  it('the offer screen: three shapes, each with its plan in a line at rest', async () => {
    const { log } = runTo('SCREENS2', (s) => s.screen.k === 'cards');
    const { page, errors, close } = await resume(log);
    await page.waitForSelector('.cr-screen[data-screen="cards"]');
    const m = await measure(page);
    expect(m.overflowX, 'horizontal scroll').toBeLessThanOrEqual(0);
    expect(m.small, 'targets under 44px').toEqual([]);
    const plans = page.locator('.cr-cards .cr-shape-plan');
    expect(await plans.count()).toBe(3);
    for (const plan of await plans.all()) expect(await plan.isVisible()).toBe(true);
    await shoot(page, 'offer');
    expect(errors).toEqual([]);
    await close();
  }, 120_000);

  it('the replace screen: the basic cards first and marked, and no sideways scroll', async () => {
    let rewards = 0;
    const { log, run } = runTo('SCREENS2', (s) => s.screen.k === 'replace' && ++rewards === 2);
    const { page, errors, close } = await resume(log);
    await page.waitForSelector('.cr-screen[data-screen="replace"]');
    const m = await measure(page);
    expect(m.overflowX, 'horizontal scroll').toBeLessThanOrEqual(0);
    expect(m.small, 'targets under 44px').toEqual([]);
    const marked = await page.locator('.cr-deck .cr-card--tap').evaluateAll((tiles) => tiles.map((t) => (t as HTMLElement).dataset['basic'] === 'true'));
    expect(marked).toHaveLength(run.deck.length);
    const basics = marked.filter(Boolean).length;
    expect(marked).toEqual(marked.map((_, i) => i < basics));
    await shoot(page, 'replace');
    expect(errors).toEqual([]);
    await close();
  }, 120_000);

  it("the boss screen: each talent's shape, and what each unit already has", async () => {
    const { log, run } = runTo('SCREENS2', (s) => s.screen.k === 'boost');
    if (run.screen.k !== 'boost') throw new Error('not the boss screen');
    const { page, errors, close } = await resume(log);
    await page.waitForSelector('.cr-screen[data-screen="boost"]');
    const m = await measure(page);
    expect(m.overflowX, 'horizontal scroll').toBeLessThanOrEqual(0);
    expect(m.small, 'targets under 44px').toEqual([]);
    const talents = run.screen.offers.filter((o) => o.kind === 'talent').length;
    expect(await page.locator('.cr-choice .cr-shape').count()).toBe(talents);
    expect(await page.locator('.cr-choice', { hasText: /^.*(Has: |No talent yet).*$/ }).count()).toBe(run.screen.offers.length);
    await shoot(page, 'boss');
    expect(errors).toEqual([]);
    await close();
  }, 120_000);

  it('a battle in act 2: veterans wear their badge, and a planned Concuss marks the stun', async () => {
    const { log } = runTo('SCREENS2', concussOnVeteran);
    const { page, errors, close } = await resume(log);
    // The run opens its battle over the shell at once.
    await page.waitForSelector('.cb .cb-tile', { timeout: 20_000 });
    expect(await page.locator('.cb-token-vet').count()).toBeGreaterThan(0);
    expect(await page.locator('.cb-panel--enemy .cb-vet').count()).toBeGreaterThan(0);
    await page.locator('.cb-card[data-card="concuss"]').first().click();
    const pin = page.locator('.cb-token-pin[data-planned="true"]');
    await pin.first().waitFor();
    expect(await pin.count()).toBeGreaterThan(0);
    // The held enemy is a veteran: its token carries both marks.
    expect(await page.locator('.cb-token:has(.cb-token-vet):has(.cb-token-pin[data-planned="true"])').count()).toBeGreaterThan(0);
    const m = await measure(page);
    expect(m.overflowX, 'horizontal scroll').toBeLessThanOrEqual(0);
    expect(m.small, 'targets under 44px').toEqual([]);
    await shoot(page, 'battle-veteran-stun');
    expect(errors).toEqual([]);
    await close();
  }, 120_000);

  // The run's screens in every language (`docs/spec/gymrun-patch-card-run-translations.md`):
  // German, Ukrainian and French run longest, so each language is laid out on the screens
  // with the most words, and the deck, and still fits a phone.
  for (const language of CARD_LANGUAGES.filter((l) => l !== 'en')) {
    it(`${language}: the route, the deck, the offer, the replace and the boss screens fit at 390 wide`, async () => {
      const screens: [string, (s: CardRunState) => boolean][] = [
        ['route', (s) => s.screen.k === 'route'],
        ['cards', (s) => s.screen.k === 'cards'],
        ['replace', (s) => s.screen.k === 'replace'],
        ['boost', (s) => s.screen.k === 'boost'],
      ];
      for (const [name, until] of screens) {
        const { log } = runTo('SCREENS2', until);
        const { page, errors, close } = await resume(log, language);
        await page.waitForSelector(`.cr-screen[data-screen="${name}"]`);
        expect(await page.locator('.cr').getAttribute('lang')).toBe(language);
        if (name === 'route') {
          await page.locator('.cr-deck-btn').click();
          await page.waitForSelector('.cr-overlay');
        }
        const m = await measure(page);
        expect(m.overflowX, `${name}: horizontal scroll`).toBeLessThanOrEqual(0);
        expect(m.small, `${name}: targets under 44px`).toEqual([]);
        await shoot(page, `${language}-${name}`);
        expect(errors).toEqual([]);
        await close();
      }
    }, 240_000);
  }
});
