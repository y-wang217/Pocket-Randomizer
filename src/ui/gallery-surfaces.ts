/**
 * The surfaces the density gates are keyed to. **Density modes patch, step 3.**
 *
 * One list, read by the gallery (which renders each), the coverage test
 * (which needs all three modes to differ on each) and the Pocket gate (which
 * needs each to fit). A surface added to the shell that is not added here is
 * caught by `test/visual-pocket.test.ts`'s first assertion, which reconciles
 * the three lists against each other; a screen added to the router and not to
 * this file is the one gap this cannot see, and `test/density.test.ts` holds
 * the router's count against it.
 *
 * Fourteen surfaces from the report, as fifteen fixtures: the result screen
 * has two shapes the app shows — the cards, and the capture offer that
 * arrives on a second render with the cards gone — and both are gated.
 */

/** Decision surfaces: zero scroll at 390x844 in Pocket, a hard gate. */
export const DECISION_SURFACES = [
  'starter',
  'locale',
  'map',
  'battle',
  'result',
  'result-capture',
  'target',
  'replace',
  'party',
  'pre-gym',
  'shop',
  'event',
] as const;

/** Archive surfaces: the complete outcome in the first screenful, the rest may scroll. */
export const ARCHIVE_SURFACES = ['summary', 'log-sheet'] as const;

/** The drawer: gated on its own sheet, which the document's height cannot see. */
export const OVERLAY_SURFACES = ['drawer'] as const;

export const GALLERY_SURFACES = [...DECISION_SURFACES, ...OVERLAY_SURFACES, ...ARCHIVE_SURFACES] as const;

export type GallerySurface = (typeof GALLERY_SURFACES)[number];

/**
 * The surfaces with two honest densities rather than three (ruling 5).
 *
 * Detailed differs from both; Simple equals Pocket. The measured reason for
 * each is in the patch report, and `test/visual-coverage.test.ts` asserts the
 * equality so a surface that gains a third density is noticed rather than
 * quietly exempt.
 */
export const TWO_VALUED_SURFACES = ['log-sheet', 'target'] as const;

/** The router's screens, for the count the density test holds. */
export const ROUTER_SCREEN_COUNT = 12;
