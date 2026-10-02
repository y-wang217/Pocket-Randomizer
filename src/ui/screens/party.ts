/**
 * The party screen: what you are carrying, and what you can do to it.
 *
 * Reorder to set the battle lead, release a member, and — from Stage 4.5.1 —
 * move items between the party and the backpack.
 *
 * **The backpack and the party are one screen, not two**, which is the whole
 * reason item assignment landed here rather than on a bag screen of its own.
 * The question "who should hold the Leftovers" is answered by looking at six
 * stats and four moves on three Pokemon; a bag screen would be a list of item
 * names with the answer on the previous screen.
 *
 * Stage 4 wrote here that a party screen which "also moved items" would be a
 * second reward system with no cost attached. That was right when an item
 * arrived by landing on a Pokemon and destroying what it held. It stopped being
 * right when acquisition and assignment became separate decisions: the cost is
 * paid at the reward screen against a finite capacity, and what happens here is
 * free, reversible, and therefore not a reward system at all.
 *
 * **Reordering is not cosmetic.** `party.battleMembersFor` sends the party in
 * order, so slot 0 leads the next fight. Leading with the member that answers
 * the encounter you can see on the map is most of what a party is for, which is
 * why the buttons say "Lead" rather than "Move up".
 *
 * **Release is permanent and says so.** There is no box (see
 * `core/acquisition.ts`), so the confirm step is the only thing between a
 * misclick and a Pokemon that is gone for the run.
 *
 * ## Reorder is not logged. Item assignment is.
 *
 * The two edits on this screen are recorded differently, and the asymmetry is
 * deliberate rather than an oversight.
 *
 * A reorder changes run state directly and is not in the log, so a replayed run
 * reproduces the party the *decisions* produced rather than the order a player
 * dragged it into. That limit has been here since Stage 4.
 *
 * Item assignment could not take the same shortcut. It changes what the party
 * is holding when the next battle starts, which changes the battle — so a
 * replay that reconstructed the decisions but not the layout would produce a
 * different fight. It is therefore a real logged decision (`chooseItemPlan`),
 * and this screen *collects* a plan rather than applying one. The fidgeting is
 * free and unlogged; the layout the player leaves with is what reaches the log.
 *
 * That is why `onPlan` hands a plan upward instead of mutating the party the
 * way `onReorder` does.
 */
import { memberCardContents } from '../member-card';
import { backpackCapacity } from '../../core/items';
import { partyAfterTeaches } from '../../core/party';
import { relicById, type RelicId } from '../../data/relics';
import { CAPABILITY_LABELS } from '../../data/eventCopy';
import type { ItemId, ItemPlan, PokemonState, TmTeach } from '../../core/types';
import { itemById } from '../../data/items';
import { itemCopy, relicCopy } from '../../data/itemCopy';
import type { Tuning } from '../../data/tuning';
import { openBand } from '../band';
import { neutralChip } from '../chip';
import { collapsible } from '../collapse';
import { el, moveChip } from '../scene';
import { describeSpecCard } from '../../core/battle/driver';
import { STAT_ORDER, statInfo } from '../../data/statInfo';
import { glyphNode } from '../theme/glyph';
import { coverageWheel } from '../coverage-wheel';
import { setProse } from '../dom';
import { PARTY_COPY, PARTY_LABELS } from '../copy/screens';
import { itemIcon, renderSlots, slotNumber } from '../slots';

import { createThreatReadout } from './threats';

export interface PartyScreen {
  root: HTMLElement;
  /**
   * Draw the party.
   *
   * `onReorder` and `onRelease` mutate run state through `core/party.ts`;
   * `onDone` closes the screen. All three are handed in rather than owned here,
   * because `ui/` deciding what a release *means* is the seam the whole project
   * is built to avoid.
   */
  render(
    view: PartyView,
    handlers: {
      onReorder: (from: number, to: number) => void;
      onRelease: (slot: number) => void;
      /**
       * The item layout the player has settled on, handed upward to be logged.
       *
       * Called on every change rather than on leaving the screen, so the caller
       * always holds the current plan and the way-out button does not
       * have to be the thing that commits it. See the header on why this is a
       * plan rather than a mutation.
       */
      onPlan: (plan: ItemPlan) => void;
      /**
       * Spend a TM: who learns it, and what it costs them.
       *
       * Handed upward rather than answered here, because the two questions are
       * the `target` and `replace` screens and this screen does not own them.
       * The caller resolves both and calls back with a complete act, or with
       * null when the player backs out.
       */
      onTeach: (move: string, done: (teach: TmTeach | null) => void) => void;
      onDone: () => void;
    },
  ): void;
}

