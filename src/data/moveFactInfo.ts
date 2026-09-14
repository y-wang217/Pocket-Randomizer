/**
 * The icons and words for the move fact strip. **Patch 4.8.0.3, item 2.**
 *
 * `core/moveFacts.ts` decides *which* facts a move has. This decides what each
 * one looks like and what it says when tapped. The split is the usual one: a
 * glyph change must not be a logic change.
 *
 * ## An icon nobody can decode is worse than the row it replaced
 *
 * Every icon here is a trigger on the existing tooltip layer — `data-tip`, one
 * delegated listener, `ui/tooltips.ts` — and the panel it raises names the
 * field in words. No second mechanism, and no icon that can only be learned by
 * guessing.
 *
 * Where a fact is also a move tag, **the words come from `data/moveTags.ts`**
 * rather than being written again here. The strip and the explanation are two
 * presentations of one fact and they must not drift into two descriptions of
 * it. `secondary` is the one entry with no tag behind it, so it carries its
 * own.
 *
 * ## The editorial rule, applied to nine labels
 *
 * "Contact" is what the move does. "Risky" would be what it is worth, and
 * nothing here says that. `30%` is a chance; "good odds" is a reading of one.
 * The blurbs state mechanics and stop.
 *
 * ## Excluded from `contentHash`, and why that is allowed
 *
 * Read by `ui/scene.ts` and `ui/tooltips.ts` only; nothing under `core/`
 * imports it at any depth, which is the rule in
 * `build-config/content-hash.ts` and is walked by `test/content-hash.test.ts`.
 * Which glyph stands for contact is not a balance fact, and a seed made before
 * this patch is the same seed after it.
 */
import { MOVE_TAG_BY_ID, type MoveTagId } from './moveTags';
import type { MoveFactId } from '../core/moveFacts';

export interface MoveFactDefinition {
  /**
   * The glyph on the face.
   *
   * Text rather than an image or an inline SVG: the strip renders once per
   * move per turn on the tightest surface in the game, and a glyph inherits
   * the chip's size, weight and colour for free. None of them is a colour.
   */
  icon: string;
  /** The field's name, in words. What the icon decodes to. */
  label: string;
  /** What the field claims. A mechanic, never a judgement about one. */
  blurb: string;
}

/** For the eight fields that are also tags, the tag's own words. */
function fromTag(id: MoveTagId, icon: string, label?: string): MoveFactDefinition {
  const tag = MOVE_TAG_BY_ID[id];
  return { icon, label: label ?? tag.long, blurb: tag.blurb };
}

export const MOVE_FACT_INFO: Record<MoveFactId, MoveFactDefinition> = {
  // A target ring: the chance the move is checked against. Not a tick, which
  // would read as "this move is fine".
  accuracy: fromTag('accuracy', '◎', 'Accuracy'),
  secondary: {
    icon: '✦',
    label: 'Secondary effect chance',
    blurb:
      'The chance this move also applies its secondary effect when it lands. Rolled separately from the damage, and independent of whether the move was a critical hit.',
  },
  // A double chevron: the bracket, which is about order and not about speed.
  priority: fromTag('priority', '»'),
  multiHit: fromTag('multiHit', '⁙'),
  charge: fromTag('charge', '◷'),
  recharge: fromTag('recharge', '◵'),
  // Arrows back at the user and back at the user's HP. The pair is deliberate:
  // recoil and drain are the same shape of fact in opposite directions.
  recoil: fromTag('recoil', '↩'),
  drain: fromTag('drain', '↪'),
  contact: fromTag('contact', '✥'),
};

/**
 * The face label a screen reader gets, and the fallback `title`.
 *
 * The value is included when there is one, so `◎ 85` announces as
 * "Accuracy 85" rather than as a glyph and a loose number.
 */
export function moveFactAriaLabel(id: MoveFactId, value: string): string {
  const info = MOVE_FACT_INFO[id];
  return value ? `${info.label} ${value}` : info.label;
}
