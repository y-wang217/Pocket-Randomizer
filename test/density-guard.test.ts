/**
 * @vitest-environment jsdom
 *
 * The tutorial's hold on the density mode. **Density modes patch, Part 5,
 * ruling 6.**
 *
 * Per screen, not per run: Detailed on the root while a screen's unseen
 * marks are up, applied before the marks resolve their anchors, and the
 * player's stored mode back the moment the marks finish, Skip fires, or a
 * screen has nothing due. A settings change while marks are up — the picker
 * pressed mid-tutorial — is honoured the moment the marks are gone, never
 * under them.
 *
 * jsdom, against the real layer and the real store, with a bare screen that
 * carries the anchors: the property is about the attribute on `<html>` and
 * the order of two calls, which a stylesheet has no part in. The browser
 * half — that no mark is silently dropped on the worst-case fixtures — is
 * `test/visual-tutorial-guard.test.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { TUTORIAL, type TutorialScreen } from '../src/data/tutorial';
import { createDensityGuard, type DensityGuard } from '../src/ui/density-guard';
import { initSettings, markTutorialSeen, resetSettings, setDensity, tutorialDue } from '../src/ui/settings';
import { DENSITY_ATTRIBUTE } from '../src/ui/theme/density';
import { createTutorial, type TutorialLayer } from '../src/ui/tutorial';

let layer: TutorialLayer;
let guard: DensityGuard;

const mode = (): string | null => document.documentElement.getAttribute(DENSITY_ATTRIBUTE);

/** A screen that carries every anchor its marks name, and nothing else. */
function screenFor(name: TutorialScreen): HTMLElement {
  const root = document.createElement('section');
  root.className = `screen screen--${name}`;
  for (const mark of TUTORIAL[name]) {
    const anchor = document.createElement('div');
    const key = mark.anchor.match(/"([^"]+)"/)?.[1] ?? '';
    anchor.dataset['tutorial'] = key;
    root.append(anchor);
  }
  document.body.append(root);
  return root;
}

function tap(selector?: string): void {
  const target = selector ? layer.root.querySelector<HTMLElement>(selector) : layer.root;
  if (!target) throw new Error(`no ${selector} on the layer`);
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.replaceChildren();
  globalThis.localStorage.clear();
  resetSettings();
  initSettings();
  setDensity('pocket');
  layer = createTutorial(document.body);
  guard = createDensityGuard(layer);
});

describe('the density guard', () => {
  it('paints the stored mode when nothing is showing', () => {
    expect(mode()).toBe('pocket');
  });

  it('forces Detailed before a due screen resolves its anchors, and gives the mode back when the marks finish', () => {
    const root = screenFor('locale');
    let seenAtResolve: string | null = null;
    // The layer's own `showFor` resolves anchors synchronously; the mode it
    // ran under is the mode the anchors were painted in.
    const inner = layer.showFor.bind(layer);
    layer.showFor = (screen, within) => {
      seenAtResolve = mode();
      return inner(screen, within);
    };
    guard = createDensityGuard(layer);

    const shown = guard.showFor('locale', root);
    expect(shown).toBe(TUTORIAL.locale.length);
    expect(seenAtResolve, 'Detailed before the anchors were looked for').toBe('detailed');
    expect(mode(), 'Detailed while the marks are up').toBe('detailed');

    for (let i = 0; i < shown; i++) tap();
    expect(layer.isOpen()).toBe(false);
    expect(mode(), 'the stored mode back once the last mark is tapped').toBe('pocket');
    expect(tutorialDue('locale')).toBe(false);
  });

  it('gives the mode back on Skip', () => {
    const root = screenFor('locale');
    guard.showFor('locale', root);
    expect(mode()).toBe('detailed');
    tap('.coach__skip');
    expect(layer.isOpen()).toBe(false);
    expect(mode()).toBe('pocket');
  });

  it('never forces Detailed on a screen already seen', () => {
    const root = screenFor('locale');
    markTutorialSeen('locale');
    expect(guard.showFor('locale', root)).toBe(0);
    expect(mode()).toBe('pocket');
  });

  it('holds Detailed through a settings change made while marks are up, then honours it', () => {
    const root = screenFor('locale');
    guard.showFor('locale', root);
    setDensity('simple');
    expect(mode(), 'the marks are still up').toBe('detailed');
    tap();
    tap();
    expect(layer.isOpen()).toBe(false);
    expect(mode(), 'the change made under the marks lands when they are gone').toBe('simple');
  });

  it('keeps Detailed across one screen replacing another, and marks the first seen', () => {
    const locale = screenFor('locale');
    const map = screenFor('map');
    guard.showFor('locale', locale);
    expect(mode()).toBe('detailed');
    // The store hears `locale` is seen in the middle of this call; the
    // layer stays open across the swap so the guard never lets the mode go.
    const shown = guard.showFor('map', map);
    expect(shown).toBe(TUTORIAL.map.length);
    expect(tutorialDue('locale')).toBe(false);
    expect(mode()).toBe('detailed');
    expect(layer.current()?.screen).toBe('map');
    for (let i = 0; i < shown; i++) tap();
    expect(mode()).toBe('pocket');
  });

  it('stops following the store once stopped', () => {
    guard.stop();
    setDensity('simple');
    expect(mode()).toBe('pocket');
  });
});
