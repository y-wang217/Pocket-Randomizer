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

  it('folds a T3 pair: the item beside the relic', () => {
    const after = resolveWith(
      runWith([]),
      outcomeOf([{ kind: 'relic' }, { kind: 'item', items: ['lifeorb'] }]),
    );
    expect(after.backpack).toEqual(['lifeorb']);
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
