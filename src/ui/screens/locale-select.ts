/**
 * Locale select: two or three regions, one pick, before the segment begins.
 *
 * **The strictest application of the Part 4 editorial rule in the game so far.**
 * A card shows the region's name, its four types, and one line of flavour that
 * says where you are. That is the whole card.
 *
 * What is deliberately absent, and why each one is absent:
 *
 *   - **No difficulty rating.** A locale does not carry one. Tiers, levels and
 *     team sizes are identical whichever region is picked (`data/locales.ts`),
 *     so a "harder" badge would be the UI inventing a fact.
 *   - **No reward hint.** Same reason: the payouts behind a route are not a
 *     function of the locale either.
 *   - **No recommendation, no ordering, no "best for your party" marker.** The
 *     four types *are* the decision — the player reads them against the party
 *     they are carrying and against the gym they can see on the rail — and a
 *     screen that did that reading for them would replace the decision with a
 *     button.
 *   - **No preview of the route.** The map is revealed after the pick, exactly
 *     as it always was. A player choosing between two fully-readable maps is
 *     solving an optimisation problem, not making a decision; this is the same
 *     argument `run-map.ts` makes for showing tiers but never the three cards.
 *
 * The one thing a card *could* honestly say and does not is which of its types
 * the party already covers. That is a real fact and it is on the map screen's
 * threat readout, one click away, rather than repeated here — putting it on the
 * card would sort the cards in the reader's eye, which is an ordering that
 * implies a ranking.
 */
import { localeById, type LocaleId } from '../../data/locales';
import { el } from '../scene';
import { typeChip } from './starter-select';

export interface LocaleSelect {
  root: HTMLElement;
  render(options: readonly LocaleId[], segment: number, onPick: (index: number) => void): void;
}

export function createLocaleSelect(): LocaleSelect {
  const root = el('section', 'screen screen--locale');
  const heading = el('h2', 'screen__title');
  const blurb = el('p', 'screen__blurb');
  blurb.textContent =
    'Where this segment is walked. The region decides which wild Pokemon live ' +
    'in it, and nothing else — trainers, shops, rests and the gym are the same ' +
    'either way.';
  const grid = el('div', 'locales');

  root.append(heading, blurb, grid);

  return {
    root,
    render(options, segment, onPick) {
      heading.textContent = `Segment ${segment + 1} — choose a region`;
      grid.replaceChildren(...options.map((locale, index) => renderCard(locale, () => onPick(index))));
    },
  };
}

function renderCard(id: LocaleId, onPick: () => void): HTMLElement {
  const locale = localeById(id);

  const card = document.createElement('button');
  card.type = 'button';
  card.className = `locale locale--${id}`;

  const name = el('span', 'locale__name');
  name.textContent = locale.name;

  const types = el('span', 'locale__types');
  // The four types, in table order rather than sorted, so the same region reads
  // the same way every time it is offered.
  types.replaceChildren(...locale.types.map(typeChip));

  const blurb = el('span', 'locale__blurb');
  blurb.textContent = locale.blurb;

  /*
   * The palette swatch. Stage V1. Three blocks, deep, mid and glow, drawn
   * from the card's own locale tokens (`theme/locales.css` declares each
   * palette on the card class as well as on the page). A fact about the
   * region, the same size on every card, and no more of one than a type chip.
   */
  const swatch = el('span', 'locale__swatch');
  swatch.setAttribute('aria-hidden', 'true');
  for (const tone of ['deep', 'mid', 'glow']) swatch.append(el('span', `locale__swatch-${tone}`));

  card.append(name, types, blurb, swatch);
  card.addEventListener('click', onPick);
  return card;
}
