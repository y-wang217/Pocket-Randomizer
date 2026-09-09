/**
 * The backpack: capacity, assignment, and the rule that nothing vanishes.
 *
 * Stage 3 refused to build an inventory and wrote down what it would need: "a
 * screen, a capacity rule, and an answer to what happens to it on a wipe".
 * This file is the capacity rule under test, plus the property the whole
 * feature exists to guarantee — **an item is destroyed only by an explicit
 * discard**, never by a swap, a reward, an event or a full bag.
 *
 * The attrition cases live here too rather than in `party.test.ts`, because
 * they are the same question asked of a different resource: what does a run
 * carry from one node to the next, and what does it have to spend to get it
 * back. Stage 4.5.1 changed the answer for items and deliberately did not
 * change it for HP and PP, and a test that only covered the half that moved
 * would not notice the half that was supposed to hold still.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { applyItemPlan, backpackCapacity, needsItemPlan, stow } from '../src/core/items';
import { betweenNodes, createParty, releaseMember, restParty } from '../src/core/party';
import { applyReward } from '../src/core/rewards';
import {
  chooseStarter,
  createRun,
  defaultItemPlan,
  playRun,
  replayRun,
  resolveNode,
  resumeRun,
  scriptedRunPolicy,
  type RunPolicy,
  type RunState,
} from '../src/core/run';
import type { ItemPlan, PokemonSpec, PokemonState, RunLog } from '../src/core/types';
import { PARTY_SIZE } from '../src/data/partyTuning';
import { DEFAULT_TUNING, withTuning } from '../src/data/tuning';

const spec = (species: string, ability: string, moves: string[]): PokemonSpec =>
  ({ species, ability, moves, level: 20 }) as PokemonSpec;

function partyOf(count: number): PokemonState[] {
  return createParty(
    [
      spec('Bulbasaur', 'Overgrow', ['Tackle', 'Growl']),
      spec('Charmander', 'Blaze', ['Scratch', 'Ember']),
      spec('Squirtle', 'Torrent', ['Tackle', 'Bubble']),
    ].slice(0, count),
  );
}

/** A run with a real map behind it, so `resolveNode` has something to resolve. */
function started(seed = 'BACKPACK'): RunState {
  return { ...chooseStarter(createRun(seed), 0), party: partyOf(3) };
}

const plan = (over: Partial<ItemPlan> = {}): ItemPlan => ({ assignments: [], discards: [], ...over });

// ---------------------------------------------------------------------------
// Attrition: what persists, and what a faint costs
// ---------------------------------------------------------------------------

