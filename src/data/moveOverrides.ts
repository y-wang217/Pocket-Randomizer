/**
 * Moves whose base power lies about their strength.
 *
 * **This file starts empty on purpose, and every entry has to be earned.** It
 * is `data/blacklists.ts`'s sibling and it takes the same posture, for the same
 * reason: a band override is the cheapest possible way to fix a balance problem
 * and the easiest one to over-apply. Re-band the move that killed you, re-band
 * the one that felt weak, and three passes later the ramp is a hand-curated
 * ladder that no longer follows from base power at all — at which point
 * `POWER_CUTS` is decoration and nobody can say what a band means.
 *
 * Two reasons are admissible, and they are `blacklists.ts`'s two:
 *
 *   1. **Mechanical.** The number in the generated table is not the number the
 *      engine applies, and the difference is arithmetic rather than opinion.
 *   2. **Measured.** `npm run sim` showed the move landing in a band whose
 *      clear-rate contribution does not match the rest of it, and the figure is
 *      quoted in the entry.
 *
 * "It feels strong" is not a reason.
 *
 * ## What is deliberately *not* here
 *
 * The Stage 4.6b prompt names six classes whose base power lies — boosting,
 * multi-hit, priority, drain, fixed damage and heavy-drawback moves. Five of
 * them are already handled, and writing them here would be handling them twice:
 *
 * - **Multi-hit** is corrected in `scripts/gen-pools.ts` by `effectivePower`,
 *   which multiplies base power by expected hits before banding. That is
 *   arithmetic the dex already knows, so it belongs in the generator where it
 *   stays right when a hit count changes. Population Bomb moved from band 1 to
 *   band 4 on that change alone.
 * - **Fixed damage** (Seismic Toss, Night Shade, Dragon Rage) and **drain of
 *   the self-halving kind** (Steel Beam, Mind Blown) never reach the pool:
 *   `gen-pools.ts` excludes them because the greedy AI mis-scores them, which
 *   would make the balance report measure the mis-scoring.
 * - **Heavy-drawback** moves in the recharge and charge classes are excluded
 *   there too, and the self-KO set with them.
 * - **Boosting** moves are status moves, which have no band at all. They are
 *   gated by `impact` instead — see below.
 *
 * What is left, and genuinely unhandled, is **priority** and **ordinary drain**
 * (Drain Punch, Giga Drain). Both are stronger than their base power says and
 * neither is off by a whole band on any arithmetic anyone can write down, so
 * both wait for the simulator. That is the honest state of this file: empty,
 * with a list of what it is waiting for.
 *
 * ## Impact, and why a status move has no band
 *
 * A status move has no base power, so banding one is meaningless — and offering
 * a Swords Dance as a "band 1" move reward would read as the weakest card in
 * the game. The four impact groups (`setup`, `recovery`, `status`, `pressure`)
 * are curated in `scripts/gen-pools.ts` and travel on the generated entry; this
 * file can correct one move's tag without a regeneration.
 */
import { DAMAGING_MOVES, STATUS_MOVES, type MoveEntry, type MoveImpact } from './movePools';

/** A hand-written correction to a generated move entry. */
export interface MoveOverride {
  /** Replaces the computed band. Damaging moves only. */
  band?: number;
  /** Replaces the curated impact group. Status moves only. */
  impact?: MoveImpact;
  /** Mechanical or measured, in one line. Required — see the header. */
  why: string;
}

/**
 * The overrides, by move id.
 *
 * Empty, and see the header for the five classes that are handled elsewhere and
 * the two that are waiting on evidence.
 */
export const MOVE_OVERRIDES: Readonly<Record<string, MoveOverride>> = {};

/** The lowest and highest band a damaging move can carry. */
export const MIN_MOVE_BAND = 1;
export const MAX_MOVE_BAND = DAMAGING_MOVES.reduce(
  (top, move) => Math.max(top, move.band ?? MIN_MOVE_BAND),
  MIN_MOVE_BAND,
);

/**
 * A move's band, override applied. **Null for a status move.**
 *
 * The one function anything outside `data/` should ask. Reading `entry.band`
 * directly is reading the *computed* band, which is right until the day an
 * override says otherwise — and a caller that reads the field is a caller the
 * override silently does not reach.
 */
export function bandOf(move: MoveEntry): number | null {
  if (move.category === 'Status') return null;
  return MOVE_OVERRIDES[move.id]?.band ?? move.band;
}

/**
 * A status move's impact, override applied. **Null for a damaging move**, which
 * carries a band instead.
 */
export function impactOf(move: MoveEntry): MoveImpact | null {
  if (move.category !== 'Status') return null;
  return MOVE_OVERRIDES[move.id]?.impact ?? move.impact;
}

/**
 * The band of a move named the way a screen has it: by display name or by id.
 *
 * **The UI's door into banding, and the reason it is one function.** A reward
 * card knows a move as `"Flamethrower"` — that is what `Reward.move` carries
 * and what `describeMove` echoes — while banding is keyed by `MoveEntry`. Every
 * screen that wanted a band would otherwise be doing its own lookup against
 * `DAMAGING_MOVES`, and the first one to search by id where the others search
 * by name would print a blank badge nobody noticed.
 *
 * Null for a status move, for a move the pool does not contain, and for a name
 * that matches nothing — all three are "no band to show", and a screen that
 * distinguished them would be showing the player the shape of our tables.
 */
export function bandOfMove(nameOrId: string): number | null {
  const wanted = nameOrId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const entry = DAMAGING_MOVES.find((move) => move.id === wanted || move.name === nameOrId);
  return entry ? bandOf(entry) : null;
}

/**
 * Every move id an override names that no pool contains.
 *
 * A typo in this file is silent otherwise: the override sits there, matches
 * nothing, and the move keeps its computed band forever. `test/data-tables.test.ts`
 * asserts this is empty, which is the cheapest possible guard on a hand-written
 * table keyed by ids from a generated one.
 */
export function danglingOverrides(): string[] {
  const known = new Set([...DAMAGING_MOVES, ...STATUS_MOVES].map((move) => move.id));
  return Object.keys(MOVE_OVERRIDES).filter((id) => !known.has(id));
}
