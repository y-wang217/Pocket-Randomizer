/**
 * One inspect layer, on every row section 3 gives one. **Milestone M1.2.**
 *
 * @vitest-environment jsdom
 *
 * Design bible R5: *"Long press on any card, chip, glyph, badge or pip opens
 * its full explanation. Release closes. Tap still selects. There is exactly one
 * mechanism."*
 *
 * Discrepancy D4 ruled what "every" means here: **the acceptance test
 * enumerates every row of section 3's inspect column except archetype**, which
 * the encoding table itself excludes ("not on inspect either; it is a derived
 * label and can lie under randomization"). Eighteen rows, listed below against
 * the `data-tip` kind that answers each.
 *
 * The item's own kills-it is the third block: any accidental submission during
 * inspect sends the gesture to two-finger tap. That is a playtest observation
 * and cannot be asserted here, but its mechanism can, and is.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_DISPLAY_TUNING } from '../src/data/displayTuning';
import { createTooltips } from '../src/ui/tooltips';

/** Hold a trigger until inspect opens, with a hold of zero. */
async function longPress(element: HTMLElement): Promise<void> {
  element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Release, which is what closes a held panel. */
function release(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
}

/**
 * A layer with a hold of zero, so a press resolves on the next macrotask
 * instead of making the suite wait out a real 450ms.
 *
 * The two jank cases pass a real threshold instead, because they are *about*
 * the threshold: with a hold of zero every click is a held one by definition,
 * and the discrimination under test would be vacuous.
 */
function mount(holdMs = 0): { host: HTMLElement; layer: ReturnType<typeof createTooltips>; done: () => void } {
  const host = document.createElement('div');
  document.body.append(host);
  const layer = createTooltips(host, { ...DEFAULT_DISPLAY_TUNING, inspectHoldMs: holdMs });
  return {
    host,
    layer,
    done: () => {
      layer.destroy();
      host.remove();
    },
  };
}

function trigger(host: HTMLElement, tip: string, data: Record<string, string> = {}): HTMLElement {
  const node = document.createElement('span');
  node.dataset['tip'] = tip;
  for (const [key, value] of Object.entries(data)) node.dataset[key] = value;
  host.append(node);
  return node;
}

/**
 * Section 3's inspect column, row by row, against the kind that answers it.
 *
 * Archetype is absent by section 3's own instruction and by D4's ruling. Every
 * other row is here, and a row whose kind renders nothing fails.
 */
const SECTION_3_ROWS: { row: string; tip: string; data?: Record<string, string> }[] = [
  { row: 'Type', tip: 'type:Fire' },
  { row: 'Category', tip: 'category:physical' },
  { row: 'Base power', tip: 'power:Flamethrower' },
  { row: 'PP', tip: 'pp:counter', data: { value: '12/24' } },
  { row: 'Band', tip: 'band:3' },
  { row: 'Accuracy', tip: 'movefact:accuracy' },
  { row: 'Priority', tip: 'movefact:priority' },
  { row: 'Effectiveness (forecast)', tip: 'type:Water' },
  { row: 'Effectiveness (feedback)', tip: 'flag:crit' },
  { row: 'Status', tip: 'status:brn' },
  { row: 'Stat stages', tip: 'stages:active', data: { detail: 'Atk\t2.0x\t+2' } },
  { row: 'Six stats', tip: 'stat:atk' },
  { row: 'Held item', tip: 'item:leftovers' },
  { row: 'Berry', tip: 'item:sitrusberry' },
  { row: 'Relic', tip: 'relic:rusted-machete' },
  { row: 'Coverage change', tip: 'coverage:capture', data: { detail: '+Dragon\tSteel\n-Ghost' } },
  { row: 'Capability requirement', tip: 'capability:surf' },
  { row: 'Tier (map node)', tip: 'tier:hard' },
];

describe('inspect opens on every row of the encoding table', () => {
  it('covers all eighteen, archetype excepted', async () => {
    const { host, layer, done } = mount();
    const silent: string[] = [];
    for (const { row, tip, data } of SECTION_3_ROWS) {
      const node = trigger(host, tip, data);
      await longPress(node);
      const text = (layer.root.textContent ?? '').trim();
      if (layer.root.hidden || text.length === 0) silent.push(`${row} (${tip})`);
      release(node);
    }
    // Named rather than counted: a failure should say which row opens nothing.
    expect(silent).toEqual([]);
    done();
  });

  it('is one row short of the encoding table, and the short one is archetype', () => {
    // A guard on the list above, so a row added to section 3 and not to this
    // file is noticed. Nineteen rows in the table, archetype excluded by D4.
    expect(SECTION_3_ROWS).toHaveLength(19 - 1);
    expect(SECTION_3_ROWS.some((entry) => entry.row.toLowerCase().includes('archetype'))).toBe(false);
  });
});

describe('the gesture', () => {
  it('opens on a hold and closes on release', async () => {
    const { host, layer, done } = mount();
    const node = trigger(host, 'band:3');

    expect(layer.root.hidden).toBe(true);
    await longPress(node);
    expect(layer.root.hidden).toBe(false);
    release(node);
    // R5: "Release closes."
    expect(layer.root.hidden).toBe(true);
    done();
  });

  it('does not open on a tap', async () => {
    const { host, layer, done } = mount();
    const node = trigger(host, 'band:3');

    // Down and straight back up, with no hold elapsed: R5's "tap still
    // selects", which is only true if the tap does not open anything.
    node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    release(node);
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(layer.root.hidden).toBe(true);
    done();
  });

  it('cancels when the finger travels, because that is a scroll', async () => {
    const { host, layer, done } = mount();
    const node = trigger(host, 'band:3');

    node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }));
    node.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 0, clientY: 40 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(layer.root.hidden).toBe(true);
    done();
  });
});

