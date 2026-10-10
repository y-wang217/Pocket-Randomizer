/**
 * The card battle sandbox in a real browser. **Card battle engine,
 * checkpoint 5.** Both hidden entries against the built app, the phone fit
 * at 390x844, and the 44px touch floor.
 */
import { mkdirSync } from 'node:fs';

import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CARD_LANGUAGES, CARD_COPY_BY_LANGUAGE, LANGUAGE_NAMES } from '../src/cardData/copy';

import { openApp, skipTutorialIn } from '../scripts/visual/browser.mjs';
import { openHarness, type Harness } from './visual/harness';

const SEED = 'GYMRUN-715122-DNCFGVFU';
const PHONE = { width: 390, height: 844 };
const SEQUENCE = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];

let harness: Harness;

/** A phone context past every first open, the card battle tutorial's included: the tutorial has its own test below. */
async function phone(viewport: { width: number; height: number } = PHONE) {
  const context = await harness.browser.newContext({ viewport, hasTouch: true });
  await skipTutorialIn(context);
  return context;
}

beforeAll(async () => {
  harness = await openHarness();
}, 180_000);

afterAll(async () => {
  await harness?.close();
});

async function measure(page: Page) {
  return page.evaluate(() => {
    const d = globalThis.document.documentElement;
    const targets = [...globalThis.document.querySelectorAll<HTMLElement>('.cb button, .cb .cb-panel, .cb .cb-tile, .cb .cb-card')]
      .filter((node) => node.offsetParent !== null && !(node as HTMLButtonElement).disabled)
      .map((node) => {
        const r = node.getBoundingClientRect();
        return { what: `${node.className} ${node.textContent?.slice(0, 16) ?? ''}`, width: r.width, height: r.height };
      });
    return {
      overflowY: d.scrollHeight - globalThis.innerHeight,
      overflowX: d.scrollWidth - globalThis.innerWidth,
      frameBottom: globalThis.document.querySelector('.cb-frame')!.getBoundingClientRect().bottom,
      small: targets.filter((t) => t.width < 44 || t.height < 44),
      count: targets.length,
    };
  });
}

const screen = (page: Page) => page.evaluate(() => globalThis.document.querySelector<HTMLElement>('main.shell')?.dataset['screen']);

describe('the card battle sandbox at 390x844', () => {
  it('opens on #test, fits with no scroll, and every touch target is at least 44px, through a few rounds', async () => {
    const context = await phone();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${harness.url}/#test`, { waitUntil: 'load' });
    await page.waitForSelector('.cb .cb-tile', { timeout: 20_000 });

    for (let round = 0; round < 3; round++) {
      const m = await measure(page);
      expect(m.overflowY, `round ${round + 1}: vertical scroll`).toBeLessThanOrEqual(0);
      expect(m.overflowX, `round ${round + 1}: horizontal scroll`).toBeLessThanOrEqual(0);
      expect(m.frameBottom).toBeLessThanOrEqual(PHONE.height);
      expect(m.small, `round ${round + 1}: targets under 44px`).toEqual([]);
      expect(m.count).toBeGreaterThan(30);
      // Plan what can be planned, then end the turn.
      const card = page.locator('.cb-card:not([data-unavailable]):not([data-selected])').first();
      if (await card.count()) {
        await card.click();
        const lit = page.locator('.cb-panel[data-target="true"], .cb-tile:has(.cb-ov--selectable)').first();
        if (await lit.count()) await lit.click();
        const tile = page.locator('.cb-tile:has(.cb-ov--selectable)').first();
        if (await tile.count()) await tile.click();
      }
      await page.locator('.cb-btn--primary').click();
      if (await page.locator('.cb-sheet:not([hidden])').count()) break;
    }
    expect(errors).toEqual([]);
    await context.close();
  }, 120_000);
});

/*
 * The tutorial on a first open, at the phone frame
 * (`docs/spec/gymrun-patch-card-battle-hearts-and-tutorial.md`): each step's
 * panel and anchor on screen, its buttons 44px, and a step that waits for a
 * tap on the board, the units, the hand or the actions never covering them.
 */
