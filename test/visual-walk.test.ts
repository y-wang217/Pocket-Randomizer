/**
 * The walk's own contract, proved without a browser. **Milestone M2.0.**
 *
 * `playUntil` and `stepOnce` are the two functions every browser walk is built
 * out of, and until this file nothing tested them — only the twenty-odd suites
 * that use them, each of which would report a walk bug as a failure of
 * whatever it happened to be measuring. That is how the defect below survived:
 * it presented as `visual-v0` and `visual-move-cards` failing under full-suite
 * load and passing in isolation, which reads as flaky hardware and is not.
 *
 * ## The race
 *
 * A caller reads the screen, decides about it, and calls `stepOnce`, which
 * reads the screen **again**. The app can move inside that gap on its own —
 * the battle outro resolves on a `setTimeout` and `router.show` is
 * synchronous, so the switch lands whole between the two reads. The caller
 * then decides about one screen and steps off another, and the screen it was
 * waiting for is spent without its predicate ever being asked.
 *
 * It is load-sensitive because the gap is two CDP round trips wide while the
 * timer runs on wall-clock: a saturated box stretches the gap and leaves the
 * timer alone. Which is also why CPU-throttling the *page* does not reproduce
 * it — that slows the app and narrows the gap. The reproduction is the whole
 * suite on a loaded machine, and a test that needs a loaded machine is not a
 * test. So the gap is reproduced directly here instead, by a fake page that
 * moves the app between the two reads, every time, deterministically.
 *
 * ## Why a browserless test sits in the browser half
 *
 * `scripts/browser-tests.mjs` splits on imports, not names, and importing
 * `visual/browser` is one of the three things it counts as reaching a browser.
 * That is deliberate and conservative there — loud beats silent — so this file
 * rides the browser leg despite never launching one. It costs a few hundred
 * milliseconds and needs no exception in the splitter.
 */
import { describe, expect, it } from 'vitest';

import { playUntil, stepOnce } from '../scripts/visual/browser.mjs';

/** One screen element, as `openScreen`'s evaluate callback reads it. */
interface FakeScreen {
  hidden: boolean;
  dataset: { screen: string };
}

interface World {
  screen: string;
  clicks: string[];
  reads: number;
  /** Runs after each screen read has computed its value. */
  afterRead?: (reads: number, world: World) => void;
}

/**
 * Enough of Playwright's `Page` for the two functions under test.
 *
 * `evaluate` runs the real callback against a stub `document`, so `openScreen`
 * and `dismissTooltip` are exercised as written rather than stubbed out — the
 * selectors and the `hidden` check are theirs, not this file's.
 */
function fakePage(world: World) {
  const locator = (selector: string): FakeLocator => {
    const isReward = selector.includes('.reward');
    return {
      count: async () => (isReward && world.screen === 'result' ? 1 : 0),
      click: async () => {
        world.clicks.push(selector);
        // Taking the reward leaves the result screen, which is what makes a
        // step past it unrecoverable: the predicate never gets another chance.
        if (isReward) world.screen = 'map';
      },
      first: () => locator(selector),
      last: () => locator(selector),
      nth: () => locator(selector),
      isHidden: async () => true,
      textContent: async () => null,
      waitFor: async () => undefined,
      locator: (inner: string) => locator(`${selector} ${inner}`),
    };
  };

  return {
    async evaluate<T>(fn: () => T): Promise<T> {
      const screens: FakeScreen[] = [
        { hidden: world.screen !== 'battle', dataset: { screen: 'battle' } },
        { hidden: world.screen !== 'result', dataset: { screen: 'result' } },
        { hidden: world.screen !== 'map', dataset: { screen: 'map' } },
        { hidden: world.screen !== 'graveyard', dataset: { screen: 'graveyard' } },
      ];
      const document = {
        querySelector: () => null,
        querySelectorAll: () => screens,
      };
      const previous = (globalThis as { document?: unknown }).document;
      (globalThis as { document?: unknown }).document = document;
      try {
        const value = fn();
        // The value is computed first, then the app moves. That ordering *is*
        // the race: read one sees the old screen, read two sees the new one.
        world.reads += 1;
        world.afterRead?.(world.reads, world);
        return value;
      } finally {
        (globalThis as { document?: unknown }).document = previous;
      }
    },
    locator,
    mouse: { move: async () => undefined },
    keyboard: { press: async () => undefined },
    waitForTimeout: async () => undefined,
  };
}

interface FakeLocator {
  count(): Promise<number>;
  click(options?: unknown): Promise<void>;
  first(): FakeLocator;
  last(): FakeLocator;
  nth(index: number): FakeLocator;
  isHidden(): Promise<boolean>;
  textContent(): Promise<string | null>;
  waitFor(options?: unknown): Promise<void>;
  locator(selector: string): FakeLocator;
}

describe('playUntil, when the app moves between the two reads', () => {
  it('stops on the screen it was asked for instead of stepping past it', async () => {
    const world: World = {
      screen: 'battle',
      clicks: [],
      reads: 0,
      // After the first read returns 'battle', the outro lands and the app is
      // on 'result' by the time `stepOnce` looks.
      afterRead: (reads, w) => {
        if (reads === 1) w.screen = 'result';
      },
    };
    const page = fakePage(world) as unknown as Parameters<typeof playUntil>[0];

    const landed = await playUntil(page, (screen) => screen === 'result', 20);

    expect(landed, 'the walk reported the screen it was waiting for').toBe('result');
    expect(world.clicks, 'nothing was spent on the way past it').toEqual([]);
  });

  it('does not count a lap that found nothing to click', async () => {
    // `graveyard` is not a branch of the switch, so every lap falls through to
    // the default: it waits and reports that it did nothing.
    const world: World = { screen: 'graveyard', clicks: [], reads: 0 };
    const page = fakePage(world) as unknown as Parameters<typeof playUntil>[0];

    /*
     * The budget is two. If waiting counted, this would give up after two laps
     * and say so. It is the deadline that has to end this run, and the message
     * names which of the two stopped it.
     */
    await expect(playUntil(page, (screen) => screen === 'result', 2, { timeoutMs: 120 })).rejects.toThrow(/elapsed after 0 steps/);
  });
});

describe('stepOnce', () => {
  it('reports null rather than a screen name when it clicked nothing', async () => {
    const world: World = { screen: 'graveyard', clicks: [], reads: 0 };
    const page = fakePage(world) as unknown as Parameters<typeof stepOnce>[0];

    expect(await stepOnce(page)).toBeNull();
    expect(world.clicks).toEqual([]);
  });

  it('acts when the screen is the one the caller decided about', async () => {
    const world: World = { screen: 'result', clicks: [], reads: 0 };
    const page = fakePage(world) as unknown as Parameters<typeof stepOnce>[0];

    expect(await stepOnce(page, 'result')).toBe('result');
    expect(world.clicks.length, 'it took the reward').toBe(1);
  });

  it('acts on nothing when the screen is not the one the caller decided about', async () => {
    const world: World = { screen: 'result', clicks: [], reads: 0 };
    const page = fakePage(world) as unknown as Parameters<typeof stepOnce>[0];

    expect(await stepOnce(page, 'battle')).toBeNull();
    expect(world.clicks, 'the screen the caller never saw is untouched').toEqual([]);
  });
});