/** Everything the screen draws: the party, the loose items, and the cap. */
export interface PartyView {
  party: readonly PokemonState[];
  backpack: readonly ItemId[];
  /** The TMs the run is carrying, by move name, in acquisition order. */
  tms: readonly string[];
  /**
   * The move names spendable at this boundary — `run.teachableNow`.
   *
   * The rows render either way, because what the run is carrying is a fact the
   * player is entitled to at any boundary. What is gated is the Teach control,
   * and the row says which boundary would take it rather than leaving a dead
   * button to be discovered by tapping.
   *
   * **Per row rather than per screen, which the boolean it replaced could not
   * do.** At a rest or a shop this holds every TM and the shelf behaves as it
   * always has. At a node that just paid a move it holds that move alone, so
   * the row that arrived offers Teach and the three banked behind it do not —
   * which is the bag staying a bank while the arriving move gets its answer.
   */
  teachable: ReadonlySet<string>;
  /** The run's relics. Not the backpack — they are neither carried nor spent. */
  relics: readonly RelicId[];
  tuning: Tuning;
  /**
   * The party slots the run has right now, from `core/run.partyCapacity`.
   *
   * **Stage 4.8, item 1.** The slot grid draws this many cells and the backpack
   * derives its own capacity from it, so a gym clear widens both. A constant here
   * would draw three cells for a party of four.
   */
  slots: number;
  /**
   * Where the way out goes, as the words on the button.
   *
   * The screen has two entrances — the map's Manage button and the pre-gym
   * screen's — and the caller is the only thing that knows which one was used.
   * It is the label only: `onDone` does the navigating.
   */
  backTo: string;
  /**
   * A layout the player already composed and has not yet spent, or null.
   *
   * **Needed because a plan is collected here and applied at the next node
   * boundary**, so between the two the run's own state still shows the old
   * arrangement. Re-opening the screen without this would redraw from that
   * state and silently discard everything the player had just arranged.
   *
   * Null means "start from what the run actually holds", which is the state on
   * a first visit and immediately after a boundary spends a plan.
   */
  plan: ItemPlan | null;
  /**
   * Which of the two screens this is. **Bible Rev 23, D95.** The Team tab
   * draws the party, the Bag tab what it holds and carries. One working copy
   * behind both, so a layout made on the Bag survives a look at the Team.
   * Defaults to the Team.
   */
  focus?: PartyFocus;
  /**
   * Whether reorder and release are offered. **D94.** True between nodes; false
   * on a result, a shop or an event, where the node has not resolved and a
   * changed slot would fold the fight onto the wrong member. Defaults to true.
   */
  canEditParty?: boolean;
}

export type PartyFocus = 'team' | 'bag';
type TeamView = keyof typeof PARTY_LABELS.views;

