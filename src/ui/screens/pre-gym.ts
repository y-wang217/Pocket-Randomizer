/**
 * The screen between the last node of a segment and the gym battle.
 *
 * Stage 4.7, Part 2. A gym was previously just another node the player walked
 * into. This gives it a beat, and gives it the one decision that belongs there.
 *
 * ## What it is not
 *
 * **Not a node.** It consumes no step from the node budget, carries no tier,
 * grants no reward, and consumes no RNG. `test/lead-selection.test.ts` asserts
 * all four headlessly; this file is the screen.
 *
 * ## The decision
 *
 * Which party member leads the gym battle. It is a *party reorder* rather than
 * a battle flag — `core/party.setLead` moves the chosen member to slot 0 and
 * `battleMembersFor` sends the party in order — so there is one source of truth
 * for who leads and it is the same one the party screen's drag order writes to.
 *
 * ## Part 4, and this is the screen it matters most on
 *
 * The leader's type is on screen. The party is on screen. **Nothing connects
 * them.** No card is marked, ordered, highlighted, scored or annotated by
 * matchup, and the member cards are rendered in party order rather than in any
 * order this screen chose. Working out the relationship is the decision, and a
 * screen that did it for the player would have removed the only reason it
 * exists.
 *
 * Item assignment is not here either — a link to the party screen instead. A
 * second write path for party state, on the last screen before the hardest
 * fight in the segment, is the worst possible place to put one.
 */
import type { PokemonState, ItemId } from '../../core/types';
import type { GymDefinition } from '../../data/gyms';
import type { Tuning } from '../../data/tuning';
import { el } from '../scene';
import { memberCardContents } from '../member-card';
import { typeChip } from './starter-select';

/**
 * The slot the screen confirms when the player changes nothing.
 *
 * The lowest living slot, which is exactly who `battleMembersFor` would send
 * first — `sendOrder` filters fainted members, so confirming this slot is a
 * reorder the battle would have performed anyway, and never a pick
 * `core/run.chooseLead` refuses. Slot 0 in every ordinary case; the first
 * living member behind it when the party walked out of the last node with its
 * lead down.
 *
 * Exported because the confirm's answer has to be the same answer a headless
 * run gives, and `test/pre-gym-confirm.test.ts` asserts that against a real
 * run rather than against a copy of this rule.
 */
export function defaultLeadSlot(party: readonly PokemonState[]): number {
  const living = party.findIndex((member) => !member.fainted);
  return living === -1 ? 0 : living;
}

export interface PreGymView {
  gym: GymDefinition;
  /** 0-based, so the header can say "gym 4 of 8". */
  segment: number;
  party: readonly PokemonState[];
  holding: readonly (ItemId | null)[];
  tuning: Tuning;
}

export interface PreGymScreen {
  root: HTMLElement;
  render(
    view: PreGymView,
    handlers: {
      /** The chosen slot, handed up to be logged and applied. */
      onLead: (slot: number) => void;
      /** Off to the party screen, where item assignment lives. */
      onManageParty: () => void;
    },
  ): void;
}

