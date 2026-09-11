/**
 * One party member, drawn the same way everywhere.
 *
 * Stage 4.7, Part 1. The drawer and the party management screen show the same
 * card, and the brief is explicit about why: **do not build a reduced variant.**
 * A reduced variant is where a verdict gets smuggled in as an emphasis choice —
 * whoever decides which three of the six stats matter enough to survive a
 * shorter card has made a judgement the player was supposed to make.
 *
 * So the *contents* are fixed and identical on every surface: level, gender,
 * types, the archetype label, current and max HP, PP, status, held item and its
 * effect line, the six stat block, and four move cards with their tags. What
 * varies is whether the card carries **actions**, because the drawer is
 * read-only and the party screen is the one write path for party state.
 *
 * That is not a reduced variant. Nothing is hidden on the drawer's card; the
 * buttons that would change state are simply not there, which is what read-only
 * means.
 */
import { describeSpecCard } from '../core/battle/driver';
import { FAINTED, hpState, ppState } from '../core/hpCopy';
import { hpFraction, ppTotals } from '../core/party';
import type { ItemId, PokemonState } from '../core/types';
import { itemById } from '../data/items';
import { statInfo, STAT_ORDER } from '../data/statInfo';
import type { Tuning } from '../data/tuning';
import { collapsible } from './collapse';
import { el, genderMark, moveCard } from './scene';
import { moveCardData } from './move-detail';
import { archetypeChip } from './archetype-chip';
import { neutralChip, statusChip, typeChip } from './chip';
import { slotNumber } from './slots';

export interface MemberCardOptions {
  /** What this member is holding once a pending item plan is applied. */
  holding: ItemId | null;
  tuning: Tuning;
  /** Marks the card as the run's current lead. Slot 0, and nothing else. */
  isLead?: boolean;
  /**
   * The card's position in the collection it stands in, 0-based, when it
   * stands in one. Stage V2: the header then opens with the slot number the
   * hotbar wears, and `data-slot` carries it. A position, never a rank.
   */
  index?: number;
  /**
   * A running contribution readout, or nothing. **Stage 4.7, Part 5.**
   *
   * Off by default because most surfaces do not want it, and a *fact about
   * what already happened* is an attribute rather than a verdict — see the
   * Part 4 amendment. What is not allowed, and is not done anywhere: labelling
   * a member as underperforming, marking a swap candidate, sorting a party by
   * it, or projecting it forward onto a fight that has not happened.
   */
  contribution?: 'run' | 'segment' | null;
}

/**
 * The card's contents, with no actions attached.
 *
 * The party screen appends its own buttons; the drawer appends nothing. Both
 * get this.
 */
export function memberCardContents(
  member: PokemonState,
  options: MemberCardOptions,
): HTMLElement {
  const card = el('div', 'party__member');
  if (options.isLead) card.classList.add('party__member--lead');
  if (member.fainted) card.classList.add('party__member--fainted');

  const spec = describeSpecCard(member.spec);

  const header = el('div', 'panel__header');
  const name = el('span', 'panel__name');
  // The species, on every card. **4.8.0.1.** 4.8 put the nickname here; the
  // ruling on 4.8.0.1's report is that species is the identity and the name is
  // state the card does not show. `SpecCard.name` is still the battle name.
  name.textContent = spec.species;

  const level = el('span', 'panel__level');
  // Gender next to the level, exactly as the battle panel prints it and via the
  // same function — a Pokemon that read "Lv30 ♀" in a fight and "Lv30" here
  // would look like two Pokemon.
  level.textContent = `Lv${spec.level}${genderMark(spec.gender)}`;

  /*
   * The archetype chip. **Part 7, and the same chip the battle panels carry.**
   *
   * Computed here rather than handed in, because outside a battle there is no
   * projection to carry it and `archetypeOf` is a pure function of base stats
   * the adapter already returned. This file is not the battle UI, so it is not
   * under the rule that keeps `scene.ts` on the projection.
   */
  // The slot number first, when the card stands for a slot (V2): a position,
  // the same marker the hotbar above it wears.
  if (options.index !== undefined) header.append(slotNumber(options.index));
  header.append(name, level, archetypeChip(spec.baseStats), ...spec.types.map((type) => typeChip(type)));
  if (options.isLead) header.append(neutralChip('Lead', 'lead'));

  const ability = el('span', 'party__ability');
  ability.textContent = spec.ability;
  ability.dataset['tip'] = `ability:${spec.abilityId}`;
  header.append(ability);

  const track = el('div', 'hp');
  const fill = el('div', 'hp__fill');
  const fraction = hpFraction(member);
  fill.style.width = `${fraction * 100}%`;
  fill.dataset['band'] = fraction > 0.5 ? 'high' : fraction > 0.2 ? 'mid' : 'low';
  track.append(fill);

  const meta = el('div', 'panel__meta');
  const hp = el('span', 'panel__hp-text');
  const pp = ppTotals(member);
  hp.textContent = member.fainted
    ? `${FAINTED} · ${ppState(pp.pp, pp.maxPp)}`
    : `${hpState(member.hp, member.maxHp)} · ${ppState(pp.pp, pp.maxPp)}`;
  if (member.fainted) hp.dataset['fainted'] = 'true';
  hpTip(track, hp.textContent);
  meta.append(hp);

  if (member.status) meta.append(statusChip(member.status, undefined, { tip: `status:${member.status}` }));

  card.append(header, track, meta, itemRow(options.holding));

  /*
   * The body: the stat block, the four move cards and the contribution row.
   * **Density modes patch, Part 4.** On screen in Detailed and Simple; in
   * Pocket it is one tap behind the head of the card, all of it together —
   * never the stats without the moves or three cards without the fourth. The
   * head keeps every primary fact: who this is, what it is built for, its
   * types, its HP, its status and what it holds. `ui/collapse.ts` says why
   * this is an expander rather than a tooltip.
   */
  const body: HTMLElement[] = [statBlock(spec, member), moveList(member, spec, options.tuning)];
  if (options.contribution) body.push(contributionRow(member));
  const fold = collapsible(card, body, spec.species);
  fold.toggle.classList.add('party__member-toggle');
  meta.append(fold.toggle);

  card.dataset['slot'] = options.index === undefined ? '' : String(options.index);
  return card;
}

