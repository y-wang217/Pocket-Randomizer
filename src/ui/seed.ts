/**
 * Where a run seed comes from.
 *
 * Producing the *first* seed of a session is the one genuinely
 * non-deterministic act in the whole program, so it lives here in ui/ rather
 * than in core/. core/rng.ts only ever transforms a seed it was given; if it
 * could invent one, "deterministic core" would be a claim rather than a fact.
 */
import { createRng, formatSeed, normalizeSeed } from '../core/rng';

/** Read a seed from the URL so a battle can be shared or bookmarked. */
export function seedFromLocation(url: string): string | null {
  const hash = new URL(url).hash.replace(/^#/, '');
  const seed = new URLSearchParams(hash).get('seed');
  return seed ? normalizeSeed(seed) : null;
}

export function writeSeedToLocation(seed: string): void {
  const next = `#seed=${encodeURIComponent(seed)}`;
  if (globalThis.location.hash !== next) {
    globalThis.history.replaceState(null, '', next);
  }
}

/**
 * A fresh, human-typeable seed.
 *
 * Entropy comes from the platform CSPRNG, then goes straight into a named
 * stream so even seed *generation* uses the same code path as everything else.
 */
export function newSeed(): string {
  const entropy = new Uint32Array(4);
  globalThis.crypto.getRandomValues(entropy);
  const material = Array.from(entropy, (n) => n.toString(16).padStart(8, '0')).join('');
  return formatSeed(createRng(material).map);
}
