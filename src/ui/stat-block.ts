/**
 * The six stats, drawn by one component. **Milestone M3.2, discrepancy D20.**
 *
 * Section 5 of the design bible canonises one — *"Stat block | Six rows of
 * glyph, bar, number | Party drawer, recipient, capture, pre-gym"* — and
 * closes with the sentence this file exists to satisfy: *"A component that
 * exists twice, or a screen that draws a stat without the stat block, is the
 * defect this document exists to prevent."*
 *
 * The tree had three. `statBlock` was private to `ui/member-card.ts` and drew
 * a two-column grid; `statLine` was exported from `ui/screens/starter-select.ts`
 * and drew a row of six cells for the pick screens; and M3.1 added a third in
 * the inspect layer, because the first took a `SpecCard` and a `PokemonState`
 * and the panel had neither. Each carried its own copy of the bar ceiling.
 *
 * **The two layouts were never two components.** In Pocket the stylesheet
 * already turned `.stats` into the same six-column row `.statline` drew in
 * every mode; the only real difference was Detailed and Simple, where a wide
 * card wants two columns and a narrow pick card wants six. That is a modifier
 * class, so this takes one — and the six numbers are the whole input, which is
 * what lets the inspect layer mount it from a serialized string.
 *
 * ## The glyph, and why the words are still in the DOM
 *
 * Section 3's Six stats row is *"Glyph, bar, number. Always all six."* R2
 * forbids the label at rest and the census counts `HP`, `Atk` and `SpA` as
 * words for that reason. So the mark from M1.1's sheet is the encoding.
 *
 * Both word forms stay in the DOM and the stylesheet hides them in Pocket,
 * which is D16's ruling and the shape `ui/chip.ts`'s `wordForm` already takes
 * for the type chip: Detailed and Simple keep their labelled face until M6.4
 * rules on them with M7.1's evidence, and a density change stays a stylesheet
 * change rather than a re-render.
 *
 * ## Numbers, at rest, and no bar
 *
 * **Bible Rev 20, R13, D81 and D82.** The stats are vital information: on the
 * face, as numbers, on every call site, never behind a fold or a press. The
 * bar is retired (*"bars suck. replace bars with the stat numbers proper"*),
 * so a cell is the mark and the number and nothing else. The starter detail
 * panel's `numbers` option (D79) is gone with it, because every call site is
 * that call site now.
 *
 * ## What it does not do
 *
 * No sort, no conditional emphasis, no total, no marker on the largest number.
 * R10: *"Bars compare members, never options"*, and its worked example is this
 * component — *"Emphasising the stat that matches the current decision is a
 * verdict."* Every caller gets the same six rows in the same order, and the
 * order is `STAT_ORDER`, which is Showdown's, so a number a player learns here
 * is in the place they will look for it during a fight.
 */
import { STAT_ORDER, statInfo } from '../data/statInfo';
import { el } from './dom';
import { glyphNode } from './theme/glyph';

/** The six numbers, keyed as `STAT_ORDER` spells them. HP is max HP. */
export type StatValues = Readonly<Record<string, number>>;

export interface StatBlockOptions {
  /**
   * `grid` is the two-column card layout; `row` is the six-across pick card.
   *
   * A modifier rather than a second component: Pocket has drawn both as the
   * same six-column row since the density patch, so the difference is two
   * modes' worth of stylesheet and nothing about what a stat is.
   */
  layout?: 'grid' | 'row';
  /**
   * A `data-tutorial` anchor for the coach marks, when this instance is the
   * one they point at. Carried as an option rather than set by every caller
   * so the mark keeps resolving to exactly one element.
   */
  tutorial?: string;
  /**
   * The swap's stat change. **Bible Rev 20, D84.** The incoming Pokemon's six
   * numbers, on a member card the capture offer would release: each cell
   * carries `incoming - value` beside its own number, signed, green up and
   * red down, zero rendering nothing. All six, on every member card, never
   * one: R10's permit, and the colour says the sign again, never who to drop.
   */
  against?: StatValues;
}

/**
 * Six rows of glyph, bar and number, always all six, in `STAT_ORDER`.
 *
 * `values` is the whole input. A caller with a `PokemonState` spreads its
 * base stats and its max HP; the inspect layer parses a serialized string.
 * Neither can hand this component something it would have to derive, which is
 * what keeps it from becoming a second source of truth about a Pokemon.
 */
export function statBlock(values: StatValues, options: StatBlockOptions = {}): HTMLElement {
  const root = el('div', `stats stats--${options.layout ?? 'grid'}`);
  if (options.tutorial) root.dataset['tutorial'] = options.tutorial;

  for (const stat of STAT_ORDER) {
    const value = values[stat] ?? 0;
    const info = statInfo(stat);
    const row = el('div', 'stat');
    // `data-row`, not `data-stat`: the stylesheet spans `.stat[data-row="hp"]`
    // across the grid, and this block pairs its rows.
    row.dataset['row'] = stat;

    /*
     * The label: the mark, then both word forms.
     *
     * The mark carries the accessible name and the words do not, for the
     * reason `typeChip` gives — once Pocket hides the words the glyph is the
     * only thing naming the stat, and labelling the container instead would
     * announce it twice in the modes that still render a word.
     *
     * The trigger stays on the label rather than moving to the mark, so the
     * tap target is the same size it has been since the density patch, and
     * the value rides on it so the tooltip can print the number in the mode
     * where the row is a bar.
     */
    const label = el('span', 'stat__label');
    const mark = glyphNode(`stat-${stat}`, { label: info?.label ?? stat.toUpperCase() });
    if (mark) label.append(mark);
    const long = el('span', 'stat__label-long');
    long.textContent = info?.label ?? stat.toUpperCase();
    const short = el('span', 'stat__label-short');
    short.textContent = info?.abbreviation ?? stat.toUpperCase();
    label.append(long, short);
    label.dataset['tip'] = `stat:${stat}`;
    label.dataset['value'] = String(value);
    label.tabIndex = 0;
    label.setAttribute('role', 'button');

    // The number, at rest (R13). The bar it sat beside is retired (D82).
    const number = el('span', 'stat__value');
    number.textContent = String(value);
    row.append(label, number);

    if (options.against) {
      const change = (options.against[stat] ?? 0) - value;
      if (change !== 0) {
        const delta = el('span', `stat__delta stat__delta--${change > 0 ? 'up' : 'down'}`);
        delta.textContent = change > 0 ? `+${change}` : `\u2212${-change}`;
        delta.setAttribute('aria-label', `${info?.label ?? stat} ${change > 0 ? 'rises' : 'falls'} by ${Math.abs(change)}`);
        row.dataset['change'] = change > 0 ? 'up' : 'down';
        row.append(delta);
      }
    }
    root.append(row);
  }
  return root;
}
