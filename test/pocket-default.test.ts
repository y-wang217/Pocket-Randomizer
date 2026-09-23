/**
 * Pocket for new installs; every existing store keeps what it was showing.
 * **Milestone M6.3.**
 *
 * @vitest-environment jsdom
 *
 * The item's done-when, in two halves: *"a fresh store starts in Pocket;
 * existing stores keep their choice."* Asserted through `localStorage` and
 * `initSettings`, the path a launch takes, because the second half is decided
 * in `loadSettings` rather than in the parser: a store with no mode in it has
 * to be told apart from no store at all.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { getDensity, initSettings, resetSettings } from '../src/ui/settings';

const KEY = 'gymrun.settings';

function launchWith(stored: unknown): string {
  globalThis.localStorage.clear();
  if (stored !== undefined) globalThis.localStorage.setItem(KEY, JSON.stringify(stored));
  resetSettings();
  initSettings();
  return getDensity();
}

beforeEach(() => {
  globalThis.localStorage.clear();
  resetSettings();
});

describe('the Pocket default', () => {
  it('starts a fresh store in Pocket', () => {
    expect(launchWith(undefined)).toBe('pocket');
  });

  it('keeps every stored mode', () => {
    for (const mode of ['detailed', 'simple', 'pocket'] as const) expect(launchWith({ density: mode }), mode).toBe(mode);
  });

  it('keeps a 4.7.2 verbosity, through the migration', () => {
    expect(launchWith({ verbosity: 'detailed' })).toBe('detailed');
    expect(launchWith({ verbosity: 'simple' })).toBe('simple');
  });

  it('keeps Detailed for a store that exists and names no mode, which is what it was shown', () => {
    expect(launchWith({ tutorial: { skipped: true, seen: [] } })).toBe('detailed');
    expect(launchWith({})).toBe('detailed');
  });

  it('starts an unreadable store in Pocket, like a fresh one', () => {
    globalThis.localStorage.setItem(KEY, '{not json');
    resetSettings();
    initSettings();
    expect(getDensity()).toBe('pocket');
  });
});
