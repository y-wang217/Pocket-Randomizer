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
 * happened would cover the decision on the turn it most mattered. `open` has
 * exactly one caller, the strip's history control, and it is a click handler.
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
