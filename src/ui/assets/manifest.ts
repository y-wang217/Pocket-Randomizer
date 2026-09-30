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
 * is a placeholder. Every entry below is a placeholder today; the art source
 * is undecided (`docs/spec/gymrun-stage5.0-visual-redesign.md`, "Open").
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
 * (`docs/visual/reports/5.0-stage0-spike.md`, section 2).
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
  mapBackdrop: { width: 216, height: 432 },
  battleBackdrop: { width: 216, height: 170 },
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
    entries.push([`map-backdrop:${locale.id}`, placeholder(locale.name[0] ?? '', NATIVE.mapBackdrop)]);
    entries.push([`battle-backdrop:${locale.id}`, placeholder(locale.name[0] ?? '', NATIVE.battleBackdrop)]);
  }
  entries.push(['battle-backdrop:gym', placeholder('G', NATIVE.battleBackdrop)]);
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
  return FILES[`./${asset.file}`] ?? null;
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
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.className = 'asset__art';
    icon.append(img);
  } else {
    icon.classList.add('asset--placeholder');
    icon.textContent = asset.kind === 'placeholder' ? asset.letter : '';
  }
  return icon;
}
