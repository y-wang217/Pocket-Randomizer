/**
 * The party drawer, and the standing rule behind it.
 *
 * ## The rule
 *
 * **Any screen that asks the player for a decision must expose current party
 * state without leaving the decision.** It is written into
 * `docs/generation.md` §12 so future screens inherit it rather than
 * rediscovering it.
 *
 * Before Stage 4.7 the player picked a locale, a node, a reward, a recipient, a
 * replacement and a shop purchase, and on none of those screens could they see
 * what their party currently looked like. Every one of those decisions was made
 * from memory. That is not difficulty: the information is hidden by no rule, it
 * is merely absent, and a game that makes a player hold six stat blocks in
 * their head is measuring the wrong thing.
 *
 * ## One drawer, not one panel per screen
 *
 * A trigger in the same position on every decision surface, opening an overlay
 * over whatever is underneath. **An overlay, not a route**: closing it returns
 * to byte-identical screen state with nothing selected and nothing submitted,
 * which a route could not promise — a route would unmount the screen under it
 * and take its half-filled shop basket with it.
 *
 * Three properties are what make this a readout rather than a mechanic, and
 * `test/party-drawer.test.ts` asserts all three **per surface** rather than
 * once:
 *
 *   - Opening it never advances run state.
 *   - Opening it never submits a decision. In battle that is the sharp case: a
 *     move button is a submission, and a trigger that sat inside the move grid
 *     would be one keystroke away from spending a turn.
 *   - Opening it consumes no RNG.
 *
 * ## Read-only in v1
 *
 * Item reassignment stays on the party management screen, which is where 4.5.1
 * put it, so there is **one write path for party state**. A drawer that could
 * reassign would need its own carve-out from "opening never changes state", and
 * that is a v2 decision with its own playtest.
 *
 * ## In battle
 *
 * Reachable, read-only, and **player side only**. It must not become a way to
 * inspect the opponent's moveset — which the player is not shown, and which the
 * archetype label exists precisely to avoid leaking.
 */
import type { PokemonState, ItemId } from '../core/types';
import type { RelicId } from '../data/relics';
import { relicById } from '../data/relics';
import type { Tuning } from '../data/tuning';
import { el } from './scene';
import { setProse } from './dom';
import { createOverlay } from './overlay';
import { walletFigure } from './chip';
import { DRAWER_BAG_HEADING, DRAWER_COPY, PARTY_LABELS } from './copy/screens';
import { itemById } from '../data/items';
import { itemIcon, renderSlots, slotNumber } from './slots';
import { itemCopy } from '../data/itemCopy';
import { memberCardContents } from './member-card';
import { consumableById } from '../data/consumables';
import { CONSUMABLE_COPY } from '../data/defenderCopy';
import { NATIVE, placeholderIcon } from './assets/manifest';

export interface DrawerView {
  party: readonly PokemonState[];
  /** What each slot is holding, by party index. Read-only here. */
  holding: readonly (ItemId | null)[];
  /** The run's relics. See the layout note in `render`. */
  relics: readonly RelicId[];
  /** The coins held, at the top of both tabs (2026-10-08). Absent, no wallet is drawn. */
  currency?: number;
  /**
   * The backpack's loose items and the TMs carried, for the Bag tab's
   * readout. **Stage 5.0/1.** Read-only here like everything else: the party
   * screen is still the one place an item moves.
   */
  bag?: {
    loose: readonly ItemId[];
    capacity: number;
    tms: readonly string[];
    /** A defender run's consumables, listed at rest (bible Rev 25, D102). Never used here. */
    consumables?: readonly string[];
  };
  tuning: Tuning;
  /**
   * Whether this is the in-battle drawer.
   *
   * Only difference: the blurb says the party is as the fight left it, because
   * HP on these cards is mid-battle and a player reading it as between-nodes
   * state would be reading a number about a different moment.
   */
  inBattle?: boolean;
  /**
   * Which tab opened it. **Bible Rev 23, D95.** Team draws the party and the
   * relics, Bag who holds what and what is carried; the readout follows the
   * same split as the writable screens. Defaults to Team.
   */
  focus?: 'team' | 'bag';
}

export interface Drawer {
  /** The overlay itself, mounted once at the app root and toggled. */
  root: HTMLElement;
  /** A trigger button, for a screen to place in its own header. */
  trigger(): HTMLButtonElement;
  /**
   * Show it.
   *
   * `opener` is the button that was pressed, and passing it is what sends focus
   * back there on close rather than to the top of the document. Optional, so
   * every existing caller still compiles; `ui/overlay.ts` says why it matters.
   */
  open(view: DrawerView, opener?: HTMLElement | null): void;
  close(): void;
  isOpen(): boolean;
  /** Bring the backpack into view, for the Bag tab. Stage 5.0/1. */
  showBag(): void;
  onClose(listener: () => void): void;
}



