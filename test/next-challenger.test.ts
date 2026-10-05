/**
 * The next challenger, and how far off they are. **Stage 6.0 checkpoint 7, D102.**
 *
 * @vitest-environment jsdom
 *
 * One bar in place of the eight-badge rail: full before the route is picked,
 * emptying as the steps are walked, empty at the boss, with the challenger's
 * class and name and their sprite over it. Mounted on the map, the map
 * drawer, Run Info, the sidebar and the locale screen by one function, so
 * every mount reads the same facts. The boss node and the battle title wear
 * the challenger's own sprite where the badge mark stood, and the glyph
 * sheet's node family has no badge.
 */
import { describe, expect, it } from 'vitest';

import { createRun, type RunState } from '../src/core/run';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { challengerMark } from '../src/ui/chip';
import { nextChallengerOf, renderNextChallenger } from '../src/ui/next-challenger';
import { createSidebar } from '../src/ui/sidebar';
import { glyphNode } from '../src/ui/theme/glyph';

const run = createRun('NEXT-CHALLENGER', DEFAULT_TUNING);
const segment = run.segments[0]!;
const opponent = segment.gym.encounter!.opponent;

/** A state walking the first segment's first offered route, `position` steps in. */
function walking(position: number): RunState {
  return { ...run, currentSegment: 0, position, localeChoices: [0] } as RunState;
}

describe('the bar', () => {
  it('is full before the route exists, shrinks as the steps are walked, and is empty at the boss', () => {
    const before = nextChallengerOf(run);
    expect(before.total).toBe(0);
    const fullBar = renderNextChallenger(before).querySelector<HTMLElement>('.next-challenger__fill')!;
    expect(fullBar.style.width).toBe('100%');

    const start = nextChallengerOf(walking(0));
    expect(start.total).toBeGreaterThan(0);
    expect(start.remaining).toBe(start.total);
    const widths = Array.from({ length: start.total + 1 }, (_, position) => {
      const view = nextChallengerOf(walking(position));
      expect(view.remaining).toBe(start.total - position);
      return Number.parseInt(renderNextChallenger(view).querySelector<HTMLElement>('.next-challenger__fill')!.style.width, 10);
    });
    for (let i = 1; i < widths.length; i++) expect(widths[i]!).toBeLessThan(widths[i - 1]!);
    expect(widths[widths.length - 1]).toBe(0);
    const bar = renderNextChallenger(nextChallengerOf(walking(start.total))).querySelector('.next-challenger__bar')!;
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe(String(start.total));
  });

  it('names the challenger by class and name with their sprite, and nothing typed', () => {
    const root = renderNextChallenger(nextChallengerOf(run));
    expect(root.querySelector('.next-challenger__label')?.textContent).toBe('Next challenger');
    const who = root.querySelector<HTMLElement>('.next-challenger__who')!;
    expect(who.textContent).toBe(opponent);
    const sprite = segment.gym.encounter!.source!.sprite;
    if (sprite) expect(who.querySelector<HTMLImageElement>('img.sprite--opponent')?.src).toMatch(new RegExp(`/${sprite}\\.png$`));
    else expect(who.querySelector('img')).toBeNull();
    expect(root.querySelector('.type')).toBeNull();
  });

  it('is what the sidebar mounts in the pips’ place', () => {
    const sidebar = createSidebar();
    document.body.replaceChildren(sidebar.root);
    sidebar.update(run, []);
    expect(sidebar.root.querySelector('.sidebar__pip')).toBeNull();
    expect(sidebar.root.querySelector('.next-challenger__who')?.textContent).toBe(opponent);
  });
});

describe('the badge mark', () => {
  it('is gone from the glyph sheet, and the boss wears the challenger’s sprite or the trainer mark', () => {
    expect(glyphNode('node-gym', { label: 'Challenger', size: 16 })).toBeNull();
    const withSprite = challengerMark({ ...segment.gymEncounter, sprite: 'blue-gen1' }, 'Challenger', 24);
    const img = withSprite.querySelector<HTMLImageElement>('img.sprite--opponent')!;
    expect(img).not.toBeNull();
    expect(img.width).toBe(24);
    expect(withSprite.getAttribute('aria-label')).toBe('Challenger');
    const without = challengerMark({ ...segment.gymEncounter, sprite: null }, 'Challenger', 16);
    expect(without.querySelector('img')).toBeNull();
    expect(without.querySelector('svg, .glyph')).not.toBeNull();
  });
});
