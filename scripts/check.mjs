/**
 * The gate, as nine legs that all run.
 *
 *   node scripts/check.mjs                     # every leg, table at the end
 *   node scripts/check.mjs --list              # what the legs are, run nothing
 *   node scripts/check.mjs --only=lint,build   # just those, same reporting
 *
 * ## Why this is not an `&&` chain
 *
 * It used to be one:
 *
 *   npm run lint && tsc --noEmit && vitest run && npm run test:webkit && npm run test:trim-strict
 *
 * A chain reports the *first* thing that broke and nothing about the rest, so
 * the answer to "is the tree green" costs one round trip per failure. This
 * project has the receipts: `docs/visual/reports/patch-idle-sprites-and-locale-motion.md`
 * records a reporter timeout in the third leg that made the chain "stop before
 * the strict-trim step, which was run on its own", and `scripts/visual/gate.sh`
 * carries a comment about its own first version printing "gate green" over two
 * failing files because a `cmd | tail` pipeline reported tail's status.
 *
 * So every leg runs, always, and the table at the end is the whole truth.
 * `--list` exists because a leg table nobody can read without running it is
 * how a gate acquires a leg nobody knows about.
 *
 * ## The four statuses
 *
 * PASS and FAILED are the exit status of the leg's own process, taken directly.
 *
 * ERRORED is a leg whose **tests all passed and whose runner then fell over on
 * the way to saying so** — today that is exactly one thing, vitest's reporter
 * RPC timing out, and `everyTestPassedAnyway` below is where the shape of it
 * is argued. It is its own word rather than PASS because the two are not the
 * same fact and the table is the place that difference is legible: a reader
 * scanning for "is the tree green" gets a yes, and a reader asking "why did
 * that leg take four minutes and print an unhandled error" gets a word to
 * search for. It does not fail the run.
 *
 * SKIPPED is for a leg that never ran, and there are exactly two reasons:
 *
 *   1. **No browser binary.** Three of the nine legs need Playwright to
 *      launch. A contributor without WebKit installed should still be able to
 *      run the gate and get a useful answer about everything else, so a
 *      missing binary is SKIPPED locally. In CI it is FAILED — an engine the
 *      workflow is supposed to install and did not is a broken workflow, and
 *      `docs/README.md` already holds the rule this is a case of: a known-good
 *      engine reported as unverified is the failure, not the absence.
 *   2. **A dependency failed.** `smoke` serves `dist/`, so it cannot run when
 *      `build` did not produce one.
 *
 * **Only reason 1 is promoted by `CI`.** A dependency skip is not promoted,
 * because the leg it depended on already reported FAILED and the run already
 * exits 1: promoting it would print two failures for one cause and send the
 * reader looking for a second bug.
 *
 * ## The guard that makes the skip safe
 *
 * A missing-browser skip is only honoured on a leg declared `browser: true`.
 * If `scripts/browser-tests.mjs` ever fails to spot a browser test, that test
 * lands in the Node leg, hits the same Playwright error — and **fails**,
 * because the Node leg is not allowed to skip for that reason. A gate whose
 * detection bug turns into a silent skip is worse than no gate; this one turns
 * into a red leg with Playwright's own message under it.
 */
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';

import { browserTests, nodeTests } from './browser-tests.mjs';

const CI = Boolean(process.env.CI);
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const NODE = process.execPath;

/**
 * The nine legs, in run order.
 *
 * Seven are the old chain's five, with the two full-suite legs split into a
 * Node half and a browser half so a missing engine cannot take 1595 Node tests
 * with it. The last two — `build` and `smoke` — are absolute gates named in
 * `CLAUDE.md` that the chain never ran; `npm run check` claimed to be the gate
 * and was two legs short of the list.
 *
 * `build` runs `vite build` rather than `npm run build`, which is
 * `tsc --noEmit && vite build`: the type check is already leg 2, and a gate
 * that runs it twice spends a minute proving the same thing.
 */
const LEGS = [
  {
    name: 'lint',
    what: 'eslint .',
    command: NPX,
    args: ['eslint', '.'],
  },
  {
    name: 'typecheck',
    what: 'tsc --noEmit',
    command: NPX,
    args: ['tsc', '--noEmit'],
  },
  {
    name: 'test:node',
    what: `vitest, ${nodeTests().length} files, no browser`,
    command: NODE,
    args: ['scripts/vitest-split.mjs', 'node'],
  },
  {
    name: 'test:chromium',
    what: `vitest, ${browserTests().length} files, chromium`,
    command: NODE,
    args: ['scripts/vitest-split.mjs', 'browser'],
    env: { GYMRUN_ENGINE: 'chromium' },
    browser: true,
  },
  {
    name: 'test:webkit',
    what: `vitest, ${browserTests().length} files, webkit`,
    command: NODE,
    args: ['scripts/vitest-split.mjs', 'browser'],
    env: { GYMRUN_ENGINE: 'webkit' },
    browser: true,
  },
  {
    name: 'trim:node',
    what: 'strict trim, node half',
    command: NODE,
    args: ['scripts/vitest-split.mjs', 'node'],
    env: { GYMRUN_TRIM_STRICT: '1' },
  },
  {
    name: 'trim:browser',
    what: 'strict trim, chromium half',
    command: NODE,
    args: ['scripts/vitest-split.mjs', 'browser'],
    env: { GYMRUN_TRIM_STRICT: '1', GYMRUN_ENGINE: 'chromium' },
    browser: true,
  },
  {
    name: 'build',
    what: 'vite build',
    command: NPX,
    args: ['vite', 'build'],
  },
  {
    name: 'smoke',
    what: 'scripts/smoke.mjs against dist/',
    command: NODE,
    args: ['scripts/smoke.mjs'],
    needs: 'build',
    browser: true,
  },
];

