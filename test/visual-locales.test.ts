/**
 * Stage V1: the locale palettes, and the projection that selects one.
 *
 * @vitest-environment jsdom
 *
 * Three things, none of them layout, so none of them need a browser:
 *
 *   1. `theme/locales.css` sets exactly three tokens per locale and nothing
 *      else, for all eight. Parsed, not eyeballed: a fourth token is how the
 *      decision screens would start to differ by region.
 *   2. `applyLocale` writes and clears one attribute on one element.
 *   3. The projection survives a save and reload. A run is played headless
 *      with the app's own hook shape, its log is cut mid-run, the cut log is
 *      resumed, and the locale the hook reports at the resume point is the
 *      one it reported live. This is the mechanism `app.ts` uses, minus the
 *      DOM; `test/visual-v1.test.ts` does the same through a real reload.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { localeOf, playRun, resumeRun, scriptedRunPolicy } from '../src/core/run';
import type { RunLog } from '../src/core/types';
import { LOCALE_IDS } from '../src/data/locales';
import { applyLocale, currentLocale, LOCALE_ATTRIBUTE } from '../src/ui/theme/locale';

const LOCALES_CSS = readFileSync(join(process.cwd(), 'src/ui/theme/locales.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('locales.css', () => {
  /** Selector → the custom properties its block declares. */
  function blocks(): { selector: string; tokens: string[] }[] {
    return [...LOCALES_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
      selector: (match[1] ?? '').trim(),
      tokens: [...(match[2] ?? '').matchAll(/(--[a-z-]+)\s*:/g)].map((m) => m[1] ?? ''),
    }));
  }

  it('sets exactly three tokens for each of the eight locales, and no more', () => {
    const declared = blocks();
    for (const id of LOCALE_IDS) {
      const own = declared.filter((block) => block.selector.includes(`data-locale='${id}'`));
      expect(own.length, `${id} has one block`).toBe(1);
      expect(own[0]?.tokens.sort()).toEqual(['--locale-deep', '--locale-glow', '--locale-mid']);
      // And the card class rides the same block, so the swatch previews the
      // same three numbers the page will wear.
      expect(own[0]?.selector).toContain(`.locale--${id}`);
    }
    expect(declared.length, 'no block for anything but a locale').toBe(LOCALE_IDS.length);
  });
});

describe('applyLocale', () => {
  it('writes the attribute and clears it', () => {
    const root = document.createElement('div');
    applyLocale('marsh', root);
    expect(root.getAttribute(LOCALE_ATTRIBUTE)).toBe('marsh');
    expect(currentLocale(root)).toBe('marsh');
    applyLocale(null, root);
    expect(root.hasAttribute(LOCALE_ATTRIBUTE)).toBe(false);
    expect(currentLocale(root)).toBeNull();
  });
});

describe('the projection across a save and reload', () => {
  /**
   * The locale the hook last reported at each decision count. Keyed by the
   * count rather than by transition index because a resumed run replays its
   * decisions through the same hook and the count is what the two runs share.
   */
  async function localeByDecisionCount(play: (hooks: PlayHooks) => Promise<unknown>): Promise<Map<number, string | null>> {
    let decisions = 0;
    let last: string | null = null;
    const byCount = new Map<number, string | null>();
    await play({
      // Carried forward: a battle decision changes no state, so the locale
      // at that count is the one the last transition reported.
      onDecision: () => {
        decisions++;
        byCount.set(decisions, last);
      },
      onState: (state) => {
        last = localeOf(state);
        byCount.set(decisions, last);
      },
    });
    return byCount;
  }

  it('reports the same locale after a resume as it did live, at every cut', async () => {
    const seed = 'SMOKE24';
    const logs: RunLog[] = [];
    const live = await localeByDecisionCount((hooks) =>
      playRun(seed, scriptedRunPolicy(greedyAiPolicy), undefined, {
        opponent: greedyAiPolicy,
        onState: hooks.onState,
        onDecision: (log) => {
          hooks.onDecision();
          logs.push(structuredClone(log));
        },
      }),
    );
    expect([...live.values()].filter(Boolean).length).toBeGreaterThan(0);

    // Cut at a few points through the run, including inside later segments,
    // and resume from each. At the decision count where the replay hands
    // over, the resumed hook must report what the live hook reported.
    const cuts = [3, Math.floor(logs.length / 3), Math.floor(logs.length / 2), logs.length - 2];
    for (const cut of cuts) {
      const partial = logs[cut];
      if (!partial) continue;
      const handover = partial.decisions.length;
      const resumed = await localeByDecisionCount((hooks) =>
        resumeRun(partial, scriptedRunPolicy(greedyAiPolicy), undefined, {
          opponent: greedyAiPolicy,
          onState: hooks.onState,
          onDecision: hooks.onDecision,
        }),
      );
      expect(resumed.get(handover), `locale at ${handover} decisions (cut ${cut})`).toBe(live.get(handover));
      expect(live.get(handover), 'the cut lands inside a region').not.toBeUndefined();
    }
  }, 120_000);
});

interface PlayHooks {
  onDecision: () => void;
  onState: (state: Parameters<typeof localeOf>[0]) => void;
}
