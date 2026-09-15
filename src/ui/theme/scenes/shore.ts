import { svg, type SceneArt } from './index';

/** A sea horizon, a far headland, wet sand near, and foam that laps at its edge. */
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
  drift:
    svg(
      '<path fill="var(--locale-glow)" opacity="0.55" d="M0 1h6v1H0zM9 0h5v1H9zM17 1h8v1h-8zM28 0h4v1h-4zM35 1h7v1h-7zM45 0h6v1h-6zM54 1h5v1h-5zM62 0h8v1h-8zM73 1h6v1h-6zM82 0h5v1h-5zM90 1h6v1h-6z"/>',
      '0 0 96 2',
    ),
  motion: { kind: 'lap' },
};
