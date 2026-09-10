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
import { displayName } from '../../core/nicknames';
import type { GymDefinition } from '../../data/gyms';
import { SEGMENT_COUNT } from '../../data/scaling';
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
  const counter = el('span', 'pre-gym__counter');
  const leaderType = el('span', 'pre-gym__type');
  heading.append(title, counter, leaderType);

  const blurb = el('p', 'screen__blurb');

  const prompt = el('h3', 'pre-gym__prompt');
  prompt.textContent = 'Who leads?';
  const members = el('div', 'pre-gym__party');

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

  const manage = document.createElement('button');
  manage.type = 'button';
  manage.className = 'button button--small';
  manage.textContent = 'Party screen (items)';

  const actions = el('div', 'pre-gym__actions');
  actions.append(confirm, manage);

  root.append(heading, blurb, prompt, members, actions);

  return {
    root,

    render(view, handlers) {
      title.textContent = `${view.gym.leader}'s gym`;
      counter.textContent = `Gym ${view.segment + 1} of ${SEGMENT_COUNT}`;
      leaderType.replaceChildren(typeChip(view.gym.type));
      // The leader's own blurb, from `data/gyms.ts`. Flavour that says how the
      // leader plays, written where every other gym string is written.
      blurb.textContent = view.gym.blurb;

      manage.onclick = () => handlers.onManageParty();

      const lead = defaultLeadSlot(view.party);
      const sending = view.party[lead];
      confirm.textContent = `Send ${sending ? displayName(sending.spec) : 'the lead'} in`;
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

          const choose = document.createElement('button');
          choose.type = 'button';
          choose.className = 'button button--small';
          choose.textContent = index === 0 ? 'Leading' : 'Lead with this one';
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
          if (member.fainted) choose.textContent = 'Fainted';
          choose.addEventListener('click', () => handlers.onLead(index));

          wrapper.append(card, choose);
          return wrapper;
        }),
      );
    },
  };
}
