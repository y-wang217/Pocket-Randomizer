/**
 * Teaching a move at the node that paid it.
 *
 * ## What this is for
 *
 * The inventory-TM stage put every move the run is paid into the bag and let it
 * out at a rest or a shop. Measured afterwards, that left a TM spendable in
 * **13.3%** of runs: 43.5% of runs earn one, and most die before reaching a
 * counter (`docs/generation.md` section 40.3).
 *
 * So a move may now be taught at the node that paid it. The rule that did *not*
 * change is the one for a **stored** TM — a move the player banked rather than
 * spending on arrival still waits for a rest or a shop, which is what keeps the
 * bag a bank. `run.teachableAt` is the single definition of the difference and
 * this file is what pins it.
 *
 * ## The three things that can go wrong
 *
 * 1. The wider gate leaks, and a node that pays one move lets the whole bank
 *    out with it. That is the bank rule deleted by accident, at the one
 *    boundary that was supposed to test it.
 * 2. The gate is wide enough to compose a teach and too narrow to spend it, so
 *    a teach the player arranged is dropped silently — the section 40.2 defect
 *    in a new place.
 * 3. `playRun` and a replay disagree about which moves were teachable, which
 *    puts the log one entry out of step.
 *
 * `docs/spec/gymrun-patch-teach-now-and-gym-level-spread.md`.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import {
  canTeachAt,
  createRun,
  movesPaidBy,
  playRun,
  replayRun,
  scriptedRunPolicy,
  teachableAt,
  type NodeVisit,
} from '../src/core/run';
import { applyItemPlan, backpackCapacity } from '../src/core/items';
import { createParty } from '../src/core/party';
import { DEFAULT_TUNING } from '../src/data/tuning';
import type { ItemPlan } from '../src/core/types';

const SEEDS = 60;

function seeds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

describe('teachableAt', () => {
  const visit = (kind: string, tmsPaid: readonly string[]): { node: never; tmsPaid: readonly string[] } =>
    ({ node: { kind } as never, tmsPaid }) as never;

  it('opens the whole bag at a rest and at a shop', () => {
    for (const kind of ['rest', 'shop']) {
      expect(canTeachAt(kind as never)).toBe(true);
      const teachable = teachableAt(visit(kind, []), ['Surf', 'Ember', 'Tackle']);
      expect([...teachable].sort()).toEqual(['Ember', 'Surf', 'Tackle']);
    }
  });

  it('opens only the arriving move anywhere else, and never the bank behind it', () => {
    // The bag holds three; this node paid one of them.
    const teachable = teachableAt(visit('wild', ['Ember']), ['Surf', 'Ember', 'Tackle']);
    expect([...teachable]).toEqual(['Ember']);
  });

  it('is empty at a node that paid nothing, however full the bag is', () => {
    expect([...teachableAt(visit('trainer', []), ['Surf', 'Ember'])]).toEqual([]);
  });

  it('never names a move the run is not carrying', () => {
    // A move paid and then discarded in the same plan is not teachable after.
    expect([...teachableAt(visit('wild', ['Ember']), ['Surf'])]).toEqual([]);
  });

  it('names every move a node paid when it paid more than one', () => {
    const teachable = teachableAt(visit('shop', ['Surf', 'Ember']), ['Surf', 'Ember']);
    expect(teachable.size).toBe(2);
  });
});

describe('applyItemPlan honours the boundary', () => {
  const started = () => {
    const run = createRun('TEACHNOW-fixture', DEFAULT_TUNING);
    const party = createParty([run.starterOptions[0]!], DEFAULT_TUNING);
    return { ...run, party, tms: ['Surf', 'Ember'] };
  };
  const plan = (over: Partial<ItemPlan> = {}): ItemPlan => ({
    assignments: [],
    discards: [],
    teaches: [],
    discardTms: [],
    ...over,
  });
  const capOf = (state: ReturnType<typeof started>): number =>
    backpackCapacity(state.party.length, state.tuning);

  it('refuses a stored TM at a node that did not pay it', () => {
    const state = started();
    expect(() =>
      applyItemPlan(
        state,
        plan({ teaches: [{ move: 'Surf', slot: 0, replaceSlot: 0 }] }),
        capOf(state),
        // The node paid Ember; Surf was banked earlier.
        new Set(['Ember']),
      ),
    ).toThrow(/this boundary does not allow/i);
  });

  it('names the refused move in the message, so the failure is readable', () => {
    const state = started();
    expect(() =>
      applyItemPlan(
        state,
        plan({ teaches: [{ move: 'Surf', slot: 0, replaceSlot: 0 }] }),
        capOf(state),
        new Set(['Ember']),
      ),
    ).toThrow(/Surf/);
  });
});

describe('movesPaidBy reads every route a node pays a move through', () => {
  const node = { kind: 'wild', shop: null } as never;

  it('reads the reward card', () => {
    expect(movesPaidBy({ node, reward: { kind: 'tm', move: 'Surf' } } as never)).toEqual(['Surf']);
  });

  it('reads a gym clear and its card, gym move first', () => {
    const paid = movesPaidBy({
      node,
      gymMove: { kind: 'tm', move: 'Surf' },
      reward: { kind: 'tutor', move: 'Ember' },
    } as never);
    expect(paid).toEqual(['Surf', 'Ember']);
  });

  it('reads an event grant', () => {
    expect(movesPaidBy({ node, eventMove: { kind: 'tm', move: 'Ember' } } as never)).toEqual(['Ember']);
  });

  it('ignores a reward that is not a move', () => {
    expect(movesPaidBy({ node, reward: { kind: 'item', item: 'leftovers' } } as never)).toEqual([]);
  });
});

/*
 * The end-to-end half. Slow, because it plays real battles, and it is the only
 * thing that proves the gate `playRun` composes against and the gate it applies
 * against are the same gate.
 */
describe('through playRun', () => {
  it(
    'never records a visit whose teachable set contradicts what the node paid',
    async () => {
      let visitsWithMoves = 0;
      for (const seed of seeds('TEACHNOW', SEEDS)) {
        const run = await playRun(seed, scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING);
        for (const visit of run.state.history as NodeVisit[]) {
          if (visit.tmsPaid.length === 0) continue;
          visitsWithMoves++;
          // Whatever a node paid, a teach of it is legal at that node; and at a
          // node that is not a counter, nothing else in the bag ever is.
          const bag = [...visit.tmsPaid, 'Tackle'];
          const teachable = teachableAt(visit, bag);
          for (const move of visit.tmsPaid) expect(teachable.has(move)).toBe(true);
          if (!canTeachAt(visit.node.kind)) expect(teachable.has('Tackle')).toBe(false);
        }
      }
      // The population has to actually contain the case, or this asserts nothing.
      expect(visitsWithMoves).toBeGreaterThan(0);
    },
    600_000,
  );

  it(
    'replays a run that taught on arrival to the same state, byte for byte',
    async () => {
      for (const seed of seeds('TEACHNOW', 12)) {
        const live = await playRun(seed, scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING);
        const again = await replayRun(live.log, DEFAULT_TUNING);
        expect(again.outcome).toBe(live.outcome);
        expect(again.state.party.map((member) => member.spec.moves)).toEqual(
          live.state.party.map((member) => member.spec.moves),
        );
        expect(again.state.tms).toEqual(live.state.tms);
      }
    },
    600_000,
  );
});
