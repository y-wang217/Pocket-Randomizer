/**
 * The gate's own tally reading, which nothing covered until now.
 *
 * `scripts/check.mjs` had no test of any kind. The reporter-timeout tolerance
 * it grew at generation section 33 — treat a leg whose tests all passed and
 * whose runner then fell over as ERRORED rather than FAILED — **did not fire
 * once** between then and section 47.5, and the guard's own comment names the
 * reason it survived:
 *
 * > Locally, with no `CI`, vitest emits plain text and the same guard matched —
 * > which is exactly how a bug of this shape survives being tested.
 *
 * The legs are spawned onto pipes and tinyrainbow colours a pipe anyway when
 * `CI` is set, so in Actions `ALL_FILES_PASSED` found no `\s+` between the
 * label and the count and a fully green leg was reported FAILED. A guard
 * exercised only in the one environment where it cannot fail is untested, which
 * is the cry-wolf problem `test/boundaries.test.ts` already warns about.
 *
 * So the fixtures here are real rather than approximations of it: the escape
 * pattern is what this repo emits under `FORCE_COLOR=1`, the failing shape is
 * from run 37205550086's chromium leg, and the passing counts are the ones
 * section 47.5 quotes from the run that was reported red while green.
 *
 * The escapes are written as `\u001b` rather than pasted, so the fixture
 * survives an editor, a linter or a diff viewer that eats control characters.
 */
import { describe, expect, it } from 'vitest';

import { everyTestPassedAnyway, plain, tally } from '../scripts/check-tally.mjs';

const E = '\u001b';

/** `Test Files  120 passed (120)` as vitest prints it onto a pipe under `CI`. */
const COLOURED_PASS = [
  `${E}[2m Test Files ${E}[22m ${E}[1m${E}[32m120 passed${E}[39m${E}[22m${E}[90m (120)${E}[39m`,
  `${E}[2m      Tests ${E}[22m ${E}[1m${E}[32m1650 passed${E}[39m${E}[22m${E}[90m (1650)${E}[39m`,
].join('\n');

/** Run 37205550086's chromium leg: real failures, alongside passing files. */
const COLOURED_FAIL = [
  `${E}[2m Test Files ${E}[22m ${E}[1m${E}[31m2 failed${E}[39m${E}[22m${E}[2m | ${E}[22m${E}[1m${E}[32m30 passed${E}[39m${E}[22m${E}[90m (32)${E}[39m`,
  `${E}[2m      Tests ${E}[22m ${E}[1m${E}[31m3 failed${E}[39m${E}[22m${E}[2m | ${E}[22m${E}[1m${E}[32m192 passed${E}[39m${E}[22m${E}[2m | ${E}[22m${E}[33m4 skipped${E}[39m${E}[90m (199)${E}[39m`,
].join('\n');

const PLAIN_PASS = ' Test Files  120 passed (120)\n      Tests  1650 passed (1650)';
const PLAIN_FAIL = ' Test Files  2 failed | 30 passed (32)\n      Tests  3 failed | 192 passed | 4 skipped (199)';

const TIMEOUT = '[vitest-worker]: Timeout calling "onTaskUpdate"';

describe('the gate reads a tally it can actually see', () => {
  it('takes the colour off and leaves the text a terminal would show', () => {
    expect(plain(COLOURED_PASS)).toBe(PLAIN_PASS);
  });

  it('leaves output that was never coloured alone', () => {
    expect(plain(PLAIN_PASS)).toBe(PLAIN_PASS);
  });

  /**
   * **The regression.** This is the shape every Actions run arrives in, and the
   * one the section 33 guard could not match: the escapes sit exactly where
   * `/Test Files\s+\d+ passed/` expects whitespace.
   */
  it('forgives a coloured passing tally under a reporter timeout', () => {
    expect(everyTestPassedAnyway(`${COLOURED_PASS}\n${TIMEOUT}`)).toBe(true);
  });

  it('still forgives the uncoloured form, which is all that used to be checked', () => {
    expect(everyTestPassedAnyway(`${PLAIN_PASS}\n${TIMEOUT}`)).toBe(true);
  });

  /**
   * The veto, whose failure mode is a masked defect rather than a cry-wolf.
   * Stripping must not loosen it: vitest wraps `2 failed` rather than splitting
   * the token, so `ANY_FAILED` matches coloured and stripped alike.
   */
  it('refuses a coloured failing tally even under a reporter timeout', () => {
    expect(everyTestPassedAnyway(`${COLOURED_FAIL}\n${TIMEOUT}`)).toBe(false);
  });

  it('refuses the uncoloured failing tally too', () => {
    expect(everyTestPassedAnyway(`${PLAIN_FAIL}\n${TIMEOUT}`)).toBe(false);
  });

  /**
   * With no `onTaskUpdate` string there is no runner error to forgive, so a
   * non-zero exit is the leg's own answer and stays FAILED.
   */
  it('refuses a passing tally that no reporter timeout accompanies', () => {
    expect(everyTestPassedAnyway(COLOURED_PASS)).toBe(false);
  });

  it('reads the counts out of coloured output for the leg note', () => {
    expect(tally(COLOURED_PASS)).toBe('120 files, 1650 tests');
  });

  it('reads the counts out of uncoloured output', () => {
    expect(tally(PLAIN_PASS)).toBe('120 files, 1650 tests');
  });

  /**
   * The note degrades rather than throwing when there is no tally: a leg that
   * died before vitest printed one still has to be reported.
   */
  it('says so plainly when there is no tally to read', () => {
    expect(tally(TIMEOUT)).toBe('every test');
  });
});
