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
import { DENSITY_COPY, DENSITY_HEADING, DRAWER_COPY } from './copy/screens';
import { DENSITIES, getDensity, onSettingsChange, setDensity } from './settings';
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
  open(view: DrawerView): void;
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
  const root = el('div', 'density');
  const heading = el('h3', 'drawer__section');
  heading.textContent = DENSITY_HEADING;
  const list = el('div', 'density__options');
  const choices = DENSITIES.map((mode) => {
    const row = el('div', 'density__option');
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'button button--small density__choice';
    choice.dataset['density'] = mode;
    choice.textContent = DENSITY_COPY[mode].name;
    choice.addEventListener('click', () => setDensity(mode));
    const description = el('span', 'density__desc');
    description.textContent = DENSITY_COPY[mode].description;
    row.append(choice, description);
    list.append(row);
    return choice;
  });
  const paint = (): void => {
    const current = getDensity();
    for (const choice of choices) choice.setAttribute('aria-pressed', String(choice.dataset['density'] === current));
  };
  onSettingsChange(paint);
  paint();
  root.append(heading, list);
  return root;
}

export function createDrawer(): Drawer {
  const root = el('div', 'drawer');
  root.hidden = true;
  // A dialog rather than a div with a class: the overlay traps nothing and
  // announces itself, and a screen reader user who opens it lands inside it.
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Your party');

  const scrim = el('div', 'drawer__scrim');
  const sheet = el('div', 'drawer__sheet');

  const header = el('div', 'drawer__header');
  const title = el('h2', 'drawer__title');
  title.textContent = 'Your party';
  const blurb = el('p', 'drawer__blurb');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'button button--small drawer__close';
  close.textContent = 'Close';
  header.append(title, close);

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

  sheet.append(header, blurb, members, relics, note, createDensityPicker());
  root.append(scrim, sheet);

  let open = false;

  function hide(): void {
    open = false;
    root.hidden = true;
  }

  close.addEventListener('click', hide);
  // Tapping the scrim closes, like every sheet on a phone. The sheet itself
  // stops the click so a tap inside it does not fall through to the scrim.
  scrim.addEventListener('click', hide);
  sheet.addEventListener('click', (event) => event.stopPropagation());
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });

  return {
    root,

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
      button.className = 'button button--small drawer__trigger';
      button.textContent = 'Party';
      button.setAttribute('aria-haspopup', 'dialog');
      // `data-drawer-trigger` is what `test/party-drawer.test.ts` finds on each
      // surface. A test that looked for the label would break on a copy edit.
      button.dataset['drawerTrigger'] = 'true';
      return button;
    },

    open(view) {
      open = true;
      root.hidden = false;
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

      close.focus();
    },

    close: hide,
    isOpen: () => open,
  };
}
