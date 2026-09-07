/**
 * Seeded randomness for the whole game.
 *
 * Every draw in GYMRUN comes from here. The platform's own unseeded generator
 * is banned repo-wide (see eslint.config.js and test/boundaries.test.ts, which
 * reject the literal call anywhere under src/) because one unseeded draw makes
 * a run unreproducible and gives no clue which draw did it.
 *
 * The important design decision is the *named streams*. A run seed does not
 * produce one sequence, it produces several independent ones — `map`,
 * `rewards`, `battle`. Stage 0 only draws from `battle`, but the split has to
 * exist now: once Stage 2 adds map generation, drawing map numbers from a
 * shared sequence would shift every battle roll that follows it, and every
 * seed recorded before that change would replay differently. Independent
 * streams mean a seed's battle rolls are fixed forever regardless of what
 * later stages consume.
 */

/** The streams a run is split into. Stage 0 uses `battle`; the rest are seams. */
export const RNG_STREAMS = ['map', 'rewards', 'battle'] as const;

export type RngStreamName = (typeof RNG_STREAMS)[number];

export interface RngStream {
  /** Next raw 32-bit unsigned integer. */
  nextUint32(): number;
  /** Next float in [0, 1). */
  nextFloat(): number;
  /** Next integer in [0, max). Throws if max < 1. */
  nextInt(max: number): number;
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /**
   * A Pokemon Showdown PRNG seed derived from this stream.
   *
   * The sim runs its own PRNG; we hand it a seed drawn from ours so the whole
   * battle is a pure function of the run seed. Format is sodium (a pure-JS
   * ChaCha20 in @pkmn/sim — no libsodium, no native module, browser-safe).
   */
  nextSimSeed(): SimSeed;
  /** How many values have been drawn. Useful for asserting stream isolation. */
  readonly draws: number;
}

/** A Pokemon Showdown PRNG seed. Matches @pkmn/sim's `PRNGSeed` shape. */
export type SimSeed = `sodium,${string}`;

export type Rng = { readonly [K in RngStreamName]: RngStream } & {
  /** The seed string this Rng was built from. */
  readonly seed: string;
};

/**
 * cyrb128: string -> four well-mixed 32-bit words, used to seed sfc32.
 * Public-domain hash; chosen because it is short enough to audit and has no
 * dependencies, which matters for a function the entire game's reproducibility
 * rests on.
 */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/** sfc32: small, fast, statistically sound counter-based PRNG. */
function sfc32(seed: [number, number, number, number]): () => number {
  let [a, b, c, d] = seed;
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
}

function createStream(seed: string, name: RngStreamName): RngStream {
  // Domain-separating the stream name into the hash is what makes the streams
  // independent: `map` cannot advance `battle` no matter how much it draws.
  const next = sfc32(cyrb128(`gymrun:${name}:${seed}`));
  let draws = 0;

  const nextUint32 = (): number => {
    draws++;
    return next();
  };

  const stream: RngStream = {
    nextUint32,
    nextFloat: () => nextUint32() / 0x1_0000_0000,
    nextInt: (max: number) => {
      if (!Number.isInteger(max) || max < 1) {
        throw new RangeError(`nextInt(max) needs a positive integer, got ${max}`);
      }
      return Math.floor((nextUint32() / 0x1_0000_0000) * max);
    },
    pick: <T,>(items: readonly T[]): T => {
      if (items.length === 0) throw new RangeError('pick() needs a non-empty array');
      const chosen = items[stream.nextInt(items.length)];
      // nextInt is bounded by length, so this is unreachable; the check exists
      // only to satisfy noUncheckedIndexedAccess without an assertion.
      if (chosen === undefined) throw new RangeError('pick() drew out of range');
      return chosen;
    },
    nextSimSeed: (): SimSeed => {
      // sodium seeds are 32 bytes of hex; 8 uint32 draws fill it exactly.
      let hex = '';
      for (let i = 0; i < 8; i++) hex += nextUint32().toString(16).padStart(8, '0');
      return `sodium,${hex}`;
    },
    get draws() {
      return draws;
    },
  };
  return stream;
}

/** Build the full set of named streams for a run seed. */
export function createRng(seed: string): Rng {
  return {
    seed,
    map: createStream(seed, 'map'),
    rewards: createStream(seed, 'rewards'),
    battle: createStream(seed, 'battle'),
  };
}

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * A human-typeable run seed, derived from an existing stream.
 *
 * There is deliberately no unseeded generator in core/: producing the very
 * first seed of a session is an I/O concern and lives in ui/.
 */
export function formatSeed(source: RngStream, length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) out += source.pick([...SEED_ALPHABET]);
  return out;
}

/** Normalise user-typed seed input so "  abc " and "ABC" are the same run. */
export function normalizeSeed(input: string): string {
  return input.trim().toUpperCase();
}
