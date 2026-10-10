/**
 * No timer a DOM test file starts outlives that file's environment.
 *
 * A screen mounted in a test starts real timers (the scene's per-step replay,
 * the band, the overlay, the settings save) and most tests end without
 * cancelling them, because a test reads the screen and is done. When the file
 * finishes, jsdom is torn down and `document` goes with it; a timer that fires
 * after that throws `ReferenceError: document is not defined`, vitest counts
 * it as an unhandled error, and the leg exits 1 with every test passing. Run
 * 37928075949 failed `node suite` exactly so, from the replay's
 * `Timeout.draw` after `test/species-label.test.ts`.
 *
 * Whether one fires is a race between teardown and the worker exiting, so it
 * fails a run now and then and not at all locally. Counted rather than
 * guessed: nine of the eighteen files that mount a battle screen or scene end
 * with timers pending. Fixing those nine leaves the tenth to whoever writes
 * it, so the rule lives here, once.
 *
 * Only in a DOM environment: a Node file has no `document` to lose. The
 * originals are wrapped, not replaced, so a test that calls
 * `vi.useFakeTimers()` swaps these out and gets them back as usual. This
 * `afterAll` is registered before the file's own and so runs after them.
 * `docs/generation.md` section 127.
 */
import { afterAll } from 'vitest';

if (typeof document !== 'undefined') {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  const { setTimeout: set, clearTimeout: clear, setInterval: every, clearInterval: stop } = globalThis;

  globalThis.setTimeout = ((callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    const handle = set(
      (...fired: unknown[]) => {
        timeouts.delete(handle);
        callback(...fired);
      },
      ms,
      ...args,
    );
    timeouts.add(handle);
    return handle;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((handle?: ReturnType<typeof setTimeout>) => {
    if (handle !== undefined) timeouts.delete(handle);
    clear(handle);
  }) as typeof clearTimeout;
  globalThis.setInterval = ((callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    const handle = every(callback, ms, ...args);
    intervals.add(handle);
    return handle;
  }) as typeof setInterval;
  globalThis.clearInterval = ((handle?: ReturnType<typeof setInterval>) => {
    if (handle !== undefined) intervals.delete(handle);
    stop(handle);
  }) as typeof clearInterval;

  afterAll(() => {
    for (const handle of timeouts) clear(handle);
    for (const handle of intervals) stop(handle);
    timeouts.clear();
    intervals.clear();
  });
}