describe('the card battle tutorial at 390x844', () => {
  it('opens on a first visit and walks to the dummy with every step on screen', async () => {
    const context = await harness.browser.newContext({ viewport: PHONE, hasTouch: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${harness.url}/#test`, { waitUntil: 'load' });
    await page.waitForSelector('.cb .cb-coach:not([hidden])', { timeout: 20_000 });

    const look = () =>
      page.evaluate(() => {
        const d = globalThis.document;
        const box = (selector: string) => d.querySelector(selector)?.getBoundingClientRect() ?? null;
        const coach = d.querySelector<HTMLElement>('.cb-coach')!;
        const c = coach.getBoundingClientRect();
        const overlaps = (selector: string) => {
          const r = box(selector);
          return !!r && r.top < c.bottom && r.bottom > c.top && r.left < c.right && r.right > c.left;
        };
        const anchor = d.querySelector('[data-coach-target="true"]')?.getBoundingClientRect() ?? null;
        const buttons = [...coach.querySelectorAll<HTMLElement>('button')].filter((b) => !b.hidden).map((b) => b.getBoundingClientRect());
        return {
          step: coach.dataset['step'],
          wait: coach.dataset['wait'] === 'true',
          coach: { top: c.top, bottom: c.bottom, left: c.left, right: c.right },
          anchor: anchor && { top: anchor.top, bottom: anchor.bottom },
          covers: ['.cb-board', '.cb-units', '.cb-hand', '.cb-actions'].filter(overlaps),
          small: buttons.filter((b) => b.width < 44 || b.height < 44).length,
          scroll: d.documentElement.scrollHeight - globalThis.innerHeight,
        };
      });
    const check = async (step: string) => {
      const l = await look();
      expect(l.step).toBe(step);
      expect(l.coach.top, step).toBeGreaterThanOrEqual(0);
      expect(l.coach.bottom, step).toBeLessThanOrEqual(PHONE.height);
      expect(l.coach.left, step).toBeGreaterThanOrEqual(0);
      expect(l.coach.right, step).toBeLessThanOrEqual(PHONE.width);
      expect(l.anchor, `${step}: an anchor`).not.toBeNull();
      expect(l.anchor!.top, step).toBeGreaterThanOrEqual(0);
      expect(l.anchor!.bottom, step).toBeLessThanOrEqual(PHONE.height);
      expect(l.small, `${step}: buttons under 44px`).toBe(0);
      expect(l.scroll, step).toBeLessThanOrEqual(0);
      // A waiting step leaves the pieces it waits on uncovered, bar the board's farthest row.
      if (l.wait) expect(l.covers.filter((c) => c !== '.cb-board'), step).toEqual([]);
    };

    await check('place');
    await page.locator('.cb-tile[data-lane="1"][data-col="2"]').click();
    await page.locator('.cb-tile[data-lane="1"][data-col="1"]').click();
    await check('start');
    await page.locator('[data-coach="end"]').click();
    for (const step of ['hand', 'vitals', 'mana']) {
      await check(step);
      await page.locator('.cb-coach-next').click();
    }
    await check('move');
    await page.locator('.cb-card[data-card="move"]').click();
    await page.locator('.cb-panel[data-id="C"]').click();
    await page.locator('.cb-tile:has(.cb-ov--selectable)').first().click();
    await check('slots');
    await page.locator('.cb-coach-next').click();
    await check('attack');
    await page.locator('.cb-card[data-card="shoot"]').click();
    await check('end');
    await page.locator('[data-coach="end"]').click();
    await page.locator('.cb-coach[data-step="finish"]:not([hidden])').waitFor({ timeout: 20_000 });
    await check('finish');
    expect(errors).toEqual([]);
    await context.close();
  }, 120_000);
});

/*
 * 390x844 is an iPhone's whole screen; Safari shows less of it between its
 * bars, and the frame was cut off top and bottom there
 * (`docs/spec/gymrun-patch-iphone-viewport-fit.md`). 790 is a short gap the
 * board's rows absorb alone, 713 the screenshot's, 664 Safari with both bars
 * out.
 */
describe('the card battle sandbox inside Safari on an iPhone', () => {
  for (const height of [790, 713, 664]) {
    it(`at 390x${height} the whole frame is on screen`, async () => {
      const context = await phone({ width: 390, height });
      const page = await context.newPage();
      await page.goto(`${harness.url}/#test`, { waitUntil: 'load' });
      await page.waitForSelector('.cb .cb-tile', { timeout: 20_000 });
      const fit = await page.evaluate(() => {
        const frame = globalThis.document.querySelector<HTMLElement>('.cb-frame')!;
        const r = frame.getBoundingClientRect();
        const tile = globalThis.document.querySelector('.cb-tile')!.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, scaled: frame.style.transform !== '', tile: tile.height };
      });
      expect(fit.top).toBeGreaterThanOrEqual(0);
      expect(fit.bottom).toBeLessThanOrEqual(height);
      // A gap the rows can absorb costs no scale, and the tiles stay targets.
      if (height === 790) expect([fit.scaled, fit.tile >= 44]).toEqual([false, true]);
      await context.close();
    }, 120_000);
  }
});

describe('the hidden key sequence on starter select', () => {
  it('opens the sandbox, and the completing Enter does not pick the focused starter', async () => {
    const { page, context, problems } = await openApp(harness.browser, harness.url, SEED, PHONE);
    // Select a starter so its Choose button shows, and focus it: Enter would press it.
    await page.locator('.starter').first().locator('.starter__name').click();
    await page.locator('.starter-select__choose').focus();
    for (const key of SEQUENCE) await page.keyboard.press(key);
    await page.waitForSelector('.cb .cb-tile', { timeout: 20_000 });
    expect(await screen(page)).toBe('starter');
    await page.locator('.cb-exit').click();
    expect(await page.locator('.cb').count()).toBe(0);
    expect(await screen(page)).toBe('starter');
    expect(problems).toEqual([]);
    await context.close();
  }, 120_000);

  it('a wrong key resets the sequence', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, SEED, PHONE);
    for (const key of ['ArrowUp', 'ArrowDown', 'x', 'ArrowLeft', 'ArrowRight', 'Enter']) await page.keyboard.press(key);
    await page.waitForTimeout(300);
    expect(await page.locator('.cb').count()).toBe(0);
    await context.close();
  }, 120_000);

  it('does nothing once starter select is gone', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, SEED, PHONE);
    await page.locator('.starter').first().locator('.starter__name').click();
    await page.locator('.starter-select__choose').click();
    await page.waitForFunction(() => globalThis.document.querySelector<HTMLElement>('main.shell')?.dataset['screen'] !== 'starter');
    for (const key of SEQUENCE) await page.keyboard.press(key);
    await page.waitForTimeout(300);
    expect(await page.locator('.cb').count()).toBe(0);
    await context.close();
  }, 120_000);
});

