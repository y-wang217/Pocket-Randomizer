/**
 * `contentHash`: stable where it must be, moving where it must.
 *
 * Four properties, each the negation of a way the hash could lie:
 *
 *   1. It does not depend on the order files were read in or on the line
 *      endings a checkout wrote them with — or two machines disagree about one
 *      commit and every shared seed is "foreign" to half its recipients.
 *   2. It moves when any hashed number moves — or a balance edit ships under an
 *      old hash and a shared seed silently plays a different run.
 *   3. It does not move for an edit outside the data tables, or for an edit to
 *      an excluded copy file — or every comment in `core/` invalidates every
 *      seed in circulation.
 *   4. The exclusion list obeys its own rule: nothing in `core/` imports an
 *      excluded file at any depth. The list is only safe while that holds, so
 *      it is asserted rather than trusted.
 *
 * And one fact about the artifact: the constant the app imports is the hash of
 * the working tree, so the build-time computation and the disk agree.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  CONTENT_DIR,
  computeContentHash,
  contentHashOf,
  EXCLUDED,
  listContentFiles,
  shortContentHash,
  type ContentFile,
} from '../build-config/content-hash';
import { CONTENT_HASH, SHORT_HASH_LENGTH, shortContentHash as coreShort } from '../src/core/contentHash';

const ROOT = process.cwd();

function readTree(root: string): ContentFile[] {
  return listContentFiles(root).map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') }));
}

/** A deterministic shuffle, so a failure reproduces. No `Math.random` in tests either. */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  let state = 0x9e3779b9;
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}

/**
 * A scratch copy of `src/` to edit without touching the tree. The hash reads
 * `src/data/`; `src/core/` is copied so the "a core comment does not move it"
 * case edits a real file in the same layout rather than proving a tautology
 * about an empty directory.
 */
const scratch = mkdtempSync(join(tmpdir(), 'gymrun-content-hash-'));
cpSync(join(ROOT, 'src/data'), join(scratch, 'src/data'), { recursive: true });
cpSync(join(ROOT, 'src/core'), join(scratch, 'src/core'), { recursive: true });
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function edit(path: string, change: (text: string) => string): void {
  const file = join(scratch, path);
  writeFileSync(file, change(readFileSync(file, 'utf8')), 'utf8');
}

describe('the hash is stable', () => {
  it('is 64 hex characters, and its display form is the first six', () => {
    const hash = contentHashOf(ROOT);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(shortContentHash(hash)).toBe(hash.slice(0, 6));
    expect(SHORT_HASH_LENGTH).toBe(6);
    expect(coreShort(hash)).toBe(shortContentHash(hash));
  });

  it('does not depend on the order the files were read in', () => {
    const files = readTree(ROOT);
    const once = computeContentHash(files);
    const again = computeContentHash(shuffled(files));
    const reversed = computeContentHash([...files].reverse());
    expect(files.length).toBeGreaterThan(10);
    expect(again).toBe(once);
    expect(reversed).toBe(once);
  });

  it('does not depend on line endings', () => {
    const files = readTree(ROOT);
    const crlf = files.map((file) => ({ ...file, text: file.text.replace(/\n/g, '\r\n') }));
    const cr = files.map((file) => ({ ...file, text: file.text.replace(/\n/g, '\r') }));
    // The rewrite has to have done something, or the assertion is vacuous.
    expect(crlf.some((file) => file.text.includes('\r\n'))).toBe(true);
    expect(computeContentHash(crlf)).toBe(computeContentHash(files));
    expect(computeContentHash(cr)).toBe(computeContentHash(files));
  });

  it('agrees between two reads of the same tree', () => {
    expect(contentHashOf(ROOT)).toBe(contentHashOf(ROOT));
    expect(contentHashOf(scratch)).toBe(contentHashOf(ROOT));
  });
});