/**
 * Playwright's own words when the engine is not on the box.
 *
 * Taken from the real message rather than paraphrased — on this container the
 * WebKit leg says `browserType.launch: Executable doesn't exist at
 * /opt/pw-browsers/webkit-2359/pw_run.sh` followed by the install banner.
 *
 * The host-dependencies line is here for the same reason: a browser that
 * cannot start for want of a system library is just as absent as one that is
 * not installed, and the remedy is the same `--with-deps` install.
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
const REPORTER_RPC_TIMEOUT = /Timeout calling "onTaskUpdate"/;
const ALL_FILES_PASSED = /Test Files\s+\d+ passed \(\d+\)/;
const ANY_FAILED = /\d+ failed/;

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
const ANSI = /\x1b\[[0-9;]*m/g;
const plain = (output) => output.replace(ANSI, '');

function everyTestPassedAnyway(output) {
  const text = plain(output);
  return REPORTER_RPC_TIMEOUT.test(text) && ALL_FILES_PASSED.test(text) && !ANY_FAILED.test(text);
}

/** The tallies, for the note on a leg whose suite was green under a runner error. */
function tally(output) {
  const text = plain(output);
  const files = /Test Files\s+(\d+) passed/.exec(text)?.[1];
  const tests = /Tests\s+(\d+) passed/.exec(text)?.[1];
  return files && tests ? `${files} files, ${tests} tests` : 'every test';
}

/** A leg that did not fail: PASS, or a green suite under a runner error. */
const isGreen = (status) => status === 'PASS' || status === 'ERRORED';

const NO_BROWSER = [
  /Executable doesn't exist at/,
  /Please run the following command to download new browsers/,
  /npx playwright install/,
  /Host system is missing dependencies/,
];

/**
 * Run a leg, capturing both streams. Nothing is printed while it runs.
 *
 * Captured as decoded strings rather than buffers: `eslint.config.js` declares
 * exactly `console` and `process` as globals for `scripts/**\/*.mjs`, so
 * `Buffer` here would be a `no-undef` — and a gate runner that fails the gate's
 * own lint leg is not a good joke to leave in the tree.
 *
 * A leg's output is held rather than streamed so the table is readable: nine
 * legs interleaving vitest reporters is the output the old chain gave, and the
 * failing leg's tail is what a reader actually needs.
 */
