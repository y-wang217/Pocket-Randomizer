/**
 * The glyph sheet: the nine families of design bible section 2, in one table.
 *
 * **Milestone M1.1.** Nothing mounts these yet — the item says so in as many
 * words, and Tier 2 onward is what mounts them. This file exists so that the
 * shapes are drawn, named, colour-blind checked and held by a test *before* any
 * surface depends on one, which is the whole point of putting foundations in a
 * tier of their own.
 *
 * ## Under `ui/theme/`, beside `typeIcons.ts`, and for its reason
 *
 * Which shape draws a fact says nothing about what the fact is. `contentHash`
 * is computed over `src/data/**`, so a glyph nudged by two units in here can
 * never move a seed. `bandInfo`'s pip count is the one number this file reads
 * from `data/`, and it reads it rather than restating it.
 *
 * ## What M0.2 found, and what it saved
 *
 * The inventory (`docs/design/inventory.md`) measured the tree before this was
 * written, and four of the nine families needed nothing drawn:
 *
 * - **Type**: eighteen glyphs already exist in `typeIcons.ts`, drawn and proven
 *   against every type in the game. They are referenced here, never copied —
 *   two tables of eighteen paths would disagree within a month.
 * - **Band**: `chip.ts` already draws pips, filled to band, counting from
 *   `BAND_PIPS`. **The pair is redrawn here anyway**, and it is the one thing
 *   in this item that the measurement changed rather than confirmed: the
 *   shipped pips differ in fill tone and nothing else, which at 16px is 0.063
 *   against a floor of 0.12. Filled against outlined is 0.262. The note on
 *   the entries carries the argument.
 * - **Status**: already a three-letter chip, which is what section 2 specifies.
 *   The lettering *is* the glyph, so these entries carry text and no path.
 * - **Effectiveness**: section 2 specifies a coloured edge and a numeral, not a
 *   drawn mark. The edge is one entry so the family has a roster row.
 *
 * Sixteen shapes are new: three category, one PP, two accuracy, two priority,
 * and six stat — of which two are the category glyphs again, by section 2's own
 * instruction that the Atk and SpA rows wear the fist and the ring.
 *
 * ## The rule every glyph keeps
 *
 * One closed silhouette filling the 24-unit box, interior detail cut as an
 * even-odd hole rather than drawn as a second colour, legible **as a shape** at
 * 16px. That last is the item's kills-it condition: two glyphs in one family
 * indistinguishable at 16px under any colour-blindness simulation sends the
 * pair back to be redrawn before anything mounts them.
 * `scripts/visual/glyph-sheet.ts` measures it and
 * `docs/visual/reports/m1.1-glyph-sheet.md` carries the numbers.
 *
 * Colour is never the carrier. Every glyph here is monochrome and is drawn with
 * `currentColor`; the type chip's colour and the status chip's colour are
 * secondary channels on top, exactly as section 2 says.
 */
import { BAND_PIPS } from '../../data/bandInfo';
import type { GlyphFamily } from '../../data/glyphFamilies';
import { GLYPH_LABELS } from '../../data/glyphLabels';

import { TYPE_ICON_NAMES, TYPE_ICON_VIEWBOX, typeIconPath } from './typeIcons';

/** Every glyph is drawn in this box, the one `typeIcons.ts` already uses. */
export const GLYPH_VIEWBOX = TYPE_ICON_VIEWBOX;

/**
 * The families of design bible section 2, twelve since D47, eleven under D46. Adding one is an
 * amendment.
 *
 * **The roster lives in `data/glyphFamilies.ts` since M1.3** and is re-exported
 * here, so the sheet stays the one place to ask what a family *looks* like
 * while the exposure counter can ask what the families *are* without importing
 * a single path string.
 */
export { GLYPH_FAMILIES, type GlyphFamily } from '../../data/glyphFamilies';

/**
 * A glyph is inner SVG markup, or it is lettering.
 *
 * Markup rather than a bare `d` attribute because that is the shape
 * `typeIcons.ts` already stores — `typeIconPath` returns `<path d="..."/>` and
 * `scene.ts` interpolates it inside an `<svg>` — and referencing those eighteen
 * is worth more than a tidier field. A glyph that wanted two subpaths or a
 * `fill-rule` says so in its own markup.
 *
 * The status family is lettering by section 2's specification — BRN, PAR, PSN
 * are the glyph, not a label beside one — and a table that forced them into
 * path data would be inventing six marks the bible did not ask for.
 */