/**
 * Every language on both palettes, at the phone frame: no scroll, no word
 * running out of the button, card or panel it sits in, on the board and in the
 * open menu. `GYMRUN_CB_SHOTS=<dir>` also saves each screen, for a look by eye
 * (`docs/spec/gymrun-patch-card-battle-accessibility.md`).
 */
describe('the card battle sandbox in every language', () => {
  const shots = process.env['GYMRUN_CB_SHOTS'];
  if (shots) mkdirSync(shots, { recursive: true });

  /** Text boxes wider or taller than the box they are drawn in. */
  async function spills(page: Page) {
    return page.evaluate(() => {
      const out: string[] = [];
      const words = globalThis.document.querySelectorAll<HTMLElement>(
        '.cb .cb-btn-label, .cb .cb-card-name, .cb .cb-panel-name, .cb .cb-slot-name, .cb .cb-pill-text, .cb .cb-stat, .cb .cb-mp-text, .cb .cb-note, .cb .cb-piles, .cb .cb-round',
      );
      for (const word of words) {
        if (word.offsetParent === null) continue;
        const box = word.closest<HTMLElement>('.cb-btn, .cb-card, .cb-panel, .cb-slot, .cb-pill, .cb-top')!;
        const a = word.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        // Cut short or running over, to the sub-pixel: an ellipsis shows at less than a pixel.
        const range = globalThis.document.createRange();
        range.selectNodeContents(word);
        const style = getComputedStyle(word);
        const inner = a.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const clipped = range.getBoundingClientRect().width > inner + 0.01;
        if (a.left < b.left - 1 || a.right > b.right + 1 || a.top < b.top - 1 || a.bottom > b.bottom + 1 || clipped) {
          out.push(`${word.className}: ${word.textContent}`);
        }
      }
      return out;
    });
  }

  for (const language of CARD_LANGUAGES) {
    it(`${LANGUAGE_NAMES[language]} fits the phone frame, on the board and in the menu, on both palettes`, async () => {
      for (const palette of ['standard', 'tritan']) {
        const context = await phone();
        await context.addInitScript(
          (prefs) => globalThis.localStorage.setItem('gymrun.cardbattle.prefs', prefs),
          JSON.stringify({ language, palette }),
        );
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${harness.url}/#test`, { waitUntil: 'load' });
        await page.waitForSelector('.cb .cb-tile', { timeout: 20_000 });
        expect(await page.locator('.cb').getAttribute('lang')).toBe(language);
        expect(await page.locator('.cb').getAttribute('data-palette')).toBe(palette);
        expect(await page.locator('.cb-btn--primary').textContent()).toBe(CARD_COPY_BY_LANGUAGE[language].start);

        // Into round 1 with a card picked, so the slots, the hint and the telegraphs are all drawn.
        await page.locator('.cb-btn--primary').click();
        // A seed can deal a round 1 with nothing playable; the board is checked all the same.
        const card = page.locator('.cb-card:not([data-unavailable])').first();
        if (await card.count()) await card.click();
        const unit = page.locator('.cb-panel--unit[data-target="true"]').first();
        if (await unit.count()) await unit.click();
        const m = await measure(page);
        expect(m.overflowY, 'vertical scroll').toBeLessThanOrEqual(0);
        expect(m.overflowX, 'horizontal scroll').toBeLessThanOrEqual(0);
        expect(m.small, 'targets under 44px').toEqual([]);
        expect(await spills(page), 'words out of their box, board').toEqual([]);
        if (shots) await page.screenshot({ path: `${shots}/${language}-${palette}-board.png` });

        await page.locator('.cb-actions .cb-btn').last().click();
        await page.waitForSelector('.cb-sheet:not([hidden])');
        expect(await spills(page), 'words out of their box, menu').toEqual([]);
        if (shots && palette === 'standard') await page.screenshot({ path: `${shots}/${language}-menu.png` });
        if (palette === 'standard') {
          // More hands and more enemy intents: a seed deals only some of the cards.
          const names = new Set<string>();
          for (let deal = 0; deal < 8; deal++) {
            await page.locator('.cb-sheet .cb-btn', { hasText: CARD_COPY_BY_LANGUAGE[language].newSeed }).click();
            await page.locator('.cb-btn--primary').click();
            for (const name of await page.locator('.cb-card-name').allTextContents()) names.add(name);
            expect(await spills(page), `words out of their box, deal ${deal + 1}`).toEqual([]);
            await page.locator('.cb-actions .cb-btn').last().click();
          }
          expect(names.size).toBeGreaterThan(5);
        }
        expect(errors).toEqual([]);
        await context.close();
      }
    }, 120_000);
  }

  it('switches language and palette from the menu, and remembers them', async () => {
    const context = await phone();
    const page = await context.newPage();
    await page.goto(`${harness.url}/#test`, { waitUntil: 'load' });
    await page.waitForSelector('.cb .cb-tile');
    await page.evaluate(() => globalThis.localStorage.removeItem('gymrun.cardbattle.prefs'));
    await page.locator('.cb-actions .cb-btn').last().click();
    await page.locator('.cb-settings .cb-btn', { hasText: '日本語' }).click();
    expect(await page.locator('.cb-btn--primary').textContent()).toBe(CARD_COPY_BY_LANGUAGE.ja.start);
    expect(await page.locator('.cb-sheet-title').textContent()).toBe(CARD_COPY_BY_LANGUAGE.ja.title);
    await page.locator('.cb-settings .cb-btn', { hasText: CARD_COPY_BY_LANGUAGE.ja.settings.paletteTritan }).click();
    expect(await page.locator('.cb').getAttribute('data-palette')).toBe('tritan');
    // B's owner colour leaves blue, the one a blue-green viewer cannot tell from A's teal.
    const blue = await page.evaluate(() => getComputedStyle(globalThis.document.querySelector('.cb')!).getPropertyValue('--cb-blue').trim());
    expect(blue).toBe('#8c6d1f');
    expect(await page.evaluate(() => globalThis.localStorage.getItem('gymrun.cardbattle.prefs'))).toBe(
      JSON.stringify({ language: 'ja', palette: 'tritan' }),
    );
    // `#test` is rewritten to the run's seed once read, so open it again rather than reload.
    await page.goto(`${harness.url}/#test`, { waitUntil: 'load' });
    await page.waitForSelector('.cb .cb-tile');
    expect(await page.locator('.cb').getAttribute('lang')).toBe('ja');
    await page.evaluate(() => globalThis.localStorage.removeItem('gymrun.cardbattle.prefs'));
    await context.close();
  }, 120_000);
});