export function createPreGymScreen(): PreGymScreen {
  const root = el('section', 'screen screen--pre-gym');

  const heading = el('div', 'pre-gym__header');
  const title = el('h2', 'screen__title');
  /*
   * **The counter is gone, and its coach mark moved up. M5.3.**
   *
   * *"Gym 5 of 8"* was two words for a position the map rail draws as eight
   * numbered pips and the shell carries on every screen. R3 is per surface so
   * it was not a violation; the budget is what it failed.
   *
   * **It carried the `gym-counter` anchor**, and the mark it anchors is about
   * the gym rather than the count — *"A gym is the end of a region"* — so the
   * heading is where it belongs: the leader's name and type chip are this
   * screen's statement of which gym this is. Hiding the element instead of
   * removing it was tried and is wrong twice over: an anchor pointing at
   * nothing is the defect M6.2 hunts, and `hidden` loses to an author
   * `display` rule, which `test/visual-inline-box.test.ts` catches and
   * `ui/overlay.ts` documents three times.
   */
  const leaderType = el('span', 'pre-gym__type');
  leaderType.dataset['tutorial'] = 'gym-type';
  heading.dataset['tutorial'] = 'gym-counter';
  heading.append(title, leaderType);

  const blurb = el('p', 'screen__blurb');

  /*
   * **The `gym-lead` coach mark moved to the members, and it had to.**
   *
   * The prompt carried the anchor, and M5.3 deletes the prompt — so without
   * this the mark would resolve nothing and vanish, which is exactly the
   * failure M6.2 is written to find: *"confirm no mark is silently dropped
   * because its anchor sits behind a tap."* Dropping one because its anchor
   * was **deleted** is the same defect arriving a tier early.
   *
   * The row of member cards is the better anchor anyway: the mark says which
   * member leads, and that is now the thing the player presses.
   */
  const members = el('div', 'pre-gym__party');
  members.dataset['tutorial'] = 'gym-lead';

  /*
   * The confirm, and the reason the screen needs one.
   *
   * Slot 0's own button is inert because slot 0 already leads, so on a party of
   * one *every* button on this screen was disabled and there was no way off it
   * at all. The default being "change nothing" does not submit itself: a screen
   * whose decision has a default still needs the control that commits it.
   *
   * It names the member it sends rather than saying "continue", so the player
   * reads who is going in from the button they press. That is a fact about the
   * party order, not a recommendation about it.
   */
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'button primary-action pre-gym__confirm';

  /*
   * **The route to the party screen stays, at one word. M5.3.**
   *
   * *"Party screen (items)"* was three words and the first plan was to cut it,
   * on the reading that the shell's drawer bar reaches the party from every
   * surface. **It does not.** `drawer.trigger()` opens the *drawer*, which the
   * drawer's own blurb calls read only; items are assigned on the party
   * screen, and the map's `Manage` is the only other way there. From here
   * there is no way back to the map.
   *
   * So cutting this would have removed the last route to handing out held
   * items before a gym — a decision the screen exists to precede, at the
   * moment it matters most. That is not a word budget's business, and C2's
   * principle reaches it even though a route is not a fact: a redesign that
   * makes a decision unreachable has failed however few words it spends.
   *
   * `Items` is what it is for, in one word.
   */
  const manage = document.createElement('button');
  manage.type = 'button';
  manage.className = 'button button--small';
  manage.textContent = 'Items';
  manage.setAttribute('aria-label', 'Party screen, to hold and swap items');

  const actions = el('div', 'pre-gym__actions');
  actions.append(confirm, manage);

  /*
   * **The prompt is gone, and it is the one place this screen deviates from
   * section 4's `words that survive` column.** That column reads *"Gym leader
   * name, type chip, 'Choose lead'"*; what survives here is `Send … in` and
   * `Items`.
   *
   * The budget is 4 and D1 makes it a ceiling, so the count is not the
   * question — the question is which four. *"Who leads?"* introduced a choice
   * that is now made by pressing a member card directly, with a primary action
   * naming who goes in; the sentence was labelling an affordance that had
   * become self-evident. `Items` cannot go, for the reason above it. Three
   * words against a ceiling of four, and the deviation is recorded in
   * `docs/generation.md` §68 rather than the record edited.
   */
  root.append(heading, blurb, members, actions);

  return {
    root,

    render(view, handlers) {
      /*
       * **The leader's name, and not the word after it. M5.3.**
       *
       * Section 4: *"Pre-gym screen | 4 | Gym leader name, type chip, 'Choose
       * lead'."* A leader's name is a proper noun and free; `'s gym` was the
       * one word on the line the counting rule could see, on a screen that is
       * only ever reached by walking into a gym.
       */
      title.textContent = view.gym.leader;
      // The leader's blurb, on tap, for Pocket. Same tip the map's title carries.
      title.dataset['tip'] = `gym:${view.segment}`;
      title.tabIndex = 0;
      title.setAttribute('role', 'button');
      leaderType.replaceChildren(typeChip(view.gym.type));
      // The leader's own blurb, from `data/gyms.ts`. Flavour that says how the
      // leader plays, written where every other gym string is written.
      blurb.textContent = view.gym.blurb;

      manage.onclick = () => handlers.onManageParty();

      const lead = defaultLeadSlot(view.party);
      const sending = view.party[lead];
      // Two words, and the species between them is a proper noun. With the
      // prompt above, the four section 4 allows.
      confirm.textContent = `Send ${sending ? sending.spec.species : 'the lead'} in`;
      confirm.onclick = () => handlers.onLead(lead);

      members.replaceChildren(
        ...view.party.map((member, index) => {
          const wrapper = el('div', 'pre-gym__slot');

          const card = memberCardContents(member, {
            holding: view.holding[index] ?? null,
            tuning: view.tuning,
            isLead: index === 0,
            index,
          });

          /*
           * **The card is the control, and it says nothing. M5.3.**
           *
           * This button read *"Lead with this one"* on five members and
           * *"Leading"* on the sixth: **21 words on a screen budgeted at 4**,
           * and the largest single block the census found anywhere in Tier 5
           * outside the event screen.
           *
           * Two of them were also a second channel for a fact already on the
           * card. `memberCardContents` is passed `isLead`, so slot 0 already
           * wears the lead marker; `member.fainted` already reads off the HP.
           * *"Leading"* and *"Fainted"* were R3 violations sitting under the
           * component that made them redundant.
           *
           * So the wrapper is the button, the way M5.1 made the shop's reward
           * card its own control rather than pairing it with an `Add`. The
           * disabled states are unchanged and still for two different reasons:
           * slot 0 because the choice is already made, a fainted member
           * because `chooseLead` would refuse the slot.
           */
          const choose = document.createElement('button');
          choose.type = 'button';
          /*
           * **No `button` class, deliberately, and this is the second time
           * that rule has been learned in this tier.** `.button` sets
           * `text-transform: uppercase`, and with the member card *inside* the
           * control that reaches every label on it — the stat block's
           * `Hit Points` came out `HIT POINTS` and
           * `test/visual-density.test.ts` said so. `screens/item-target.ts`
           * documents the same trap for the opposite reason, where `.button`
           * would have taken a card's shape away by source order.
           *
           * A control wrapping a component takes the component's typography,
           * not its own.
           */
          choose.className = 'pre-gym__choose';
          /*
           * Two reasons a button is disabled, and they are different states.
           *
           * Slot 0 is already leading, so the button is inert because the
           * choice is already made — the default is the current party order and
           * nothing on this screen has to be clicked at all. A fainted member
           * cannot lead: `battleMembersFor` filters it out and `chooseLead`
           * refuses the slot, so offering it would be offering a choice the
           * game would then refuse.
           */
          choose.disabled = index === 0 || member.fainted;
          choose.setAttribute(
            'aria-label',
            member.fainted
              ? `${member.spec.species} has fainted`
              : index === 0
                ? `${member.spec.species} is leading`
                : `Lead with ${member.spec.species}`,
          );
          choose.addEventListener('click', () => handlers.onLead(index));

          // The card goes *inside* the control. A reader who cannot see the
          // lead marker or the HP bar gets the same three states from the
          // label above, which is where "nothing" has to be read aloud as
          // something.
          choose.append(card);
          wrapper.append(choose);
          return wrapper;
        }),
      );
    },
  };
}
