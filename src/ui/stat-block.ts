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
 * ## Numbers, at rest, and a bar against the band
 *
 * **Bible Rev 20, R13, D81 and D82.** The stats are vital information: on the
 * face, as numbers, on every call site, never behind a fold or a press. The
 * bar drawn against a flat ceiling was retired (*"bars suck"*).
 *
 * **Bible Rev 21, D88 (Stage 5.1).** The bar is back beside the number, and
 * its scale is the **band**: the lowest and highest value that stat takes at
 * this Pokemon's level across the species pool (`statBandAt`). Empty at the
 * floor, full at the ceiling, so a Munchlax with near the most HP a level-15
 * Pokemon can have reads as a nearly full bar, where the old ceiling of 200
 * drew every early-game stat as a stub. The number is never replaced by it.
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
import { statBandAt, type StatBand } from '../core/battle/driver';
import { STAT_ORDER, statInfo } from '../data/statInfo';
import { el } from './dom';
import { glyphNode } from './theme/glyph';
import { GLYPH_LABELS } from '../data/glyphLabels';

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
  /**
   * The Pokemon's level, which picks the band each bar is measured against.
   * **Bible Rev 21, D88.** Every call site that knows whose stats these are
   * passes it; without one the cell is the glyph and the number alone.
   */
  level?: number;
  /**
   * The battle's stat stages, per stat, on the player's panel. **Bible Rev 23,
   * D98.** A cell with a stage draws the stat as the stage makes it, with the
   * signed stage count beneath, and `data-stage` up or down colours both. The
   * base number, the multiplier and the count ride on the label's press.
   * Absent everywhere but the battle panel, and a zero stage draws nothing
   * (R4).
   */
  stages?: Readonly<Record<string, { stage: number; effective: number; multiplier: string }>>;
  /**
   * The engine's Speed under a defender run's Flying badge. **Bible Rev 25,
   * D100, extending D98**: the Speed cell shows this number, with the wing
   * beneath it in place of a stage count when there is no stage.
   */
  badgeSpeed?: number;
}

/**
 * Where a value sits in its band, 0 at the floor and 1 at the ceiling.
 * Clamped, so a number off the band's edge draws an empty or a full bar
 * rather than one that leaves its track.
 */
export function bandFraction(value: number, range: { min: number; max: number }): number {
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.max <= range.min) return 1;
  return Math.max(0, Math.min(1, (value - range.min) / (range.max - range.min)));
}

/**
 * Six cells of glyph, number and band bar, always all six, in `STAT_ORDER`.
 *
 * `values` is the whole input. A caller with a `PokemonState` spreads its
 * base stats and its max HP; the inspect layer parses a serialized string.
 * Neither can hand this component something it would have to derive, which is
 * what keeps it from becoming a second source of truth about a Pokemon.
 */
export function statBlock(values: StatValues, options: StatBlockOptions = {}): HTMLElement {
  const root = el('div', `stats stats--${options.layout ?? 'grid'}`);
  if (options.tutorial) root.dataset['tutorial'] = options.tutorial;
  const band: StatBand | null = options.level === undefined ? null : statBandAt(options.level);
  if (options.level !== undefined) root.dataset['level'] = String(options.level);

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

    // The number, at rest (R13). On a staged cell, the stat as it stands
    // (D98): the number the fight is using.
    const staged = options.stages?.[stat];
    const badged = stat === 'spe' && options.badgeSpeed !== undefined && !(staged && staged.stage !== 0);
    const shown = staged && staged.stage !== 0 ? staged.effective : badged ? (options.badgeSpeed ?? value) : value;
    const number = el('span', 'stat__value');
    number.textContent = String(shown);
    row.append(label, number);
    if (badged) {
      const wing = glyphNode('badge-wing', { label: GLYPH_LABELS['badge-wing'] ?? '' });
      if (wing) {
        wing.dataset['tip'] = 'badge:Flying';
        const holder = el('span', 'stat__stage stat__stage--badge');
        holder.append(wing);
        row.append(holder);
      }
      label.dataset['value'] = String(shown);
      label.dataset['base'] = String(value);
    }
    if (staged && staged.stage !== 0) {
      const up = staged.stage > 0;
      row.dataset['stage'] = up ? 'up' : 'down';
      const count = el('span', `stat__stage stat__stage--${up ? 'up' : 'down'}`);
      count.textContent = up ? `+${staged.stage}` : `\u2212${-staged.stage}`;
      count.setAttribute('aria-label', `${info?.label ?? stat} stage ${up ? '+' : '-'}${Math.abs(staged.stage)}, ${staged.multiplier}`);
      row.append(count);
      label.dataset['value'] = String(staged.effective);
      label.dataset['base'] = String(value);
      label.dataset['stage'] = up ? `+${staged.stage}` : `-${-staged.stage}`;
      label.dataset['multiplier'] = staged.multiplier;
    }

    /*
     * The bar against the band (D88). Decorative to a reader, because the
     * number beside it is the fact and the band is on the label's press;
     * the range rides on the label for that press.
     */
    const range = band?.[stat as keyof StatBand];
    if (range) {
      const fraction = bandFraction(shown, range);
      const bar = el('span', 'stat__bar');
      bar.setAttribute('aria-hidden', 'true');
      const fill = el('span', 'stat__bar-fill');
      fill.style.width = `${Math.round(fraction * 1000) / 10}%`;
      bar.append(fill);
      row.dataset['fraction'] = fraction.toFixed(3);
      label.dataset['band'] = `${range.min}-${range.max}`;
      label.dataset['level'] = String(options.level);
      row.append(bar);
    }

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
