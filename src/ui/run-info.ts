/**
 * The Run Info screen, and the decision feed as the shell draws it.
 * **Stage 5.0/1**, bible section 5's *Run Info screen* row (D53, D55).
 *
 * The mid-run readout the author asked for: where the run is, the seed it is
 * on, and every decision so far. It is a readout in every sense section 5
 * gives the word: it writes nothing, submits nothing and draws nothing, so the
 * Run Info tab may open it over any decision. It is not the summary, which is
 * the end-of-run archive with its rematch and its score, and none of that is
 * here: the score stays off every surface a decision is made from
 * (`test/scoring.test.ts`).
 *
 * `renderFeed` is exported for the desktop sidebar, which mounts the same
 * feed beside the frame: one renderer, two call sites, so the two cannot
 * disagree about what a line says.
 */
import type { RunState } from '../core/run';
import { formatSeedString } from '../core/seedString';
import { gymForSegment } from '../data/gyms';
import { FEED_COPY } from './copy/feed';
import { RUN_INFO_COPY } from './copy/screens';
import type { FeedEntry } from './decision-feed';
import { el } from './dom';
import { createOverlay, type Overlay } from './overlay';
import { renderHeading, renderRail } from './screens/run-map';
import { formatBuildStamp } from './stamps';

/**
 * The feed as a list, newest first, with a heading wherever the segment
 * changes. `limit` keeps the newest that many entries, for the sidebar.
 */
export function renderFeed(entries: readonly FeedEntry[], limit?: number): HTMLElement {
  const list = el('ol', 'feed');
  list.setAttribute('aria-label', FEED_COPY.heading);
  if (entries.length === 0) {
    const empty = el('li', 'feed__empty');
    empty.textContent = FEED_COPY.empty;
    list.append(empty);
    return list;
  }
  const shown = limit === undefined ? entries : entries.slice(-limit);
  let segment: number | null = null;
  for (const entry of [...shown].reverse()) {
    if (entry.segment !== segment) {
      segment = entry.segment;
      const heading = el('li', 'feed__segment');
      heading.textContent = FEED_COPY.segment(entry.segment, gymForSegment(entry.segment).leader);
      list.append(heading);
    }
    const row = el('li', 'feed__entry');
    row.dataset['kind'] = entry.kind;
    row.textContent = entry.text;
    list.append(row);
  }
  return list;
}

export interface RunInfoView {
  state: RunState;
  entries: readonly FeedEntry[];
}

export interface RunInfo {
  overlay: Overlay;
  open(view: RunInfoView, opener?: HTMLElement | null): void;
}

export function createRunInfo(): RunInfo {
  const overlay = createOverlay({ block: 'run-info', label: RUN_INFO_COPY.label, title: RUN_INFO_COPY.title });

  const heading = el('div', 'map__heading run-info__heading');
  const rail = el('ol', 'rail run-info__rail');
  const facts = el('dl', 'run-info__facts');
  const progressTitle = el('h3', 'drawer__section');
  progressTitle.textContent = RUN_INFO_COPY.progress;
  const feed = el('div', 'run-info__feed');
  overlay.body.append(heading, rail, facts, progressTitle, feed);

  const fact = (label: string, value: string): HTMLElement[] => {
    const term = el('dt', 'run-info__term');
    term.textContent = label;
    const detail = el('dd', 'run-info__value');
    detail.textContent = value;
    return [term, detail];
  };

  return {
    overlay,
    open(view, opener) {
      const segment = view.state.segments[view.state.currentSegment];
      heading.replaceChildren(...(segment ? renderHeading(view.state, segment) : []));
      rail.replaceChildren(...renderRail(view.state));
      facts.replaceChildren(...fact(RUN_INFO_COPY.seed, formatSeedString(view.state.seed)), ...fact(RUN_INFO_COPY.build, formatBuildStamp()));
      feed.replaceChildren(renderFeed(view.entries));
      overlay.open(opener);
    },
  };
}
