/**
 * The world scene: eight places, three layers each, one drifting thing, and
 * nothing under it harder to reach. Stage V3.
 *
 * @vitest-environment jsdom
 */
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOCALE_IDS } from '../src/data/locales';
import { createWorldScene, PARALLAX } from '../src/ui/scene';
import { SCENES } from '../src/ui/theme/scenes';

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
  it('gives every locale three layers and a drifting element, all inline SVG', () => {
    for (const id of LOCALE_IDS) {
      const art = SCENES[id];
      for (const layer of ['far', 'mid', 'near', 'drift'] as const) {
        expect(art[layer], `${id} ${layer}`).toMatch(/^<svg [^>]*viewBox="[^"]+"[^>]*>[\s\S]*<\/svg>$/);
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
    const all = LOCALE_IDS.map((id) => Object.values(SCENES[id]).join('')).join('');
    expect(gzipSync(Buffer.from(all)).length).toBeLessThan(30 * 1024);
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

  it('draws every locale into all three layers with one drifting element', () => {
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

  it('does not mount the drifting element under reduced motion, and leaves the layers still', () => {
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
