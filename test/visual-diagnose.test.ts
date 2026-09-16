/**
 * The on-device diagnostic, gated.
 *
 * ## Why this file exists
 *
 * `public/diagnose.html` is the instrument the iOS animations patch concluded
 * it needed and did not ship. It is the only thing in this repository whose
 * whole purpose is to run somewhere the suite cannot reach, so it is also the
 * only thing here that could rot completely without a single test going red —
 * and the last attempt at it reached a handoff describing a file that was never
 * committed. A tool nothing holds is a tool that is not there.
 *
 * So what can be checked from here, is. The instrument's correctness on the
 * device is not testable; its correctness **as an instrument** is, and that is
 * the part that decides whether its output can be trusted at all:
 *
 * 1. **A healthy engine must report healthy.** This is the failure mode that
 *    makes a diagnostic worse than useless, and the first build of this page
 *    had it — the `calc()` discriminator reused one element between its three
 *    cases and re-assigned the `id`, so nothing restarted, and it called
 *    desktop Chromium a broken engine. A false headline sends the reader to fix
 *    something that is not broken.
 * 2. **Reduce Motion must be identified as Reduce Motion**, not reported as
 *    twelve dead animations. It is the one configuration that reproduces the
 *    whole reported symptom, and the instrument exists largely to rule it in or
 *    out on the first screen.
 * 3. **The page must stay standalone.** It has to run on a device where the
 *    app's stylesheet or entry script is what is broken, so it may not depend
 *    on either at parse time. That is a property of the file, and a file is
 *    exactly the sort of thing that acquires an import by accident.
 *
 * Both engines, like every other browser file here: `npm run check` runs
 * Chromium and then WebKit and both gate.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { contextFor, PHONE } from '../scripts/visual/browser.mjs';
import { engine, openHarness, type Harness } from './visual/harness';

let harness: Harness;

beforeAll(async () => {
  harness = await openHarness();
}, 180_000);

afterAll(async () => {
  await harness?.close();
});

interface Report {
  /** `ok`, `warn` or `bad` — the verdict banner's own reading of itself. */
  state: string | null;
  /** The headline sentence. */
  head: string;
  /** The full plain-text report, exactly what the copy button hands over. */
  text: string;
}

/**
 * Open the diagnostic and wait for it to reach a verdict.
 *
 * The page is served out of the same built directory the app is, because that
 * is how it ships: Vite copies `public/` into `dist/` verbatim, so the file
 * under test here is byte-for-byte the file that deploys.
 *
 * `reducedMotion` is a context option rather than something the page can be
 * told, which is the point — the instrument has to read the real media query,
 * and emulating it at the context is the only way to ask whether it does.
 */