export function createPartyScreen(): PartyScreen {
  const root = el('section', 'screen screen--party');

  const title = el('h2', 'screen__title');
  title.textContent = 'Your party';
  const blurb = el('p', 'screen__blurb');
  setProse(blurb, PARTY_COPY.blurb);

  /*
   * The threat readout's home, open rather than behind a disclosure.
   *
   * It sits with the party rather than in a panel of its own because it is a
   * fact *about* the party, and because this screen is where the player is
   * standing when a team-level fact is actionable — mid-reassignment, between
   * fights. Above the member cards so it is read before them: it is one line
   * about six, and putting it under three tall cards would make it a footnote
   * on a phone.
   */
  const threats = createThreatReadout();

  /*
   * **Two screens over one working copy. Bible Rev 23, D95.**
   *
   * The Team half: the threats line, then three views of the party behind a
   * segmented switch, never combined (D96). The Bag half: who holds what, the
   * backpack, the TMs and the relics (D97). The hotbar that stood above the
   * cards is gone from here: the Bag's held list names the same items at
   * rest, and two channels for one fact on one surface is R3.
   */
  const team = el('section', 'party__team');
  const switcher = el('div', 'party__views');
  switcher.setAttribute('role', 'tablist');
  const viewHost = el('div', 'party__view');
  const list = el('div', 'party party--manage');
  team.append(threats.root, switcher, viewHost);

  const bagHalf = el('section', 'party__bag');
  const heldList = el('section', 'held');
  const bag = el('section', 'backpack');
  const tmPanel = el('section', 'tms');
  const relics = el('section', 'relics');
  bagHalf.append(heldList, bag, tmPanel, relics);

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'button primary-action';
  // Text set per render, from `view.backTo`: the screen has two entrances and a
  // label naming the wrong one is the softlock told to the player in advance.

  root.append(title, blurb, team, bagHalf, done);

  // Which Team view is up, and the player's sort on the Stats view. Held for
  // the visit: reset by `render`, never persisted, and the sort starts in
  // party order (D96).
  let teamView: TeamView = 'stats';
  let sortBy: string | null = null;
  // The item picked for a two-tap move on the Bag (D97): a held one by slot,
  // or a loose one by its index in the backpack.
  let picked: { from: 'held'; slot: number } | { from: 'bag'; index: number } | null = null;

  let onDone: () => void = () => undefined;
  done.addEventListener('click', () => onDone());

  /*
   * The layout being edited, held here between renders.
   *
   * A working copy rather than the run's own state: the player is composing a
   * plan, and until they leave the screen nothing they do has happened. It is
   * seeded from the run on every `render` call, so re-entering the screen
   * starts from what the run actually holds rather than from what was left on
   * screen last time.
   */
  let held: (ItemId | null)[] = [];
  let loose: ItemId[] = [];
  let discarded: ItemId[] = [];
  /*
   * The TM half of the working copy.
   *
   * `carried` is what is still in the bag after this plan's teaches and
   * discards, which is what the capacity line has to count — a TM the player
   * has just spent is not competing for a slot any more, and a screen that said
   * otherwise would be asking them to discard something they already spent.
   */
  let carried: string[] = [];
  let teaches: TmTeach[] = [];
  let discardedTms: string[] = [];

  return {
    root,
    render(view, handlers) {
      onDone = handlers.onDone;
      done.textContent = view.backTo;
      const focus: PartyFocus = view.focus ?? 'team';
      const canEditParty = view.canEditParty ?? true;
      root.dataset['focus'] = focus;
      title.textContent = focus === 'bag' ? PARTY_LABELS.bagTitle : PARTY_LABELS.teamTitle;
      // The lead and release sentence belongs to the half that has them.
      blurb.hidden = focus !== 'team' || !canEditParty;
      team.hidden = focus !== 'team';
      bagHalf.hidden = focus !== 'bag';
      sortBy = null;
      picked = null;
      /*
       * Seed from the unspent plan if there is one, and from the run otherwise.
       *
       * The pool has to be rebuilt rather than read off the plan directly: a
       * plan names what each slot holds and what is being thrown away, and the
       * backpack is everything else the run owns. Deriving it here keeps the
       * screen's arithmetic and `items.applyItemPlan`'s agreeing about what
       * "everything else" means.
       */
      if (view.plan) {
        const owned = [
          ...view.backpack,
          ...view.party.flatMap((member) => (member.item ? [member.item] : [])),
        ];
        held = view.party.map(
          (_, slot) => view.plan?.assignments.find((entry) => entry.slot === slot)?.item ?? null,
        );
        discarded = [...view.plan.discards];
        loose = remaining(owned, [...held.filter((id): id is ItemId => id !== null), ...discarded]);
        teaches = view.plan.teaches.map((teach) => ({ ...teach }));
        discardedTms = [...view.plan.discardTms];
        carried = remaining(
          view.tms,
          [...teaches.map((teach) => teach.move), ...discardedTms],
        );
      } else {
        held = view.party.map((member) => member.item ?? null);
        loose = [...view.backpack];
        discarded = [];
        teaches = [];
        discardedTms = [];
        carried = [...view.tms];
      }

      const draw = (): void => {
        /*
         * **What the plan has already done to the party, drawn as done.**
         *
         * The learn-move refresh patch. A teach is composed here and spent at
         * the next node boundary, and until this line the cards below went on
         * listing the move the player had just replaced — the only answer they
         * get to "did that work", and the wrong one. This folds the working
         * copy's teaches exactly the way `reconcileItemPlan` will, through the
         * same `party.teachApplies` rule, so nothing is drawn here that the
         * boundary then refuses.
         *
         * `view.party` stays the write path: `onReorder` and `onRelease` name
         * run slots, and the plan is dropped when either fires. Slot order and
         * length are the same in both readings, so an index means one thing.
         */
        const shown = partyAfterTeaches(view.party, teaches);
        /*
         * Redrawn per `draw()` rather than once per `render`, **because a teach
         * is in the matchup model and an item is not.**
         *
         * It used to sit in `render` on the argument that nothing this screen
         * does changes which types hit the party — true while the screen only
         * moved items, since held items are not in the model. `partyThreats`
         * reads `offensiveCoverage`, which reads movesets, so a teach composed
         * here changes the answer and has to redraw with everything else.
         */
        threats.render(shown);
        drawSwitcher();
        if (teamView === 'stats') {
          const order = shown.map((_, index) => index);
          if (sortBy) {
            const key = sortBy;
            const value = (member: PokemonState): number => {
              const card = describeSpecCard(member.spec);
              return key === 'hp' ? member.maxHp : (card.baseStatsAtLevel as Record<string, number>)[key] ?? 0;
            };
            // Highest first; ties keep party order, so the sort never invents
            // an order between two equal numbers.
            order.sort((a, b) => value(shown[b]!) - value(shown[a]!) || a - b);
          }
          list.replaceChildren(
            ...order.map((index) =>
              renderManaged(shown[index]!, index, shown.length, held[index] ?? null, view.tuning, canEditParty, handlers),
            ),
          );
          viewHost.replaceChildren(sortBar(), list);
        } else if (teamView === 'moves') {
          viewHost.replaceChildren(movesGrid(shown));
        } else {
          viewHost.replaceChildren(coverageWheel(shown));
        }
        renderHeld(heldList, shown, held, picked, {
          onPick: (slot) => {
            picked = picked?.from === 'held' && picked.slot === slot ? null : { from: 'held', slot };
            draw();
          },
          onDrop: (slot) => {
            const from = picked;
            picked = null;
            if (!from) return;
            if (from.from === 'held') {
              // A swap between two members: each takes what the other held.
              const theirs = held[slot] ?? null;
              held[slot] = held[from.slot] ?? null;
              held[from.slot] = theirs;
            } else {
              const item = loose[from.index];
              if (item === undefined) return;
              loose.splice(from.index, 1);
              const displaced = held[slot] ?? null;
              held[slot] = item;
              if (displaced) loose.push(displaced);
            }
            commit();
          },
          onUnequip: (slot) => {
            picked = null;
            const item = held[slot];
            if (!item) return;
            held[slot] = null;
            loose.push(item);
            commit();
          },
        });
        renderRelics(relics, view.relics);
        renderTms(tmPanel, view, carried, teaches, {
          onTeach: (move) => {
            handlers.onTeach(move, (teach) => {
              if (!teach) return;
              const at = carried.indexOf(move);
              if (at === -1) return;
              carried.splice(at, 1);
              teaches.push(teach);
              commit();
            });
          },
          onDiscard: (move) => {
            const at = carried.indexOf(move);
            if (at === -1) return;
            carried.splice(at, 1);
            discardedTms.push(move);
            commit();
          },
        });
        renderBackpack(bag, view, loose, discarded, picked?.from === 'bag' ? picked.index : null, {
          onPick: (index) => {
            picked = picked?.from === 'bag' && picked.index === index ? null : { from: 'bag', index };
            draw();
          },
          onPutAway: () => {
            if (picked?.from !== 'held') return;
            const slot = picked.slot;
            picked = null;
            const item = held[slot];
            if (!item) return;
            held[slot] = null;
            loose.push(item);
            commit();
          },
          onDiscard: (index) => {
            picked = null;
            if (loose[index] === undefined) return;
            const [item] = loose.splice(index, 1);
            if (item) discarded.push(item);
            commit();
          },
          holding: picked?.from === 'held',
        });
      };

      const drawSwitcher = (): void => {
        switcher.replaceChildren(
          ...(Object.keys(PARTY_LABELS.views) as TeamView[]).map((key) => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'party__view-tab';
            tab.dataset['view'] = key;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', String(teamView === key));
            tab.textContent = PARTY_LABELS.views[key];
            tab.addEventListener('click', () => {
              teamView = key;
              draw();
            });
            return tab;
          }),
        );
      };

      /*
       * The sort, the player's and nobody else's (D96). Six stat marks and a
       * way back to party order. The active sort is shown as pressed, which
       * says what the player asked for; nothing marks a stat or a member the
       * UI would pick.
       */
      const sortBar = (): HTMLElement => {
        const bar = el('div', 'party__sort');
        const label = el('span', 'party__sort-label');
        label.textContent = PARTY_LABELS.sortBy;
        const button = (key: string | null, content: Node | string, name: string): HTMLButtonElement => {
          const control = document.createElement('button');
          control.type = 'button';
          control.className = 'party__sort-key';
          control.dataset['sort'] = key ?? 'party';
          control.setAttribute('aria-pressed', String(sortBy === key));
          control.setAttribute('aria-label', name);
          control.append(content);
          control.addEventListener('click', () => {
            sortBy = key;
            draw();
          });
          return control;
        };
        bar.append(label, button(null, PARTY_LABELS.partyOrder, PARTY_LABELS.partyOrder));
        for (const stat of STAT_ORDER) {
          const info = statInfo(stat);
          const mark = glyphNode(`stat-${stat}`, { label: info?.label ?? stat });
          bar.append(button(stat, mark ?? info?.abbreviation ?? stat, `${PARTY_LABELS.sortBy} ${info?.label ?? stat}`));
        }
        return bar;
      };

      const commit = (): void => {
        handlers.onPlan({
          assignments: view.party.map((_, slot) => ({ slot, item: held[slot] ?? null })),
          discards: [...discarded],
          teaches: teaches.map((teach) => ({ ...teach })),
          discardTms: [...discardedTms],
        });
        draw();
      };

      teamView = 'stats';
      draw();
    },
  };
}

