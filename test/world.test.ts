/**
 * The world scene: eight places, three layers each, one moving thing with a
 * motion of its own, and nothing under it harder to reach. Stage V3, and the
 * per-locale motion of the idle-sprites patch.
 *
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOCALE_IDS } from '../src/data/locales';
import { createWorldScene, PARALLAX } from '../src/ui/scene';
import { artOf, SCENES, TRAVELLING_KINDS, WORLD_MOTION_KINDS } from '../src/ui/theme/scenes';

function mockReducedMotion(matches: boolean): void {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches, addEventListener: () => undefined, removeEventListener: () => undefined })),
  });
}

afterEach(() => {
  mockReducedMotion(false);
});

describe('the art', () => {
  it('gives every locale three layers and a moving element, all inline SVG', () => {
    for (const id of LOCALE_IDS) {
      const art = SCENES[id];
      for (const layer of ['far', 'mid', 'near', 'drift'] as const) {
        // The moving element may be several sibling SVGs, the motes of an
        // in-place kind; a layer is one.
        expect(art[layer], `${id} ${layer}`).toMatch(/^<svg [^>]*viewBox="[^"]+"[^>]*>[\s\S]*<\/svg>$/);
        if (layer !== 'drift') expect(art[layer].match(/<svg /g), `${id} ${layer} is one SVG`).toHaveLength(1);
        // Geometry only: no rasters, no links, no text, no external anything.
        expect(art[layer], `${id} ${layer} is drawn, not loaded`).not.toMatch(/<image|href=|url\(|<text|data:/i);
        // Flat, single-colour shapes in the locale's tokens: every fill is the
        // layer's fill or the glow.
        for (const fill of art[layer].matchAll(/fill="([^"]+)"/g)) {
          expect(['var(--layer-fill)', 'var(--locale-glow)'], `${id} ${layer} fill ${fill[1]}`).toContain(fill[1]);
        }
      }
    }
  });

  it('weighs under the budget: 30 kB gzipped for all eight', () => {
    const all = LOCALE_IDS.map((id) => artOf(SCENES[id]).join('')).join('');
    expect(gzipSync(Buffer.from(all)).length).toBeLessThan(30 * 1024);
  });
});

describe('the motion', () => {
  it('names a known kind for every locale, and every kind has its keyframes', () => {
    const styles = readFileSync(join(process.cwd(), 'src/ui/styles.css'), 'utf8');
    for (const id of LOCALE_IDS) {
      expect(WORLD_MOTION_KINDS, `${id} kind`).toContain(SCENES[id].motion.kind);
    }
    for (const kind of WORLD_MOTION_KINDS) {
      expect(styles, `@keyframes world-${kind}`).toContain(`@keyframes world-${kind} `);
      expect(styles, `a rule for ${kind}`).toContain(`.world__drift[data-motion="${kind}"]`);
    }
  });

  it('keeps three travelling kinds and gives the rest a place to stay', () => {
    const kinds = LOCALE_IDS.map((id) => SCENES[id].motion.kind);
    // The cave is the reference and keeps V3's crossing exactly.
    expect(SCENES.cave.motion).toEqual({ kind: 'cross' });
    expect(kinds.filter((kind) => TRAVELLING_KINDS.has(kind))).toHaveLength(3);
    // No two places move the same way: the point of the patch.
    expect(new Set(kinds).size).toBe(LOCALE_IDS.length);
  });

  it("mounts the kind on the element, and the place's own position when it has one", () => {
    const world = createWorldScene(null);
    for (const id of LOCALE_IDS) {
      world.setLocale(id);
      const drift = world.root.querySelector<HTMLElement>('.world__drift');
      expect(drift?.dataset['motion'], id).toBe(SCENES[id].motion.kind);
      const at = SCENES[id].motion.at;
      expect(drift?.style.getPropertyValue('--drift-x'), `${id} x`).toBe(at?.[0] ?? '');
      expect(drift?.style.getPropertyValue('--drift-y'), `${id} y`).toBe(at?.[1] ?? '');
      // Every mote is a sibling SVG straight under the element.
      expect(drift?.querySelectorAll(':scope > svg').length, `${id} motes`).toBe(SCENES[id].drift.match(/<svg /g)?.length);
    }
    world.destroy();
  });
});

describe('the world scene', () => {
  it('mounts three layers and a scrim, empty until a locale arrives', () => {
    const world = createWorldScene(null);
    expect([...world.root.querySelectorAll('.world__layer')].map((l) => l.className)).toEqual([
      'world__layer world__layer--far',
      'world__layer world__layer--mid',
      'world__layer world__layer--near',
    ]);
    expect(world.root.querySelector('.world__scrim')).not.toBeNull();
    expect(world.root.hidden).toBe(true);
    expect(world.current()).toBeNull();
    world.destroy();
  });

  it('draws every locale into all three layers with one moving element', () => {
    const world = createWorldScene(null);
    for (const id of LOCALE_IDS) {
      world.setLocale(id);
      expect(world.current()).toBe(id);
      expect(world.root.hidden).toBe(false);
      for (const layer of ['far', 'mid', 'near']) {
        expect(world.root.querySelector(`.world__layer--${layer} svg`), `${id} ${layer}`).not.toBeNull();
      }
      expect(world.root.querySelectorAll('.world__drift'), `${id} drift`).toHaveLength(1);
    }
    world.setLocale(null);
    expect(world.root.hidden).toBe(true);
    expect(world.root.querySelector('svg')).toBeNull();
    world.destroy();
  });

  it('does not mount the moving element under reduced motion, and leaves the layers still', () => {
    mockReducedMotion(true);
    const world = createWorldScene(null);
    world.setLocale('shore');
    expect(world.root.querySelector('.world__drift')).toBeNull();
    expect(world.root.querySelector('.world__layer--far svg')).not.toBeNull();
    Object.defineProperty(globalThis, 'scrollY', { configurable: true, value: 300 });
    globalThis.dispatchEvent(new Event('scroll'));
    for (const layer of ['far', 'mid', 'near']) {
      expect((world.root.querySelector(`.world__layer--${layer}`) as HTMLElement).style.transform).toBe('');
    }
    world.destroy();
  });

  it('moves the layers at 0.2, 0.5 and 1 of scroll', () => {
    const world = createWorldScene(null);
    world.setLocale('summit');
    Object.defineProperty(globalThis, 'scrollY', { configurable: true, value: 200 });
    globalThis.dispatchEvent(new Event('scroll'));
    expect((world.root.querySelector('.world__layer--far') as HTMLElement).style.transform).toBe(`translate3d(0, ${-200 * PARALLAX.far}px, 0)`);
    expect((world.root.querySelector('.world__layer--mid') as HTMLElement).style.transform).toBe(`translate3d(0, ${-200 * PARALLAX.mid}px, 0)`);
    expect((world.root.querySelector('.world__layer--near') as HTMLElement).style.transform).toBe(`translate3d(0, ${-200 * PARALLAX.near}px, 0)`);
    world.destroy();
  });

  it('follows data-locale on the element it is given', async () => {
    const html = document.createElement('div');
    html.setAttribute('data-locale', 'ruins');
    const world = createWorldScene(html);
    expect(world.current()).toBe('ruins');
    html.setAttribute('data-locale', 'marsh');
    await Promise.resolve();
    expect(world.current()).toBe('marsh');
    html.removeAttribute('data-locale');
    await Promise.resolve();
    expect(world.current()).toBeNull();
    world.destroy();
  });
});

/**
 * The field on the world. **Stage 4.11 Tier 3, D47.** The stylesheet paints
 * every weather kind the projection can name and tints the ground for every
 * terrain kind; a kind with no rule would be a mark with no sky behind it.
 */
