/**
 * The asset manifest: every piece of original (class C) art the 5.0 redesign
 * uses, by key. **Stage 5.0/1**, the plan's placeholder rule.
 *
 * *"Art never blocks code. Every class C slot ships first as a placeholder (a
 * flat locale tint for backdrops, a lettered chip for icons). One manifest
 * maps keys to files. Swapping a placeholder for real art is a one-line
 * manifest edit and a file drop, with no code change."*
 *
 * So a caller asks for a key and gets an element, and never knows whether it
 * is a placeholder. **The nine battle backdrops are art since 5.0/2**
 * (`docs/spec/gymrun-stage5.0-battle-backdrops.md`), and **the map backdrops
 * as they arrive since 5.0/4** (`docs/spec/gymrun-stage5.0-map-backdrops.md`),
 * converted from the author's paintings by `scripts/visual/backdrops.py`;
 * every other entry is a placeholder.
 *
 * ## Where the art lives, and why there
 *
 * Files go in `src/ui/assets/`, outside `src/data/**`, so a drawing changes no
 * seed: `contentHash` is computed over `data/` alone. Nothing under `core/`
 * reads this file.
 *
 * ## Native sizes
 *
 * All of it is pixel art at a fixed native size, drawn at whole multiples of
 * one art pixel (`--art-px`, 2 CSS px) with `image-rendering: pixelated`. The
 * sizes are the 5.0/0 spike's
 * (`docs/visual/reports/5.0-stage0-spike.md`, section 2), except the battle
 * backdrop: 224x136 since 5.0/2, the stage's own 272px height and the widest
 * frame's width at 2 CSS px an art pixel, where the spike's 216x170 was sized
 * for a 340px stage; and the map backdrop, 272x408 since 5.0/4, 2:3 as the
 * author painted it, which at 2 CSS px covers the map area at every plan size
 * (the tallest, at 1920x1080, is 816px) where the spike's 216x432 was 1:2.
 *
 * ## What is not here
 *
 * Pokemon, items and trainers are class A, from the Showdown CDN through
 * `@pkmn/img`, and ship nothing. Panels, pips, bars and edges are class B,
 * drawn in CSS.
 */
import { CAPABILITIES, type Capability } from '../../data/capabilities';
import { LOCALES, type LocaleId } from '../../data/locales';
import { RELICS, type RelicId } from '../../data/relics';
import type { NodeKind } from '../../data/tuning';

export interface NativeSize {
  width: number;
  height: number;
}

/** What stands in for art until there is art. */
export interface Placeholder {
  kind: 'placeholder';
  /** A lettered chip for an icon; the stylesheet's flat tint for a backdrop. */
  letter: string;
  native: NativeSize;
}

/** A drawing, committed under `src/ui/assets/`. */
export interface ArtFile {
  kind: 'file';
  /** Relative to `src/ui/assets/`. */
  file: string;
  native: NativeSize;
}

export type Asset = Placeholder | ArtFile;

export const NATIVE = {
  mapBackdrop: { width: 272, height: 408 },
  battleBackdrop: { width: 224, height: 136 },
  node: { width: 16, height: 16 },
  capability: { width: 8, height: 8 },
  relic: { width: 16, height: 16 },
  nav: { width: 12, height: 12 },
  currency: { width: 8, height: 8 },
  wordmark: { width: 96, height: 16 },
} as const satisfies Record<string, NativeSize>;

/** The five tabs of the shell nav, in order. */
export const NAV_TABS = ['map', 'team', 'bag', 'info', 'settings'] as const;
export type NavTab = (typeof NAV_TABS)[number];

/*
 * The letters. Typed as records over the data's own unions, so a node kind,
 * a capability or a tab added to the game without a manifest entry is a
 * compile error here, not a missing icon on a screen.
 */
const NODE_LETTERS: Readonly<Record<NodeKind, string>> = {
  wild: 'W',
  trainer: 'T',
  rest: 'R',
  gym: 'G',
  shop: '$',
  event: '?',
};

const NAV_LETTERS: Readonly<Record<NavTab, string>> = {
  map: 'M',
  team: 'T',
  bag: 'B',
  info: 'R',
  settings: 'S',
};

const capabilityLetters = (capability: Capability): string =>
  capability.replace(/([A-Z])/g, ' $1').split(' ').map((word) => word[0]?.toUpperCase() ?? '').join('').padEnd(2, capability[1] ?? '').slice(0, 2);

const relicLetters = (name: string): string =>
  name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map((word) => word[0]?.toUpperCase() ?? '').join('').slice(0, 2);

const placeholder = (letter: string, native: NativeSize): Placeholder => ({ kind: 'placeholder', letter, native });

/** A battle backdrop's drawing. One file per locale and one for every gym. */
const battleBackdrop = (id: LocaleId | 'gym'): ArtFile => ({
  kind: 'file',
  file: `backdrops/battle/${id}.png`,
  native: NATIVE.battleBackdrop,
});

/**
 * The locales whose map backdrop has arrived. **Stage 5.0/4.** A locale named
 * here draws its file; the rest keep the placeholder tint. Adding the next one
 * is a file drop and its id here.
 */
const MAP_ART: ReadonlySet<LocaleId> = new Set<LocaleId>(['cave', 'shore', 'summit', 'city', 'marsh']);

/** A map backdrop's drawing, or its placeholder until one arrives. */
const mapBackdrop = (id: LocaleId, letter: string): Asset =>
  MAP_ART.has(id) ? { kind: 'file', file: `backdrops/map/${id}.png`, native: NATIVE.mapBackdrop } : placeholder(letter, NATIVE.mapBackdrop);

