/**
 * The node band. **The map calm-down patch, bible Rev 30, D109**, its part 3:
 * each node screen carries a thin header in the same colour token and
 * silhouette as its map node and vignette, with the locale's name and
 * nothing else.
 *
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { localeById } from '../src/data/locales';
import { NODE_KIND_WORDS } from '../src/data/glyphLabels';
import { NODE_KINDS } from '../src/ui/assets/manifest';
import { mountNodeBand } from '../src/ui/node-band';

const APP = readFileSync(join(process.cwd(), 'src/ui/app.ts'), 'utf8');
const STYLES = readFileSync(join(process.cwd(), 'src/ui/styles.css'), 'utf8');

let screen: HTMLElement;

beforeEach(() => {
  screen = document.createElement('section');
  screen.append(document.createElement('h2'));
  document.body.replaceChildren(screen);
});

describe('the node band', () => {
  it('heads the screen with the kind silhouette and the region, and no kind word', () => {
    for (const kind of NODE_KINDS) {
      const band = mountNodeBand(screen, kind, 'cave');
      expect(screen.firstElementChild).toBe(band);
      expect(band.dataset['kind']).toBe(kind);
      expect(band.querySelector(`[data-asset="silhouette:${kind}"]`), kind).not.toBeNull();
      expect(band.textContent).toBe(localeById('cave').name);
      expect(band.textContent?.toLowerCase()).not.toContain(NODE_KIND_WORDS[kind]!.toLowerCase());
      // The same colour token the map node and the vignette wear.
      expect(STYLES).toContain(`.node-band[data-kind='${kind}'] { --kind: var(--kind-${kind}); }`);
      expect(STYLES).toContain(`.vignette[data-moment='${kind}'] { --kind: var(--kind-${kind}); }`);
    }
  });

  it('is redrawn in place, never stacked', () => {
    mountNodeBand(screen, 'wild', 'cave');
    mountNodeBand(screen, 'shop', null);
    expect(screen.querySelectorAll('.node-band')).toHaveLength(1);
    expect(screen.querySelector<HTMLElement>('.node-band')!.dataset['kind']).toBe('shop');
  });

  it('is mounted on the battle, shop, event and pre-gym screens, and not for rest', () => {
    for (const [screenName, kind] of [
      ['battleScreen', 'node.kind'],
      ['shopScreen', "'shop'"],
      ['eventScreen', "'event'"],
      ['preGymScreen', "'gym'"],
    ] as const) {
      expect(APP, screenName).toContain(`mountNodeBand(${screenName}.root, ${kind},`);
    }
    expect(APP).not.toContain("mountNodeBand(partyScreen.root, 'rest'");
  });
});
