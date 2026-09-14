/**
 * An event's item reaches the bag. **A regression suite for a bug that shipped
 * in Stage 4.5.1 and survived until the event rejig found it.**
 *
 * `applyEventOutcome` has folded an item into `state.backpack` since 4.5.1
 * (`0b450d2`, "a bag that catches things"), and its unit tests have always
 * passed — the fold is correct. What was wrong was the *caller*: `resolveNode`
 * took `party` and `currency` off the returned state and dropped `backpack` on
 * the floor, so every item an event ever paid was folded into a value nobody
 * read.
 *
 * The shape of the defect is worth naming, because it is the same one the
 * storage validator had a day earlier: a change to what a fold *returns* has to
 * be walked through everything that reads it, and neither the type system nor
 * a unit test of the fold can see the gap. Both ends were individually correct.
 *
 * So these tests are deliberately at the `resolveNode` seam rather than at
 * `applyEventOutcome`, which is where the existing coverage already was.
 */
import { describe, expect, it } from 'vitest';

import { createRun, resolveNode, type NodeResult, type RunState } from '../src/core/run';
import { createPartyMember } from '../src/core/party';
import type { EventInstance, EventOption, EventOutcome, ResolvedEffect } from '../src/core/events';
import type { EventArchetype } from '../src/data/eventPools';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { RELIC_IDS, type RelicId } from '../src/data/relics';

/** A drawn relic grant: an order to walk, and the item behind it. */
function relicEffect(order: readonly RelicId[]): ResolvedEffect {
  return { kind: 'relic', order, fallback: { kind: 'item', items: ['leftovers'] } };
}

function outcomeOf(grant: readonly ResolvedEffect[], cost: readonly ResolvedEffect[] = []): EventOutcome {
  return { tier: cost.length > 0 ? 'T0' : 'T1', entryId: 'test', cost, grant };
}

function option(archetype: EventArchetype, paid: EventOutcome): EventOption {
  return {
    archetype,
    label: archetype,
    hint: archetype,
    toll: null,
    outcomes: { T0: paid, T1: paid, T2: paid, T3: paid },
    tierAt: { none: 'T1', latent: 'T1', known: 'T1' },
  };
}

function eventWith(paid: EventOutcome): EventInstance {
  return {
    nodeId: 'n1',
    eventId: 'test',
    locale: 'forest',
    rarity: 'common',
    prompt: 'p',
    requires: 'cut',
    options: [option('safe', paid)],
  };
}

/** A run with a party, a bag and a purse, holding no relic. */
function runWith(backpack: readonly string[]): RunState {
  const base = createRun('BAG', DEFAULT_TUNING);
  return {
    ...base,
    backpack: [...backpack],
    currency: 200,
    relics: [],
    party: [createPartyMember({ species: 'Snorlax', ability: 'Immunity', moves: ['Tackle'], level: 30 })],
  };
}

function resolveWith(state: RunState, paid: EventOutcome): RunState {
  const node = { ...state.segments[0]!.gym, kind: 'event' as const, encounter: null, event: eventWith(paid) };
  const result: NodeResult = { node, eventChoice: 'safe' };
  return resolveNode(state, result);
}