/**
 * The bar carries its own number. **Density modes patch, Part 4.**
 *
 * In Pocket a member card's HP line is off screen and the bar is the readout,
 * the same rule the stat block follows there (bars on screen, the number one
 * tap away on the row). The text goes onto the track as `data-value` and the
 * `hp:` tip says it back verbatim, so the tap prints exactly the line Detailed
 * prints, PP included. The stylesheet pads the 4px track out to a tappable
 * height in Pocket; in the other two modes the tip is a harmless second way
 * to read a line that is already on screen. A fainted member keeps the word
 * on screen in every mode (`data-fainted`), because an empty bar and a bar at
 * one hit point look the same at 4px.
 */
export function hpTip(track: HTMLElement, text: string): void {
  track.dataset['tip'] = 'hp:member';
  track.dataset['value'] = text;
  track.tabIndex = 0;
  track.setAttribute('role', 'button');
  track.setAttribute('aria-label', text);
}

/** The held item and its effect line, read-only. */
function itemRow(holding: ItemId | null): HTMLElement {
  const row = el('div', 'party__item');
  row.dataset['tutorial'] = 'items';
  const entry = holding ? itemById(holding) : null;
  const chip = entry ? neutralChip(entry.name, 'item', { tip: `item:${entry.id}` }) : neutralChip('No item', 'item', { extra: 'badge--muted' });
  row.append(chip);

  if (entry) {
    // The plain-language effect line, from `data/items.ts` rather than written
    // here — the same string the reward card shows, so an item reads the same
    // wherever it appears.
    const effect = el('span', 'party__item-effect');
    effect.textContent = entry.blurb;
    row.append(effect);
  }
  return row;
}

/**
 * The six-stat block, with the same labels and tooltips as the battle panel.
 *
 * A copy of the party screen's block rather than a call into it, because that
 * one is a module-private function on a screen; this file is now the shared
 * component and the party screen calls *here*. See that screen's own note on
 * why it reuses the battle screen's vocabulary rather than its component.
 */
