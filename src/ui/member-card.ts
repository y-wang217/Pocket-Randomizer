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
import type { Tuning } from '../data/tuning';
import { createBar } from './bar';
import { moveCardData } from './move-detail';
import { statBlock } from './stat-block';
import { collapsible } from './collapse';
import { el, levelText, moveCard } from './scene';
import { abilityChip, monTypeChip, statusChip } from './chip';
import { itemIcon, slotNumber } from './slots';
import { spriteFigure } from './sprites';

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
  /*
   * The level, through the one helper. **M3.2.**
   *
   * Gender next to it because it is the same kind of fact, and via the same
   * function as the battle panel — a Pokemon that read "36 ♀" in a fight and
   * "Lv36" here would look like two Pokemon, which is why nine screens each
   * writing their own level was an R1 problem before it was an R2 one.
   */
  level.textContent = levelText(spec.level, spec.gender);

  // The slot number first, when the card stands for a slot (V2): a position,
  // the same marker the hotbar above it wears.
  if (options.index !== undefined) header.append(slotNumber(options.index));
  /*
   * **The archetype chip is gone. Milestone M3.2, and section 3 decides it.**
   *
   * The encoding table's Archetype row reads *"Not rendered where the stat
   * bars already draw it (4.8.0.3) | Absent | Not on inspect either; it is a
   * derived label and can lie under randomization."* This card draws the bars,
   * in the body below, so the first clause names this card exactly. The
   * milestone asks for the same thing in the same words: *"Remove the
   * archetype label wherever the bars now draw it."*
   *
   * **The chip-audit patch put it back on 2026-09-17 and its argument is
   * answered rather than ignored.** That argument was that a label appearing
   * on four surfaces and not the other six is not a shorthand a player learns.
   * It is right, and M3.2 is the other half of it: the label goes from every
   * surface that draws the bars, in one pass, rather than from the four that
   * happened to have somewhere else to look. What it was a summary of is two
   * lines down, as six numbers. The five surfaces that draw no bars keep it
   * until the item that reaches them — M3.3 the recipient, M5.3 the locale
   * card, M5.4 the capture list, M5.5 the replacement — and the summary is
   * unbudgeted.
   *
   * D18 ruled the harder half of this on the battle panel, where the bars are
   * *not* on the card and deleting the label would have ended the only channel
   * for the fact. Here there is no such question. The bars are right there.
   */
  header.append(name, level, ...spec.types.map(monTypeChip));
  /*
   * **The lead is the slot number, not a chip. M3.2.**
   *
   * `isLead` is `index === 0` at all three call sites and the options table
   * above says so in as many words — *"Slot 0, and nothing else"* — so the
   * chip and the slot marker were one fact in two channels on one surface,
   * which is R3. The marker stays, `party__member--lead` stays for the
   * stylesheet, and the card says which one leads on its accessible name
   * rather than spending a word on every card to mark one of them.
   */
  if (options.isLead) card.setAttribute('aria-label', `${spec.species}, leading`);

  // `.party__ability` keeps its class: the stylesheet positions it and hides it
  // on a collapsed Pocket card, and neither rule is this patch's to move.
  header.append(abilityChip(spec.ability, spec.abilityId, 'party__ability'));

  const bar = createBar();
  bar.set(hpFraction(member));
  const track = bar.root;

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

  // The body, in the card's corner, phased by the slot it stands in. On every
  // surface this card is drawn — the party screen, the drawer, the pre-gym
  // lead choice — because a card without one is the reduced variant the
  // header of this file forbids. Idle-sprites patch.
  card.append(spriteFigure(spec.species, { phase: options.index ?? 0 }), header, track, meta, itemRow(options.holding));

  /*
   * The body: the stat block, the four move cards and the contribution row.
   * **Density modes patch, Part 4.** On screen in Detailed and Simple; in
   * Pocket it is one tap behind the head of the card, all of it together —
   * never the stats without the moves or three cards without the fourth. The
   * head keeps every primary fact: who this is, what it is built for, its
   * types, its HP, its status and what it holds. `ui/collapse.ts` says why
   * this is an expander rather than a tooltip.
   */
  const body: HTMLElement[] = [
    statBlock({ ...spec.baseStatsAtLevel, hp: member.maxHp }),
    moveList(member, spec, options.tuning),
  ];
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

