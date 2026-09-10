/**
 * V5 in a real browser: the strip's one line, and the composed stage.
 *
 * ## Why these are not jsdom tests
 *
 * The same rule `test/visual-release-c.test.ts` states. Every assertion here
 * is about layout at 390x844 — whether a row wrapped, where the fourth move
 * button ends, how tall the screen is — and jsdom has no layout engine, so a
 * `getBoundingClientRect` of zeros would make every one of them pass without
 * measuring anything. The DOM half of V5 is in `test/event-strip.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, playUntil, stepOnce, visible } from '../scripts/visual/browser.mjs';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

/**
 * Play one turn the battle survives, and stop with it on screen.
 *
 * Lifted from `visual-release-c.test.ts`, whose header explains at length why
 * the witness has to be the **log** rather than anything under test: on
 * SMOKE24 the opening fight ends in a turn, screens are hidden rather than
 * unmounted, and "reach a battle and click" otherwise reads a screen the
 * player has already left.
 */
async function playATurn(page: Awaited<ReturnType<typeof openApp>>['page']): Promise<void> {
  const entries = async (): Promise<number> => page.locator('.log-entry').count();

  for (let attempt = 0; attempt < 16; attempt++) {
    await playUntil(page, (screen) => screen === 'battle');
    const before = await entries();
    await stepOnce(page);
    await page.waitForTimeout(DEFAULT_TUNING.battleFeedbackMs / 2);

    const screen = await page.evaluate(() =>
      globalThis.document.querySelector('.screen:not([hidden])')?.getAttribute('data-screen'),
    );
    if (screen === 'battle' && (await entries()) > before) return;
  }
  throw new Error('never found a turn that resolved and left the battle on screen');
}

describe('the event strip', () => {
  it('never exceeds one line, and truncates rather than wrapping', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playATurn(page);

    const strip = await page.evaluate(() => {
      const root = globalThis.document.querySelector(`.screen[data-screen="battle"]:not([hidden]) .flags`);
      if (!root) return null;
      const style = globalThis.getComputedStyle(root);
      const event = root.querySelector('.flags__event');
      const eventStyle = event ? globalThis.getComputedStyle(event) : null;
      const box = root.getBoundingClientRect();
      const children = [...root.children].map((child) => {
        const rect = child.getBoundingClientRect();
        return { top: Math.round(rect.top - box.top), height: Math.round(rect.height) };
      });
      return {
        height: Math.round(box.height),
        band: style.minHeight,
        wrap: style.flexWrap,
        overflow: style.overflow,
        eventWhiteSpace: eventStyle?.whiteSpace ?? null,
        eventOverflow: eventStyle?.textOverflow ?? null,
        eventText: event?.textContent ?? '',
        children,
      };
    });

    expect(strip, 'the strip is on the board').not.toBeNull();
    // 24px is `--space-6`, one chip's line box, and the band Release C's strip
    // has held since it landed. One line means exactly that number.
    expect(strip?.band).toBe('24px');
    expect(strip?.height, 'the strip is one band tall').toBe(24);
    expect(strip?.wrap, 'and cannot wrap to a second').toBe('nowrap');
    expect(strip?.overflow).toBe('hidden');

    // Truncation is truthful: the sentence is clipped with an ellipsis rather
    // than being shortened before it is written, and the sheet has all of it.
    expect(strip?.eventWhiteSpace).toBe('nowrap');
    expect(strip?.eventOverflow).toBe('ellipsis');
    expect(strip?.eventText, 'and the turn said something').not.toBe('');

    // Nothing sat down on a second row: every child starts inside the band.
    for (const child of strip?.children ?? []) {
      expect(child.top).toBeGreaterThanOrEqual(0);
      expect(child.top + child.height).toBeLessThanOrEqual(24);
    }
    await context.close();
  }, 300_000);

  it('opens the history over the board, and closes again', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playATurn(page);

    const sheet = `${visible('battle')} .log-sheet`;
    expect(await page.locator(sheet).isVisible(), 'closed until asked').toBe(false);

    await page.locator(`${visible('battle')} .flags__history`).click();
    expect(await page.locator(sheet).isVisible(), 'and open on a tap').toBe(true);
    expect(await page.locator(`${sheet} .log .log-entry`).count(), 'with the history in it').toBeGreaterThan(0);

    // Dismissed by tap. Near the top of the scrim, which is the part of it a
    // player can actually see and hit: the sheet is a bottom sheet covering the
    // lower two thirds, so the scrim's own centre is behind it and a default
    // click lands on a log entry.
    await page.locator(`${sheet} .log-sheet__scrim`).click({ position: { x: 195, y: 20 } });
    expect(await page.locator(sheet).isVisible()).toBe(false);

    // And the board underneath is live: the sheet was an overlay, not a route.
    expect(await page.locator(`${visible('battle')} .moves .move:not([disabled])`).count()).toBeGreaterThan(0);
    await context.close();
  }, 300_000);

  it('leaves no persistent log on the board', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playUntil(page, (screen) => screen === 'battle');
    expect(await page.locator(`${visible('battle')} .board .log`).count()).toBe(0);
    await context.close();
  }, 300_000);
});

