/**
 * The next challenger, and how far off they are. **Stage 6.0 checkpoint 7,
 * D102.**
 *
 * One component in place of the eight-badge rail and the sidebar's pips: the
 * challenger's class and name, their trainer sprite at 16 where the record
 * has one, over a bar that empties as the segment's steps are walked. The
 * author's design: *"maps are training, and there's only a progress bar that
 * shrinks as the 'next challenger approaches'"*. The run's position (which
 * of the eight) is the segment heading's `Challenger n of 8`; the bar is the
 * distance to this one.
 *
 * The bar reads `steps remaining / steps in the route`. Before the route is
 * picked (the locale screen) there are no steps yet, so the bar is full: the
 * segment has not begun. At the boss it is empty. It is a fact about the
 * route the seed drew, never a forecast: every step is on the map already.
 *
 * One implementation for every mount (map, map drawer, Run Info, sidebar,
 * locale screen), for the reason `renderHeading` gives: one set of facts.
 */
import type { RunState } from '../core/run';
import { stepsOf } from '../core/run';
import { NEXT_CHALLENGER_COPY } from './copy/screens';
import { el } from './dom';
import { opponentImg } from './sprites';

export interface NextChallengerView {
  /** The challenger's class and name, `Rival Blue`, as the node's opponent reads. */
  opponent: string;
  /** The record's trainer sprite id, or null for none. */
  sprite: string | null;
  /** Steps in the route being walked; zero before the locale is picked. */
  total: number;
  /** Steps still to walk before the challenger; `total` at the start, zero at the boss. */
  remaining: number;
}

/** The view for a run's current segment. */
export function nextChallengerOf(state: RunState): NextChallengerView {
  const segment = state.segments[state.currentSegment];
  const source = segment?.gym.encounter?.source ?? null;
  const total = stepsOf(state).length;
  return {
    opponent: segment?.gym.encounter?.opponent ?? '',
    sprite: source?.sprite ?? null,
    total,
    remaining: Math.max(0, total - state.position),
  };
}

export function renderNextChallenger(view: NextChallengerView): HTMLElement {
  const root = el('div', 'next-challenger');

  const label = el('span', 'next-challenger__label');
  label.textContent = NEXT_CHALLENGER_COPY.label;

  const who = el('span', 'next-challenger__who');
  if (view.sprite) who.append(opponentImg(view.sprite));
  who.append(document.createTextNode(view.opponent));

  // Full until the route exists, empty at the boss, a fraction between.
  const fraction = view.total > 0 ? view.remaining / view.total : 1;
  const bar = el('div', 'next-challenger__bar');
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', `${NEXT_CHALLENGER_COPY.label}: ${view.opponent}`);
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', String(Math.max(1, view.total)));
  bar.setAttribute('aria-valuenow', String(view.total > 0 ? view.remaining : 1));
  bar.dataset['remaining'] = String(view.remaining);
  bar.dataset['total'] = String(view.total);
  const fill = el('span', 'next-challenger__fill');
  fill.style.width = `${Math.round(fraction * 100)}%`;
  bar.append(fill);

  root.append(label, who, bar);
  return root;
}
