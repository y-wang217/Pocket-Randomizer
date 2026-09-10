/**
 * @vitest-environment jsdom
 */
/**
 * The two controls the fold patch added, and the one rule they share.
 *
 * Restoring the fold on a 390x844 phone cost the battle screen two rows: the
 * four-row stat block became one, and the move card's tag row moved onto the PP
 * line with one tag on the face. **Neither cut removes anything from the
 * screen**, and that is the property worth a test — a cut that hid a number
 * would reclaim the same pixels and be a different change entirely.
 *
 * So each control is checked for the way back: the stat block expands, and the
 * folded tags resolve, by name, through the tooltip layer every other badge on
 * the card already uses.
 *
 * The heights themselves are not asserted here. They are measured in a real
 * Chromium by `test/visual-v0.test.ts`, because jsdom has no layout — this file
 * is about what the controls do, not about what they are worth.
 */
import { describe, expect, it } from 'vitest';

import { MOVE_TAG_BY_ID } from '../src/data/moveTags';
import type { MoveTag } from '../src/data/moveTags';
import { createScene, moveTagRow } from '../src/ui/scene';
import { createTooltips } from '../src/ui/tooltips';

const tag = (id: string): MoveTag => ({ id, value: null }) as unknown as MoveTag;

describe('the move card overflow chip', () => {
  it('is absent when the face carries everything it has', () => {
    for (const tags of [[], [tag('stab')]]) {
      const row = moveTagRow(tags);
      expect(row?.querySelector('.badge--tag-more') ?? null).toBeNull();
    }
  });

  it('counts what a narrow face folded, and is not itself a tag', () => {
    const row = moveTagRow([tag('stab'), tag('contact'), tag('priority')]);
    const more = row?.querySelector('.badge--tag-more');

    expect(more?.textContent).toBe('+2');
    // The cap in `scripts/smoke.mjs` counts `.badge--tag`. A chip standing for
    // two tags must not read as a third.
    expect(more?.classList.contains('badge--tag')).toBe(false);
    expect(row?.querySelectorAll('.badge--tag')).toHaveLength(3);
  });

  it('carries every folded tag in one tip, in face order', () => {
    const row = moveTagRow([tag('stab'), tag('contact'), tag('priority')]);
    const more = row?.querySelector<HTMLElement>('.badge--tag-more');
    expect(more?.dataset['tip']).toBe('movetags:contact,priority');
  });

  it('resolves that tip to a panel naming each folded tag', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const layer = createTooltips(host);
    host.append(layer.root);

    const row = moveTagRow([tag('stab'), tag('contact'), tag('priority')]);
    host.append(row as HTMLElement);
    row?.querySelector<HTMLElement>('.badge--tag-more')?.click();

    const text = layer.root.textContent ?? '';
    // The words are `data/moveTags.ts`'s, so the assertion reads them from
    // there rather than restating them here.
    expect(text).toContain(MOVE_TAG_BY_ID['contact']?.long);
    expect(text).toContain(MOVE_TAG_BY_ID['priority']?.long);
    // And the one still on the face is not repeated behind the chip.
    expect(text).not.toContain(MOVE_TAG_BY_ID['stab']?.long);

    layer.destroy();
    host.remove();
  });
});

describe('the stat block toggle', () => {
  it('starts collapsed on both panels, and says so to a screen reader', () => {
    const scene = createScene();
    const blocks = [...scene.root.querySelectorAll<HTMLElement>('.stats')];

    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      expect(block.dataset['expanded']).toBe('false');
      expect(block.querySelector('.stats__toggle')?.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('expands and collapses again, without touching the other panel', () => {
    const scene = createScene();
    const [foe, me] = [...scene.root.querySelectorAll<HTMLElement>('.stats')];
    const toggle = foe?.querySelector<HTMLElement>('.stats__toggle');

    toggle?.click();
    expect(foe?.dataset['expanded']).toBe('true');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    // Each panel answers for itself; the opponent's block is not a mirror of
    // the player's and opening one must not open the other.
    expect(me?.dataset['expanded']).toBe('false');

    toggle?.click();
    expect(foe?.dataset['expanded']).toBe('false');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps all six stats in the block at either state', () => {
    const scene = createScene();
    const block = scene.root.querySelector<HTMLElement>('.stats');

    // Collapsing is a layout change, not a removal: the rows are all present
    // whether the block is open or shut, and the stylesheet decides the shape.
    expect(block?.querySelectorAll('.stat')).toHaveLength(6);
    block?.querySelector<HTMLElement>('.stats__toggle')?.click();
    expect(block?.querySelectorAll('.stat')).toHaveLength(6);
  });
});