describe('the stage', () => {
  it('floats both panels on one scrim, with neither drawn heavier than the other', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playUntil(page, (screen) => screen === 'battle');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);

    const read = await page.evaluate((sel) => {
      const stage = globalThis.document.querySelector(`${sel} .stage`);
      const panels = [...globalThis.document.querySelectorAll(`${sel} .stage .panel`)];
      if (!stage || panels.length !== 2) return null;
      /*
       * The properties that could rank one side over the other. Position is
       * deliberately not among them: the two panels sit in opposite corners,
       * and where a thing is is not how heavy it is.
       */
      const KEYS = [
        'backgroundColor',
        'backgroundImage',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'borderTopColor',
        'borderRadius',
        'boxShadow',
        'opacity',
        'padding',
        'fontSize',
        'fontWeight',
        'backdropFilter',
        'filter',
      ];
      const style = (el: Element): string => {
        const cs = globalThis.getComputedStyle(el) as unknown as Record<string, string>;
        return KEYS.map((key) => `${key}=${cs[key]}`).join(' ');
      };
      const rect = stage.getBoundingClientRect();
      return {
        stageHeight: Math.round(rect.height),
        panels: panels.map(style),
        borderWidths: panels.map((panel) => {
          const cs = globalThis.getComputedStyle(panel);
          return [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].join(',');
        }),
        positions: panels.map((panel) => globalThis.getComputedStyle(panel).position),
        raised: panels.map((panel) => globalThis.getComputedStyle(panel).backgroundColor),
        surface: globalThis.getComputedStyle(globalThis.document.documentElement).getPropertyValue('--bg-raised').trim(),
      };
    }, visible('battle'));

    expect(read, 'the stage is on the board with both panels on it').not.toBeNull();
    // The band is the budgeted number, not whatever the content came to.
    expect(read?.stageHeight).toBe(260);
    // One style for both sides. Not "similar": the same string.
    expect(new Set(read?.panels).size, read?.panels.join('\n')).toBe(1);
    // A scrim, not a card: no outline at all, and not the raised surface every
    // other panel in the app sits on.
    for (const widths of read?.borderWidths ?? []) expect(widths).toBe('0px,0px,0px,0px');
    for (const position of read?.positions ?? []) expect(position).toBe('absolute');
    for (const background of read?.raised ?? []) expect(background).not.toBe(read?.surface);
    await context.close();
  }, 300_000);

  it('puts a sprite in each corner the panel opposite does not use', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playUntil(page, (screen) => screen === 'battle');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);

    const boxes = await page.evaluate((sel) => {
      const box = (selector: string) => {
        const el = globalThis.document.querySelector(`${sel} ${selector}`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) };
      };
      return {
        foeSprite: box('.stage__actor--foe'),
        meSprite: box('.stage__actor--me'),
        foePanel: box('.stage .panel--foe'),
        mePanel: box('.stage .panel--me'),
      };
    }, visible('battle'));

    for (const [name, value] of Object.entries(boxes)) expect(value, `${name} is on the stage`).not.toBeNull();
    const { foeSprite, meSprite, foePanel, mePanel } = boxes;
    if (!foeSprite || !meSprite || !foePanel || !mePanel) throw new Error('the stage is missing a box');

    // Opponent upper right, player lower left. Both sprites the same size,
    // which is the visual-weight rule: a bigger sprite would be a bigger
    // Pokemon and nothing on this board says that.
    const size = (b: { left: number; right: number; top: number; bottom: number }): number[] => [
      b.right - b.left,
      b.bottom - b.top,
    ];
    expect(size(foeSprite)).toEqual(size(meSprite));
    expect(size(foeSprite)).toEqual([96, 96]);
    expect(foeSprite.top).toBeLessThan(meSprite.top);
    expect(meSprite.left).toBeLessThan(foeSprite.left);

    // Neither panel overlaps the sprite opposite it. The panel stops where the
    // sprite begins, which is why it is stated as `calc(--sprite-size + gap)`
    // rather than as a percentage that could drift into it.
    expect(foePanel.right).toBeLessThanOrEqual(foeSprite.left);
    expect(mePanel.left).toBeGreaterThanOrEqual(meSprite.right);
    await context.close();
  }, 300_000);

  it('takes no room for a bench nobody has', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playUntil(page, (screen) => screen === 'battle');
    const empty = await page.evaluate((sel) => {
      const bench = globalThis.document.querySelector(`${sel} .bench`);
      return bench ? { children: bench.children.length, display: globalThis.getComputedStyle(bench).display } : null;
    }, visible('battle'));
    // An empty flex child still earns the column's gap, and on this screen that
    // is 12px of nothing. `display: none` takes the gap with it.
    if (empty && empty.children === 0) expect(empty.display).toBe('none');
    await context.close();
  }, 300_000);
});