export function createDrawer(): Drawer {
  /*
   * The scrim, the sheet, the header, Close, Escape, the click-stop and the
   * focus handling all come from `ui/overlay.ts` now — with its own dual class
   * names, so `.drawer__sheet` and `.drawer__close` still resolve for the four
   * suites and the smoke script that query them.
   *
   * What is left in this file is the only thing that was ever particular to
   * the party drawer: what goes inside it.
   */
  const overlay = createOverlay({ block: 'drawer', label: 'Your party', title: 'Your party' });

  const blurb = el('p', 'drawer__blurb');

  const members = el('div', 'drawer__members');
  members.dataset['tutorial'] = 'drawer-party';

  /*
   * The relic slot, left in the layout deliberately.
   *
   * 4.6c's relics are already run state, so this is populated rather than
   * empty — but the *space* is the point either way. Retrofitting a section
   * into a drawer that ships without one is worse than leaving the room, and
   * the brief says so.
   */
  const relics = el('div', 'drawer__relics');
  relics.dataset['tutorial'] = 'drawer-relics';

  /*
   * The backpack and the TMs, read-only. **Stage 5.0/1, the Bag tab.** The
   * same hotbar the party screen draws (`ui/slots.ts`), so the readout and
   * the write path cannot disagree about what a slot looks like. The battle
   * speed picker that sat below it moved to the Settings screen.
   */
  const bag = el('div', 'drawer__bag');
  bag.dataset['drawerSection'] = 'bag';

  const note = el('p', 'drawer__note');
  setProse(note, DRAWER_COPY.note);

  const held = el('div', 'drawer__held-section');
  // The coins, at the right end of the blurb's line on both tabs
  // (2026-10-08), so the sheet grows by nothing.
  const wallet = el('div', 'drawer__wallet');
  const lead = el('div', 'drawer__lead');
  lead.append(blurb, wallet);
  overlay.body.append(lead, members, relics, held, bag, note);

  return {
    root: overlay.root,

    /**
     * A trigger, built fresh per call so each screen owns its own button.
     *
     * One drawer, many triggers. The alternative — one button the router moved
     * between screens — would mean the button's position depended on which
     * screen had claimed it last, and "the same place on every screen" is the
     * whole of what makes it findable.
     */
    trigger() {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button button--small shell__trigger drawer__trigger';
      button.textContent = 'Party';
      button.setAttribute('aria-haspopup', 'dialog');
      // `data-drawer-trigger` is what `test/party-drawer.test.ts` finds on each
      // surface. A test that looked for the label would break on a copy edit.
      button.dataset['drawerTrigger'] = 'true';
      return button;
    },

    open(view, opener) {
      setProse(blurb, view.inBattle ? DRAWER_COPY.inBattle : DRAWER_COPY.carrying);
      wallet.hidden = view.currency === undefined;
      wallet.replaceChildren(...(view.currency === undefined ? [] : [walletFigure(view.currency)]));

      const focus = view.focus ?? 'team';
      overlay.root.dataset['focus'] = focus;
      members.hidden = focus !== 'team';
      relics.hidden = focus !== 'team';
      held.hidden = focus !== 'bag';
      bag.hidden = focus !== 'bag';

      // Who holds what, read only: the Bag's held list without its taps.
      held.replaceChildren();
      const heldHeading = el('h3', 'drawer__section');
      heldHeading.textContent = PARTY_LABELS.held;
      const heldRows = el('ul', 'drawer__items drawer__held');
      view.party.forEach((member, index) => {
        const id = view.holding[index] ?? null;
        const entry = id ? itemById(id) : undefined;
        const row = el('li', 'drawer__item');
        const icon = el('span', 'drawer__item-icon');
        if (entry) icon.append(itemIcon(entry.id));
        icon.setAttribute('aria-hidden', 'true');
        const name = el('span', 'drawer__item-name');
        name.textContent = `${member.spec.species}: ${entry?.name ?? PARTY_LABELS.nothingHeld}`;
        if (entry) {
          name.dataset['tip'] = `item:${entry.id}`;
          name.tabIndex = 0;
          name.setAttribute('role', 'button');
        }
        const effect = el('span', 'drawer__item-effect');
        effect.textContent = entry ? `${itemCopy(entry.id)}${entry.consumable ? ' Used up when it fires.' : ''}` : '';
        row.append(slotNumber(index), icon, name, effect);
        heldRows.append(row);
      });
      held.append(heldHeading, heldRows);

      members.replaceChildren(
        ...view.party.map((member, index) =>
          memberCardContents(member, {
            holding: view.holding[index] ?? null,
            tuning: view.tuning,
            isLead: index === 0,
            index,
            readout: true,
            // Segment-to-date contribution, compact, on every card. A fact
            // about what already happened — see the note on the row itself.
            contribution: 'segment',
          }),
        ),
      );

      relics.replaceChildren();
      if (view.relics.length > 0) {
        const heading = el('h3', 'drawer__section');
        heading.textContent = 'Relics';
        const list = el('div', 'drawer__relic-list');
        for (const id of view.relics) {
          const entry = relicById(id);
          if (!entry) continue;
          const chip = el('span', 'badge badge--relic');
          chip.textContent = entry.name;
          // The description on tap: `ui/tooltips.ts`, `relic:`. Density patch.
          chip.dataset['tip'] = `relic:${entry.id}`;
          chip.tabIndex = 0;
          chip.setAttribute('role', 'button');
          list.append(chip);
        }
        relics.append(heading, list);
      }

      bag.replaceChildren();
      if (view.bag) {
        const heading = el('h3', 'drawer__section');
        heading.textContent = DRAWER_BAG_HEADING;
        const slots = renderSlots(
          'backpack',
          view.bag.loose.map((id) => ({ label: itemById(id)?.name ?? id, item: id, tip: `item:${id}` })),
          view.bag.capacity,
        );
        bag.append(heading, slots);
        /*
         * **The bag listed at rest. Bible Rev 20, R13 and D81.** The hotbar's
         * cells said nothing until long-pressed (*"more ui on the bag. the
         * click to open sucks"*); a carried item's name and effect line are
         * vital, so every item is also a row of sprite, name and effect line,
         * in the hotbar's order. The press still opens the same `item:` tip.
         */
        if (view.bag.loose.length > 0) {
          const list = el('ul', 'drawer__items');
          for (const id of view.bag.loose) {
            const entry = itemById(id);
            const row = el('li', 'drawer__item');
            const icon = el('span', 'drawer__item-icon');
            icon.append(itemIcon(id));
            icon.setAttribute('aria-hidden', 'true');
            const name = el('span', 'drawer__item-name');
            name.textContent = entry?.name ?? id;
            name.dataset['tip'] = `item:${id}`;
            name.tabIndex = 0;
            name.setAttribute('role', 'button');
            const effect = el('span', 'drawer__item-effect');
            // The berry's lifetime with it, as the party screen's row says it.
            effect.textContent = entry ? `${itemCopy(entry.id)}${entry.consumable ? ' Used up when it fires.' : ''}` : '';
            row.append(icon, name, effect);
            list.append(row);
          }
          bag.append(list);
        }
        const consumables = view.bag.consumables ?? [];
        if (consumables.length > 0) {
          const list = el('ul', 'drawer__items drawer__consumables');
          for (const id of consumables) {
            const row = el('li', 'drawer__item');
            const icon = el('span', 'drawer__item-icon');
            icon.append(placeholderIcon(consumableById(id)?.name ?? id, NATIVE.relic));
            icon.setAttribute('aria-hidden', 'true');
            const name = el('span', 'drawer__item-name');
            name.textContent = consumableById(id)?.name ?? id;
            name.dataset['tip'] = `consumable:${id}`;
            name.tabIndex = 0;
            name.setAttribute('role', 'button');
            const effect = el('span', 'drawer__item-effect');
            effect.textContent = CONSUMABLE_COPY[id] ?? '';
            row.append(icon, name, effect);
            list.append(row);
          }
          bag.append(list);
        }
        if (view.bag.tms.length > 0) {
          const tms = el('ul', 'drawer__tms');
          for (const move of view.bag.tms) {
            const row = el('li', 'drawer__tm');
            row.textContent = move;
            tms.append(row);
          }
          bag.append(tms);
        }
      }

      // Last, so the content is in place before the shell takes focus.
      overlay.open(opener);
    },

    close: () => overlay.close(),
    isOpen: () => overlay.isOpen(),
    showBag() {
      if (typeof bag.scrollIntoView === 'function') bag.scrollIntoView({ block: 'start' });
    },
    onClose: (listener) => overlay.onClose(listener),
  };
}
