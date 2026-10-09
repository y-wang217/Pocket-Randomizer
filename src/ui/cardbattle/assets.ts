/**
 * The card battle's asset manifest: the IDs of the asset contract
 * (`docs/spec/gymrun-card-battle-engine-prompt.md` section 8) and nothing else.
 *
 * A separate manifest from `ui/assets/manifest.ts`, deliberately: this one is
 * imported only by the lazily loaded sandbox, so neither its table nor any
 * file it resolves can reach the main bundle. Files live at
 * `src/ui/assets/cardbattle/{group}/{id}.svg`. Until the pack arrives none
 * exists, and every ID renders a placeholder at its contract size; dropping
 * the pack into that directory is the whole integration.
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
    ids: ['card-frame-compact', 'card-frame-full', 'card-overlay-selected', 'card-overlay-unavailable', 'card-badge-corner'],
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

/** Where the file for an ID lives, relative to `src/ui/assets/cardbattle/`. */
export function cardAssetPath(id: CardAssetId): string {
  return `${groupOf(id)}/${id}.svg`;
}

/** The contract's render size for an ID, or `null` for a `ui` piece that stretches. */
export function renderSize(id: CardAssetId): Size | null {
  return CARD_ASSET_GROUPS[groupOf(id)].render;
}

const FILES = import.meta.glob('../assets/cardbattle/**/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** The bundled URL for an ID, or `null` while its file has not arrived. */
export function cardAssetUrl(id: CardAssetId, files: Record<string, string> = FILES): string | null {
  return files[`../assets/cardbattle/${cardAssetPath(id)}`] ?? null;
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
  const url = cardAssetUrl(id, files);
  if (url) {
    const mask = groupOf(id) === 'icons';
    el.classList.add(mask ? 'cb-asset--mask' : 'cb-asset--art');
    el.style.setProperty('--cb-asset-image', `url(${url})`);
  } else {
    el.classList.add('cb-asset--placeholder', `cb-asset--${groupOf(id)}`);
    if (groupOf(id) === 'icons' || groupOf(id) === 'markers') el.textContent = letterOf(id);
  }
  return el;
}
