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

import { launch, serve } from '../../scripts/visual/browser.mjs';

export interface Harness {
  url: string;
  browser: Browser;
  close(): Promise<void>;
}

export async function openHarness(): Promise<Harness> {
  const out = mkdtempSync(join(tmpdir(), 'gymrun-visual-'));
  await build({
    configFile: join(process.cwd(), 'vite.config.ts'),
    logLevel: 'silent',
    build: { outDir: out, emptyOutDir: true, sourcemap: false, reportCompressedSize: false },
  });
  const server = await serve(out);
  const browser = await launch();
  return {
    url: server.url,
    browser,
    async close() {
      await browser.close();
      server.close();
      rmSync(out, { recursive: true, force: true });
    },
  };
}
