/**
 * The card battle sandbox's two hidden ways in. **Card battle engine,
 * checkpoint 5.**
 *
 *   - On starter select, the keys ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
 *     Enter, in order.
 *   - On load, the URL hash `#test`, because a phone has no arrow keys.
 *
 * Nothing is drawn: no button, no hint, no change to starter select. The
 * sandbox itself loads through the one `import()` below, so the main bundle
 * carries only this file.
 *
 * The key listener is one capture-phase listener on the window, attached only
 * while starter select is the screen showing. Screens are toggled rather than
 * unmounted (`screens/router.ts`), so "while showing" is what mount and
 * unmount mean here. On the window's capture phase it hears a key before the
 * shell's own capture listeners (`ui/tooltips.ts`), and on the completing
 * Enter, and only then, it cancels the key's default and stops it, so Enter
 * never also presses a focused starter card or the Choose button.
 */

export const CARD_TEST_SEQUENCE: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];

/** The hash that opens the sandbox on load. */
export const CARD_TEST_HASH = '#test';

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

export interface CardTestEntry {
  /** Attach while starter select shows, detach otherwise. */
  setActive(active: boolean): void;
  /** How far into the sequence the keys so far have come. Tests only. */
  readonly progress: number;
}

export function createCardTestEntry(open: () => void, target: Window = globalThis.window): CardTestEntry {
  let progress = 0;
  let active = false;
  const onKey = (event: KeyboardEvent): void => {
    if (isTyping(event.target) || MODIFIERS.has(event.key)) return;
    if (event.key === CARD_TEST_SEQUENCE[progress]) progress++;
    // A wrong key resets; a wrong key that is the first key starts again.
    else progress = event.key === CARD_TEST_SEQUENCE[0] ? 1 : 0;
    if (progress < CARD_TEST_SEQUENCE.length) return;
    progress = 0;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  };
  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      progress = 0;
      if (next) target.addEventListener('keydown', onKey, true);
      else target.removeEventListener('keydown', onKey, true);
    },
    get progress() {
      return progress;
    },
  };
}

/** Whether a URL asks for the sandbox on load. */
export function wantsCardTest(href: string): boolean {
  try {
    return new URL(href).hash === CARD_TEST_HASH;
  } catch {
    return false;
  }
}

let opening: Promise<void> | null = null;

/**
 * Load the sandbox and open it over the app. One at a time: a second call
 * while one is open does nothing.
 */
export function openCardTest(host: HTMLElement = globalThis.document.body): Promise<void> {
  if (opening) return opening;
  opening = import('./cardbattle/sandbox').then(({ openSandbox }) => {
    openSandbox(host, { onExit: () => (opening = null) });
  });
  opening.catch(() => (opening = null));
  return opening;
}
