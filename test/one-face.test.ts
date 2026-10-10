/**
 * One face, and no density setting. **Stage 5.0/1**, test 6 of
 * `docs/spec/gymrun-stage5.0-visual-redesign.md`: *"No symbol reads a density
 * setting after Stage 1."*
 *
 * This file was `test/density.test.ts`, the proof that the Detailed / Simple /
 * Pocket setting was presentation only. The bible's R6 retired the setting on
 * the author's ruling (D50, 2026-09-30), so what it proves now is that the
 * setting is gone:
 *
 *   1. **Static, over core.** Unchanged from the density file: nothing under
 *      `src/core/` mentions the settings module or any spelling of the old
 *      setting. It stays because the rule it enforces, display preferences
 *      never reach the rules, outlives this one preference.
 *   2. **Static, over everything.** No code under `src/`, `scripts/` or the
 *      two HTML entries names the setting, its accessors, its attribute or its
 *      multipliers. Comments may still tell the history; code may not.
 *   3. **The store.** A stored `density` or 4.7.2 `verbosity` is read as
 *      nothing and dropped on the next save.
 *
 * The behavioural guard, *"a byte-identical log in Detailed, Simple and
 * Pocket"*, is deleted with the modes: there is one mode to play a run in.
 * Determinism is still asserted by the run replay and determinism suites.
 *
 * **Three files were deleted with the setting, and are named here so the
 * deletion is not silent** (test 9 of the plan):
 *
 *   - `test/density-picker.test.ts`: the drawer's three-way picker. The picker
 *     is gone.
 *   - `test/pocket-default.test.ts`: M6.3, Pocket for new installs and every
 *     stored mode kept. There is nothing left to default or keep; the store
 *     case is the third describe below.
 *   - `test/visual-coverage.test.ts`: every surface paints differently in all
 *     three modes. With one mode there is nothing to differ from.
 *
 * `test/visual-density.test.ts` became `test/visual-one-face.test.ts`, which
 * keeps its Pocket assertions.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GALLERY_SURFACES, ROUTER_SCREEN_COUNT } from '../src/ui/gallery-surfaces';
import { DEFAULT_SETTINGS, readSettings } from '../src/ui/settings';

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

describe('display settings are unreachable from core/', () => {
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
      /*
       * **The move bar's five patterns were here and are gone with it.**
       *
       * The four-column layout was a second presentation axis and sat on this
       * list for the same reason density does: the moment `core/` could see
       * it, a run would play differently depending on how the four buttons
       * were arranged. D9 ruled the layout deleted at M2.2 — R6 forbids two
       * card faces and the measurement said the compact face fits the 2x2 and
       * cannot fit 85px — so the names no longer exist anywhere and a pattern
       * for them could never match. A guard that cannot fail is not a guard.
       *
       * The rule it enforced is unchanged and still enforced, for the axes
       * that still exist. `docs/generation.md` section 55 carries the removal.
       */
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
// Guard 2: no code anywhere names the setting (test 6)
// ---------------------------------------------------------------------------

/** Strip block and line comments, so history in prose does not count as code. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('no symbol reads a density setting (5.0/1, test 6)', () => {
  const roots = ['src', 'scripts'].map((dir) => join(process.cwd(), dir));
  const files = [
    ...roots.flatMap(filesUnder).filter((path) => /\.(ts|mjs|css)$/.test(path)),
    join(process.cwd(), 'index.html'),
    join(process.cwd(), 'gymrun.html'),
    join(process.cwd(), 'gallery.html'),
  ];
  const forbidden = [
    /\bgetDensity\b/,
    /\bsetDensity\b/,
    /\bapplyDensity\b/,
    /\bDENSITIES\b/,
    /\bDensity\b/,
    /\bDENSITY_[A-Z_]+\b/,
    /data-density/,
    /--density-/,
    /densityTuning/,
    /theme\/density/,
    /\bdensity__/,
  ];

  it('finds files to check', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('finds none of the setting\'s names in code', () => {
    for (const path of files) {
      const source = code(readFileSync(path, 'utf8'));
      for (const pattern of forbidden) {
        expect(source, `${path} names ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

describe('the settings store', () => {
  it('has no density field', () => {
    expect(Object.keys(DEFAULT_SETTINGS)).not.toContain('density');
  });

  it('reads a stored density or verbosity as nothing', () => {
    for (const stored of [{ density: 'detailed' }, { density: 'pocket' }, { verbosity: 'simple' }]) {
      expect(Object.keys(readSettings(stored))).toEqual([]);
    }
  });

  it('keeps every other field beside a stored density', () => {
    const read = readSettings({ density: 'simple', battleSpeed: 'swift', tutorial: { skipped: true, seen: ['map', 'nope'] } });
    expect(read).toEqual({ battleSpeed: 'swift', tutorial: { skipped: true, seen: ['map'] } });
  });
});

// ---------------------------------------------------------------------------
// The gates cover the router. Density modes patch, step 3; the gates are
// the Pocket gate and the fit gate now.
// ---------------------------------------------------------------------------

describe('the fit gates cover every screen the shell can route to', () => {
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