/**
 * Everything in `owned` that `taken` does not account for, by multiplicity.
 *
 * Items are fungible by id and a run can hold two Leftovers, so this removes one
 * copy per entry rather than filtering by membership — a set difference would
 * make the second Leftovers vanish the moment the first was equipped.
 */
function remaining(owned: readonly ItemId[], taken: readonly ItemId[]): ItemId[] {
  const left = [...owned];
  for (const id of taken) {
    const at = left.indexOf(id);
    if (at !== -1) left.splice(at, 1);
  }
  return left;
}

/**
 * The TMs the run is carrying, and the two things that can be done with one.
 *
 * **A section of its own beside the backpack, not a second list inside it.** A
 * TM and a Leftovers compete for the same capacity, which is the whole
 * mechanic, and the count line below says so in one number — but they are not
 * the same kind of object and nothing the player can do to one applies to the
 * other. Filing them together would put a Give to Squirtle beside a Teach and
 * invite the reading that a Pokemon can hold a TM.
 *
 * The rows render at every boundary, because what the run is carrying is a fact
 * the player is entitled to. **The Teach control is what is gated**, per row,
 * by `run.teachableAt` — every TM at a rest or a shop, and at any other node
 * only a move that node just paid. Where it is unavailable the row says which
 * boundary would take it rather than offering a button that does nothing.
 *
 * No marker distinguishes a stronger TM from a weaker one and the order is
 * acquisition order, which is neither a ranking nor a recommendation. The move
 * card the Teach control opens carries the attributes; this row carries the
 * name and the two acts.
 */
