/**
 * A row that folds in Pocket. **Density modes patch, Part 4.**
 *
 * The one primitive behind every "secondary facts cost one tap" on a surface
 * that is a list of rows: the member card's body (stats, moves, contribution),
 * a backpack row's effect line and controls, a relic row's description. The
 * host keeps its head on screen in every mode; the body is on screen in
 * Detailed and Simple and behind this toggle in Pocket.
 *
 * ## Uniform, by construction
 *
 * The prompt's rule is that peers collapse together or not at all — never two
 * stats promoted and four demoted, never one card open and five folded by
 * default. This helper has no per-row switch: whether the body is folded is
 * the mode's decision (`:root[data-density="pocket"]` in the stylesheet) and
 * applies to every host at once. What a tap changes is one host's
 * `data-expanded`, which is the player's decision about one row, made after
 * the fold and never by the layout.
 *
 * ## The same mechanism as the move explanation
 *
 * 4.7.2's expander on a move card is a region inside the card toggled by a
 * control that stops its event — a tap on it never reaches whatever the card
 * sits in. This is that shape again rather than the tooltip layer, because a
 * card body is a block of rows and the tooltip is a floating panel sized for a
 * sentence. Both cost one tap, which is the definition's price.
 *
 * Nothing here reads or writes run state: the toggle flips an attribute on an
 * element and stops there.
 */
import { el } from './dom';

/**
 * The toggle's face and its spoken name. A glyph on the face, because the
 * control sits on a card's meta line beside the HP, the status and the item
 * and a word there wraps the line on a 390 phone; the words are the
 * `aria-label`, so a screen reader hears "Snorlax: more".
 */
const SHOW_GLYPH = '+';
const HIDE_GLYPH = '−';
const SHOW = 'more';
const HIDE = 'less';

export interface Collapsible {
  /** The control, for the host to place where its row wants it. */
  toggle: HTMLButtonElement;
  /** The wrapper the body was moved into. */
  body: HTMLElement;
}

/**
 * Make `host` foldable in Pocket: `parts` are moved into a body wrapper
 * appended to the host, and a toggle is returned for the host to place.
 *
 * `label` names the row for a screen reader ("Snorlax: more"), because a
 * screen of six identical "More" buttons is six controls with one name.
 */
export function collapsible(host: HTMLElement, parts: readonly HTMLElement[], label: string): Collapsible {
  const body = el('div', 'collapse__body');
  body.append(...parts);
  host.dataset['collapsible'] = 'true';
  host.append(body);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'button button--small collapse__toggle';
  const paint = (): void => {
    const open = host.dataset['expanded'] === 'true';
    toggle.textContent = open ? HIDE_GLYPH : SHOW_GLYPH;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', `${label}: ${open ? HIDE : SHOW}`);
  };
  toggle.addEventListener('click', (event) => {
    // Never the row's own click, and never a submission: the same rule the
    // move explanation's trigger states, for the same reason.
    event.preventDefault();
    event.stopPropagation();
    host.dataset['expanded'] = host.dataset['expanded'] === 'true' ? 'false' : 'true';
    paint();
  });
  paint();
  return { toggle, body };
}
