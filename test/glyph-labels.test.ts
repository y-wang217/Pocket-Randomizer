/**
 * The exposure-label copy. **Milestone M6.1.**
 *
 * The item: *"copy in `data/glyphLabels.ts`, each label under three words."*
 * Read as at most three, the way section 4's budgets are ceilings (D1).
 */
import { describe, expect, it } from 'vitest';

import { FORBIDDEN_WORDS } from '../src/data/forbiddenWords';
import { FAMILY_LABELS, GLYPH_LABELS } from '../src/data/glyphLabels';
import { GLYPHS } from '../src/ui/theme/glyphs';

const words = (text: string): string[] => text.split(/\s+/).filter(Boolean);
const ALL = [...Object.values(GLYPH_LABELS), ...Object.values(FAMILY_LABELS)];

describe('glyphLabels', () => {
  it('has a word for every glyph in the sheet but the types, which are named by the dex', () => {
    const missing = GLYPHS.filter((glyph) => glyph.family !== 'type' && !GLYPH_LABELS[glyph.id]).map((glyph) => glyph.id);
    expect(missing).toEqual([]);
  });

  it('carries no entry for a glyph the sheet does not draw', () => {
    const ids = new Set(GLYPHS.map((glyph) => glyph.id));
    expect(Object.keys(GLYPH_LABELS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('keeps every label to three words or fewer', () => {
    expect(ALL.filter((label) => words(label).length > 3)).toEqual([]);
  });

  it('is the sheet\'s accessible name too, so the two cannot drift', () => {
    for (const glyph of GLYPHS) if (glyph.family !== 'type') expect(glyph.label, glyph.id).toBe(GLYPH_LABELS[glyph.id]);
  });

  it('uses no hedge word', () => {
    const forbidden = new Set([...FORBIDDEN_WORDS].map((word) => word.toLowerCase()));
    expect(ALL.flatMap(words).filter((word) => forbidden.has(word.toLowerCase()))).toEqual([]);
  });
});
