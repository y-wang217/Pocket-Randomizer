/**
 * The security memo, enforced as a test.
 *
 * `docs/security.md` says four mechanical things, and each is a check here:
 * secrets never enter the repository, `.env.example` carries names and not
 * values, `src/` reaches nothing outside itself, and the deploy artifact carries
 * no document. The memo and its `CLAUDE.md` section are asserted to exist too,
 * so deleting the rule deletes the test with it rather than quietly.
 *
 * The scan walks the tree rather than `git ls-files`, so it holds on a tarball
 * and in a worktree alike. It skips only what is never committed.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

/** Never committed, so never scanned. Everything else is. */
const SKIPPED_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-gallery', 'stats', '.temp']);

/** The extensions a secret could be typed into. Binaries are not scanned. */
const TEXT = ['.ts', '.mjs', '.js', '.cjs', '.json', '.md', '.sql', '.css', '.html', '.yml', '.yaml', '.toml', '.txt', '.example'];

function walk(dir: string, keep: (file: string) => boolean): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return SKIPPED_DIRS.has(entry) ? [] : walk(full, keep);
    return keep(full) ? [full] : [];
  });
}

const isText = (file: string): boolean => TEXT.some((ext) => file.endsWith(ext)) || basename(file).startsWith('.env');
const tracked = walk(ROOT, isText);
const rel = (file: string): string => relative(ROOT, file);

/**
 * The shapes secrets take. Values, never words: the memo and the prompts talk
 * about `service_role` in prose, and a check that fired on the name of the
 * thing it protects would be a check people learn to reword around.
 */
const SECRET_SHAPES: readonly { name: string; pattern: RegExp }[] = [
  { name: 'a JWT (Supabase anon or service_role key)', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'a Supabase secret key', pattern: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'a Supabase publishable key', pattern: /\bsb_publishable_[A-Za-z0-9_-]{10,}/ },
  { name: 'a Supabase project URL', pattern: /https:\/\/[a-z]{20}\.supabase\.co\b/ },
  { name: 'a database connection string with a password', pattern: /\bpostgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@/ },
  { name: 'a private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'a GitHub token', pattern: /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { name: 'an AWS access key id', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
];

describe('the security memo', () => {
  it('has files to check', () => {
    expect(tracked.length).toBeGreaterThan(50);
  });

  it('exists, and CLAUDE.md carries its section', () => {
    expect(existsSync(join(ROOT, 'docs/security.md'))).toBe(true);
    const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
    expect(claude).toContain('## Secrets and private material');
    expect(claude).toContain('docs/security.md');
  });

  it('finds no secret-shaped value in any tracked text file', () => {
    const offenders: string[] = [];
    for (const file of tracked) {
      const source = readFileSync(file, 'utf8');
      for (const { name, pattern } of SECRET_SHAPES) {
        if (pattern.test(source)) offenders.push(`${rel(file)}: ${name}`);
      }
    }
    expect(offenders, 'rotate it first, then purge: docs/security.md section 7').toEqual([]);
  });

  it('commits .env.example and no other .env file, with names and no values', () => {
    const envFiles = tracked.filter((file) => basename(file).startsWith('.env')).map(rel);
    expect(envFiles).toEqual(['.env.example']);

    const lines = readFileSync(join(ROOT, '.env.example'), 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line, 'a name with an empty value, and nothing else').toMatch(/^[A-Z][A-Z0-9_]*=$/);
    }
  });

  it('ignores every other .env file', () => {
    const ignore = readFileSync(join(ROOT, '.gitignore'), 'utf8').split('\n').map((line) => line.trim());
    expect(ignore).toContain('.env');
    expect(ignore).toContain('.env.*');
    expect(ignore).toContain('!.env.example');
  });

  /**
   * `src/` reaches nothing outside itself. A relative import that resolves
   * above `src/` is how a migration, a runbook or the companion repository
   * would end up in the bundle, and the memo says the deploy carries none of
   * them. Bare specifiers are packages and are not the concern here.
   */
  it('imports nothing from outside src/', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC, (f) => f.endsWith('.ts'))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g)) {
        const specifier = match[1] ?? match[2] ?? '';
        if (!specifier.startsWith('.')) continue;
        const target = resolve(dirname(file), specifier);
        if (!target.startsWith(SRC + '/')) offenders.push(`${rel(file)} -> ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * The deploy is `dist/` and only `dist/`, and it carries no document. Checked
   * when a build is present; `npm run build` before `npm run smoke` is the
   * ordinary way one is.
   */
  it('ships no document, migration or env file in dist/', () => {
    const dist = join(ROOT, 'dist');
    if (!existsSync(dist)) return;
    const shipped = walk(dist, () => true).map((file) => relative(dist, file));
    const offenders = shipped.filter(
      (file) =>
        /\.(md|sql)$/.test(file) || basename(file).startsWith('.env') || file.split('/').includes('supabase'),
    );
    expect(offenders).toEqual([]);
  });
});
