/**
 * A player-facing string with a short form, both rendered. **Density modes
 * patch, Part 4.**
 *
 * Every string that has a short form renders both spans; the stylesheet shows
 * the long one in Detailed and the short one in Simple and Pocket. Two spans
 * rather than a re-render on mode change, for the reason `theme/density.ts`
 * gives: the mode is a root attribute and nothing has to be redrawn to take
 * it. The hidden span is `display: none`, so a screen reader hears one form.
 */
export interface Prose {
  long: string;
  short: string;
}

export function prose(copy: Prose): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const long = el('span', 'copy__long');
  long.textContent = copy.long;
  const short = el('span', 'copy__short');
  short.textContent = copy.short;
  fragment.append(long, short);
  return fragment;
}

/** Replace an element's text with a two-form string. */
export function setProse(target: HTMLElement, copy: Prose): void {
  target.replaceChildren(prose(copy));
}

/** The one element helper. Lived in scene.ts; re-exported from there still. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}
