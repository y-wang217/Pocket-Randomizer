import { svg, type SceneArt } from './index';

/** Far peaks, a snowline ridge, near boulders, and a bird crossing. */
export const summit: SceneArt = {
  far: svg(
    '<path fill="var(--layer-fill)" d="M0 30l10-12 8 6 10-16 9 10 7-6 12 14 9-9 8 7 10-13 8 10 5-4v13H0z"/>' +
      '<path fill="var(--locale-glow)" opacity="0.5" d="M28 8l3 4-2 1-1-2-2 2-1-2zM74 10l3 4-2 1-1-2-2 2-1-2z"/>',
  ),
  mid: svg(
    '<path fill="var(--layer-fill)" d="M0 48v-16l12-6 10 8 14-12 12 9 10-5 12 10 12-8 14 12v8z"/>' +
      '<path fill="var(--locale-glow)" opacity="0.25" d="M36 14l4 3-2 2-2-2-3 3-2-2z"/>',
  ),
  near: svg(
    '<path fill="var(--layer-fill)" d="M0 48v-9l7-3 8 5 9-7 10 6 8-3 11 7 10-8 9 6 8-4 8 6 8-3v7z"/>',
  ),
  drift: svg('<path fill="var(--layer-fill)" d="M0 3l3-2 2 2 2-2 3 2-1 1-2-1-2 2-2-2-2 1z"/>', '0 0 10 5'),
};
