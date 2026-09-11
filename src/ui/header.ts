/**
 * The app header: the title, the stage line, and the one row of controls that
 * costs the phone no height.
 *
 * Extracted from `app.ts` by the density modes patch, step 3, so the gallery
 * mounts the same chrome the app does. The Pocket gate is a `scrollHeight`
 * gate on a whole page, and a fixture that drew a screen without the header
 * above it would measure a page the player never sees.
 *
 * Nothing here touches run state. The controls on the row are setup
 * affordances: the tutorial replay and the seed bar's collapse toggle. The
 * density mode's picker is in the drawer (`ui/drawer.ts`, step 7).
 */
import { GYMRUN_FORMAT } from '../core/battle/format';
import { TUTORIAL_COPY } from '../data/tutorial';
import { el } from './dom';

export function createHeader(replayTutorial: HTMLButtonElement, seedToggle: HTMLButtonElement): HTMLElement {
  const header = el('header', 'header');
  const title = el('h1', 'header__title');
  title.textContent = 'GYMRUN';
  const subtitle = el('p', 'header__subtitle');
  subtitle.textContent = `Stage 4.8 · ${GYMRUN_FORMAT} · a roster that grows, caught in eight regions, and scored`;
  header.append(title, subtitle, createControls(replayTutorial, seedToggle));
  return header;
}

/**
 * The header's control row: the tutorial replay and the seed bar's toggle.
 *
 * **Density modes patch, step 7: the Detail toggle that lived here is gone.**
 * The three-valued picker is in the drawer (`ui/drawer.ts`), reachable from
 * every screen of a run; the row stays because the two controls on it are
 * still reading and setup affordances that cost the phone no height.
 */
function createControls(replayTutorial: HTMLButtonElement, seedToggle: HTMLButtonElement): HTMLElement {
  const wrap = el('div', 'header__controls');

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
  wrap.append(replayTutorial, seedToggle);
  return wrap;
}
