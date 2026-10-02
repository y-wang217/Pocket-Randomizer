/**
 * The shell nav. **Stage 5.0/1**, bible section 5's Shell nav row (D53, D54).
 *
 * @vitest-environment jsdom
 *
 * Five tabs, one word each and nothing else at rest (section 4's Shell nav
 * row at 5), each icon a control's icon that a screen reader never hears.
 * What a press opens, and the read-only guard, are the shell's and are held
 * in a browser by `test/visual-shell-nav.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { NAV_TABS } from '../src/ui/assets/manifest';
import { NAV_COPY } from '../src/ui/copy/screens';
import { createNav } from '../src/ui/nav';

describe('the shell nav', () => {
  it('draws the five tabs in order, one word each', () => {
    const nav = createNav();
    const tabs = [...nav.root.querySelectorAll<HTMLButtonElement>('.nav__tab')];
    expect(tabs.map((tab) => tab.dataset['nav'])).toEqual([...NAV_TABS]);
    expect(tabs.map((tab) => tab.querySelector('.nav__word')?.textContent)).toEqual(NAV_TABS.map((id) => NAV_COPY.tabs[id]));
    const words = tabs.flatMap((tab) => (tab.querySelector('.nav__word')?.textContent ?? '').split(/\s+/));
    // Run Info is two words for one tab: section 4 budgets the five tabs.
    expect(words.length).toBeLessThanOrEqual(6);
    for (const tab of tabs) expect(tab.querySelector('.asset')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('marks one tab current, or none, and reports presses', () => {
    const nav = createNav();
    const pressed: string[] = [];
    nav.onPress((id) => pressed.push(id));
    nav.setActive('team');
    expect(nav.tab('team').getAttribute('aria-current')).toBe('page');
    expect(nav.tab('map').hasAttribute('aria-current')).toBe(false);
    nav.setActive(null);
    expect(nav.root.querySelector('[aria-current]')).toBeNull();
    nav.tab('info').click();
    expect(pressed).toEqual(['info']);
  });

  it('disables what has nothing to show', () => {
    const nav = createNav();
    nav.setAvailable(new Set(['settings']));
    expect(NAV_TABS.filter((id) => !nav.tab(id).disabled)).toEqual(['settings']);
  });
});
