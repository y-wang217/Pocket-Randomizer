/**
 * The battle screen at rest, and the two ways into the sheet. **Milestone
 * M4.3**, rows D24, D25, D26 and D28.
 *
 * @vitest-environment jsdom
 *
 * R11: *"The battle log lives in the log sheet, reachable by a pull, kept for
 * bug reports and determinism. The battle screen shows the turn header, the
 * panels, the flags and nothing written."*
 *
 * ## What the census cannot say, and this does
 *
 * `docs/design/text-census.md` is the item's done-when and it reads the battle
 * screen at **7 in Pocket less shell** — four for the header D28 budgets and
 * three for two flag words. That is the measurement, and it is a measurement of
 * one fixture on one turn. What it cannot show is *why* each number is what it
 * is: that the event line spends no word on any action, that the handle has no
 * text node rather than a hidden one, and that a turn with more to say than the
 * fixture's still costs the screen nothing outside the strip.
 *
 * So the census holds the number and this holds the rules behind it.
 */
import { describe, expect, it } from 'vitest';

import { readFlags, type FlagDeps } from '../src/core/battle/flags';
import { DEFAULT_DISPLAY_TUNING } from '../src/data/displayTuning';
import { createFlagStrip } from '../src/ui/flag-strip';
import { createLogSheet, onPullUp } from '../src/ui/log-sheet';

const DEPS: FlagDeps = { priorityOf: () => 0 };

const OPEN = [
  '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
  '|switch|p2a: Golem|Golem, L50, F|155/155',
  '|turn|1',
];

/**
 * A pointer gesture, as far down as jsdom goes.
 *
 * jsdom has no `PointerEvent`, so these are `MouseEvent`s under pointer names —
 * which is exactly what the handler reads: a `clientY` and a pointer id that is
 * `undefined` on both ends and therefore matches itself. The gesture's real
 * behaviour on a phone is the browser suite's business; what is asserted here
 * is the threshold and the two routes.
 */
function drag(target: HTMLElement, from: number, to: number): void {
  target.dispatchEvent(new MouseEvent('pointerdown', { clientY: from, bubbles: true }));
  target.dispatchEvent(new MouseEvent('pointermove', { clientY: to, bubbles: true }));
  target.dispatchEvent(new MouseEvent('pointerup', { clientY: to, bubbles: true }));
}

describe('the strip at rest', () => {
  it('writes no word for what an action was', () => {
    /*
     * D25. `Opposing Snorlax used Body Slam` was two words — the side, which
     * `data-side` already drew, and the verb, which the separator carries. The
     * names are proper nouns and free under section 4's counting rule.
     */
    const strip = createFlagStrip();
    strip.show(
      readFlags([...OPEN, '|move|p2a: Golem|Rock Slide|p1a: Snorlax', '|-damage|p1a: Snorlax|100/235', '|upkeep'], DEPS),
    );

    const line = strip.root.querySelector('.flags__event') as HTMLElement;
    expect(line.textContent).toBe('Golem · Rock Slide');
    // And the side, in the one channel that carries it now.
    expect(line.dataset['side']).toBe('p2');
  });

  it('puts no text node on the handle at all', () => {
    /*
     * D26. `History` was a word at rest on a screen budgeted at zero outside
     * the flags and the header, and section 4's carve-out is "the one flag R9
     * allows" — a control label is not that. The accessible name stays, because
     * it is not rendered and the census counts what is.
     */
    const strip = createFlagStrip();
    expect(strip.history.textContent).toBe('');
    expect(strip.history.getAttribute('aria-label')).toBe('Battle history');
    // Drawn rather than lettered: the grip is an element the stylesheet fills,
    // so there is no string here for a census or a translation to find.
    expect(strip.history.querySelector('.flags__grip')).not.toBeNull();
  });

  it('says nothing at all on a turn that produced nothing', () => {
    const strip = createFlagStrip();
    strip.clear();
    expect(strip.root.textContent).toBe('');
    // The band still holds its height — that is the stylesheet's `min-height`
    // and Release C's rule — and `data-empty` still says which turn this was.
    expect(strip.root.dataset['empty']).toBe('true');
  });

  it('spends nothing more on a turn with more to say than the fixture’s', () => {
    /*
     * The census measures one turn. This is the loudest turn the mapper can
     * produce — two sides, two hit outcomes, two conditions, an ability — and
     * the strip still draws one flag per side per channel, so the screen's
     * word count is bounded by the rule rather than by the fixture.
     */
    const strip = createFlagStrip();
    strip.show(
      readFlags(
        [
          ...OPEN,
          '|move|p1a: Snorlax|Body Slam|p2a: Golem',
          '|-supereffective|p2a: Golem',
          '|-crit|p2a: Golem',
          '|-damage|p2a: Golem|40/155',
          '|-status|p2a: Golem|par',
          '|-ability|p2a: Golem|Sturdy',
          '|-start|p2a: Golem|confusion',
          '|move|p2a: Golem|Rock Slide|p1a: Snorlax',
          '|-crit|p1a: Snorlax',
          '|-damage|p1a: Snorlax|180/235',
          '|-start|p1a: Snorlax|confusion',
          '|upkeep',
        ],
        DEPS,
      ),
    );
    expect(strip.root.querySelectorAll('.chip--flag')).toHaveLength(4);
  });
});

describe('the sheet, by pull and by tap', () => {
  it('opens on a pull up past the threshold', () => {
    const sheet = createLogSheet();
    const handle = createFlagStrip().history;
    onPullUp(handle, () => sheet.open(handle));

    expect(sheet.isOpen()).toBe(false);
    drag(handle, 400, 400 - DEFAULT_DISPLAY_TUNING.logPullPx - 1);
    expect(sheet.isOpen()).toBe(true);
  });

  it('does not open on a pull short of it, which is what leaves the tap alone', () => {
    const sheet = createLogSheet();
    const handle = createFlagStrip().history;
    onPullUp(handle, () => sheet.open(handle));

    // One pixel short. A pointer that never travels the threshold is a tap, and
    // the click handler is the route that was always there.
    drag(handle, 400, 400 - DEFAULT_DISPLAY_TUNING.logPullPx + 1);
    expect(sheet.isOpen()).toBe(false);
  });

  it('does not open on a pull downward, away from where the sheet comes from', () => {
    const sheet = createLogSheet();
    const handle = createFlagStrip().history;
    onPullUp(handle, () => sheet.open(handle));

    drag(handle, 400, 400 + DEFAULT_DISPLAY_TUNING.logPullPx + 40);
    expect(sheet.isOpen()).toBe(false);
  });

  it('detaches, because a battle screen outlives one battle', () => {
    const sheet = createLogSheet();
    const handle = createFlagStrip().history;
    const detach = onPullUp(handle, () => sheet.open(handle));

    detach();
    drag(handle, 400, 200);
    expect(sheet.isOpen()).toBe(false);
  });

  it('never opens on its own, however loud the turn', () => {
    /*
     * The sheet's own rule, restated where the new gesture could break it: a
     * panel that appeared over the move grid because something happened would
     * cover the decision on the turn it most mattered. `show` is a render, not
     * an open.
     */
    const sheet = createLogSheet();
    const strip = createFlagStrip();
    onPullUp(strip.history, () => sheet.open(strip.history));

    strip.show(readFlags([...OPEN, '|cant|p1a: Snorlax|flinch', '|upkeep'], DEPS));
    expect(sheet.isOpen()).toBe(false);
  });
});
