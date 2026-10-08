/**
 * The map calm-down. **The map calm-down and journey vignettes patch, bible
 * Rev 31, D113** (`docs/spec/gymrun-patch-map-calm-down-and-journey-vignettes.md`),
 * its test 3 and the structural half of its test 2.
 *
 * Shape first, then colour: every node kind has its own silhouette and its own
 * colour token, asserted from the kind list in code (`NODE_KINDS`, which the
 * compiler holds to `data/tuning.ts`'s union). And the map has three weights,
 * with the step being chosen from the only controls on it. The pixel half of
 * test 2 (44px, no scroll at 390x844) is `test/visual-journey.test.ts`'s.
 *
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

import { beforeEach, describe, expect, it } from 'vitest';

import type { RunState } from '../src/core/run';
import { DEFAULT_DISPLAY_TUNING } from '../src/data/displayTuning';
import { MANIFEST, NODE_KINDS } from '../src/ui/assets/manifest';
import { deepMapState, openingState } from '../src/ui/gallery-fixtures';
import { createMapGraph } from '../src/ui/screens/run-map';

const SEED = 'MAPCALM';
const TOKENS = readFileSync(join(process.cwd(), 'src/ui/theme/tokens.css'), 'utf8');
const STYLES = readFileSync(join(process.cwd(), 'src/ui/styles.css'), 'utf8');

function drawn(state: RunState, onChoose?: (index: number) => void): HTMLElement {
  const graph = createMapGraph();
  document.body.replaceChildren(graph.root);
  graph.render(state, state.segments[state.currentSegment]!, onChoose);
  return graph.root;
}

/** A PNG's opaque pixels as a set of "x,y", scaled to a 32 grid. */
function silhouetteOf(file: string): Set<string> {
  const png = readFileSync(join(process.cwd(), 'src/ui/assets', file));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colourType = png[25]!;
  const chunks: Buffer[] = [];
  let palette: Buffer | null = null;
  let alphaTable: Buffer | null = null;
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === 'IDAT') chunks.push(data);
    if (type === 'PLTE') palette = data;
    if (type === 'tRNS') alphaTable = data;
    at += 12 + length;
  }
  const channels = { 6: 4, 3: 1, 4: 2, 0: 1, 2: 3 }[colourType as 6 | 3 | 4 | 0 | 2];
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels + 1;
  const rows: Buffer[] = [];
  let previous = Buffer.alloc(width * channels);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * stride]!;
    const line = Buffer.from(raw.subarray(y * stride + 1, (y + 1) * stride));
    for (let x = 0; x < line.length; x++) {
      const left = x >= channels ? line[x - channels]! : 0;
      const up = previous[x]!;
      const corner = x >= channels ? previous[x - channels]! : 0;
      const paeth = (): number => {
        const p = left + up - corner;
        const [a, b, c] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - corner)];
        return a <= b && a <= c ? left : b <= c ? up : corner;
      };
      const add = [0, left, up, (left + up) >> 1, paeth()][filter]!;
      line[x] = (line[x]! + add) & 0xff;
    }
    rows.push(line);
    previous = line;
  }
  const opaque = new Set<string>();
  const scale = 32 / width;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const row = rows[y]!;
      const alpha =
        colourType === 6 ? row[x * 4 + 3]! : colourType === 4 ? row[x * 2 + 1]! : colourType === 3 ? (alphaTable?.[row[x]!] ?? 255) : 255;
      if (alpha < 128) continue;
      void palette;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) opaque.add(`${x * scale + dx},${y * scale + dy}`);
    }
  }
  return opaque;
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe('every node kind has its own silhouette and colour token (test 3)', () => {
  it('reads six kinds off the code', () => {
    expect([...NODE_KINDS].sort()).toEqual(['event', 'gym', 'rest', 'shop', 'trainer', 'wild']);
  });

  it('gives every kind a silhouette in the manifest, and no two the same shape', () => {
    const shapes = new Map<string, Set<string>>();
    for (const kind of NODE_KINDS) {
      const asset = MANIFEST.get(`silhouette:${kind}`);
      expect(asset?.kind, kind).toBe('file');
      if (asset?.kind !== 'file') continue;
      shapes.set(kind, silhouetteOf(asset.file));
    }
    // A silhouette is read by its outline, so two shapes are the same when
    // their edge pixels (opaque, beside a clear one) mostly coincide:
    // intersection over union. Filled areas would call any two blobs alike.
    const outline = (shape: Set<string>): Set<string> =>
      new Set(
        [...shape].filter((pixel) => {
          const [x, y] = pixel.split(',').map(Number) as [number, number];
          return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !shape.has(`${x + dx!},${y + dy!}`));
        }),
      );
    for (const a of NODE_KINDS) {
      for (const b of NODE_KINDS) {
        if (a >= b) continue;
        const [x, y] = [outline(shapes.get(a)!), outline(shapes.get(b)!)];
        const both = [...x].filter((pixel) => y.has(pixel)).length;
        const either = new Set([...x, ...y]).size;
        expect(both / either, `${a} against ${b}`).toBeLessThan(0.5);
      }
    }
  });

  it('gives every kind its own colour token, none of them a type hue', () => {
    const value = (name: string): string | undefined => new RegExp(`--${name}:\\s*([^;]+);`).exec(TOKENS)?.[1]?.trim().toLowerCase();
    const types = new Set([...TOKENS.matchAll(/--type-[a-z]+:\s*([^;]+);/g)].map((match) => match[1]!.trim().toLowerCase()));
    const seen = new Map<string, string>();
    for (const kind of NODE_KINDS) {
      const colour = value(`kind-${kind}`);
      expect(colour, kind).toMatch(/^#[0-9a-f]{6}$/);
      expect(types.has(colour!), `${kind} is a type hue`).toBe(false);
      expect(seen.get(colour!), `${kind} shares ${seen.get(colour!)}'s token`).toBeUndefined();
      seen.set(colour!, kind);
      // And the map reads it: the kind's node takes its token as `--kind`.
      expect(STYLES, kind).toContain(`.map-graph .node--${kind} { --kind: var(--kind-${kind}); }`);
    }
  });
});

