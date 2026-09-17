/**
 * Stage V3's browser assertions: the world mounts once and stays, nothing
 * over it is harder to tap, the layers move at their ratios, reduced motion
 * leaves the drift unmounted, contrast holds per the V1 rule over every
 * locale's scene, the vertical budget holds, and the throttled trace stays
 * under the gate.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { measureGuardedScreens, openApp, openScreen, playUntil, stepOnce, visible, skipTutorialIn } from '../scripts/visual/browser.mjs';
import { measureContrast, type ContrastReading } from '../scripts/visual/contrast.mjs';
import { traceMapScroll } from '../scripts/visual/perf.mjs';
import { LOCALE_IDS } from '../src/data/locales';
import { SCENES, TRAVELLING_KINDS } from '../src/ui/theme/scenes';
import { skipWhereRecordingDoesNotApply, skipOn, expectBaselineHeights, openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

describe('the vertical budget', () => {
  const recorded = skipWhereRecordingDoesNotApply();
  it.skipIf(recorded.skip)(`leaves both guarded screens at the baseline height, to the pixel ${recorded.why}`, async () => {
    const expected = JSON.parse(readFileSync(join(process.cwd(), 'docs/visual/baseline/heights.json'), 'utf8'));
    const measured = await measureGuardedScreens(harness.url, harness.browser);
    expect(measured.problems ?? []).toEqual([]);
    expectBaselineHeights(measured.map, expected.map, expect);
    expectBaselineHeights(measured.battle, expected.battle, expect);
  }, 180_000);
});

describe('the world', () => {
  it('mounts once, survives every screen, and never takes a tap', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    const first = await page.evaluateHandle(() => globalThis.document.querySelector('.world'));
    expect(await page.evaluate(() => globalThis.document.querySelectorAll('.world').length)).toBe(1);
    expect(await page.evaluate(() => globalThis.getComputedStyle(globalThis.document.querySelector('.world')!).pointerEvents)).toBe('none');

    const seen = new Set<string>();
    const blocked: string[] = [];
    let opened = false;
    for (let step = 0; step < 600; step++) {
      const screen = await openScreen(page);
      if (!screen) {
        await page.waitForTimeout(40);
        continue;
      }
      if (screen === 'map' && !opened) {
        await page.locator(`${visible('map')} .party__header .button`).click();
        await page.waitForTimeout(50);
        opened = true;
        continue;
      }
      if (!seen.has(screen)) {
        seen.add(screen);
        // Same node, every screen.
        const same = await page.evaluate((el) => el === globalThis.document.querySelector('.world'), first);
        expect(same, `${screen}: the world is the node mounted at start`).toBe(true);
        // Every visible control is what a tap at its centre lands on.
        const misses = await page.evaluate((sel) => {
          const out: string[] = [];
          for (const control of globalThis.document.querySelectorAll<HTMLElement>(`${sel} button, ${sel} [role=button], ${sel} input`)) {
            if (control.offsetParent === null) continue;
            const box = control.getBoundingClientRect();
            if (box.width === 0 || box.bottom < 0 || box.top > globalThis.innerHeight) continue;
            // A point inside the visible part of the box: a tall control's
            // centre can sit below the fold, where nothing is hit-testable.
            const top = Math.max(box.top, 0);
            const bottom = Math.min(box.bottom, globalThis.innerHeight);
            const hit = globalThis.document.elementFromPoint(box.left + box.width / 2, (top + bottom) / 2);
            if (!hit || !control.contains(hit)) out.push(`${control.tagName}.${control.className.split(' ')[0]} "${control.textContent?.trim().slice(0, 20)}" hit ${hit?.className}`);
          }
          return out;
        }, visible(screen));
        for (const miss of misses) blocked.push(`${screen}: ${miss}`);
      }
      if (screen === 'summary') break;
      await stepOnce(page);
      await page.waitForTimeout(25);
    }
    await context.close();
    expect(blocked).toEqual([]);
    expect([...seen]).toEqual(expect.arrayContaining(['starter', 'locale', 'map', 'party', 'battle', 'result', 'summary']));
    expect(seen.has('summary')).toBe(true);
  }, 600_000);

  it('is absent on the summary and present in a region', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playUntil(page, (screen) => screen === 'map');
    expect(await page.evaluate(() => globalThis.document.querySelector('.world')?.querySelectorAll('svg').length)).toBeGreaterThanOrEqual(4);
    await context.close();
    const run = await openApp(harness.browser, harness.url, 'SEED-B');
    await playUntil(run.page, (screen) => screen === 'summary', 900);
    expect(await run.page.evaluate(() => (globalThis.document.querySelector('.world') as HTMLElement).hidden)).toBe(true);
    await run.context.close();
  }, 300_000);

  it('moves its layers at 0.2, 0.5 and 1 of scroll, and holds still under reduced motion with no drift', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playUntil(page, (screen) => screen === 'map');
    await page.evaluate(() => globalThis.scrollTo(0, 200));
    /*
     * **Wait for the layers to have moved, not for 150ms. The iOS animations
     * patch.** The parallax is applied on a `requestAnimationFrame` throttle,
     * so the fixed wait this replaces was betting that a frame would be
     * scheduled and served inside it. Under the full browser suite — 26 files,
     * two engines' worth of builds, the contention section 26 records — that
     * bet loses: this asserted `-40` against a layer still reading `0` on the
     * WebKit leg, and passed on the same commit when run on its own.
     *
     * Same rule the patch's own motion helper had to learn three times over:
     * a test that waits a fixed fraction of a motion budget and then reads the
     * screen is making an assumption about what the budget is for. Waiting for
     * the condition costs nothing when the frame is prompt and does not lie
     * when it is late.
     */
    await page.waitForFunction(
      () => {
        const far = globalThis.document.querySelector('.world__layer--far');
        if (!far) return false;
        const matrix = globalThis.getComputedStyle(far).transform;
        return matrix !== 'none' && !/^matrix\(1, 0, 0, 1, 0, -?0\)$/.test(matrix);
      },
      { timeout: 10_000 },
    );
    const { y, transforms } = await page.evaluate(() => ({
      y: globalThis.scrollY,
      transforms: ['far', 'mid', 'near'].map((layer) => globalThis.getComputedStyle(globalThis.document.querySelector(`.world__layer--${layer}`)!).transform),
    }));
    expect(y).toBeGreaterThan(100);
    // Compared as numbers, not as strings (4.8.0.2): the map's scroll height
    // moved with the face, and 0.2 of the new height is `37.800000000000004`
    // in JS while the browser serialises the same matrix as `-37.8`.
    const translateY = (matrix: string): number => Number(matrix.replace(/^matrix\((.*)\)$/, '$1').split(',')[5]);
    expect(transforms.every((matrix) => /^matrix\(1, 0, 0, 1, 0, -?[\d.]+\)$/.test(matrix))).toBe(true);
    expect(transforms.map(translateY)[0]).toBeCloseTo(-y * 0.2, 6);
    expect(transforms.map(translateY)[1]).toBeCloseTo(-y * 0.5, 6);
    expect(transforms.map(translateY)[2]).toBeCloseTo(-y, 6);
    expect(await page.locator('.world__drift').count()).toBe(1);
    /*
     * The loop floors, by kind, over all eight places. **Idle-sprites patch.**
     *
     * V3's rule was one number: twenty seconds or longer, because the one
     * motion was a crossing and a faster crossing is what draws the eye. The
     * patch keeps that floor for the kinds that travel and restates it for
     * the kinds that stay put, where nothing crosses the frame: the element's
     * own loop, when it has one, four seconds or longer, and every mote's
     * loop two seconds or longer. `docs/generation.md` section 20 records the
     * restatement. Re-tagged through `html[data-locale]`, the one writer the
     * world follows, the way `scripts/visual/perf.mjs` walks the locales.
     */
    for (const locale of LOCALE_IDS) {
      await page.evaluate((id) => globalThis.document.documentElement.setAttribute('data-locale', id), locale);
      await page.waitForTimeout(50);
      const motion = await page.evaluate(() => {
        const drift = globalThis.document.querySelector<HTMLElement>('.world__drift')!;
        const seconds = (element: Element): number[] =>
          globalThis
            .getComputedStyle(element)
            .animationDuration.split(',')
            .map((value) => parseFloat(value));
        const names = (element: Element): string[] => globalThis.getComputedStyle(element).animationName.split(',').map((name) => name.trim());
        return {
          kind: drift.dataset['motion'],
          element: names(drift)[0] === 'none' ? null : Math.min(...seconds(drift)),
          motes: [...drift.querySelectorAll(':scope > svg')].map((mote) => (names(mote)[0] === 'none' ? null : Math.min(...seconds(mote)))),
        };
      });
      expect(motion.kind, locale).toBe(SCENES[locale].motion.kind);
      if (TRAVELLING_KINDS.has(SCENES[locale].motion.kind)) {
        expect(motion.element, `${locale} travels`).not.toBeNull();
        expect(motion.element, `${locale} crossing`).toBeGreaterThanOrEqual(20);
      } else if (motion.element !== null) {
        expect(motion.element, `${locale} in place`).toBeGreaterThanOrEqual(4);
      }
      for (const [i, mote] of motion.motes.entries()) {
        if (mote !== null) expect(mote, `${locale} mote ${i}`).toBeGreaterThanOrEqual(2);
      }
      // Something moves in every place: the element, or at least one mote.
      expect(motion.element !== null || motion.motes.some((mote) => mote !== null), `${locale} moves`).toBe(true);
    }
    await context.close();

    const reduced = await harness.browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

    await skipTutorialIn(reduced);
    const quiet = await reduced.newPage();
    await quiet.goto(`${harness.url}/#seed=SMOKE24`, { waitUntil: 'load' });
    await quiet.waitForSelector(`${visible('starter')} .starter`);
    await playUntil(quiet, (screen) => screen === 'map');
    expect(await quiet.locator('.world__drift').count()).toBe(0);
    await quiet.evaluate(() => globalThis.scrollTo(0, 300));
    await quiet.waitForTimeout(150);
    const still = await quiet.evaluate(() =>
      ['far', 'mid', 'near'].map((layer) => globalThis.getComputedStyle(globalThis.document.querySelector(`.world__layer--${layer}`)!).transform),
    );
    expect(still).toEqual(['none', 'none', 'none']);
    await reduced.close();
  }, 300_000);
});