describe('the move grid', () => {
  it('finishes above the fold with four buttons at the touch target', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playUntil(page, (screen) => screen === 'battle');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);

    const grid = await page.evaluate((sel) => {
      const buttons = [...globalThis.document.querySelectorAll(`${sel} .moves .move`)];
      const rects = buttons.map((button) => button.getBoundingClientRect());
      const screen = globalThis.document.querySelector(sel);
      const grid = globalThis.document.querySelector(`${sel} .moves`);
      if (!screen || !grid) return null;
      const meta = buttons.map((button) => {
        const row = button.querySelector('.move__meta');
        return row ? Math.round(row.getBoundingClientRect().height) : 0;
      });
      return {
        count: buttons.length,
        columns: globalThis.getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        minHeight: Math.round(Math.min(...rects.map((r) => r.height))),
        bottom: Math.round(Math.max(...rects.map((r) => r.bottom + globalThis.scrollY))),
        top: Math.round(Math.min(...rects.map((r) => r.top + globalThis.scrollY))),
        screenHeight: Math.round(screen.getBoundingClientRect().height),
        scrollHeight: globalThis.document.documentElement.scrollHeight,
        meta,
        overhang: buttons.filter((button) => {
          const badge = button.querySelector('.band');
          if (!badge) return false;
          const face = button.getBoundingClientRect();
          const chip = badge.getBoundingClientRect();
          return chip.right > face.right || chip.left < face.left;
        }).length,
      };
    }, visible('battle'));

    expect(grid, 'the grid is on the board').not.toBeNull();
    if (!grid) throw new Error('no move grid');
    expect(grid.count).toBe(4);
    expect(grid.columns, 'still 2x2, never a column of four').toBe(2);
    // Amendment A6: the grid tightened by margin and gap, so the 44px minimum
    // touch target is untouched and the two-line `.move__meta` still is two.
    expect(grid.minHeight).toBeGreaterThanOrEqual(44);
    expect(Math.max(...grid.meta), 'the meta row still wraps to two lines').toBeGreaterThan(20);
    // R12's check, restated here because A6 names it as the thing a careless
    // tighten breaks first: the band badge sits on that second line and is the
    // first thing to overhang a squeezed face.
    expect(grid.overhang).toBe(0);

    // The plan's tests 1 and 2, and amendment A3's gate.
    expect(grid.screenHeight, 'battle screen layout height').toBeLessThanOrEqual(600);
    expect(grid.bottom, 'the fourth move button ends at or above the 740 line').toBeLessThanOrEqual(740);
    expect(grid.top, 'the decision point, which is what A3 gates on').toBeLessThanOrEqual(740 - (grid.bottom - grid.top));
    // And the whole screen fits the phone without scrolling at all.
    expect(grid.scrollHeight).toBeLessThanOrEqual(844);
    await context.close();
  }, 300_000);

  it('draws every effectiveness marker at one size and weight, none brighter than neutral', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playUntil(page, (screen) => screen === 'battle');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);

    const read = await page.evaluate((sel) => {
      const parse = (text: string): number[] | null => {
        const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(text);
        if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
        const srgb = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(text);
        return srgb ? [1, 2, 3].map((i) => Math.round(Number(srgb[i]) * 255)) : null;
      };
      const luminance = (c: number[]): number => {
        const lin = (v: number): number => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * lin(c[0] ?? 0) + 0.7152 * lin(c[1] ?? 0) + 0.0722 * lin(c[2] ?? 0);
      };
      const of = (el: Element) => {
        const cs = globalThis.getComputedStyle(el);
        return {
          size: cs.fontSize,
          weight: cs.fontWeight,
          colour: parse(cs.color),
          background: parse(cs.backgroundColor),
          box: (() => {
            const r = el.getBoundingClientRect();
            return [Math.round(r.height)];
          })(),
        };
      };
      const badges = [...globalThis.document.querySelectorAll(`${sel} .moves .badge--effect`)].map(of);
      // The neutral state's own chip: the `.chip` recipe with no `--chip`
      // override, which is what an effectiveness marker is built on.
      const neutral = globalThis.document.querySelector(`${sel} .panel .chip--neutral`);
      return {
        badges: badges.map((badge) => ({ ...badge, lum: badge.colour ? luminance(badge.colour) : null })),
        neutral: neutral
          ? { ...of(neutral), lum: of(neutral).colour ? luminance(of(neutral).colour as number[]) : null }
          : null,
      };
    }, visible('battle'));

    expect(read.badges.length, 'this board renders at least one marker').toBeGreaterThan(0);
    // A4: same size and weight, whatever the reading. A super effective marker
    // larger or heavier than a 0x would turn a reading into a recommendation.
    expect(new Set(read.badges.map((b) => b.size)).size).toBe(1);
    expect(new Set(read.badges.map((b) => b.weight)).size).toBe(1);
    expect(new Set(read.badges.map((b) => b.box[0])).size).toBe(1);
    expect(new Set(read.badges.map((b) => JSON.stringify(b.colour))).size, 'one colour for every band').toBe(1);

    // A4's second half, measured rather than argued: no marker's ink is
    // brighter than the neutral chip's.
    expect(read.neutral, 'a neutral chip to compare against').not.toBeNull();
    for (const badge of read.badges) {
      expect(badge.lum ?? 0).toBeLessThanOrEqual((read.neutral?.lum ?? 0) + 1e-6);
    }
    await context.close();
  }, 300_000);
});
