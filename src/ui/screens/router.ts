/**
 * The screen router.
 *
 * Eleven screens, one visible at a time, all mounted once and toggled rather
 * than created and destroyed.
 *
 * Stage 4.6a added `locale` and removed `acquisition`: a capture is now a block
 * inside `result` rather than a screen after it, so a fight and the offer it
 * produced are one view. See `screens/acquisition.ts`. Toggling keeps the DOM — and therefore the
 * battle log's scroll position and the HP bar's CSS transition — alive across
 * a switch, which is what makes returning from a battle to the map feel like
 * one app rather than four.
 *
 * Visibility is `hidden`, not `display`, so a screen that is off is out of the
 * accessibility tree too.
 */
export type ScreenName =
  | 'starter'
  /** Which region the segment is walked through. Stage 4.6a, a pre-step. */
  | 'locale'
  | 'map'
  | 'battle'
  /**
   * How a battle ended, with its reward cards inside it. Stage 4.5.2.
   *
   * Was `reward`, and the rename is the item: the reward screen used to be the
   * only thing a finished fight could reach, so a win with no cards reached
   * nothing at all.
   */
  | 'result'
  /** Which member gets an item, a TM or a tutor. Stage 4. */
  | 'target'
  /** Which of that member's four moves the incoming one displaces. */
  | 'replace'
  /** Reorder and release, between nodes. Stage 4. */
  | 'party'
  /**
   * The beat before a gym, and the one decision that belongs there. Stage 4.7.
   *
   * A screen and **not a node**: it consumes no step from the node budget,
   * carries no tier, grants no reward and consumes no RNG. It is here for the
   * same reason `locale` is — a decision that happens between nodes still needs
   * somewhere to happen.
   */
  | 'pre-gym'
  | 'shop'
  | 'event'
  | 'summary';

export interface Router {
  root: HTMLElement;
  show(name: ScreenName): void;
  current(): ScreenName | null;
}

export function createRouter(screens: Record<ScreenName, HTMLElement>): Router {
  const root = document.createElement('div');
  root.className = 'screens';

  for (const [name, element] of Object.entries(screens)) {
    element.dataset['screen'] = name;
    element.hidden = true;
    root.append(element);
  }

  let active: ScreenName | null = null;

  return {
    root,
    show(name) {
      if (active === name) return;
      for (const [key, element] of Object.entries(screens)) {
        element.hidden = key !== name;
      }
      active = name;
    },
    current: () => active,
  };
}
