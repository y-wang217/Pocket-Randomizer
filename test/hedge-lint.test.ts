/**
 * The hedge-word lint holds design bible section 8. **Milestone M0.3.**
 *
 * The script is `scripts/hedge-lint.ts` and `npm run check` runs it as its own
 * leg, so a failure names the word and the line. This file asks the same
 * question under `npm test`, because a rule that only a separate command holds
 * is a rule that is held whenever somebody remembers the separate command.
 *
 * Four questions, and the last three are the ones that make the first worth
 * anything: a lint nobody has proved *can* fail is not evidence of a clean
 * tree.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { hedgeHits, stringLiteralsOf } from '../scripts/hedge-lint';
import { FORBIDDEN_WORDS, hedgeWordsIn } from '../src/data/forbiddenWords';

/** A throwaway repo root with one data file in it, for the planted cases. */
function plant(contents: string): string {
  const root = mkdtempSync(join(tmpdir(), 'gymrun-hedge-'));
  mkdirSync(join(root, 'src/data'), { recursive: true });
  writeFileSync(join(root, 'src/data/plantedInfo.ts'), contents);
  // The globs name `tutorial.ts` directly, so it has to exist for the walk.
  writeFileSync(join(root, 'src/data/tutorial.ts'), 'export const NOTHING = 0;\n');
  return root;
}

describe('the hedge-word lint', () => {
  it('finds nothing in the tree', () => {
    const hits = hedgeHits();
    // The message is the point: a regression should print the line, not a count.
    expect(hits.map((hit) => `${hit.file}:${hit.line} "${hit.word}" in ${hit.text}`)).toEqual([]);
  });

  it('fails on a planted "best"', () => {
    const root = plant(`export const ENTRY = { advice: 'This is the best move here.' };\n`);
    try {
      const hits = hedgeHits(root);
      expect(hits).toHaveLength(1);
      expect(hits[0]?.word).toBe('best');
      expect(hits[0]?.file).toBe('src/data/plantedInfo.ts');
      expect(hits[0]?.line).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads string literals and not comments', () => {
    // The first cut of this lint read whole files and returned 31 hits, of
    // which three were real; the rest were the doc comments explaining why
    // hedge words are banned. A comment is not a surface.
    const root = plant(`// This comment says best, should and risky on purpose.\n/** So does this one: worse. */\nexport const ENTRY = { advice: 'It loses 1/16 of max HP each turn.' };\n`);
    try {
      expect(hedgeHits(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('matches whole words only', () => {
    // `bad` must not fire on `badly`, which is how Toxic is inflicted, and
    // `worse` must not be reached through `worsen`.
    expect(hedgeWordsIn('It is badly poisoned and the rate worsens each turn.')).toEqual([]);
    expect(hedgeWordsIn('It is bad.')).toEqual(['bad']);
    // Case-insensitively, and reporting the text as written.
    expect(hedgeWordsIn('Usually the Best option.')).toEqual(['Usually', 'Best']);
  });

  it('reads template literals, not only quoted strings', () => {
    const literals = stringLiteralsOf('const a = `a ${x} best b`;', 'a.ts');
    expect(literals.flatMap(({ text }) => hedgeWordsIn(text))).toEqual(['best']);
  });

  it('carries the three words section 8 names that the tutorial list lacked', () => {
    // D3's ruling. Adding `worth` is what surfaced three violations beyond the
    // six the discrepancy register had counted; see its D3 row.
    for (const word of ['risky', 'safe', 'worth']) expect(FORBIDDEN_WORDS).toContain(word);
  });
});
