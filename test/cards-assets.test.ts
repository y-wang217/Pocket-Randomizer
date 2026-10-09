/**
 * @vitest-environment jsdom
 *
 * The card battle's asset contract (prompt section 8). **Card battle engine,
 * checkpoint 5.** Every ID resolves to a manifest entry and a file path, and
 * an ID whose file has not arrived renders a placeholder at the contract size.
 */
import { describe, expect, it } from 'vitest';

import { CARD_ASSET_GROUPS, cardAsset, cardAssetPath, cardAssetUrl, renderSize, type CardAssetId } from '../src/ui/cardbattle/assets';

const CONTRACT: Record<string, string[]> = {
  tiles: ['tile-player-backline', 'tile-danger-zone', 'tile-enemy-backline', 'tile-overlay-selectable', 'tile-overlay-selected', 'tile-overlay-telegraph', 'tile-overlay-unavailable'],
  cards: ['card-frame-compact', 'card-frame-full', 'card-overlay-selected', 'card-overlay-unavailable', 'card-badge-corner'],
  ui: ['panel-frame', 'pill-badge', 'bar-track', 'bar-fill', 'pip-empty', 'pip-filled', 'slot-empty', 'slot-filled', 'button-default', 'button-pressed', 'button-unavailable'],
  icons: [
    'icon-hp', 'icon-shield', 'icon-mp', 'icon-strike', 'icon-pierce', 'icon-slash', 'icon-blast', 'icon-move', 'icon-target', 'icon-stealth',
    'icon-repair', 'icon-once', 'icon-draw', 'icon-hunt', 'icon-wait', 'icon-class-special', 'icon-class-ranged', 'icon-class-melee',
    'icon-type-fire', 'icon-type-plasma', 'icon-type-water', 'icon-inspect', 'icon-confirm', 'icon-cancel', 'icon-end-turn', 'icon-deck', 'icon-discard',
  ],
  markers: [
    'marker-player-base', 'marker-enemy-base', 'marker-unit-commander', 'marker-unit-gunner', 'marker-unit-dasher', 'marker-enemy-drone',
    'marker-enemy-lancer', 'marker-ring-selected', 'marker-ring-destination', 'marker-reticle',
  ],
};

describe('card battle assets', () => {
  it('lists exactly the contract IDs, group by group', () => {
    for (const [group, ids] of Object.entries(CONTRACT)) {
      expect([...CARD_ASSET_GROUPS[group as keyof typeof CARD_ASSET_GROUPS].ids], group).toEqual(ids);
    }
    expect(Object.keys(CARD_ASSET_GROUPS)).toEqual(Object.keys(CONTRACT));
  });

  it('resolves every ID to {group}/{id}.svg', () => {
    for (const [group, ids] of Object.entries(CONTRACT)) {
      for (const id of ids) expect(cardAssetPath(id as CardAssetId)).toBe(`${group}/${id}.svg`);
    }
  });

  it('renders a missing file as a placeholder of the contract size', () => {
    const sizes: Record<string, string> = { tiles: '64x64', cards: '72x101', icons: '24x24', markers: '48x48' };
    for (const [group, ids] of Object.entries(CONTRACT)) {
      for (const id of ids) {
        const el = cardAsset(id as CardAssetId, undefined, {});
        expect(el.classList.contains('cb-asset--placeholder'), id).toBe(true);
        if (sizes[group]) expect(`${parseInt(el.style.width)}x${parseInt(el.style.height)}`, id).toBe(sizes[group]);
      }
    }
    expect(renderSize('panel-frame')).toBeNull();
    const fill = cardAsset('panel-frame', 'fill', {});
    expect(fill.classList.contains('cb-asset--fill')).toBe(true);
    const full = cardAsset('card-frame-full', { width: 240, height: 336 }, {});
    expect([full.style.width, full.style.height]).toEqual(['240px', '336px']);
  });

  it('draws an arrived file, an icon as a mask in currentColor and the rest as a picture', () => {
    const files = {
      '../assets/cardbattle/icons/icon-strike.svg': '/a/icon-strike.svg',
      '../assets/cardbattle/tiles/tile-danger-zone.svg': '/a/tile-danger-zone.svg',
    };
    expect(cardAssetUrl('icon-strike', files)).toBe('/a/icon-strike.svg');
    const icon = cardAsset('icon-strike', { width: 16, height: 16 }, files);
    expect(icon.classList.contains('cb-asset--mask')).toBe(true);
    expect(icon.textContent).toBe('');
    const tile = cardAsset('tile-danger-zone', undefined, files);
    expect(tile.classList.contains('cb-asset--art')).toBe(true);
    expect(tile.style.getPropertyValue('--cb-asset-image')).toContain('/a/tile-danger-zone.svg');
  });
});
