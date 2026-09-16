/**
 * No animation timing is derived from a computed style read. **The iOS
 * animations patch, and this is the structural half of Bug A's fix.**
 *
 * ## The defect
 *
 * `ui/scene.ts` decided how long to hold the battle screen at the end of a
 * fight by calling `getComputedStyle(root).getPropertyValue('--motion-outro')`
 * and parsing the result. The number it was recovering had been written into
 * that property by `ui/theme/motion.ts`, in the same process, out of
 * `data/displayTuning.ts`. So the round trip's best case was to get back a
 * number JavaScript already held, and its worst case was an engine that
 * serialized the property in a spelling the parser did not accept — whereupon
 * the parse failed and the function returned **zero**, which is not a short
 * hold but no hold, silently identical to the bug the hold was added to fix.
 *
 * ## Why a rule and not a code review
 *
 * Because the round trip is *reasonable-looking*. It reads as "ask the
 * stylesheet what it decided", which is a sensible thing to want when a value
 * has a `calc()` in it, and the next person to need a duration in JavaScript
 * will reach for it again for the same good reason. The failure it causes is
 * invisible: no exception, no warning, no failing assertion — just an
 * animation that does not happen on one engine.
 *
 * So the direction is enforced rather than agreed. `data/displayTuning.ts` is
 * the source, `ui/theme/motion.ts` publishes it into CSS, CSS reads it, and
 * nothing reads it back.
 *
 * ## Why the whole of `src/`, not just the timing
 *
 * A test that banned only *timing* reads would have to decide what counts as
 * one, and "this read is a length, not a duration" is exactly the argument
 * that would reintroduce it. `src/` has no other use for `getComputedStyle`:
 * the UI writes style, it does not interview it. The browser tests under
 * `test/` and the measuring scripts under `scripts/visual/` read computed style
 * constantly and must — that is what an instrument is — and neither ships.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|mts|js|mjs)$/.test(entry) ? [path] : [];
  });
}

/**
 * The file with comments removed.
 *
 * `ui/theme/motion.ts` and `ui/scene.ts` both *name* `getComputedStyle` in
 * their doc comments, because both explain the round trip they no longer make.
 * A test that could not tell a mention from a call would force those
 * explanations out of the files, which is the opposite of what it is for.
 */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('a duration never travels from CSS back into JavaScript', () => {
  const files = sourceFiles(SRC);

  it('finds the source files at all, so an empty walk cannot pass', () => {
    // The failure mode of every grep test: a path that stops matching and a
    // green board that means nothing was looked at.
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((path) => path.endsWith(join('ui', 'scene.ts')))).toBe(true);
  });

  it('reads no computed style anywhere under src/', () => {
    const offenders = files.filter((path) => /getComputedStyle\s*\(/.test(code(readFileSync(path, 'utf8'))));
    expect(
      offenders.map((path) => path.slice(SRC.length + 1)),
      'a computed style read under src/ is how the end-of-fight hold became zero on WebKit',
    ).toEqual([]);
  });

  it('still lets those files explain the round trip they do not make', () => {
    // The other half: the rule must not have been satisfied by deleting the
    // account of why it exists.
    const motion = readFileSync(join(SRC, 'ui', 'theme', 'motion.ts'), 'utf8');
    expect(motion).toMatch(/getComputedStyle/);
    expect(code(motion)).not.toMatch(/getComputedStyle/);
  });
});
