/**
 * The screen router.
 *
 * Four screens, one visible at a time, all mounted once and toggled rather
 * than created and destroyed. Toggling keeps the DOM — and therefore the
 * battle log's scroll position and the HP bar's CSS transition — alive across
 * a switch, which is what makes returning from a battle to the map feel like
 * one app rather than four.
 *
 * Visibility is `hidden`, not `display`, so a screen that is off is out of the
 * accessibility tree too.
 */
export type ScreenName = 'starter' | 'map' | 'battle' | 'summary';

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
