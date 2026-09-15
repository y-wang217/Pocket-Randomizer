import { svg, type SceneArt } from './index';

/** A far canopy line, a mid treeline, near trunks and undergrowth, and fireflies floating by. */
export const forest: SceneArt = {
  far: svg(
    '<path fill="var(--layer-fill)" d="M0 32V22l4-4 4 4 3-6 4 6 4-3 5 3 3-7 4 7 5-4 4 4 4-6 4 6 3-3 5 3 4-8 4 8 4-4 4 4 3-6 4 6 4-3 4 3 3-5 4 5v10z"/>',
  ),
  mid: svg(
    '<path fill="var(--layer-fill)" d="M0 48V34l3-8 3 8 4-12 4 12 3-6 4 6 3-10 4 10 4-7 4 7 3-12 4 12 4-6 4 6 3-9 4 9 3-5 4 5 4-11 4 11 3-7 4 7 3-9 4 9 3-4 3 4v14z"/>',
  ),
  near: svg(
    '<path fill="var(--layer-fill)" d="M0 48v-6l6-2 5 3 7-4 6 3 8-5 6 4 7-3 7 5 8-6 6 4 8-2 6 3 8-5 8 4v7z"/>' +
      '<rect fill="var(--layer-fill)" x="9" y="20" width="3" height="24"/><rect fill="var(--layer-fill)" x="58" y="16" width="4" height="28"/><rect fill="var(--layer-fill)" x="84" y="24" width="3" height="20"/>',
  ),
  drift:
    svg('<rect fill="var(--locale-glow)" x="2" y="7" width="2" height="2"/>', '0 0 12 12') +
    svg('<rect fill="var(--locale-glow)" x="7" y="3" width="2" height="2"/>', '0 0 12 12') +
    svg('<rect fill="var(--locale-glow)" x="9" y="9" width="1" height="1"/>', '0 0 12 12'),
  motion: { kind: 'firefly' },
};
