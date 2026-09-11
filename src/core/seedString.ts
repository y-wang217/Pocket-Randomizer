/**
 * The shareable seed string, and what a pasted one means.
 *
 * A bare seed is a promise about *this* build only: on a build with different
 * balance tables the same seed rolls a different run, and until the
 * `contentHash` release the player found that out at replay time, after they
 * had committed. So the shareable identity carries its content version, per
 * `docs/spec/gymrun-seeds-and-mappability.md`:
 *
 *     GYMRUN-a3f91c-8827364
 *             ^      ^
 *             |      run seed
 *             contentHash, first 6
 *
 * `formatSeedString` renders it and `parseSeedString` reads it back, and the
 * parse is the paste-time check: a string whose hash is not this build's is
 * classified `foreign` before a run starts, so the UI can say so. The bare seed
 * inside it is still a perfectly good seed for a *fresh* run — it just is not a
 * promise of the *same* run — and the parse hands it back for that purpose.
 *
 * `previewRun` in `core/preview.ts` refuses a foreign hash by the same
 * classification (`matchesContentHash`), so paste and preview cannot drift
 * into two definitions of "this build".
 *
 * Nothing here draws. A seed string is a name for a run, not a decision in it.
 */
import { CONTENT_HASH, SHORT_HASH_LENGTH, shortContentHash } from './contentHash';
import { normalizeSeed } from './rng';

/** The leading token of a versioned seed string. */
export const SEED_STRING_PREFIX = 'GYMRUN';

/**
 * `GYMRUN-<hash>-<seed>`, hash lowercase and six characters, seed normalised.
 * Case-insensitive on the way back in, so a hand-typed copy still parses.
 */
const VERSIONED = /^GYMRUN-([0-9A-F]{6})-(.+)$/i;

/** The shareable form of a seed on this build. */
export function formatSeedString(seed: string, contentHash: string = CONTENT_HASH): string {
  return `${SEED_STRING_PREFIX}-${shortContentHash(contentHash)}-${normalizeSeed(seed)}`;
}

/**
 * Whether a hash names this build's tables. Accepts the full hash or its
 * display form, so a preview built from a seed string and one built from a
 * log both pass the same check. Case-insensitive, like the parse.
 */
export function matchesContentHash(hash: string, expected: string = CONTENT_HASH): boolean {
  const given = hash.trim().toLowerCase();
  if (given.length < SHORT_HASH_LENGTH) return false;
  return given === expected.toLowerCase() || given === shortContentHash(expected).toLowerCase();
}

export type ParsedSeed =
  /** No version prefix. A fresh run on this build, exactly as before the release. */
  | { kind: 'bare'; seed: string }
  /** Prefixed, and the hash is this build's: the same run, reproduced. */
  | { kind: 'match'; seed: string; hash: string }
  /**
   * Prefixed with another build's hash. `seed` still starts a fresh run here;
   * `hash` is what the string carried and `expected` is this build's display
   * hash, so the message can name both.
   */
  | { kind: 'foreign'; seed: string; hash: string; expected: string };

/**
 * Read a pasted seed. Whitespace and case are forgiven; the seed comes back
 * normalised the way `normalizeSeed` has always normalised it.
 *
 * A bare seed that happens to look like `GYMRUN-xxxxxx-...` is read as a
 * versioned one. That is the price of a prefix, and it is paid by nobody: the
 * seed alphabet `formatSeed` mints from has no hyphen, and a typed seed that
 * starts with the prefix is asking to be read as one.
 */
export function parseSeedString(input: string, contentHash: string = CONTENT_HASH): ParsedSeed {
  const text = input.trim();
  const match = VERSIONED.exec(text);
  if (!match) return { kind: 'bare', seed: normalizeSeed(text) };
  const hash = match[1]!.toLowerCase();
  const seed = normalizeSeed(match[2]!);
  if (matchesContentHash(hash, contentHash)) return { kind: 'match', seed, hash };
  return { kind: 'foreign', seed, hash, expected: shortContentHash(contentHash) };
}
