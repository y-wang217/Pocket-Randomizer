/**
 * Which test files need a real browser, computed rather than listed.
 *
 * `npm run check` splits the suite so that a box without a Playwright browser
 * still gates the Node-only half — 111 files and 1595 tests as of this patch,
 * which under the old `&&` chain went unverified the moment a browser was
 * missing, because `vite.config.ts` includes `test/**\/*.test.ts` and has no
 * engine filter.
 *
 * **A hand-written list is the wrong shape for that split.** It is a second
 * place to remember, and the failure mode when it is forgotten is silent: a
 * new browser test lands in the Node half, dies on a missing binary, and the
 * runner cannot tell that from the browser legs' own missing-binary skip. So
 * the list is derived from the one fact that actually makes a test need a
 * browser — that it reaches Playwright, either directly or through the visual
 * harness that wraps it.
 *
 * `scripts/check.mjs` closes the remaining hole from the other side: a
 * missing-browser skip is only ever honoured on a leg declared as a browser
 * leg, so if this detection ever misses a file, the Node leg **fails** on it
 * rather than skipping. Loud beats silent; that is the whole reason the
 * `&&` chain was replaced.
 */
import { readdirSync, readFileSync } from 'node:fs';

const TEST_DIR = 'test';

/**
 * The three ways a file in `test/` reaches a browser.
 *
 * `visual/harness` is how all 21 browser-dependent `visual-*` files and the
 * three named browser files get one (it builds the app, serves it and launches
 * the engine). `visual/browser` is the driver underneath it, which a test may
 * import directly for `ENGINE`, `PHONE` or `playUntil`. A bare `playwright`
 * import is the third, for a test that drives the library itself.
 *
 * Deliberately not a match on the filename. `test/visual-baseline.test.ts`,
 * `test/visual-locales.test.ts` and `test/visual-tokens.test.ts` are named
 * `visual-*` and need no browser at all — one replays runs headless, one is
 * jsdom, one is a CSS grep — and the pre-patch `test:browser` glob swept all
 * three into the WebKit leg, where `GYMRUN_ENGINE` means nothing to them.
 */
const REACHES_A_BROWSER = [/visual\/harness/, /visual\/browser/, /from\s+['"]playwright['"]/];

/** Every test file, sorted, as repo-relative paths with forward slashes. */
export function allTests() {
  return readdirSync(TEST_DIR)
    .filter((name) => name.endsWith('.test.ts'))
    .sort()
    .map((name) => `${TEST_DIR}/${name}`);
}

/** The files that need a browser. */
export function browserTests() {
  return allTests().filter((path) => {
    const source = readFileSync(path, 'utf8');
    return REACHES_A_BROWSER.some((pattern) => pattern.test(source));
  });
}

/** The files that do not. */
export function nodeTests() {
  const browser = new Set(browserTests());
  return allTests().filter((path) => !browser.has(path));
}
