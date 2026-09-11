/**
 * `contentHash`: the balance tables, as one number.
 *
 * `docs/spec/gymrun-seeds-and-mappability.md` replaces the hand-bumped
 * `RANDOMIZER_VERSION` with a hash over the data tables, on the grounds that a
 * hand bump is a discipline and disciplines fail: a forgotten bump silently
 * reinterprets a shared seed, which is the one failure the whole seed system
 * exists to make impossible. A hash cannot be forgotten.
 *
 * ## Computed at build time, never at runtime
 *
 * The hash is taken over the **source files** under `src/data/`, by this
 * script, while the bundle is being built. It is not computed in the browser
 * from the bundled data, because the bundle is not the source of truth: the
 * trim plugin rewrites modules on the way in, minification reorders what is
 * left, and two builds of one commit would not necessarily agree. Source bytes
 * on disk are what a commit fixes, so source bytes are what is hashed.
 *
 * The app reaches it through a virtual module, `virtual:gymrun/content-hash`,
 * served by the Vite plugin at the bottom of this file. Vitest, `vite-node`
 * and `vite build` all load `vite.config.ts`, so the constant is the same
 * under the test suite, the simulator and the shipped bundle — and it is never
 * stale, because nothing is checked in that could go stale. There is no
 * generated file to forget to regenerate.
 *
 * ## Stable across machines
 *
 * Paths are sorted and hashed relative to the repo root with forward slashes,
 * contents are hashed rather than mtimes, and line endings are normalised to
 * `\n` before hashing so a Windows checkout with `core.autocrlf` produces the
 * same hash as a Linux one. Two clean checkouts of one commit agree.
 * `test/content-hash.test.ts` shuffles the file order and rewrites the line
 * endings to prove both.
 *
 * ## A glob, with one exclusion list
 *
 * Every file the glob `src/data/**` matches is hashed, minus `EXCLUDED`
 * below. `docs/generation.md` section 9 carries the argument for the glob over
 * an enumerated list: a list somebody must remember to extend fails in exactly
 * the way the hand bump did, and had already failed by one full stage. A table
 * added tomorrow is hashed the day it lands.
 *
 * The exclusion rule is mechanical so the test can hold it: **a file is
 * excluded only if nothing under `src/core/` imports it, directly or
 * transitively.** A file only `ui/` reads cannot change what a seed generates,
 * what a battle resolves, or what a run pays, because none of that happens in
 * `ui/`. A file `core/` reaches — even through a display projection like
 * `core/battle/view.ts` — is hashed whether or not its values are believed to
 * flow anywhere that matters, because "believed" is the failure mode. That
 * makes the hash conservative in the safe direction: it may reject a seed
 * that would have reproduced (rewording `moveCopy.ts` moves it), and it can
 * never accept one that will not.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import type { Plugin } from 'vite';

/** The directory the hash is taken over, relative to the repo root. */
export const CONTENT_DIR = 'src/data';

/**
 * Files under `src/data/` the hash leaves out, each with the reason.
 *
 * Every entry satisfies the rule in the header — no `src/core/` module imports
 * it at any depth — and `test/content-hash.test.ts` walks the import graph to
 * assert exactly that, so an entry stays here only while the rule holds. A
 * table that `core/` starts reading drops off this list by failing a test, not
 * by someone noticing.
 *
 * Every entry is *copy* or a *fixture*. Balance numbers are never excluded,
 * and a display number that shares a file with a balance number
 * (`tuning.ts`'s `battleFeedbackMs`) is hashed with its neighbours: that
 * costs a false rejection when the display number moves, which is the safe
 * error, and the alternative is a per-field list that reintroduces the
 * discipline this file exists to retire.
 */