function renderTms(
  host: HTMLElement,
  view: PartyView,
  carried: readonly string[],
  teaches: readonly TmTeach[],
  handlers: {
    onTeach: (move: string) => void;
    onDiscard: (move: string) => void;
  },
): void {
  /*
   * An empty shelf draws nothing at all.
   *
   * The backpack keeps its heading and its `0 of N` line when empty, because
   * capacity is a number the player is managing whether or not anything is in
   * it. A TM shelf with nothing on it is a heading and an apology, and at
   * Pocket density it is 27px of apology on a screen that has to fit 844 —
   * which is how `test/visual-pocket.test.ts` found it.
   */
  if (carried.length === 0 && teaches.length === 0) {
    host.replaceChildren();
    return;
  }

  const heading = el('h3', 'tms__title');
  heading.textContent = 'TMs';

  const note = el('p', 'tms__note');
  const anyTeachable = carried.some((move) => view.teachable.has(move));
  const allTeachable = carried.every((move) => view.teachable.has(move));
  note.textContent = !anyTeachable
    ? 'TMs are taught at a rest or a shop.'
    : allTeachable
      ? 'A TM is used up by teaching it. The move it replaces is gone.'
      : 'A new move can be taught now or kept for a rest or a shop. Teaching uses the TM up, and the move it replaces is gone.';

  const rows = el('ul', 'tms__list');
  rows.replaceChildren(
    ...carried.map((move, index) => {
      const row = el('li', 'tms__item');
      row.append(slotNumber(index));
      row.append(neutralChip(move, 'move', { tip: `move:${move}` }));

      const acts = el('span', 'tms__acts');
      if (view.teachable.has(move)) {
        const teach = document.createElement('button');
        teach.type = 'button';
        teach.className = 'button button--small';
        teach.textContent = 'Teach';
        teach.addEventListener('click', () => handlers.onTeach(move));
        acts.append(teach);
      }

      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'button button--small button--danger';
      drop.textContent = 'Discard';
      // Through the band, like every other irreversible act on this screen.
      drop.addEventListener('click', () =>
        openBand({
          title: `Discard the ${move} TM?`,
          detail: 'It is gone for the rest of the run.',
          confirm: 'Discard',
          cancel: 'Keep it',
          onConfirm: () => handlers.onDiscard(move),
        }),
      );
      acts.append(drop);
      row.append(acts);
      return row;
    }),
  );

  /*
   * What this plan has already spent, named rather than simply absent.
   *
   * A teach removes its TM from the list above the moment it is composed, and a
   * row that merely vanished would read as a bug on a screen whose whole job is
   * to show what the run is holding. It is also the only place the player can
   * see a teach they have arranged but not yet spent.
   */
  const spent = el('p', 'tms__spent');
  spent.textContent =
    teaches.length === 0
      ? ''
      : teaches
          .map((teach) => `${teach.move} → ${view.party[teach.slot]?.spec.species ?? `slot ${teach.slot}`}`)
          .join(', ');

  host.replaceChildren(heading, note, rows, spent);
}

