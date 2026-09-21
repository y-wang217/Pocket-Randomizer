/**
 * The eighteen type glyphs. **Chip-audit patch item 3, narrowed at M2.1.**
 *
 * Two claims that comments in `ui/theme/typeIcons.ts` make and cannot enforce:
 * that every type the game can put on a move has a glyph, and that no glyph
 * escapes its box.
 *
 * **It used to test a third, and the feature is gone.** The move-card type
 * *watermark* — a large faint silhouette behind a battle button — was deleted
 * by M2.1 as a live R3 violation: the button carried the type as a mark and as
 * a word at once, and once the chip's glyph became the type's one channel the
 * watermark was the same mark twice. The opacity-ceiling case and the
 * one-call-site case went with the feature rather than being adapted to
 * something they were not about. The table they were drawn from is still here
 * and is now the source of the sheet's eighteen type glyphs
 * (`ui/theme/glyphs.ts`), so it is tested harder than before, not less.
 *
 * **What this file deliberately does not test is whether the glyphs are any
 * good.** Legibility is a thing a person looks at, and the contact sheet that
 * was actually looked at is recorded in the patch report. A test that claimed
 * to check it would be a comment with an `expect` around it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { TYPE_ICON_NAMES, TYPE_ICON_VIEWBOX, typeIconPath } from '../src/ui/theme/typeIcons';

const ROOT = join(__dirname, '..');

/**
 * Every type the app has a colour token for.
 *
 * Read out of `tokens.css` rather than listed here, because that file is what
 * the type chips colour themselves from — so this is the same roster the chip
 * beside the watermark uses, and a nineteenth type added there fails here
 * rather than silently drawing nothing.
 */
function typesWithTokens(): string[] {
  const css = readFileSync(join(ROOT, 'src/ui/theme/tokens.css'), 'utf8');
  return [...css.matchAll(/--type-([a-z]+):/g)].map((match) => match[1] ?? '');
}

describe('type icons', () => {
  it('draws every type the stylesheet has a colour for', () => {
    const missing = typesWithTokens().filter((type) => typeIconPath(type) === null);
    expect(missing).toEqual([]);
  });

  it('is case insensitive, because the dex spells a type "Fire"', () => {
    expect(typeIconPath('Fire')).toBe(typeIconPath('fire'));
    expect(typeIconPath('GHOST')).toBe(typeIconPath('ghost'));
  });

  /*
   * A type with no glyph draws nothing rather than a fallback mark. `'???'` is
   * the real case — the dex carries it — and the rule is in `typeIconPath`'s
   * own comment: a watermark is redundant information, so an unknown type
   * should add nothing rather than add a shape a player would try to learn.
   */
  it('returns null for a type it does not know', () => {
    expect(typeIconPath('???')).toBeNull();
    expect(typeIconPath('Cosmic')).toBeNull();
  });

  it('draws every glyph in one box', () => {
    expect(TYPE_ICON_VIEWBOX).toBe('0 0 24 24');
  });

  /*
   * **There is no bounds assertion here, and the first draft of this file had
   * one that did not work.**
   *
   * It read every number out of the path data and asserted each was inside the
   * 24-unit box. That is not what those numbers are: a lowercase path command
   * takes *relative* deltas, and an elliptical arc takes two radii and three
   * flags before its endpoint. The Normal ring's `-7.4` is a legal relative
   * step and the test called it an escape.
   *
   * A real bounds check needs a path parser or a browser's `getBBox`, and the
   * browser is where it would belong — but the thing that actually matters
   * about these glyphs is whether a person can tell them apart, which no
   * bounds check speaks to either. Both were done by rendering all nineteen and
   * looking: the contact sheet is in the patch report, and it is what caught
   * the Bug glyph rendering as a hairline outline and the Dragon glyph reading
   * as a rocket. Recorded rather than replaced with an assertion that passes
   * for the wrong reason.
   */

  it('builds every glyph as markup the renderer can hand to one <svg>', () => {
    for (const type of TYPE_ICON_NAMES) {
      const markup = typeIconPath(type) ?? '';
      expect(markup.startsWith('<path'), `${type} must be paths only`).toBe(true);
      expect(markup.endsWith('/>'), `${type} must be self-closing`).toBe(true);
      // No colour of its own: the span's `type--<name>` class sets `--chip` and
      // the svg inherits through `currentColor`. A `fill="#…"` here would be a
      // second colour table.
      expect(/fill="(?!none)[^"]*#/.test(markup), `${type} must not carry its own colour`).toBe(false);
    }
  });

});
