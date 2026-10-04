/**
 * The gate runner's own tally reading, which nothing covered until now.
 *
 * `scripts/check.mjs` had no test of any kind. The tolerance it grew at
 * generation section 33 — rescue a vitest leg that passed every test but exited
 * 1 on a reporter RPC timeout — was checked by hand against six cases, none of
 * which landed in `test/`, and **every one of those cases was uncoloured.**
 * Vitest colours through tinyrainbow whenever `CI` is in the environment, TTY
 * or not, so every real CI run has been coloured and the tolerance never fired
 * once. Run #9 on `main` failed the Node leg with all 113 files and 1611 tests
 * passing.
 *
 * A hand-check that cannot be re-run is not a backstop, which is the same
 * argument `test/boundaries.test.ts` makes about lint. So the fixtures here are
 * real output rather than approximations of it:
 *
 *   - `COLOURED_PASS` and `COLOURED_FAIL` carry the exact escape pattern
 *     `vitest` emits. The pattern was captured from this repo under
 *     `FORCE_COLOR=1`, and the failing shape is verbatim from run #9's
 *     `browser suite (webkit)` job.
 *   - The counts in `COLOURED_PASS` are run #9's Node leg: the run this was
 *     meant to rescue and did not.
 *
 * The escapes are written as `\u001b` rather than pasted so that the fixture
 * survives an editor, a linter or a diff viewer that eats control characters.
 */
import { describe, expect, it } from 'vitest';
import { everyTestPassedAnyway, plain, tally } from '../scripts/check-tally.mjs';

const ESC = '\u001b';

/** `Test Files  113 passed (113)` as vitest actually prints it under colour. */
const COLOURED_PASS = [
  `${ESC}[2m Test Files ${ESC}[22m ${ESC}[1m${ESC}[32m113 passed${ESC}[39m${ESC}[22m${ESC}[90m (113)${ESC}[39m`,
  `${ESC}[2m      Tests ${ESC}[22m ${ESC}[1m${ESC}[32m1611 passed${ESC}[39m${ESC}[22m${ESC}[90m (1611)${ESC}[39m`,
].join('\n');

/** Run #9's WebKit leg: one real failure, alongside 23 passing files. */
const COLOURED_FAIL = [
  `${ESC}[2m Test Files ${ESC}[22m ${ESC}[1m${ESC}[31m1 failed${ESC}[39m${ESC}[22m${ESC}[2m | ${ESC}[22m${ESC}[1m${ESC}[32m23 passed${ESC}[39m${ESC}[22m${ESC}[90m (24)${ESC}[39m`,
  `${ESC}[2m      Tests ${ESC}[22m ${ESC}[1m${ESC}[31m1 failed${ESC}[39m${ESC}[22m${ESC}[2m | ${ESC}[22m${ESC}[1m${ESC}[32m196 passed${ESC}[39m${ESC}[22m${ESC}[2m | ${ESC}[22m${ESC}[33m6 skipped${ESC}[39m${ESC}[90m (203)${ESC}[39m`,
].join('\n');

const PLAIN_PASS = ' Test Files  113 passed (113)\n      Tests  1611 passed (1611)';
const PLAIN_FAIL = ' Test Files  1 failed | 23 passed (24)\n      Tests  1 failed | 196 passed (203)';

const TIMEOUT = '[vitest-worker]: Timeout calling "onTaskUpdate"';

describe('the gate runner reads a tally it can actually see', () => {
  it('strips the colour commands and leaves the text a terminal would show', () => {
    expect(plain(COLOURED_PASS)).toBe(PLAIN_PASS);
  });

  it('leaves text that was never coloured alone', () => {
    expect(plain(PLAIN_PASS)).toBe(PLAIN_PASS);
  });

  /**
   * **The regression.** This is run #9's Node leg, and it is the case the
   * section 33 tolerance was written for and could not match: the escapes sit
   * exactly where `/Test Files\s+\d+ passed/` expects whitespace.
   */
  it('tolerates a coloured passing tally under a reporter timeout', () => {
    expect(everyTestPassedAnyway(`${COLOURED_PASS}\n${TIMEOUT}`)).toBe(true);
  });

  it('still tolerates the uncoloured form, which is what used to be checked', () => {
    expect(everyTestPassedAnyway(`${PLAIN_PASS}\n${TIMEOUT}`)).toBe(true);
  });

  /**
   * The veto half, which is the half whose failure mode is a masked defect.
   * Stripping must not loosen it: vitest wraps `1 failed` rather than splitting
   * it, so the token matches coloured and stripped alike.
   */
  it('refuses a coloured failing tally even under a reporter timeout', () => {
    expect(everyTestPassedAnyway(`${COLOURED_FAIL}\n${TIMEOUT}`)).toBe(false);
  });

  it('refuses the uncoloured failing tally too', () => {
    expect(everyTestPassedAnyway(`${PLAIN_FAIL}\n${TIMEOUT}`)).toBe(false);
  });

  /**
   * Without the `onTaskUpdate` string there is no reporter timeout to forgive,
   * so a non-zero exit is the leg's own answer and stays FAILED.
   */
  it('refuses a passing tally that is not accompanied by a reporter timeout', () => {
    expect(everyTestPassedAnyway(COLOURED_PASS)).toBe(false);
  });

  it('reads the counts out of coloured output for the leg note', () => {
    expect(tally(COLOURED_PASS)).toBe('113 files, 1611 tests');
  });

  it('reads the counts out of uncoloured output', () => {
    expect(tally(PLAIN_PASS)).toBe('113 files, 1611 tests');
  });

  /**
   * The note degrades rather than throwing when there is no tally to read —
   * a leg that died before vitest printed one still has to be reported.
   */
  it('says so plainly when there is no tally', () => {
    expect(tally(TIMEOUT)).toBe('every test');
  });
});
