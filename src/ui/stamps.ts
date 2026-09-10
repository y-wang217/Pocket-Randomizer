/**
 * Corner stamps. Stage V2.
 *
 * Four small marks in the safe-area corners of every screen: the locale
 * top left, the segment of eight top right, the seed bottom left, the build
 * bottom right. Texture, not information: everything here is also said
 * somewhere on the screen at a readable size. They are fixed to the viewport
 * and out of flow, so they occupy no layout height, and every stamp but the
 * seed ignores the pointer.
 *
 * The seed stamp is the exception, and the reason the stamps exist: one tap
 * copies the run's seed. `formatSeedStamp` is the one function to extend when
 * `contentHash` lands and seeds take the `GYMRUN-xxxxxx-nnnnnnn` form from
 * the seeds document; until then the stamp carries the seed exactly as the
 * seed bar accepts it, so what is copied is what can be pasted.
 */
import { ENGINE_VERSION } from '../core/battle/driver';
import { RANDOMIZER_VERSION } from '../core/randomizer';
import { localeById, type LocaleId } from '../data/locales';
import { el } from './scene';

export interface StampState {
  locale: LocaleId | null;
  /** 1-based segment, or null before a run has one. */
  segment: number | null;
  segments: number;
  seed: string | null;
}

export interface Stamps {
  root: HTMLElement;
  update(state: StampState): void;
}

/** The shareable seed string. Today the bare seed; see the header. */
export function formatSeedStamp(seed: string): string {
  return seed;
}

/** The build, as a stamp reads it: engine version and randomizer version. */
export function formatBuildStamp(): string {
  const engine = ENGINE_VERSION.replace(/^gymrun-/, '');
  const randomizer = RANDOMIZER_VERSION.replace(/^gymrun-randomizer-/, 'r');
  return `${engine} · ${randomizer}`;
}

export function createStamps(): Stamps {
  const root = el('aside', 'stamps');
  root.setAttribute('aria-hidden', 'true');

  const locale = el('span', 'stamp stamp--tl stamp--locale');
  const segment = el('span', 'stamp stamp--tr stamp--segment');
  const seed = document.createElement('button');
  seed.type = 'button';
  seed.className = 'stamp stamp--bl stamp--seed';
  seed.title = 'Copy the seed';
  const build = el('span', 'stamp stamp--br stamp--build');
  build.textContent = formatBuildStamp();
  root.append(locale, segment, seed, build);

  let current = '';
  seed.addEventListener('click', () => {
    if (!current) return;
    const text = formatSeedStamp(current);
    const done = (ok: boolean): void => {
      seed.dataset['copied'] = ok ? 'true' : 'false';
      setTimeout(() => delete seed.dataset['copied'], 1500);
    };
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard) {
      done(false);
      return;
    }
    clipboard.writeText(text).then(
      () => done(true),
      () => done(false),
    );
  });

  return {
    root,
    update(state) {
      locale.textContent = state.locale ? localeById(state.locale).name : '';
      locale.hidden = !state.locale;
      segment.textContent = state.segment ? `${state.segment} / ${state.segments}` : '';
      segment.hidden = !state.segment;
      current = state.seed ?? '';
      seed.textContent = current ? formatSeedStamp(current) : '';
      seed.hidden = !current;
    },
  };
}
