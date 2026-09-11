/**
 * The density setting is presentation only, and this file is the proof.
 *
 * **Stage 4.5.1's test for the two-valued verbosity flag, extended to the
 * three-valued density setting by the density modes patch.** The property is
 * the same: a run plays identically in Detailed, Simple and Pocket. If it did
 * not, a shared seed would stop being a shared run, a saved log would replay
 * differently depending on a display preference, and the balance report would
 * describe none of the three games people were actually playing.
 *
 * That is easy to state and easy to break by accident — a component reaching
 * for `getDensity()` is a one-line change, and so is a core function reaching
 * for it to decide how much detail to *compute*. The second one is the
 * dangerous shape, and it is why this file greps rather than reasons.
 *
 * Two guards, deliberately of different kinds:
 *
 *   1. **Static.** Every file under `src/core/` is read and searched for any
 *      mention of the settings module, its accessors, or the root attribute. A
 *      comment saying "core must not read this" is a comment; this is the rule.
 *   2. **Behavioural.** A full headless run is played in each mode and the
 *      logs are compared byte for byte. The static check would miss an
 *      indirect route — a value threaded in from `ui/` through a policy, say —
 *      and this would catch it.
 *
 * Plus the store migration Part 1 asks for, asserted on the parser.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { playRun, scriptedRunPolicy } from '../src/core/run';
import { GALLERY_SURFACES, ROUTER_SCREEN_COUNT } from '../src/ui/gallery-surfaces';
import {
  DEFAULT_SETTINGS,
  DENSITIES,
  getDensity,
  readSettings,
  resetSettings,
  setDensity,
} from '../src/ui/settings';

const CORE = join(process.cwd(), 'src', 'core');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

// ---------------------------------------------------------------------------
// Guard 1: the setting is not reachable from core/
// ---------------------------------------------------------------------------

describe('the density setting is unreachable from core/', () => {
  const coreFiles = filesUnder(CORE).filter((path) => path.endsWith('.ts'));

  it('finds core files to check, so the search is not vacuous', () => {
    // A test that greps an empty list passes forever and means nothing.
    expect(coreFiles.length).toBeGreaterThan(5);
  });

  it('never imports ui/settings from anywhere under core/', () => {
    for (const path of coreFiles) {
      const source = readFileSync(path, 'utf8');
      expect(source, `${path} imports the settings module`).not.toMatch(/from\s+['"].*ui\/settings['"]/);
    }
  });

  it('never mentions the setting or its accessors, by any route', () => {
    /*
     * Names rather than imports, because an import is only the obvious way in.
     * A core file that received `getDensity` as a parameter, or read a
     * `density` field off an options object, would pass the import check and
     * still make game logic a function of a display preference.
     *
     * The bare word "density" is *not* on the list: `core/encounters.ts` uses
     * it for rest-node density, which is a balance concept and not this
     * setting. What is banned is every spelling that can only mean the
     * setting — the accessors, the type, the attribute and the old flag.
     */
    const forbidden = [
      /\bgetDensity\b/,
      /\bsetDensity\b/,
      /\bDensity\b/,
      /\bDENSITIES\b/,
      /data-density/,
      /\bshowsNumbers\b/,
      /\bgetVerbosity\b/,
      /\bsetVerbosity\b/,
      /\bverbosity\b/i,
    ];
    for (const path of coreFiles) {
      const source = readFileSync(path, 'utf8');
      for (const pattern of forbidden) {
        expect(source, `${path} mentions ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('never imports anything from ui/ at all, which is the wider rule', () => {
    // The dependency runs one way and always has. This is the structural reason
    // the check above can only fail by someone deliberately reversing it.
    for (const path of coreFiles) {
      const source = readFileSync(path, 'utf8');
      expect(source, `${path} imports from ui/`).not.toMatch(/from\s+['"][^'"]*\/ui\//);
    }
  });
});

// ---------------------------------------------------------------------------
// Guard 2: a run plays the same in every mode
// ---------------------------------------------------------------------------

describe('the setting changes no run', () => {
  it('produces a byte-identical log in Detailed, Simple and Pocket', async () => {
    resetSettings();
    setDensity('detailed');
    const detailed = await playRun('VERBOSITY', scriptedRunPolicy(greedyAiPolicy));

    for (const mode of DENSITIES.filter((each) => each !== 'detailed')) {
      setDensity(mode);
      const other = await playRun('VERBOSITY', scriptedRunPolicy(greedyAiPolicy));
      expect(JSON.stringify(other.log), mode).toBe(JSON.stringify(detailed.log));
      expect(other.outcome, mode).toBe(detailed.outcome);
      expect(other.state.party.map((member) => member.spec), mode).toEqual(
        detailed.state.party.map((member) => member.spec),
      );
      expect(other.state.backpack, mode).toEqual(detailed.state.backpack);
    }
    resetSettings();
  }, 90_000);
});

// ---------------------------------------------------------------------------
// The setting itself
// ---------------------------------------------------------------------------

describe('the setting', () => {
  it('has exactly three values, Detailed first', () => {
    expect(DENSITIES).toEqual(['detailed', 'simple', 'pocket']);
  });

  it('defaults to Detailed on a first launch', () => {
    /*
     * The reasoning, asserted so it survives a later "simpler is friendlier"
     * instinct: a new player does not know the help exists, so the mode that
     * hides it is the mode they never leave. The other two are what you turn
     * on once you no longer need the labels or the tooltips that explain them.
     */
    resetSettings();
    expect(DEFAULT_SETTINGS.density).toBe('detailed');
    expect(getDensity()).toBe('detailed');
  });

  it('takes every value', () => {
    resetSettings();
    for (const mode of DENSITIES) {
      setDensity(mode);
      expect(getDensity()).toBe(mode);
    }
    resetSettings();
  });

  it('resets cleanly, so one test cannot leak into the next', () => {
    setDensity('pocket');
    resetSettings();
    expect(getDensity()).toBe('detailed');
  });
});

// ---------------------------------------------------------------------------
// Store migration. Part 1 of the density modes patch.
// ---------------------------------------------------------------------------

describe('the store migration from verbosity', () => {
  it('lands a stored simple on Simple and a stored detailed on Detailed', () => {
    expect(readSettings({ verbosity: 'simple' }).density).toBe('simple');
    expect(readSettings({ verbosity: 'detailed' }).density).toBe('detailed');
  });

  it('defaults a missing value to Detailed, unchanged from 4.5.1', () => {
    expect(readSettings({}).density).toBeUndefined();
    expect({ ...DEFAULT_SETTINGS, ...readSettings({}) }.density).toBe('detailed');
    expect({ ...DEFAULT_SETTINGS, ...readSettings({ tutorial: { skipped: true, seen: [] } }) }.density).toBe('detailed');
  });

  it('reads every new value under the new name', () => {
    for (const mode of DENSITIES) expect(readSettings({ density: mode }).density).toBe(mode);
  });

  it('lets a stored density win over a stored verbosity', () => {
    expect(readSettings({ density: 'pocket', verbosity: 'detailed' }).density).toBe('pocket');
  });

  it('drops a value neither field can hold, rather than guessing', () => {
    expect(readSettings({ verbosity: 'loud' }).density).toBeUndefined();
    expect(readSettings({ density: 'loud' }).density).toBeUndefined();
    expect(readSettings({ density: 42 }).density).toBeUndefined();
  });

  it('keeps the tutorial flags beside the migrated mode', () => {
    const read = readSettings({ verbosity: 'simple', tutorial: { skipped: true, seen: ['map', 'nope'] } });
    expect(read.density).toBe('simple');
    expect(read.tutorial).toEqual({ skipped: true, seen: ['map'] });
  });
});

// ---------------------------------------------------------------------------
// The gates cover the router. Density modes patch, step 3.
// ---------------------------------------------------------------------------

describe('the density gates cover every screen the shell can route to', () => {
  /** The `ScreenName` union, read off the router's source: a type has no runtime. */
  const routerScreens = [...readFileSync(join(process.cwd(), 'src/ui/screens/router.ts'), 'utf8').matchAll(/^\s*\| '([a-z-]+)'/gm)].map(
    (match) => match[1],
  );

  it('reads the router and finds its screens', () => {
    expect(routerScreens.length).toBe(ROUTER_SCREEN_COUNT);
  });

  it('lists every router screen as a gallery surface', () => {
    for (const screen of routerScreens) {
      expect(GALLERY_SURFACES as readonly string[], `${screen} has no gallery fixture, so neither gate can see it`).toContain(screen);
    }
  });
});
