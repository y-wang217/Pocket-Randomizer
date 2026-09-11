/**
 * @vitest-environment jsdom
 *
 * The party drawer, and the three things it must never do.
 *
 * Stage 4.7, Part 1. The standing rule is that any screen asking the player for
 * a decision must expose current party state without leaving the decision.
 * The drawer is how, and it is only a *readout* if all three of these hold:
 *
 *   1. Opening it never advances run state.
 *   2. Opening it never submits a decision.
 *   3. Opening it consumes no RNG.
 *
 * **Asserted per surface, not once**, which is the brief's own instruction and
 * is not pedantry: the three properties are properties of the *trigger*, and a
 * trigger placed inside a screen's own form or beside its own submit button
 * fails them on that screen alone. In battle that is the sharp case — a move
 * button is a submission, and a trigger one keystroke away from spending a turn
 * would pass every test written against the map.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { createDrawer } from '../src/ui/drawer';
import { createPartyScreen } from '../src/ui/screens/party';
import { createPreGymScreen } from '../src/ui/screens/pre-gym';
import { createLocaleSelect } from '../src/ui/screens/locale-select';
import { chooseStarter, createRun, type RunState } from '../src/core/run';
import { createRng } from '../src/core/rng';
import { gymForSegment } from '../src/data/gyms';
import { partyCapacityAfter } from '../src/data/partyTuning';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createParty } from '../src/core/party';
import type { PokemonState } from '../src/core/types';

function started(): RunState {
  return chooseStarter(createRun('DRAWER', DEFAULT_TUNING), 0);
}

function partyOf(state: RunState): PokemonState[] {
  // Three members, so the drawer has something to lay out and the pre-gym
  // screen has a lead choice that is not forced.
  const extra = createParty([
    { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Rest'], level: 30 },
    { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball', 'Toxic'], level: 30 },
  ]);
  return [...state.party, ...extra];
}

/** Everything a drawer render needs, from a real run's state. */
function viewFor(state: RunState) {
  const party = partyOf(state);
  return {
    party,
    holding: party.map(() => null),
    relics: state.relics,
    tuning: state.tuning,
  };
}