describe('an event grant reaches the run', () => {
  it('puts one item in the backpack', () => {
    const after = resolveWith(runWith([]), outcomeOf([{ kind: 'item', items: ['leftovers'] }]));
    expect(after.backpack).toEqual(['leftovers']);
  });

  it('puts every item of a multi-item grant in, in order', () => {
    const after = resolveWith(
      runWith(['shellbell']),
      outcomeOf([{ kind: 'item', items: ['oranberry', 'sitrusberry'] }]),
    );
    expect(after.backpack).toEqual(['shellbell', 'oranberry', 'sitrusberry']);
  });

  it('still pays currency and heals, which never broke', () => {
    const after = resolveWith(runWith([]), outcomeOf([{ kind: 'currency', amount: 50 }]));
    expect(after.currency).toBe(250);
  });

  it('folds a T3 pair: the item beside the relic, and the relic itself', () => {
    const after = resolveWith(
      runWith([]),
      outcomeOf([relicEffect(['rusted-machete']), { kind: 'item', items: ['lifeorb'] }]),
    );
    expect(after.backpack).toEqual(['lifeorb']);
    expect(after.relics).toEqual(['rusted-machete']);
  });

  /*
   * The relic half of the same defect the backpack half of this file was
   * written for. `applyEffect` returned the state untouched for a `relic` from
   * the rejig until the playtest report that named it, so a `T2` relic and
   * every `T3` windfall paid strictly less than they said.
   */
  it('puts a relic on the run rather than in the bag or on a member', () => {
    const after = resolveWith(runWith([]), outcomeOf([relicEffect(['rusted-machete'])]));
    expect(after.relics).toEqual(['rusted-machete']);
    expect(after.backpack).toEqual([]);
  });

  it('walks the drawn order past every relic already held', () => {
    const state = { ...runWith([]), relics: ['rusted-machete' as const] };
    const after = resolveWith(state, outcomeOf([relicEffect(['rusted-machete', 'woodsmans-hatchet'])]));
    expect(after.relics).toEqual(['rusted-machete', 'woodsmans-hatchet']);
  });

  it('pays the fallback when the run holds every relic in the order', () => {
    const state = { ...runWith([]), relics: [...RELIC_IDS] };
    const after = resolveWith(state, outcomeOf([relicEffect([...RELIC_IDS])]));
    expect(after.relics).toEqual([...RELIC_IDS]);
    expect(after.backpack).toEqual(['leftovers']);
  });

  it('never lists a relic twice', () => {
    const state = { ...runWith([]), relics: ['rusted-machete' as const] };
    const after = resolveWith(state, outcomeOf([relicEffect(['rusted-machete'])]));
    expect(after.relics).toEqual(['rusted-machete']);
    expect(after.backpack).toEqual(['leftovers']);
  });
});

describe('an event cost reaches the run too', () => {
  /*
   * The same seam, in the other direction. A discard that was folded and then
   * dropped would be a cost the player was told about and never paid — which
   * reads as a bug to anyone who checks their bag afterwards.
   */
  it('takes a forced discard off the bag', () => {
    const after = resolveWith(
      runWith(['leftovers', 'shellbell']),
      outcomeOf([{ kind: 'currency', amount: 10 }], [{ kind: 'discard', count: 1 }]),
    );
    expect(after.backpack).toEqual(['leftovers']);
  });

  it('takes the berry a berry toll charges', () => {
    const after = resolveWith(
      runWith(['leftovers', 'oranberry']),
      outcomeOf([{ kind: 'currency', amount: 10 }], [{ kind: 'loseItem', pool: ['oranberry'] }]),
    );
    expect(after.backpack).toEqual(['leftovers']);
  });

  it('pays a cost and its consolation in one fold, both landing', () => {
    const after = resolveWith(
      runWith(['shellbell']),
      outcomeOf([{ kind: 'item', items: ['oranberry'] }], [{ kind: 'discard', count: 1 }]),
    );
    // The discard takes the last item, then the consolation is stowed.
    expect(after.backpack).toEqual(['oranberry']);
  });
});

/**
 * **One assertion per `T0` cost kind, proving the run changed.**
 *
 * Asked for regardless of what the diagnostic sweep said, and the reason is
 * the history: `applyEventOutcome` folded `backpack` correctly for four
 * stages while `resolveNode` dropped it, so a test that stops at the fold
 * would have passed throughout. Every assertion here reads `RunState` *after*
 * `resolveNode` and never the fold's return value.
 *
 * The party is built by hand rather than taken from `createRun`, which starts
 * empty, and given a bench so a lead-targeted cost can be told apart from a
 * party-wide one.
 */
