/**
 * One bar component, and no bar built by hand anywhere else.
 *
 * @vitest-environment jsdom
 *
 * The chunk rules here are Release C item 1's, moved out of the battle panel
 * and into `ui/bar.ts` so every bar in the game can carry them. The battle
 * panel's own cases in `test/battle-feedback.test.ts` are untouched and are
 * the migration's regression guard; these assert the component on its own,
 * including the two things the panel never exercised — a bar with no shadow
 * and a bar with no HP meaning at all.
 *
 * jsdom, because every assertion is about which elements exist, in what
 * order, with which attributes and inline styles. The percentages are read
 * off inline styles, which is the right instrument: the component computes
 * them from two fractions and writes them, so the string *is* the assertion.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createBar, hpBand, MIN_CHUNK } from '../src/ui/bar';

const ROOT = process.cwd();

function tap(root: HTMLElement): void {
  root.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
}

describe('the bar', () => {
  it('renders the three variants on the old class names, fill only', () => {
    expect(createBar().root.className).toBe('hp');
    expect(createBar({ variant: 'slim' }).root.className).toBe('hp hp--slim');
    expect(createBar({ variant: 'neutral' }).root.className).toBe('hp hp--neutral');
    for (const variant of ['hp', 'slim', 'neutral'] as const) {
      const bar = createBar({ variant });
      expect([...bar.root.children].map((child) => child.className)).toEqual(['hp__fill']);
      expect(bar.shadow).toBeNull();
    }
  });

  it('paints the shadow before the fill when asked for one', () => {
    const bar = createBar({ shadow: true });
    // Shadow first, so the fill paints over it: a shadow drawn on top would put
    // a seam on the leading edge of the bar on exactly the frames the player is
    // watching it.
    expect([...bar.root.children].map((child) => child.className)).toEqual(['hp__shadow', 'hp__fill']);
    expect(bar.shadow).toBe(bar.root.firstElementChild);
  });

  it('writes the width, the fraction and the band', () => {
    const bar = createBar();
    bar.set(0.35);
    expect(bar.fill.style.width).toBe('35%');
    expect(bar.fill.dataset['fraction']).toBe('0.35');
    expect(bar.fill.dataset['band']).toBe('mid');
  });

  it('gives the neutral variant no band, because it is not HP', () => {
    const bar = createBar({ variant: 'neutral' });
    bar.set(0.1);
    expect(bar.fill.style.width).toBe('10%');
    expect(bar.fill.dataset['band']).toBeUndefined();
  });

  it('bands at the two thresholds the stylesheet colours', () => {
    expect(hpBand(1)).toBe('high');
    expect(hpBand(0.51)).toBe('high');
    expect(hpBand(0.5)).toBe('mid');
    expect(hpBand(0.21)).toBe('mid');
    expect(hpBand(0.2)).toBe('low');
    expect(hpBand(0)).toBe('low');
  });

  describe('the chunk', () => {
    it('draws none on the first set, because there is no previous value', () => {
      const bar = createBar({ shadow: true });
      expect(bar.set(0.3)).toBe(false);
      expect(bar.shadow?.dataset['fading']).toBeUndefined();
      expect(bar.shadow?.style.width).toBe('0%');
    });

    it('paints the shadow across exactly the span the bar vacated', () => {
      const bar = createBar({ shadow: true });
      bar.set(1);
      expect(bar.set(0.6)).toBe(true);
      expect(bar.shadow?.style.left).toBe('60%');
      expect(bar.shadow?.style.width).toBe('40%');
      expect(bar.shadow?.dataset['fading']).toBe('true');
      // And the fill is already right: nothing waits for the fade.
      expect(bar.fill.style.width).toBe('60%');
    });

    it('draws none on a rise, and clears one that was standing', () => {
      const bar = createBar({ shadow: true });
      bar.set(1);
      bar.set(0.4);
      expect(bar.shadow?.dataset['fading']).toBe('true');
      expect(bar.set(0.9)).toBe(false);
      expect(bar.shadow?.dataset['fading']).toBeUndefined();
      expect(bar.shadow?.style.width).toBe('0%');
    });

    it('clears a standing shadow when the next set takes nothing', () => {
      const bar = createBar({ shadow: true });
      bar.set(1);
      bar.set(0.5);
      // A shadow that outlives the hit it describes is a lie about this turn.
      expect(bar.set(0.5)).toBe(false);
      expect(bar.shadow?.dataset['fading']).toBeUndefined();
    });

    it('draws none when told the bar describes a different thing now', () => {
      const bar = createBar({ shadow: true });
      bar.set(1);
      expect(bar.set(0.1, { chunk: false })).toBe(false);
      expect(bar.shadow?.dataset['fading']).toBeUndefined();
      expect(bar.fill.style.width).toBe('10%');
      // The next real drop measures from the new body's value, not the old one's.
      expect(bar.set(0.05)).toBe(true);
      expect(bar.shadow?.style.left).toBe('5%');
      expect(Number.parseFloat(bar.shadow?.style.width ?? '')).toBeCloseTo(5, 5);
    });

    it('ignores a drop too small to draw honestly', () => {
      const bar = createBar({ shadow: true });
      bar.set(1);
      expect(bar.set(1 - MIN_CHUNK / 2)).toBe(false);
      expect(bar.shadow?.dataset['fading']).toBeUndefined();
      expect(bar.set(1 - MIN_CHUNK / 2 - MIN_CHUNK)).toBe(true);
    });

    it('restarts the fade rather than extending it, on two drops running', () => {
      const bar = createBar({ shadow: true });
      bar.set(1);
      bar.set(0.7);
      bar.set(0.4);
      // The second chunk, not the first and not both.
      expect(bar.shadow?.style.left).toBe('40%');
      expect(Number.parseFloat(bar.shadow?.style.width ?? '')).toBeCloseTo(30, 5);
      expect(bar.shadow?.dataset['fading']).toBe('true');
    });

    it('never draws one on a bar created without a shadow', () => {
      const bar = createBar();
      bar.set(1);
      expect(bar.set(0.2)).toBe(false);
      expect(bar.fill.style.width).toBe('20%');
      expect(bar.root.querySelector('.hp__shadow')).toBeNull();
    });

    it('resolves on cancel, with the fill still right', () => {
      const bar = createBar({ shadow: true });
      bar.set(1);
      bar.set(0.5);
      bar.cancel();
      expect(bar.shadow?.dataset['fading']).toBeUndefined();
      expect(bar.shadow?.style.width).toBe('0%');
      expect(bar.fill.style.width).toBe('50%');
      // And cancel on a bar with no shadow is nothing, not an error.
      expect(() => createBar().cancel()).not.toThrow();
      // A tap on the root is the app's way of calling it; the component itself
      // listens to nothing, so the scene's one capture handler stays the one.
      tap(bar.root);
    });
  });

  it('is the only place a track is built', () => {
    /*
     * The V2 rule for chips, applied to bars: the component exists so the next
     * bar is a `createBar` and not a seventh hand-built track. A file that
     * writes `el('div', 'hp')` or `'hp__fill'` itself has gone round it.
     */
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith('.ts') && !path.endsWith('bar.ts')) {
          const source = readFileSync(path, 'utf8');
          if (/\bel\(\s*['"`]\w+['"`]\s*,\s*['"`]hp(?:__fill|__shadow| hp--\w+)?['"`]\s*\)/.test(source)) {
            offenders.push(relative(ROOT, path));
          }
        }
      }
    };
    walk(join(ROOT, 'src', 'ui'));
    expect(offenders).toEqual([]);
  });
});
