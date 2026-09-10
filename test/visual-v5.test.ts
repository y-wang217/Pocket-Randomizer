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

describe('the species swap', () => {
  it('reads its length off the one tuning number, and nothing of its own', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playUntil(page, (screen) => screen === 'battle');

    const resolved = await page.evaluate(() =>
      globalThis.getComputedStyle(globalThis.document.documentElement).getPropertyValue('--motion-swap').trim(),
    );
    // `ui/theme/motion.ts` writes `data/tuning.ts`'s number onto the root at
    // startup and `--motion-swap` is `var(--motion-duration)`. One number, and
    // this is it arriving at V5's own beat.
    expect(resolved).toBe(`${DEFAULT_TUNING.battleFeedbackMs}ms`);
    await context.close();
  }, 300_000);

  it('runs no animation at all on a turn where nobody switched', async () => {
    const { page, context } = await openApp(harness.browser, harness.url, 'SMOKE24');
    await playATurn(page);

    const state = await page.evaluate((sel) => {
      const actors = [...globalThis.document.querySelectorAll(`${sel} .stage__actor`)];
      return actors.flatMap((actor) => [
        ...[...actor.querySelectorAll('.sprite')].map((sprite) => globalThis.getComputedStyle(sprite).animationName),
        (actor as HTMLElement).dataset['swapped'] ?? 'none',
      ]);
    }, visible('battle'));

    expect(state.length, 'both actors are on the stage').toBeGreaterThan(0);
    /*
     * The plan's "adds zero time to a turn with no switch", measured as the
     * strongest thing it can be: not a small duration but no animation. The
     * marker is never set on a turn without a switch, so there is nothing for
     * the rule to attach to.
     */
    for (const value of state) expect(value).toBe('none');
    await context.close();
  }, 300_000);
});

/**
 * V5.6: the closing measurement, on the board's **worst case**.
 *
 * The plan's test 1 is a layout height "with a full status and stage chip row
 * on both sides", and the smoke bot cannot ask for that — it plays a seed, and
 * whether both Pokemon happen to be statused and boosted on the turn it stops
 * is the seed's business. So this uses the gallery, which exists for exactly
 * this ("a state the smoke bot cannot reach on demand"): `#screen=battle`
 * drives a battle with Swords Dance and Toxic against Rock Polish and Thunder
 * Wave until both sides carry a status and a stage, and *then* it is measured.
 *
 * **Played, not fabricated.** Every number below is a real projection of a real
 * `@pkmn/sim` battle; nothing constructs a `BattleUiView` by hand.
 *
 * Its own harness, because a gallery build is a different build.
 */
describe('the loaded board', () => {
  let gallery: Harness;

  beforeAll(async () => {
    gallery = await openHarness({ gallery: true });
  }, 180_000);

  afterAll(async () => {
    await gallery?.close();
  });

  async function loaded(): Promise<{ page: Awaited<ReturnType<typeof openApp>>['page']; context: Awaited<ReturnType<typeof openApp>>['context'] }> {
    const context = await gallery.browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${gallery.url}/gallery.html#seed=V5-LOADED&screen=battle`, { waitUntil: 'load' });
    await page.waitForFunction(() => globalThis.document.documentElement.dataset['galleryReady'] === 'true', undefined, {
      timeout: 60_000,
    });
    await page.evaluate(() => globalThis.document.fonts.ready);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);
    return { page, context };
  }

  it('is at or under 600 with a status and a stage chip on both sides', async () => {
    const { page, context } = await loaded();

    const read = await page.evaluate(() => {
      const r = (n: number): number => Math.round(n * 100) / 100;
      const screen = globalThis.document.querySelector('.screen--battle');
      const panels = [...globalThis.document.querySelectorAll('.stage .panel')];
      const moves = [...globalThis.document.querySelectorAll('.moves .move')].map((m) => m.getBoundingClientRect());
      const strip = globalThis.document.querySelector('.flags');
      if (!screen || !strip || panels.length !== 2 || moves.length !== 4) return null;
      return {
        screenHeight: r(screen.getBoundingClientRect().height),
        scrollHeight: globalThis.document.documentElement.scrollHeight,
        stripHeight: r(strip.getBoundingClientRect().height),
        stripBottom: r(strip.getBoundingClientRect().bottom + globalThis.scrollY),
        decisionBottom: r(Math.max(...moves.map((m) => m.bottom + globalThis.scrollY))),
        panels: panels.map((panel) => ({
          height: r(panel.getBoundingClientRect().height),
          status: panel.querySelectorAll('.badge--status:not([hidden])').length,
          stages: panel.querySelectorAll('.panel__stages .chip--stage').length,
        })),
      };
    });

    expect(read, 'the loaded battle rendered').not.toBeNull();
    if (!read) throw new Error('no loaded battle');

    // The premise, asserted before the thing it is the premise for: this really
    // is the loaded board, on both sides.
    for (const panel of read.panels) {
      expect(panel.status, 'a status chip on this side').toBeGreaterThan(0);
      expect(panel.stages, 'and a stage chip').toBeGreaterThan(0);
    }
    // The plan's test 1.
    expect(read.screenHeight, 'battle screen layout height, loaded').toBeLessThanOrEqual(600);
    // The plan's test 2: four move buttons *plus the strip* above the fold.
    expect(read.decisionBottom).toBeLessThanOrEqual(844);
    expect(read.stripBottom, 'the strip is on screen too').toBeLessThanOrEqual(844);
    expect(read.scrollHeight, 'and nothing is below the fold at all').toBeLessThanOrEqual(844);
    await context.close();
  }, 300_000);

  it('holds the strip to one line when two long flag words land at once', async () => {
    const { page, context } = await loaded();

    const strip = await page.evaluate(() => {
      const root = globalThis.document.querySelector('.flags');
      if (!root) return null;
      const chips = [...root.querySelectorAll('.chip')];
      return {
        height: Math.round(root.getBoundingClientRect().height),
        words: chips.map((chip) => chip.textContent ?? ''),
        wraps: chips.map((chip) => globalThis.getComputedStyle(chip).whiteSpace),
        chipHeights: chips.map((chip) => Math.round(chip.getBoundingClientRect().height)),
      };
    });

    expect(strip, 'the strip is on the board').not.toBeNull();
    /*
     * The case that found the defect. `flex-wrap: nowrap` stops the row
     * breaking *between* chips and does nothing about `Badly poisoned` breaking
     * *inside* one once the row squeezes it, which made the strip 35px — two
     * lines by any reading of the plan's rule. This board lands `Paralysed` and
     * `Badly poisoned` on the same turn, which is what makes it the test.
     */
    expect((strip?.words ?? []).length, 'this board has words to say').toBeGreaterThan(1);
    expect(strip?.height, 'still one band').toBe(24);
    for (const value of strip?.wraps ?? []) expect(value).toBe('nowrap');
    for (const height of strip?.chipHeights ?? []) expect(height).toBeLessThanOrEqual(24);
    await context.close();
  }, 300_000);
});
