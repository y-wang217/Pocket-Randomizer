/**
 * The one overlay. Stage V2.
 *
 * Every confirm in the game used to be a button that changed its own label
 * on the first click and committed on the second: Release on the party
 * screen, Discard in the backpack, Release on a full-party capture. Three
 * copies of one pattern, each a little different, none an overlay. This is
 * the helper they share now, and `test/band.test.ts` asserts that no screen
 * builds its own.
 *
 * A band, not a box. The class is `confirm-band`, because `.band` is the
 * move band badge from 4.6b and the two must not share a rule. The plan's
 * word for it: a translucent dim strip across
 * the middle of the world, text-only buttons, the primary action the one
 * accent on screen and its sibling hollow. The stylesheet draws that; this
 * file owns the behaviour.
 *
 * - One band at a time. Opening another closes the first.
 * - Tap on the dim, Escape, or the secondary button cancels. Only the primary
 *   commits.
 * - While a band is open `<body data-band-open>` is set, and the stylesheet
 *   hollows every primary action outside the band, so the band's primary is
 *   the only accent on screen. The rule is "one accent per screen", and a
 *   confirm over a screen is still one screen.
 * - Nothing here touches run state. The caller decides what confirm means.
 */
import { el } from './scene';

export interface BandSpec {
  /** The question, as a heading. */
  title: string;
  /** One line under it, optional. */
  detail?: string;
  /**
   * Something to show above the buttons. **Milestone M2.3.**
   *
   * The band was text only — a question and a line — because the three
   * confirms it replaced were. M2.3 needs one that shows *the two move cards
   * being traded*, because the decision it confirms is a comparison and a
   * confirm that only named the two moves would be asking the player to
   * remember what they look like.
   *
   * An element rather than more strings, so the caller mounts the shared
   * component and this file keeps knowing nothing about moves. Optional, so
   * every existing caller is untouched.
   */
  content?: HTMLElement;
  /** The label of the committing button. */
  confirm: string;
  /** The label of the way out. */
  cancel: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface Band {
  root: HTMLElement;
  close(): void;
}

let open: Band | null = null;

/** The band currently up, if any. For tests and for the one-at-a-time rule. */
export function openBandOf(): Band | null {
  return open;
}

export function openBand(spec: BandSpec, host: HTMLElement = document.body): Band {
  open?.close();

  const root = el('div', 'confirm-band');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');

  const body = el('div', 'confirm-band__body');
  const title = el('h3', 'confirm-band__title');
  title.textContent = spec.title;
  body.append(title);
  if (spec.detail) {
    const detail = el('p', 'confirm-band__detail');
    detail.textContent = spec.detail;
    body.append(detail);
  }

  if (spec.content) {
    const content = el('div', 'confirm-band__content');
    content.append(spec.content);
    body.append(content);
  }

  const actions = el('div', 'confirm-band__actions');
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'button primary-action';
  confirm.textContent = spec.confirm;
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'button button--hollow';
  cancel.textContent = spec.cancel;
  actions.append(confirm, cancel);
  body.append(actions);
  root.append(body);

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      dismiss();
    }
  };

  const band: Band = {
    root,
    close() {
      if (open !== band) return;
      open = null;
      host.removeEventListener('keydown', onKey, true);
      delete host.dataset['bandOpen'];
      root.remove();
    },
  };

  const dismiss = (): void => {
    band.close();
    spec.onCancel?.();
  };

  confirm.addEventListener('click', (event) => {
    event.stopPropagation();
    band.close();
    spec.onConfirm();
  });
  cancel.addEventListener('click', (event) => {
    event.stopPropagation();
    dismiss();
  });
  // The dim is the way out too; the body is not.
  root.addEventListener('click', (event) => {
    if (event.target === root) dismiss();
  });
  body.addEventListener('click', (event) => event.stopPropagation());
  host.addEventListener('keydown', onKey, true);

  host.dataset['bandOpen'] = 'true';
  host.append(root);
  open = band;
  confirm.focus();
  return band;
}
