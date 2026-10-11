/**
 * The card battle's asset manifest: the IDs of the asset contract
 * (`docs/spec/gymrun-card-battle-engine-prompt.md` section 8) and nothing else.
 *
 * A separate manifest from `ui/assets/manifest.ts`, deliberately: this one is
 * imported only by the lazily loaded sandbox, so neither its table nor any
 * file it resolves can reach the main bundle. Files live at
 * `src/ui/assets/cardbattle/{group}/{id}.svg`: the author's pack v1,
 * `cardbattle-assets-1`, 60 files, and five enemy marker placeholders. An ID whose file is missing still renders
 * a placeholder at its contract size, so a file dropped or removed never
 * breaks the screen.
 *
 * Icons are ink: drawn through a mask in `currentColor`, tinted by the screen.
 * Everything else is a picture with its colours baked. No asset carries text;
 * numbers and names are drawn by the screen.
 */

export const CARD_ASSET_GROUPS = {
  tiles: {
    viewBox: { width: 64, height: 64 },
    render: { width: 64, height: 64 },
    ids: [
      'tile-player-backline',
      'tile-danger-zone',
      'tile-enemy-backline',
      'tile-overlay-selectable',
      'tile-overlay-selected',
      'tile-overlay-telegraph',
      'tile-overlay-unavailable',
    ],
  },
  cards: {
    viewBox: { width: 240, height: 336 },
    render: { width: 72, height: 101 },
    ids: [
      'card-frame-compact', 'card-frame-full', 'card-overlay-selected', 'card-overlay-unavailable', 'card-badge-corner',
      // The meadow pack: the owner band, a white mask tinted per owner.
      'card-band-compact', 'card-band-full',
    ],
  },
  ui: {
    viewBox: null,
    render: null,
    ids: [
      'panel-frame',
      'pill-badge',
      'bar-track',
      'bar-fill',
      'pip-empty',
      'pip-filled',
      'slot-empty',
      'slot-filled',
      'button-default',
      'button-pressed',
      'button-unavailable',
      // The meadow pack: the primary button in green, and the screen's background.
      'button-primary-default',
      'button-primary-pressed',
      'button-primary-unavailable',
      'background-meadow',
    ],
  },
  icons: {
    viewBox: { width: 24, height: 24 },
    render: { width: 24, height: 24 },
    ids: [
      'icon-hp', 'icon-shield', 'icon-mp', 'icon-strike', 'icon-pierce', 'icon-slash', 'icon-blast', 'icon-move',
      'icon-target', 'icon-stealth', 'icon-repair', 'icon-once', 'icon-draw', 'icon-hunt', 'icon-wait',
      'icon-class-special', 'icon-class-ranged', 'icon-class-melee', 'icon-type-fire', 'icon-type-plasma',
      'icon-type-water', 'icon-inspect', 'icon-confirm', 'icon-cancel', 'icon-end-turn', 'icon-deck', 'icon-discard',
      // Not in the pack: placeholders for Part D, until the reskin's art.
      'icon-shovel', 'icon-harpoon', 'icon-scream',
      'icon-fast', 'icon-pinned', 'icon-retain', 'icon-undo', 'icon-menu',
    ],
  },
  markers: {
    viewBox: { width: 64, height: 64 },
    render: { width: 48, height: 48 },
    ids: [
      'marker-player-base',
      'marker-enemy-base',
      'marker-unit-commander',
      'marker-unit-gunner',
      'marker-unit-dasher',
      'marker-enemy-drone',
      'marker-enemy-lancer',
      'marker-ring-selected',
      'marker-ring-destination',
      'marker-reticle',
      // Not in the pack: placeholders drawn in its style, the diamond and a
      // glyph, until the author's art arrives
      // (`docs/spec/gymrun-patch-card-battle-grace-friendly-fire.md` A3).
      'marker-enemy-hound',
      'marker-enemy-turret',
      'marker-enemy-bulwark',
      'marker-enemy-sniper',
      'marker-enemy-pikeman',
      'marker-enemy-colossus',
      'marker-enemy-colossus-pinned',
      // The tutorial's Target Dummy: a straw post under a target face.
      'marker-enemy-dummy',
      'portrait-commander',
      'portrait-gunner',
      'portrait-dasher',
    ],
  },
  /** The meadow pack's card illustrations, one per card, drawn in the frame's art window. */
  art: {
    viewBox: { width: 180, height: 150 },
    render: { width: 60, height: 50 },
    ids: [
      'art-call-medic', 'art-command', 'art-focus', 'art-moon-strike', 'art-shoot', 'art-resupply', 'art-artillery', 'art-fire',
      'art-dash', 'art-slash', 'art-need-help', 'art-prep', 'art-move', 'art-dig-in', 'art-attack', 'art-harpoon',
    ],
  },
} as const;