function runLeg(leg) {
  return new Promise((resolve) => {
    const started = Date.now();
    let output = '';
    const child = spawn(leg.command, leg.args, {
      env: { ...process.env, ...(leg.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.on('data', (data) => {
      output += data;
    });
    child.on('error', (error) => {
      output += `\ncheck: could not start ${leg.name} — ${error.message}\n`;
      resolve({ code: 1, output, ms: Date.now() - started });
    });
    child.on('close', (code, signal) => {
      resolve({ code: signal ? 1 : (code ?? 1), output, ms: Date.now() - started });
    });
  });
}

const tail = (text, lines) => text.trimEnd().split('\n').slice(-lines).join('\n');
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

/**
 * `--only=a,b` narrows the run to those legs, in the declared order.
 *
 * Two things want it. A CI workflow that puts the legs in separate jobs needs
 * to name one per job and still get this runner's reporting rather than a bare
 * `&&`. And the FAIL and SKIPPED branches below are otherwise unreachable in
 * under twenty minutes, which is the same as saying they were untested: the
 * missing-browser skip, the `CI` promotion and the dependency skip were each
 * exercised through this flag before this file was committed.
 *
 * A dependency outside the selection is treated as satisfied, not as a skip.
 * `--only=smoke` in a job that built in an earlier step is a legitimate thing
 * to ask for, and this runner has no way to know whether it did.
 */
function selected() {
  const flag = process.argv.find((arg) => arg.startsWith('--only='));
  if (!flag) return LEGS;
  const wanted = new Set(
    flag
      .slice('--only='.length)
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  const unknown = [...wanted].filter((name) => !LEGS.some((leg) => leg.name === name));
  if (unknown.length) {
    console.error(`check: no such leg: ${unknown.join(', ')}`);
    console.error(`check: legs are ${LEGS.map((leg) => leg.name).join(', ')}`);
    process.exit(2);
  }
  return LEGS.filter((leg) => wanted.has(leg.name));
}

async function main() {
  if (process.argv.includes('--list')) {
    for (const leg of LEGS) {
      const marks = [leg.browser ? 'browser' : null, leg.needs ? `needs ${leg.needs}` : null].filter(Boolean);
      console.log(`${leg.name.padEnd(14)} ${leg.what}${marks.length ? `  [${marks.join(', ')}]` : ''}`);
    }
    return 0;
  }

  const legs = selected();
  // The core count is printed rather than assumed: it is what vitest sizes its
  // fork pool from, and it is the first number anybody debugging a runner error
  // on a machine they cannot log into will want.
  console.log(
    `check: ${legs.length} leg${legs.length === 1 ? '' : 's'}, CI=${CI ? 'yes' : 'no'}, ${availableParallelism()} cores\n`,
  );
  const results = [];

  for (const leg of legs) {
    // A leg whose dependency did not pass never starts. Not promoted by CI:
    // the dependency is already FAILED and already fails the run.
    const needed = leg.needs && legs.some((other) => other.name === leg.needs)
      ? results.find((r) => r.name === leg.needs)
      : null;
    if (needed && !isGreen(needed.status)) {
      console.log(`-- ${leg.name}: SKIPPED (${leg.needs} did not pass)`);
      results.push({ name: leg.name, status: 'SKIPPED', ms: 0, note: `${leg.needs} did not pass` });
      continue;
    }

    process.stdout.write(`== ${leg.name} (${leg.what})\n`);
    const { code, output, ms } = await runLeg(leg);

    if (code === 0) {
      console.log(`   PASS in ${seconds(ms)}`);
      results.push({ name: leg.name, status: 'PASS', ms });
      continue;
    }

    /*
     * Every test passed and vitest's reporter channel timed out on the way to
     * saying so. ERRORED rather than FAILED, because no test failed; ERRORED
     * rather than PASS, because something did go wrong and the table is where
     * a reader should be able to see which of the two it was. It does not fail
     * the run. See `everyTestPassedAnyway` for why this cannot swallow a real
     * failure, and the four-statuses note at the top for why it is its own word.
     */
    if (everyTestPassedAnyway(output)) {
      console.log(`   ERRORED in ${seconds(ms)} — ${tally(output)} passed; vitest's reporter RPC timed out`);
      results.push({ name: leg.name, status: 'ERRORED', ms, note: 'reporter RPC timed out; suite green' });
      continue;
    }

    /*
     * The guard. `leg.browser` is the whole of what makes this reachable, so a
     * Node leg that meets the same message fails on it — which is what should
     * happen if the browser-test detection ever misses a file.
     */
    if (leg.browser && NO_BROWSER.some((pattern) => pattern.test(output))) {
      const note = 'no browser binary';
      if (CI) {
        console.log(`   FAILED in ${seconds(ms)} — ${note}, promoted because CI is set`);
        console.log(tail(output, 20));
        results.push({ name: leg.name, status: 'FAILED', ms, note: `${note} (promoted by CI)`, output });
      } else {
        console.log(`   SKIPPED — ${note}. \`npx playwright install --with-deps\` installs it.`);
        results.push({ name: leg.name, status: 'SKIPPED', ms, note });
      }
      continue;
    }

    console.log(`   FAILED in ${seconds(ms)}`);
    console.log(tail(output, 40));
    results.push({ name: leg.name, status: 'FAILED', ms, output });
  }

  // The table. Widths from the content, so a renamed leg cannot break it.
  const width = Math.max(...results.map((r) => r.name.length), 4);
  console.log(`\n${'leg'.padEnd(width)}  status   time     note`);
  console.log(`${'-'.repeat(width)}  -------  -------  ----`);
  for (const r of results) {
    console.log(`${r.name.padEnd(width)}  ${r.status.padEnd(7)}  ${seconds(r.ms).padStart(7)}  ${r.note ?? ''}`.trimEnd());
  }

  const failed = results.filter((r) => r.status === 'FAILED');
  const skipped = results.filter((r) => r.status === 'SKIPPED');
  const errored = results.filter((r) => r.status === 'ERRORED');
  console.log(
    `\n${results.filter((r) => r.status === 'PASS').length} passed, ${failed.length} failed, ${skipped.length} skipped, ${errored.length} runner error${errored.length === 1 ? '' : 's'}`,
  );
  if (failed.length) console.log(`check: FAILED — ${failed.map((r) => r.name).join(', ')}`);
  else if (errored.length) {
    console.log(
      `check: green, every test passed — ${errored.length} leg(s) hit a runner error: ${errored.map((r) => r.name).join(', ')}`,
    );
  } else if (skipped.length) console.log(`check: green, ${skipped.length} leg(s) skipped — not a full gate`);
  else console.log('check: green');

  return failed.length ? 1 : 0;
}

process.exit(await main());
