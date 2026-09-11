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
 * view before the mark is placed, with `behavior: 'auto'` when the viewer
 * prefers reduced motion, so a mark's target and its text are both on a
 * 390x844 screen without the player scrolling.
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

function prefersReducedMotion(): boolean {
  return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * An element is anchorable when it is in the document and nothing above it is
 * hidden. Screens the router has put away carry `hidden`, so a mark whose
 * anchor lives on another screen does not show.
 */
function present(element: Element): boolean {
  return element.isConnected && element.closest('[hidden]') === null;
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

  function place(anchor: HTMLElement): void {
    // jsdom has no scrollIntoView; a browser always does.
    if (typeof anchor.scrollIntoView === 'function') {
      anchor.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    const margin = 8;
    const box = anchor.getBoundingClientRect();
    root.style.left = '0px';
    root.style.top = '0px';
    const own = root.getBoundingClientRect();
    const viewportHeight = globalThis.innerHeight || 0;
    const viewportWidth = globalThis.innerWidth || 0;
    const spaceBelow = viewportHeight - box.bottom;
    const above = spaceBelow < own.height + margin && box.top > own.height + margin;
    let top = above ? box.top - own.height - margin : box.bottom + margin;
    // Neither above nor below fits on a short screen: sit over the lower half,
    // keeping the anchor's top edge clear so the thing pointed at is visible.
    if (top + own.height > viewportHeight - margin) top = Math.max(margin, viewportHeight - own.height - margin);
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
        const anchor = within.querySelector<HTMLElement>(mark.anchor) ?? host.querySelector<HTMLElement>(mark.anchor);
        return anchor && present(anchor) ? [{ mark, anchor }] : [];
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
