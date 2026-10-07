/**
 * The journey vignettes' captions. **The map calm-down patch, bible Rev 30,
 * D109** (`docs/spec/gymrun-patch-map-calm-down-and-journey-vignettes.md`).
 *
 * A vignette is a beat between screens: a picture and at most five words
 * that say what kind of moment the player is entering. One caption per node
 * kind and one for the return to the map. **Identical for every node of its
 * kind, and shown only after the commit**, so a caption can never compare,
 * rank or recommend one option over another: by the time it plays there is no
 * other option on screen. That is the ground the bible's section 8 carve-out
 * stands on (D109), and why *"Stay safe, spend wisely"* is style here rather
 * than a hedge.
 *
 * Copy, so it lives in `data/` with every other string a tuning pass would
 * touch, and off the `contentHash` glob (`build-config/content-hash.ts`): a
 * reworded caption must not refuse a shared seed. Nothing under `core/` may
 * import this file, at any depth.
 *
 * The author's own lines are *"where to go next"*, *"stay safe, spend your
 * money"*, *"prepare yourself"* and *"rest and improve"*; the rest are tuned
 * to that voice. The picture carries the meaning, the words only confirm it.
 */
import type { NodeKind } from './tuning';

/** Every moment a vignette plays at: one per node kind, and the return to the map. */
export type VignetteMoment = NodeKind | 'return';

export const VIGNETTE_MOMENTS: readonly VignetteMoment[] = ['return', 'wild', 'trainer', 'gym', 'shop', 'rest', 'event'];

/** The most words a caption may carry: section 4's *Vignette* budget. */
export const VIGNETTE_CAPTION_MAX_WORDS = 5;

export const VIGNETTE_CAPTIONS: Readonly<Record<VignetteMoment, string>> = {
  return: 'Where to next?',
  wild: 'Something stirs',
  trainer: 'Prepare yourself',
  gym: 'The leader awaits',
  shop: 'Stay safe, spend wisely',
  rest: 'Rest and improve',
  event: 'Something unusual',
};
