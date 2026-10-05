/**
 * The desktop sidebar. **Stage 5.0/1.**
 *
 * *"Desktop is the same frame plus a sidebar. Not the reverse."* At 1024px and
 * wider the portrait frame keeps its phone width and this sits beside it,
 * holding three things, each a mount of something that already exists:
 *
 *   - **Where the run is**: the locale and the gym it is walking to, in the
 *     words the map's own heading uses.
 *   - **The team**: `ui/slots.ts`'s hotbar, the same slots the party screen and
 *     the result screen draw, to the run's live capacity (the shipped unlock
 *     schedule, never six fixed slots).
 *   - **Run progress**: the decision feed (`ui/decision-feed.ts`), newest
 *     first, through the Run Info screen's own renderer. Bible R11's
 *     carve-out puts the feed here and on the Run Info screen, and nowhere
 *     inside the frame. **Folded by default** since the teach screen
 *     text-load patch (2026-10-05): the author found it open beside every
 *     screen and asked for it shut. Its heading opens it, and it stays as the
 *     player left it for the rest of the page's life.
 *
 * Read-only throughout: the one control is the feed's fold, which changes
 * nothing but what is on view, so nothing here can be a second path to a
 * decision. Hidden below 1024px by the stylesheet, where the
 * Run Info tab reaches the same feed.
 */
import { heldItem } from '../core/items';
import { gymsCleared, localeOf, partyCapacity, runMode, type RunState } from '../core/run';
import { GYMS, gymForSegment } from '../data/gyms';
import { localeById } from '../data/locales';
import { assetIcon } from './assets/manifest';
import { FEED_COPY } from './copy/feed';
import { SIDEBAR_COPY } from './copy/screens';
import type { FeedEntry } from './decision-feed';
import { el } from './dom';
import { renderFeed } from './run-info';
import { renderSlots } from './slots';

export interface Sidebar {
  root: HTMLElement;
  update(state: RunState | null, entries: readonly FeedEntry[]): void;
}

/** How many feed lines the sidebar keeps on view. The Run Info screen has the rest. */
const FEED_LINES = 40;

/** The feed fold's marks: the readout disclosure `ui/collapse.ts` draws. */
const FOLD_SHOW = '\u25BE';
const FOLD_HIDE = '\u25B4';

export function createSidebar(): Sidebar {
  const root = el('aside', 'sidebar');
  root.setAttribute('aria-label', SIDEBAR_COPY.label);

  const wordmark = el('div', 'sidebar__panel sidebar__wordmark');
  const word = el('span', 'sidebar__wordmark-text');
  word.textContent = SIDEBAR_COPY.wordmark;
  wordmark.append(assetIcon('wordmark'), word);

  const where = el('section', 'sidebar__panel sidebar__where');
  const team = el('section', 'sidebar__panel sidebar__team');
  const progress = el('section', 'sidebar__panel sidebar__progress');

  const title = (text: string): HTMLElement => {
    const heading = el('h3', 'sidebar__title');
    heading.textContent = text;
    return heading;
  };

  root.append(wordmark, where, team, progress);

  /*
   * The feed's heading is its fold. One button, built once and remounted on
   * every update so the player's choice survives the re-render; the body is
   * still drawn while folded, only hidden, so opening it costs nothing.
   */
  let open = false;
  const progressToggle = document.createElement('button');
  progressToggle.type = 'button';
  progressToggle.className = 'sidebar__toggle';
  const paintProgress = (): void => {
    progress.dataset['expanded'] = String(open);
    progressToggle.setAttribute('aria-expanded', String(open));
    progressToggle.textContent = `${FEED_COPY.heading} ${open ? FOLD_HIDE : FOLD_SHOW}`;
  };
  progressToggle.addEventListener('click', () => {
    open = !open;
    paintProgress();
  });
  paintProgress();
  const progressTitle = (): HTMLElement => {
    const heading = el('h3', 'sidebar__title');
    heading.append(progressToggle);
    return heading;
  };

  return {
    root,
    update(state, entries) {
      if (!state) {
        where.replaceChildren();
        team.replaceChildren();
        progress.replaceChildren(progressTitle(), renderFeed([]));
        return;
      }
      const segment = state.currentSegment;
      // A defender rank's boss has no leader (ruling R6).
      const leader = runMode(state) === 'defender' ? '' : gymForSegment(segment).leader;
      const locale = localeOf(state);
      const line = el('p', 'sidebar__line');
      line.textContent = SIDEBAR_COPY.where(locale ? localeById(locale).name : null, segment, GYMS.length, leader);
      const pips = el('ol', 'sidebar__pips');
      const cleared = gymsCleared(state);
      GYMS.forEach((_, index) => {
        const pip = el('li', 'sidebar__pip');
        pip.dataset['phase'] = index < cleared ? 'done' : index === segment ? 'current' : 'upcoming';
        pips.append(pip);
      });
      where.replaceChildren(title(SIDEBAR_COPY.whereTitle), line, pips);

      team.replaceChildren(
        title(SIDEBAR_COPY.team),
        renderSlots(
          'party',
          state.party.map((member) => {
            const item = heldItem(member);
            return { label: member.spec.species, item: member.item ?? null, ...(item ? { tip: `item:${member.item}` } : {}) };
          }),
          partyCapacity(state),
        ),
      );
      progress.replaceChildren(progressTitle(), renderFeed(entries, FEED_LINES));
    },
  };
}
