/**
 * The stale item plan, and the soft lock it produced.
 *
 * **The reported failure.** A run at segment 4 took the Gamble on
 * `cave-collapsed-shaft` and drew `t0-bag-rifled`: `+42 coins` against one
 * forced backpack discard. The reveal rendered, Carry on was pressed, and
 * nothing happened — the screen kept the answered question and no control
 * advanced the run. `docs/spec/gymrun-patch-carry-on-softlock.md` has the
 * report and the screenshots.
 *
 * The chain: the player had arranged their bag on the party screen, so
 * `ui/app.ts` was holding an `ItemPlan` naming item ids. That plan is spent at
 * the *next* node boundary, which is after the node resolves — so the event's
 * discard destroyed an item the plan still named, `applyItemPlan` refused the
 * plan with a `RangeError`, and `app.ts`'s bare `catch {}` swallowed it.
 *
 * Both halves are tested here: `reconcileItemPlan` brings a plan forward onto
 * the inventory that actually exists, and `pending.ts` makes an abandoned run
 * a type the catch can recognise so that everything else reaches the player.
 */
import { describe, expect, it } from 'vitest';

import { createRun, resolveNode, type NodeResult, type RunState } from '../src/core/run';
import { applyItemPlan, backpackCapacity, reconcileItemPlan } from '../src/core/items';
import { createPartyMember } from '../src/core/party';
import { createPending, isRunAbandoned } from '../src/ui/pending';
import type { EventInstance, EventOption, EventOutcome, ResolvedEffect } from '../src/core/events';
import type { EventArchetype } from '../src/data/eventPools';
import type { ItemId, ItemPlan } from '../src/core/types';
import { DEFAULT_TUNING } from '../src/data/tuning';

// --- The reported node, rebuilt ------------------------------------------

function outcomeOf(grant: readonly ResolvedEffect[], cost: readonly ResolvedEffect[] = []): EventOutcome {
  return { tier: 'T0', entryId: 't0-bag-rifled', cost, grant };
}

function option(archetype: EventArchetype, paid: EventOutcome): EventOption {
  return {
    archetype,
    label: 'Shift the rubble by hand',
    hint: 'The pile is holding itself up.',
    toll: null,
    outcomes: { T0: paid, T1: paid, T2: paid, T3: paid },
    tierAt: { none: 'T0', latent: 'T0', known: 'T0' },
  };
}

function collapsedShaft(paid: EventOutcome): EventInstance {
  return {
    nodeId: 'n1',
    eventId: 'cave-collapsed-shaft',
    locale: 'cave',
    rarity: 'common',
    prompt: 'A collapsed shaft, and something metallic under the rubble.',
    requires: 'strength',
    options: [option('gamble', paid)],
  };
}

/** The reported party: two members, one holding a Sharp Beak, two loose items. */
function reportedRun(): RunState {
  const base = createRun('SOFTLOCK', DEFAULT_TUNING);
  return {
    ...base,
    backpack: ['leftovers', 'charcoal'],
    currency: 100,
    relics: [],
    party: [
      {
        ...createPartyMember({ species: 'Goodra', ability: 'Sap Sipper', moves: ['Dragon Tail'], level: 48 }),
        item: 'sharpbeak',
      },
      createPartyMember({ species: 'Staraptor', ability: 'Intimidate', moves: ['Brave Bird'], level: 48 }),
    ],
  };
}

/** `+42 coins` against one forced discard, resolved onto the run. */
function walkIntoTheShaft(state: RunState): RunState {
  const paid = outcomeOf([{ kind: 'currency', amount: 42 }], [{ kind: 'discard', count: 1 }]);
  const node = {
    ...state.segments[0]!.gym,
    kind: 'event' as const,
    encounter: null,
    event: collapsedShaft(paid),
  };
  const result: NodeResult = { node, eventChoice: 'gamble' };
  return resolveNode(state, result);
}

const capacityOf = (state: RunState): number => backpackCapacity(state.party.length, state.tuning);

