/**
 * The one place a glyph becomes a node. **Milestone M2.1.**
 *
 * M1.1 drew the nine families and deliberately mounted none of them: *"Do not
 * mount any glyph on any screen yet."* `test/glyphs.test.ts` held that by
 * walking `src/ui/` for importers of the sheet and asserting there were none.
 * M2.1 is the item that mounts the first ones, so that assertion changes shape
 * rather than disappearing — **this file is the only importer of the sheet in
 * the rendering tree**, and the test now says so.
 *
 * Why that matters is R1. A glyph the screens could each draw for themselves
 * is a glyph that renders at a different size on the battle button than on the
 * reward card, and section 5's whole premise is one component per attribute
 * cluster. One renderer is the cheapest possible version of that rule: every
 * mark in the game comes out of this function, at one of the two sizes M1.1
 * measured, with the family on the element so the exposure store and the
 * stylesheet can both find it.
 *
 * ## The label is not rendered here
 *
 * R7's first-exposure label is M6.1's item and is driven by the exposure store,
 * not by the glyph. This function marks the family (`data-family`) so M6.1 has
 * something to key from, and renders no text of its own.
 */
import { el } from '../dom';
import { GLYPHS, GLYPH_VIEWBOX, type Glyph } from './glyphs';
import type { GlyphFamily } from '../../data/glyphFamilies';

const BY_ID = new Map<string, Glyph>(GLYPHS.map((glyph) => [glyph.id, glyph]));

/** The sizes M1.1 measured the sheet at. A third is an amendment to that item. */
export type GlyphSize = 24 | 16;

export interface GlyphOptions {
  /** 16 unless a surface says otherwise. The card face is a 16px surface. */
  size?: GlyphSize;
  /**
   * An accessible name, when the glyph is the *only* carrier of a fact.
   *
   * Omitted, the mark is `aria-hidden` — which is the right default and the
   * common case, because a glyph almost always sits beside the number or the
   * name it qualifies and announcing it would read the fact twice. The type
   * chip is the exception: once the word goes, the glyph is the only thing
   * naming the type, so it carries the name.
   */
  label?: string;
  /** Extra classes a slot needs. */
  extra?: string;
}

/**
 * One glyph, by id, or null when the sheet has no such mark.
 *
 * Null rather than a placeholder, for the reason `genderMark` returns the
 * empty string: a box with a question mark in it is a symbol the player has to
 * learn in order to ignore. A caller that asks for a glyph that is not there
 * renders nothing and says whatever it was going to say some other way.
 */
export function glyphNode(id: string, options: GlyphOptions = {}): HTMLElement | null {
  const glyph = BY_ID.get(id);
  if (!glyph) return null;
  const { size = 16, label, extra } = options;

  const node = el('span', `glyph glyph--${glyph.family}${extra ? ` ${extra}` : ''}`);
  node.dataset['glyph'] = glyph.id;
  // The family, not the id: M6.1's exposure labels are per family, R7 counts
  // per family, and a stylesheet rule that wanted one mark can still reach it
  // through `data-glyph`.
  node.dataset['family'] = glyph.family;
  node.style.setProperty('--glyph-size', `${size}px`);

  if (label) node.setAttribute('aria-label', label);
  else node.setAttribute('aria-hidden', 'true');

  if (glyph.art.kind === 'text') {
    // Section 2 specifies the status family *as* lettering — BRN is the glyph,
    // not a label beside one — so it renders as text and is not counted as a
    // word by the census for the same reason a bare number is not.
    node.classList.add('glyph--lettering');
    node.textContent = glyph.art.text;
    return node;
  }

  node.innerHTML = `<svg viewBox="${GLYPH_VIEWBOX}" fill="currentColor" aria-hidden="true" focusable="false">${glyph.art.markup}</svg>`;
  return node;
}

/**
 * The glyph id for a type.
 *
 * Lowercased, because `typeIcons.ts` keys its table that way on purpose — the
 * dex spells a type `'Fire'` and a CSS class spells it `type--fire`, so the
 * folding happens once, at the lookup, and the sheet's ids inherit it.
 */
export function typeGlyphId(type: string): string {
  return `type-${type.toLowerCase()}`;
}

/** The glyph id for a move category. */
export function categoryGlyphId(category: string): string {
  return `category-${category.toLowerCase()}`;
}

/**
 * Mark a node as the painted instance of a family that has no glyph drawn for
 * it here. **Milestone M6.1, D41.**
 *
 * Section 5's canon row says the exposure label is *"rendered by the glyph"*,
 * and `ui/exposure-labels.ts` finds a family by the `data-family` this file
 * writes. Two marks in the game report a family without being a drawing in the
 * sheet: the effectiveness forecast, which section 2 specifies as an edge and a
 * numeral, and a volatile condition, which D19 put in the Status family as
 * lettering the sheet never drew. They come through here, so the one attribute
 * the labels key from is still written in one file. Anything the sheet does
 * draw goes through `glyphNode` instead.
 */
export function markFamily(node: HTMLElement, family: GlyphFamily): HTMLElement {
  node.dataset['family'] = family;
  return node;
}

/** Every family, for a caller that needs to enumerate rather than name one. */
export type { GlyphFamily };