export type CardAssetGroup = keyof typeof CARD_ASSET_GROUPS;
export type CardAssetId = (typeof CARD_ASSET_GROUPS)[CardAssetGroup]['ids'][number];

export interface Size {
  width: number;
  height: number;
}

export function groupOf(id: CardAssetId): CardAssetGroup {
  for (const group of Object.keys(CARD_ASSET_GROUPS) as CardAssetGroup[]) {
    if ((CARD_ASSET_GROUPS[group].ids as readonly string[]).includes(id)) return group;
  }
  // Unreachable for a typed id; kept total so a caller never sees a throw.
  return 'ui';
}

/**
 * The pieces the pack draws to be sliced rather than stretched, with their
 * slice insets in the file's own units, top, right, bottom, left
 * (the pack's `manifest.json`, `cardbattle-assets-1`). A sliced piece keeps
 * its corners or caps at their drawn size and stretches only the middle.
 */
export const SLICES: Partial<Record<CardAssetId, readonly [number, number, number, number]>> = {
  'panel-frame': [14, 14, 14, 14],
  'pill-badge': [0, 12, 0, 12],
  'bar-track': [0, 6, 0, 6],
  'bar-fill': [0, 6, 0, 6],
  'button-default': [12, 12, 12, 12],
  'button-pressed': [12, 12, 12, 12],
  'button-unavailable': [12, 12, 12, 12],
};

/**
 * The meadow pack's pieces (`meadow-card-battler-assets`, `atlas.json`
 * `nineSlice`): the insets in the file's pixels, then the width each is drawn
 * at on the screen, top, right, bottom, left. Its files are about two and a
 * half times the size they show at.
 */
export const MEADOW_SLICES: Partial<Record<CardAssetId, { inset: readonly [number, number, number, number]; width: readonly [number, number, number, number] }>> = {
  'panel-frame': { inset: [30, 30, 30, 30], width: [12, 12, 12, 12] },
  'pill-badge': { inset: [12, 24, 12, 24], width: [5, 11, 5, 11] },
  'bar-track': { inset: [6, 10, 6, 10], width: [2, 4, 2, 4] },
  'bar-fill': { inset: [6, 10, 6, 10], width: [2, 4, 2, 4] },
  'slot-empty': { inset: [18, 18, 18, 18], width: [9, 9, 9, 9] },
  'slot-filled': { inset: [18, 18, 18, 18], width: [9, 9, 9, 9] },
  'button-default': { inset: [30, 30, 30, 30], width: [14, 14, 14, 14] },
  'button-pressed': { inset: [30, 30, 30, 30], width: [14, 14, 14, 14] },
  'button-unavailable': { inset: [30, 30, 30, 30], width: [14, 14, 14, 14] },
  'button-primary-default': { inset: [30, 30, 30, 30], width: [14, 14, 14, 14] },
  'button-primary-pressed': { inset: [30, 30, 30, 30], width: [14, 14, 14, 14] },
  'button-primary-unavailable': { inset: [30, 30, 30, 30], width: [14, 14, 14, 14] },
};

