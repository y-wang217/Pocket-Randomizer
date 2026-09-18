/**
 * @vitest-environment jsdom
 *
 * A taught move shows the moment it is taught. **The learn-move refresh patch.**
 *
 * ## The reported failure
 *
 * "Once a move is learned, we need to refresh the visual, because we dont give
 * any indication to the player that a move has been replaced - learn move pages
 * should reflect at the moment the player clicks the move to replace. Currently,
 * once the player returns to the map, the visuals reflect."
 *
 * The lag is exactly one node boundary, and it is the item lag of Stage 4.7 one
 * field further down the same plan. A teach is composed on the party screen and
 * `applyItemPlan` folds it at the next boundary; `itemLayoutOf` has previewed
 * the item half since 4.7 and nothing previewed the moves.
 *
 * ## The second half, which the report calls "the learn move order"
 *
 * Both teach questions — who learns it, and what it costs — were asked against
 * `live.party` rather than against the party the plan had already taught. Two
 * TMs pointed at one member is where that shows: the first teach fills the free
 * slot, the second is still asked as though the slot were free, and
 * `reconcileItemPlan` — which reads the running party, correctly — drops it at
 * the boundary with the TM back in the bag and nothing said. That is pinned
 * here as a `core/` property, because it is a defect about agreement between
 * two readings rather than about pixels.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { reconcileItemPlan } from '../src/core/items';
import { createParty, partyAfterTeaches, replacementNeeded, teachApplies } from '../src/core/party';
import type { ItemPlan, PokemonSpec, TmTeach } from '../src/core/types';
import { partyCapacityAfter } from '../src/data/partyTuning';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { partyWithPlan } from '../src/ui/party-layout';
import { createPartyScreen } from '../src/ui/screens/party';

// `process.cwd()` rather than `import.meta.url`: this file runs under jsdom,
// where the module URL comes back `/@fs`-prefixed and does not resolve on disk.
const APP = readFileSync(join(process.cwd(), 'src/ui/app.ts'), 'utf8');

/** Three moves, so the first teach takes the free slot and the second cannot. */
const ROOM: PokemonSpec = {
  species: 'Snorlax',
  ability: 'Thick Fat',
  moves: ['Body Slam', 'Rest', 'Yawn'],
  level: 30,
};
/** Four, so every teach displaces one. */
const FULL: PokemonSpec = {
  species: 'Gengar',
  ability: 'Levitate',
  moves: ['Shadow Ball', 'Sludge Bomb', 'Hypnosis', 'Dream Eater'],
  level: 30,
};

function planWith(teaches: TmTeach[], slots: number): ItemPlan {
  return {
    assignments: Array.from({ length: slots }, (_, slot) => ({ slot, item: null })),
    discards: [],
    teaches,
    discardTms: [],
  };
}

function texts(root: ParentNode, selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((node) => node.textContent ?? '');
}

describe('the party screen draws a teach the moment it is composed', () => {
  it('replaces the displaced move in the card, before any boundary', () => {
    const screen = createPartyScreen();
    document.body.replaceChildren(screen.root);
    const party = createParty([FULL]);
    const view = {
      party,
      backpack: [],
      tms: ['Thunderbolt'],
      teachable: new Set(['Thunderbolt']),
      relics: [],
      tuning: DEFAULT_TUNING,
      slots: partyCapacityAfter(0),
      backTo: 'Back',
    } as const;
    const handlers = {
      onReorder: () => undefined,
      onRelease: () => undefined,
      onPlan: () => undefined,
      onTeach: () => undefined,
      onDone: () => undefined,
    };

    screen.render({ ...view, plan: null }, handlers);
    expect(texts(screen.root, '.party__moves .move__name')).toEqual([
      'Shadow Ball',
      'Sludge Bomb',
      'Hypnosis',
      'Dream Eater',
    ]);

    // What the teach flow hands back: Hypnosis is what the player clicked.
    screen.render(
      { ...view, plan: planWith([{ move: 'Thunderbolt', slot: 0, replaceSlot: 2 }], 1) },
      handlers,
    );
    expect(texts(screen.root, '.party__moves .move__name')).toEqual([
      'Shadow Ball',
      'Sludge Bomb',
      'Thunderbolt',
      'Dream Eater',
    ]);
    // The run itself has not moved. The screen is previewing, not applying.
    expect(party[0]!.spec.moves).toEqual(['Shadow Ball', 'Sludge Bomb', 'Hypnosis', 'Dream Eater']);
  });

  it('spends the TM off the shelf and names the teach it is holding', () => {
    const screen = createPartyScreen();
    const party = createParty([FULL]);
    screen.render(
      {
        party,
        backpack: [],
        tms: ['Thunderbolt'],
        teachable: new Set(['Thunderbolt']),
        relics: [],
        tuning: DEFAULT_TUNING,
        slots: partyCapacityAfter(0),
        backTo: 'Back',
        plan: planWith([{ move: 'Thunderbolt', slot: 0, replaceSlot: 2 }], 1),
      },
      {
        onReorder: () => undefined,
        onRelease: () => undefined,
        onPlan: () => undefined,
        onTeach: () => undefined,
        onDone: () => undefined,
      },
    );
    expect(texts(screen.root, '.tms__item')).toEqual([]);
    expect(screen.root.querySelector('.tms__spent')?.textContent).toBe('Thunderbolt → Gengar');
  });
});

