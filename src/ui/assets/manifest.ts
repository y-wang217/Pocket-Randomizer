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
 * (`docs/spec/gymrun-stage5.0-battle-backdrops.md`), and **the eight map
 * backdrops since 5.0/4** (`docs/spec/gymrun-stage5.0-map-backdrops.md`),
 * converted from the author's paintings by `scripts/visual/backdrops.py`, and
 * **the opening painting**, the World before the first region, since Bible
 * Rev 20, D87 (`docs/spec/gymrun-patch-opening-world.md`).
 * **Every icon is art since 5.0/5** (`docs/spec/gymrun-stage5.0-rulings-stage5.md`),
 * drawn on its native grid by `scripts/visual/icons.py`. No placeholder is
 * left; each entry keeps its letter, which is what a file that fails to
 * resolve shows in its place.
 *
 * ## Two tones
 *
 * A backdrop or a relic is a picture, drawn in its own colours (`colour`). A
 * node, capability or currency mark, a nav icon and the wordmark are ink
 * (`mask`): the file's opaque pixels are drawn in `currentColor` through a CSS
 * mask, so they are monochrome and follow the theme like every glyph in the
 * sheet, and colour stays secondary (bible section 2).
 *
 * ## The three glyph families
 *
 * The node, capability and currency marks are section 2 glyph families, so
 * they are drawn by `glyphNode` and never by `assetIcon` (D61): the renderer
 * asks `glyphArt` for the drawing and falls back to the sheet's SVG mark when
 * there is none, so a family cannot be drawn without reporting itself. Their
 * native size is 8, the one size that scales by whole multiples to both 16
 * (the battle header) and 24 (the map node card).
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
 * (`docs/visual/reports/5.0-stage0-spike.md`, section 2), except the node mark,
 * 8 since 5.0/5 where the spike said 16, by D61's ruling; and the battle
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
import { VIGNETTE_MOMENTS, type VignetteMoment } from '../../data/vignetteCopy';

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

/** How a drawing's pixels are painted: its own colours, or ink in `currentColor`. */
export type Tone = 'colour' | 'mask';

/** A drawing, committed under `src/ui/assets/`. */
export interface ArtFile {
  kind: 'file';
  /** Relative to `src/ui/assets/`. */
  file: string;
  native: NativeSize;
  tone: Tone;
  /** What an icon shows if the file does not resolve. Backdrops show their tint. */
  letter?: string;
}

export type Asset = Placeholder | ArtFile;

