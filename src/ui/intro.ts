/**
 * The intro panel: one modal, shown once, before the first decision.
 *
 * ## Built on `ui/overlay.ts`, and that is the whole of the layout
 *
 * A fourth hand-rolled overlay is the thing `ui/overlay.ts` exists to stop —
 * read its header for the three properties the two hand-copies had already
 * drifted on. So this file owns *when the panel shows and what it says*, and
 * owns no geometry, no scrim, no Escape handler and no focus restoration. It
 * gets all four for free and cannot drift from the other three surfaces.
 *
 * ## It does not compete with the coach marks
 *
 * The starter screen's marks and this panel are both due on a first launch,
 * and two overlays on one screen is neither. `ui/app.ts` holds the marks while
 * `isOpen()` is true and asks for them again from `onClose`, so the order is
 * always intro, then marks, then the starter cards. The layer itself enforces
 * nothing about that — it reports its state and announces its close, and the
 * shell sequences.
 *
 * ## Nothing here touches run state
 *
 * Presentation only, like `ui/tutorial.ts` and the tooltip layer. No import
 * from `core/`, and the only thing it writes is the seen flag in
 * `ui/settings.ts`.
 */
import { INTRO_COPY } from '../data/intro';
import { TUTORIAL_COPY } from '../data/tutorial';
import { createOverlay } from './overlay';
import { el } from './dom';
import { introDue, markIntroSeen } from './settings';

export interface IntroLayer {
  /** The fixed layer. Mounted once by the shell, hidden until opened. */
  root: HTMLElement;
  /**
   * Open it if it has never been dismissed at this content version.
   *
   * Returns whether it opened, so the shell can tell "shown" from "already
   * seen" without reading the store a second time.
   */
  openIfDue(opener?: HTMLElement | null): boolean;
  /** Open it regardless. The header control's path. */
  open(opener?: HTMLElement | null): void;
  /**
   * Close it. Like every other route out, this records it as seen — see the
   * note on `overlay.close` below for why there is no route that does not.
   */
  dismiss(): void;
  isOpen(): boolean;
  /**
   * Run `listener` whenever the panel closes, however it was closed — the
   * button, the scrim, Escape, or the header's Close.
   *
   * One hook rather than a callback per control, because every one of those
   * paths means the same thing to the shell: the screen underneath is the
   * player's now, and its marks are due.
   */
  onClose(listener: () => void): () => void;
  destroy(): void;
}

export function createIntro(host: HTMLElement): IntroLayer {
  const overlay = createOverlay({
    block: 'intro',
    label: INTRO_COPY.title,
    title: INTRO_COPY.title,
  });

  const body = el('p', 'intro__body');
  body.textContent = INTRO_COPY.body;

  /*
   * The pointer to the coach marks, under the greeting.
   *
   * It names the header control by its face — `Tutorial` — rather than
   * describing where it is, because the face is what the player will be
   * looking for and a position ("top right") is wrong on one of the two
   * layouts.
   */
  const pointer = el('p', 'intro__tutorial');
  pointer.textContent = INTRO_COPY.tutorial.replace('Tutorial,', `${TUTORIAL_COPY.replayShort},`);

  const actions = el('div', 'intro__actions');
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'button intro__dismiss';
  dismiss.textContent = INTRO_COPY.dismiss;
  dismiss.dataset['introDismiss'] = 'true';
  actions.append(dismiss);

  overlay.body.append(body, actions, pointer);
  overlay.root.dataset['intro'] = 'true';

  const listeners = new Set<() => void>();

  /*
   * **Every route out is intercepted at `close`, not at a control.**
   *
   * There are four: this file's button, and the shell's scrim, Escape and
   * Close. The first version of this listened for the events instead, and the
   * shell's own `sheet.addEventListener('click', stopPropagation)` — the
   * click-stop that keeps a tap inside the window from reading as a tap
   * outside it — swallowed the Close button's click before it reached the
   * layer. The panel closed and the flag was never written, so the greeting
   * came back on the next launch for exactly one of the four routes.
   *
   * The shell's handlers all call `view.close()` **through the returned
   * object**, so replacing the method on it catches all four in one place and
   * there is no event path left to miss. `chain` is the original, kept and
   * called first so the shell's own hide, focus restoration and state are
   * unchanged.
   */
  const chain = overlay.close.bind(overlay);
  overlay.close = () => {
    const wasOpen = overlay.isOpen();
    chain();
    if (!wasOpen) return;
    /*
     * A scrim tap is not "show me this again next launch": the panel asks for
     * nothing and holds no decision, so every way out of it is the same way
     * out. Recording only the button would leave a player who pressed Escape
     * being greeted again on every launch, which is the one behaviour a
     * one-time greeting must not have.
     */
    markIntroSeen();
    for (const listener of listeners) listener();
  };

  function open(opener?: HTMLElement | null): void {
    overlay.open(opener);
    // Focus the dismiss rather than the overlay's Close: on this panel they do
    // the same thing, and the one the player reads is the one that should be
    // under the keyboard.
    dismiss.focus();
  }

  dismiss.addEventListener('click', () => overlay.close());

  host.append(overlay.root);

  return {
    root: overlay.root,
    open,
    openIfDue(opener) {
      if (!introDue()) return false;
      open(opener);
      return true;
    },
    dismiss() {
      overlay.close();
    },
    isOpen: () => overlay.isOpen(),
    onClose(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      overlay.close();
      overlay.root.remove();
      listeners.clear();
    },
  };
}