describe('the field', () => {
  const styles = readFileSync(join(process.cwd(), 'src', 'ui', 'styles.css'), 'utf8');
  const WEATHERS = ['rain', 'sun', 'sand', 'snow', 'wind'];
  const TERRAINS = ['electric', 'grassy', 'misty', 'psychic'];

  it('paints every weather kind, each with its own keyframes', () => {
    for (const kind of WEATHERS) {
      expect(styles, `data-weather='${kind}'`).toContain(`:root[data-weather='${kind}'] .world__weather`);
      expect(styles, `@keyframes weather-${kind}`).toContain(`@keyframes weather-${kind} `);
    }
  });

  it('tints the ground for every terrain kind, and moves nothing for it', () => {
    for (const kind of TERRAINS) {
      expect(styles, `data-terrain='${kind}'`).toContain(`:root[data-terrain='${kind}'] .world__layer--near`);
    }
    expect(styles).not.toMatch(/data-terrain=[^\n]*animation/);
  });

  it('mixes every wash from a global token and never adds a locale token', () => {
    const tokens = readFileSync(join(process.cwd(), 'src', 'ui', 'theme', 'tokens.css'), 'utf8');
    for (const kind of WEATHERS) expect(tokens).toContain(`--weather-${kind}:`);
    for (const kind of TERRAINS) expect(tokens).toContain(`--terrain-${kind}:`);
    const locales = readFileSync(join(process.cwd(), 'src', 'ui', 'theme', 'locales.css'), 'utf8');
    expect(locales).not.toMatch(/--weather-|--terrain-/);
  });
});

