/**
 * The nine glyph families of design bible section 2, as a roster.
 *
 * **Moved here by M1.3, from `ui/theme/glyphs.ts` where M1.1 put them.**
 *
 * The names are needed in three places that must not depend on each other: the
 * sheet that draws them (`ui/theme/glyphs.ts`), the exposure counter that
 * tracks how often a player has met each (`ui/settings.ts`), and — when M6.1
 * arrives — the labels keyed by family. A roster that lived in the sheet would
 * make the settings store import the drawings, which M1.1's own test forbids in
 * as many words: *"do not mount any glyph on any screen yet."*
 *
 * So the list is data, the sheet re-exports it, and the store reads it without
 * ever reaching a path string.
 *
 * ## Adding a tenth is an amendment
 *
 * Section 2 says so, and section 10.3 makes it a stop-and-file rather than a
 * patch. Discrepancy D5 is the worked example: M5.4 wanted an exposure label on
 * the capture card's coverage rows, which would have been a tenth family, and
 * the ruling was that the plus and minus signs are permanent instead.
 *
 * ## Excluded from `contentHash`
 *
 * Listed in `build-config/content-hash.ts`. Nothing under `src/core/` imports
 * it at any depth — it is a presentation roster — and which symbols a player
 * has been shown cannot change what a seed generates.
 */

/** The nine families, in section 2's own table order. */
export const GLYPH_FAMILIES = [
  'type',
  'category',
  'band',
  'pp',
  'accuracy',
  'priority',
  'effectiveness',
  'status',
  'stat',
] as const;

export type GlyphFamily = (typeof GLYPH_FAMILIES)[number];

/** Whether a string names a family, for reading a stored counter back. */
export function isGlyphFamily(value: unknown): value is GlyphFamily {
  return typeof value === 'string' && (GLYPH_FAMILIES as readonly string[]).includes(value);
}
