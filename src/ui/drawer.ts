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
import {
  BATTLE_SPEED_COPY,
  BATTLE_SPEED_HEADING,
  DENSITY_COPY,
  DENSITY_HEADING,
  DRAWER_COPY,
  MOVE_BAR_COPY,
  MOVE_BAR_HEADING,
} from './copy/screens';
import {
  BATTLE_SPEEDS,
  DENSITIES,
  getBattleSpeed,
  getDensity,
  getMoveBar,
  MOVE_BARS,
  onSettingsChange,
  setBattleSpeed,
  setDensity,
  setMoveBar,
} from './settings';
import { memberCardContents } from './member-card';

export interface DrawerView {
  party: readonly PokemonState[];
  /** What each slot is holding, by party index. Read-only here. */
  holding: readonly (ItemId | null)[];
  /** The run's relics. See the layout note in `render`. */
  relics: readonly RelicId[];
  tuning: Tuning;
  /**
   * Whether this is the in-battle drawer.
   *
   * Only difference: the blurb says the party is as the fight left it, because
   * HP on these cards is mid-battle and a player reading it as between-nodes
   * state would be reading a number about a different moment.
   */
  inBattle?: boolean;
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
}

/**
 * The mode picker. **Density modes patch, step 7.**
 *
 * In the drawer because the drawer is the one surface reachable from every
 * screen of a run, and a reading preference belongs where the player is
 * reading: the mode changes under the open drawer as it changes under the
 * screen behind it. Three options, each named and each with one line saying
 * what it does (`ui/copy/screens.ts`, `DENSITY_COPY`); the pressed one is
 * the store's value, repainted on every settings change so a mode set by
 * any other path — the migration, a reset — reads true here.
 *
 * Writes the setting and nothing else. Run state is not in reach of this
 * function, and `test/party-drawer.test.ts` presses every control on the
 * drawer to hold that. The root attribute is not written here either: the
 * app's guard (`ui/density-guard.ts`) hears the store and decides what the
 * root shows, which is how the tutorial keeps Detailed under its marks
 * while a Pocket choice made here waits for them to finish.
 */
function createDensityPicker(): HTMLElement {
  return createPicker({
    heading: DENSITY_HEADING,
    block: 'density',
    attribute: 'density',
    options: DENSITIES.map((mode) => ({ value: mode, ...DENSITY_COPY[mode] })),
    read: getDensity,
    write: setDensity,
  });
}

/**
 * The move bar picker. **The four-column patch, on the same shape.**
 *
 * Under the density picker rather than beside it, because it is the narrower
 * question: density is how much space every fact on every screen costs, and
 * this is the shape of one bar on one screen. A player reads the general
 * setting first.
 *
 * Writes the setting and nothing else, like its neighbour, and the root
 * attribute is written by the shell's own subscription rather than here —
 * `ui/theme/move-bar.ts` says why that seam exists.
 */
function createMoveBarPicker(): HTMLElement {
  return createPicker({
    heading: MOVE_BAR_HEADING,
    block: 'move-bar',
    attribute: 'moveBar',
    options: MOVE_BARS.map((layout) => ({ value: layout, ...MOVE_BAR_COPY[layout] })),
    read: getMoveBar,
    write: setMoveBar,
  });
}

/**
 * The battle speed picker. **The battle animation run, Branch 1.**
 *
 * Last of the three, on the same shape, and narrowest again: density is how
 * much space every fact on every screen costs, the move bar is the shape of one
 * bar on one screen, and this is how long one screen's beats last. A player
 * reads the general setting first.
 *
 * It is a control rather than a second guess at one number. Release C's 500ms
 * was the prompt's default and its comment said it was waiting on a playtest;
 * the playtest said the beats were too fast to see. `data/displayTuning.ts`
 * answers that with 900, and this answers the fact that "too fast" is a
 * judgement rather than a measurement.
 *
 * Writes the setting and nothing else, like both neighbours. The root property
 * is written by the shell's own subscription in `app.ts`, which re-applies
 * `applyMotion` when this moves.
 */
function createBattleSpeedPicker(): HTMLElement {
  return createPicker({
    heading: BATTLE_SPEED_HEADING,
    block: 'battle-speed',
    attribute: 'battleSpeed',
    options: BATTLE_SPEEDS.map((speed) => ({ value: speed, ...BATTLE_SPEED_COPY[speed] })),
    read: getBattleSpeed,
    write: setBattleSpeed,
  });
}

/**
 * One picker, three settings. **Extracted when the second one arrived**, rather
 * than copied — two hand-written pickers is two places for the pressed state,
 * the repaint subscription or the aria wiring to drift, and the drift would be
 * invisible until a screen reader user met the one that was forgotten.
 *
 * `block` is the class prefix and `attribute` the dataset key the choices
 * carry. **Both stay per-picker on purpose.** The first build shared
 * `density__choice` between them, and `test/density-picker.test.ts` — which
 * queries that class and reads `dataset.density` off what it finds — started
 * seeing five buttons and two nulls. A suite that names one picker must keep
 * finding one picker.
 */
function createPicker<T extends string>(spec: {
  heading: string;
  block: string;
  attribute: string;
  options: readonly { value: T; name: string; description: string }[];
  read: () => T;
  write: (value: T) => void;
}): HTMLElement {
  const root = el('div', `picker ${spec.block}`);
  const heading = el('h3', 'drawer__section');
  heading.textContent = spec.heading;
  const list = el('div', `picker__options ${spec.block}__options`);
  const choices = spec.options.map((option) => {
    const row = el('div', `picker__option ${spec.block}__option`);
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = `button button--small picker__choice ${spec.block}__choice`;
    choice.dataset[spec.attribute] = option.value;
    choice.textContent = option.name;
    choice.addEventListener('click', () => spec.write(option.value));
    const description = el('span', `picker__desc ${spec.block}__desc`);
    description.textContent = option.description;
    row.append(choice, description);
    list.append(row);
    return choice;
  });
  const paint = (): void => {
    const current = spec.read();
    for (const choice of choices) {
      choice.setAttribute('aria-pressed', String(choice.dataset[spec.attribute] === current));
    }
  };
  onSettingsChange(paint);
  paint();
  root.append(heading, list);
  return root;
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

  const note = el('p', 'drawer__note');
  setProse(note, DRAWER_COPY.note);

  overlay.body.append(
    blurb,
    members,
    relics,
    note,
    createDensityPicker(),
    createMoveBarPicker(),
    createBattleSpeedPicker(),
  );

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

      members.replaceChildren(
        ...view.party.map((member, index) =>
          memberCardContents(member, {
            holding: view.holding[index] ?? null,
            tuning: view.tuning,
            isLead: index === 0,
            index,
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

      // Last, so the content is in place before the shell takes focus.
      overlay.open(opener);
    },

    close: () => overlay.close(),
    isOpen: () => overlay.isOpen(),
  };
}