/** The pack draws the corner badge on its own 48 by 48 grid, not the card's. */
const OWN_SIZE: Partial<Record<CardAssetId, Size>> = {
  'card-badge-corner': { width: 48, height: 48 },
};

/** Where the file for an ID lives, relative to `src/ui/assets/cardbattle/`. */
export function cardAssetPath(id: CardAssetId): string {
  return `${groupOf(id)}/${id}.svg`;
}

/** The contract's render size for an ID, or `null` for a `ui` piece that stretches. */
export function renderSize(id: CardAssetId): Size | null {
  return OWN_SIZE[id] ?? CARD_ASSET_GROUPS[groupOf(id)].render;
}

const FILES = import.meta.glob('../assets/cardbattle/**/*.{svg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;

/** The meadow pack's file for an ID: `{group}/{id}.webp`, which wins over the first pack's `.svg`. */
export function meadowPath(id: CardAssetId): string {
  return `${groupOf(id)}/${id}.webp`;
}

function fileOf(id: CardAssetId, files: Record<string, string>): { url: string; meadow: boolean } | null {
  const meadow = files[`../assets/cardbattle/${meadowPath(id)}`];
  if (meadow) return { url: meadow, meadow: true };
  const svg = files[`../assets/cardbattle/${cardAssetPath(id)}`];
  return svg ? { url: svg, meadow: false } : null;
}

/** The bundled URL for an ID, or `null` while its file has not arrived. */
export function cardAssetUrl(id: CardAssetId, files: Record<string, string> = FILES): string | null {
  return fileOf(id, files)?.url ?? null;
}

/** What a placeholder shows: the ID's initials after its group prefix. */
function letterOf(id: CardAssetId): string {
  const words = id.split('-').slice(1);
  return words.map((w) => w[0]!.toUpperCase()).join('').slice(0, 2);
}

/**
 * The element for an ID at a size: the contract's render size unless the
 * caller names one, or `'fill'` to stretch over its parent. A file is drawn as a background, or for an icon as a mask
 * in `currentColor`; a missing file is a placeholder of exactly that size.
 */
export function cardAsset(id: CardAssetId, size?: Size | 'fill', files?: Record<string, string>): HTMLElement {
  const el = document.createElement('span');
  el.className = 'cb-asset';
  el.dataset['asset'] = id;
  el.setAttribute('aria-hidden', 'true');
  if (size === 'fill') {
    // Stretched to its parent: frames, panels, pills and slots.
    el.classList.add('cb-asset--fill');
  } else {
    const box = size ?? renderSize(id) ?? { width: 24, height: 24 };
    el.style.width = `${box.width}px`;
    el.style.height = `${box.height}px`;
  }
  const file = fileOf(id, files ?? FILES);
  const url = file?.url ?? null;
  // Small files are inlined as `data:` URLs that carry quotes and spaces, so
  // the URL is always quoted, and a double quote inside it escaped.
  const css = url ? `url("${url.replace(/"/g, '%22')}")` : '';
  const sliced = file?.meadow ? MEADOW_SLICES[id] : SLICES[id] ? { inset: SLICES[id]!, width: SLICES[id]! } : undefined;
  if (url && sliced) {
    const [top, right, bottom, left] = sliced.inset;
    const [wt, wr, wb, wl] = sliced.width;
    el.classList.add('cb-asset--slice');
    el.style.borderStyle = 'solid';
    el.style.borderWidth = `${wt}px ${wr}px ${wb}px ${wl}px`;
    el.style.borderImage = `${css} ${top} ${right} ${bottom} ${left} fill / ${wt}px ${wr}px ${wb}px ${wl}px stretch`;
  } else if (url) {
    const mask = groupOf(id) === 'icons';
    el.classList.add(mask ? 'cb-asset--mask' : 'cb-asset--art');
    el.style.setProperty('--cb-asset-image', css);
  } else {
    el.classList.add('cb-asset--placeholder', `cb-asset--${groupOf(id)}`);
    if (groupOf(id) === 'icons' || groupOf(id) === 'markers') el.textContent = letterOf(id);
  }
  return el;
}
