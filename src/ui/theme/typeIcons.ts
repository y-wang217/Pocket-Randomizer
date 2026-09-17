/**
 * One glyph per Pokemon type, for the watermark on a battle move button.
 *
 * Chip-audit patch, 2026-09-17, item 3. The brief: "since we have some dead
 * space inside move cards (in battle), i'd like a small QOL to show types in
 * certain colors [...] as a visibility to enforce what type each is. these
 * icons should be 50% opacity max, and shouldn't distract."
 *
 * ## Under `ui/theme/`, like `itemIcons.ts`, and for the same reason
 *
 * Which shape draws a type says nothing about what the type does. `contentHash`
 * is computed over `src/data/**`, so a glyph nudged by two units in here can
 * never move a seed. A file of eighteen path strings is exactly the kind of
 * thing that gets nudged.
 *
 * ## Why these are abstract marks and not the reference art
 *
 * The brief arrived with a sheet of eighteen circular icons — a flat white
 * glyph on a filled disc in the type's colour — and these follow its vocabulary
 * (a ring for Normal, a hex nut for Steel, a crescent for Dark, a spiral for
 * Psychic) without tracing it. Two reasons. The sheet is somebody else's
 * artwork and this repo ships no asset it did not draw; and a watermark at 22%
 * of full strength behind a move name is not a place where detail survives —
 * a traced Dragon head would be a smudge at 36px and 0.22 alpha, whereas a
 * silhouette still reads. **Every glyph is a single closed silhouette**, drawn
 * to fill its 24-unit box, with any interior detail cut as an even-odd hole
 * rather than drawn as a second colour.
 *
 * ## The one rule a new glyph must keep
 *
 * It must be legible as a *shape at a glance*, because that is the whole
 * function: the type is already written on the chip beside it in words. This
 * is redundancy, deliberately — a second channel for a fact the player reads
 * four times a turn — and a redundant channel that needs study is worse than
 * no channel. `test/type-icons.test.ts` holds the roster and the box; it
 * cannot hold legibility, and `docs/visual/reports/` carries the contact
 * sheet that was actually looked at.
 */

/** Every glyph is drawn in this box. `test/type-icons.test.ts` holds it. */
export const TYPE_ICON_VIEWBOX = '0 0 24 24';

/**
 * Type name, lowercased, to the inner markup of its glyph.
 *
 * Lowercased keys because the dex spells a type `'Fire'` and a CSS class spells
 * it `type--fire`; one spelling here, and the lookup does the folding.
 */
