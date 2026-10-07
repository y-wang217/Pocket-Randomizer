/**
 * The node band. **The map calm-down patch, bible Rev 30, D109** (section 5's
 * *Node band* row).
 *
 * A thin band at the head of a node screen (battle, shop, event, pre-gym), in
 * the kind's colour token, with the kind's silhouette and the locale's name,
 * so the map node, its vignette and its screen read as one thing. Nothing
 * else: no kind word, which beside its silhouette would be R3's double
 * render, and no fact the screen does not already carry. The battle header's
 * kind mark lives here since D109. Rest has no screen and wears no band.
 *
 * One component, mounted by `ui/app.ts` on each screen it shows for a node,
 * so the band sits in the same slot on every screen (R1).
 */
import type { LocaleId } from '../data/locales';
import { localeById } from '../data/locales';
import { NODE_KIND_WORDS } from '../data/glyphLabels';
import type { NodeKind } from '../data/tuning';
import { nodeSilhouette } from './chip';
import { el } from './dom';

/**
 * Put the band at the head of `screen`, or redraw the one already there, for
 * a node of `kind` in `locale`.
 */
export function mountNodeBand(screen: HTMLElement, kind: NodeKind, locale: LocaleId | null): HTMLElement {
  let band = screen.querySelector<HTMLElement>(':scope > .node-band');
  if (!band) {
    band = el('div', 'node-band');
    screen.prepend(band);
  }
  band.dataset['kind'] = kind;
  const place = el('span', 'node-band__locale');
  // A proper noun: the region's name, which section 4's budget does not count.
  place.textContent = locale ? localeById(locale).name : '';
  band.replaceChildren(nodeSilhouette(kind, NODE_KIND_WORDS[kind] ?? kind), place);
  return band;
}
