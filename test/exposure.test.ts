/**
 * The exposure counter. **Milestone M1.3, for design bible R7.**
 *
 * @vitest-environment jsdom
 *
 * R7: *"The first time a glyph family appears for this player, a small label
 * renders beside it for that screen. The label returns once more on the third
 * exposure, then never. Exposure count persists across runs in the settings
 * store, beside the tutorial flags."*
 *
 * **M1.3 renders no label.** It builds the counter and nothing reads it; M6.1
 * is what renders. So everything below is about the count being right, which is
 * the half that is cheap to get wrong and expensive to notice on a screen.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { GLYPH_FAMILIES } from '../src/data/glyphFamilies';
import {
  DEFAULT_SETTINGS,
  exposureCount,
  exposureFlags,
  initSettings,
  noteExposure,
  readSettings,
  resetExposureScreen,
  resetTutorial,
} from '../src/ui/settings';

beforeEach(() => {
  globalThis.localStorage.clear();
  initSettings();
  resetExposureScreen();
});

describe('the counter', () => {
  it('starts at zero for all nine families', () => {
    expect(Object.keys(exposureFlags()).sort()).toEqual([...GLYPH_FAMILIES].sort());
    for (const family of GLYPH_FAMILIES) expect(exposureCount(family), family).toBe(0);
  });

  it('counts once per screen, not once per render', () => {
    // The whole point. A battle screen draws a type chip on four move buttons
    // and re-draws itself every turn; counting either would put a player past
    // R7's third exposure before they had read anything.
    for (let i = 0; i < 20; i++) noteExposure('type', 'battle');
    expect(exposureCount('type')).toBe(1);
  });

  it('counts again when the player has been somewhere else and come back', () => {
    noteExposure('type', 'battle');
    noteExposure('type', 'map');
    noteExposure('type', 'battle');
    expect(exposureCount('type')).toBe(3);
  });

  it('counts each family separately on one screen', () => {
    noteExposure('type', 'starter');
    noteExposure('category', 'starter');
    noteExposure('stat', 'starter');
    expect(exposureCount('type')).toBe(1);
    expect(exposureCount('category')).toBe(1);
    expect(exposureCount('stat')).toBe(1);
    expect(exposureCount('band')).toBe(0);
  });

  it('returns the count after the increment, so a caller needs one call', () => {
    expect(noteExposure('band', 'reward')).toBe(1);
    expect(noteExposure('band', 'map')).toBe(2);
    // Same screen again: no increment, and the current count comes back.
    expect(noteExposure('band', 'map')).toBe(2);
  });
});

describe('persistence', () => {
  it('survives a reload', () => {
    noteExposure('status', 'battle');
    noteExposure('status', 'party');
    expect(exposureCount('status')).toBe(2);

    // A new document, reading the same store: what "persists across runs"
    // means, since a run is not a session.
    initSettings();
    resetExposureScreen();
    expect(exposureCount('status')).toBe(2);
  });

  it('counts the screen a reload lands on', () => {
    noteExposure('pp', 'battle');
    initSettings();
    resetExposureScreen();
    // The same screen, after a reload, is a fresh arrival at it. A set that
    // survived the reload would swallow this.
    noteExposure('pp', 'battle');
    expect(exposureCount('pp')).toBe(2);
  });

  it('is beside the tutorial flags, in one store', () => {
    noteExposure('priority', 'battle');
    const raw = globalThis.localStorage.getItem('gymrun.settings') ?? '{}';
    expect(JSON.parse(raw)).toMatchObject({ exposure: { counts: { priority: 1 } } });
  });
});

describe('reading a store back', () => {
  it('drops a family that is not one of the nine', () => {
    const read = readSettings({ exposure: { counts: { type: 2, dragons: 9 } } });
    expect(read.exposure?.counts).toEqual({ type: 2 });
  });

  it('drops a count that is not a non-negative integer', () => {
    // localStorage is editable, so the question is not whether it can be wrong
    // but whether a wrong value can reach M6.1's label decision.
    const read = readSettings({ exposure: { counts: { type: -1, band: 1.5, pp: 'lots', stat: 3 } } });
    expect(read.exposure?.counts).toEqual({ stat: 3 });
  });

  it('reads a store written before the field as never labelled', () => {
    const read = readSettings({ density: 'pocket' });
    expect(read.exposure).toBeUndefined();
    expect(DEFAULT_SETTINGS.exposure.counts).toEqual({});
  });
});

describe('the tutorial reset control', () => {
  it('clears the counts too', () => {
    // M1.3's done-when. Section 7 gives coach marks, exposure labels and
    // inspect one job each; a control that reset one third of onboarding would
    // be a control that lies about what it does.
    noteExposure('type', 'battle');
    noteExposure('category', 'starter');
    expect(exposureCount('type')).toBe(1);

    resetTutorial();
    resetExposureScreen();
    for (const family of GLYPH_FAMILIES) expect(exposureCount(family), family).toBe(0);
  });
});

describe('the gate', () => {
  it('touches nothing in core', async () => {
    // M1.3's gates: "settings store only, nothing in core/."
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(join(process.cwd(), 'src/ui/settings.ts'), 'utf8');
    expect(source).not.toMatch(/from '\.\.\/core\//);
  });
});
