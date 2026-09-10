/**
 * The eight places. Stage V3.
 *
 * Each locale is three inline SVG silhouettes, far, mid and near, and one
 * drifting element, all authored here as strings on a 96x48 grid of integer
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

export interface SceneArt {
  /** The far layer: the horizon and what is behind it. Moves at 0.2 of scroll. */
  far: string;
  /** The mid layer: the ground the place stands on. Moves at 0.5. */
  mid: string;
  /** The near layer: what is closest, darkest, at the bottom. Moves at 1. */
  near: string;
  /** The one drifting element, a small SVG the stylesheet animates. */
  drift: string;
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
