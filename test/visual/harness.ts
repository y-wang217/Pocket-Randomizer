/**
 * A real browser for the visual identity assertions.
 *
 * The house rule is that DOM assertions belong in `scripts/smoke.mjs`, in a
 * real Chromium, because the questions are about computed style and layout at
 * a viewport size and jsdom has neither. The visual stages ask exactly those
 * questions and want them under `npm test`, so this builds the app into a
 * temporary directory once per test file, serves it, and hands the tests a
 * browser at the phone viewport. The same driver `scripts/visual/*.mjs` use,
 * so a test and a report screenshot are of the same run.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Browser } from 'playwright';
import { build } from 'vite';

import { ENGINE, launch, serve } from '../../scripts/visual/browser.mjs';

export type Engine = 'chromium' | 'webkit';

/**
 * Which engine this process is driving. **The iOS animations patch.**
 *
 * Re-exported from `scripts/visual/browser.mjs` so a test can say something
 * engine-specific without importing the driver, and so `skipOn` below has one
 * value to compare against.
 */
export const engine: Engine = ENGINE as Engine;

/**
 * Decline a test on one engine, with the reason in the title. **The iOS patch.**
 *
 * The patch that added the second engine also added the rule that a test which
 * cannot run on both says which one and why, rather than disappearing behind a
 * bare `skip`. The reason is concatenated into the test name, so a skipped case
 * reports its own cause in the runner output instead of needing the file open
 * beside it.
 *
 * It is for a test that is *asking a different question* on the other engine —
 * a pixel measurement against a Chromium-recorded baseline is the whole of the
 * current population — never for one that is merely failing.
 */
export function skipOn(which: Engine, reason: string): { skip: boolean; why: string } {
  return { skip: engine === which, why: `[${which}: ${reason}]` };
}

/**
 * Decline a pinned-height assertion where the recording does not apply.
 *
 * **`heights.json` is a recording of one machine's fonts, and nothing in this
 * repo makes it portable.** `tokens.css` sets the whole UI in a system stack —
 * `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace` — with
 * no `@font-face` and no font file shipped, so what a screen measures depends
 * on which fonts the box happens to have. Every number in `heights.json` was
 * produced on a box whose `monospace` resolves one particular way.
 *
 * The first CI run proved it the expensive way: in the Playwright container the
 * map screen measures 897.22 against a recorded 944.5 and the document 1090
 * against 1138. That is a ~47px difference, forty-seven times the tolerance the
 * WebKit branch below allows, and **it is not a layout regression** — it is the
 * same layout in a different typeface.
 *
 * So the four height assertions are scoped to where their recording means
 * something, rather than left to fail in a place it never did. They are still a
 * hard gate locally and before a merge, which is where a real height regression
 * is introduced and caught.
 *
 * **The alternative was considered and rejected for now:** shipping a webfont
 * would make the baseline portable and CI-gateable, and it is the real fix. It
 * also moves every recorded number and forces a full re-record, which is a
 * decision about the product's typography rather than about its CI, and is
 * recorded as an open item instead of taken quietly here. Re-recording against
 * the container was never on the table: that replaces a Chromium regression
 * guard with a picture of the container's font set.
 */
export function skipWhereRecordingDoesNotApply(): { skip: boolean; why: string } {
  return {
    skip: Boolean(process.env.CI),
    why: "[CI: heights.json records one machine's system font stack; see test/visual/harness.ts]",
  };
}

/**
 * Compare a measured guarded-screen block against `docs/visual/baseline/`.
 *
 * **Exact on Chromium, within a pixel on WebKit, and the asymmetry is the
 * honest reading rather than a concession.** `heights.json` is a recording, and
 * what it records is a layout as laid out by one engine: every number in it was
 * produced by the pinned Chromium. WebKit's text metrics round differently — the
 * map screen comes out 944.36 against a recorded 944.5 — so `toEqual` on the
 * WebKit leg is not asking "did this layout regress", it is asking "is this
 * Chromium", to which the answer is no and always will be.
 *
 * Re-recording a second baseline was the alternative and is worse: two files
 * that must be regenerated together, and a real regression on one engine hiding
 * behind a re-record of the other. A tolerance keeps **one** recording and
 * still gates WebKit on the thing the baseline exists for — a layout that moved
 * by an amount a person could see. 1px is well inside that and well outside
 * rasterisation.
 */
export function expectBaselineHeights(
  measured: object,
  expected: object,
  expect: (actual: unknown, message?: string) => { toEqual(value: unknown): void; toBeCloseTo(value: number, digits: number): void },
): void {
  if (engine === 'chromium') {
    expect(measured).toEqual(expected);
    return;
  }
  for (const [key, value] of Object.entries(expected as Record<string, unknown>)) {
    const got = (measured as Record<string, number | null>)[key];
    if (typeof value !== 'number') {
      expect(got, `${key} [webkit: compared against a Chromium-recorded baseline]`).toEqual(value);
      continue;
    }
    // `toBeCloseTo(v, 0)` is |difference| < 0.5; a whole pixel is the line.
    expect(
      Math.abs((got ?? Number.NaN) - value) <= 1,
      `${key}: ${String(got)} is more than a pixel from the recorded ${value} [webkit: heights.json is a Chromium recording, so the engines are compared within a pixel rather than exactly]`,
    ).toEqual(true);
  }
}

export interface Harness {
  url: string;
  browser: Browser;
  /** The engine this harness launched, for a test that has to name it. */
  engine: Engine;
  close(): Promise<void>;
}

/**
 * `gallery: true` builds `gallery.html` (src/ui/gallery.ts) instead of the
 * app: one screen, one seed, rendered from a scripted run, for the states the
 * smoke bot cannot reach on demand.
 */
export async function openHarness(options: { gallery?: boolean } = {}): Promise<Harness> {
  const out = mkdtempSync(join(tmpdir(), 'gymrun-visual-'));
  await build({
    configFile: join(process.cwd(), options.gallery ? 'vite.gallery.config.ts' : 'vite.config.ts'),
    logLevel: 'silent',
    build: { outDir: out, emptyOutDir: true, sourcemap: false, reportCompressedSize: false },
  });
  const server = await serve(out);
  const browser = await launch();
  return {
    url: server.url,
    browser,
    engine,
    async close() {
      await browser.close();
      server.close();
      rmSync(out, { recursive: true, force: true });
    },
  };
}