describe('R5 enforcement: a long press on a move button spends no turn', () => {
  /**
   * The item's kills-it condition, as its mechanism.
   *
   * A long press still emits `click` on release, and on a move button that
   * click is the turn. The layer eats exactly that one click; this is the test
   * that says so, and it is the difference between "inspect on the button" and
   * "a button that sometimes explains itself instead of playing".
   */
  it('opens the panel and lets no click through', async () => {
    const { host, layer, done } = mount();

    const button = document.createElement('button');
    button.dataset['tip'] = 'move:flamethrower';
    let submitted = 0;
    button.addEventListener('click', () => {
      submitted += 1;
    });
    host.append(button);

    await longPress(button);
    expect(layer.root.hidden).toBe(false);
    release(button);
    // The click a long press leaves behind, exactly as a browser emits it.
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(submitted, 'a long press submitted the move').toBe(0);
    done();
  });

  /**
   * The jank case, and it is the one that costs a turn.
   *
   * The hold timer runs on the main thread, so a stall long enough to delay a
   * `pointerup` lets it fire for a press the browser generated milliseconds
   * apart. Eating *that* click would lose the move the player chose, silently,
   * on exactly the frame where they are least likely to forgive it.
   *
   * `timeStamp` is set when the browser makes an event, not when JS receives
   * it, so the press can be measured even though the dispatch was late. Here
   * the timer is allowed to fire and the click still reports a five-millisecond
   * press: it goes through, and the panel that opened is closed again.
   */
  it('lets a fast tap through even when the hold timer beat it to the thread', async () => {
    const { host, layer, done } = mount(50);

    const button = document.createElement('button');
    button.dataset['tip'] = 'move:flamethrower';
    let submitted = 0;
    button.addEventListener('click', () => {
      submitted += 1;
    });
    host.append(button);

    // A press the browser made at t=1000, released at t=1005 — but dispatched
    // so late that the hold fired first.
    const down = new MouseEvent('pointerdown', { bubbles: true });
    Object.defineProperty(down, 'timeStamp', { value: 1000 });
    button.dispatchEvent(down);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(layer.root.hidden, 'the hold should have fired').toBe(false);

    const click = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(click, 'timeStamp', { value: 1005 });
    button.dispatchEvent(click);

    expect(submitted, 'a five-millisecond tap lost the turn').toBe(1);
    expect(layer.root.hidden, 'the panel should have closed behind the tap').toBe(true);
    done();
  });

  it('still eats the click after a real hold', async () => {
    const { host, layer, done } = mount(50);

    const button = document.createElement('button');
    button.dataset['tip'] = 'move:flamethrower';
    let submitted = 0;
    button.addEventListener('click', () => {
      submitted += 1;
    });
    host.append(button);

    const down = new MouseEvent('pointerdown', { bubbles: true });
    Object.defineProperty(down, 'timeStamp', { value: 1000 });
    button.dispatchEvent(down);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(layer.root.hidden).toBe(false);

    // Released two seconds later: a hold by anyone's clock.
    const click = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(click, 'timeStamp', { value: 3000 });
    button.dispatchEvent(click);

    expect(submitted, 'a two-second hold spent the turn').toBe(0);
    done();
  });

  it('lets an ordinary tap through, so the button is still a button', () => {
    const { host, done } = mount();

    const button = document.createElement('button');
    button.dataset['tip'] = 'move:flamethrower';
    let submitted = 0;
    button.addEventListener('click', () => {
      submitted += 1;
    });
    host.append(button);

    button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    release(button);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(submitted, 'a tap on a move button did not choose the move').toBe(1);
    done();
  });
});

