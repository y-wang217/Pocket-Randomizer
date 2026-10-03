/**
 * An item layout made between nodes reaches the next fight. **Bible Rev 23,
 * D94.**
 *
 * A layout composed on the map used to be held and spent at the boundary
 * *after* the next node, so the fight it was composed for was fought with the
 * old one. It is now a party edit: applied in place when the next question is
 * answered, logged just before that answer, and replayed at the same point.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { arrivedItems, keepLayoutPlan } from '../src/core/items';
import { createPartyMember } from '../src/core/party';
import { playRun, replayRun, RUN_LOG_VERSION, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import type { ItemPlan, PartyEdit, PokemonState } from '../src/core/types';
import { DEFAULT_TUNING } from '../src/data/tuning';

const plan = (assignments: ItemPlan['assignments']): ItemPlan => ({ assignments, discards: [], teaches: [], discardTms: [] });

/**
 * On the first map step where someone holds an item, takes it off them — the
 * smallest layout change there is — and records which slot and what it was.
 */
type Seen = [{ slot: number; item: string; logAt: number } | null];

function unequipper(seen: Seen): RunPolicy {
  let edit: ((edit: PartyEdit) => void) | null = null;
  let decisions = 0;
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    bindPartyEditor: (bound) => {
      edit = bound;
    },
    chooseNode: async (options, state) => {
      decisions++;
      if (seen[0] === null) {
        const slot = state.party.findIndex((member) => member.item !== undefined);
        if (slot !== -1) {
          const item = state.party[slot]!.item!;
          edit?.({ kind: 'items', plan: plan([{ slot, item: null }]) });
          seen[0] = { slot, item, logAt: decisions };
          // Applied in place, before the answer: the member is empty-handed now.
          expect(state.party[slot]!.item).toBeUndefined();
          expect(state.backpack).toContain(item);
        }
      }
      const wild = options.findIndex((option) => option.kind === 'wild');
      return wild === -1 ? 0 : wild;
    },
  };
}

const SEEDS = Array.from({ length: 20 }, (_unused, index) => `ITEM-EDIT-${index}`);

describe('an item layout made between nodes', () => {
  it('is held in the very next fight, and sits in the log just before the node it was made for', async () => {
    for (const seed of SEEDS) {
      const seen: Seen = [null];
      let fought: PokemonState[] | null = null;
      const run = await playRun(seed, unequipper(seen), DEFAULT_TUNING, {
        onNodeResolved: (before) => {
          if (seen[0] && !fought) fought = before.party;
        },
      });
      const done = seen[0];
      if (!done) continue;

      expect(fought, 'no node resolved after the edit').not.toBeNull();
      expect(fought![done.slot]!.item, 'the fight after the edit was fought with the old layout').toBeUndefined();

      const at = run.log.decisions.findIndex((decision) => decision.kind === 'party' && decision.edit.kind === 'items');
      expect(at).toBeGreaterThan(-1);
      expect(run.log.decisions[at + 1]?.kind).toBe('node');
      return;
    }
    throw new Error('no seed in SEEDS gave anyone an item to take off');
  }, 240_000);

  it('replays to the same run', async () => {
    for (const seed of SEEDS) {
      const seen: Seen = [null];
      const run = await playRun(seed, unequipper(seen), DEFAULT_TUNING);
      if (!seen[0]) continue;
      const replayed = await replayRun(run.log);
      expect(replayed.log.decisions).toEqual(run.log.decisions);
      expect(replayed.outcome).toBe(run.outcome);
      expect(replayed.state.backpack).toEqual(run.state.backpack);
      expect(replayed.state.party.map((member) => member.item)).toEqual(run.state.party.map((member) => member.item));
      return;
    }
    throw new Error('no seed in SEEDS gave anyone an item to take off');
  }, 240_000);

  it('is refused, and never logged, when it names an item the run does not hold', async () => {
    let edit: ((edit: PartyEdit) => void) | null = null;
    let checked = false;
    const policy: RunPolicy = {
      ...scriptedRunPolicy(greedyAiPolicy),
      bindPartyEditor: (bound) => {
        edit = bound;
      },
      chooseNode: async (options) => {
        if (!checked) {
          checked = true;
          expect(() => edit?.({ kind: 'items', plan: plan([{ slot: 0, item: 'not-an-item-the-run-holds' }]) })).toThrow(RangeError);
        }
        return Math.max(0, options.findIndex((option) => option.kind === 'wild'));
      },
    };
    const run = await playRun('ITEM-EDIT-REFUSE', policy, DEFAULT_TUNING);
    expect(checked).toBe(true);
    expect(run.log.decisions.some((decision) => decision.kind === 'party' && decision.edit.kind === 'items')).toBe(false);
  }, 240_000);

  it('moved the run log axis', () => {
    // To `-22`; the berry gym reward patch moved it again, so "at least".
    expect(Number(/^gymrun-run-(\d+)\//.exec(RUN_LOG_VERSION)?.[1])).toBeGreaterThanOrEqual(22);
  });
});

describe('the boundary that keeps the layout', () => {
  const member = (item?: string): PokemonState => ({
    ...createPartyMember({ species: 'Pikachu', ability: 'Static', moves: ['Thunder Shock'], level: 10 }),
    ...(item ? { item } : {}),
  });

  it('fills an empty hand from what arrived, never from what the player put away', () => {
    const party = [member(), member('leftovers'), member()];
    const result = keepLayoutPlan({ party, backpack: ['charcoal', 'sitrus-berry'] }, ['sitrus-berry']);
    expect(result.assignments).toEqual([{ slot: 0, item: 'sitrus-berry' }]);
    expect(result.discards).toEqual([]);
  });

  it('names nobody when nothing arrived', () => {
    expect(keepLayoutPlan({ party: [member(), member()], backpack: ['charcoal'] }, []).assignments).toEqual([]);
  });

  it('reads what arrived as a multiset difference, in the order the bag holds it', () => {
    expect(arrivedItems(['a', 'b'], ['a', 'b', 'c', 'a'])).toEqual(['c', 'a']);
    expect(arrivedItems(['a', 'a'], ['a'])).toEqual([]);
  });
});
