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
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CAPABILITIES } from '../src/data/capabilities';
import { LOCALES } from '../src/data/locales';
import { RELICS } from '../src/data/relics';
import { assetIcon, MANIFEST, NAV_TABS, type AssetKey } from '../src/ui/assets/manifest';

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
    const icon = assetIcon('node:wild');
    expect(icon.classList.contains('asset--placeholder')).toBe(true);
    expect(icon.textContent).toBe('W');
    expect(icon.style.getPropertyValue('--asset-w')).toBe('16');
    expect(icon.style.getPropertyValue('--asset-h')).toBe('16');
  });
});