/**
 * One managed member: the shared card, plus the two things only this screen can
 * do to it.
 *
 * **The card itself is `ui/member-card.ts` and is byte-identical to the
 * drawer's.** Stage 4.7 extracted it, and the reason is Part 1's rule: do not
 * build a reduced variant, because a reduced variant is where a verdict gets
 * smuggled in as an emphasis choice. Two hand-maintained copies of a card is
 * the same failure arriving slowly.
 *
 * What this screen adds is *writes*: the item control, the lead reorder and the
 * release. The drawer adds none of them, which is what read-only means — not a
 * shorter card.
 */
function renderManaged(
  member: PokemonState,
  index: number,
  size: number,
  holding: ItemId | null,
  tuning: Tuning,
  canEditParty: boolean,
  handlers: {
    onReorder: (from: number, to: number) => void;
    onRelease: (slot: number) => void;
  },
): HTMLElement {
  const card = memberCardContents(member, { holding, tuning, isLead: index === 0, index });
  card.dataset['slot'] = String(index);
  /*
   * **No item control here any more. Bible Rev 23, D95.** The held item is a
   * fact on the card; moving it is the Bag's. And no lead or release while a
   * node is resolving (D94): the run folds the fight onto members by slot, so
   * the controls are not drawn rather than drawn dead.
   */
  if (!canEditParty) return card;

  const actions = el('div', 'party__actions');

  const lead = document.createElement('button');
  lead.type = 'button';
  lead.className = 'button button--small';
  lead.textContent = 'Lead';
  // Disabled rather than hidden on the member that already leads: a button that
  // disappears from one row and not the others reads as a bug.
  lead.disabled = index === 0;
  lead.addEventListener('click', () => handlers.onReorder(index, 0));

  const release = document.createElement('button');
  release.type = 'button';
  release.className = 'button button--small button--danger';
  release.textContent = 'Release';
  // The last member cannot be released: an empty party is neither wiped nor
  // alive, which is a state reached by a button rather than by losing.
  release.disabled = size <= 1;
  // The confirm is the shared band (ui/band.ts), not a second click on this
  // button. Stage V2. The question names the Pokemon, because "for good?"
  // over the wrong card is exactly the misclick the confirm exists to catch.
  release.addEventListener('click', () =>
    openBand({
      title: `Release ${member.spec.species}?`,
      detail: 'For good. There is no box. Anything held goes back to the bag.',
      confirm: 'Release',
      cancel: 'Keep',
      onConfirm: () => handlers.onRelease(index),
    }),
  );

  actions.append(lead, release);
  // Into the card's fold, with the stats and moves the decision is made on.
  (card.querySelector('.collapse__body') ?? card).append(actions);
  return card;
}

/**
 * The Team screen's *Moves* view: one row per member, its four moves as move
 * chips with PP. **Bible Rev 23, D96.** Party order, always: this view has no
 * sort, and the chips are readouts (`pickable: false`) with their inspect
 * trigger, so a long press opens the full card as everywhere else.
 */
function movesGrid(party: readonly PokemonState[]): HTMLElement {
  const grid = el('div', 'moves-grid');
  party.forEach((member, slot) => {
    const spec = describeSpecCard(member.spec);
    const row = el('div', 'moves-grid__row');
    row.dataset['slot'] = String(slot);
    const who = el('div', 'moves-grid__who');
    const name = el('span', 'moves-grid__name');
    name.textContent = spec.species;
    who.append(slotNumber(slot), name);
    const moves = el('div', 'moves-grid__moves');
    member.moves.forEach((move, index) => {
      const facts = spec.moves[index];
      moves.append(
        moveChip({
          id: move.name,
          name: move.name,
          type: facts?.type ?? 'Normal',
          category: facts?.category ?? 'Physical',
          basePower: facts?.basePower ?? 0,
          ppCounter: { remaining: move.pp, max: move.maxPp },
          pickable: false,
        }),
      );
    });
    row.append(who, moves);
    grid.append(row);
  });
  return grid;
}

/**
 * Who holds what, at rest. **Bible Rev 23, D97.** One row per member: the
 * item's sprite, name and effect line (R13: a carried item's name and effect
 * are vital), or that the hand is empty.
 *
 * **Two taps to move anything.** Tap a held item to pick it up, then tap
 * another member to swap the two, or *To bag* to put it away; tap a backpack
 * item, then a member, to give it. The picked row is marked as picked, and
 * that is the player's own act shown back to them, not a suggestion: no
 * member is ever marked as the place an item should go.
 */
