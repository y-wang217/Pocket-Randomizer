/**
 * @vitest-environment jsdom
 *
 * The map overlay, and the four things it must never do.
 *
 * The party drawer's three properties, asserted the way
 * `test/party-drawer.test.ts` asserts them — **per surface, not once** — plus
 * one that is this overlay's own:
 *
 *   1. Opening it never advances run state.
 *   2. Opening it never submits a decision.
 *   3. Opening it consumes no RNG.
 *   4. **Nothing inside it is a control.**
 *
 * The fourth is the sharp one here, and it is why this file exists rather than
 * a line added to the party drawer's. `CLAUDE.md` Rewards says every node
 * completion routes through the single result screen and there is never a
 * second path by which a node completes. The map screen is that path. An
 * overlay that rendered the same chain *and* wired its nodes would be a second
 * one — reachable from inside a battle, which is the sharp case, because a
 * node picked mid-fight is a decision the run loop is not waiting on.
 *
 * It holds structurally rather than by care: `renderChain` is called with no
 * `onChoose`, and `renderNode` renders a div rather than a button when none is
 * passed. This asserts the structure, so the day somebody threads a callback
 * through for convenience, this is what stops them.
 *
 * The reveal rules (`CLAUDE.md`, "Player-facing copy") are not asserted here at
 * all, deliberately. They cannot be violated by this file: it calls the map
 * screen's own `renderRail`, `renderHeading` and `renderChain`, so it shows
 * exactly what that screen shows. A test asserting "no verdict words" here
 * would be testing `run-map.ts` through a second door.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { createMapDrawer } from '../src/ui/map-drawer';
import { createDrawer } from '../src/ui/drawer';
import { createPartyScreen } from '../src/ui/screens/party';
import { createShopScreen } from '../src/ui/screens/shop';
import { createPreGymScreen } from '../src/ui/screens/pre-gym';
import { MAP_SURFACES, DRAWER_SURFACES } from '../src/ui/screens/router';
import { chooseStarter, createRun, type RunState } from '../src/core/run';
import { createRng } from '../src/core/rng';
import { gymForSegment } from '../src/data/gyms';
import { partyCapacityAfter } from '../src/data/partyTuning';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createParty } from '../src/core/party';
import type { PokemonState } from '../src/core/types';

function started(): RunState {
  return chooseStarter(createRun('MAPDRAWER', DEFAULT_TUNING), 0);
}

/** A locale committed, so there is a route and therefore a chain to draw. */
function walking(): RunState {
  const state = started();
  return { ...state, localeChoices: state.localeChoices.map((_, index) => (index === 0 ? 0 : null)) };
}