export const NATIVE = {
  mapBackdrop: { width: 272, height: 408 },
  /** Twice the map's grid: it covers the viewport behind the frame (D87). */
  openingBackdrop: { width: 544, height: 816 },
  battleBackdrop: { width: 224, height: 136 },
  node: { width: 8, height: 8 },
  capability: { width: 8, height: 8 },
  relic: { width: 16, height: 16 },
  nav: { width: 12, height: 12 },
  currency: { width: 8, height: 8 },
  wordmark: { width: 96, height: 16 },
  /** A node kind's coloured cutout (D109): the map, the node band, the vignette. */
  silhouette: { width: 32, height: 32 },
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

/**
 * Every node kind, read off the letters' record, which the compiler holds to
 * the data's own union: a kind added to the game without an entry here fails
 * to build. The calm-down patch's tests read their kind list from this (D109).
 */
export const NODE_KINDS: readonly NodeKind[] = Object.keys(NODE_LETTERS) as NodeKind[];

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

/** A battle backdrop's drawing. One file per locale and one for every gym. */
const battleBackdrop = (id: LocaleId | 'gym'): ArtFile => ({
  kind: 'file',
  file: `backdrops/battle/${id}.png`,
  native: NATIVE.battleBackdrop,
  tone: 'colour',
});

/** A map backdrop's drawing. One file per locale, since 5.0/4. */
const mapBackdrop = (id: LocaleId): ArtFile => ({
  kind: 'file',
  file: `backdrops/map/${id}.png`,
  native: NATIVE.mapBackdrop,
  tone: 'colour',
});

/** The World's painting before the first region. Rev 20, D87. */
const openingBackdrop: ArtFile = {
  kind: 'file',
  file: 'backdrops/opening.png',
  native: NATIVE.openingBackdrop,
  tone: 'colour',
};

/** An icon's drawing, since 5.0/5, with the letter it falls back to. */
const icon = (file: string, native: NativeSize, tone: Tone, letter: string): ArtFile => ({
  kind: 'file',
  file,
  native,
  tone,
  letter,
});

/**
 * A node kind's silhouette. **The map calm-down patch, bible Rev 30, D109:
 * shape first, then colour.** The five drawings are the author's, converted
 * to 32x32 by `scripts/visual/silhouettes.py`, in their own colours. Rest
 * has no drawing yet, so its silhouette is the tent's 8px ink mark, drawn in
 * rest's colour token through the mask: art never blocks code, and a
 * drawing dropped in later is this one line.
 */
const silhouette = (kind: NodeKind): ArtFile =>
  kind === 'rest'
    ? icon('glyphs/node-rest.png', NATIVE.node, 'mask', NODE_LETTERS[kind])
    : icon(`silhouettes/node-${kind}.png`, NATIVE.silhouette, 'colour', NODE_LETTERS[kind]);

/**
 * A vignette's sprite (D109). Where the moment has a person to show, the
 * vignette shows them instead (a trainer's sprite, the lead's), and this is
 * what it falls back to. A kind's moment is its silhouette; the return to the
 * map has no drawing, so it ships as the lettered chip at the silhouette's
 * size, the placeholder rule, until one arrives.
 */
const vignette = (moment: VignetteMoment): Asset =>
  moment === 'return' ? { kind: 'placeholder', letter: '→', native: NATIVE.silhouette } : silhouette(moment);

export type AssetKey =
  | `map-backdrop:${LocaleId}`
  | `battle-backdrop:${LocaleId | 'gym'}`
  | 'opening-backdrop'
  | `node:${NodeKind}`
  | `capability:${Capability}`
  | `relic:${RelicId}`
  | `nav:${NavTab}`
  | 'currency'
  | 'wordmark'
  | `silhouette:${NodeKind}`
  | `vignette:${VignetteMoment}`;

function build(): ReadonlyMap<AssetKey, Asset> {
  const entries: [AssetKey, Asset][] = [];
  for (const locale of LOCALES) {
    entries.push([`map-backdrop:${locale.id}`, mapBackdrop(locale.id)]);
    entries.push([`battle-backdrop:${locale.id}`, battleBackdrop(locale.id)]);
  }
  entries.push(['battle-backdrop:gym', battleBackdrop('gym')]);
  entries.push(['opening-backdrop', openingBackdrop]);
  for (const [kind, letter] of Object.entries(NODE_LETTERS) as [NodeKind, string][]) {
    entries.push([`node:${kind}`, icon(`glyphs/node-${kind}.png`, NATIVE.node, 'mask', letter)]);
  }
  for (const capability of CAPABILITIES) {
    entries.push([`capability:${capability}`, icon(`glyphs/capability-${capability}.png`, NATIVE.capability, 'mask', capabilityLetters(capability))]);
  }
  for (const relic of RELICS) {
    entries.push([`relic:${relic.id}`, icon(`icons/relic-${relic.id}.png`, NATIVE.relic, 'colour', relicLetters(relic.name))]);
  }
  for (const tab of NAV_TABS) entries.push([`nav:${tab}`, icon(`icons/nav-${tab}.png`, NATIVE.nav, 'mask', NAV_LETTERS[tab])]);
  entries.push(['currency', icon('glyphs/currency-coin.png', NATIVE.currency, 'mask', '¢')]);
  entries.push(['wordmark', icon('icons/wordmark.png', NATIVE.wordmark, 'mask', 'GYMRUN')]);
  for (const kind of Object.keys(NODE_LETTERS) as NodeKind[]) entries.push([`silhouette:${kind}`, silhouette(kind)]);
  for (const moment of VIGNETTE_MOMENTS) entries.push([`vignette:${moment}`, vignette(moment)]);
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
  if (url && asset.kind === 'file') {
    // A background or a mask, not an `<img>`: sprites are `ui/sprites.ts`'s
    // alone, and this is decoration the caller names (`test/sprites.test.ts`).
    icon.classList.add('asset--art', `asset--${asset.tone}`);
    icon.style.setProperty('--asset-image', `url(${url})`);
  } else {
    icon.classList.add('asset--placeholder');
    icon.textContent = asset.letter ?? '';
  }
  return icon;
}

/**
 * A placeholder icon with no manifest entry behind it. **Defender Mode v0**,
 * whose prompt ships it on placeholders with no new art: a defender-only relic
 * (the Stranger's Pass) and the three consumables are drawn as the lettered
 * chip every manifest entry falls back to, at the native size of their kind.
 * Kept out of `MANIFEST` so the attacker's "no placeholder remains" holds
 * (`test/asset-manifest.test.ts`).
 */
export function placeholderIcon(name: string, native: NativeSize): HTMLElement {
  const icon = document.createElement('span');
  icon.className = 'asset asset--placeholder';
  icon.setAttribute('aria-hidden', 'true');
  icon.style.setProperty('--asset-w', String(native.width));
  icon.style.setProperty('--asset-h', String(native.height));
  icon.textContent = relicLetters(name);
  return icon;
}

/** A relic's icon: its drawing, or a placeholder for a defender-only relic. */
export function relicIcon(id: string, name: string): HTMLElement {
  const key = `relic:${id}` as AssetKey;
  return MANIFEST.has(key) ? assetIcon(key) : placeholderIcon(name, NATIVE.relic);
}

/**
 * The manifest key holding a glyph's drawing, for the three glyph families
 * that have one: node, capability and currency (D61). The band chevron is a
 * capability glyph with no class C slot, and stays the sheet's mark.
 */
export function glyphArtKey(glyphId: string): AssetKey | null {
  if (glyphId === 'currency-coin') return 'currency';
  const [family, ...rest] = glyphId.split('-');
  const name = rest.join('-');
  const key = family === 'node' || family === 'capability' ? (`${family}:${name}` as AssetKey) : null;
  return key && MANIFEST.has(key) ? key : null;
}

/**
 * A glyph's drawing as a URL, or null to draw the sheet's mark. **Stage
 * 5.0/5.** Read by `glyphNode` and nothing else.
 */
export function glyphArt(glyphId: string): string | null {
  const key = glyphArtKey(glyphId);
  const asset = key ? MANIFEST.get(key) : undefined;
  return asset?.kind === 'file' ? assetUrl(asset) : null;
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
