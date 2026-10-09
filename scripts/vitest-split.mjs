/**
 * Run one half of the suite: the Node-only files, or the browser ones.
 *
 *   node scripts/vitest-split.mjs node      # 111 files, no browser needed
 *   node scripts/vitest-split.mjs browser   # 24 files, needs GYMRUN_ENGINE's engine
 *
 * The halves are named explicitly on the command line rather than by narrowing
 * `vite.config.ts`, so `npm test` keeps meaning the whole suite and every
 * number any report in `docs/` has ever recorded against a plain `vitest run`
 * still means what it said.
 *
 * Which files are in which half is `scripts/browser-tests.mjs`'s job, and it
 * computes the answer instead of storing it. Nothing here has an opinion.
 */
import { spawn } from 'node:child_process';

import { browserTests, nodeTests } from './browser-tests.mjs';

const half = process.argv[2];
if (half !== 'node' && half !== 'browser') {
  console.error('usage: node scripts/vitest-split.mjs <node|browser>');
  process.exit(2);
}

const files = half === 'browser' ? browserTests() : nodeTests();
if (files.length === 0) {
  console.error(`vitest-split: no ${half} test files found — is the working directory the repo root?`);
  process.exit(2);
}

/*
 * The files are passed as positional filters, not as `--exclude` patterns.
 *
 * Both express the same set today, but a positional list is the one that
 * cannot go quietly wrong: vitest treats a positional as a filter and an
 * unmatched one narrows the run to nothing, which is visible, whereas a
 * mistyped `--exclude` pattern silently excludes nothing and the "Node-only"
 * leg would run the browser files after all.
 */
/*
 * The fork cap, in CI, on the browser half only.
 *
 * The runner is a standard GitHub-hosted `ubuntu-latest`, four vCPUs at the
 * time of writing; `scripts/check.mjs` prints the count it saw in its header
 * line. Uncapped, vitest 3 sizes a non-watch pool at
 * `max(availableParallelism() - 1, 1)`, three forks there.
 *
 * **The browser half** found its own load symptom on that runner (the browser
 * suite CI patch, `docs/spec/gymrun-patch-browser-suite-ci.md`): three forks
 * each driving a Chromium, and `visual-move-cards` walking 900 steps without
 * reaching the result screen because a saturated machine had not painted it
 * yet. The walk is state-based now (`scripts/visual/browser.mjs`, `settle`),
 * which is the fix; the cap is the second half, which is to stop provoking it.
 * Two forks, each a Node process plus a browser, on four cores. WebKit
 * inherits it because it runs the same half through the same command.
 *
 * **The Node half is not capped.** It was, from section 47 to section 127 of
 * `docs/generation.md`, on the reading that vitest's `onTaskUpdate` timeout
 * was contention. Section 126 found one test holding its worker's event loop
 * past 60s instead; it reproduces on an idle box, and the cap never stopped
 * it. With that test fixed the Node half takes vitest's default pool.
 *
 * **CI only**, because a developer box is not the contended machine.
 */
const CI_BROWSER_MAX_FORKS = 2;
const extra = process.argv.slice(3);
/*
 * Withheld when the caller names the flag themselves, rather than passed and
 * left to lose a fight it would not have won: vitest's argument parser collects
 * a repeated flag into an *array*, so `--maxWorkers=2 --maxWorkers=1` is not
 * "the last one wins", it is a pool size of `[2, 1]`. A measurement run that
 * wants a different number has to be able to ask for one.
 */
const capped = half === 'browser' && process.env.CI && !extra.some((arg) => arg.startsWith('--maxWorkers'));
const cap = capped ? [`--maxWorkers=${CI_BROWSER_MAX_FORKS}`] : [];

const args = ['vitest', 'run', ...cap, ...files, ...extra];
const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
child.on('error', (error) => {
  console.error(`vitest-split: could not start vitest — ${error.message}`);
  process.exit(1);
});