export const EXCLUDED: ReadonlyArray<{ path: string; why: string }> = [
  {
    path: 'src/data/abilityOverrides.ts',
    why: 'tooltip prose replacing dex text; read by ui/tooltips.ts only',
  },
  {
    path: 'src/data/bandInfo.ts',
    why: 'the sentences behind the BAND badge tooltip; read by ui/tooltips.ts only',
  },
  {
    path: 'src/data/categoryInfo.ts',
    why: 'what PHYS, SPEC and STAT mean, in prose; read by ui/ only',
  },
  {
    path: 'src/data/flagWords.ts',
    why: 'the words a post-resolution flag is shown as; the truths are read in core/battle/flags.ts, which does not import this',
  },
  {
    path: 'src/data/moveTargets.ts',
    why: 'a target keyword rendered as a sentence; read by ui/move-explanation.ts only',
  },
  {
    path: 'src/data/statInfo.ts',
    why: 'the six stat abbreviations explained; read by ui/ only',
  },
  {
    path: 'src/data/statusInfo.ts',
    why: 'what each status condition does, in prose; read by ui/tooltips.ts only',
  },
  {
    path: 'src/data/tierInfo.ts',
    why: 'the three tier sentences on the map; the numbers they restate live in scaling.ts, which is hashed',
  },
  {
    path: 'src/data/mons.ts',
    why: "Stage 0's fixed Snorlax-versus-Milotic matchup, pinned by the determinism tests; no run reads it",
  },
];

/** A file's path relative to the repo root, always with forward slashes. */
function posix(root: string, file: string): string {
  return relative(root, file).split(sep).join('/');
}

function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

/**
 * Every file the hash covers, as repo-relative posix paths, sorted.
 *
 * Everything under `src/data/` regardless of extension, minus the exclusion
 * list. Sorted here and again in `computeContentHash`, so neither caller has
 * to remember.
 */
export function listContentFiles(root: string): string[] {
  const excluded = new Set(EXCLUDED.map((entry) => entry.path));
  return walk(join(root, CONTENT_DIR))
    .map((file) => posix(root, file))
    .filter((path) => !excluded.has(path))
    .sort();
}

/** One file's contribution: where it is and what it says. */
export interface ContentFile {
  path: string;
  text: string;
}

/**
 * The hash itself, over path-and-text pairs. Pure: no disk, so the tests can
 * hand it a shuffled or re-terminated copy of the same tree and expect the
 * same answer.
 *
 * Each entry contributes `path NUL text NUL`, with `\r\n` and lone `\r`
 * folded to `\n`. The path is included so a table moving between two files
 * with its contents intact still moves the hash — the module a number lives
 * in is part of what a seed means, since it decides which import reads it.
 */
export function computeContentHash(files: ReadonlyArray<ContentFile>): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(file.text.replace(/\r\n?/g, '\n'));
    hash.update('\0');
  }
  return hash.digest('hex');
}

/** Read the tree under `root` and hash it. What the plugin and the CLI call. */
export function contentHashOf(root: string): string {
  return computeContentHash(
    listContentFiles(root).map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') })),
  );
}

/** How many hex characters of the hash a seed string and the stamps show. */
export const SHORT_HASH_LENGTH = 6;

/** The display form: the first six hex characters. The log stores the full hash. */
export function shortContentHash(hash: string): string {
  return hash.slice(0, SHORT_HASH_LENGTH);
}

export const CONTENT_HASH_MODULE = 'virtual:gymrun/content-hash';
const RESOLVED_ID = `\0${CONTENT_HASH_MODULE}`;

/**
 * Serve `virtual:gymrun/content-hash` to the bundle, the suite and the
 * simulator alike. `src/core/contentHash.ts` is the one importer.
 *
 * Every hashed file is registered as a watch file, so `vite dev` re-serves
 * the constant when a table is edited rather than holding the value from
 * start-up.
 */
export function contentHash(root: string = process.cwd()): Plugin {
  return {
    name: 'gymrun:content-hash',
    resolveId(source) {
      return source === CONTENT_HASH_MODULE ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      for (const path of listContentFiles(root)) this.addWatchFile(join(root, path));
      return `export const CONTENT_HASH = ${JSON.stringify(contentHashOf(root))};\n`;
    },
  };
}
