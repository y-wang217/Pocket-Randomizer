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
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const SOURCE_ROOT = join(process.cwd(), 'scratch', 'encounter-sources');

export interface SourcePin {
  sha: string;
  paths: string[];
}

export interface PokemondbPin {
  fetchedAt: string;
  pages: Record<string, string>;
}

interface Manifest {
  repos: Record<string, SourcePin>;
  pokemondb: PokemondbPin;
  serebii: PokemondbPin;
}

function manifest(): Manifest {
  return JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8')) as Manifest;
}

export function loadSources(): Record<string, SourcePin> {
  return manifest().repos;
}

export function loadPokemondb(): PokemondbPin {
  return manifest().pokemondb;
}

export function loadSerebii(): PokemondbPin {
  return manifest().serebii;
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

/**
 * The Gen 5 to 9 pages, one per game, two seconds apart: pokemondb's robots
 * policy asks for a crawl delay of two, and ten pages is the whole fetch.
 * Always re-read, since there is no revision to compare against; the pin is
 * the date in `sources.json`, which the caller updates when it means to.
 */
export async function fetchPokemondb(): Promise<void> {
  const pin = loadPokemondb();
  const dir = sourcePath('pokemondb');
  mkdirSync(dir, { recursive: true });
  for (const [game, page] of Object.entries(pin.pages)) {
    const response = await fetch(`https://pokemondb.net/${page}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) GYMRUN encounter importer' },
    });
    if (!response.ok) throw new Error(`pokemondb ${page}: HTTP ${response.status}`);
    writeFileSync(join(dir, `${game}.html`), await response.text());
    console.log(`pokemondb: ${game} from ${page}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

/** Serebii's Champion Cup page, the one page pokemondb does not carry. */
export async function fetchSerebii(): Promise<void> {
  const pin = loadSerebii();
  const dir = sourcePath('serebii');
  mkdirSync(dir, { recursive: true });
  for (const [game, page] of Object.entries(pin.pages)) {
    const response = await fetch(`https://www.serebii.net/${page}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) GYMRUN encounter importer' },
    });
    if (!response.ok) throw new Error(`serebii ${page}: HTTP ${response.status}`);
    writeFileSync(join(dir, `${game}-championcup.html`), await response.text());
    console.log(`serebii: ${game} from ${page}`);
  }
}

export function fetchAll(): void {
  for (const [repo, pin] of Object.entries(loadSources())) fetchRepo(repo, pin);
}