function partyOf(state: RunState): PokemonState[] {
  const extra = createParty([
    { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Rest'], level: 30 },
    { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball', 'Toxic'], level: 30 },
  ]);
  return [...state.party, ...extra];
}

describe('the map overlay itself', () => {
  let state: RunState;

  beforeEach(() => {
    document.body.replaceChildren();
    state = walking();
  });

  it('starts closed and opens on demand', () => {
    const map = createMapDrawer();
    expect(map.isOpen()).toBe(false);
    expect(map.root.hidden).toBe(true);

    map.open(state);
    expect(map.isOpen()).toBe(true);
    expect(map.root.hidden).toBe(false);
  });

  it('shows the whole eight-gym rail, not just the current segment', () => {
    /*
     * The rail is why this is a readout about *the run* rather than about the
     * next three steps. `run-map.ts` states the reason: "Volta's Gym" means
     * nothing on its own and "gym 3 of 8, five to go" means everything.
     */
    const map = createMapDrawer();
    map.open(state);
    expect(map.root.querySelectorAll('.rail__gym')).toHaveLength(state.segments.length);
  });

  it('shows the segment heading and the committed route', () => {
    const map = createMapDrawer();
    map.open(state);

    expect(map.root.querySelector('.screen__title')?.textContent ?? '').toMatch(/Gym 1 of 8/);
    expect(map.root.querySelectorAll('.step').length).toBeGreaterThan(1);
    // The gym caps the chain, so there is always one more row than steps.
    expect(map.root.querySelectorAll('.node').length).toBeGreaterThan(1);
  });

  /**
   * **The property this file exists for.**
   *
   * Not "no button labelled like a node" — no button *at all* inside the chain,
   * and no `.node` that is a button anywhere in the overlay. A count of labels
   * would pass the day somebody wires a node and gives it no text.
   */
  it('contains no control that could pick a node', () => {
    const map = createMapDrawer();
    map.open(state);

    const nodes = [...map.root.querySelectorAll('.node')];
    expect(nodes.length, 'no nodes rendered, so the assertion below is vacuous').toBeGreaterThan(0);
    expect(nodes.filter((node) => node.tagName === 'BUTTON'), 'a node in the overlay is pressable').toEqual([]);
    expect([...map.root.querySelectorAll('.map-drawer__chain button')], 'a control appeared in the chain').toEqual([]);

    // Close is the only button the overlay owns. The shell puts it there.
    const labels = [...new Set([...map.root.querySelectorAll('button')].map((b) => b.textContent))];
    expect(labels, 'an unexpected control appeared on the read-only overlay').toEqual(['Close']);
  });

  it('closes back to hidden', () => {
    const map = createMapDrawer();
    map.open(state);
    map.close();

    expect(map.isOpen()).toBe(false);
    expect(map.root.hidden).toBe(true);
  });

  it('returns focus to the control that opened it', () => {
    const map = createMapDrawer();
    const trigger = map.trigger();
    document.body.append(map.root, trigger);

    trigger.focus();
    map.open(state, trigger);
    // The shell takes focus so Escape is heard and a screen reader lands inside.
    expect(document.activeElement?.textContent).toBe('Close');

    map.close();
    expect(document.activeElement, 'focus did not return to the trigger').toBe(trigger);
  });

  it('is its own trigger, distinguishable from the party drawer’s', () => {
    /*
     * Both buttons sit in the same bar. `test/party-drawer.test.ts` counts
     * `[data-drawer-trigger]` per surface, and the smoke script asserts "the
     * party drawer is reachable in a battle (1 triggers)" — sharing one
     * attribute would have made both of those wrong on every screen.
     */
    const trigger = createMapDrawer().trigger();
    expect(trigger.dataset['mapTrigger']).toBe('true');
    expect(trigger.dataset['drawerTrigger']).toBeUndefined();
    expect(trigger.textContent).toBe('Map');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');

    // It mimics the Party button, which is the brief's word, through the shared
    // *look* class rather than the party drawer's own.
    expect(trigger.classList.contains('shell__trigger')).toBe(true);
    /*
     * **And it must not wear `drawer__trigger`.** It did, briefly, and
     * `test/visual-move-cards.test.ts` — which selects `.drawer__trigger` and
     * takes `.first()` — started resolving to this button instead, timing out
     * because it is hidden on the map screen. Asserted rather than remembered.
     */
    expect(trigger.classList.contains('drawer__trigger'), 'the map trigger wears the party trigger’s identity class').toBe(false);
    expect(createDrawer().trigger().classList.contains('shell__trigger'), 'the two triggers stopped sharing a look').toBe(true);
  });

  it('renders nothing rather than throwing when a run has no current segment', () => {
    const map = createMapDrawer();
    // Past the last gym: `segments[currentSegment]` is undefined.
    map.open({ ...state, currentSegment: state.segments.length });
    expect(map.isOpen(), 'the overlay opened on a run with no segment to show').toBe(false);
  });
});

describe('where the trigger appears', () => {
  it('is offered on every decision surface except the map and the locale screen', () => {
    /*
     * The two exclusions, each for its own reason, both recorded in
     * `screens/router.ts`: the map screen already *is* this readout, and the
     * locale screen has no committed route to show.
     *
     * Asserted as a set rather than a literal list so a future decision surface
     * is picked up by both constants at once.
     */
    expect([...MAP_SURFACES].sort()).toEqual([...DRAWER_SURFACES].filter((n) => n !== 'map' && n !== 'locale').sort());
    expect(MAP_SURFACES).not.toContain('map');
    expect(MAP_SURFACES).not.toContain('locale');
    expect(MAP_SURFACES).toContain('battle');
    expect(MAP_SURFACES).toContain('shop');
    expect(MAP_SURFACES).toContain('event');
  });
});

/**
 * The per-surface sweep.
 *
 * Each entry mounts a real decision surface, opens the overlay over it, and
 * asserts the four properties plus that the screen underneath came back
 * byte-identical. `outerHTML` before and after is the strongest available form
 * of "closing returns to byte-identical screen state with nothing selected or
 * submitted" — a half-filled shop basket is the case that matters, and the
 * shop is in the list for exactly that reason.
 */
describe('every decision surface', () => {
  let state: RunState;

  beforeEach(() => {
    document.body.replaceChildren();
    state = walking();
  });

  const surfaces: { name: string; mount: () => { root: HTMLElement; submissions: () => number } }[] = [
    {
      /*
       * The sharp case for "closing returns to byte-identical screen state".
       * A shop basket is the one decision surface that holds *partial* input,
       * so a route in place of an overlay would take a half-filled basket with
       * it. The stock is a real one off the seed's own map rather than a
       * constructed shelf, so the screen renders what a player would see.
       */
      name: 'the shop',
      mount: () => {
        let submitted = 0;
        const screen = createShopScreen();
        // Anywhere on the seed's map: which segment the shelf came from does
        // not matter to the property under test, and pinning it to the first
        // route made this fail on a seed that simply had none there.
        const stock = state.segments
          .flatMap((segment) => segment.routes)
          .flatMap((route) => route.steps)
          .flatMap((step) => step.options)
          .find((node) => node.shop)?.shop;
        if (!stock) throw new Error('the seed produced no shop anywhere on its map');
        screen.render(stock, state, () => {
          submitted++;
        });
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
          { gym: gymForSegment(0), segment: 0, party, holding: party.map(() => null), tuning: state.tuning },
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
        const bump = (): void => {
          submitted++;
        };
        screen.render(
          {
            party: partyOf(state),
            backpack: [],
            tms: [],
            canTeach: true,
            relics: [],
            tuning: state.tuning,
            slots: partyCapacityAfter(0),
            backTo: 'Back to the map',
            plan: null,
          },
          { onReorder: bump, onRelease: bump, onPlan: bump, onTeach: bump, onDone: bump },
        );
        return { root: screen.root, submissions: () => submitted };
      },
    },
  ];

  for (const surface of surfaces) {
    it(`opens over ${surface.name} without advancing state, submitting, or drawing`, () => {
      const map = createMapDrawer();
      const mounted = surface.mount();
      document.body.append(mounted.root, map.root);

      const trigger = map.trigger();
      document.body.append(trigger);

      const before = mounted.root.outerHTML;
      const snapshot = (): string =>
        JSON.stringify({
          party: state.party.map((member) => [member.spec.species, member.hp, member.spec.level]),
          segment: state.currentSegment,
          position: state.position,
          currency: state.currency,
          history: state.history.length,
        });
      const stateBefore = snapshot();
      const drawsBefore = drainMap();

      trigger.click();
      map.open(state, trigger);

      expect(map.isOpen()).toBe(true);
      expect(mounted.submissions(), 'the overlay submitted a decision').toBe(0);
      // Property 4, on every surface rather than once: there is no control in
      // here that could reach the run loop, whatever screen is underneath.
      expect(
        [...map.root.querySelectorAll('.map-drawer__chain button')],
        'a control appeared in the chain',
      ).toEqual([]);

      map.close();

      expect(mounted.root.outerHTML, 'the screen underneath changed').toBe(before);
      expect(snapshot(), 'run state advanced').toBe(stateBefore);
      expect(drainMap(), 'the overlay consumed RNG').toEqual(drawsBefore);
      expect(mounted.submissions()).toBe(0);
    });
  }
});

/** Ten values off a keyed sub-stream the run itself draws from. */
function drainMap(): number[] {
  const stream = createRng('MAPDRAWER').map.at('seg0/cave/route');
  return Array.from({ length: 10 }, () => stream.nextUint32());
}
