/**
 * `previewRun`: the whole map of a seed, with no battle played.
 *
 * Keyed streams made this possible and the seeds document asked for it: every
 * structural draw — starter offers, locale offers, every route under every
 * offered locale, node kinds and tiers, encounters and their species, reward
 * offers, event outcomes, shop stock — is a function of the seed and its key,
 * and none of it depends on a decision or a battle roll. So the preview is
 * `createRun`, which already draws all of it up front, minus the state a run
 * accumulates by being played.
 *
 * What it cannot show is anything downstream of a player decision or a damage
 * roll: which locale gets picked, what the party looks like, which event band
 * resolves, whether the run is won.
 *
 * It takes the content hash the caller believes the seed was made on and
 * refuses a foreign one, the same way a pasted seed string is refused at the
 * seed bar (`core/seedString.ts`): previewing a seed against tables it was
 * not made on would draw a map nobody shared, which is exactly the silent
 * reinterpretation the hash exists to prevent. The refusal is a typed error
 * carrying both hashes; the player-facing wording lives in `data/` and is
 * the UI's to render.
 */
import { CONTENT_HASH, shortContentHash } from './contentHash';
import type { Segment } from './encounters';
import { createRun } from './run';
import { matchesContentHash } from './seedString';
import type { PokemonSpec } from './types';
import { DEFAULT_TUNING, type Tuning } from '../data/tuning';

/** The structural half of a run: everything the seed fixes before play. */
export interface RunPreview {
  seed: string;
  /** The full hash of the tables the preview was drawn against. */
  contentHash: string;
  starterOptions: PokemonSpec[];
  segments: Segment[];
}

/** A preview asked for against tables it was not made on. */
export class ForeignContentHashError extends Error {
  constructor(
    /** What the caller carried, as given. */
    readonly given: string,
    /** This build's full hash. */
    readonly expected: string = CONTENT_HASH,
  ) {
    super(
      `Seed was made on content ${given} and this build is ${shortContentHash(expected)}: ` +
        'the same seed would not produce the same run here.',
    );
    this.name = 'ForeignContentHashError';
  }
}

/**
 * Build the map of `seed` without playing it, if `contentHash` is this
 * build's — the full hash or its six-character display form both pass.
 */
export function previewRun(seed: string, contentHash: string, tuning: Tuning = DEFAULT_TUNING): RunPreview {
  if (!matchesContentHash(contentHash)) throw new ForeignContentHashError(contentHash);
  const state = createRun(seed, tuning);
  return { seed: state.seed, contentHash: CONTENT_HASH, starterOptions: state.starterOptions, segments: state.segments };
}