describe('contrast over the scene', () => {
  it('holds on every locale, per the V1 rule', async () => {
    const baseline = JSON.parse(readFileSync(join(process.cwd(), 'docs/visual/reports/v0-contrast.json'), 'utf8'));
    const perLocale: Record<string, Awaited<ReturnType<typeof measureContrast>>> = {};
    for (const locale of LOCALE_IDS) perLocale[locale] = await measureContrast(harness.url, harness.browser, { locale });

    const failures: string[] = [];
    for (const screen of Object.keys(baseline)) {
      for (const [label, base] of Object.entries<{ ratio: number; background: number[] }>(baseline[screen])) {
        const readings = LOCALE_IDS.map((locale) => perLocale[locale]?.[screen]?.[label]).filter((r): r is ContrastReading => Boolean(r));
        const first = readings[0];
        if (!first) continue;
        const onSurface = new Set(readings.map((r) => r.background.join(','))).size === 1 && first.background.join(',') === base.background.join(',');
        for (const [i, reading] of readings.entries()) {
          const locale = LOCALE_IDS[i];
          if (onSurface) {
            if (Math.abs(reading.ratio - base.ratio) > 0.05) failures.push(`${locale} ${screen} ${label}: ${reading.ratio} vs baseline ${base.ratio} on an unchanged surface`);
          } else {
            const floor = base.ratio >= 4.5 ? 4.5 : base.ratio - 0.1;
            if (reading.ratio < floor) failures.push(`${locale} ${screen} ${label}: ${reading.ratio} under the floor ${floor} (baseline ${base.ratio})`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  }, 600_000);
});

describe('performance', () => {
  /*
   * **Chromium only, and it is the instrument rather than the subject.** The
   * iOS animations patch.
   *
   * `scripts/visual/perf.mjs` measures frame work through
   * `context.newCDPSession`, and the Chrome DevTools Protocol is Chromium's.
   * Playwright offers no WebKit equivalent — not a slower one, none — so there
   * is no version of this measurement to take on the other engine, and a
   * `frameWorkMs.p95` recorded from a different tracer would not be comparable
   * to the number in `v3-perf.json` even if one existed.
   *
   * This is the only case in the suite that is declined outright rather than
   * narrowed. The rule the patch added is that a test which cannot run on both
   * says which engine and why, in the title, so a skipped case carries its own
   * reason into the runner output instead of needing this comment open beside
   * it.
   */
  const cdp = skipOn('webkit', 'frame timing comes from the Chrome DevTools Protocol, which WebKit has no equivalent of');
  it.skipIf(cdp.skip)(`keeps the throttled map scroll under 16ms of work a frame and 4ms of paint, on the busiest locale ${cdp.why}`, async () => {
    const busiest = JSON.parse(readFileSync(join(process.cwd(), 'docs/visual/reports/v3-perf.json'), 'utf8')).busiest as string;
    const result = await traceMapScroll(harness.url, harness.browser, { locale: busiest });
    expect(result.frames).toBeGreaterThan(20);
    expect(result.frameWorkMs.p95).toBeLessThan(16);
    expect(result.paintMs.mean).toBeLessThan(4);
  }, 300_000);
});