function renderHeld(
  host: HTMLElement,
  party: readonly PokemonState[],
  held: readonly (ItemId | null)[],
  picked: { from: 'held'; slot: number } | { from: 'bag'; index: number } | null,
  handlers: {
    onPick: (slot: number) => void;
    onDrop: (slot: number) => void;
    onUnequip: (slot: number) => void;
  },
): void {
  const heading = el('h3', 'held__title');
  heading.textContent = PARTY_LABELS.held;
  const rows = el('ul', 'held__list');
  if (picked) host.dataset['picking'] = picked.from;
  else delete host.dataset['picking'];

  party.forEach((member, slot) => {
    const item = held[slot] ?? null;
    const entry = item ? itemById(item) : undefined;
    const row = el('li', 'held__item');
    row.dataset['slot'] = String(slot);
    const isPicked = picked?.from === 'held' && picked.slot === slot;
    if (isPicked) row.dataset['picked'] = 'true';

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'held__pick';
    const name = el('span', 'held__member');
    name.textContent = member.spec.species;
    const icon = el('span', 'held__icon');
    icon.setAttribute('aria-hidden', 'true');
    if (entry) icon.append(itemIcon(entry.id));
    const what = el('span', 'held__name');
    what.textContent = entry ? entry.name : PARTY_LABELS.nothingHeld;
    if (!entry) row.classList.add('held__item--empty');
    const effect = el('span', 'held__effect');
    effect.textContent = entry ? (entry.consumable ? `${itemCopy(entry.id)} Used up when it fires.` : itemCopy(entry.id)) : '';
    pick.append(slotNumber(slot), name, icon, what, effect);
    pick.setAttribute('aria-pressed', String(isPicked));
    pick.addEventListener('click', () => {
      // With something picked, a member is where it goes; with nothing
      // picked, a member holding something is what gets picked up.
      if (picked && !isPicked) handlers.onDrop(slot);
      else if (item || isPicked) handlers.onPick(slot);
    });
    row.append(pick);

    if (isPicked) {
      const away = document.createElement('button');
      away.type = 'button';
      away.className = 'button button--small held__away';
      away.textContent = PARTY_LABELS.toBag;
      away.addEventListener('click', () => handlers.onUnequip(slot));
      row.append(away);
    }
    rows.append(row);
  });
  host.replaceChildren(heading, rows);
}

function renderRelics(root: HTMLElement, held: readonly RelicId[]): void {
  root.replaceChildren();
  if (held.length === 0) {
    // Rendered rather than hidden, and phrased as a fact. A player who has
    // taken none should learn the category exists and where they will appear.
    const empty = el('p', 'relics__empty');
    setProse(empty, PARTY_COPY.noRelics);
    root.append(empty);
    return;
  }

  const title = el('h3', 'relics__title');
  title.dataset['tutorial'] = 'relics';
  title.textContent = `Relics (${held.length})`;
  const list = el('ul', 'relics__list');

  for (const id of held) {
    const relic = relicById(id);
    if (!relic) continue;
    const row = el('li', 'relics__item');

    const name = el('span', 'relics__name');
    name.textContent = relic.name;
    // The description on tap, for Pocket, where the row is the name and what
    // it grants and the paragraph is hidden. The same `relic:` tip the drawer's
    // chips carry, so a relic reads the same wherever it is tapped. Density
    // modes patch.
    name.dataset['tip'] = `relic:${relic.id}`;
    name.tabIndex = 0;
    name.setAttribute('role', 'button');

    const grants = neutralChip(CAPABILITY_LABELS[relic.grants], 'capability');

    const body = el('p', 'relics__text');
    body.textContent = relicCopy(relic.id);

    row.append(name, grants, body);
    list.append(row);
  }

  root.append(title);
  // The list folds in Pocket, all of it together, behind the title that
  // carries the count: on a screen whose decisions are the lead, the items
  // and a release, what the run has already banked is the secondary fact.
  // Measured on the worst case, every relic as a name chip ran 151px.
  // Density modes patch, Part 4.
  const fold = collapsible(root, [list], 'Relics');
  fold.toggle.classList.add('relics__toggle');
  title.append(fold.toggle);
}

