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
const args = ['vitest', 'run', ...files, ...process.argv.slice(3)];
const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
child.on('error', (error) => {
  console.error(`vitest-split: could not start vitest — ${error.message}`);
  process.exit(1);
});
