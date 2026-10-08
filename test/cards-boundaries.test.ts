/**
 * The card engine's boundaries and its non-interference with the shipped
 * game. **Card battle engine, checkpoint 1.**
 *
 * `test/boundaries.test.ts` already holds every `core/` file to no `ui/`
 * import, no `Math.random`, no DOM global and no timer, so it covers
 * `src/core/cards/` without being told. This file adds what is particular to
 * the card engine: no `@pkmn/*`, nothing of the Showdown battle path, no
 * clock, and a data directory the run's `contentHash` cannot see.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONTENT_DIR, listContentFiles } from '../build-config/content-hash';

const ROOT = join(__dirname, '..');
const ENGINE = ['src/core/cards', 'src/cardData'];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const posix = (file: string): string => relative(ROOT, file).split(sep).join('/');
const engineFiles = ENGINE.flatMap((dir) => walk(join(ROOT, dir))).map(posix);
const strip = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('card engine boundaries', () => {
  it('has files to check', () => {
    expect(engineFiles.length).toBeGreaterThan(10);
  });

  it('imports nothing from @pkmn, ui/ or the Showdown battle path', () => {
    for (const file of engineFiles) {
      const source = strip(readFileSync(join(ROOT, file), 'utf8'));
      const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
      for (const spec of imports) {
        expect(spec.startsWith('@pkmn/'), `${file} imports ${spec}`).toBe(false);
        expect(/(^|\/)ui(\/|$)/.test(spec), `${file} imports ${spec}`).toBe(false);
        expect(/(^|\/)battle(\/|$)/.test(spec), `${file} imports ${spec}`).toBe(false);
        expect(spec.startsWith('.'), `${file} imports the package ${spec}`).toBe(true);
      }
    }
  });

  it('reads no clock, sets no timer and never calls Math.random', () => {
    for (const file of engineFiles) {
      const source = strip(readFileSync(join(ROOT, file), 'utf8'));
      expect(/\bDate\b|performance\s*\.\s*now/.test(source), `${file} reads a clock`).toBe(false);
      expect(/\b(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)\s*\(/.test(source), `${file} sets a timer`).toBe(false);
      expect(/Math\s*\.\s*random/.test(source), `${file} calls Math.random`).toBe(false);
    }
  });

  it('keeps its data outside the contentHash glob', () => {
    expect(CONTENT_DIR).toBe('src/data');
    expect(listContentFiles(ROOT).filter((path) => path.startsWith('src/cardData/') || path.startsWith('src/core/cards/'))).toEqual([]);
  });

  it('is imported by nothing outside the card engine', () => {
    const outside = walk(join(ROOT, 'src'))
      .map(posix)
      .filter((file) => !ENGINE.some((dir) => file.startsWith(`${dir}/`)) && /\.(ts|mjs|js)$/.test(file));
    const offenders = outside.filter((file) => /\b(core\/cards|cardData)\//.test(strip(readFileSync(join(ROOT, file), 'utf8'))));
    expect(offenders).toEqual([]);
  });
});
