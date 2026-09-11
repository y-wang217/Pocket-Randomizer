/**
 * @vitest-environment jsdom
 *
 * The mode picker in the drawer. **Density modes patch, step 7.**
 *
 * Three named options, one line each, the pressed one the store's value,
 * and a press writes the store and nothing else. The copy is asserted as
 * facts about the layout: `test/boundaries.test.ts` reads it for verdict
 * words like every other string under `ui/`.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { DENSITY_COPY } from '../src/ui/copy/screens';
import { createDrawer } from '../src/ui/drawer';
import { DENSITIES, getDensity, initSettings, resetSettings, setDensity } from '../src/ui/settings';

beforeEach(() => {
  document.body.replaceChildren();
  globalThis.localStorage.clear();
  resetSettings();
  initSettings();
});

describe('the mode picker', () => {
  it('offers exactly the three modes, in the setting’s order, each with a line saying what it does', () => {
    const drawer = createDrawer();
    document.body.append(drawer.root);
    const rows = [...drawer.root.querySelectorAll('.density__option')];
    expect(rows.map((row) => row.querySelector('.density__choice')?.getAttribute('data-density'))).toEqual([...DENSITIES]);
    for (const row of rows) {
      const mode = row.querySelector('.density__choice')?.getAttribute('data-density') as (typeof DENSITIES)[number];
      expect(row.querySelector('.density__choice')?.textContent).toBe(DENSITY_COPY[mode].name);
      expect(row.querySelector('.density__desc')?.textContent).toBe(DENSITY_COPY[mode].description);
      expect(DENSITY_COPY[mode].description.length).toBeGreaterThan(0);
    }
  });

  it('marks the stored mode pressed, and follows the store when it changes by another path', () => {
    const drawer = createDrawer();
    document.body.append(drawer.root);
    const pressed = () => drawer.root.querySelector('.density__choice[aria-pressed="true"]')?.getAttribute('data-density');
    expect(pressed()).toBe('detailed');
    setDensity('pocket');
    expect(pressed()).toBe('pocket');
  });

  it('writes the store on a press, and only the store', () => {
    const drawer = createDrawer();
    document.body.append(drawer.root);
    const before = document.documentElement.getAttribute('data-density');
    drawer.root.querySelector<HTMLButtonElement>('.density__choice[data-density="simple"]')?.click();
    expect(getDensity()).toBe('simple');
    expect(drawer.root.querySelector('.density__choice[aria-pressed="true"]')?.getAttribute('data-density')).toBe('simple');
    // The root is the app's guard's to write (`ui/density-guard.ts`), not the picker's.
    expect(document.documentElement.getAttribute('data-density')).toBe(before);
  });
});
