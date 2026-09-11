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
 *
 * ## Keyed sub-streams, Stage 4.6a
 *
 * Five named streams solved the *between systems* problem and left the *within
 * a system* one untouched. Every map draw in a run comes off one sequence in
 * one order, so adding a draw at segment 0 shifts every draw at segments 1
 * through 7 — which is the failure `RANDOMIZER_VERSION` exists to announce, and
 * announcing it three times in one stage is three retunes.
 *
 * So a stream now opens **sub-streams by key**: `rng.map.at('seg3/cave/route')`
 * is a sequence of its own, seeded from the run seed, the stream name and the
 * key together. Two consequences, and both are the point:
 *
 *   - A draw under one key cannot move a draw under any other, in the same
 *     stream or a different one. Adding a *new key* is therefore free — no
 *     recorded seed changes, no version bump.
 *   - Generation no longer has a global draw order to preserve. What has to
 *     hold is that a given key draws the same things in the same order, which
 *     is a local property of one function rather than a whole-file contract.
 *
 * `docs/spec/gymrun-seeds-and-mappability.md` is the long form, including why 4.6b and
 * 4.6c should not need a `randomizerVersion` bump between them.
 *
 * ## The unkeyed sequence is gone, contentHash release
 *
 * From 4.6a to the `contentHash` release a named stream was *also* drawable
 * directly — `rng.map.nextUint32()` — as a root sequence with a global
 * position. Nothing in generation used it, but it was exported, and the seeds
 * document's reason for deleting it stands: leaving both means someone uses
 * the old one. A draw off the root is a draw whose position depends on
 * everything drawn before it, which is the exact coupling keying removed. So a
 * named stream now has `at(key)` and two counters, and nothing else. There is
 * no root to collide with a key, and no sequential API to reach for.
 *
 * The separator between the stream name and the key is `#`, which appears in
 * neither a stream name nor a normalized seed — so no `(name, key, seed)`
 * triple can hash to the same domain string as a different one.
 */

/**
 * The streams a run is split into.
 *
 * `randomizer` is Stage 2's addition and the reason the split earned its keep.
 * Species, ability, moveset and level rolls all come from it, so adding a draw
 * to the randomizer cannot shift a single map shape or damage roll for a seed
 * recorded before the change — and equally, a Stage 3 reward draw cannot shift
 * what a randomizer rolled. `policy` exists so a scripted policy (the balance
 * simulator's `random` bot) can be reproducible without borrowing a stream that
 * belongs to a game system.
 */
export const RNG_STREAMS = ['map', 'rewards', 'battle', 'randomizer', 'policy'] as const;

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
  /** Inclusive integer from a range. The randomizer's level draws use it. */
  inRange(range: { min: number; max: number }): number;
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

/**
 * A named stream: the sub-streams it can open, and nothing drawable itself.
 *
 * `at(key)` is the Stage 4.6a addition and the reason the whole refactor
 * exists. Each key gets an independent sequence derived from the run seed, the
 * stream name and the key — so a system that keys its draws by node id can add
 * a draw to one node without moving any other node's rolls, and a stage that
 * adds a whole new key adds it without moving anything at all.
 *
 * Sub-streams are **memoized per key**, so two calls with the same key return
 * the same sequence and the second continues where the first left off. A fresh
 * sequence per call would make the draw a function of how many times the caller
 * happened to ask, which is the exact class of bug the keying is here to
 * remove.
 *
 * The stream itself is **not** drawable. Every draw goes through a key —
 * `core/streamKeys.ts` names them — and a caller with "no meaningful key to
 * give" names the thing that is drawing, which is a key. See the header.
 */
export interface KeyedRngStream {
  /** The sub-stream for `key`, created on first use and memoized after. */
  at(key: string): RngStream;
  /** How many distinct keys have been opened. Diagnostics and tests only. */
  readonly keys: number;
  /**
   * Draws on every sub-stream this stream has opened.
   *
   * The number an isolation test wants: "the battle stream was not touched"
   * is a claim about every key under it, and this is the sum.
   */
  readonly totalDraws: number;
}

export type Rng = { readonly [K in RngStreamName]: KeyedRngStream } & {
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

function createStream(domain: string): RngStream {
  // Domain-separating the stream name into the hash is what makes the streams
  // independent: `map` cannot advance `battle` no matter how much it draws.
  // Since 4.6a the same mechanism separates one *key* from another, which is
  // the same guarantee one level down.
  const next = sfc32(cyrb128(domain));
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
    inRange: (range: { min: number; max: number }): number => {
      const span = range.max - range.min;
      if (span < 0) throw new RangeError(`Invalid range ${range.min}..${range.max}`);
      return range.min + stream.nextInt(span + 1);
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

/**
 * A named stream and its keyed sub-streams.
 *
 * Every sub-stream's domain is `gymrun:<name>#<key>:<seed>`, the shape it has
 * had since 4.6a, so deleting the root moved no keyed draw anywhere. The one
 * sequence the deletion did move is the sim-seed fallback in
 * `core/battle/driver.ts`, which drew off the root and now draws through
 * `FIXTURE_BATTLE_KEY`; no run reaches it.
 */
function createKeyedStream(seed: string, name: RngStreamName): KeyedRngStream {
  const subs = new Map<string, RngStream>();

  return {
    get keys() {
      return subs.size;
    },
    get totalDraws() {
      let total = 0;
      for (const sub of subs.values()) total += sub.draws;
      return total;
    },
    at(key: string): RngStream {
      const existing = subs.get(key);
      if (existing) return existing;
      const created = createStream(`gymrun:${name}#${key}:${seed}`);
      subs.set(key, created);
      return created;
    },
  };
}

/** Build the full set of named streams for a run seed. */
export function createRng(seed: string): Rng {
  return {
    seed,
    map: createKeyedStream(seed, 'map'),
    rewards: createKeyedStream(seed, 'rewards'),
    battle: createKeyedStream(seed, 'battle'),
    randomizer: createKeyedStream(seed, 'randomizer'),
    policy: createKeyedStream(seed, 'policy'),
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
