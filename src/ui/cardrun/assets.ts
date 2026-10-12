/**
 * The card run's art (`docs/spec/gymrun-card-run-menus-art.md`): one slot per
 * picture the author's mock draws on the run's screens, each a full-colour SVG
 * at `src/ui/assets/cardrun/{id}.svg`. The screens ask for a slot by its ID;
 * nothing else names a file.
 *
 * Every slot draws something sensible before its file arrives, so the run
 * never shows a broken box: a backdrop or a character draws nothing, the sign
 * draws a plain plank in CSS, and an icon draws its fallback glyph. When the
 * file lands, the same element draws it. The ChatGPT prompt that generates
 * the files is `docs/reports/card-run-menus-asset-prompt.md`; its table and
 * this one say the same thing.
 *
 * Unit portraits, card pictures and hearts are the battle's
 * (`ui/cardbattle/assets.ts`, `ui/cardbattle/meters.ts`), reused, not redrawn.
 *
 * Outside the design bible, like the battle (`docs/generation.md` 125c).
 */

/** How a slot is drawn: stretched over its box, cut nine ways, or at a fixed size. */
export type RunAssetKind = 'backdrop' | 'sign' | 'character' | 'icon';

export interface RunAssetDef {
  kind: RunAssetKind;
  /** The SVG's viewBox, width by height. */
  viewBox: readonly [number, number];
  /** The size it is drawn at on a 390-wide phone, in CSS pixels; a backdrop covers its screen instead. */
  render: readonly [number, number];
  /** What an icon shows while its file has not arrived. */
  fallback?: string;
  /** For the sign: the slice insets in viewBox units, top, right, bottom, left. */
  slice?: readonly [number, number, number, number];
}

export const RUN_ASSETS = {
  // Backdrops: full-bleed scenes behind a screen, drawn to cover a portrait phone.
  'bg-route': { kind: 'backdrop', viewBox: [780, 1688], render: [390, 844] },
  'bg-market': { kind: 'backdrop', viewBox: [780, 1688], render: [390, 844] },
  'bg-city': { kind: 'backdrop', viewBox: [780, 1688], render: [390, 844] },
  'bg-trail': { kind: 'backdrop', viewBox: [780, 1688], render: [390, 844] },
  // The wooden sign every screen's heading hangs on, stretched by its middle.
  'sign-plank': { kind: 'sign', viewBox: [360, 140], render: [358, 96], slice: [44, 48, 28, 48] },
  // Characters: who stands at the foot of a screen.
  'char-scout': { kind: 'character', viewBox: [240, 240], render: [112, 112] },
  'char-trader': { kind: 'character', viewBox: [240, 240], render: [112, 112] },
  'char-party': { kind: 'character', viewBox: [480, 240], render: [208, 104] },
  // Icons: full colour, drawn at a fixed size beside a word.
  'stop-city': { kind: 'icon', viewBox: [96, 96], render: [48, 48], fallback: '⌂' },
  'stop-town': { kind: 'icon', viewBox: [96, 96], render: [48, 48], fallback: '⚔' },
  'stop-wild': { kind: 'icon', viewBox: [96, 96], render: [48, 48], fallback: '?' },
  'city-market': { kind: 'icon', viewBox: [96, 96], render: [44, 44], fallback: '◆' },
  'city-defense': { kind: 'icon', viewBox: [96, 96], render: [44, 44], fallback: '⛨' },
  'icon-warning': { kind: 'icon', viewBox: [64, 64], render: [28, 28], fallback: '!' },
  'icon-star': { kind: 'icon', viewBox: [64, 64], render: [18, 18], fallback: '★' },
  'icon-supplies': { kind: 'icon', viewBox: [64, 64], render: [20, 20], fallback: '◆' },
  'icon-deck': { kind: 'icon', viewBox: [64, 64], render: [20, 20], fallback: '▤' },
} as const satisfies Record<string, RunAssetDef>;

export type RunAssetId = keyof typeof RUN_ASSETS;

const FILES = import.meta.glob('../assets/cardrun/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Where a slot's file lives, relative to `src/ui/assets/cardrun/`. */
export function runAssetPath(id: RunAssetId): string {
  return `${id}.svg`;
}

/** The bundled URL for a slot, or `null` while its file has not arrived. */
export function runAssetUrl(id: RunAssetId, files: Record<string, string> = FILES): string | null {
  return files[`../assets/cardrun/${runAssetPath(id)}`] ?? null;
}

/** Every file in the folder that is no slot's: a misnamed delivery, which nothing would draw. */
export function strayRunFiles(files: Record<string, string> = FILES): string[] {
  const known = new Set((Object.keys(RUN_ASSETS) as RunAssetId[]).map((id) => `../assets/cardrun/${runAssetPath(id)}`));
  return Object.keys(files).filter((path) => !known.has(path));
}

/**
 * The element for a slot. A backdrop and the sign stretch over their parent;
 * a character and an icon take their render size. With its file, the element
 * draws it; without, `data-missing` is set and the stylesheet draws the
 * fallback (`cardrun.css`).
 */
export function runAsset(id: RunAssetId, files?: Record<string, string>): HTMLElement {
  const def: RunAssetDef = RUN_ASSETS[id];
  const el = document.createElement('span');
  el.className = `cr-asset cr-asset--${def.kind}`;
  el.dataset['asset'] = id;
  el.setAttribute('aria-hidden', 'true');
  if (def.kind === 'character' || def.kind === 'icon') {
    el.style.width = `${def.render[0]}px`;
    el.style.height = `${def.render[1]}px`;
  }
  const url = runAssetUrl(id, files);
  if (!url) {
    el.dataset['missing'] = 'true';
    // Drawn by the stylesheet, so it is never part of a label's text.
    if (def.fallback) el.dataset['fallback'] = def.fallback;
    return el;
  }
  const css = `url("${url.replace(/"/g, '%22')}")`;
  if (def.slice) {
    // Cut nine ways: the posts and the ends keep their drawn size, the middle stretches.
    const [top, right, bottom, left] = def.slice;
    const scale = def.render[1] / def.viewBox[1];
    const w = [top, right, bottom, left].map((n) => `${Math.round(n * scale)}px`).join(' ');
    el.style.borderStyle = 'solid';
    el.style.borderWidth = w;
    el.style.borderImage = `${css} ${top} ${right} ${bottom} ${left} fill / ${w} stretch`;
  } else {
    el.style.setProperty('--cr-asset-image', css);
  }
  return el;
}
