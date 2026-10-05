/**
 * Fetch the pinned source blobs into `scratch/encounter-sources/<repo>/`.
 *
 *   npm run gen:encounters -- --fetch
 *
 * One shallow, blobless, sparse checkout per repository at the revision
 * `sources.json` pins. GitHub serves a fetch by commit id, so the checkout is
 * the same bytes every time, which is what lets a citation name a revision.
 * `scratch/` is gitignored: the sources are the pret projects' to keep, and
 * the generated tables plus the pin are what this repository keeps.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const SOURCE_ROOT = join(process.cwd(), 'scratch', 'encounter-sources');

export interface SourcePin {
  sha: string;
  paths: string[];
}

export function loadSources(): Record<string, SourcePin> {
  const manifest = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8')) as {
    repos: Record<string, SourcePin>;
  };
  return manifest.repos;
}

export function sourcePath(repo: string, ...parts: string[]): string {
  return join(SOURCE_ROOT, repo, ...parts);
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: ['ignore', 'ignore', 'inherit'] });
}

/** Check out one repository's pinned paths. Idempotent: a matching checkout is left alone. */
export function fetchRepo(repo: string, pin: SourcePin): void {
  const dir = sourcePath(repo);
  const stamp = join(dir, '.gymrun-pin');
  if (existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === pin.sha) {
    console.log(`${repo}: already at ${pin.sha.slice(0, 7)}`);
    return;
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  git(dir, 'remote', 'add', 'origin', `https://github.com/pret/${repo}.git`);
  git(dir, 'sparse-checkout', 'set', '--no-cone', ...pin.paths);
  git(dir, 'fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', pin.sha);
  git(dir, 'checkout', '-q', 'FETCH_HEAD');
  execFileSync('sh', ['-c', `printf '%s\\n' "${pin.sha}" > "${stamp}"`]);
  console.log(`${repo}: fetched ${pin.sha.slice(0, 7)}`);
}

export function fetchAll(): void {
  for (const [repo, pin] of Object.entries(loadSources())) fetchRepo(repo, pin);
}
