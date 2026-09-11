/**
 * The balance tables' version, as the app sees it.
 *
 * `CONTENT_HASH` is a sha256 over every hashed file under `src/data/`,
 * computed at build time by `build-config/content-hash.ts` and served through
 * a virtual module so it is never stale and never computed from the bundle.
 * This file is the one place that virtual module is imported, so every reader
 * in `core/`, `ui/` and `scripts/` gets it from here.
 *
 * It is one of the four version axes. It answers "would this seed roll the
 * same run on that build" for the data half of the question; draw
 * composition (`RANDOMIZER_VERSION`), the decision schema (`RUN_LOG_VERSION`)
 * and the opponent's policy (`AI_VERSION`) are the other three, and the replay
 * guard in `core/run.ts` checks all four.
 */
import { CONTENT_HASH as BUILT } from 'virtual:gymrun/content-hash';

/** The full hash. What the run log stores and what replay compares. */
export const CONTENT_HASH: string = BUILT;

/** How many hex characters of the hash a seed string and the stamps show. */
export const SHORT_HASH_LENGTH = 6;

/** The display form: the first six hex characters. */
export function shortContentHash(hash: string = CONTENT_HASH): string {
  return hash.slice(0, SHORT_HASH_LENGTH);
}