describe('the teach questions are asked against the party the plan has taught', () => {
  /*
   * The app asks both questions through `replacementNeeded` against
   * `partyWithPlan(state.party, pendingPlan)`. Asked against run state instead,
   * a member with one free slot answers `'free'` to every TM pointed at it.
   */
  it('answers the second TM for a member the first one filled', () => {
    const party = createParty([ROOM]);
    const plan = planWith([{ move: 'Earthquake', slot: 0, replaceSlot: null }], 1);

    expect(replacementNeeded(party[0]!, 'Ice Beam'), 'run state alone').toBe('free');
    const shown = partyWithPlan(party, plan);
    expect(replacementNeeded(shown[0]!, 'Ice Beam'), 'the reading the screens use').toBe('choose');
  });

  it('agrees with the boundary about which teaches survive', () => {
    const party = createParty([ROOM]);
    const state = { party, backpack: [], tms: ['Earthquake', 'Ice Beam'] };
    /*
     * The plan the fixed flow composes: the second teach names a victim because
     * it was asked against a member that had already learned the first.
     */
    const plan = planWith(
      [
        { move: 'Earthquake', slot: 0, replaceSlot: null },
        { move: 'Ice Beam', slot: 0, replaceSlot: 0 },
      ],
      1,
    );
    const kept = reconcileItemPlan(state, plan, 8, new Set(state.tms));
    expect(kept.teaches).toHaveLength(2);
    // And the preview the player was shown is what the boundary produces.
    expect(partyWithPlan(party, plan)[0]!.spec.moves).toEqual(['Ice Beam', 'Rest', 'Yawn', 'Earthquake']);

    /*
     * The plan the old flow composed — both asked against run state, so the
     * second named no victim. It is dropped, silently, and the TM stays in the
     * bag. This is the defect, pinned as the thing that must not come back.
     */
    const stale = planWith(
      [
        { move: 'Earthquake', slot: 0, replaceSlot: null },
        { move: 'Ice Beam', slot: 0, replaceSlot: null },
      ],
      1,
    );
    expect(reconcileItemPlan(state, stale, 8, new Set(state.tms)).teaches).toHaveLength(1);
  });

  it('skips a teach the boundary would drop rather than drawing it', () => {
    const party = createParty([ROOM]);
    const stale: TmTeach = { move: 'Ice Beam', slot: 0, replaceSlot: 1 };
    // A victim named for a member with a free slot: `teachMove` throws on it and
    // `reconcileItemPlan` drops it, so the preview must not render it either.
    expect(teachApplies(party[0]!, stale)).toBe(false);
    expect(partyAfterTeaches(party, [stale])[0]!.spec.moves).toEqual(ROOM.moves);
  });

  it('folds in plan order, which is the order the boundary folds in', () => {
    const party = createParty([FULL]);
    const folded = partyAfterTeaches(party, [
      { move: 'Thunderbolt', slot: 0, replaceSlot: 0 },
      { move: 'Ice Beam', slot: 0, replaceSlot: 0 },
    ]);
    expect(folded[0]!.spec.moves[0]).toBe('Ice Beam');
  });
});

/*
 * The wiring, pinned by source the way `test/teach-boundary.test.ts` pins its
 * gate. The flow it guards is three screens deep behind a promise the run is
 * waiting on, and the property is *which party the questions read* — which a
 * rendering assertion cannot see and a grep can.
 */
describe('the app hands the teach flow the plan-folded party', () => {
  it('asks who learns it against the plan, not against run state', () => {
    expect(APP, 'the recipient list is back on run state').toContain(
      'const shown = partyWithPlan(state.party, pendingPlan);',
    );
    expect(APP, 'the recipient is resolved against a party that has not been taught').toContain(
      'const learner = shown[slot];',
    );
  });

  it('draws the read-only surfaces from the same fold', () => {
    expect(APP, 'the drawer is back on the untaught party').toContain(
      'partyWithPlan(decidedParty ?? state.party, pendingPlan)',
    );
    expect(APP, 'the pre-gym cards are back on the untaught party').toContain(
      'party: partyWithPlan(state.party, pendingPlan),',
    );
  });
});