const TYPE_ICON_PATHS: Readonly<Record<string, string>> = {
  // A ring. The type with no character, drawn as the shape with no features.
  normal:
    '<path d="M12 2.5A9.5 9.5 0 1 0 12 21.5 9.5 9.5 0 1 0 12 2.5Zm0 5.8a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4Z"/>',
  // A fist: four knuckles over a closed palm.
  fighting:
    '<path d="M5 10.4h14v6.1a4.5 4.5 0 0 1-4.5 4.5h-5A4.5 4.5 0 0 1 5 16.5Zm.6-6.2h2.2v5.2H5.6Zm3.6-1.1h2.2v6.3H9.2Zm3.6 0H15v6.3h-2.2Zm3.6 1.1h2.2v5.2h-2.2Z"/>',
  // A wing, three feathers deep.
  flying:
    '<path d="M22 4.6c-9.2-.5-15.6 2.2-19.4 8.2-.5.8.4 1.7 1.2 1.2 2-1.2 4.2-1.9 6.6-2.1-1.3 1.1-2.3 2.4-3 3.9-.4.9.7 1.7 1.4 1 1.7-1.6 3.6-2.6 5.8-3-.8 1-1.4 2.1-1.8 3.3-.3.9.9 1.6 1.5.8C16.6 13.5 19.4 9.5 22 4.6Z"/>',
  // A skull: the sheet's rounded cranium with a jaw and two sockets.
  poison:
    '<path fill-rule="evenodd" d="M12 2.8c4.9 0 8.2 3.3 8.2 7.3 0 2.2-1 4-2.7 5.2v2.4a3.3 3.3 0 0 1-3.3 3.3h-4.4a3.3 3.3 0 0 1-3.3-3.3v-2.4C4.8 14.1 3.8 12.3 3.8 10.1c0-4 3.3-7.3 8.2-7.3Zm-3.3 6a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Zm6.6 0a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z"/>',
  // Strata: a thin bed and a thick one, as on the sheet.
  ground:
    '<path d="M8.4 3.6h3.1L7.2 20.4H3.3ZM14.4 3.6h6.3L22.4 20.4H10.7Z"/>',
  // A faceted boulder. The facets are hairline cuts, not a bite out of the
  // silhouette: a cut wide enough to see at a glance stopped reading as stone.
  rock: '<path fill-rule="evenodd" d="M3.2 8.1 10.4 2.4l10.4 3.1-2.2 12.3-9.7 3.8Zm7 4.8-1-9.7.9-.1 1 9.7Zm1 .6 8.4-6.8.6.7-8.5 6.9Z"/>',
  // A beetle: a head, two antennae, and two elytra with a split between them.
  // Drawn as separate solids rather than one silhouette with the split cut out
  // of it — an even-odd cut left the body as a hairline outline, which read as
  // a stick figure.
  bug: '<path d="M12 2.2a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8ZM11.3 7.4c-3.1.5-5.4 3-5.4 6.4s2.3 6.2 5.4 6.6Zm1.4 0c3.1.5 5.4 3 5.4 6.4s-2.3 6.2-5.4 6.6ZM6.9 1.4l1.2-.8 2.4 3.5-1.2.8Zm10.2 0 1.2.8-2.4 3.5-1.2-.8Z"/>',
  // A speech-bubble ghost with two eyes, as on the sheet.
  ghost:
    '<path fill-rule="evenodd" d="M12 3c5 0 9 3.3 9 7.5 0 4.2-4 7.5-9 7.5-.7 0-1.4-.1-2.1-.2L4.6 21l1.6-4.3C4.2 15.3 3 13 3 10.5 3 6.3 7 3 12 3Zm-2.7 5.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm5.4 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>',
  // A hex nut.
  steel:
    '<path fill-rule="evenodd" d="M12 2.2 20.5 7v10L12 21.8 3.5 17V7Zm0 6.2a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z"/>',
  // A flame with the inner tongue cut out.
  fire: '<path fill-rule="evenodd" d="M13.1 1.8c.7 4.4-4.8 6.1-4.8 10.4 0 .7.1 1.3.4 1.9-1-.6-1.7-1.6-2-2.8-1.4 1.6-2.2 3.5-2.2 5.3 0 3.4 3 6 6.9 6s6.9-2.6 6.9-6.3c0-5.2-5.2-6.8-5.2-11.1 0-1.3.4-2.4 1.1-3.4ZM11.8 11c.3 2.4 2.7 3.2 2.7 5.5 0 1.6-1.2 2.7-2.8 2.7s-2.8-1.1-2.8-2.6c0-2.3 2.3-3.1 2.9-5.6Z"/>',
  // A droplet with a highlight cut out.
  water:
    '<path fill-rule="evenodd" d="M12 1.9c4.5 5.6 7.1 9.2 7.1 12.4A7.1 7.1 0 0 1 4.9 14.3C4.9 11.1 7.5 7.5 12 1.9Zm2.2 8.3c-.9 1.3-3.6 2.1-3.6 4.6 0 1.7 1.3 2.9 3 2.9s3-1.2 3-2.9c0-1.8-1.2-3.3-2.4-4.6Z"/>',
  // A leaf, veins cut.
  grass:
    '<path fill-rule="evenodd" d="M21 2.4c-11 0-17 5-17 12.1 0 1.8.4 3.4 1.2 4.7l4.6-4.6V9.3l2.3 4 2.8-2.8v4.1l-3.3 3.3 2.5 2.5C19 18.6 21 11.6 21 2.4Z"/>',
  // A bolt.
  electric: '<path d="M14.9 1.6 4.6 13.9h5.2L9.1 22.4l10.3-12.3h-5.2Z"/>',
  // A spiral, drawn as a closed silhouette that tightens inward.
  psychic:
    '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 10 10h-3a7 7 0 1 1-7-7Zm0 4.6A5.4 5.4 0 0 0 12 17.4a5.4 5.4 0 0 0 5.4-5.4h-3a2.4 2.4 0 1 1-2.4-2.4Z"/>',
  // A six-point snowflake.
  ice: '<path d="M10.6 1.9h2.8v6.4l4.5-4.5 2 2-4.5 4.5h6.4v2.8h-6.4l4.5 4.5-2 2-4.5-4.5v6.4h-2.8v-6.4l-4.5 4.5-2-2 4.5-4.5H1.6v-2.8H8L3.5 5.8l2-2 4.5 4.5Z"/>',
  // A dragon head in profile, facing left: blunt snout, open jaw, swept-back
  // horn, eye cut. The snout is blunt on purpose — a pointed one made the whole
  // silhouette read as an arrowhead, which is the shape this glyph must not be.
  dragon:
    '<path fill-rule="evenodd" d="M3.2 14.2c0-2.8 2.2-5 5-5.6l3-3.2 9.4-2.6-4.2 6.2c1.8 1.4 2.6 3.4 2.6 5.4 0 3.4-2.8 6-6.2 6L4.6 17.6Zm2.4.8 7.6 1.8v-3Zm7-4.8a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z"/>',
  // A crescent.
  dark: '<path d="M15.6 2.4A10 10 0 1 0 21.4 16 8 8 0 0 1 15.6 2.4Z"/>',
  // A four-point sparkle. Four and not six, so that a glance never confuses it
  // with Ice: those two are the pair most at risk from each other.
  fairy: '<path d="M12 1.4Q13.1 10.9 22.6 12 13.1 13.1 12 22.6 10.9 13.1 1.4 12 10.9 10.9 12 1.4Z"/>',
  // A five-point star, for the one type the sheet does not carry.
  stellar: '<path d="M12 1.8 15.1 8.6l7.4.9-5.5 5 1.5 7.3L12 18.1l-6.5 3.7L7 14.5l-5.5-5 7.4-.9Z"/>',
};

/**
 * The glyph for a type, or `null` for one with no icon.
 *
 * `null` rather than a fallback mark, deliberately. A watermark is redundant
 * information — the type is written in words on the chip beside it — so a type
 * this table has never heard of should draw nothing at all rather than draw a
 * shape the player would try to learn. `'???'` and any future type reach this
 * branch.
 */
export function typeIconPath(type: string): string | null {
  return TYPE_ICON_PATHS[type.toLowerCase()] ?? null;
}

/** Every type this module draws, for the test that pins the roster. */
export const TYPE_ICON_NAMES: readonly string[] = Object.keys(TYPE_ICON_PATHS);
