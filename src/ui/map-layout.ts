/**
 * Where a node sits on the map's backdrop. **Stage 5.0/4, D75.**
 *
 * *"Node positions are presentational, derived in `ui/`"*, and the ruling on
 * D75 took the version with no hash: **a node's place is its option index
 * within its step**, looked up in a slot grid. The same step lays out the same
 * way on every device and every visit, nothing is scattered, and nothing here
 * is randomness in any sense `CLAUDE.md` could mean. Nothing under `core/`
 * reads a position.
 *
 * ## The slot grid
 *
 * Fractions of the backdrop's width, by how many nodes the step offers. Odd
 * and even steps lean opposite ways by a few percent, so the rows read as a
 * route rather than as columns; the lean is keyed on the step index, which is
 * structural (`NodeSpec` steps are fixed at generation), never on anything a
 * player did.
 *
 * **Per backdrop** because Stage 5's art pass tunes each map so nodes stand on
 * ground rather than in water. Until a locale has art it uses the default
 * grid, and a tuned grid is one entry in `BACKDROP_GRIDS`, no code change.
 */
import type { LocaleId } from '../data/locales';

/** Centres as percentages of the width, per node count. */
export interface SlotGrid {
  1: readonly [number];
  2: readonly [number, number];
  3: readonly [number, number, number];
  /** How far odd steps lean right and even steps left, in percent. */
  lean: number;
}

export const DEFAULT_GRID: SlotGrid = {
  1: [50],
  2: [32, 68],
  3: [20, 50, 80],
  lean: 4,
};

/** Tuned grids, by locale. Empty until the art pass (5.0/5) has art to tune against. */
export const BACKDROP_GRIDS: Partial<Readonly<Record<LocaleId, SlotGrid>>> = {};

/**
 * The centre of a node, as a percentage of the backdrop's width. `step` is the
 * step's index in the segment, `count` how many options it offers, `option`
 * this node's index among them.
 */
export function slotX(locale: LocaleId | null, step: number, count: number, option: number): number {
  const grid = (locale && BACKDROP_GRIDS[locale]) || DEFAULT_GRID;
  const row = count >= 3 ? grid[3] : count === 2 ? grid[2] : grid[1];
  const base = row[Math.min(option, row.length - 1)] ?? 50;
  const lean = step % 2 === 0 ? -grid.lean : grid.lean;
  return Math.min(90, Math.max(10, base + lean));
}
