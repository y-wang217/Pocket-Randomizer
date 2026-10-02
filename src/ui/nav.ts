/**
 * The shell nav: five tabs at the top of the frame. **Stage 5.0/1.**
 *
 * Map, Team, Bag, Run Info, Settings. They replace the Map and Party triggers
 * the shell bar carried from Stage 4.7 (the plan's defaults: *"The top nav tabs
 * replace the single shell-level drawer button on all viewports"*), and they
 * are the bible's *Shell nav* component (section 5, Rev 15, D53 and D54).
 *
 * ## A tab opens a screen, under one guard
 *
 * The author ruled the tabs open screens, not overlays, and confirmed the
 * guard that keeps that from breaking the standing rule for decision screens
 * (`docs/generation.md` §12): **a screen opened by a tab while a decision is
 * pending elsewhere is a readout.** It never advances run state, never submits
 * and draws nothing, and closing it returns to the decision. This file only
 * draws the tabs and reports presses; which screen a press opens, and whether
 * it is the writable one, is the shell's (`ui/app.ts`), because only the shell
 * knows what is pending.
 *
 * ## The words and the icons
 *
 * One word per tab, five at rest: section 4's Shell nav row. The icon beside
 * each is a control's icon, not a glyph (section 2, Rev 15), so it is
 * `aria-hidden`, carries no exposure label, and comes from the asset manifest
 * as a placeholder until there is art.
 */
import { assetIcon, NAV_TABS, type NavTab } from './assets/manifest';
import { NAV_COPY } from './copy/screens';
import { el } from './dom';

export interface Nav {
  root: HTMLElement;
  tab(id: NavTab): HTMLButtonElement;
  /** Mark one tab as the screen on view, or none. */
  setActive(id: NavTab | null): void;
  /** Enable only the tabs that have something to show right now. */
  setAvailable(available: ReadonlySet<NavTab>): void;
  onPress(listener: (id: NavTab, button: HTMLButtonElement) => void): void;
}

export function createNav(): Nav {
  const root = el('nav', 'nav');
  root.setAttribute('aria-label', NAV_COPY.label);
  const listeners: ((id: NavTab, button: HTMLButtonElement) => void)[] = [];

  const buttons = new Map<NavTab, HTMLButtonElement>();
  for (const id of NAV_TABS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `nav__tab nav__tab--${id}`;
    button.dataset['nav'] = id;
    const word = el('span', 'nav__word');
    word.textContent = NAV_COPY.tabs[id];
    button.append(assetIcon(`nav:${id}`), word);
    button.addEventListener('click', () => {
      for (const listener of listeners) listener(id, button);
    });
    buttons.set(id, button);
    root.append(button);
  }

  const tab = (id: NavTab): HTMLButtonElement => {
    const button = buttons.get(id);
    if (!button) throw new RangeError(`No nav tab ${id}`);
    return button;
  };

  return {
    root,
    tab,
    setActive(id) {
      for (const [key, button] of buttons) {
        if (key === id) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      }
    },
    setAvailable(available) {
      for (const [key, button] of buttons) button.disabled = !available.has(key);
    },
    onPress(listener) {
      listeners.push(listener);
    },
  };
}
