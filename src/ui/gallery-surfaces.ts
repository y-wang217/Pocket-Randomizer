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
 *
 * **M5.5 adds two more**, and they are the first fixtures that are not a
 * surface at rest: the two confirm bands, each staged by clicking the control
 * that opens it. See `CONFIRM_SURFACES`.
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

/**
 * The overlays: gated on their own sheets, which the document's height cannot
 * see. Both are windows on the shared `ui/overlay.ts` shell, so both are
 * measured the same way — a sheet that scrolls internally at 390x844 is the
 * failure, wherever the document's own height lands.
 */
export const OVERLAY_SURFACES = ['drawer', 'map-drawer'] as const;

/**
 * The two confirm bands, staged open. **Milestone M5.5, discrepancy D31.**
 *
 * They are their own category rather than `OVERLAY_SURFACES` entries because
 * they are not built on `ui/overlay.ts`: a band is a fixed strip with no
 * `__sheet`, so the overlay gate's `.${surface}__sheet` query would find
 * nothing and the assertion would pass by measuring an absence.
 *
 * **Why they exist at all.** Section 4 budgets the replace confirm at 6 and
 * the decline confirm at 6 (D22), section 9 carries a bet about their two
 * controls, and the census read `confirm overlay | absent | absent | absent` —
 * because a band only exists after a tap and every other fixture is a screen
 * at rest. `ui/band.ts` has four call sites; nothing was absent but a fixture.
 * D31.
 *
 * Both are staged by **clicking the real control**, the way the event fixture
 * reveals its outcome, so the band under measurement is the one production
 * builds rather than one this file fabricates. A hand-built band would be a
 * second copy of the thing `test/band.test.ts` exists to forbid.
 */
export const CONFIRM_SURFACES = ['confirm-replace', 'confirm-forfeit'] as const;

/**
 * The two surfaces that show a **relic** card. **Milestone M5.1, D35.**
 *
 * Decision surfaces in every respect — they gate on scroll like the rest — but
 * listed apart so the reason they exist survives. `furnish` grants the run
 * every relic, which is the honest worst case for the party screen and the
 * drawer and the *best* case for anything asking what the run lacks: both
 * `resolveOffer` and `resolveStock` collapse a relic already held, so of the
 * 28 relic cards `SMOKE24`'s map generates, **none renders on `result` or
 * `shop`**. The card whose copy is longest is the one nothing could measure.
 *
 * Rather than re-cut `furnish` under four surfaces to fix two (D35's option
 * 2), each of these stages one map-generated relic offer against a state
 * holding no relics. Nothing about the existing `result` and `shop` fixtures
 * moves, so neither baseline does.
 */
export const RELIC_SURFACES = ['result-relic', 'shop-relic'] as const;

export const GALLERY_SURFACES = [
  ...DECISION_SURFACES,
  ...RELIC_SURFACES,
  ...OVERLAY_SURFACES,
  ...CONFIRM_SURFACES,
  ...ARCHIVE_SURFACES,
] as const;

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