describe('every T0 cost kind moves the run, read off RunState after the node', () => {
  function party() {
    return [
      createPartyMember({ species: 'Snorlax', ability: 'Immunity', moves: ['Tackle'], level: 40 }),
      createPartyMember({ species: 'Pikachu', ability: 'Static', moves: ['Tackle'], level: 40 }),
    ];
  }

  function runFor(backpack: readonly string[], currency = 400): RunState {
    return { ...createRun('T0-COSTS', DEFAULT_TUNING), backpack: [...backpack], currency, relics: [], party: party() };
  }

  it('HP loss: the lead drops, and only the lead when the cost says lead', () => {
    const before = runFor([]);
    const after = resolveWith(
      before,
      outcomeOf([{ kind: 'currency', amount: 1 }], [{ kind: 'damage', percent: 0.25, target: 'lead' }]),
    );
    expect(after.party[0]!.hp, 'the lead took the cost').toBeLessThan(before.party[0]!.hp);
    expect(after.party[1]!.hp, 'the bench did not').toBe(before.party[1]!.hp);
    expect(after.party[0]!.fainted, 'and no cost may faint').toBe(false);
    expect(after.party[0]!.hp).toBeGreaterThanOrEqual(1);
  });

  it('HP loss: every standing member drops when the cost says party', () => {
    const before = runFor([]);
    const after = resolveWith(
      before,
      outcomeOf([{ kind: 'currency', amount: 1 }], [{ kind: 'damage', percent: 0.25, target: 'party' }]),
    );
    for (const [slot, member] of after.party.entries()) {
      expect(member.hp, `slot ${slot}`).toBeLessThan(before.party[slot]!.hp);
      expect(member.fainted, `slot ${slot}`).toBe(false);
    }
  });

  it('gold loss: the purse drops by the fraction, against the floor', () => {
    const before = runFor([], 1000);
    const after = resolveWith(
      before,
      outcomeOf([{ kind: 'currency', amount: 1 }], [{ kind: 'currencyFraction', fraction: 0.4, floor: 30 }]),
    );
    // 40% of 1000 is above the floor, and the consolation is +1.
    expect(after.currency).toBe(1000 - 400 + 1);
    expect(after.currency).toBeGreaterThanOrEqual(0);
  });

  it('berry loss: the berry leaves the bag and nothing else does', () => {
    const before = runFor(['leftovers', 'oranberry', 'shellbell']);
    const after = resolveWith(
      before,
      outcomeOf([{ kind: 'currency', amount: 1 }], [{ kind: 'loseItem', pool: ['oranberry', 'sitrusberry'] }]),
    );
    expect(after.backpack).toEqual(['leftovers', 'shellbell']);
  });

  it('forced discard: an item leaves the bag, by identity and not by length', () => {
    /*
     * By identity, because a `T0` grants its consolation in the same fold and
     * that consolation is often an item — so the bag can come out the same
     * *length* with a different item in it. A length assertion passes on a
     * discard that never happened; this one does not.
     */
    const before = runFor(['leftovers', 'shellbell']);
    const after = resolveWith(
      before,
      outcomeOf([{ kind: 'item', items: ['oranberry'] }], [{ kind: 'discard', count: 1 }]),
    );
    expect(after.backpack, 'shellbell went, oranberry arrived').toEqual(['leftovers', 'oranberry']);
    expect(after.backpack).not.toContain('shellbell');
    expect(after.backpack).toHaveLength(before.backpack.length);
  });

  it('a toll is charged the same way, through resolveNode and not around it', () => {
    const before = runFor(['leftovers', 'oranberry'], 500);
    const node = {
      ...before.segments[0]!.gym,
      kind: 'event' as const,
      encounter: null,
      event: {
        ...eventWith(outcomeOf([{ kind: 'currency', amount: 1 }])),
        options: [
          {
            ...option('toll', outcomeOf([{ kind: 'currency', amount: 1 }])),
            toll: { kind: 'gold' as const, fraction: 0.4, floor: 30 },
          },
        ],
      },
    };
    const after = resolveNode(before, { node, eventChoice: 'toll' });
    expect(after.currency, 'the toll was charged and the outcome paid').toBe(500 - 200 + 1);
  });
});
