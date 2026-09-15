/**
 * @vitest-environment jsdom
 *
 * The shared overlay shell's contract, asserted **against all three blocks**.
 *
 * That is the whole point of the file. Before the shell there were two
 * overlays built from one recipe by hand, and they had drifted in three places
 * — the history sheet had no Escape handler and no click-stop, and the drawer
 * mirrored its open state in a flag that could disagree with the DOM. Nobody
 * had noticed, because nothing compared them.
 *
 * So this runs the same assertions over every block the shell serves rather
 * than over one. A per-block copy of these tests would reproduce the failure
 * mode it is written to prevent: whichever block somebody forgets to add is
 * exactly the one that drifts.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { createOverlay, type Overlay } from '../src/ui/overlay';

const BLOCKS = ['drawer', 'log-sheet', 'map-drawer'] as const;

function mount(block: string): { overlay: Overlay; opener: HTMLButtonElement } {
  const overlay = createOverlay({ block, label: `The ${block}`, title: 'A title' });
  const opener = document.createElement('button');
  opener.textContent = 'Open';
  document.body.append(overlay.root, opener);
  return { overlay, opener };
}

describe.each(BLOCKS)('the overlay shell, as %s', (block) => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('starts hidden', () => {
    const { overlay } = mount(block);
    expect(overlay.isOpen()).toBe(false);
    expect(overlay.root.hidden).toBe(true);
  });

  it('carries both the shared class and its own block, on every part', () => {
    /*
     * **The load-bearing detail of the whole extraction.**
     *
     * `.drawer__sheet`, `.drawer__close`, `.log-sheet__sheet` and
     * `[data-drawer-trigger]` are queried by four suites and by
     * `scripts/smoke.mjs` against the real bundle. The shared geometry hangs
     * off `.overlay__*`. Both halves have to be on every element or one of the
     * two breaks, and which one breaks is not obvious from either side.
     */
    const { overlay } = mount(block);
    const pairs: [string, Element | null][] = [
      ['', overlay.root],
      ['__scrim', overlay.root.querySelector(`.${block}__scrim`)],
      ['__sheet', overlay.sheet],
      ['__header', overlay.header],
      ['__title', overlay.title],
      ['__body', overlay.body],
      ['__close', overlay.root.querySelector(`.${block}__close`)],
    ];
    for (const [part, element] of pairs) {
      expect(element, `no element for ${block}${part}`).not.toBeNull();
      expect(element!.classList.contains(`overlay${part}`), `${block}${part} lost its shared class`).toBe(true);
      expect(element!.classList.contains(`${block}${part}`), `${block}${part} lost its block class`).toBe(true);
    }
  });

  it('announces itself as a dialog', () => {
    const { overlay } = mount(block);
    expect(overlay.root.getAttribute('role')).toBe('dialog');
    expect(overlay.root.getAttribute('aria-modal')).toBe('true');
    expect(overlay.root.getAttribute('aria-label')).toBe(`The ${block}`);
  });

  it('opens, and takes focus so Escape is heard', () => {
    const { overlay, opener } = mount(block);
    overlay.open(opener);

    expect(overlay.isOpen()).toBe(true);
    expect(overlay.root.hidden).toBe(false);
    // Close rather than the sheet: a screen reader user lands on a control,
    // and the Escape listener is on `root`, so focus must already be inside.
    expect(document.activeElement?.textContent).toBe('Close');
  });

  it('closes on the Close button', () => {
    const { overlay, opener } = mount(block);
    overlay.open(opener);
    overlay.root.querySelector<HTMLButtonElement>(`.${block}__close`)!.click();
    expect(overlay.isOpen()).toBe(false);
  });

  it('closes on a tap outside, on the scrim', () => {
    const { overlay, opener } = mount(block);
    overlay.open(opener);
    overlay.root.querySelector<HTMLElement>(`.${block}__scrim`)!.click();
    expect(overlay.isOpen()).toBe(false);
  });

  it('closes on Escape', () => {
    // The history sheet could not do this before the shell. Asserted for every
    // block so it cannot be lost from one of them again.
    const { overlay, opener } = mount(block);
    overlay.open(opener);
    overlay.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(overlay.isOpen(), 'Escape did not close it').toBe(false);
  });

  it('does not close on a tap inside the sheet', () => {
    // The click-stop the history sheet was missing: a tap on content is not a
    // tap outside it, and reading one as the other closes the overlay under
    // the player's finger.
    const { overlay, opener } = mount(block);
    overlay.open(opener);
    overlay.sheet.click();
    overlay.body.click();
    expect(overlay.isOpen(), 'a tap inside the window closed it').toBe(true);
  });

  it('returns focus to the control that opened it', () => {
    const { overlay, opener } = mount(block);
    opener.focus();
    overlay.open(opener);
    expect(document.activeElement).not.toBe(opener);

    overlay.close();
    expect(document.activeElement, 'focus did not go back to the opener').toBe(opener);
  });

  it('survives closing with no opener, and with one that has left the document', () => {
    /*
     * Both are real: the gallery opens overlays with no opener at all, and a
     * trigger whose screen was rebuilt while the overlay was up is no longer
     * connected. Neither may throw on the way out.
     */
    const { overlay, opener } = mount(block);
    overlay.open();
    expect(() => overlay.close()).not.toThrow();

    overlay.open(opener);
    opener.remove();
    expect(() => overlay.close()).not.toThrow();
    expect(overlay.isOpen()).toBe(false);
  });

  it('reads its open state off the DOM rather than a mirrored flag', () => {
    // The drawer's old `let open` could disagree with what the player saw.
    // Hiding the root behind the shell's back must still read as closed.
    const { overlay, opener } = mount(block);
    overlay.open(opener);
    overlay.root.hidden = true;
    expect(overlay.isOpen()).toBe(false);
  });

  it('keeps its body content across an open and close', () => {
    // An overlay is not a route: the shell never empties what a caller put in
    // it, so a caller that renders once and toggles many times stays correct.
    const { overlay, opener } = mount(block);
    const marker = document.createElement('p');
    marker.textContent = 'content';
    overlay.body.append(marker);

    overlay.open(opener);
    overlay.close();
    overlay.open(opener);

    expect(overlay.body.textContent).toBe('content');
  });
});
