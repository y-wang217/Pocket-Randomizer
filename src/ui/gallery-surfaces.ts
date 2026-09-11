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
 * The surfaces with two honest densities rather than three.
 *
 * Ruling 5 on the report let the log sheet and the target screen be
 * two-valued, on the report's finding that neither had a third density to
 * give. Measured, both have three: the chrome scale is one global axis and
 * it is visible on a sheet's padding and a member button's as on every other
 * surface, so no per-screen difference was manufactured and nothing is
 * exempt. The list is kept, empty, with the coverage test's equality
 * assertion behind it, so a surface that genuinely has two densities is
 * recorded here rather than made to differ. The measurement is in the patch
 * report.
 */
export const TWO_VALUED_SURFACES = [] as const;

/** The router's screens, for the count the density test holds. */
export const ROUTER_SCREEN_COUNT = 12;
