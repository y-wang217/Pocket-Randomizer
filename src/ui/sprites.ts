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

/**
 * How many distinct starting points the idle bob has. **Idle-sprites patch.**
 *
 * A row of figures that all hopped on the same frame would read as one
 * mechanism rather than six bodies, so each starts partway through its cycle.
 * The phase is the caller's slot or card index, never a draw: the global
 * random function is banned and the keyed streams are for the run, not for
 * decoration.
 */
export const IDLE_PHASES = 6;

export interface FigureOptions {
  /** Which of the `IDLE_PHASES` starting points; the slot or card index. */
  phase?: number;
  side?: SpriteSide;
}

/**
 * A sprite in a figure that bobs while idle. **Idle-sprites patch.**
 *
 * The bob lives on this wrapper and never on the image, because the battle
 * stage owns `transform` and `animation` on `.stage__actor .sprite` for the
 * lunge, the recoil and the faint, and a second animation on the same element
 * would cancel one or the other. A `.figure` never appears inside
 * `.stage__actor`; `test/sprites.test.ts` holds that.
 *
 * Hidden from the accessibility tree: on every surface that mounts one the
 * adjacent name already says who this is, the same reason the stage's actors
 * are hidden. The image keeps its `alt` for the reader who sees it.
 */
export function spriteFigure(species: string, options: FigureOptions = {}): HTMLElement {
  const figure = el('span', 'figure');
  figure.setAttribute('aria-hidden', 'true');
  const phase = options.phase ?? 0;
  figure.style.setProperty('--idle-phase', String(((phase % IDLE_PHASES) + IDLE_PHASES) % IDLE_PHASES));
  figure.append(spriteImg(species, options.side));
  return figure;
}
