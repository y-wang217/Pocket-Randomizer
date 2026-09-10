/**
 * Pokemon sprites, through `@pkmn/img`. Stage V4.
 *
 * The adaptable entry with a minimal record per species: the Gen 5 static
 * sprite set on Showdown's CDN is addressed by species id alone, which is all
 * a run summary needs, and the package's full table would cost the bundle
 * 43 kB gzipped (V2 measured it for item icons). Nothing raster ships in the
 * repo; the plan's asset rule.
 *
 * The image is decorative and has the species as its alt text, so a screen
 * with no network reads the same. A missing sprite is an empty box, not a
 * broken image icon: `onerror` hides it.
 */
import { Sprites } from '@pkmn/img/adaptable';

import { el } from './dom';

const toId = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '');

const sprites = new Sprites({
  getPokemon: (name: string) => ({ id: toId(name), spriteid: toId(name), gen: 5, num: 1 }),
  getItem: () => undefined,
  getAvatar: () => undefined,
});

/** The sprite URL for a species, or a stable placeholder when it cannot resolve. */
export function spriteUrl(species: string): string {
  return sprites.getPokemon(species, { gen: 'gen5' }).url;
}

export function spriteImg(species: string): HTMLImageElement {
  const img = el('img', 'sprite');
  img.src = spriteUrl(species);
  img.alt = species;
  img.width = 96;
  img.height = 96;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => {
    img.dataset['missing'] = 'true';
  });
  return img;
}
