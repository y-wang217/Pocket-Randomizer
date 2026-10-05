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
 *     inside the frame.
 *
 * Read-only throughout: nothing here is a control, so nothing here can be a
 * second path to a decision. Hidden below 1024px by the stylesheet, where the
 * Run Info tab reaches the same feed.
 */
import { heldItem } from '../core/items';
import { localeOf, partyCapacity, type RunState } from '../core/run';
import { GYMS, gymForSegment } from '../data/gyms';
import { localeById } from '../data/locales';
import { assetIcon } from './assets/manifest';
import { FEED_COPY } from './copy/feed';
import { SIDEBAR_COPY } from './copy/screens';
import type { FeedEntry } from './decision-feed';
import { el } from './dom';
import { renderFeed } from './run-info';
import { nextChallengerOf, renderNextChallenger } from './next-challenger';
import { renderSlots } from './slots';

export interface Sidebar {
  root: HTMLElement;
  update(state: RunState | null, entries: readonly FeedEntry[]): void;
}

/** How many feed lines the sidebar keeps on view. The Run Info screen has the rest. */
const FEED_LINES = 40;

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

  return {
    root,
    update(state, entries) {
      if (!state) {
        where.replaceChildren();
        team.replaceChildren();
        progress.replaceChildren(title(FEED_COPY.heading), renderFeed([], () => ''));
        return;
      }
      const segment = state.currentSegment;
      const gym = gymForSegment(segment);
      const locale = localeOf(state);
      const line = el('p', 'sidebar__line');
      line.textContent = SIDEBAR_COPY.where(locale ? localeById(locale).name : null, segment, GYMS.length, state.segments[segment]?.leader ?? `Challenger ${gym.segment + 1}`);
      // The eight pips stood here until D102 (checkpoint 7); the run's
      // position is the where-line's, and the distance is the bar's.
      where.replaceChildren(title(SIDEBAR_COPY.whereTitle), line, renderNextChallenger(nextChallengerOf(state)));

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
      progress.replaceChildren(title(FEED_COPY.heading), renderFeed(entries, (index) => state.segments[index]?.leader ?? '', FEED_LINES));
    },
  };
}
