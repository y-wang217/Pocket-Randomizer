/**
 * The app header: the title, the stage line, and the one row of controls that
 * costs the phone no height.
 *
 * Extracted from `app.ts` by the density modes patch, step 3, so the gallery
 * mounts the same chrome the app does. The Pocket gate is a `scrollHeight`
 * gate on a whole page, and a fixture that drew a screen without the header
 * above it would measure a page the player never sees.
 *
 * Nothing here touches run state. The controls on the row are reading
 * preferences and setup affordances: the density toggle (a placeholder until
 * the picker lands in the drawer at step 7), the tutorial replay, and the seed
 * bar's collapse toggle. See the header of `ui/settings.ts` for the rule the
 * density value lives under and `test/density.test.ts` for its enforcement.
 */
import { GYMRUN_FORMAT } from '../core/battle/format';
import { TUTORIAL_COPY } from '../data/tutorial';
import { el } from './dom';
import { getDensity, setDensity } from './settings';

export function createHeader(replayTutorial: HTMLButtonElement, seedToggle: HTMLButtonElement): HTMLElement {
  const header = el('header', 'header');
  const title = el('h1', 'header__title');
  title.textContent = 'GYMRUN';
  const subtitle = el('p', 'header__subtitle');
  subtitle.textContent = `Stage 4.8 · ${GYMRUN_FORMAT} · a roster that grows, caught in eight regions, and scored`;
  header.append(title, subtitle, createDensityToggle(replayTutorial, seedToggle));
  return header;
}

/**
 * The Simple / Detailed toggle. **Presentation only, and global.**
 *
 * In the header rather than on a settings screen because it is a reading
 * preference rather than a game option: the player who wants it wants it
 * *while looking at* the numbers it hides, and a preference behind a menu is
 * one they set once and never revisit.
 *
 * **Density modes patch, step 2: a placeholder.** It reads and writes the
 * three-valued `density` and still flips between two of its values; Pocket is
 * reachable only from storage until the mode picker lands in the drawer at
 * step 7, which replaces this control.
 *
 * It is a cross-run setting, persisted in `ui/settings.ts`, and it defaults to
 * Detailed on a first launch — a new player does not know the help exists, so
 * the mode that hides it is the mode they never leave.
 */
function createDensityToggle(replayTutorial: HTMLButtonElement, seedToggle: HTMLButtonElement): HTMLElement {
  const wrap = el('div', 'density');
  const label = el('span', 'density__label');
  label.textContent = 'Detail';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--small density__toggle';

  const paint = (): void => {
    const detailed = getDensity() === 'detailed';
    button.textContent = detailed ? 'Detailed' : 'Simple';
    button.setAttribute('aria-pressed', String(detailed));
    // Says what the *other* mode does, because the button already says which
    // one is on. "Showing numbers" and "showing bars" are both facts.
    button.title = detailed ? 'Showing stat numbers' : 'Showing relative bars';
  };

  button.addEventListener('click', () => {
    setDensity(getDensity() === 'detailed' ? 'simple' : 'detailed');
    paint();
  });
  paint();

  /*
   * The tutorial's one header control, on the same row. **Presentation
   * only.** Here because it is the same kind of thing as the Detail toggle —
   * a reading preference — and because the coach marks are written against
   * Detailed mode. On the same row rather than its own, because the header's
   * height is the battle's and the map's vertical budget: a second row moved
   * the fourth move button past the 740 line on a phone. "Skip tutorial"
   * lives on the first mark itself, where a player meets it.
   */
  replayTutorial.type = 'button';
  replayTutorial.className = 'button button--small tutorial__replay';
  replayTutorial.textContent = TUTORIAL_COPY.replayShort;
  replayTutorial.setAttribute('aria-label', TUTORIAL_COPY.replay);
  replayTutorial.title = TUTORIAL_COPY.replay;
  replayTutorial.dataset['tutorialReplay'] = 'true';

  /*
   * The seed bar's toggle, on the same row and for the same reason: the row
   * already exists on every screen, so a control on it costs the phone no
   * height. The stylesheet shows it only at the phone width during a run,
   * which is the only time the bar it controls is collapsed. See the header
   * of `ui/seed-bar.ts`.
   */
  wrap.append(label, button, replayTutorial, seedToggle);
  return wrap;
}
