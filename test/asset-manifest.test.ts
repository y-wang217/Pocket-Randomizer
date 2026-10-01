/**
 * The asset manifest. **Stage 5.0/1**, tests 3 and 4 of
 * `docs/spec/gymrun-stage5.0-visual-redesign.md`.
 *
 * @vitest-environment jsdom
 *
 * Test 3: *"Every manifest key resolves to a file, and every node type,
 * capability and relic in the data has a manifest key."* Every entry is a
 * placeholder today, which resolves by construction; an entry that names a
 * file must name one that is there. Test 4's half that lives here: an asset
 * with no art renders at its native size, never as nothing.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { glyphNode } from '../src/ui/theme/glyph';
import { CAPABILITIES } from '../src/data/capabilities';
import { LOCALES } from '../src/data/locales';
import { RELICS } from '../src/data/relics';
import { assetIcon, assetUrl, glyphArtKey, MANIFEST, NATIVE, NAV_TABS, type AssetKey } from '../src/ui/assets/manifest';

const NODE_KINDS = ['wild', 'trainer', 'rest', 'gym', 'shop', 'event'] as const;

describe('the asset manifest', () => {
  it('has a key for every node kind, capability, relic, locale and tab in the data', () => {
    const keys = new Set<AssetKey>(MANIFEST.keys());
    for (const kind of NODE_KINDS) expect(keys, kind).toContain(`node:${kind}`);
    for (const capability of CAPABILITIES) expect(keys, capability).toContain(`capability:${capability}`);
    for (const relic of RELICS) expect(keys, relic.id).toContain(`relic:${relic.id}`);
    for (const locale of LOCALES) {
      expect(keys).toContain(`map-backdrop:${locale.id}`);
      expect(keys).toContain(`battle-backdrop:${locale.id}`);
    }
    expect(keys).toContain('battle-backdrop:gym');
    expect(keys).toContain('starter-backdrop');
    for (const tab of NAV_TABS) expect(keys).toContain(`nav:${tab}`);
    expect(keys).toContain('currency');
    expect(keys).toContain('wordmark');
  });

  it('resolves every key: a placeholder with a letter, or a file that exists', () => {
    for (const [key, asset] of MANIFEST) {
      expect(asset.native.width, key).toBeGreaterThan(0);
      expect(asset.native.height, key).toBeGreaterThan(0);
      if (asset.kind === 'file') expect(existsSync(join(process.cwd(), 'src/ui/assets', asset.file)), key).toBe(true);
      else expect(asset.letter.length, key).toBeGreaterThan(0);
    }
  });

  it('draws a placeholder at the native size, never as nothing', () => {
    // Stage 5.0/5: no entry is a placeholder any more, so the fallback is a
    // drawing that does not resolve. It keeps the native size and shows the
    // entry's letter, never an empty or broken box.
    const missing = { kind: 'file', file: 'icons/not-there.png', native: { width: 8, height: 8 }, tone: 'mask', letter: 'W' } as const;
    expect(assetUrl(missing)).toBeNull();
    const icon = assetIcon('node:wild');
    expect(icon.style.getPropertyValue('--asset-w')).toBe('8');
    expect(icon.style.getPropertyValue('--asset-h')).toBe('8');
  });

  /*
   * Stage 5.0/5, the plan's outcome: *"no placeholder remains."* Every class C
   * slot names a drawing, and every drawing is at its native size, because a
   * file at the wrong size would be scaled by a fraction and stop being pixel
   * art. The PNG's own header is read for the size, so a file dropped in at the
   * wrong size fails here rather than on a screen.
   */
  it('has no placeholder left, and every drawing is at its native size', () => {
    for (const [key, asset] of MANIFEST) {
      expect(asset.kind, key).toBe('file');
      if (asset.kind !== 'file') continue;
      const png = readFileSync(join(process.cwd(), 'src/ui/assets', asset.file));
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], key).toEqual([asset.native.width, asset.native.height]);
    }
  });

  it('draws an icon in its tone: a relic in colour, a nav icon in ink', () => {
    expect(assetIcon('relic:rusted-machete').classList.contains('asset--colour')).toBe(true);
    expect(assetIcon('nav:map').classList.contains('asset--mask')).toBe(true);
    expect(assetIcon('wordmark').classList.contains('asset--mask')).toBe(true);
  });

  /*
   * D61: the node, capability and currency marks are glyph families, so their
   * art is drawn by `glyphNode`, at 8 native, and the band chevron, which has
   * no class C slot, stays the sheet's mark.
   */
  it('gives every node, capability and currency glyph its drawing, and nothing else', () => {
    for (const kind of NODE_KINDS) expect(glyphArtKey(`node-${kind}`)).toBe(`node:${kind}`);
    for (const capability of CAPABILITIES) expect(glyphArtKey(`capability-${capability}`)).toBe(`capability:${capability}`);
    expect(glyphArtKey('currency-coin')).toBe('currency');
    expect(glyphArtKey('capability-band-on')).toBeNull();
    expect(glyphArtKey('type-fire')).toBeNull();
    expect(NATIVE.node).toEqual({ width: 8, height: 8 });
  });

  it('draws a glyph with art as a mask through the one renderer, and every other glyph as the sheet mark', () => {
    const art = glyphNode('node-wild', { size: 24 });
    expect(art?.classList.contains('glyph--art')).toBe(true);
    expect(art?.style.getPropertyValue('--glyph-art')).toContain('node-wild');
    expect(art?.dataset['family']).toBe('node');
    expect(art?.querySelector('svg')).toBeNull();
    const chevron = glyphNode('capability-band-on');
    expect(chevron?.classList.contains('glyph--art')).toBe(false);
    expect(chevron?.querySelector('svg')).not.toBeNull();
  });
});
