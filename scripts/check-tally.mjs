/**
 * Reading a vitest leg's own tally out of its output.
 *
 * Split out of `check.mjs` **unchanged**, so `test/check-gate.test.ts` can
 * exercise these directly. `check.mjs` ends in `process.exit(await main())`, a
 * top-level side effect, so a test that imported it would run the nine-leg
 * gate. An `import.meta.url` entry guard was the alternative and is the worse
 * seam: a guard that fails open means a test run invokes the gate it is part
 * of, which is a louder failure than the bug it would be guarding against.
 *
 * Nothing here reads a global beyond `String` and `RegExp`, which matters
 * because `eslint.config.js` declares only `console` and `process` for
 * `scripts/**\/*.mjs`.
 */

/**
 * Vitest's reporter channel giving up while every test passed.
 *
 * `[vitest-worker]: Timeout calling "onTaskUpdate"` is vitest's own RPC
 * reporting channel timing out under load. It is **not** a test, not the app,
 * and not a defect in the tree — but vitest counts it as an unhandled error and
 * exits non-zero, so it turns a green suite red. This repo has met it
 * repeatedly: `docs/generation.md` section 15 records it against two full suite
 * runs, and the branch reports carry it as the reason a 136-file run with every
 * test passing exited 1.
 *
 * The first CI run of this workflow failed the Node leg on exactly this, with
 * `112 passed (112)` and `1604 passed (1604)` in the same output. A gate that
 * reports a fully passing suite as a failure is the cry-wolf problem
 * `test/boundaries.test.ts` already warns about, so the runner reads the tally
 * rather than trusting the exit code.
 *
 * **Deliberately narrow, because the failure mode of getting this wrong is a
 * masked defect.** All three must hold: the specific `onTaskUpdate` string, a
 * files tally that says passed, and **no** failure tally anywhere in the
 * output. Any real failure prints `N failed` and is reported as FAILED with the
 * exit code, whatever else went wrong alongside it.
 */
export const REPORTER_RPC_TIMEOUT = /Timeout calling "onTaskUpdate"/;
export const ALL_FILES_PASSED = /Test Files\s+\d+ passed \(\d+\)/;
export const ANY_FAILED = /\d+ failed/;

/**
 * The output with its colour taken off, which is what the three patterns above
 * are read against.
 *
 * **Without this the guard never fired in the one place it was written for.**
 * The legs are spawned onto pipes, and vitest colours a pipe anyway when `CI`
 * is set — tinyrainbow treats the variable as consent, the same way it treats
 * `FORCE_COLOR`. So in Actions the summary arrives as
 * `\x1b[2m Test Files \x1b[22m \x1b[1m\x1b[32m120 passed\x1b[39m\x1b[22m…`,
 * `ALL_FILES_PASSED` finds no `\s+` between the label and the count, and a
 * fully green leg was reported FAILED. Locally, with no `CI`, vitest emits
 * plain text and the same guard matched — which is exactly how a bug of this
 * shape survives being tested.
 *
 * Stripped rather than the patterns being loosened to tolerate escapes: a
 * pattern that steps over arbitrary control sequences is a pattern nobody can
 * read, and `ANY_FAILED` must keep meaning what it says.
 */
// eslint-disable-next-line no-control-regex -- stripping CSI sequences is the point
export const ANSI = /\x1b\[[0-9;]*m/g;
export const plain = (output) => output.replace(ANSI, '');

export function everyTestPassedAnyway(output) {
  const text = plain(output);
  return REPORTER_RPC_TIMEOUT.test(text) && ALL_FILES_PASSED.test(text) && !ANY_FAILED.test(text);
}

/** The tallies, for the note on a leg whose suite was green under a runner error. */
export function tally(output) {
  const text = plain(output);
  const files = /Test Files\s+(\d+) passed/.exec(text)?.[1];
  const tests = /Tests\s+(\d+) passed/.exec(text)?.[1];
  return files && tests ? `${files} files, ${tests} tests` : 'every test';
}
