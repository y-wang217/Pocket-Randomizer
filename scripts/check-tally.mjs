/**
 * Reading a vitest leg's own tally out of its output.
 *
 * Split out of `check.mjs` so `test/check-gate.test.ts` can exercise these
 * predicates directly. `check.mjs` ends in `process.exit(await main())`, a
 * top-level side effect, so a test that imported it would run the whole gate —
 * and an entry guard on `import.meta.url` is a worse seam than a module,
 * because getting the guard wrong means a test run recursively invokes the
 * nine-leg gate it is a part of. Nothing here has a side effect or reads a
 * global beyond `String` and `RegExp`.
 *
 * ## Vitest's reporter channel giving up while every test passed
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
 *
 * ## Why the output is stripped of colour before any of that is asked
 *
 * **The tolerance above shipped at section 33 and never fired once.** Vitest
 * colours through tinyrainbow, which enables colour when `CI` is in the
 * environment whether or not a TTY is attached — and `check.mjs` captures a
 * pipe, so every CI run has been coloured. The tally arrives as
 *
 *   \x1b[2m Test Files \x1b[22m \x1b[1m\x1b[32m23 passed\x1b[39m\x1b[22m\x1b[90m (24)\x1b[39m
 *
 * and the escapes sit exactly where `ALL_FILES_PASSED` expects whitespace, so
 * it cannot match. Run #9 on `main` failed the Node leg with every one of its
 * tests passing, which is the shape the tolerance exists to stop.
 *
 * Stripping happens **here, at the point of asking**, rather than in
 * `check.mjs`'s capture, for two reasons. `tail(output, 40)` prints a failing
 * leg's own output and GitHub Actions renders its colour, so a reader loses
 * nothing to a gate that strips only for matching. And stripping at capture
 * means stripping each chunk as it arrives, where an escape sequence that
 * straddles a chunk boundary survives — a stripper that works on the whole
 * string and not on a stream.
 *
 * `everyTestPassedAnyway` strips **once** and asks all three questions of that
 * one string, so the veto can never end up applied to different text from the
 * permission. Stripping cannot loosen the veto: coloured `1 failed` already
 * matches `ANY_FAILED`, because vitest wraps the token rather than splitting
 * it, and stripped it still does.
 */

// `no-control-regex` is in ESLint's recommended set, which `eslint.config.js`
// applies to every file, so the escape cannot be a literal in a regex here.
// `String` and `RegExp` are ES builtins; `Buffer` would be a `no-undef`, since
// `scripts/**/*.mjs` declares only `console` and `process` as globals.
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*[A-Za-z]', 'g');

/** The same text a terminal would show, with the colour commands removed. */
export const plain = (output) => output.replace(ANSI, '');

const REPORTER_RPC_TIMEOUT = /Timeout calling "onTaskUpdate"/;
const ALL_FILES_PASSED = /Test Files\s+\d+ passed \(\d+\)/;
const ANY_FAILED = /\d+ failed/;

export function everyTestPassedAnyway(output) {
  const text = plain(output);
  return REPORTER_RPC_TIMEOUT.test(text) && ALL_FILES_PASSED.test(text) && !ANY_FAILED.test(text);
}

/** The tallies, for the note on a leg that passed under a reporter timeout. */
export function tally(output) {
  const text = plain(output);
  const files = /Test Files\s+(\d+) passed/.exec(text)?.[1];
  const tests = /Tests\s+(\d+) passed/.exec(text)?.[1];
  return files && tests ? `${files} files, ${tests} tests` : 'every test';
}
