/**
 * The party threat readout, in the two places a party-level fact is actionable.
 *
 * One component, two placements. The **party screen** is its home: the player
 * is already there reassigning items between fights, which is the moment a fact
 * about the whole team can be acted on. The **map** carries it collapsed,
 * because the map is where the next node is chosen and that is the decision the
 * readout informs.
 *
 * It is deliberately **not** in a battle. The per-move markers are the agreed
 * in-battle effectiveness surface; a second one mid-fight would duplicate them
 * and compete for the space Item F spent a stage reclaiming.
 *
 * ## What this component may and may not say
 *
 * Part 4 of Stage 4.5.1 governs it and this is the closest thing in the game to
 * advice, so the line is worth restating where it is easiest to cross:
 *
 *   - The order is `partyThreats`' order, which is the canonical dex order.
 *     This file does not sort. Sorting by `membersHit` — or colouring a 4x
 *     differently from a 2x — would be the UI ranking the player's problems,
 *     which is a verdict wearing a fact's clothes.
 *   - No severity colour. Every chip is the type's own colour, the same one it
 *     wears everywhere else in the game, so a Fire chip here reads as *Fire*
 *     and not as *bad*.
 *   - No count of the list. "Three unanswered types" is a score.
 *   - Nothing about the upcoming gym, this segment, or any encounter. The
 *     component is handed a party and calls a function that takes a party.
 *     There is no state parameter for a leader's type to arrive through.
 *   - No suggestion about what to do. The player decides whether Ground is
 *     worth a species swap.
 *
 * Every string comes from `core/typeMatchup.ts`, which is item G's rule: one
 * file to change a wording, and two screens rendering this is exactly the count
 * at which a sentence written inline starts to drift.
 *
 * ## Density
 *
 * Simple shows the type list. Detailed adds `hits 3 of 4, unanswered` per type.
 * Presentation only — the mode is a root attribute the stylesheet reads, and
 * `partyThreats` has no idea it exists. `test/density.test.ts` greps
 * `src/core/` for any mention of it, so the split is enforced rather than
 * intended.
 */
import { partyThreats, threatDetail, threatDetailLine, threatLine, THREAT_EXPLAINER, THREAT_TITLE, type ThreatEntry } from '../../core/typeMatchup';
import type { PokemonState } from '../../core/types';
import { el } from '../scene';
import { typeChip } from './starter-select';

export interface ThreatReadout {
  root: HTMLElement;
  /** Redraw from the party alone. There is no second argument, on purpose. */
  render(party: readonly PokemonState[]): void;
}

export interface ThreatOptions {
  /**
   * Render behind a disclosure the player opens, rather than open.
   *
   * True on the map, where the offered node cards are the urgent thing on the
   * screen and Item F measured what it costs to push them down. False on the
   * party screen, where this *is* one of the things the player came for.
   *
   * A `<details>` rather than a hand-rolled toggle: it is keyboard operable,
   * it announces its own state, and its open/closed state survives the map's
   * re-render because the element is moved rather than rebuilt.
   */
  collapsed?: boolean;
}

export function createThreatReadout(options: ThreatOptions = {}): ThreatReadout {
  const collapsed = options.collapsed ?? false;

  const root = el(collapsed ? 'details' : 'section', 'threats');
  const body = el('div', 'threats__body');

  if (collapsed) {
    const summary = document.createElement('summary');
    summary.className = 'threats__summary';
    summary.textContent = THREAT_TITLE;
    root.append(summary, body);
  } else {
    const heading = el('h3', 'threats__title');
    heading.textContent = THREAT_TITLE;
    // The explainer on the title's tip: Pocket hides the paragraph under the
    // list and the title says it. The same `threat:` tip a chip carries, with
    // the sentence on the trigger. Density modes patch.
    heading.dataset['tip'] = 'threat:about';
    heading.dataset['detail'] = THREAT_EXPLAINER;
    heading.tabIndex = 0;
    heading.setAttribute('role', 'button');
    root.append(heading, body);
  }

  const explainer = el('p', 'threats__explainer');
  explainer.textContent = THREAT_EXPLAINER;

  return {
    root,
    render(party) {
      const threats = partyThreats(party);

      /*
       * The whole list as one sentence, for a screen reader.
       *
       * The visible rendering is chips, which read as a pile of disconnected
       * type names out of context. `threatLine` is the same information as a
       * sentence, and it is the same function the copy tests assert on — so the
       * spoken readout cannot drift from the printed one.
       */
      root.setAttribute('aria-label', threatLine(threats));

      if (threats.length === 0) {
        const none = el('p', 'threats__none');
        none.textContent = threatLine(threats);
        body.replaceChildren(none, explainer);
        return;
      }

      const list = el('ul', 'threats__list');
      list.replaceChildren(...threats.map((entry) => renderThreat(entry)));
      body.replaceChildren(list, explainer);
    },
  };
}

/**
 * One type, as the badge it wears everywhere else plus how many members it
 * reaches.
 *
 * The `aria-label` carries the detailed reading in **both** modes. Simple is a
 * choice about density on a small screen, and a screen reader has no density
 * problem; the count is the part that says whether a listed type is one
 * member's problem or the whole team's, and withholding it from the spoken
 * version would make Simple a different readout rather than a shorter one.
 *
 * **The count is always rendered from 4.7.2, and `[data-density]` decides
 * whether it shows.** It used to take a `detailed` flag and omit the span in
 * Simple, which meant a toggle could only reach this list by re-rendering it —
 * and the map is one of exactly two screens the old subscription redrew. The
 * span is cheap, the aria-label already said the same thing in both modes, and
 * a mode that is a CSS concern is a mode that reaches a list already on screen.
 * See `ui/theme/density.ts`.
 */
function renderThreat(entry: ThreatEntry): HTMLElement {
  const item = el('li', 'threats__item');
  item.setAttribute('aria-label', threatDetailLine(entry));
  /*
   * The chip carries the count for the tooltip layer. **Density modes patch.**
   * Pocket hides the count beside the chip and a tap on the chip says it:
   * the same sentence the `aria-label` speaks, from `core/typeMatchup.ts`,
   * carried on the trigger rather than looked up, because the count is a
   * fact about this party and this render and not a table entry.
   */
  const chip = typeChip(entry.type);
  chip.dataset['tip'] = `threat:${entry.type}`;
  chip.dataset['detail'] = threatDetailLine(entry);
  chip.tabIndex = 0;
  chip.setAttribute('role', 'button');
  item.append(chip);

  const count = el('span', 'threats__count');
  count.textContent = threatDetail(entry);
  item.append(count);

  return item;
}
