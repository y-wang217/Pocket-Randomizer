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
 * The fork cap, in CI, on both halves.
 *
 * ## What it is fixing
 *
 * `[vitest-worker]: Timeout calling "onTaskUpdate"` — vitest's reporter RPC
 * giving up while every test passes. `docs/generation.md` sections 15, 33 and
 * 36 all record it, and on Actions it took the Node half of the gate red with
 * `1650 passed (1650)` printed directly underneath. `scripts/check.mjs` now
 * reports that as ERRORED rather than FAILED, which stops the gate lying; this
 * is the other half, which is to stop provoking it.
 *
 * ## Why capping workers is the lever
 *
 * The runner is a standard GitHub-hosted `ubuntu-latest`, which is four vCPUs
 * at the time of writing — `scripts/check.mjs` prints the count it actually saw
 * in its header line, so the number is read off the run rather than trusted
 * from here. Nothing in
 * `vite.config.ts` sets `pool`, `poolOptions`, `maxWorkers` or `minWorkers`, so
 * vitest 3's defaults apply: `pool: 'forks'`, and a non-watch run sizes the
 * pool at `max(availableParallelism() - 1, 1)` — three forks, each a full Node
 * process replaying runs, on four cores that are also carrying the parent, the
 * reporter and the Vite transform. The timeout is that reporter channel not
 * being scheduled in time, so it is a contention symptom: it tracks load and
 * not outcome, which is exactly what every recorded sighting of it has said.
 *
 * Two forks leaves a core for the parent. It costs wall-clock on a leg that is
 * already the long pole, and that is the trade being made deliberately: a slower
 * green leg is worth more than a fast one nobody can read.
 *
 * ## Why only in CI, and why both halves now
 *
 * **CI only**, because a developer box is not the contended machine and has no
 * reason to give up a third of its parallelism.
 *
 * **The Node half first**, because that is where the error had been seen, and
 * the browser halves were left byte-identical rather than retuned alongside a
 * fix for something they had not reported, with the rule that if they started
 * carrying it they would get their own measurement. **They did.** The browser
 * suite CI patch (`docs/spec/gymrun-patch-browser-suite-ci.md`) found the
 * browser half's own load symptom on the same runner: three forks each driving
 * a Chromium, and `visual-move-cards` walking 900 steps without reaching the
 * result screen because a saturated machine had not painted it yet. The walk
 * is state-based now (`scripts/visual/browser.mjs`, `settle`), which is the
 * fix; this is the same second half the Node cap was, which is to stop
 * provoking it. Two forks, each a Node process plus a browser, on four cores.
 * WebKit inherits it because it runs the same half through the same command.
 */
const CI_NODE_MAX_FORKS = 2;
const CI_BROWSER_MAX_FORKS = 2;
const extra = process.argv.slice(3);
/*
 * Withheld when the caller names the flag themselves, rather than passed and
 * left to lose a fight it would not have won: vitest's argument parser collects
 * a repeated flag into an *array*, so `--maxWorkers=2 --maxWorkers=1` is not
 * "the last one wins", it is a pool size of `[2, 1]`. A measurement run that
 * wants a different number has to be able to ask for one.
 */
const capped = process.env.CI && !extra.some((arg) => arg.startsWith('--maxWorkers'));
const cap = capped ? [`--maxWorkers=${half === 'node' ? CI_NODE_MAX_FORKS : CI_BROWSER_MAX_FORKS}`] : [];

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