export type AssetKey =
  | `map-backdrop:${LocaleId}`
  | `battle-backdrop:${LocaleId | 'gym'}`
  | `node:${NodeKind}`
  | `capability:${Capability}`
  | `relic:${RelicId}`
  | `nav:${NavTab}`
  | 'currency'
  | 'wordmark';

function build(): ReadonlyMap<AssetKey, Asset> {
  const entries: [AssetKey, Asset][] = [];
  for (const locale of LOCALES) {
    entries.push([`map-backdrop:${locale.id}`, mapBackdrop(locale.id, locale.name[0] ?? '')]);
    entries.push([`battle-backdrop:${locale.id}`, battleBackdrop(locale.id)]);
  }
  entries.push(['battle-backdrop:gym', battleBackdrop('gym')]);
  for (const [kind, letter] of Object.entries(NODE_LETTERS) as [NodeKind, string][]) {
    entries.push([`node:${kind}`, placeholder(letter, NATIVE.node)]);
  }
  for (const capability of CAPABILITIES) {
    entries.push([`capability:${capability}`, placeholder(capabilityLetters(capability), NATIVE.capability)]);
  }
  for (const relic of RELICS) {
    entries.push([`relic:${relic.id}`, placeholder(relicLetters(relic.name), NATIVE.relic)]);
  }
  for (const tab of NAV_TABS) entries.push([`nav:${tab}`, placeholder(NAV_LETTERS[tab], NATIVE.nav)]);
  entries.push(['currency', placeholder('¢', NATIVE.currency)]);
  entries.push(['wordmark', placeholder('GYMRUN', NATIVE.wordmark)]);
  return new Map(entries);
}

/** Every class C slot, by key. */
export const MANIFEST: ReadonlyMap<AssetKey, Asset> = build();

export function assetFor(key: AssetKey): Asset {
  const asset = MANIFEST.get(key);
  if (!asset) throw new RangeError(`No asset for ${key}`);
  return asset;
}

/*
 * A drawing's URL, resolved by the bundler. Empty until the first file lands:
 * `import.meta.glob` over this directory is the one place a file becomes a
 * URL, so a file dropped here and named in an entry above is all a swap is.
 */
const FILES = import.meta.glob('./**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function assetUrl(asset: ArtFile): string | null {
  const href = FILES[`./${asset.file}`];
  /*
   * Absolute, through the global `URL`. **Stage 5.0/2, and the reason is the
   * bundle, not the value.** The glob compiles to `new URL(file,
   * import.meta.url)`, injected after Rollup has already renamed clashing
   * top-level names. `@pkmn/img` declares a module-level `var URL`, and in a
   * bundle where nothing else names the global, Rollup leaves that `var` alone
   * and the injected `new URL` calls it: the gallery built this way threw
   * "URL is not a constructor" and never became ready. Naming the global here
   * is what makes Rollup rename the library's `URL` in every bundle that has
   * art, whichever other modules it happens to include.
   */
  return href === undefined ? null : new URL(href, document.baseURI).href;
}

/**
 * An icon-sized asset as an element: a lettered chip for a placeholder, the
 * drawing at its native size for a file. Decorative: the caller names what it
 * stands for.
 */
export function assetIcon(key: AssetKey): HTMLElement {
  const asset = assetFor(key);
  const url = asset.kind === 'file' ? assetUrl(asset) : null;
  const icon = document.createElement('span');
  icon.className = 'asset';
  icon.dataset['asset'] = key;
  icon.setAttribute('aria-hidden', 'true');
  icon.style.setProperty('--asset-w', String(asset.native.width));
  icon.style.setProperty('--asset-h', String(asset.native.height));
  if (url) {
    // A background, not an `<img>`: sprites are `ui/sprites.ts`'s alone, and
    // this is decoration the caller names (`test/sprites.test.ts`).
    icon.classList.add('asset--art');
    icon.style.backgroundImage = `url(${url})`;
  } else {
    icon.classList.add('asset--placeholder');
    icon.textContent = asset.kind === 'placeholder' ? asset.letter : '';
  }
  return icon;
}

/**
 * A backdrop as the background of a scene element. **Stage 5.0/2, D60.**
 *
 * The scene backdrop is the game screen's own art, inside the frame; the
 * World behind the frame is `scene.ts`'s and does not come through here. The
 * element keeps its placeholder tint underneath whatever this sets, so a file
 * that is named but missing, or that fails to load, shows the placeholder at
 * the element's own size rather than a broken image: the size is the
 * element's, never the file's.
 *
 * `data-backdrop` names the key, which is what the stylesheet reads to pick a
 * placeholder tint (the gym's differs from a locale's) and what a test reads
 * to see which backdrop a fight is standing on. `data-art` is `file` only when
 * a drawing resolved, so the placeholder's painted ground can step aside for
 * it. `null` clears both.
 */
export function applyBackdrop(target: HTMLElement, key: AssetKey | null): void {
  const asset = key ? MANIFEST.get(key) : undefined;
  const url = asset?.kind === 'file' ? assetUrl(asset) : null;
  if (key && asset) target.dataset['backdrop'] = key;
  else delete target.dataset['backdrop'];
  if (url && asset) {
    target.dataset['art'] = 'file';
    target.style.setProperty('--backdrop-image', `url(${url})`);
    // The drawing's native size, so the stylesheet draws it at whole art
    // pixels rather than stretching it to the element.
    target.style.setProperty('--backdrop-w', String(asset.native.width));
    target.style.setProperty('--backdrop-h', String(asset.native.height));
  } else {
    target.dataset['art'] = 'placeholder';
    for (const property of ['--backdrop-image', '--backdrop-w', '--backdrop-h']) target.style.removeProperty(property);
  }
}
