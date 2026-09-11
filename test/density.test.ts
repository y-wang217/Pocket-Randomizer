/**
 * The verbosity flag is presentation only, and this file is the proof.
 *
 * **The property: a run plays identically in Simple and Detailed.** If it did
 * not, a shared seed would stop being a shared run, a saved log would replay
 * differently depending on a display preference, and the balance report would
 * describe neither of the two games people were actually playing.
 *
 * That is easy to state and easy to break by accident — a component reaching
 * for `showsNumbers()` is a one-line change, and so is a core function reaching
 * for it to decide how much detail to *compute*. The second one is the
 * dangerous shape, and it is why this file greps rather than reasons.
 *
 * Two guards, deliberately of different kinds:
 *
 *   1. **Static.** Every file under `src/core/` is read and searched for any
 *      mention of the settings module or its exported names. A comment saying
 *      "core must not read this" is a comment; this is the rule.
 *   2. **Behavioural.** A full headless run is played in each mode and the two
 *      logs are compared byte for byte. The static check would miss an indirect
 *      route — a value threaded in from `ui/` through a policy, say — and this
 *      would catch it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { playRun, scriptedRunPolicy } from '../src/core/run';
import {
  DEFAULT_SETTINGS,
  getVerbosity,
  resetSettings,
  setVerbosity,
  showsNumbers,
} from '../src/ui/settings';

const CORE = join(process.cwd(), 'src', 'core');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

// ---------------------------------------------------------------------------
// Guard 1: the flag is not reachable from core/
// ---------------------------------------------------------------------------

describe('the verbosity flag is unreachable from core/', () => {
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

  it('never mentions the flag or its accessors, by any route', () => {
    /*
     * Names rather than imports, because an import is only the obvious way in.
     * A core file that received `showsNumbers` as a parameter, or read a
     * `verbosity` field off an options object, would pass the import check and
     * still make game logic a function of a display preference.
     */
    const forbidden = [/\bshowsNumbers\b/, /\bgetVerbosity\b/, /\bsetVerbosity\b/, /\bverbosity\b/i];
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
// Guard 2: a run plays the same in both modes
// ---------------------------------------------------------------------------

describe('the flag changes no run', () => {
  it('produces a byte-identical log in Simple and in Detailed', async () => {
    resetSettings();
    setVerbosity('detailed');
    const detailed = await playRun('VERBOSITY', scriptedRunPolicy(greedyAiPolicy));

    setVerbosity('simple');
    const simple = await playRun('VERBOSITY', scriptedRunPolicy(greedyAiPolicy));

    expect(JSON.stringify(simple.log)).toBe(JSON.stringify(detailed.log));
    expect(simple.outcome).toBe(detailed.outcome);
    expect(simple.state.party.map((member) => member.spec)).toEqual(
      detailed.state.party.map((member) => member.spec),
    );
    expect(simple.state.backpack).toEqual(detailed.state.backpack);
    resetSettings();
  }, 60_000);
});

// ---------------------------------------------------------------------------
// The setting itself
// ---------------------------------------------------------------------------

describe('the setting', () => {
  it('defaults to Detailed on a first launch', () => {
    /*
     * The reasoning, asserted so it survives a later "simpler is friendlier"
     * instinct: a new player does not know the help exists, so the mode that
     * hides it is the mode they never leave. Simple is what you turn on once
     * you no longer need the numbers or the tooltips that explain them.
     */
    resetSettings();
    expect(DEFAULT_SETTINGS.verbosity).toBe('detailed');
    expect(getVerbosity()).toBe('detailed');
    expect(showsNumbers()).toBe(true);
  });

  it('flips both ways', () => {
    resetSettings();
    setVerbosity('simple');
    expect(showsNumbers()).toBe(false);
    setVerbosity('detailed');
    expect(showsNumbers()).toBe(true);
    resetSettings();
  });

  it('resets cleanly, so one test cannot leak into the next', () => {
    setVerbosity('simple');
    resetSettings();
    expect(getVerbosity()).toBe('detailed');
  });
});