describe('a phone tap is not a hover', () => {
  /**
   * **The inspect-on-touch defect, as the sequence a phone actually sends.**
   * `docs/spec/gymrun-patch-inspect-hover-on-touch.md`, 2026-09-22.
   *
   * Every mobile browser follows a touch with a compatibility mouse sequence —
   * `mouseover`, `mousedown`, `mouseup`, `click`, in that order, with the
   * `mouseover` arriving *before* the click. The layer offers hover as a
   * desktop enhancement, and that synthesised `mouseover` walked straight into
   * it: a tap opened inspect, opened it `transient`, and `transient` was the
   * one state a click would not close.
   *
   * The three cases below are the defect end to end. The existing "does not
   * open on a tap" case above is not a duplicate of the first: it sends
   * `pointerdown`, `pointerup` and `click` and no `mouseover`, which is a
   * desktop tap, and it passed throughout.
   */

  /** A tap, with the compatibility mouse events a phone browser adds to it. */
  function touchTap(element: HTMLElement): void {
    const down = new MouseEvent('pointerdown', { bubbles: true });
    Object.defineProperty(down, 'pointerType', { value: 'touch' });
    element.dispatchEvent(down);
    const up = new MouseEvent('pointerup', { bubbles: true });
    Object.defineProperty(up, 'pointerType', { value: 'touch' });
    element.dispatchEvent(up);
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  it('opens nothing, because the mouseover a touch synthesises is not one', () => {
    const { host, layer, done } = mount();
    const node = trigger(host, 'band:3');

    touchTap(node);

    expect(layer.root.hidden, 'a tap opened inspect').toBe(true);
    done();
  });

  it('still chooses the move it tapped', () => {
    const { host, done } = mount();

    const button = document.createElement('button');
    button.dataset['tip'] = 'move:flamethrower';
    let submitted = 0;
    button.addEventListener('click', () => {
      submitted += 1;
    });
    host.append(button);

    touchTap(button);

    expect(submitted, 'the tap that opened no panel also spent no turn').toBe(1);
    done();
  });

  /**
   * The panel the report photographed: open, with its trigger gone.
   *
   * On the battle screen the click that opened it also spends the turn, and
   * the turn re-renders the move bar — so the element whose `mouseout` was the
   * only thing that closed a hover panel is no longer in the document. Nothing
   * could dismiss it, and it covered the board.
   *
   * Asserted through hover rather than touch because touch no longer reaches
   * this state at all. It is the guard on `dropStranded`: a panel whose
   * trigger has left the document is closed at the reader's next press,
   * whatever opened it. A hover panel over a *live* trigger is still exempt
   * from the tap-outside dismissal, because `mouseout` closes that one — and
   * `test/visual-density.test.ts` asserts exactly that on two screens.
   */
  it('closes a hover panel on a click outside, once its trigger is gone', () => {
    const { host, layer, done } = mount();
    const node = trigger(host, 'band:3');

    node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(layer.root.hidden, 'hover should still open on a desktop').toBe(false);

    // The turn resolves and the move bar is rebuilt without this button.
    node.remove();

    host.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(layer.root.hidden, 'the panel outlived every way of closing it').toBe(true);
    done();
  });

  /**
   * A cancelled hold emits no click, so the flag that eats one must be dropped
   * with it. iOS cancels a pointer whenever the page starts scrolling or the
   * system callout takes over a long press.
   *
   * Left armed, `suppressClick` met the player's *next* tap, measured it
   * against the cancelled press's timestamp, found a long gap and ate it. On a
   * move button that is the turn, lost silently.
   */
  it('does not eat the next tap after a hold the system cancelled', async () => {
    const { host, done } = mount(50);

    const button = document.createElement('button');
    button.dataset['tip'] = 'move:flamethrower';
    let submitted = 0;
    button.addEventListener('click', () => {
      submitted += 1;
    });
    host.append(button);

    const down = new MouseEvent('pointerdown', { bubbles: true });
    Object.defineProperty(down, 'timeStamp', { value: 1000 });
    button.dispatchEvent(down);
    await new Promise((resolve) => setTimeout(resolve, 60));

    // The callout takes over: a cancel, and no click behind it.
    button.dispatchEvent(new MouseEvent('pointercancel', { bubbles: true }));

    // A plain tap, two seconds later.
    const click = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(click, 'timeStamp', { value: 3000 });
    button.dispatchEvent(click);

    expect(submitted, 'a cancelled hold ate the next turn').toBe(1);
    done();
  });
});

describe('there is exactly one tooltip mechanism', () => {
  it('and only ui/tooltips.ts builds it', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');

    // Anything else that raised its own floating explanation panel would be
    // the second mechanism R5 forbids. `ui/band.ts` is not one: it is the
    // confirm band, and `docs/design/inventory.md` section 2.2 says so.
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.endsWith('.ts') || full.endsWith(join('ui', 'tooltips.ts'))) continue;
        const source = readFileSync(full, 'utf8');
        if (/function\s+createTooltips\b/.test(source)) offenders.push(full);
      }
    };
    walk(join(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });
});