function renderBackpack(
  host: HTMLElement,
  view: PartyView,
  loose: readonly ItemId[],
  discarded: readonly ItemId[],
  pickedIndex: number | null,
  handlers: {
    onPick: (index: number) => void;
    onPutAway: () => void;
    onDiscard: (index: number) => void;
    /** A held item is picked up, so the backpack is a place it can go. */
    holding: boolean;
  },
): void {
  const capacity = backpackCapacity(view.slots, view.tuning);
  const heading = el('h3', 'backpack__title');
  heading.textContent = 'Backpack';

  // The hotbar: capacity slots, the loose items in acquisition order, the
  // rest empty. Stage V2. A berry's slot looks like any other slot.
  const slots = renderSlots(
    'backpack',
    loose.map((id) => ({ label: itemById(id)?.name ?? id, item: id, tip: `item:${id}` })),
    capacity,
  );

  const count = el('p', 'backpack__count');
  count.dataset['tutorial'] = 'backpack';
  count.textContent = `${loose.length} of ${capacity} carried`;
  if (loose.length > capacity) {
    count.classList.add('backpack__count--over');
    // Stated as the condition for leaving, not as a scolding. The player cannot
    // proceed over capacity — `applyItemPlan` refuses — so the screen has to say
    // what is required, and that is a rule rather than an opinion.
    count.textContent += ' — give some away or discard down to the cap before leaving.';
  }

  const rows = el('ul', 'backpack__list');
  rows.replaceChildren(
    ...loose.map((id, index) => {
      const entry = itemById(id);
      const row = el('li', 'backpack__item');
      row.append(slotNumber(index));

      /*
       * **The item at rest, its controls on a tap. Bible Rev 20, R13 and
       * D81.** A carried item's name and effect line are vital, so they are
       * the row's face: sprite, name, effect, nothing folded. They folded
       * behind a `+` until the author's *"the click to open sucks"*. What a tap
       * on the item opens is what to do with it, the give and discard
       * controls, one row at a time: six names on each of eight rows is a
       * screen of buttons nobody reads, and choosing the item is the first
       * half of giving it anyway.
       */
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'backpack__pick';
      const icon = el('span', 'backpack__icon');
      if (entry) icon.append(itemIcon(entry.id));
      // The name below names it; the sprite would say it a second time.
      icon.setAttribute('aria-hidden', 'true');
      const name = el('span', 'backpack__name');
      name.textContent = entry?.name ?? id;
      /*
       * A berry is marked, because it is the one row on this screen whose
       * *lifetime* differs from every other. **Stage 4.6b.**
       *
       * Every other item here is permanent: give it away, take it back,
       * discard it, but it exists until the player says otherwise. A berry
       * fires once and is gone, and a player who does not know that will
       * assign one, count it against the cap, and find it missing after a
       * fight with no explanation. It is a class and one sentence in the
       * effect line, not a separate section: the berry occupies a backpack
       * slot exactly like everything else.
       */
      if (entry?.consumable) row.classList.add('backpack__item--consumable');

      const effect = el('span', 'backpack__effect');
      // "Used up when it fires." is an attribute, and the one attribute this
      // row would otherwise be missing. Not a warning, and not advice about
      // whether to carry it.
      effect.textContent = entry
        ? entry.consumable
          ? `${itemCopy(entry.id)} Used up when it fires.`
          : itemCopy(entry.id)
        : '';
      pick.append(icon, name, effect);

      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'button button--small button--danger';
      drop.textContent = PARTY_LABELS.discard;
      // Confirmed through the band, like Release, and for the same reason: a
      // discard is the one irreversible thing on this screen.
      drop.addEventListener('click', () =>
        openBand({
          title: `Discard ${entry?.name ?? id}?`,
          detail: 'For good. It leaves the run.',
          confirm: 'Discard',
          cancel: 'Keep',
          onConfirm: () => handlers.onDiscard(index),
        }),
      );

      /*
       * **A tap picks the item up. Bible Rev 23, D97.** It used to open a row
       * of give buttons, one per species; the Bag's held list is now where it
       * goes, one tap away, and a picked item's own row carries the one act
       * that does not need a destination, the discard.
       */
      const controls = el('div', 'backpack__controls');
      const isPicked = pickedIndex === index;
      if (isPicked) {
        row.dataset['picked'] = 'true';
        controls.append(drop);
      }
      pick.setAttribute('aria-pressed', String(isPicked));
      pick.addEventListener('click', () => handlers.onPick(index));
      row.append(pick, controls);
      return row;
    }),
  );

  const children: HTMLElement[] = [heading, count, slots, rows];
  // With a held item picked up, the backpack is one of the places it can go.
  if (handlers.holding) {
    const away = document.createElement('button');
    away.type = 'button';
    away.className = 'button button--small backpack__put-away';
    away.textContent = PARTY_LABELS.toBag;
    away.addEventListener('click', () => handlers.onPutAway());
    children.splice(1, 0, away);
  }
  if (loose.length === 0) {
    const empty = el('p', 'backpack__empty');
    setProse(empty, PARTY_COPY.emptyBag);
    children.push(empty);
  }
  if (discarded.length > 0) {
    const note = el('p', 'backpack__discarded');
    note.textContent = `Discarding: ${discarded.map((id) => itemById(id)?.name ?? id).join(', ')}`;
    children.push(note);
  }
  host.replaceChildren(...children);
}
