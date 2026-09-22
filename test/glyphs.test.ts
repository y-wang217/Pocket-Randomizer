/**
 * The glyph sheet's roster and its 16px separation. **Milestone M1.1.**
 *
 * The sheet itself is `src/ui/theme/glyphs.ts`; the instrument that renders and
 * measures it is `scripts/visual/glyph-sheet.ts`.
 *
 * ## Why this reads a committed file instead of running the instrument
 *
 * Measuring means building the app, launching a browser and rasterising 42
 * marks four ways — about a minute. The numbers do not change unless a glyph
 * does, so they are measured deliberately, committed to
 * `docs/visual/m1.1-glyph-separation.json`, and held here.
 *
 * The roster in that file is checked against the sheet, so **a glyph added or
 * redrawn without re-measuring fails this test** rather than silently inheriting
 * someone else's number. Re-measure with:
 *
 *   npx vite-node scripts/visual/glyph-sheet.ts --write
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { BAND_PIPS } from '../src/data/bandInfo';
import { TYPE_ICON_NAMES } from '../src/ui/theme/typeIcons';
import {
  GLYPHS,
  GLYPH_BAND_PIPS,
  GLYPH_FAMILIES,
  GLYPH_SIZES,
  GLYPH_VIEWBOX,
  glyphsOf,
  type GlyphFamily,
} from '../src/ui/theme/glyphs';

const SEPARATION = join(process.cwd(), 'docs/visual/m1.1-glyph-separation.json');

interface SeparationFile {
  floor: number;
  worst: { family: string; a: string; b: string; simulation: string; score: number }[];
  all: { family: string; a: string; b: string; simulation: string; score: number }[];
}

function separation(): SeparationFile {
  return JSON.parse(readFileSync(SEPARATION, 'utf8')) as SeparationFile;
}

describe('the glyph sheet', () => {
  it('has a name and a family for every glyph, and no duplicate id', () => {
    for (const glyph of GLYPHS) {
      expect(glyph.id, JSON.stringify(glyph)).toMatch(/\S/);
      expect(glyph.label, glyph.id).toMatch(/\S/);
      expect(GLYPH_FAMILIES, glyph.id).toContain(glyph.family);
    }
    const ids = GLYPHS.map((glyph) => glyph.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('draws something for every glyph', () => {
    for (const glyph of GLYPHS) {
      if (glyph.art.kind === 'markup') expect(glyph.art.markup, glyph.id).toMatch(/^<(path|circle|rect|g)\b/);
      else expect(glyph.art.text, glyph.id).toMatch(/^[A-Z]{3}$/);
    }
  });

  /*
   * **Ten since 2026-09-22, and the count is still the point.** D37 added
   * `capability`, which section 3's map-node row had specified since Rev 1
   * while section 2's roster never carried it — a table corrected to agree
   * with a rule, not a new claim. The assertion is unchanged in force: an
   * eleventh family fails here, which is what makes section 10.3's
   * stop-and-file a gate rather than a hope.
   */
  it('fills all ten families of section 2, and no eleventh', () => {
    expect(GLYPH_FAMILIES).toHaveLength(10);
    for (const family of GLYPH_FAMILIES) expect(glyphsOf(family), family).not.toHaveLength(0);
    const drawn = new Set(GLYPHS.map((glyph) => glyph.family));
    expect([...drawn].sort()).toEqual([...GLYPH_FAMILIES].sort());
  });

  it('references the eighteen type glyphs rather than restating them', () => {
    // Two tables of eighteen paths would disagree within a month.
    expect(glyphsOf('type').map((glyph) => glyph.label)).toEqual([...TYPE_ICON_NAMES]);
  });

  it('carries the rosters section 2 names', () => {
    expect(glyphsOf('category').map((glyph) => glyph.label)).toEqual(['Physical', 'Special', 'Status']);
    expect(glyphsOf('status').map((glyph) => glyph.art.kind === 'text' && glyph.art.text)).toEqual([
      'BRN',
      'PAR',
      'PSN',
      'TOX',
      'SLP',
      'FRZ',
    ]);
    expect(glyphsOf('stat')).toHaveLength(6);
  });

  it('wears the fist and the ring on the Atk and SpA stat rows', () => {
    // Section 2, category row: "Same glyph on the Atk and SpA stat rows."
    const same = (a: string, b: string): boolean => {
      const first = GLYPHS.find((glyph) => glyph.id === a)?.art;
      const second = GLYPHS.find((glyph) => glyph.id === b)?.art;
      return JSON.stringify(first) === JSON.stringify(second);
    };
    expect(same('stat-atk', 'category-physical')).toBe(true);
    expect(same('stat-spa', 'category-special')).toBe(true);
  });

  it('reads the band pip count from bandInfo rather than hardcoding it', () => {
    expect(GLYPH_BAND_PIPS).toBe(BAND_PIPS);
  });

  it('renders at the two sizes the milestone requires', () => {
    expect([...GLYPH_SIZES]).toEqual([24, 16]);
    expect(GLYPH_VIEWBOX).toBe('0 0 24 24');
  });

  /**
   * **This assertion changed shape at M2.1, and did not weaken.**
   *
   * M1.1 said *"Do not mount any glyph on any screen yet"*, and this walked
   * `src/ui/` asserting the sheet had no importers at all. M2.1 is the item
   * that mounts the first ones, so "nobody imports it" is no longer the thing
   * worth holding — but the reason behind it is. A glyph each screen drew for
   * itself would render at a different size on a battle button than on a
   * reward card, which is precisely the defect R1 and section 5 exist to
   * prevent.
   *
   * So the rule is now **one renderer**: `theme/glyph.ts` is the only module in
   * the rendering tree that reads the sheet, and every mark in the game comes
   * out of its `glyphNode`. A screen that reached for `GLYPHS` directly to draw
   * its own would fail here, which is the same protection stated against the
   * thing that actually goes wrong.
   */
  it('is read by exactly one renderer, so every mark comes out of one place', async () => {
    const { readdirSync } = await import('node:fs');
    const roots = ['src/ui', 'src/ui/screens', 'src/ui/theme'];
    const importers: string[] = [];
    for (const root of roots) {
      for (const entry of readdirSync(join(process.cwd(), root))) {
        if (!entry.endsWith('.ts') || entry === 'glyphs.ts') continue;
        const source = readFileSync(join(process.cwd(), root, entry), 'utf8');
        if (/from '\.{1,2}\/(theme\/)?glyphs'/.test(source)) importers.push(`${root}/${entry}`);
      }
    }
    expect(importers).toEqual(['src/ui/theme/glyph.ts']);
  });
});

