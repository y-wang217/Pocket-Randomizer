import { svg, type SceneArt } from './index';

/** A low far bank, standing water mid with hummocks, near reeds, and a wisp over the water. */
export const marsh: SceneArt = {
  far: svg(
    '<path fill="var(--layer-fill)" d="M0 32v-6l8-1 10 2 12-3 10 2 14-2 12 3 10-2 10 2 10-1v6z"/>' +
      '<rect fill="var(--locale-glow)" opacity="0.2" x="0" y="31" width="96" height="1"/>',
  ),
  mid: svg(
    '<path fill="var(--layer-fill)" d="M0 48V36h96v12z"/>' +
      '<path fill="var(--locale-glow)" opacity="0.18" d="M10 40h14v1H10zM40 42h20v1H40zM70 39h12v1H70z"/>' +
      '<path fill="var(--layer-fill)" d="M20 36l4-3 6 3zM56 36l5-4 7 4zM82 36l3-2 5 2z"/>',
  ),
  near: svg(
    '<path fill="var(--layer-fill)" d="M0 48v-5h96v5z"/>' +
      '<path fill="var(--layer-fill)" d="M6 43V30h1v13zM9 43V26h1v17zM13 43V32h1v11zM48 43V28h1v15zM52 43V33h1v10zM84 43V29h1v14zM88 43V34h1v9zM92 43V31h1v12z"/>' +
      '<rect fill="var(--layer-fill)" x="8" y="26" width="3" height="3"/><rect fill="var(--layer-fill)" x="47" y="28" width="3" height="3"/><rect fill="var(--layer-fill)" x="83" y="29" width="3" height="3"/>',
  ),
  drift: svg('<rect fill="var(--locale-glow)" opacity="0.7" x="1" y="2" width="3" height="1"/><rect fill="var(--locale-glow)" opacity="0.4" x="2" y="1" width="1" height="1"/>', '0 0 5 4'),
};
