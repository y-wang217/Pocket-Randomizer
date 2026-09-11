/**
 * The coach-mark layer: one mark at a time, anchored to a real element,
 * advanced by tap. Overnight Branch 3.
 *
 * ## Shape
 *
 * One component, mounted once on the shell like the tooltip layer. A screen
 * that has just been shown asks `showFor(screen, within)`; the layer looks up
 * the screen's marks in `data/tutorial.ts`, keeps the ones whose anchor is
 * present and visible inside `within`, and shows the first. A tap anywhere on
 * the mark advances; the last tap closes and records the screen as seen.
 * "Skip tutorial" on the first mark dismisses every screen's marks, now and
 * later, until "Show tutorial again" in the header resets the flags.
 *
 * ## What it never does
 *
 * It never renders a mock of the element it points at: the anchor is the
 * real stat block, the real move button, the real tier badge, found by
 * `data-tutorial` attribute at the moment of showing. If the element is not
 * on screen, the mark does not show and the next one does. It sets no
 * timers and never auto-advances. A tap on a mark is a tap on the mark: the
 * panel stops propagation, so nothing under it is chosen and no decision is
 * submitted — `test/tutorial.test.ts` asserts that against every screen's
 * handlers. Nothing here is imported by `core/`.
 *
 * ## Motion
 *
 * The panel and the anchor's outline use one short transition, disabled under
 * `prefers-reduced-motion` in the stylesheet. The anchor is scrolled into
 * view instantly before the mark is placed — never smoothly, see `place` —
 * so a mark's target and its text are both on a 390x844 screen without the
 * player scrolling, under reduced motion and without it alike.
 */
import { TUTORIAL, TUTORIAL_COPY, type TutorialMark, type TutorialScreen } from '../data/tutorial';
import { el } from './scene';
import { markTutorialSeen, skipTutorial, tutorialDue } from './settings';

export interface TutorialLayer {
  root: HTMLElement;
  /**
   * Show `screen`'s marks if they are due and any anchor is present under
   * `within`. Returns how many marks will be shown, which is zero when the
   * screen was already seen, the tutorial is skipped, or nothing anchors.
   */
  showFor(screen: TutorialScreen, within: ParentNode): number;
  /** Close whatever is open without recording anything. */
  dismiss(): void;
  /** Whether a mark is on screen. */
  isOpen(): boolean;
  /** The screen and mark currently shown, for tests. */
  current(): { screen: TutorialScreen; mark: TutorialMark; index: number; count: number } | null;
  destroy(): void;
}

const ACTIVE = 'coachTarget';

/**
 * An element is anchorable when it is in the document and actually painted.
 *
 * In a browser `checkVisibility` answers that, `display: none` included —
 * which matters on a phone, where the seed bar is hidden once a run starts
 * and the seed mark has to anchor to the corner stamp instead. jsdom has no
 * layout, so there the test is connected and under no `hidden` ancestor,
 * which is what the router sets on a screen it has put away.
 */
function present(element: Element): boolean {
  if (!element.isConnected || element.closest('[hidden]') !== null) return false;
  const check = (element as { checkVisibility?: () => boolean }).checkVisibility;
  return typeof check === 'function' ? check.call(element) : true;
}

/** The first painted element matching `selector`, searching the screen first and then the shell. */
function anchorFor(selector: string, within: ParentNode, host: ParentNode): HTMLElement | null {
  for (const scope of [within, host]) {
    for (const candidate of scope.querySelectorAll<HTMLElement>(selector)) {
      if (present(candidate)) return candidate;
    }
  }
  return null;
}

