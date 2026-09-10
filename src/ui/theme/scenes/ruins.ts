import { svg, type SceneArt } from './index';

/** Broken columns far, fallen walls mid, a near arch, and a light that moves among them. */
export const ruins: SceneArt = {
  far: svg(
    '<path fill="var(--layer-fill)" d="M0 32V26h6v-8h4v8h8V14h5v12h10v-6h4v6h9V10h6v16h8v-9h5v9h11V18h5v8h7v-5h4v5h4v6z"/>',
  ),
  mid: svg(
    '<path fill="var(--layer-fill)" d="M0 48V36h12v-6h6l3 6h11v-8h5v8h8v-4l6-3v7h12v-9h5v9h10v-5h6v5h6v-7h6v7h0v12z"/>' +
      '<path fill="var(--locale-glow)" opacity="0.2" d="M30 30h5v1h-5zM55 26h5v1h-5z"/>',
  ),
  near: svg(
    '<path fill="var(--layer-fill)" d="M0 48v-8h96v8z"/>' +
      '<path fill="var(--layer-fill)" d="M14 40V24h4v-4h6v4h4v16h-4V28h-6v12z"/><rect fill="var(--layer-fill)" x="66" y="30" width="5" height="10"/><rect fill="var(--layer-fill)" x="78" y="34" width="8" height="6"/>',
  ),
  drift: svg('<rect fill="var(--locale-glow)" x="2" y="2" width="2" height="2"/><rect fill="var(--locale-glow)" opacity="0.3" x="1" y="1" width="4" height="4"/>', '0 0 6 6'),
};
