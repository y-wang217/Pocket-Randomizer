import { svg, type SceneArt } from './index';

/** A block skyline far, rooftops mid, a wall and wires near, a window that blinks past. */
export const city: SceneArt = {
  far: svg(
    '<path fill="var(--layer-fill)" d="M0 32V20h6v-6h5v10h4V12h6v14h5v-8h7v-4h4v14h6V16h8v10h5V8h6v18h7v-6h6v-4h5v16h4v-8h6v-4h6v16z"/>' +
      '<path fill="var(--locale-glow)" opacity="0.35" d="M14 16h1v1h-1zM24 18h1v1h-1zM40 20h1v1h-1zM52 14h1v1h-1zM53 18h1v1h-1zM70 22h1v1h-1zM86 24h1v1h-1z"/>',
  ),
  mid: svg(
    '<path fill="var(--layer-fill)" d="M0 48V34h10v-4h6v4h10v-6h8v6h9v-3h9v3h8v-8h8v8h8v-5h8v5h12v14z"/>',
  ),
  near: svg(
    '<path fill="var(--layer-fill)" d="M0 48v-8h96v8z"/>' +
      '<rect fill="var(--layer-fill)" x="18" y="24" width="2" height="16"/><rect fill="var(--layer-fill)" x="72" y="26" width="2" height="14"/>' +
      '<path fill="var(--layer-fill)" d="M20 26q26 6 52 0v1q-26 6-52 0z"/>',
  ),
  drift: svg('<rect fill="var(--locale-glow)" x="1" y="1" width="2" height="2"/>', '0 0 4 4'),
};