export function createTutorial(host: HTMLElement): TutorialLayer {
  const root = el('div', 'coach');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-live', 'polite');

  const title = el('h3', 'coach__title');
  const text = el('p', 'coach__text');
  const footer = el('div', 'coach__footer');
  const progress = el('span', 'coach__progress');
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'button button--small coach__skip';
  skip.textContent = TUTORIAL_COPY.skip;
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'button button--small coach__next';
  footer.append(progress, skip, next);
  root.append(title, text, footer);

  let screen: TutorialScreen | null = null;
  let queue: { mark: TutorialMark; anchor: HTMLElement }[] = [];
  let index = 0;
  let target: HTMLElement | null = null;

  function clearTarget(): void {
    if (target) delete target.dataset[ACTIVE];
    target = null;
  }

  function close(): void {
    clearTarget();
    screen = null;
    queue = [];
    index = 0;
    root.hidden = true;
  }

  /**
   * Put the panel beside its anchor with both on screen: below the anchor if
   * that fits, above it if that fits, and otherwise scroll the anchor to the
   * top of the viewport and cap the panel's height to the room beneath it.
   * The panel never covers the top edge of the thing it points at.
   */
  function place(anchor: HTMLElement): void {
    const margin = 8;
    /*
     * `instant`, never `smooth` and never `auto`: the numbers below are read
     * right after the scroll, and `auto` defers to the container's
     * `scroll-behavior`, which the map sets to smooth — a panel placed against
     * an anchor still gliding into view lands on top of it. An instant scroll
     * is also what reduced motion asks for, so the same call serves both.
     * jsdom has no scrollIntoView and no layout; a browser has both.
     */
    const scroll =
      typeof anchor.scrollIntoView === 'function'
        ? (block: ScrollLogicalPosition) => anchor.scrollIntoView({ block, behavior: 'instant' as ScrollBehavior })
        : () => undefined;
    scroll('nearest');
    const viewportHeight = globalThis.innerHeight || 0;
    const viewportWidth = globalThis.innerWidth || 0;
    root.style.left = '0px';
    root.style.top = '0px';
    root.style.maxHeight = '';
    let box = anchor.getBoundingClientRect();
    let own = root.getBoundingClientRect();

    let top: number;
    if (box.bottom + margin + own.height <= viewportHeight - margin) {
      top = box.bottom + margin;
    } else if (box.top - margin - own.height >= margin) {
      top = box.top - margin - own.height;
    } else {
      // Anchor to the top, panel beneath, capped to what is left.
      scroll('start');
      box = anchor.getBoundingClientRect();
      const room = viewportHeight - box.bottom - 2 * margin;
      if (room >= 120) {
        root.style.maxHeight = `${room}px`;
        own = root.getBoundingClientRect();
        top = box.bottom + margin;
      } else {
        // The anchor fills the screen (a grid of cards, a whole chain). The
        // panel sits over its lower part with the top edge of the thing it
        // points at left clear, and never more than half the screen tall.
        root.style.maxHeight = `${Math.floor(viewportHeight * 0.45)}px`;
        own = root.getBoundingClientRect();
        top = viewportHeight - own.height - margin;
      }
    }
    const left = Math.max(margin, Math.min(box.left, viewportWidth - own.width - margin));
    root.style.left = `${left}px`;
    root.style.top = `${Math.max(margin, top)}px`;
  }

  function show(): void {
    const entry = queue[index];
    if (!entry || !screen) {
      close();
      return;
    }
    clearTarget();
    target = entry.anchor;
    target.dataset[ACTIVE] = 'true';
    title.textContent = entry.mark.title;
    text.textContent = entry.mark.text;
    progress.textContent = TUTORIAL_COPY.progress(index + 1, queue.length);
    next.textContent = index + 1 === queue.length ? TUTORIAL_COPY.done : TUTORIAL_COPY.next;
    skip.hidden = index !== 0;
    root.dataset['screen'] = screen;
    root.dataset['mark'] = entry.mark.id;
    root.hidden = false;
    place(entry.anchor);
  }

  function advance(): void {
    if (!screen) return;
    index++;
    if (index >= queue.length) {
      const done = screen;
      close();
      markTutorialSeen(done);
      return;
    }
    show();
  }

  root.addEventListener('click', (event) => {
    // The whole panel advances; the two buttons decide which way.
    event.preventDefault();
    event.stopPropagation();
    if (event.target instanceof Element && event.target.closest('.coach__skip')) {
      close();
      skipTutorial();
      return;
    }
    advance();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      const done = screen;
      close();
      if (done) markTutorialSeen(done);
    }
  });

  host.append(root);

  return {
    root,
    showFor(name, within) {
      if (!tutorialDue(name)) return 0;
      const marks = TUTORIAL[name];
      const found = marks.flatMap((mark) => {
        const anchor = anchorFor(mark.anchor, within, host);
        return anchor ? [{ mark, anchor }] : [];
      });
      if (found.length === 0) return 0;
      // A screen shown while another's marks are up replaces them; the earlier
      // screen was reached, so its first visit is spent.
      if (screen && screen !== name) {
        const previous = screen;
        close();
        markTutorialSeen(previous);
      }
      screen = name;
      queue = found;
      index = 0;
      show();
      return found.length;
    },
    dismiss: close,
    isOpen: () => !root.hidden,
    current: () => {
      const entry = queue[index];
      return screen && entry ? { screen, mark: entry.mark, index, count: queue.length } : null;
    },
    destroy() {
      close();
      root.remove();
    },
  };
}