describe('the map has three weights (test 2, structurally)', () => {
  it('draws every node as its kind silhouette, and no disc, step number or entrance mark', () => {
    const root = drawn(openingState(SEED), () => {});
    for (const node of root.querySelectorAll<HTMLElement>('.node')) {
      const kind = [...node.classList].find((name) => /^node--(wild|trainer|rest|gym|shop|event)$/.test(name))!.slice('node--'.length);
      const mark = node.querySelector('.node__kind');
      // A trainer may wear its sprite (D107); every other mark is the silhouette.
      if (mark?.classList.contains('node__kind--challenger')) continue;
      expect(mark?.querySelector(`[data-asset="silhouette:${kind}"]`), kind).not.toBeNull();
    }
    expect(root.querySelector('.step__marker')).toBeNull();
    expect(root.querySelector('.map-graph__entrance')?.childElementCount).toBe(0);
  });

  it('makes the step being chosen from the only controls on the graph', () => {
    const root = drawn(deepMapState(SEED), () => {});
    const buttons = [...root.querySelectorAll('button, a, [tabindex]')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button.classList.contains('node--current'), button.className).toBe(true);
  });

  it('marks where the player stands, once, on the node last walked to', () => {
    const root = drawn(deepMapState(SEED), () => {});
    const here = root.querySelectorAll('.node--here');
    expect(here).toHaveLength(1);
    expect(here[0]!.classList.contains('node--done')).toBe(true);
    expect(here[0]!.closest('.step')?.querySelector('.map-graph__player')).not.toBeNull();
  });

  it('wears the challenger beside their name on the boss, the badge in the slot', () => {
    const root = drawn(openingState(SEED), () => {});
    const gym = root.querySelector('.node--gym')!;
    expect(gym.querySelector('[data-asset="silhouette:gym"]')).not.toBeNull();
    const name = gym.querySelector('.node__name');
    expect(name?.querySelector('.sprite--opponent') ?? null).not.toBeNull();
  });

  it('pushes the painting back by the display number, under a flat scrim', () => {
    const root = drawn(openingState(SEED));
    expect(root.style.getPropertyValue('--map-scrim')).toBe(String(DEFAULT_DISPLAY_TUNING.mapScrimOpacity));
    expect(STYLES).toMatch(/\.map-graph::after \{[^}]*opacity: var\(--map-scrim/);
    expect(STYLES).not.toMatch(/backdrop-filter:\s*blur/);
  });
});
