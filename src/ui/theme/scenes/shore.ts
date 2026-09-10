import { svg, type SceneArt } from './index';

/** A sea horizon, a far headland, wet sand near, and a boat going by. */
export const shore: SceneArt = {
  far: svg(
    '<rect fill="var(--locale-glow)" opacity="0.22" x="0" y="26" width="96" height="6"/>' +
      '<path fill="var(--layer-fill)" d="M60 27l6-4 8 2 6-3 10 3 6 2v2H60z"/>' +
      '<rect fill="var(--locale-glow)" opacity="0.35" x="0" y="26" width="96" height="1"/>',
  ),
  mid: svg(
    '<path fill="var(--layer-fill)" d="M0 48v-14l10 1 12-2 14 3 12-1 10 2 14-2 12 1 12-1v13z"/>' +
      '<path fill="var(--locale-glow)" opacity="0.25" d="M0 34h10l12-2 14 3 12-1 10 2 14-2 12 1 12-1v1l-12 1-12-1-14 2-10-2-12 1-14-3-12 2H0z"/>',
  ),
  near: svg(
    '<path fill="var(--layer-fill)" d="M0 48v-6l8-1 6 2 9-2 8 1 10-2 9 2 10-1 9 2 9-2 8 1 10-1v7z"/>' +
      '<rect fill="var(--layer-fill)" x="20" y="38" width="5" height="3"/><rect fill="var(--layer-fill)" x="64" y="40" width="7" height="2"/>',
  ),
  drift: svg('<path fill="var(--layer-fill)" d="M0 5h8l-1 2H1z"/><rect fill="var(--locale-glow)" x="4" y="1" width="1" height="4"/><path fill="var(--locale-glow)" opacity="0.8" d="M5 1l3 3H5z"/>', '0 0 9 8'),
};