/**
 * The held item, as a sprite in a fixed slot. **Milestone M3.2.**
 *
 * Section 3's Held item row, the same one M3.1 built the battle panel's slot
 * against: *"Item sprite in a fixed slot | Empty slot renders nothing | Name,
 * one effect line."* All three clauses are here, and the sprite is
 * `ui/slots.ts`'s `itemIcon` — the same cell of the same Showdown sheet the
 * party slots, the summary and the battle panel draw, so an item looks the
 * same wherever it is held.
 *
 * **The name and the effect line are not gone; they are what the press
 * opens.** They were a chip reading `Leftovers` and a line reading "Heals
 * 1/16 max HP each turn", which is a name and a sentence at rest on a surface
 * budgeted at zero. The `item:` tip that carried the name to the tooltip
 * before now carries both, through the same layer, from the same
 * `data/items.ts` entry.
 *
 * **The row stays in the DOM when the slot is empty**, because the party
 * screen appends its "to bag" control to it (`screens/party.ts`) and a row
 * that vanished would take the control with it. The *slot* renders nothing,
 * which is what section 3 asks and what R4 means by a default.
 */
function itemRow(holding: ItemId | null): HTMLElement {
  const row = el('div', 'party__item');
  row.dataset['tutorial'] = 'items';
  const entry = holding ? itemById(holding) : null;

  const slot = el('span', 'party__item-slot');
  if (entry) {
    slot.append(itemIcon(entry.id));
    slot.dataset['tip'] = `item:${entry.id}`;
    slot.tabIndex = 0;
    slot.setAttribute('role', 'button');
  } else {
    /*
     * Empty renders nothing at all — no chip, no outline, no `No item`. The
     * absence *is* the encoding, and a card that said so in words would spend
     * two of them on every member holding nothing, which is most of them.
     * The card's own `aria-label` is where a reader who cannot see an empty
     * slot is told, because "nothing" read aloud as nothing is not a readout.
     */
    slot.hidden = true;
    row.dataset['empty'] = 'true';
  }
  row.append(slot);
  return row;
}

/**
 * Four move cards, with their tags. **Part 6, on the party surfaces.**
 *
 * The full card rather than a chip, and **D21a was ruled the other way first.**
 * Section 5's Party row says "four move chips" and M3.2 built them; three
 * separate invariant tests then caught three different fact families going
 * off this surface with the card face:
 *
 *   - the band, by `test/band-badge.test.ts`, which puts `BAND n` on every
 *     move everywhere so an offer can be compared against what a member knows;
 *   - PP, which the ruling itself restored, because "which member is out of
 *     PP" is what this surface is opened for;
 *   - the whole fact strip — accuracy, priority, multi-hit, recoil, drain,
 *     charge, recharge, contact — by `test/visual-move-cards.test.ts`, which
 *     asserts a filled tag row on every surface drawing a held moveset.
 *
 * Restoring all three would have made the chip a card with a different class
 * name, which is worse for section 5 than the row being wrong. So the row is
 * wrong: it was written before M2.3 decided what a chip leaves out, and the
 * chip's own docstring is where that decision lives. The bible's Party row is
 * corrected to "four move cards" rather than this surface being bent to it.
 *
 * Nothing is spent at rest for it. The move card censuses 0 in Pocket since
 * M2.1, and the card's body folds there anyway.
 */
function moveList(
  member: PokemonState,
  spec: ReturnType<typeof describeSpecCard>,
  tuning: Tuning,
): HTMLElement {
  const list = el('div', 'party__moves');
  for (const [index, move] of member.moves.entries()) {
    const facts = spec.moves[index];
    const card = moveCard({
      ...moveCardData(
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
      /*
       * Remaining PP rather than the max, because on a party member the
       * resource has been spent and the max alone would be a number about a
       * different Pokemon.
       *
       * **Handed to the component rather than written over its output.** This
       * used to reach into the finished card and assign `.move__pp`'s
       * `textContent`, which was survivable while PP was one text node. Since
       * M2.1 it is a label, a glyph and two numbers in four spans, and an
       * assignment deletes all four — so the count goes in the way every other
       * field does.
       */
      pp: move.pp,
    });
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
