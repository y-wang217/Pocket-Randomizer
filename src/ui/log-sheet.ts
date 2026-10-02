/**
 * The battle log, as a bottom sheet. Stage V5.
 *
 * ## Why the log stopped being a panel
 *
 * It was persistent and multi-line and it cost 320px of a 844px phone, on the
 * one screen the player looks at most. V5's budget takes all of it: the turn's
 * outcome moves to the one-line strip above the board, and the history the log
 * carries moves in here, behind a tap.
 *
 * Nothing is lost. The formatter, the HP state lines and the ordinals are the
 * same `battle-log.ts` they were — this file supplies the container it renders
 * into and the sheet that container sits in, and does not render a line itself.
 *
 * ## It never opens on its own
 *
 * The plan's word, and it is the property that makes the sheet safe rather than
 * merely small: a panel that appeared over the move grid because something
 * happened would cover the decision on the turn it most mattered. `open` is
 * called only by the strip's handle — by a click, or since M4.3 by a pull — and
 * `screens/battle.ts` is the one place either becomes an open.
 *
 * ## Two gestures, one control
 *
 * **M4.3, row D26.** The item asks for the sheet to be *"reachable by pull"*,
 * and it was reachable only by tapping a button that read `History` — a word
 * at rest on a screen budgeted at zero outside the strip's flags and the
 * header. `onPullUp` below is the gesture; the handle it is attached to is
 * drawn as a grab handle and carries no text node at all.
 *
 * The tap survives, and that is deliberate rather than incidental: a pull is
 * not a keyboard gesture, a control that only answered a drag would be
 * unreachable without a pointer, and section 7's objection to a mechanism a
 * player must know exists applies hardest to one that is invisible. The pull
 * is the addition; the click is still the route that was always there.
 *
 * ## The three properties it borrows from the drawer
 *
 * `ui/drawer.ts` states them for the party overlay and `test/party-drawer.test.ts`
 * asserts them per surface: opening never advances run state, never submits a
 * decision, and consumes no RNG. They hold here for a stronger reason than
 * care — this sheet has no access to a decision. It is handed a container and
 * a close button, the screen underneath is untouched, and the strip's control
 * sits outside the move grid so the sharp case (a tap one pixel from spending a
 * turn) does not arise. `test/visual-v5.test.ts` asserts it anyway, because a
 * property nobody checks is a property that lasts until the next layout change.
 *
 * ## `hidden` and `display`
 *
 * `.log-sheet[hidden]` carries its own `display: none`, for the reason the
 * drawer's rule set already records twice: `hidden` is a UA style and any
 * `display` rule beats it, so an overlay toggled with `hidden` and styled with
 * `display: flex` is an invisible scrim eating every tap on the screen below.
 */
import { DEFAULT_DISPLAY_TUNING, type DisplayTuning } from '../data/displayTuning';
import { el } from './dom';
import { createOverlay } from './overlay';

export interface LogSheet {
  /** The overlay. Mounted by the battle screen, hidden until opened. */
  root: HTMLElement;
  /** Where `createBattleLog` renders. Inside the sheet, scrolls with it. */
  panel: HTMLElement;
  /** `opener` is the control that was pressed, so focus can return to it. */
  open(opener?: HTMLElement | null): void;
  close(): void;
  isOpen(): boolean;
}

export function createLogSheet(): LogSheet {
  /*
   * The shell is `ui/overlay.ts` now, and this sheet **gained two behaviours by
   * moving onto it**: Escape closes it, and a click inside it can no longer be
   * read as a click outside it. Both were on the drawer and missing here, for
   * no reason anybody chose — the recipe was copied by hand and two lines were
   * not. That is the drift the shared shell exists to end.
   */
  const overlay = createOverlay({ block: 'log-sheet', label: 'Battle history', title: 'History' });

  // The log's own container, unchanged: `battle-log.ts` appends `.log-entry`
  // children to it and scrolls it, and neither behaviour knows it moved.
  const panel = el('div', 'log');
  overlay.body.append(panel);

  return {
    root: overlay.root,
    panel,
    open(opener) {
      overlay.open(opener);
      // The newest line, which is what a player opening the history is looking
      // for. The log scrolls itself on append, but a container that was hidden
      // while the turn resolved had no height to scroll. **After `open`**, not
      // before it: the panel has no scrollable height until the overlay is
      // shown, so this ordering is the whole of why it works.
      // Instant rather than the panel's smooth `scroll-behavior`: a glide from
      // turn one to turn twenty on every open is motion nobody asked for, and
      // the Pocket gate reads the latest line the moment the sheet opens.
      // jsdom has no `scrollTo` on an element; a browser has, and it is the
      // one that has a smooth `scroll-behavior` to bypass.
      if (typeof panel.scrollTo === 'function') panel.scrollTo({ top: panel.scrollHeight, behavior: 'instant' as ScrollBehavior });
      else panel.scrollTop = panel.scrollHeight;
    },
    close: () => overlay.close(),
    isOpen: () => overlay.isOpen(),
  };
}


/**
 * Open on a pull upward, without taking the tap away. **M4.3, row D26.**
 *
 * ## Why this is not a `touchmove` handler
 *
 * Pointer events, so one implementation covers finger, pen and mouse, and so
 * the browser's own capture keeps delivering moves after the pointer leaves the
 * handle — a pull that travelled off a 24px control and stopped being tracked
 * would be a gesture that works only if you pull slowly and straight.
 *
 * ## Why it does not cancel the click
 *
 * It does not have to. A pointer that never travels `logPullPx` is a tap and
 * the click fires as it always did; one that does travel it opens the sheet
 * here, and the click that follows finds the sheet already open, which `open`
 * treats as a no-op through the overlay. The two routes cannot double-open.
 *
 * `preventDefault` on the move that crosses the threshold, because the default
 * for a vertical drag on a phone is a scroll, and a strip that scrolled the
 * board while opening a sheet over it would be two things happening at once.
 *
 * Returns a detach, for the same reason the screen's other listeners are
 * detachable: a battle screen outlives one battle.
 */
export function onPullUp(
  target: HTMLElement,
  open: () => void,
  tuning: DisplayTuning = DEFAULT_DISPLAY_TUNING,
): () => void {
  let from: { id: number; y: number } | null = null;

  const down = (event: PointerEvent): void => {
    from = { id: event.pointerId, y: event.clientY };
    // Capture, so a pull that leaves the handle is still this handle's pull.
    if (typeof target.setPointerCapture === 'function') target.setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent): void => {
    if (!from || event.pointerId !== from.id) return;
    // Upward only: the sheet comes up from the bottom, so a pull down is a
    // gesture pointing away from the thing it would open.
    if (from.y - event.clientY < tuning.logPullPx) return;
    from = null;
    event.preventDefault();
    open();
  };

  const end = (event: PointerEvent): void => {
    if (from?.id === event.pointerId) from = null;
  };

  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);

  return () => {
    target.removeEventListener('pointerdown', down);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', end);
    target.removeEventListener('pointercancel', end);
  };
}