describe('the hash moves for a data edit and only for a data edit', () => {
  const baseline = contentHashOf(ROOT);

  it('changes when one number in a hashed table changes', () => {
    const before = readFileSync(join(scratch, 'src/data/scaling.ts'), 'utf8');
    // The first integer literal in the file, whatever it is, plus one.
    edit('src/data/scaling.ts', (text) => text.replace(/(?<=[:\s[])(\d+)(?=[,\s\]}])/, (n) => String(Number(n) + 1)));
    expect(readFileSync(join(scratch, 'src/data/scaling.ts'), 'utf8')).not.toBe(before);
    expect(contentHashOf(scratch)).not.toBe(baseline);
    writeFileSync(join(scratch, 'src/data/scaling.ts'), before, 'utf8');
    expect(contentHashOf(scratch)).toBe(baseline);
  });

  it('changes when a table is added under src/data/', () => {
    const added = join(scratch, 'src/data/zzz-new-table.ts');
    writeFileSync(added, 'export const NEW_TABLE = { weight: 1 };\n', 'utf8');
    expect(contentHashOf(scratch)).not.toBe(baseline);
    rmSync(added);
    expect(contentHashOf(scratch)).toBe(baseline);
  });

  it('changes when a hashed table moves to a different path with its contents intact', () => {
    const from = join(scratch, 'src/data/gyms.ts');
    const to = join(scratch, 'src/data/gym-roster.ts');
    const text = readFileSync(from, 'utf8');
    rmSync(from);
    writeFileSync(to, text, 'utf8');
    expect(contentHashOf(scratch)).not.toBe(baseline);
    rmSync(to);
    writeFileSync(from, text, 'utf8');
    expect(contentHashOf(scratch)).toBe(baseline);
  });

  it('does not change for a comment in src/core/', () => {
    edit('src/core/run.ts', (text) => `// a comment that must not move any seed\n${text}`);
    edit('src/core/randomizer.ts', (text) => text.replace('export const RANDOMIZER_VERSION', '// draw order note\nexport const RANDOMIZER_VERSION'));
    expect(contentHashOf(scratch)).toBe(baseline);
  });

  it('does not change for an edit to an excluded copy file', () => {
    for (const { path } of EXCLUDED) {
      const before = readFileSync(join(scratch, path), 'utf8');
      edit(path, (text) => `${text}\n// reworded\n`);
      expect(contentHashOf(scratch), path).toBe(baseline);
      writeFileSync(join(scratch, path), before, 'utf8');
    }
  });
});

describe('the exclusion list obeys its rule', () => {
  it('names files that exist, each with a reason', () => {
    for (const entry of EXCLUDED) {
      expect(existsSync(join(ROOT, entry.path)), entry.path).toBe(true);
      expect(entry.path.startsWith(`${CONTENT_DIR}/`), entry.path).toBe(true);
      expect(entry.why.length, entry.path).toBeGreaterThan(20);
    }
    expect(new Set(EXCLUDED.map((entry) => entry.path)).size).toBe(EXCLUDED.length);
  });

  it('leaves nothing out that core/ imports at any depth', () => {
    /*
     * The import graph of `src/`, walked backwards from each excluded file. A
     * file `core/` reaches is a file whose values can, in principle, decide a
     * roll, a turn or a payout, and it is hashed whatever its header says it
     * is for. The rule is structural so the list cannot rot quietly.
     */
    const files = walk(join(ROOT, 'src')).filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'));
    const importers = new Map<string, Set<string>>();
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/from\s+'(\.[^']+)'/g)) {
        let target = resolve(dirname(file), match[1]!);
        if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.ts');
        else if (!target.endsWith('.ts')) target = `${target}.ts`;
        const key = posix(target);
        if (!importers.has(key)) importers.set(key, new Set());
        importers.get(key)!.add(posix(file));
      }
    }
    const reachedFrom = (start: string): Set<string> => {
      const seen = new Set<string>();
      const stack = [start];
      while (stack.length > 0) {
        const current = stack.pop()!;
        for (const importer of importers.get(current) ?? []) {
          if (!seen.has(importer)) {
            seen.add(importer);
            stack.push(importer);
          }
        }
      }
      return seen;
    };

    for (const entry of EXCLUDED) {
      const core = [...reachedFrom(entry.path)].filter((file) => file.startsWith('src/core/')).sort();
      expect(core, `${entry.path} is reached from core/ and may not be excluded`).toEqual([]);
    }
  });

  it('covers every other file under src/data/', () => {
    const excluded = new Set(EXCLUDED.map((entry) => entry.path));
    const all = walk(join(ROOT, CONTENT_DIR)).map(posix);
    const hashed = listContentFiles(ROOT);
    expect(hashed).toEqual([...hashed].sort());
    expect(hashed.every((path) => path.startsWith(`${CONTENT_DIR}/`))).toBe(true);
    expect(new Set([...hashed, ...excluded])).toEqual(new Set(all));
    for (const path of hashed) expect(excluded.has(path), path).toBe(false);
  });
});

describe('the artifact the app imports', () => {
  it('is the hash of the working tree', () => {
    expect(CONTENT_HASH).toBe(contentHashOf(ROOT));
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

function posix(file: string): string {
  return relative(ROOT, file).split(sep).join('/');
}
