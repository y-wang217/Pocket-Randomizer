/**
 * The tutorial on a phone. Overnight Branch 3, step 5.
 *
 * At 390x844, on a fresh store, every mark shown on the way from the starter
 * screen to the first battle has its target and its text both inside the
 * viewport without scrolling, tapping through the marks changes nothing about
 * the run (the saved log is what it was before the taps), and "Show tutorial
 * again" brings the current screen's marks back.
 *
 * The visual harness seeds every other context with the tutorial skipped, so
 * this is the one test that asks for it on.
 */
import type { Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, playUntil, visible } from '../scripts/visual/browser.mjs';
import { TUTORIAL } from '../src/data/tutorial';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

interface Shown {
  screen: string;
  mark: string;
  anchor: { top: number; bottom: number; left: number; right: number };
  panel: { top: number; bottom: number; left: number; right: number };
  scrollY: number;
}

/** Read the open mark and its target, then tap it. Returns null when nothing is open. */
async function readAndTap(page: Page): Promise<Shown | null> {
  const shown = await page.evaluate(() => {
    const coach = globalThis.document.querySelector<HTMLElement>('.coach');
    if (!coach || coach.hidden) return null;
    const target = globalThis.document.querySelector<HTMLElement>('[data-coach-target]');
    if (!target) return null;
    const box = (element: Element) => {
      const r = element.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    return {
      screen: coach.dataset['screen'] ?? '',
      mark: coach.dataset['mark'] ?? '',
      anchor: box(target),
      panel: box(coach),
      scrollY: globalThis.window.scrollY,
    };
  });
  if (!shown) return null;
  // The panel itself, not a button: the thumb lands anywhere on it.
  await page.locator('.coach__text').click();
  await page.waitForTimeout(50);
  return shown;
}

/** Tap through every open mark on the current screen, collecting what was shown. */
async function tapThrough(page: Page): Promise<Shown[]> {
  const seen: Shown[] = [];
  for (let i = 0; i < 12; i++) {
    const shown = await readAndTap(page);
    if (!shown) break;
    seen.push(shown);
  }
  return seen;
}

function savedDecisions(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = globalThis.localStorage.getItem('gymrun.lastRun');
    return raw ? (JSON.parse(raw) as { decisions: unknown[] }).decisions.length : 0;
  });
}

describe('the tutorial at 390x844', () => {
  it('shows every mark with its target and its text on screen, and decides nothing', async () => {
    const { page, context, problems } = await openApp(harness.browser, harness.url, 'SMOKE24', undefined, { tutorial: true });
    const all: Shown[] = [];

    // Starter: the marks are up before anything is tapped.
    await page.waitForSelector('.coach:not([hidden])');
    const starterBefore = await savedDecisions(page);
    const starter = await tapThrough(page);
    expect(starter.map((s) => s.mark)).toEqual(TUTORIAL.starter.map((m) => m.id));
    expect(await savedDecisions(page)).toBe(starterBefore);
    all.push(...starter);

    // Locale, then map: each screen's marks once, on first reach.
    await page.locator('.starter').first().click();
    await page.waitForSelector(visible('locale'));
    await page.waitForSelector('.coach:not([hidden])');
    const locale = await tapThrough(page);
    expect(locale.map((s) => s.mark)).toEqual(TUTORIAL.locale.map((m) => m.id));
    all.push(...locale);

    await page.locator(`${visible('locale')} .locale`).first().click();
    await page.waitForSelector(visible('map'));
    await page.waitForSelector('.coach:not([hidden])');
    const mapBefore = await savedDecisions(page);
    const map = await tapThrough(page);
    // The gate mark shows only when an event is offered on the step; the rest always.
    expect(map.map((s) => s.mark)).toEqual(TUTORIAL.map.map((m) => m.id).filter((id) => id !== 'gate' || map.some((s) => s.mark === 'gate')));
    expect(map.length).toBeGreaterThanOrEqual(TUTORIAL.map.length - 1);
    expect(await savedDecisions(page)).toBe(mapBefore);
    all.push(...map);

    // Into the first battle, the same way the visual suite walks there.
    await playUntil(page, (screen) => screen === 'battle');
    await page.waitForSelector('.coach:not([hidden])');
    const battleBefore = await savedDecisions(page);
    const battle = await tapThrough(page);
    expect(battle.length).toBeGreaterThanOrEqual(TUTORIAL.battle.length - 1);
    expect(await savedDecisions(page)).toBe(battleBefore);
    all.push(...battle);

    // The phone check: target and text both inside 390x844, without scrolling.
    for (const shown of all) {
      const label = `${shown.screen}/${shown.mark}`;
      expect(shown.panel.top, `${label} panel top`).toBeGreaterThanOrEqual(0);
      expect(shown.panel.bottom, `${label} panel bottom`).toBeLessThanOrEqual(844);
      expect(shown.panel.left, `${label} panel left`).toBeGreaterThanOrEqual(0);
      expect(shown.panel.right, `${label} panel right`).toBeLessThanOrEqual(390);
      expect(shown.anchor.bottom, `${label} target bottom`).toBeGreaterThan(0);
      expect(shown.anchor.top, `${label} target top`).toBeLessThan(844);
      // The panel never covers the top edge of the thing it points at.
      const covers =
        shown.panel.top <= shown.anchor.top && shown.panel.bottom >= shown.anchor.top && shown.panel.left < shown.anchor.right && shown.panel.right > shown.anchor.left;
      expect(covers, `${label} panel covers its target: panel ${JSON.stringify(shown.panel)} target ${JSON.stringify(shown.anchor)} scrollY ${shown.scrollY}`).toBe(false);
    }

    // A returning visit shows nothing: the battle's marks are spent.
    expect(await page.evaluate(() => (globalThis.document.querySelector('.coach') as HTMLElement).hidden)).toBe(true);

    // "Show tutorial again" brings the current screen's marks back at once.
    await page.locator('[data-tutorial-replay]').click();
    await page.waitForSelector('.coach:not([hidden])');
    const again = await readAndTap(page);
    expect(again?.screen).toBe('battle');
    expect(await savedDecisions(page)).toBe(battleBefore);

    expect(problems).toEqual([]);
    await context.close();
  }, 300_000);

  it('never shows on a returning store', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (globalThis.document.querySelector('.coach') as HTMLElement).hidden)).toBe(true);
    await context.close();
  }, 120_000);
});