function statBlock(spec: ReturnType<typeof describeSpecCard>, member: PokemonState): HTMLElement {
  const root = el('div', 'stats stats--party');
  const values: Record<string, number> = { ...spec.baseStatsAtLevel, hp: member.maxHp };

  for (const stat of STAT_ORDER) {
    const row = el('div', 'stat');
    row.dataset['stat'] = stat;
    /*
     * The label, in both of its forms. **Density modes patch, Part 4.**
     * Detailed prints the full name and Simple the abbreviation; both are
     * rendered and the stylesheet shows one, the same way every two-form
     * string on a screen is drawn (`ui/dom.ts`, `prose`). In Pocket the row
     * is a bar and the number is one tap away: the label carries the value
     * so the stat tooltip can say it.
     */
    const info = statInfo(stat);
    const label = el('span', 'stat__label');
    const long = el('span', 'stat__label-long');
    long.textContent = info?.label ?? stat.toUpperCase();
    const short = el('span', 'stat__label-short');
    short.textContent = info?.abbreviation ?? stat.toUpperCase();
    label.append(long, short);
    label.dataset['tip'] = `stat:${stat}`;
    label.dataset['value'] = String(values[stat] ?? 0);
    label.tabIndex = 0;
    label.setAttribute('role', 'button');

    /*
     * **Both, always, in every mode. Patch 4.7.2, ruling 3; three modes since
     * the density patch.**
     *
     * This used to swap them by `hidden` off `showsNumbers()`, which made
     * the modes mutually exclusive in the component. It renders the whole
     * readout — the number and the bar — and `[data-density]` on the root
     * decides what is shown: the number in Detailed and Simple, the bar in
     * Pocket. That is what lets a mode change reach a card that is already
     * on screen without anything re-rendering it. See `ui/theme/density.ts`.
     */
    const value = el('span', 'stat__value');
    value.textContent = String(values[stat] ?? 0);

    const bar = el('span', 'stat__bar');
    const barFill = el('span', 'stat__bar-fill');
    const magnitude = values[stat] ?? 0;
    barFill.style.width = `${Math.min(100, (magnitude / STAT_BAR_CEILING) * 100)}%`;
    bar.append(barFill);

    row.append(label, value, bar);
    root.append(row);
  }
  return root;
}

/** The same ceiling the battle panel's bars use, so the two read alike. */
const STAT_BAR_CEILING = 200;

/**
 * Four move cards, with their tags. **Part 6, on the party surfaces.**
 *
 * The full card rather than the name-and-PP line the party screen used to
 * print, because the brief's list of contents says "the four move cards with
 * their tags" and a member's moveset is most of what a decision about that
 * member is made on.
 *
 * The holder is passed, so STAB renders here: these cards *are* attached to a
 * specific Pokemon, which is the condition Part 6b puts on the tag.
 */
function moveList(
  member: PokemonState,
  spec: ReturnType<typeof describeSpecCard>,
  tuning: Tuning,
): HTMLElement {
  const list = el('div', 'party__moves');
  for (const [index, move] of member.moves.entries()) {
    const facts = spec.moves[index];
    const card = moveCard(
      moveCardData(
        {
          name: move.name,
          type: facts?.type ?? 'Normal',
          category: facts?.category ?? 'Physical',
          basePower: facts?.basePower ?? 0,
          maxPp: move.maxPp,
        },
        tuning,
        { types: spec.types },
      ),
    );
    // Remaining PP rather than the max, because on a party member the resource
    // has been spent and the max alone would be a number about a different
    // Pokemon.
    const pp = card.querySelector('.move__pp');
    if (pp instanceof HTMLElement) {
      pp.textContent = `PP ${move.pp}/${move.maxPp}`;
      if (move.maxPp > 0 && move.pp / move.maxPp <= 0.25) pp.classList.add('move__pp--low');
    }
    list.append(card);
  }
  return list;
}

/**
 * What this member has done, so far, in raw counts. **Part 5.**
 *
 * **A factual readout of what has already happened is an attribute, not a
 * verdict**, which is the Part 4 amendment this feature needed. Past
 * contribution is allowed here. What is not, and is nowhere in this codebase:
 * calling a member underperforming, marking a bench or swap candidate, sorting
 * a party by contribution, or projecting it forward onto an upcoming fight.
 * History is a fact; a prediction dressed as a fact is a verdict.
 *
 * Raw counts, never a percentage and never a composite score. A share would be
 * a fact about a denominator this row has not agreed on with the reader.
 */
function contributionRow(member: PokemonState): HTMLElement {
  const row = el('div', 'party__contribution');
  const counters = member.contribution;
  const entries: [string, number][] = [
    ['Dealt', counters.damageDealt],
    ['Taken', counters.damageTaken],
    ['KOs', counters.kos],
    ['Faints', counters.faints],
    ['Turns', counters.turnsOnField],
  ];
  for (const [label, value] of entries) {
    const cell = el('span', 'party__contribution-cell');
    const name = el('span', 'party__contribution-label');
    name.textContent = label;
    const count = el('span', 'party__contribution-value');
    count.textContent = String(value);
    cell.append(name, count);
    row.append(cell);
  }
  return row;
}
