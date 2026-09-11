/**
 * The density modes' numbers. **Density modes patch, Part 1.**
 *
 * Every number the patch introduces lives here, so a density pass is a table
 * edit: how much of the chrome each mode spends, and the phone Pocket is
 * defined against.
 *
 * ## Excluded from `contentHash`, and why that is allowed
 *
 * `contentHash` is computed over `src/data/**` and names the balance version
 * a seed was made on; a display scale that moved it would refuse every shared
 * seed the day the padding changed. The exclusion rule in
 * `build-config/content-hash.ts` admits a file only if nothing under `core/`
 * imports it at any depth, and `test/content-hash.test.ts` walks the import
 * graph to hold that. This file is read by `ui/theme/density.ts` and nothing
 * else. The prompt named `tuning.ts`; that file is hashed because `core/`
 * reads it, so the numbers sit beside it instead — recorded as a deviation in
 * `docs/generation.md`.
 *
 * ## The three scales
 *
 * Each is a unitless multiplier the stylesheet applies to a token: `pad` to
 * the padding inside cards and panels, `gap` to the margins and gaps between
 * sections, `title` to the two title sizes. **Detailed is 1 on all three by
 * definition** — it is the current layout, and the guarded screens' heights
 * are asserted to the pixel against it — so the table cannot move Detailed.
 * Chrome is where a mode spends first: the prompt's rule is that headers,
 * titles, padding and margins scale before any fact moves behind a tap.
 *
 * ## The Pocket viewport
 *
 * 390x844, the phone the whole visual pass is measured on. Pocket's gate is
 * `scrollHeight <= height` on every decision surface and the outcome block
 * above `height` on every archive surface (`test/visual-pocket.test.ts`).
 */
import type { Density } from '../../src/ui/settings';

export interface DensityScale {
  /** Padding inside cards, panels, rows and sheets. */
  pad: number;
  /** Gaps and margins between sections and cards, and the shell's own padding. */
  gap: number;
  /** The app title and the screen titles. */
  title: number;
}

export const DENSITY_SCALES: Readonly<Record<Density, DensityScale>> = {
  detailed: { pad: 1, gap: 1, title: 1 },
  simple: { pad: 0.75, gap: 0.75, title: 0.9 },
  pocket: { pad: 0.5, gap: 0.5, title: 0.8 },
};

/** The phone Pocket is measured on. */
export const POCKET_VIEWPORT = { width: 390, height: 844 } as const;