describe('the 16px separation', () => {
  it('has been measured', () => {
    expect(existsSync(SEPARATION), 'run: npx vite-node scripts/visual/glyph-sheet.ts --write').toBe(true);
  });

  it('was measured against this sheet, not an older one', () => {
    const measured = new Set(separation().all.flatMap((row) => [row.a, row.b]));
    // A family of one has no pair and so appears nowhere in the table.
    const pairable = GLYPH_FAMILIES.filter((family) => glyphsOf(family).length > 1) as GlyphFamily[];
    for (const family of pairable) {
      for (const glyph of glyphsOf(family)) expect(measured, `${glyph.id} unmeasured; re-run the sheet`).toContain(glyph.id);
    }
  });

  it('clears the floor in every family under every simulation', () => {
    const { floor, worst } = separation();
    const under = worst.filter((row) => row.score < floor);
    // M1.1's kills-it condition, as a list rather than a count: a failure
    // should name the pair to redraw.
    expect(under.map((row) => `${row.family}: ${row.a} vs ${row.b} = ${row.score} (${row.simulation})`)).toEqual([]);
  });

  it('is unmoved by simulation, because no mark carries colour', () => {
    // Every glyph is monochrome `currentColor`, so the three simulations
    // cannot change a shape score. The families that do carry colour — type
    // and status — are judged from the four pictures, not from this number.
    const { all } = separation();
    const byPair = new Map<string, number[]>();
    for (const row of all) {
      const key = `${row.a}|${row.b}`;
      byPair.set(key, [...(byPair.get(key) ?? []), row.score]);
    }
    for (const [pair, scores] of byPair) {
      expect(new Set(scores).size, `${pair} moved under simulation`).toBe(1);
    }
  });
});

describe('the colour-blindness sheets', () => {
  it('are committed where the milestone says', () => {
    for (const simulation of ['none', 'protanopia', 'deuteranopia', 'tritanopia']) {
      expect(existsSync(join(process.cwd(), `docs/visual/m1.1-glyphs-${simulation}.png`)), simulation).toBe(true);
    }
  });
});