export type GlyphArt = { kind: 'markup'; markup: string } | { kind: 'text'; text: string };

export interface Glyph {
  /** Unique across the sheet. */
  id: string;
  family: GlyphFamily;
  /** The exposure label and the accessible name: one word, from `data/glyphLabels.ts` (M6.1). */
  label: string;
  art: GlyphArt;
}

/**
 * A glyph's word, from `data/glyphLabels.ts`. **M6.1.** Falls back to the id
 * rather than to a second copy of the word, so a missing entry shows as the
 * bug it is; `test/glyph-labels.test.ts` fails on one first.
 */
const labelOf = (id: string): string => GLYPH_LABELS[id] ?? id;

const path = (d: string, rule?: 'evenodd'): GlyphArt => ({
  kind: 'markup',
  markup: `<path d="${d}"${rule ? ` fill-rule="${rule}"` : ''}/>`,
});

/**
 * The fist, the ring and the wave. **Section 2's category family.**
 *
 * Drawn bold rather than detailed, because the size that matters is 16px: a
 * traced hand is a smudge there and a blunt four-knuckle block is still a fist.
 * The ring is an annulus with an even-odd hole, which is the one shape in the
 * sheet that survives any amount of shrinking.
 */
const FIST = path(
  'M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3zM7 9.5V7a1.5 1.5 0 0 1 3 0v2.5zM11 9.5V6a1.5 1.5 0 0 1 3 0v3.5zM15 9.5V7a1.5 1.5 0 0 1 3 0v2.5z',
);
const RING = path('M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zm0 5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z', 'evenodd');
const WAVE = path('M2 8.5c3.2-3.4 5.3 3.4 8.5 0s5.3 3.4 8.5 0v4c-3.2 3.4-5.3-3.4-8.5 0s-5.3-3.4-8.5 0z');

/** A solid shield and the same shield hollowed. **The Def and SpD pair.** */
const SHIELD = path('M12 2l8.5 3.2v6.3c0 5.4-3.7 9.6-8.5 11.5-4.8-1.9-8.5-6.1-8.5-11.5V5.2z');
const SHIELD_HOLLOW = path(
  'M12 2l8.5 3.2v6.3c0 5.4-3.7 9.6-8.5 11.5-4.8-1.9-8.5-6.1-8.5-11.5V5.2zm0 3.2L6.5 7.3v4.2c0 3.6 2.3 6.5 5.5 8 3.2-1.5 5.5-4.4 5.5-8V7.3z',
  'evenodd',
);

/**
 * The sheet.
 *
 * Order is family order, and family order is section 2's table order, so this
 * roster and that table can be read side by side.
 */
