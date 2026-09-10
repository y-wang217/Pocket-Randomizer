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

/**
 * Which way the sprite faces. **V5.**
 *
 * `p1` is the near side and gets the back sprite, `p2` the far side and the
 * front — the same `p1`/`p2` the protocol, the projection and the log all use,
 * so a caller never has to translate. Omitted, the front sprite is returned,
 * which is what every surface outside a battle wants: a run summary is looking
 * at the Pokemon, not standing beside it.
 */
export type SpriteSide = 'p1' | 'p2';

/** The sprite URL for a species, or a stable placeholder when it cannot resolve. */
export function spriteUrl(species: string, side?: SpriteSide): string {
  return sprites.getPokemon(species, { gen: 'gen5', ...(side ? { side } : {}) }).url;
}

/**
 * The sprite element for a species.
 *
 * **An empty species leaves `src` unset**, which is the state the battle stage
 * builds its two actors in: the elements exist and hold their box from the
 * first frame, and a URL arrives when a projection says who is standing there.
 * Resolving `''` would request `gen5/.png`, which 404s on every mount and puts
 * a failed request in the console of every session that ever opened a fight.
 */
export function spriteImg(species: string, side?: SpriteSide): HTMLImageElement {
  const img = el('img', 'sprite');
  if (species) img.src = spriteUrl(species, side);
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