async function openDiagnostic(
  browser: Browser,
  url: string,
  reduced: boolean,
): Promise<{ page: Page; context: BrowserContext; report: Report; errors: string[] }> {
  const context = await browser.newContext({
    ...contextFor(PHONE, browser.browserType().name()),
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(`${url}/diagnose.html`, { waitUntil: 'load' });
  // The verdict's `data-state` is set once and only at the end of the run, so
  // it is the page's own "I finished" and there is nothing to time here.
  await page.waitForFunction(() => document.getElementById('dg-verdict')?.getAttribute('data-state'), {
    timeout: 45_000,
  });

  const report = await page.evaluate(() => ({
    state: document.getElementById('dg-verdict')?.getAttribute('data-state') ?? null,
    head: document.querySelector('#dg-verdict strong')?.textContent ?? '',
    text: document.getElementById('dg-text')?.textContent ?? '',
  }));

  return { page, context, report, errors };
}

describe(`the on-device diagnostic on ${engine}`, () => {
  it('reports a healthy engine as healthy', async () => {
    const { context, report, errors } = await openDiagnostic(harness.browser, harness.url, false);
    try {
      expect(errors, `the diagnostic logged errors on ${engine}`).toEqual([]);
      expect(report.state, `no verdict was reached on ${engine}`).not.toBeNull();

      /*
       * The headline assertion, and the reason the file exists. Both engines in
       * this harness are known-good — `test/visual-motion.test.ts` asserts all
       * twelve beats move on each — so an instrument that calls either of them
       * broken is wrong about the only thing it is for.
       */
      expect(
        report.state,
        `the diagnostic called a known-good ${engine} broken:\n${report.head}\n\n${report.text}`,
      ).not.toBe('bad');
      expect(report.head).not.toMatch(/Reduce Motion is ON/);

      expect(report.text, `not every beat was reported as moving on ${engine}`).toContain(
        'beats that moved: 12 of 12',
      );
      expect(report.text, `a stage keyframe was reported missing on ${engine}`).not.toMatch(
        /@keyframes \S+: MISSING/,
      );
      expect(report.text, `a motion token was reported unresolved on ${engine}`).not.toContain(
        'EMPTY — unresolved',
      );

      /*
       * The three `calc()` cases, each of which must move on a healthy engine.
       * Asserted individually rather than as "none say STATIC", so a regression
       * that drops a case entirely — which is what the shared-element bug did —
       * fails here rather than passing on an absence.
       */
      for (const probe of [
        'a literal duration (control)',
        'a plain var() duration (control)',
        'calc() through a custom property',
      ]) {
        expect(report.text, `the ${probe} probe did not move on a healthy ${engine}`).toContain(`${probe}: MOVES`);
      }
    } finally {
      await context.close();
    }
  }, 120_000);

  it('names Reduce Motion rather than reporting twelve dead animations', async () => {
    const { context, report, errors } = await openDiagnostic(harness.browser, harness.url, true);
    try {
      expect(errors, `the diagnostic logged errors under reduced motion on ${engine}`).toEqual([]);
      expect(
        report.head,
        `reduced motion was not identified on ${engine}; the headline said: ${report.head}`,
      ).toMatch(/Reduce Motion is ON/);
      // The verdict is a warning and not a fault, because nothing is broken:
      // the stylesheet cancelling every animation under the query is the
      // designed behaviour, and saying otherwise would send the reader hunting.
      expect(report.state).toBe('warn');
      expect(report.text).toContain('prefers-reduced-motion: reduce: ON');
      // And the measurement underneath the headline is still taken and still
      // reported, so the reader can see *what* the setting did rather than
      // being told to take it on trust.
      expect(report.text).toContain('beats that moved: 0 of 12');
    } finally {
      await context.close();
    }
  }, 120_000);

  /*
   * Structural, and the one assertion here that is about the file rather than
   * about a run of it.
   *
   * The instrument's premise is that it still works on a device where the app
   * is what is broken. That holds only while the page's own presentation and
   * logic are inline: a `<link>` or a `<script src>` in this file is a second
   * request that can fail, and it fails hardest in exactly the situation the
   * page was opened to investigate. The app's stylesheet is fetched at runtime
   * instead, after the page can already report, which is why the run above
   * still reaches a verdict when the fetch fails.
   */
  it.runIf(engine === 'chromium')('is standalone: no parse-time request of its own', () => {
    const source = readFileSync(join(process.cwd(), 'public', 'diagnose.html'), 'utf8');
    expect(source, 'the diagnostic grew a stylesheet link and is no longer self-contained').not.toMatch(
      /<link\b[^>]*rel=["']stylesheet["']/i,
    );
    expect(source, 'the diagnostic grew an external script and is no longer self-contained').not.toMatch(
      /<script\b[^>]*\bsrc=/i,
    );
    // An at-rule, not the word: the file's own comments discuss `@import`, and
    // a check that cannot tell prose from CSS is a check that gets deleted.
    expect(source, 'the diagnostic grew an @import and is no longer self-contained').not.toMatch(
      /^\s*@import\b/m,
    );
  });
});