export const GLYPHS: readonly Glyph[] = [
  // Type: referenced from `typeIcons.ts`, never restated. Eighteen entries.
  ...TYPE_ICON_NAMES.map((name): Glyph => ({
    id: `type-${name}`,
    family: 'type',
    label: name,
    art: { kind: 'markup', markup: typeIconPath(name) ?? '' },
  })),

  { id: 'category-physical', family: 'category', label: labelOf('category-physical'), art: FIST },
  { id: 'category-special', family: 'category', label: labelOf('category-special'), art: RING },
  { id: 'category-status', family: 'category', label: labelOf('category-status'), art: WAVE },

  /*
   * Band: a filled pip and an **outlined** one.
   *
   * **This pair is a redraw, and the measurement is why.** `chip.ts` ships
   * these as CSS boxes that differ in fill tone and nothing else —
   * `.band__pip` is `--bg-sunken` with a hairline, `[data-on]` is
   * `--text-dim` — so as *shapes* they are the same mark twice. Rasterised at
   * 16px they separate by **0.063**, half the floor, and M1.1's kills-it
   * condition is exactly that: redraw the pair before anything mounts it.
   *
   * A tone difference is a legitimate channel and it survives every
   * simulation, since all three preserve luminance. It is not enough on its
   * own at this size, against a background whose own tone the density modes
   * move. Filled against outlined separates by shape *and* keeps the tone
   * difference, so the pair reads two ways instead of one.
   *
   * Section 2 is unmoved by this: "one pip per band, filled to band" says what
   * a filled pip means and nothing about how an empty one is drawn.
   */
  { id: 'band-pip-on', family: 'band', label: labelOf('band-pip-on'), art: path('M12 5.2a6.8 6.8 0 1 0 0 13.6 6.8 6.8 0 0 0 0-13.6z') },
  {
    id: 'band-pip-off',
    family: 'band',
    label: labelOf('band-pip-off'),
    art: { kind: 'markup', markup: '<circle cx="12" cy="12" r="6.2" fill="none" stroke="currentColor" stroke-width="1.2"/>' },
  },

  // PP: a drop. A supply that is spent, which is the fact the number beside it
  // quantifies. Distinct from every round shape in the sheet by its point.
  { id: 'pp', family: 'pp', label: labelOf('pp'), art: path('M12 2.5c0 0 7 7.8 7 11.6A7 7 0 1 1 5 14.1C5 10.3 12 2.5 12 2.5z') },

  // Accuracy: a bullseye, and a dart for the move that cannot miss. Rings
  // against a solid wedge — the pair the kills-it condition is really about.
  {
    id: 'accuracy-target',
    family: 'accuracy',
    label: labelOf('accuracy-target'),
    art: path(
      'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3.2a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6zm0 3.6a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z',
      'evenodd',
    ),
  },
  { id: 'accuracy-never-miss', family: 'accuracy', label: labelOf('accuracy-never-miss'), art: path('M21.5 2.5l-8.2 19-3.1-7.7-7.7-3.1z') },

  // Priority: two triangles. Mirror images, which is the most separable pair
  // two glyphs in one family can be.
  { id: 'priority-up', family: 'priority', label: labelOf('priority-up'), art: path('M12 5.5l8 10.5H4z') },
  { id: 'priority-down', family: 'priority', label: labelOf('priority-down'), art: path('M12 18.5L4 8h16z') },

  // Effectiveness: section 2 specifies an edge and a numeral, not a mark. The
  // edge is the entry.
  { id: 'effectiveness-edge', family: 'effectiveness', label: labelOf('effectiveness-edge'), art: path('M3 2.5h5.5v19H3z') },

  // Status: the lettering is the glyph, per section 2.
  { id: 'status-brn', family: 'status', label: labelOf('status-brn'), art: { kind: 'text', text: 'BRN' } },
  { id: 'status-par', family: 'status', label: labelOf('status-par'), art: { kind: 'text', text: 'PAR' } },
  { id: 'status-psn', family: 'status', label: labelOf('status-psn'), art: { kind: 'text', text: 'PSN' } },
  { id: 'status-tox', family: 'status', label: labelOf('status-tox'), art: { kind: 'text', text: 'TOX' } },
  { id: 'status-slp', family: 'status', label: labelOf('status-slp'), art: { kind: 'text', text: 'SLP' } },
  { id: 'status-frz', family: 'status', label: labelOf('status-frz'), art: { kind: 'text', text: 'FRZ' } },

  // Stat: six rows, and two of them are the category glyphs again because
  // section 2 says the Atk and SpA rows wear the fist and the ring.
  { id: 'stat-hp', family: 'stat', label: labelOf('stat-hp'), art: path('M9.8 2.5h4.4v7.3h7.3v4.4h-7.3v7.3H9.8v-7.3H2.5V9.8h7.3z') },
  { id: 'stat-atk', family: 'stat', label: labelOf('stat-atk'), art: FIST },
  { id: 'stat-def', family: 'stat', label: labelOf('stat-def'), art: SHIELD },
  { id: 'stat-spa', family: 'stat', label: labelOf('stat-spa'), art: RING },
  { id: 'stat-spd', family: 'stat', label: labelOf('stat-spd'), art: SHIELD_HOLLOW },
  { id: 'stat-spe', family: 'stat', label: labelOf('stat-spe'), art: path('M2.5 4.5l8 7.5-8 7.5zm9.5 0l8 7.5-8 7.5z') },

  /*
   * **Capability: the tenth family. D37, 2026-09-22.**
   *
   * Section 3 has asked for a *"capability glyph plus band chevron"* on the
   * map node since Rev 1; section 2's roster never carried the family, and
   * nothing noticed because the map drew a word chip. M5.2 is the item that
   * has to make section 3 true, so the family arrives here.
   *
   * **Eight marks, one per capability, on the type family's pattern.** A
   * generic "this node is gated" mark would not do: *which* capability a node
   * asks for is what decides whether the player can take it, so C2 makes it a
   * fact that has to be encoded rather than collapsed.
   *
   * Separation is measured *within* a family, so these eight are drawn for
   * silhouette rather than for detail — a diagonal blade, a flat lens, a solid
   * block, a T, a chevron, three bars, an arrow into a floor, a burst. Eight
   * outlines that stay apart when every one of them is 16 pixels across.
   */
  { id: 'capability-cut', family: 'capability', label: labelOf('capability-cut'), art: path('M4.5 20.5l12-16 3 2.2-12 16z') },
  { id: 'capability-surf', family: 'capability', label: labelOf('capability-surf'), art: path('M2 12c0-2.6 4.5-4.7 10-4.7s10 2.1 10 4.7-4.5 4.7-10 4.7S2 14.6 2 12z') },
  { id: 'capability-strength', family: 'capability', label: labelOf('capability-strength'), art: path('M4.5 4.5h15v15h-15z') },
  { id: 'capability-rockSmash', family: 'capability', label: labelOf('capability-rockSmash'), art: path('M3 3h18v5H3zm7.2 5h3.6v13h-3.6z') },
  { id: 'capability-fly', family: 'capability', label: labelOf('capability-fly'), art: path('M12 3.5L22 18h-5.2L12 10.6 7.2 18H2z') },
  { id: 'capability-waterfall', family: 'capability', label: labelOf('capability-waterfall'), art: path('M4 2.5h3.2v19H4zm6.4 0h3.2v19h-3.2zm6.4 0H20v19h-3.2z') },
  { id: 'capability-dive', family: 'capability', label: labelOf('capability-dive'), art: path('M9.4 2.5h5.2v10h4.4L12 21 5 12.5h4.4z') },
  { id: 'capability-flash', family: 'capability', label: labelOf('capability-flash'), art: path('M10.6 2h2.8v6h-2.8zm0 14h2.8v6h-2.8zM2 10.6h6v2.8H2zm14 0h6v2.8h-6zM4.6 6.6l2-2 4.2 4.2-2 2zm10.6 10.6l2-2 4.2 4.2-2 2zM4.6 17.4l4.2-4.2 2 2-4.2 4.2zm10.6-10.6l4.2-4.2 2 2-4.2 4.2z') },

  /*
   * **The band chevron, filled and hollow.** Section 3's three states — none,
   * latent, known — are drawn as two chevrons with 0, 1 or 2 of them filled,
   * which is the band pips' own pattern one family up rather than three more
   * silhouettes competing inside this family.
   *
   * Filled against outlined for the reason the band pips were redrawn: a tone
   * difference alone measured half the floor at 16px, and shape plus tone
   * reads two ways instead of one.
   */
  { id: 'capability-band-on', family: 'capability', label: labelOf('capability-band-on'), art: path('M12 6.5l7 9H5z') },
  {
    id: 'capability-band-off',
    family: 'capability',
    label: labelOf('capability-band-off'),
    art: { kind: 'markup', markup: '<path d="M12 7.6l5.6 7.2H6.4z" fill="none" stroke="currentColor" stroke-width="1.4"/>' },
  },

  /*
   * **Node: the eleventh family. D46, 2026-09-25. Patch 4.10.1.**
   *
   * One mark per node kind, where the map printed a word and the battle
   * header printed the same word. The prompt named two of them — *"Trainer is
   * a head symbol. Wild is a bush symbol"* — and said to take the shop and the
   * event from what exists: the event's `?` has been the map's own mark since
   * Stage 3, and the shop's bag is the item sheet's silhouette. The rest and
   * the gym were the plan's defaults, a tent and an eight-pointed badge, and
   * the ruling took them.
   *
   * Six silhouettes in one family, so drawn for outline rather than detail: a
   * head on shoulders, three lobes on a stem, a triangle with a door cut
   * even-odd, a star, a bag with a hole for the handle, and a `?` thick enough
   * to survive 16px. The head against the bush and the tent against the badge
   * are the pairs the separation sheet is there to catch.
   */
  { id: 'node-wild', family: 'node', label: labelOf('node-wild'), art: path('M12 3.5a4.2 4.2 0 0 1 4.1 3.3 4 4 0 0 1 4.4 4 4 4 0 0 1-2.4 3.7c.3 2-1.2 3.7-3.2 3.7h-1.6V21h-2.6v-2.8H9.1c-2 0-3.5-1.7-3.2-3.7A4 4 0 0 1 3.5 10.8a4 4 0 0 1 4.4-4A4.2 4.2 0 0 1 12 3.5z') },
  { id: 'node-trainer', family: 'node', label: labelOf('node-trainer'), art: path('M12 2.5a4.6 4.6 0 0 1 4.6 4.6v1.2A4.6 4.6 0 0 1 12 12.9a4.6 4.6 0 0 1-4.6-4.6V7.1A4.6 4.6 0 0 1 12 2.5zM3 21.5c0-4.3 3.6-7.4 9-7.4s9 3.1 9 7.4z') },
  { id: 'node-rest', family: 'node', label: labelOf('node-rest'), art: path('M12 2.5l10.5 18.5h-21zm0 9.2l-3.4 6.3h6.8z', 'evenodd') },
  { id: 'node-gym', family: 'node', label: labelOf('node-gym'), art: path('M12 2l2.4 5.6 5.8-1.8-3.4 5.2 5.2 3.4-5.8 1.6L14.4 22 12 16.6 9.6 22l-1.8-6-5.8-1.6 5.2-3.4-3.4-5.2 5.8 1.8z') },
  { id: 'node-shop', family: 'node', label: labelOf('node-shop'), art: path('M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5h3.2l1.3 13H4l1.3-13zm2.2 0h2.6V7a1.3 1.3 0 0 0-2.6 0z', 'evenodd') },
  { id: 'node-event', family: 'node', label: labelOf('node-event'), art: path('M12 2.5c3.6 0 6.2 2.3 6.2 5.5 0 2.3-1.3 3.6-2.6 4.6-1.1.8-1.7 1.4-1.7 2.6v.6h-3.6v-.9c0-2.2 1-3.4 2.4-4.4 1.1-.8 1.7-1.4 1.7-2.4 0-1.2-1-2.1-2.4-2.1-1.5 0-2.5 1-2.6 2.5H5.7c.1-3.6 2.7-6 6.3-6zM10.1 17.7h3.8v3.8h-3.8z') },

  /*
   * The field family. **Stage 4.11 Tier 2, D47.** Nine marks for the state of
   * the board: what the sky is doing, and what the ground is doing.
   *
   * Two shapes on purpose. The five weathers float, each a silhouette of the
   * thing itself. The four terrains all stand on a ground bar along the
   * bottom, which is the family's own cue that this is the ground and not the
   * sky, and the mark above the bar is the type the terrain favours: a bolt,
   * blades, a bank of mist, an eye. Heavy rain wears the rain mark and Extreme
   * sun the sun mark, by the ruling; inspect tells them apart.
   *
   * The pairs to watch on the separation sheet: sand against wind (both
   * horizontal), misty against sand (both banded), and grassy against
   * electric (both spikes on a bar). Sand is a filled dune, wind is three
   * stroked lines, mist is three stacked bars of unequal width, and the bolt
   * is one shape where the blades are three.
   */
  { id: 'field-rain', family: 'field', label: labelOf('field-rain'), art: path('M7 12.5a4.2 4.2 0 0 1-.4-8.4A5.5 5.5 0 0 1 17.2 5a3.8 3.8 0 0 1 .3 7.5zM7.2 15l-2 4.2h2.2l2-4.2zm4.4 0l-2 4.2h2.2l2-4.2zm4.4 0l-2 4.2h2.2l2-4.2z') },
  { id: 'field-sun', family: 'field', label: labelOf('field-sun'), art: path('M12 7.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6zM11 1.5h2v3.4h-2zm0 17.6h2v3.4h-2zM1.5 11h3.4v2H1.5zm17.6 0h3.4v2h-3.4zM4.2 5.6l1.4-1.4 2.4 2.4-1.4 1.4zm12.8 12.8l1.4-1.4 2.4 2.4-1.4 1.4zM4.2 18.4l2.4-2.4 1.4 1.4-2.4 2.4zM17 6.6l2.4-2.4 1.4 1.4-2.4 2.4z') },
  { id: 'field-sand', family: 'field', label: labelOf('field-sand'), art: path('M2 19.5c2.4-5.6 5.2-8.4 8.4-8.4 2.3 0 3.6 1.4 5 3.2 1.4 1.8 2.9 3.4 6.6 3.4v1.8zM5.5 6.5h2v2h-2zm5-3h2v2h-2zm5.5 2h2v2h-2zM8 10.2h2v2H8zm8.5-1.4h2v2h-2z') },
  { id: 'field-snow', family: 'field', label: labelOf('field-snow'), art: path('M11 2h2v20h-2zM2 11h20v2H2zM4.6 6l1.4-1.4L19.4 18 18 19.4zM4.6 18L18 4.6 19.4 6 6 19.4zM9.2 3.8L12 6.6l2.8-2.8 1.4 1.4L12 9.4 7.8 5.2zm0 16.4L12 17.4l2.8 2.8 1.4-1.4L12 14.6l-4.2 4.2zM3.8 9.2L6.6 12l-2.8 2.8 1.4 1.4L9.4 12 5.2 7.8zm16.4 0L17.4 12l2.8 2.8-1.4 1.4L14.6 12l4.2-4.2z') },
  { id: 'field-wind', family: 'field', label: labelOf('field-wind'), art: path('M2 6.5h11.5a2.8 2.8 0 1 0-2.6-3.7l1.9.6a.8.8 0 1 1 .7 1.1H2zm0 5h16.2a3.3 3.3 0 1 0-3.1-4.4l1.9.7a1.3 1.3 0 1 1 1.2 1.7H2zm0 5h12.4a2.8 2.8 0 1 1-2.6 3.7l1.9-.6a.8.8 0 1 0 .7-1.1H2z') },
  { id: 'field-electric', family: 'field', label: labelOf('field-electric'), art: path('M13.5 2L5.5 12.5h5l-1.6 6.2 8-10.2h-5zM2 20.5h20v2H2z') },
  { id: 'field-grassy', family: 'field', label: labelOf('field-grassy'), art: path('M6.5 18.5c-.8-4.6.2-9.4 2-13.5.9 3.8 1 8.5.4 13.5zm5.2 0c-1-5.2-.2-10.6 2.3-15.5.5 4.7 0 10.4-.6 15.5zm4.9 0c-.6-3.8.3-7.8 1.9-11.2.6 3.2.5 7.4-.2 11.2zM2 20.5h20v2H2z') },
  { id: 'field-misty', family: 'field', label: labelOf('field-misty'), art: path('M4 5.5h12v2.4H4zm4 4.6h14v2.4H8zM2 14.7h13v2.4H2zM2 20.5h20v2H2z') },
  { id: 'field-psychic', family: 'field', label: labelOf('field-psychic'), art: path('M12 5.5c4.6 0 8.2 3 9.7 6-1.5 3-5.1 6-9.7 6s-8.2-3-9.7-6c1.5-3 5.1-6 9.7-6zm0 2.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2zm0 1.8a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM2 20.5h20v2H2z') },
];

/** The glyphs of one family, in sheet order. */
export function glyphsOf(family: GlyphFamily): Glyph[] {
  return GLYPHS.filter((glyph) => glyph.family === family);
}

/**
 * How many pips the band family draws, read rather than restated.
 *
 * M1.1's own wording: *"Band pip count is read from `bandInfo`, not
 * hardcoded."* It already was — `chip.ts` has imported `BAND_PIPS` since
 * 4.8.0.3 — and this re-export is what lets the sheet's roster say so too.
 */
export const GLYPH_BAND_PIPS = BAND_PIPS;

/** The two sizes the item requires every glyph to render at. */
export const GLYPH_SIZES = [24, 16] as const;
