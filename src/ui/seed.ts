/**
 * Where a run seed comes from.
 *
 * Producing the *first* seed of a session is the one genuinely
 * non-deterministic act in the whole program, so it lives here in ui/ rather
 * than in core/. core/rng.ts only ever transforms a seed it was given; if it
 * could invent one, "deterministic core" would be a claim rather than a fact.
 */
import { createRng, formatSeed } from '../core/rng';
import { formatSeedString, parseSeedString, type ParsedSeed } from '../core/seedString';
import { SEED_KEY } from '../core/streamKeys';

/**
 * Read a seed from the URL so a run can be shared or bookmarked.
 *
 * Parsed rather than taken as-is, since the `contentHash` release: a shared
 * link carries the versioned string, and one made on another build comes back
 * `foreign` so the shell can say so. A bare seed in an old bookmark still
 * reads as it always did.
 */
export function seedFromLocation(url: string): ParsedSeed | null {
  const hash = new URL(url).hash.replace(/^#/, '');
  const seed = new URLSearchParams(hash).get('seed');
  if (!seed || !seed.trim()) return null;
  const parsed = parseSeedString(seed);
  return parsed.seed ? parsed : null;
}

/** The versioned form, so a copied link is a shareable seed string. */
export function writeSeedToLocation(seed: string): void {
  const next = `#seed=${encodeURIComponent(formatSeedString(seed))}`;
  if (globalThis.location.hash !== next) {
    globalThis.history.replaceState(null, '', next);
  }
}

/**
 * A fresh, human-typeable seed.
 *
 * Entropy comes from the platform CSPRNG, then goes straight into a named
 * stream so even seed *generation* uses the same code path as everything else.
 *
 * **Through a key, since Release 0.5.** This read off the unkeyed root of `map`
 * until then, and it was the last caller of that API in `src/` — the one place
 * production code could still draw from a sequence with a global position. The
 * derivation changed, so the seed minted from a given block of entropy changed
 * with it, and that is observable by nothing: the entropy is fresh every call
 * and never repeats. No recorded seed moves, which is why this one caller could
 * be ported inside a cleanup pass when the rest cannot be.
 */
export function newSeed(): string {
  const entropy = new Uint32Array(4);
  globalThis.crypto.getRandomValues(entropy);
  const material = Array.from(entropy, (n) => n.toString(16).padStart(8, '0')).join('');
  return formatSeed(createRng(material).map.at(SEED_KEY));
}
