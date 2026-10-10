/**
 * The worker's event loop turns before every test.
 *
 * Vitest gives each reporter RPC call 60s for its reply, and reads the reply
 * only when the worker's event loop turns. It does not turn the loop between
 * tests: a run of synchronous tests is one unbroken stretch, however short
 * each test is. `core/` has no timers, so a file of `playRun` tests is exactly
 * that, and the stretch is the file's, not the slowest test's. Measured under
 * strict trim on a four-core box: `economy` 48s, `locales` 48s,
 * `nicknames-graveyard` 42s, `defender-economy` 32s, none with a single test
 * over 16s. On a slower runner one crossed 60s, and the leg failed with every
 * test passing (PR 109's first strict-trim run).
 *
 * One `setImmediate` per test lets the reply in. The longest stretch is then
 * the slowest single test, and the two quadratic resume sweeps
 * (`test/party.test.ts`, `test/run-replay.test.ts`) yield per resume as well.
 * The reference is taken at load, so a file that fakes `setImmediate` does not
 * stall here. `docs/generation.md` sections 126 and 127c.
 */
import { beforeEach } from 'vitest';

const turn = globalThis.setImmediate;

beforeEach(() => new Promise<void>((resolve) => turn(() => resolve())));