describe('the plan the player left the party screen with', () => {
  it('is refused outright once the event has taken the item it names', () => {
    const before = reportedRun();
    // What `screens/party.ts` emits when the Charcoal is equipped onto slot 1:
    // every slot named, because a plan is a destination rather than a diff.
    const composed: ItemPlan = {
      assignments: [
        { slot: 0, item: 'sharpbeak' },
        { slot: 1, item: 'charcoal' },
      ],
      discards: [],
    };

    const after = walkIntoTheShaft(before);
    expect(after.currency).toBe(before.currency + 42);
    expect(after.backpack).toEqual(['leftovers']);

    expect(() => applyItemPlan(after, composed, capacityOf(after))).toThrow(/does not hold/);
  });

  it('is brought forward instead, and keeps every assignment the run can still honour', () => {
    const after = walkIntoTheShaft(reportedRun());
    const composed: ItemPlan = {
      assignments: [
        { slot: 0, item: 'sharpbeak' },
        { slot: 1, item: 'charcoal' },
      ],
      discards: [],
    };

    const plan = reconcileItemPlan(after, composed, capacityOf(after));
    const applied = applyItemPlan(after, plan, capacityOf(after));

    // The Sharp Beak stays where the player put it; the destroyed Charcoal
    // leaves slot 1 empty rather than taking the Sharp Beak down with it.
    expect(applied.party[0]?.item).toBe('sharpbeak');
    expect(applied.party[1]?.item).toBeUndefined();
    expect(applied.backpack).toEqual(['leftovers']);
  });

  it('does not lose a second item to the first one going missing', () => {
    // The swap case: slot 0 is to take the Charcoal and slot 1 the Sharp Beak
    // it gives up. Dropping the first assignment rather than emptying the hand
    // would leave the Sharp Beak on slot 0 and out of the pool, so the second
    // assignment would be refused too.
    const after = walkIntoTheShaft(reportedRun());
    const composed: ItemPlan = {
      assignments: [
        { slot: 0, item: 'charcoal' },
        { slot: 1, item: 'sharpbeak' },
      ],
      discards: [],
    };

    const applied = applyItemPlan(after, reconcileItemPlan(after, composed, capacityOf(after)), capacityOf(after));
    expect(applied.party[1]?.item).toBe('sharpbeak');
    expect(applied.party[0]?.item).toBeUndefined();
  });

  it('drops a discard of something the run no longer holds', () => {
    const after = walkIntoTheShaft(reportedRun());
    const composed: ItemPlan = { assignments: [], discards: ['charcoal'] };
    const plan = reconcileItemPlan(after, composed, capacityOf(after));
    expect(plan.discards).toEqual([]);
    expect(applyItemPlan(after, plan, capacityOf(after)).backpack).toEqual(['leftovers']);
  });

  it('discards the oldest when a grant has put the bag over capacity', () => {
    const state = { ...reportedRun(), backpack: ['leftovers', 'charcoal', 'mysticwater', 'magnet'] as ItemId[] };
    const plan = reconcileItemPlan(state, { assignments: [], discards: [] }, 2);
    expect(plan.discards).toEqual(['leftovers', 'charcoal']);
    expect(applyItemPlan(state, plan, 2).backpack).toEqual(['mysticwater', 'magnet']);
  });

  it('drops an assignment naming a slot the party no longer has, and a slot named twice', () => {
    const state = reportedRun();
    const plan = reconcileItemPlan(
      state,
      {
        assignments: [
          { slot: 0, item: 'leftovers' },
          { slot: 0, item: 'charcoal' },
          { slot: 9, item: 'charcoal' },
        ],
        discards: [],
      },
      capacityOf(state),
    );
    expect(plan.assignments).toEqual([{ slot: 0, item: 'leftovers' }]);
    expect(() => applyItemPlan(state, plan, capacityOf(state))).not.toThrow();
  });

  /**
   * The property the fix rests on: whatever a stale plan says, what comes back
   * is a plan `applyItemPlan` accepts. Legality by construction, so a new way
   * for a node to change the bag cannot reopen this.
   */
  it('always returns a plan the run will accept', () => {
    const state = walkIntoTheShaft(reportedRun());
    const capacity = capacityOf(state);
    const ghosts: ItemId[] = ['charcoal', 'mysticwater', 'sitrusberry', 'magnet'];
    const plans: ItemPlan[] = [
      { assignments: [], discards: [] },
      { assignments: [{ slot: 0, item: null }], discards: ['leftovers'] },
      { assignments: ghosts.map((item, slot) => ({ slot, item })), discards: [...ghosts] },
      { assignments: [{ slot: 1, item: 'leftovers' }], discards: ['leftovers'] },
      { assignments: [{ slot: 0, item: 'sharpbeak' }], discards: ['sharpbeak'] },
      { assignments: [{ slot: 0, item: null }, { slot: 1, item: null }], discards: [] },
    ];

    for (const plan of plans) {
      const brought = reconcileItemPlan(state, plan, capacity);
      expect(() => applyItemPlan(state, brought, capacity)).not.toThrow();
    }
  });
});

describe('an abandoned run is a type the app can recognise', () => {
  it('rejects with something isRunAbandoned answers to', async () => {
    const pending = createPending<number>();
    const waiting = pending.wait();
    pending.cancel();
    await expect(waiting).rejects.toSatisfy(isRunAbandoned);
  });

  it('does not answer to the RangeError core raises for an illegal answer', () => {
    expect(isRunAbandoned(new RangeError('Item plan discards a charcoal'))).toBe(false);
    expect(isRunAbandoned(new Error('Run did not reach an outcome'))).toBe(false);
  });
});
