/**
 * The architecture rules, enforced as a test rather than only as lint.
 *
 * ESLint enforces the same two rules (see eslint.config.js), but lint is easy
 * to disable inline and easy to skip in CI. These are load-bearing: `core/`
 * importing `ui/` would make headless battles impossible, and one stray
 * `Math.random()` would make a seed meaningless. Both deserve to fail the test
 * suite, not just the linter.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('..', import.meta.url).pathname;
const CORE = join(ROOT, 'src/core');
const SRC = join(ROOT, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

const coreFiles = walk(CORE);
const srcFiles = walk(SRC);

describe('core/ boundaries', () => {
  it('has files to check', () => {
    expect(coreFiles.length).toBeGreaterThan(3);
  });

  it('never imports from ui/', () => {
    const offenders = coreFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /\bfrom\s+['"][^'"]*\bui\/[^'"]*['"]/.test(source) || /\bimport\s*\(\s*['"][^'"]*\bui\/[^'"]*['"]/.test(source);
    });
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('never references Math.random', () => {
    const offenders = srcFiles.filter((file) => /Math\s*\.\s*random/.test(readFileSync(file, 'utf8')));
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('touches no DOM global', () => {
    const dom = /\b(document|window|localStorage|navigator|HTMLElement)\b\s*\./;
    const offenders = coreFiles.filter((file) => dom.test(readFileSync(file, 'utf8')));
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('confines @pkmn/sim to the adapter', () => {
    // Everything above driver.ts speaks core/types.ts. If a second file starts
    // importing the sim, the adapter has stopped being an adapter.
    const allowed = new Set(['src/core/battle/driver.ts', 'src/core/battle/format.ts']);
    const offenders = srcFiles
      .filter((file) => /from\s+['"]@pkmn\/sim['"]/.test(readFileSync(file, 'utf8')))
      .map((f) => relative(ROOT, f))
      .filter((f) => !allowed.has(f));
    expect(offenders).toEqual([]);
  });
});