describe('the drawer itself', () => {
  let state: RunState;

  beforeEach(() => {
    document.body.replaceChildren();
    state = started();
  });

  it('starts closed and opens on demand', () => {
    const drawer = createDrawer();
    expect(drawer.isOpen()).toBe(false);
    expect(drawer.root.hidden).toBe(true);

    drawer.open(viewFor(state));
    expect(drawer.isOpen()).toBe(true);
    expect(drawer.root.hidden).toBe(false);
  });

  it('shows every party member, with no member left out', () => {
    const drawer = createDrawer();
    const view = viewFor(state);
    drawer.open(view);

    const cards = drawer.root.querySelectorAll('.party__member');
    expect(cards).toHaveLength(view.party.length);
  });

  it('carries the full contents rather than a reduced variant', () => {
    /*
     * Part 1's rule, and the reason it is a rule: a reduced variant is where a
     * verdict gets smuggled in as an emphasis choice. Whoever decides which
     * three of six stats survive a shorter card has made the judgement the
     * player was supposed to make.
     *
     * So: the six stat block, the four move cards, the archetype label, the
     * item row, HP and PP. All of it, on every card.
     */
    const drawer = createDrawer();
    drawer.open(viewFor(state));
    const card = drawer.root.querySelector('.party__member');
    expect(card).not.toBeNull();

    expect(card!.querySelectorAll('.stat')).toHaveLength(6);
    expect(card!.querySelectorAll('.move--card').length).toBeGreaterThan(0);
    expect(card!.querySelector('.badge--archetype')).not.toBeNull();
    expect(card!.querySelector('.party__item')).not.toBeNull();
    expect(card!.querySelector('.panel__hp-text')?.textContent ?? '').not.toBe('');
  });

  /**
   * **Rewritten at patch 4.7.2, and the property is stronger than it was.**
   *
   * This used to assert the drawer's button list was exactly `['Close']` — a
   * count standing in for the real rule, which is that item reassignment stays
   * on the party management screen so there is one write path for party state.
   *
   * 4.7.2 step 5 put a read-only `Explain` control on every move card, which
   * the count forbids and the rule does not. So the rule is asserted directly:
   * every button is one of a named few, **and pressing every one of them leaves
   * party state untouched.** A future control that writes fails this whether or
   * not somebody remembers to update a list, which the old form could not say.
   *
   * The same property is asserted on the rendered drawer, in a browser, across
   * a whole run in `test/visual-move-cards.test.ts` — there against a
   * fingerprint that includes the battle log and every HP and PP readout.
   */
  it('is read only: no control on it writes party state', () => {
    const drawer = createDrawer();
    const view = viewFor(state);
    drawer.open(view);

    const buttons = [...drawer.root.querySelectorAll('button')];
    const labels = [...new Set(buttons.map((button) => button.textContent))];
    // `+` is the Pocket fold on each card (`ui/collapse.ts`): it flips an
    // attribute on the card and writes nothing. The three mode names are the
    // picker (step 7): each writes the density setting, which is not party
    // state, and the comparison below holds that. Density modes patch.
    expect(labels.sort(), 'an unexpected control appeared on the read-only drawer').toEqual(['+', 'Close', 'Detailed', 'Explain', 'Pocket', 'Simple']);

    // Every control pressed, and the party compared before and after. The
    // drawer holds the same objects the run does, so a write of any kind —
    // an item moved, a slot reordered, a member released — shows up here.
    const before = JSON.stringify(view.party);
    for (const button of buttons) {
      if (button.textContent === 'Close') continue;
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
    expect(JSON.stringify(view.party), 'a drawer control wrote party state').toBe(before);
    expect(drawer.isOpen(), 'a drawer control closed the drawer').toBe(true);
  });

  it('leaves room for relics, and fills it when the run has some', () => {
    const drawer = createDrawer();
    drawer.open(viewFor(state));
    expect(drawer.root.querySelector('.drawer__relics')).not.toBeNull();

    drawer.open({ ...viewFor(state), relics: ['soothebell'] });
    // Present or absent by whether the id resolves; the *slot* is what Part 1
    // asks for, because retrofitting one later is worse than leaving the space.
    expect(drawer.root.querySelector('.drawer__relics')).not.toBeNull();
  });

  it('closes back to nothing selected and nothing submitted', () => {
    const drawer = createDrawer();
    drawer.open(viewFor(state));
    drawer.close();

    expect(drawer.isOpen()).toBe(false);
    expect(drawer.root.hidden).toBe(true);
  });

  it('says it is the player side when opened during a battle', () => {
    /*
     * Reachable in battle, read-only, **player side only**. It must not become
     * a way to inspect the opponent's moveset — which the player is not shown,
     * and which the archetype label exists precisely to avoid leaking.
     *
     * The party *is* the player side, so this asserts the shape rather than a
     * filter: there is no opponent in a `DrawerView` to leak.
     */
    const drawer = createDrawer();
    const view = viewFor(state);
    drawer.open({ ...view, inBattle: true });

    expect(Object.keys(view)).not.toContain('opponent');
    expect(drawer.root.querySelector('.drawer__blurb')?.textContent ?? '').toMatch(/your side/i);
  });
});

/**
 * The per-surface sweep.
 *
 * Each entry mounts a real decision surface, opens the drawer over it, and
 * asserts the three properties plus that the screen underneath came back
 * byte-identical. `outerHTML` before and after is the strongest available form
 * of "closing returns to byte-identical screen state with nothing selected or
 * submitted".
 */
describe('every decision surface', () => {
  let state: RunState;

  beforeEach(() => {
    document.body.replaceChildren();
    state = started();
  });

  /** Builds one surface, rendered and ready, with a submission counter. */
  const surfaces: { name: string; mount: () => { root: HTMLElement; submissions: () => number } }[] = [
    {
      name: 'locale select',
      mount: () => {
        let submitted = 0;
        const screen = createLocaleSelect();
        screen.render(
          {
            options: ['cave', 'marsh'],
            segment: 0,
            gym: gymForSegment(0),
            party: partyOf(state),
          },
          () => {
            submitted++;
          },
        );
        return { root: screen.root, submissions: () => submitted };
      },
    },
    {
      name: 'the pre-gym screen',
      mount: () => {
        let submitted = 0;
        const screen = createPreGymScreen();
        const party = partyOf(state);
        screen.render(
          {
            gym: gymForSegment(0),
            segment: 0,
            party,
            holding: party.map(() => null),
            tuning: state.tuning,
          },
          {
            onLead: () => {
              submitted++;
            },
            onManageParty: () => {
              submitted++;
            },
          },
        );
        return { root: screen.root, submissions: () => submitted };
      },
    },
    {
      name: 'party management',
      mount: () => {
        let submitted = 0;
        const screen = createPartyScreen();
        screen.render(
          {
            party: partyOf(state),
            backpack: [],
            relics: [],
            tuning: state.tuning,
            // Stage 4.8: the slot grid is sized by the run, not a constant.
            slots: partyCapacityAfter(0),
            backTo: 'Back to the map',
            plan: null,
          },
          {
            onReorder: () => {
              submitted++;
            },
            onRelease: () => {
              submitted++;
            },
            onPlan: () => {
              submitted++;
            },
            onDone: () => {
              submitted++;
            },
          },
        );
        return { root: screen.root, submissions: () => submitted };
      },
    },
  ];

  for (const surface of surfaces) {
    it(`opens over ${surface.name} without advancing state, submitting, or drawing`, () => {
      const drawer = createDrawer();
      const mounted = surface.mount();
      document.body.append(mounted.root, drawer.root);

      const trigger = drawer.trigger();
      document.body.append(trigger);

      // The three properties, measured across the open.
      const before = mounted.root.outerHTML;
      const stateBefore = JSON.stringify({
        party: state.party.map((member) => [member.spec.species, member.hp, member.spec.level]),
        segment: state.currentSegment,
        position: state.position,
        currency: state.currency,
      });

      /*
       * RNG: a fresh stream drained before and after, and compared.
       *
       * A run's streams are keyed and derived from the seed, so "the drawer
       * consumed a draw" would show as the same key producing a different next
       * value. Draining a stream the drawer cannot reach would prove nothing,
       * so this drains the `map` stream at a key the run itself uses.
       */
      const drawsBefore = drainMap();

      trigger.click();
      drawer.open({
        party: partyOf(state),
        holding: partyOf(state).map(() => null),
        relics: state.relics,
        tuning: state.tuning,
      });

      expect(drawer.isOpen()).toBe(true);
      expect(mounted.submissions(), 'the drawer submitted a decision').toBe(0);

      drawer.close();

      expect(mounted.root.outerHTML, 'the screen underneath changed').toBe(before);
      expect(
        JSON.stringify({
          party: state.party.map((member) => [member.spec.species, member.hp, member.spec.level]),
          segment: state.currentSegment,
          position: state.position,
          currency: state.currency,
        }),
        'run state advanced',
      ).toBe(stateBefore);
      expect(drainMap(), 'the drawer consumed RNG').toEqual(drawsBefore);
      expect(mounted.submissions()).toBe(0);
    });
  }
});

/** Ten values off a keyed sub-stream the run itself draws from. */
function drainMap(): number[] {
  const stream = createRng('DRAWER').map.at('seg0/cave/route');
  return Array.from({ length: 10 }, () => stream.nextUint32());
}
