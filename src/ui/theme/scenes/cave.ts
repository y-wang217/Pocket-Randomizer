import { svg, type SceneArt } from './index';

/** Stalactites above, a rubble floor, one hanging drip of light. */
export const cave: SceneArt = {
  far: svg(
    '<path fill="var(--layer-fill)" d="M0 0h96v10l-4 6-3-6-5 9-4-9-6 4-3-7-5 12-4-12-6 5-4-5-5 8-3-8-6 3-4-4-5 11-4-11-6 5-3-5-5 7-4-7-3 4-4-3v-10z"/>' +
      '<rect fill="var(--locale-glow)" opacity="0.18" x="0" y="30" width="96" height="1"/>',
  ),
  mid: svg(
    '<path fill="var(--layer-fill)" d="M0 48v-12l6-2 5 3 7-5 6 4 8-1 5-6 6 5 7 2 6-4 5 3 8-3 6 5 7-2 6 3 8-4v19z"/>',
  ),
  near: svg(
    '<path fill="var(--layer-fill)" d="M0 48v-7l4-3 5 4 6-2 4 5 7-4 6 3 5-6 7 6 8-3 6 4 7-5 6 5 6-2 7 4 8-5 4 6v4z"/>' +
      '<rect fill="var(--layer-fill)" x="12" y="34" width="3" height="14"/><rect fill="var(--layer-fill)" x="70" y="36" width="4" height="12"/>',
  ),
  drift: svg('<rect fill="var(--locale-glow)" x="2" y="2" width="2" height="2"/><rect fill="var(--locale-glow)" opacity="0.5" x="2" y="0" width="2" height="1"/>', '0 0 6 6'),
};
