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
import { describeSpecCard } from '../../core/battle/driver';
import { backpackCapacity } from '../../core/items';
import { hpFraction, ppTotals } from '../../core/party';
import type { ItemId, ItemPlan, PokemonState } from '../../core/types';
import { itemById } from '../../data/items';
import { statInfo, STAT_ORDER } from '../../data/statInfo';
import type { Tuning } from '../../data/tuning';
import { genderMark, el } from '../scene';
import { showsNumbers } from '../settings';
import { typeChip } from './starter-select';

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
       * always holds the current plan and the "Back to the map" button does not
       * have to be the thing that commits it. See the header on why this is a
       * plan rather than a mutation.
       */
      onPlan: (plan: ItemPlan) => void;
      onDone: () => void;
    },
  ): void;
}

/** Everything the screen draws: the party, the loose items, and the cap. */
export interface PartyView {
  party: readonly PokemonState[];
  backpack: readonly ItemId[];
  tuning: Tuning;
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
}

export function createPartyScreen(): PartyScreen {
  const root = el('section', 'screen screen--party');

  const title = el('h2', 'screen__title');
  title.textContent = 'Your party';
  const blurb = el('p', 'screen__blurb');
  blurb.textContent = 'The first member leads the next battle. Releasing is permanent.';

  const list = el('div', 'party party--manage');
  const bag = el('section', 'backpack');

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'button button--primary';
  done.textContent = 'Back to the map';

  root.append(title, blurb, list, bag, done);

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

  return {
    root,
    render(view, handlers) {
      onDone = handlers.onDone;
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
      } else {
        held = view.party.map((member) => member.item ?? null);
        loose = [...view.backpack];
        discarded = [];
      }

      const draw = (): void => {
        list.replaceChildren(
          ...view.party.map((member, index) =>
            renderManaged(member, index, view.party.length, held[index] ?? null, {
              ...handlers,
              onUnequip: () => {
                const item = held[index];
                if (!item) return;
                held[index] = null;
                loose.push(item);
                commit();
              },
            }),
          ),
        );
        renderBackpack(bag, view, loose, discarded, {
          onEquip: (item, slot) => {
            const displaced = held[slot] ?? null;
            const from = loose.indexOf(item);
            if (from === -1) return;
            loose.splice(from, 1);
            held[slot] = item;
            if (displaced) loose.push(displaced);
            commit();
          },
          onDiscard: (item) => {
            const from = loose.indexOf(item);
            if (from === -1) return;
            loose.splice(from, 1);
            discarded.push(item);
            commit();
          },
        });
      };

      const commit = (): void => {
        handlers.onPlan({
          assignments: view.party.map((_, slot) => ({ slot, item: held[slot] ?? null })),
          discards: [...discarded],
        });
        draw();
      };

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

function renderManaged(
  member: PokemonState,
  index: number,
  size: number,
  holding: ItemId | null,
  handlers: {
    onReorder: (from: number, to: number) => void;
    onRelease: (slot: number) => void;
    onUnequip: () => void;
  },
): HTMLElement {
  const card = el('div', 'party__member');
  if (index === 0) card.classList.add('party__member--lead');
  if (member.fainted) card.classList.add('party__member--fainted');

  const spec = describeSpecCard(member.spec);

  const header = el('div', 'panel__header');
  const name = el('span', 'panel__name');
  name.textContent = spec.species;
  const level = el('span', 'panel__level');
  // Gender next to the level, exactly as the battle panel prints it, and via the
  // same function — a Pokemon that read "Lv30 ♀" in a fight and "Lv30" here
  // would look like two Pokemon.
  level.textContent = `Lv${spec.level}${genderMark(spec.gender)}`;
  header.append(name, level, ...spec.types.map(typeChip));
  if (index === 0) {
    const lead = el('span', 'badge badge--lead');
    lead.textContent = 'Lead';
    header.append(lead);
  }

  const ability = el('span', 'party__ability');
  ability.textContent = spec.ability;
  // Reachable here and not only mid-battle. An ability the player can only read
  // about while a fight is running is one they cannot plan around.
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
    ? `Fainted · PP ${pp.pp}/${pp.maxPp}`
    : `${member.hp} / ${member.maxHp} HP · PP ${pp.pp}/${pp.maxPp}`;
  meta.append(hp);

  if (member.status) {
    const status = el('span', 'badge badge--status');
    status.dataset['status'] = member.status;
    status.textContent = member.status.toUpperCase();
    meta.append(status);
  }

  if (member.status) {
    // Status tooltips reachable outside a battle, for the same reason as
    // abilities: a burn the player can only read about while burning is one
    // they learn nothing from.
    const chip = meta.querySelector('.badge--status');
    if (chip instanceof HTMLElement) chip.dataset['tip'] = `status:${member.status}`;
  }

  /*
   * The held item, inline, with the assignment on the same card.
   *
   * Stage 4 put the item name here so a targeting decision could be audited
   * afterwards. Stage 4.5.1 puts the *control* here too, because the decision
   * is no longer made elsewhere — this is where it is made, next to the stats
   * and moves that are the reason to make it one way or the other.
   */
  const entry = holding ? itemById(holding) : null;
  const itemRow = el('div', 'party__item');
  const itemChip = el('span', 'badge badge--item');
  itemChip.textContent = entry ? entry.name : 'No item';
  if (!entry) itemChip.classList.add('badge--muted');
  if (entry) itemChip.dataset['tip'] = `item:${entry.id}`;
  itemRow.append(itemChip);

  if (entry) {
    // The plain-language effect line, from `data/items.ts` rather than written
    // here — the same string the reward card shows, so an item reads the same
    // wherever it appears.
    const effect = el('span', 'party__item-effect');
    effect.textContent = entry.blurb;
    itemRow.append(effect);

    const off = document.createElement('button');
    off.type = 'button';
    off.className = 'button button--small';
    off.textContent = 'To bag';
    off.addEventListener('click', () => handlers.onUnequip());
    itemRow.append(off);
  }

  const stats = renderStats(spec, member);

  const moves = el('ul', 'party__moves');
  moves.replaceChildren(
    ...member.moves.map((move) => {
      const row = el('li', 'party__move');
      const label = el('span', '');
      label.textContent = move.name;
      const count = el('span', 'move__pp');
      count.textContent = `${move.pp}/${move.maxPp}`;
      if (move.maxPp > 0 && move.pp / move.maxPp <= 0.25) count.classList.add('move__pp--low');
      row.append(label, count);
      return row;
    }),
  );

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
  release.addEventListener('click', () => {
    if (release.dataset['confirm'] === 'true') {
      handlers.onRelease(index);
      return;
    }
    release.dataset['confirm'] = 'true';
    release.textContent = 'Release for good?';
  });

  actions.append(lead, release);
  card.append(header, track, meta, itemRow, stats, moves, actions);
  card.dataset['slot'] = String(index);
  return card;
}

/**
 * The full six-stat block, using the same labels and the same tooltips as the
 * battle panel.
 *
 * **Reuses the battle screen's vocabulary rather than its component**, and the
 * distinction is worth naming. `scene.ts`'s stat rows are built against an
 * `ActiveUiView` — a Pokemon that is *in a battle*, carrying stat stages, a
 * speed reading from the engine and a faster-side marker. None of those exist
 * for a party member between nodes, and inventing them would mean printing a
 * boosted Attack for a Pokemon that is not boosted.
 *
 * What is shared is everything that matters to the reader: the labels, the
 * order, the `stat:` tooltip on every one of them, and the Simple/Detailed
 * behaviour. A player who learned what SpA means from the battle screen finds
 * the same word and the same tooltip here.
 */
function renderStats(spec: ReturnType<typeof describeSpecCard>, member: PokemonState): HTMLElement {
  const root = el('div', 'stats stats--party');
  const values: Record<string, number> = { ...spec.baseStatsAtLevel, hp: member.maxHp };

  for (const stat of STAT_ORDER) {
    const info = statInfo(stat);
    const row = el('div', 'stat');
    row.dataset['stat'] = stat;

    const label = el('span', 'stat__label');
    label.textContent = info?.abbreviation ?? stat;
    label.dataset['tip'] = `stat:${stat}`;

    const value = el('span', 'stat__value');
    const amount = values[stat] ?? 0;
    value.textContent = `${amount}`;

    const bar = el('div', 'stat__bar');
    const fill = el('div', 'stat__bar-fill');
    fill.style.width = `${Math.max(0, Math.min(1, amount / STAT_BAR_CEILING)) * 100}%`;
    bar.append(fill);

    // The one branch the verbosity flag takes on this screen, and it swaps
    // which child is hidden rather than computing anything differently.
    value.hidden = !showsNumbers();
    bar.hidden = showsNumbers();

    row.append(label, value, bar);
    root.append(row);
  }
  return root;
}

/** Kept in step with `scene.ts`'s ceiling so a bar means the same on both screens. */
const STAT_BAR_CEILING = 200;

/**
 * The backpack: what is loose, where it can go, and what the cap is.
 *
 * The capacity line states the number rather than warning about it. Part 4
 * again — "4 of 5 carried" is a fact and "your bag is nearly full" is the UI
 * telling the player what to think about it.
 */
function renderBackpack(
  host: HTMLElement,
  view: PartyView,
  loose: readonly ItemId[],
  discarded: readonly ItemId[],
  handlers: {
    onEquip: (item: ItemId, slot: number) => void;
    onDiscard: (item: ItemId) => void;
  },
): void {
  const capacity = backpackCapacity(view.tuning);
  const heading = el('h3', 'backpack__title');
  heading.textContent = 'Backpack';

  const count = el('p', 'backpack__count');
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
    ...loose.map((id) => {
      const entry = itemById(id);
      const row = el('li', 'backpack__item');

      const name = el('span', 'badge badge--item');
      name.textContent = entry?.name ?? id;
      if (entry) name.dataset['tip'] = `item:${entry.id}`;

      const effect = el('span', 'backpack__effect');
      effect.textContent = entry?.blurb ?? '';

      const give = el('span', 'backpack__give');
      view.party.forEach((member, slot) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button button--small';
        // Named rather than numbered: "Give to Squirtle" is a sentence and
        // "Slot 2" is a thing to look up.
        button.textContent = member.spec.species;
        button.addEventListener('click', () => handlers.onEquip(id, slot));
        give.append(button);
      });

      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'button button--small button--danger';
      drop.textContent = 'Discard';
      drop.addEventListener('click', () => {
        // Two-step, like Release, and for the same reason: a discard is the one
        // irreversible thing on this screen.
        if (drop.dataset['confirm'] === 'true') {
          handlers.onDiscard(id);
          return;
        }
        drop.dataset['confirm'] = 'true';
        drop.textContent = 'Discard for good?';
      });

      row.append(name, effect, give, drop);
      return row;
    }),
  );

  const children: HTMLElement[] = [heading, count, rows];
  if (loose.length === 0) {
    const empty = el('p', 'backpack__empty');
    empty.textContent = 'Nothing loose. Items you win arrive here.';
    children.push(empty);
  }
  if (discarded.length > 0) {
    const note = el('p', 'backpack__discarded');
    note.textContent = `Discarding: ${discarded.map((id) => itemById(id)?.name ?? id).join(', ')}`;
    children.push(note);
  }
  host.replaceChildren(...children);
}
