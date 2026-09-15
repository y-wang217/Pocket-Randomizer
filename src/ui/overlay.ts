/**
 * The overlay shell: one recipe, three surfaces.
 *
 * ## Why this file exists
 *
 * Before it there were two overlays — the party drawer and the battle history
 * sheet — built from the same recipe by hand, and this patch would have made a
 * third. Two hand-copies had **already drifted**, in ways nobody noticed because
 * nothing compared them:
 *
 *   - `log-sheet.ts` had no Escape handler. The drawer had one.
 *   - `log-sheet.ts` had no click-stop on its sheet. The drawer had one.
 *   - `drawer.ts` mirrored its open state in a `let open` flag that could
 *     disagree with the DOM; `log-sheet.ts` read `!root.hidden` and could not.
 *
 * None of those is a big bug. That is the point: a third copy would have picked
 * one of the two behaviours at random per property, and the drift would have
 * become a pattern instead of an accident. So the recipe is extracted once, the
 * drift is resolved here in favour of the better half of each pair, and the
 * geometry lives in one CSS block rather than three.
 *
 * ## Dual class names, and why they are not clutter
 *
 * Every element carries **both** the shared class and its caller's own block:
 * `overlay drawer`, `overlay__sheet drawer__sheet`, `overlay__scrim
 * log-sheet__scrim`. The shared half owns geometry; the block half owns
 * whatever that one surface needs.
 *
 * This is what makes the extraction safe rather than a rename. `.drawer__sheet`,
 * `.drawer__close`, `.log-sheet__sheet` and `[data-drawer-trigger]` are queried
 * by the visual suite, the density suite, the Pocket gate and `scripts/smoke.mjs`
 * against the real bundle. A shared shell that renamed them would have been a
 * shared shell that broke eleven files to save three.
 *
 * ## A window, not a bottom sheet
 *
 * Stage 4.7 anchored the drawer to the bottom edge because "that is where a
 * thumb is", and kept it short of the top so that "the strip of the screen
 * underneath is what says this is an overlay".
 *
 * The second half of that reasoning is what survives, and a centred window
 * serves it better: the strip is on **every** edge rather than one. The first
 * half was a phone argument that did not generalise — the map overlay's content
 * is a tall eight-gym rail plus a step chain, which wants the height a window
 * gives it and a bottom sheet's `max-height: 86vh` does not.
 *
 * ## `hidden` and `display`
 *
 * `.overlay[hidden]` carries its own `display: none` in the stylesheet. That
 * trap — `hidden` is a UA style, and any `display` rule beats it, so an overlay
 * toggled with `hidden` and laid out with `display: flex` is an invisible scrim
 * eating every tap on the screen below — is recorded three times in
 * `styles.css` and `npm run smoke` caught it all three times, because jsdom has
 * no pointer-event model and every unit test passed while the app was
 * unusable.
 *
 * It is guarded once now, here, for all three overlays. There is no fourth
 * occurrence to record.
 */
import { el } from './dom';

export interface Overlay {
  /** The fixed layer. Mounted once by the caller's owner, hidden until opened. */
  root: HTMLElement;
  /** The window itself. Scrolls internally when its content outgrows it. */
  sheet: HTMLElement;
  /** Where the caller puts its content. Emptied and refilled per open. */
  body: HTMLElement;
  /** The heading, so a caller can retitle per open if it needs to. */
  title: HTMLElement;
  /** The header row, for a caller that wants a control beside Close. */
  header: HTMLElement;
  /**
   * Show it.
   *
   * `opener` is the control that was activated, kept so focus can go back
   * where it came from. See `close` below.
   */
  open(opener?: HTMLElement | null): void;
  close(): void;
  isOpen(): boolean;
}

export function createOverlay(spec: { block: string; label: string; title: string }): Overlay {
  const root = el('div', `overlay ${spec.block}`);
  root.hidden = true;
  // A dialog rather than a div with a class: the overlay announces itself, and
  // a screen reader user who opens it lands inside it rather than beside it.
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', spec.label);

  const scrim = el('div', `overlay__scrim ${spec.block}__scrim`);
  const sheet = el('div', `overlay__sheet ${spec.block}__sheet`);

  const header = el('div', `overlay__header ${spec.block}__header`);
  const title = el('h2', `overlay__title ${spec.block}__title`);
  title.textContent = spec.title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = `button button--small overlay__close ${spec.block}__close`;
  close.textContent = 'Close';
  header.append(title, close);

  const body = el('div', `overlay__body ${spec.block}__body`);

  sheet.append(header, body);
  root.append(scrim, sheet);

  /*
   * Where focus was before the overlay took it.
   *
   * Neither hand-copy restored focus, despite both claiming `aria-modal`. A
   * keyboard user who opened the drawer, read it and pressed Escape was
   * returned to the top of the document rather than to the button they had
   * just pressed — on a game where that button sits on every decision surface,
   * that is the difference between an overlay you can dip into and one that
   * costs you your place every time.
   */
  let opener: HTMLElement | null = null;

  const view: Overlay = {
    root,
    sheet,
    body,
    title,
    header,

    open(from) {
      opener = from ?? null;
      root.hidden = false;
      close.focus();
    },

    close() {
      root.hidden = true;
      // Guarded on the method, because jsdom gives every element `focus` but a
      // detached opener is still a real possibility: a trigger whose screen was
      // rebuilt while the overlay was open is no longer in the document, and
      // focusing it would silently do nothing rather than throw. Clearing the
      // reference either way keeps a stale node from being held past its use.
      if (opener?.isConnected) opener.focus();
      opener = null;
    },

    // Read off the DOM rather than a mirrored flag. The flag version could
    // disagree with what the player sees; this one cannot.
    isOpen: () => !root.hidden,
  };

  close.addEventListener('click', () => view.close());
  // Tapping the scrim closes, like every sheet on a phone. The sheet stops the
  // click so a tap inside it is never read as a tap outside it.
  scrim.addEventListener('click', () => view.close());
  sheet.addEventListener('click', (event) => event.stopPropagation());
  // On `root` rather than the document: the overlay is not a global key
  // handler, and it only needs to hear Escape while focus is inside it — which
  // `close.focus()` above guarantees from the moment it opens.
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') view.close();
  });

  return view;
}
