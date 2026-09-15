/**
 * The eight places. Stage V3.
 *
 * Each locale is three inline SVG silhouettes, far, mid and near, and one
 * moving element, all authored here as strings on a 96x48 grid of integer
 * coordinates and upscaled by the stylesheet with `shape-rendering:
 * crispEdges`, which is where the pixel look comes from. Flat, single-colour,
 * generic shapes in the locale's own tokens: a ridge, a treeline, a skyline,
 * a shore. No Pokemon, no Pokeball, no landmark from anywhere: the same IP
 * posture as the sprite CDN rule.
 *
 * Every main shape is filled with `var(--layer-fill)`, which the stylesheet
 * sets per layer from the locale tokens; highlights reference
 * `var(--locale-glow)` directly. The art recolours with the palette and V1's
 * three-token rule still holds.
 */
import type { LocaleId } from '../../../data/locales';

/**
 * The eight ways a place moves. **Idle-sprites patch.**
 *
 * V3 gave every locale the same motion: one small thing carried left to right
 * across the frame on a 32-second loop. The cave's spark read as a cart going
 * by; the other seven mostly read as nothing, because a boat and a leaf on the
 * same slow line are the same event. Each kind is one `@keyframes` in
 * `styles.css`, named `world-<kind>`, and `test/world.test.ts` holds that every
 * locale names a kind and every kind has its keyframe.
 *
 * Three travel and five stay put. A travelling kind keeps V3's floor of twenty
 * seconds a crossing; an in-place kind moves nothing across the frame, so what
 * keeps it from drawing the eye is amplitude, not length — small, dim, and
 * never near a control. `docs/generation.md` section 19 records the change to
 * the plan's one-sentence rule.
 */
export const WORLD_MOTION_KINDS = ['cross', 'soar', 'lap', 'firefly', 'flicker', 'smoke', 'float', 'ripple'] as const;
export type WorldMotionKind = (typeof WORLD_MOTION_KINDS)[number];

/** The kinds whose element travels across the frame. */
export const TRAVELLING_KINDS: ReadonlySet<WorldMotionKind> = new Set(['cross', 'soar', 'firefly']);

export interface WorldMotion {
  kind: WorldMotionKind;
  /**
   * Where the element sits, as CSS lengths for `left` and `top` of the world,
   * when the kind's own default is not where this place wants it. Written to
   * `--drift-x` and `--drift-y` on the element.
   */
  at?: readonly [x: string, y: string];
}

export interface SceneArt {
  /** The far layer: the horizon and what is behind it. Moves at 0.2 of scroll. */
  far: string;
  /** The mid layer: the ground the place stands on. Moves at 0.5. */
  mid: string;
  /** The near layer: what is closest, darkest, at the bottom. Moves at 1. */
  near: string;
  /**
   * The one moving element: one or more small SVGs, siblings, that the
   * stylesheet animates by the locale's motion kind. Several siblings are the
   * motes of an in-place kind — the windows, the puffs, the rings — each
   * staggered by its position in the element.
   */
  drift: string;
  /** How the element moves. */
  motion: WorldMotion;
}

/** The four art strings of a scene, for a size or a fill check. */
export function artOf(scene: SceneArt): readonly string[] {
  return [scene.far, scene.mid, scene.near, scene.drift];
}

import { cave } from './cave';
import { shore } from './shore';
import { summit } from './summit';
import { city } from './city';
import { forest } from './forest';
import { ruins } from './ruins';
import { marsh } from './marsh';
import { badlands } from './badlands';

export const SCENES: Readonly<Record<LocaleId, SceneArt>> = { cave, shore, summit, city, forest, ruins, marsh, badlands };

/** Wrap a layer's shapes in the SVG element the stylesheet sizes. */
export function svg(body: string, viewBox = '0 0 96 48'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${body}</svg>`;
}
