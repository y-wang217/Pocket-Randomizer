import { svg, type SceneArt } from './index';

/** Mesas far, cracked flats mid, near rock stacks, and a tumbling thing along the flat. */
export const badlands: SceneArt = {
  far: svg(
    '<path fill="var(--layer-fill)" d="M0 32V24l6-4h10l4 4v-8h12l4 8h8v-6l6-4h10v10h10l4-6h8v6h6l3-4h5v12z"/>' +
      '<rect fill="var(--locale-glow)" opacity="0.3" x="0" y="20" width="96" height="1"/>',
  ),
  mid: svg(
    '<path fill="var(--layer-fill)" d="M0 48V34h96v14z"/>' +
      '<path fill="var(--locale-glow)" opacity="0.15" d="M8 38h10v1H8zM30 41h14v1H30zM60 37h9v1h-9zM74 43h16v1H74z"/>',
  ),
  near: svg(
    '<path fill="var(--layer-fill)" d="M0 48v-6h96v6z"/>' +
      '<path fill="var(--layer-fill)" d="M10 42V30h3v-4h5v4h3v12zM70 42v-8h4v-6h6v6h4v8z"/>',
  ),
  drift: svg('<path fill="var(--layer-fill)" d="M2 0h2l2 2v2L4 6H2L0 4V2z"/><path fill="var(--locale-glow)" opacity="0.5" d="M2 1h2v1H2zM1 3h1v1H1zM4 3h1v1H4z"/>', '0 0 6 6'),
};