describe('attrition across a node boundary', () => {
  /** One of each: hurt with drained PP, fainted, hurt and statused. */
  function beatenUp(): PokemonState[] {
    return partyOf(3).map((member, index) => {
      if (index === 0) {
        return { ...member, hp: 7, moves: member.moves.map((move) => ({ ...move, pp: 3 })) };
      }
      if (index === 1) return { ...member, hp: 0, fainted: true };
      return { ...member, hp: 11, status: 'brn' as const };
    });
  }

  it('carries HP and PP across a node with no restoration at all', () => {
    const before = beatenUp();
    const after = betweenNodes(before, DEFAULT_TUNING);

    // The two members who did not faint are untouched on both resources.
    expect(after[0]!.hp).toBe(7);
    expect(after[0]!.moves.map((move) => move.pp)).toEqual([3, 3]);
    expect(after[2]!.hp).toBe(11);
    expect(after[2]!.moves.map((move) => move.pp)).toEqual(before[2]!.moves.map((move) => move.pp));
  });

  it('clears status but restores nothing, which are separate decisions', () => {
    // `clearStatusBetweenNodes` is on and stays on: status is a per-battle
    // problem, HP and PP are the run-long one. The pair asserted together
    // because a change to either would otherwise look like a change to both.
    const after = betweenNodes(beatenUp(), DEFAULT_TUNING);
    expect(after[2]!.status).toBeNull();
    expect(after[2]!.hp).toBe(11);
  });

  it('revives a fainted member to exactly reviveHpPercent, and not to full', () => {
    const after = betweenNodes(beatenUp(), DEFAULT_TUNING)[1]!;
    expect(after.fainted).toBe(false);
    expect(after.hp).toBe(Math.round(after.maxHp * DEFAULT_TUNING.reviveHpPercent));
    expect(after.hp).toBeLessThan(after.maxHp);
  });

  it('leaves PP alone when it revives, so a faint is not a free refill', () => {
    // Deliberate, and deliberately untouched by this stage: PP restoration is
    // out of scope until the simulator has measured turns per battle against
    // segment length. Asserted so that a later stage changes it on purpose.
    const drained = partyOf(1).map((member) => ({
      ...member,
      hp: 0,
      fainted: true,
      moves: member.moves.map((move) => ({ ...move, pp: 0 })),
    }));
    expect(betweenNodes(drained, DEFAULT_TUNING)[0]!.moves.every((move) => move.pp === 0)).toBe(true);
  });

  it('restores everything at a rest node, which is the only unpriced heal left', () => {
    const rested = restParty(beatenUp(), DEFAULT_TUNING);
    for (const member of rested) {
      expect(member.hp).toBe(member.maxHp);
      expect(member.fainted).toBe(false);
      expect(member.moves.every((move) => move.pp === move.maxPp)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

describe('backpack capacity', () => {
  it('defaults to party size plus two, counting loose items only', () => {
    expect(backpackCapacity(DEFAULT_TUNING)).toBe(PARTY_SIZE + 2);
  });

  it('lets acquisition overflow, because the discard choice comes after it', () => {
    // The overflow is the whole reason the player gets asked. A `stow` that
    // refused at the cap would be the "silently refuse" the spec rules out, and
    // one that dropped the incoming item would be the "silently drop".
    let backpack: string[] = [];
    for (const id of ['leftovers', 'lifeorb', 'focussash', 'assaultvest', 'rockyhelmet', 'expertbelt']) {
      backpack = stow(backpack, id);
    }
    expect(backpack).toHaveLength(6);
    expect(backpack.length).toBeGreaterThan(backpackCapacity(DEFAULT_TUNING));
  });

  it('refuses a plan that leaves the backpack over capacity, rather than trimming it', () => {
    const state = {
      ...started(),
      tuning: withTuning({ backpackCapacity: 2 }),
      backpack: ['leftovers', 'lifeorb', 'focussash'],
    };
    // Loud, because a silently trimmed backpack replays as a different run.
    expect(() => applyItemPlan(state, plan())).toThrow(/over-capacity is resolved by discarding/i);
  });

  it('accepts the same plan once the player has discarded down to the cap', () => {
    const state = {
      ...started(),
      tuning: withTuning({ backpackCapacity: 2 }),
      backpack: ['leftovers', 'lifeorb', 'focussash'],
    };
    const after = applyItemPlan(state, plan({ discards: ['lifeorb'] }));
    expect(after.backpack).toEqual(['leftovers', 'focussash']);
  });

  it('counts equipping as a way under the cap, because held items are not counted', () => {
    // The other legal answer to an overflowing bag: put something on a Pokemon.
    const state = {
      ...started(),
      tuning: withTuning({ backpackCapacity: 2 }),
      backpack: ['leftovers', 'lifeorb', 'focussash'],
    };
    const after = applyItemPlan(state, plan({ assignments: [{ slot: 0, item: 'leftovers' }] }));
    expect(after.party[0]!.item).toBe('leftovers');
    expect(after.backpack).toEqual(['lifeorb', 'focussash']);
  });
});

// ---------------------------------------------------------------------------
// Nothing is destroyed except by a discard
// ---------------------------------------------------------------------------

describe('no item is ever silently destroyed', () => {
  it('returns a displaced item to the backpack instead of deleting it', () => {
    const base = started();
    const state = {
      ...base,
      party: base.party.map((member, index) => (index === 0 ? { ...member, item: 'lifeorb' } : member)),
      backpack: ['leftovers'],
    };
    const after = applyItemPlan(state, plan({ assignments: [{ slot: 0, item: 'leftovers' }] }));

    expect(after.party[0]!.item).toBe('leftovers');
    // The Stage 3 rule said this one was gone. It is in the bag.
    expect(after.backpack).toEqual(['lifeorb']);
  });

  it('returns an unequipped item to the backpack', () => {
    const base = started();
    const state = {
      ...base,
      party: base.party.map((member, index) => (index === 1 ? { ...member, item: 'lifeorb' } : member)),
      backpack: [],
    };
    const after = applyItemPlan(state, plan({ assignments: [{ slot: 1, item: null }] }));
    expect(after.party[1]!.item).toBeUndefined();
    expect(after.backpack).toEqual(['lifeorb']);
  });

  it('swaps two members items in one plan, which a move list could not express', () => {
    // The reason `ItemAssignment` is a destination and not a move: each of these
    // two assignments is illegal on its own and legal together, because the
    // pool holds both items before either is placed.
    const base = started();
    const state = {
      ...base,
      party: base.party.map((member, index) => {
        if (index === 0) return { ...member, item: 'leftovers' };
        if (index === 1) return { ...member, item: 'lifeorb' };
        return member;
      }),
      backpack: [],
    };
    const after = applyItemPlan(
      state,
      plan({
        assignments: [
          { slot: 0, item: 'lifeorb' },
          { slot: 1, item: 'leftovers' },
        ],
      }),
    );
    expect(after.party[0]!.item).toBe('lifeorb');
    expect(after.party[1]!.item).toBe('leftovers');
    expect(after.backpack).toEqual([]);
  });

  it('conserves every item across an assignment: nothing appears, nothing vanishes', () => {
    const base = started();
    const state = {
      ...base,
      party: base.party.map((member, index) => (index === 0 ? { ...member, item: 'lifeorb' } : member)),
      backpack: ['leftovers', 'focussash'],
    };
    const before = [...state.backpack, ...state.party.flatMap((m) => (m.item ? [m.item] : []))].sort();

    const after = applyItemPlan(
      state,
      plan({
        assignments: [
          { slot: 0, item: null },
          { slot: 2, item: 'focussash' },
        ],
      }),
    );
    const owned = [...after.backpack, ...after.party.flatMap((m) => (m.item ? [m.item] : []))].sort();
    expect(owned).toEqual(before);
  });

  it('destroys an item only on an explicit discard', () => {
    const state = { ...started(), backpack: ['leftovers', 'lifeorb'] };
    const after = applyItemPlan(state, plan({ discards: ['leftovers'] }));
    expect(after.backpack).toEqual(['lifeorb']);
  });

  it('refuses to discard something the run does not hold', () => {
    const state = { ...started(), backpack: ['leftovers'] };
    expect(() => applyItemPlan(state, plan({ discards: ['masterball'] }))).toThrow(/not in the backpack/);
  });

  it('refuses to assign an item the run does not hold', () => {
    const state = { ...started(), backpack: [] };
    expect(() => applyItemPlan(state, plan({ assignments: [{ slot: 0, item: 'leftovers' }] }))).toThrow(
      /which the run does not hold/,
    );
  });

  it('refuses a plan naming a slot twice, rather than letting the last one win', () => {
    const state = { ...started(), backpack: ['leftovers', 'lifeorb'] };
    expect(() =>
      applyItemPlan(
        state,
        plan({
          assignments: [
            { slot: 0, item: 'leftovers' },
            { slot: 0, item: 'lifeorb' },
          ],
        }),
      ),
    ).toThrow(/assigns slot 0 twice/);
  });

  it('refuses a plan naming a slot the party does not have', () => {
    const state = { ...started(), backpack: ['leftovers'] };
    expect(() => applyItemPlan(state, plan({ assignments: [{ slot: 9, item: 'leftovers' }] }))).toThrow(
      /names slot 9/,
    );
  });
});

// ---------------------------------------------------------------------------
// Where items come from
// ---------------------------------------------------------------------------

describe('every acquisition route lands in the backpack', () => {
  it('takes an item reward into the bag rather than onto a Pokemon', () => {
    const after = applyReward(started(), { kind: 'item', item: 'leftovers' });
    expect(after.backpack).toEqual(['leftovers']);
    expect(after.party.every((member) => member.item === undefined)).toBe(true);
  });

  it('banks a second item rather than having it displace the first', () => {
    let state = applyReward(started(), { kind: 'item', item: 'leftovers' });
    state = applyReward(state, { kind: 'item', item: 'lifeorb' });
    expect(state.backpack).toEqual(['leftovers', 'lifeorb']);
  });

  it('ignores an item id no pool contains, rather than banking a ghost', () => {
    // A pool edit that removes an item must not leave runs carrying a string
    // the sim will silently read as "no item".
    expect(stow([], 'masterball')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The plan question itself
// ---------------------------------------------------------------------------

describe('needsItemPlan', () => {
  it('is false for a run that owns nothing, so no entry reaches the log', () => {
    expect(needsItemPlan({ backpack: [], party: partyOf(3) })).toBe(false);
  });

  it('is true once anything is in the bag', () => {
    expect(needsItemPlan({ backpack: ['leftovers'], party: partyOf(3) })).toBe(true);
  });

  it('is true once anything is held, so an item can always be taken back off', () => {
    const holding = partyOf(3).map((member, index) =>
      index === 1 ? { ...member, item: 'leftovers' } : member,
    );
    expect(needsItemPlan({ backpack: [], party: holding })).toBe(true);
  });
});

describe('defaultItemPlan', () => {
  it('fills empty hands in slot order from the bag in acquisition order', () => {
    const state = { ...started(), backpack: ['leftovers', 'lifeorb'] };
    expect(defaultItemPlan(state)).toEqual({
      assignments: [
        { slot: 0, item: 'leftovers' },
        { slot: 1, item: 'lifeorb' },
      ],
      discards: [],
    });
  });

  it('never takes an item off a Pokemon, which is what keeps it a baseline', () => {
    const base = started();
    const state = {
      ...base,
      party: base.party.map((member, index) => (index === 0 ? { ...member, item: 'lifeorb' } : member)),
      backpack: ['leftovers'],
    };
    // Slot 0 is skipped because it is already holding something; the Leftovers
    // goes to slot 1 rather than displacing the Life Orb.
    expect(defaultItemPlan(state).assignments).toEqual([{ slot: 1, item: 'leftovers' }]);
  });

  it('discards the oldest overflow, and only the overflow', () => {
    const state = {
      ...started(),
      tuning: withTuning({ backpackCapacity: 1 }),
      party: partyOf(3).map((member) => ({ ...member, item: 'lifeorb' })),
      backpack: ['leftovers', 'focussash', 'expertbelt'],
    };
    // Every hand is full, so nothing is equipped and the bag has to come down
    // from three to one. The two oldest go.
    const result = defaultItemPlan(state);
    expect(result.assignments).toEqual([]);
    expect(result.discards).toEqual(['leftovers', 'focussash']);
  });

  it('always produces a plan the run will accept', () => {
    // The property that matters: a policy that delegates to this never ends a
    // run on a thrown RangeError, however full the bag gets.
    const state = {
      ...started(),
      tuning: withTuning({ backpackCapacity: 2 }),
      backpack: ['leftovers', 'lifeorb', 'focussash', 'assaultvest', 'rockyhelmet', 'expertbelt'],
    };
    const after = applyItemPlan(state, defaultItemPlan(state));
    expect(after.backpack.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

describe('the backpack serializes', () => {
  it('survives a round trip through JSON, because that is what storage is', () => {
    const state = { ...started(), backpack: ['leftovers', 'lifeorb'] };
    const revived = JSON.parse(JSON.stringify(state)) as RunState;
    expect(revived.backpack).toEqual(['leftovers', 'lifeorb']);
  });

  it('starts empty on a fresh run', () => {
    expect(createRun('FRESH').backpack).toEqual([]);
  });

  it('is carried through a node boundary untouched by resolveNode', () => {
    // `resolveNode` owns HP, currency and history. The backpack passes through
    // it unchanged except where a reward, a shop or an event adds to it — the
    // plan that empties it is a separate transition, applied by `playRun`.
    const state = { ...started(), backpack: ['leftovers'] };
    const node = state.segments[0]!.steps[0]!.options[0]!;
    const after = resolveNode(state, { node });
    expect(after.backpack).toEqual(['leftovers']);
  });
});

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

/**
 * A policy that actually moves items around, so the log has something to replay.
 *
 * `defaultItemPlan` only ever fills empty hands, which means a run driven by it
 * records a monotonic sequence of plans — every one of which would still be
 * legal if a replay applied them in the wrong order. This one *rotates* items
 * between members, so an order-sensitive bug in `applyItemPlan` shows up as a
 * divergence rather than as a coincidence.
 *
 * **The rotation is derived from run state, never from a call counter**, and
 * that is the whole reason this function is written the way it is. A policy
 * that counted its own invocations would restart at zero on resume and answer
 * differently from that point on — which is a fact about the test rather than
 * about the run, and would make the resume case below assert nothing.
 * `run-replay.test.ts` makes the same point about `wobbling()`. `history.length`
 * is reconstructed exactly by a replay, so both halves of the comparison see
 * the same number.
 */
function shuffling(): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    // Take the reward that most often produces an item, so the bag fills.
    chooseReward: async (offer) => {
      const item = offer.options.findIndex((option) => option.kind === 'item');
      return item === -1 ? 0 : item;
    },
    chooseItemPlan: async (state) => {
      const pool = [
        ...state.backpack,
        ...state.party.flatMap((member) => (member.item ? [member.item] : [])),
      ];
      const turn = state.history.length;
      const offset = pool.length > 0 ? turn % pool.length : 0;
      const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
      const assignments = state.party.map((_, slot) => ({ slot, item: rotated[slot] ?? null }));
      const left = rotated.slice(state.party.length);
      const capacity = backpackCapacity(state.tuning);
      return { assignments, discards: left.slice(0, Math.max(0, left.length - capacity)) };
    },
  };
}

describe('item assignment replays identically', () => {
  it('reconstructs the same backpack and the same held items from a log', async () => {
    const original = await playRun('BAG-REPLAY', shuffling());
    const replayed = await replayRun(original.log);

    expect(replayed.state.backpack).toEqual(original.state.backpack);
    expect(replayed.state.party.map((member) => member.item)).toEqual(
      original.state.party.map((member) => member.item),
    );
    expect(replayed.outcome).toBe(original.outcome);
    expect(JSON.stringify(replayed.log)).toBe(JSON.stringify(original.log));
  }, 60_000);

  it('records an items decision only where there was something to manage', async () => {
    const run = await playRun('BAG-GATE', shuffling());
    const plans = run.log.decisions.filter((decision) => decision.kind === 'items');

    // There is at least one, or this test is asserting nothing about a run that
    // never picked up an item.
    expect(plans.length).toBeGreaterThan(0);
    /*
     * And fewer than one per node *visited*, because the opening boundaries
     * have no items in play — which is `needsItemPlan` doing its job.
     *
     * Counted against `history`, not against the `node` decisions in the log:
     * a gym is a boundary that gets an item plan but is never *chosen*, so it
     * has no node entry. Comparing plans to node decisions would compare a
     * count that includes gyms against one that does not.
     */
    expect(plans.length).toBeLessThan(run.state.history.length);
  }, 60_000);

  it('resumes identically from a save taken between an assignment and the next battle', async () => {
    /*
     * The specific case the spec names. A save written straight after an item
     * plan is the one that would expose a backpack reconstructed from the party
     * rather than from the log, because at that instant the two disagree: the
     * items have just moved and no battle has yet read them.
     *
     * **Searched across seeds rather than pinned to one**, because whether a
     * given seed ever reaches such a boundary depends on what its nodes pay
     * out, and every `RANDOMIZER_VERSION` bump reshuffles that. A seed pinned
     * here fails on the next bump for a reason that has nothing to do with the
     * behaviour under test — which is exactly what happened when gender moved
     * onto the spec.
     */
    let checked = 0;
    for (const seed of ['BAG-RESUME', 'BAG-RESUME-2', 'BAG-RESUME-3', 'BAG-RESUME-4']) {
      const saves: RunLog[] = [];
      const original = await playRun(seed, shuffling(), undefined, {
        onDecision: (log) => saves.push(JSON.parse(JSON.stringify(log)) as RunLog),
      });

      for (const save of saves.filter((log) => log.decisions.at(-1)?.kind === 'items')) {
        checked++;
        const resumed = await resumeRun(save, shuffling());
        expect(resumed.state.backpack, `${seed} after ${save.decisions.length} decisions`).toEqual(
          original.state.backpack,
        );
        expect(resumed.state.party.map((member) => member.item)).toEqual(
          original.state.party.map((member) => member.item),
        );
        expect(resumed.outcome).toBe(original.outcome);
      }
    }
    // The search has to have found something, or this test asserts nothing.
    expect(checked).toBeGreaterThan(0);
  }, 120_000);

  it('carries the backpack through a save and reload as JSON', async () => {
    const saves: RunLog[] = [];
    const original = await playRun('BAG-JSON', shuffling(), undefined, {
      onDecision: (log) => saves.push(JSON.parse(JSON.stringify(log)) as RunLog),
    });
    const midpoint = saves[Math.floor(saves.length / 2)]!;
    const revived = JSON.parse(JSON.stringify(midpoint)) as RunLog;

    const resumed = await resumeRun(revived, shuffling());
    expect(resumed.state.backpack).toEqual(original.state.backpack);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Releasing a Pokemon is removing an item from a Pokemon
// ---------------------------------------------------------------------------

describe('a released member hands their item back', () => {
  /*
   * The case that nearly slipped through the whole stage.
   *
   * Part 2's rule is that an item is never destroyed except by an explicit
   * discard. Releasing a party member *is* removing an item from a Pokemon, and
   * before this stage the item vanished with them — which was consistent when
   * every swap destroyed one, and is a silent destruction now. Both release
   * paths return the freed item so their callers can stow it.
   */
  it('returns it from the party screen path', () => {
    const party = partyOf(3).map((member, index) =>
      index === 1 ? { ...member, item: 'leftovers' } : member,
    );
    const { party: after, freed } = releaseMember(party, 1);
    expect(after).toHaveLength(2);
    expect(freed).toBe('leftovers');
  });

  it('returns nothing when the released member held nothing', () => {
    expect(releaseMember(partyOf(3), 1).freed).toBeNull();
  });

  it('returns nothing when the release was refused', () => {
    // A party of one cannot release: an empty party is neither wiped nor alive.
    const one = partyOf(1).map((member) => ({ ...member, item: 'leftovers' }));
    const { party: after, freed } = releaseMember(one, 0);
    expect(after).toHaveLength(1);
    expect(freed).toBeNull();
  });

  it('lands the item in the backpack through resolveNode, on the logged path', () => {
    // The acquisition route is the one determinism depends on, because it is
    // the one that is in the run log.
    const base = started('RELEASE-ITEM');
    const state: RunState = {
      ...base,
      party: partyOf(PARTY_SIZE).map((member, index) =>
        index === 0 ? { ...member, item: 'lifeorb' } : member,
      ),
      backpack: ['leftovers'],
    };
    const node = state.segments[0]!.steps[0]!.options[0]!;
    const after = resolveNode(state, {
      node,
      acquisition: {
        offer: {
          nodeId: node.id,
          source: 'encounter',
          spec: { species: 'Pikachu', ability: 'Static', moves: ['Thunder Shock'], level: 20, gender: 'M' },
        },
        decision: { kind: 'release', slot: 0 },
      },
    });

    expect(after.backpack).toEqual(['leftovers', 'lifeorb']);
    expect(after.party.some((member) => member.spec.species === 'Pikachu')).toBe(true);
    expect(after.party).toHaveLength(PARTY_SIZE);
  });

  it('conserves every item across a release, which is the property that matters', () => {
    const base = started('RELEASE-CONSERVE');
    const state: RunState = {
      ...base,
      party: partyOf(PARTY_SIZE).map((member, index) => ({
        ...member,
        item: ['lifeorb', 'leftovers', 'focussash'][index],
      })),
      backpack: ['expertbelt'],
    };
    const owned = (s: RunState): string[] =>
      [...s.backpack, ...s.party.flatMap((m) => (m.item ? [m.item] : []))].sort();
    const before = owned(state);

    const node = state.segments[0]!.steps[0]!.options[0]!;
    const after = resolveNode(state, {
      node,
      acquisition: {
        offer: {
          nodeId: node.id,
          source: 'encounter',
          spec: { species: 'Pikachu', ability: 'Static', moves: ['Thunder Shock'], level: 20, gender: 'M' },
        },
        decision: { kind: 'release', slot: 2 },
      },
    });

    expect(owned(after)).toEqual(before);
  });
});
