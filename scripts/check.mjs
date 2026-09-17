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
 * ## The three statuses
 *
 * PASS and FAIL are the exit status of the leg's own process, taken directly.
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
  console.log(`check: ${legs.length} leg${legs.length === 1 ? '' : 's'}, CI=${CI ? 'yes' : 'no'}\n`);
  const results = [];

  for (const leg of legs) {
    // A leg whose dependency did not pass never starts. Not promoted by CI:
    // the dependency is already FAILED and already fails the run.
    const needed = leg.needs && legs.some((other) => other.name === leg.needs)
      ? results.find((r) => r.name === leg.needs)
      : null;
    if (needed && needed.status !== 'PASS') {
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
  console.log(
    `\n${results.filter((r) => r.status === 'PASS').length} passed, ${failed.length} failed, ${skipped.length} skipped`,
  );
  if (failed.length) console.log(`check: FAILED — ${failed.map((r) => r.name).join(', ')}`);
  else if (skipped.length) console.log(`check: green, ${skipped.length} leg(s) skipped — not a full gate`);
  else console.log('check: green');

  return failed.length ? 1 : 0;
}

process.exit(await main());
