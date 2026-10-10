/**
 * Two standing guards from the 5.0 plan. **Stage 5.0/1**, test 5 of
 * `docs/spec/gymrun-stage5.0-visual-redesign.md`: *"No `<canvas>` in the app
 * and no new runtime dependency, asserted."*
 *
 * The plan's rule is *"No engine, no canvas, no framework. Vanilla TS, DOM,
 * CSS, and SVG for map edges only."* A canvas would put pixels where the
 * inspect layer, the tests and a screen reader cannot reach them, and a
 * dependency is a decision the plan says to stop and report rather than take.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** The runtime dependencies at the start of 5.0. A new one is a stop-and-report. */
const RUNTIME_DEPENDENCIES = ['@pkmn/img', '@pkmn/protocol', '@pkmn/sim', '@pkmn/view', '@smogon/calc'];

describe('the 5.0 guards', () => {
  it('draws no canvas anywhere in the app', () => {
    const sources = [...filesUnder(join(process.cwd(), 'src')), join(process.cwd(), 'index.html'), join(process.cwd(), 'gymrun.html')].filter((path) => /\.(ts|html|css)$/.test(path));
    expect(sources.length).toBeGreaterThan(50);
    for (const path of sources) {
      const text = readFileSync(path, 'utf8');
      expect(text, path).not.toMatch(/<canvas\b|createElement\(\s*['"]canvas['"]|OffscreenCanvas|getContext\(\s*['"]2d/);
    }
  });

  it('adds no runtime dependency', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(RUNTIME_DEPENDENCIES);
  });
});
