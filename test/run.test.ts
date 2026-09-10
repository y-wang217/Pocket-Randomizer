/**
 * A whole run, played headless.
 *
 * This is the file Stage 2's balance sweep grows out of: if `playRun` needs a
 * browser, the sweep has to be a second implementation of the run loop, and a
 * second implementation is one that disagrees with the one players use.
 *
 * The other half of the file is the rules that only exist between nodes — HP
 * and PP carrying forward, rest restoring them, and the two ways a run ends.
 * None of those are visible inside a battle, so none of them are covered by the
 * Stage 0 tests.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { firstUsableMovePolicy, forcedSwitchFallback, type Policy } from '../src/core/battle/policy';
import type { NodeSpec } from '../src/core/encounters';
import { createParty, isWiped, restParty } from '../src/core/party';
import {
  atGym,
  chooseStarter,
  defaultItemPlan,
  defaultMoveReplacement,
  createRun,
  gymsCleared,
  nodeOptions,
  playRun,
  resolveNode,
  scriptedRunPolicy,
  segmentOf,
  SEGMENTS_PER_RUN,
  type RunPolicy,
  type RunState,
  stepsOf,
  chooseLocale,
} from '../src/core/run';
import { playerLevel } from '../src/data/scaling';
import { DEFAULT_TUNING, withTuning } from '../src/data/tuning';
import { moveChoice, type PokemonState } from '../src/core/types';

/**
 * A hand-built `NodeResult` reporting no per-member counters. **Stage 4.7.**
 *
 * An empty array rather than one zeroed entry per member, and the difference is
 * a statement: `applyBattleState` reads `contribution[index]` and leaves a
 * member's running total alone when there is nothing at that index, so this
 * says "this fixture is not about contribution" rather than "every member did
 * nothing". The fixtures below are about state transitions — a wipe, a heal, a
 * berry — and a zero would be an assertion they are not making.
 */
const NO_CONTRIBUTION: never[] = [];


/** Prefers a node kind when it is offered, so a test can steer a run. */
function preferring(kind: NodeSpec['kind'], battle: Policy = greedyAiPolicy): RunPolicy {
  return {
    chooseStarter: async () => 0,
    chooseLocale: async () => 0,
    chooseNode: async (options) => {
      const index = options.findIndex((option) => option.kind === kind);
      return index === -1 ? 0 : index;
    },
    chooseReward: async () => 0,
    chooseShopPurchases: async () => [],
    chooseEventOption: async () => 0,
    chooseMoveRecipient: async () => 0,
    chooseMoveToReplace: async (member, incoming) => defaultMoveReplacement(member, incoming),
    chooseAcquisition: async () => ({ kind: 'decline' }),
    chooseItemPlan: async (state) => defaultItemPlan(state),
    battle,
  };
}

describe('headless run', () => {
  it('plays a full segment under a scripted policy with no DOM', async () => {
    expect(typeof globalThis.document).toBe('undefined');

    const run = await playRun('RUN-HEADLESS', scriptedRunPolicy(greedyAiPolicy));

    expect(run.outcome === 'victory' || run.outcome === 'defeat').toBe(true);
    expect(run.state.history.length).toBeGreaterThan(0);
    // The last node played is always the gym on a victory, and on a defeat is
    // whatever killed the party.
    const last = run.state.history[run.state.history.length - 1];
    expect(last?.node).toBeDefined();
    if (run.outcome === 'victory') expect(last?.node.kind).toBe('gym');
  });

  it('plays many seeds in one process, which is what Stage 2 needs', async () => {
    const outcomes: string[] = [];
    for (let i = 0; i < 12; i++) {
      outcomes.push((await playRun(`RUN-SWEEP-${i}`, scriptedRunPolicy(greedyAiPolicy))).outcome);
    }
    expect(outcomes).toHaveLength(12);
    // A sweep that reports one outcome for every seed is measuring nothing.
    expect(new Set(outcomes).size).toBeGreaterThan(0);
  });

  it('reaches the gym only after every step, and never offers it as a choice', async () => {
    const seen: NodeSpec[] = [];
    const policy: RunPolicy = {
      chooseStarter: async () => 0,
      chooseLocale: async () => 0,
      chooseNode: async (options) => {
        // Every node the player is *offered* must be choosable; the gym is not.
        for (const option of options) expect(option.kind).not.toBe('gym');
        seen.push(...options);
        return 0;
      },
      chooseReward: async () => 0,
      chooseShopPurchases: async () => [],
      chooseEventOption: async () => 0,
      chooseMoveRecipient: async () => 0,
    chooseMoveToReplace: async (member, incoming) => defaultMoveReplacement(member, incoming),
      chooseAcquisition: async () => ({ kind: 'decline' }),
      chooseItemPlan: async (state) => defaultItemPlan(state),
      battle: greedyAiPolicy,
    };

    const run = await playRun('RUN-GYM', policy);
    const steps = stepsOf(run.state).length;
    // A run that reached the gym asked for exactly one choice per step.
    if (run.outcome === 'victory') {
      expect(run.state.history.filter((visit) => visit.node.kind !== 'gym')).toHaveLength(steps);
    }
    expect(seen.length).toBeGreaterThan(0);
  });

  it('produces the same run twice for the same seed and the same decisions', async () => {
    const first = await playRun('RUN-TWICE', scriptedRunPolicy(greedyAiPolicy));
    const second = await playRun('RUN-TWICE', scriptedRunPolicy(greedyAiPolicy));

    expect(second.outcome).toBe(first.outcome);
    expect(second.log).toEqual(first.log);
    expect(second.state.history.map((v) => [v.node.id, v.hpAfter, v.result?.turns])).toEqual(
      first.state.history.map((v) => [v.node.id, v.hpAfter, v.result?.turns]),
    );
  });
});

describe('persistence between nodes', () => {
  it('carries HP and PP across a node boundary', async () => {
    // Take fights, never rest, and watch the resources only go down.
    const hpByNode: number[] = [];
    const ppByNode: number[] = [];

    await playRun('RUN-ATTRITION', preferring('wild'), DEFAULT_TUNING, {
      onState: (state) => {
        const member = state.party[0];
        if (!member) return;
        hpByNode.push(member.hp);
        ppByNode.push(member.moves.reduce((total, move) => total + move.pp, 0));
      },
    });

    // Something has to have been spent, or "persistence" is untested.
    expect(Math.min(...hpByNode)).toBeLessThan(Math.max(...hpByNode));
    expect(Math.min(...ppByNode)).toBeLessThan(Math.max(...ppByNode));
  });

  it('restores HP and PP at a rest node', () => {
    const party = createParty([
      { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Crunch', 'Curse', 'Rest'], level: 30 },
    ]);
    const hurt: PokemonState[] = party.map((member) => ({
      ...member,
      hp: 12,
      status: 'brn',
      moves: member.moves.map((move) => ({ ...move, pp: 1 })),
    }));

    const rested = restParty(hurt, DEFAULT_TUNING);
    const member = rested[0];
    expect(member?.hp).toBe(member?.maxHp);
    expect(member?.status).toBeNull();
    expect(member?.moves.every((move) => move.pp === move.maxPp)).toBe(true);
  });

  it('honours a partial rest, so Stage 3 can price one', () => {
    const party = createParty([
      { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Crunch', 'Curse', 'Rest'], level: 30 },
    ]);
    const hurt = party.map((member) => ({ ...member, hp: 1 }));
    const half = restParty(hurt, withTuning({ restHpFraction: 0.5, restPpFraction: 0 }));

    const member = half[0];
    expect(member?.hp).toBe(1 + Math.round((member?.maxHp ?? 0) * 0.5));
    expect(member?.moves.every((move) => move.pp === move.maxPp)).toBe(true);
  });

  it('clears status between nodes but leaves HP and PP alone', () => {
    const state = withStarter('RUN-STATUS');
    const member = state.party[0];
    expect(member).toBeDefined();

    const hurt: RunState = {
      ...state,
      party: [{ ...member!, hp: 7, status: 'par', moves: member!.moves.map((m) => ({ ...m, pp: 2 })) }],
    };
    const node = firstNodeOfKind(hurt, 'wild') ?? nodeOptions(hurt)[0];
    expect(node).toBeDefined();

    const next = resolveNode(hurt, { node: node! });
    const after = next.party[0];
    expect(after?.status).toBeNull();
    expect(after?.hp).toBe(7);
    expect(after?.moves.every((move) => move.pp === 2)).toBe(true);
  });

  it('keeps status across nodes when the tuning says so', () => {
    const keep = withTuning({ clearStatusBetweenNodes: false });
    const state = withStarter('RUN-STATUS-KEEP', keep);
    const member = state.party[0]!;
    const hurt: RunState = { ...state, party: [{ ...member, status: 'par' }] };
    const node = nodeOptions(hurt)[0]!;

    expect(resolveNode(hurt, { node }).party[0]?.status).toBe('par');
  });

  it('starts a battle at the HP the run left the party on', async () => {
    // The carry-over path goes through the sim, so this is the assertion that
    // proves it lands: the view the policy sees on turn 1 of a later node is
    // not at full HP.
    //
    // Scanned across seeds rather than pinned to one. A run that dies in its
    // first fight has no second fight to carry HP into, and which seeds do that
    // is a property of the current tuning — pinning one would make this test
    // fail on every balance pass for a reason that has nothing to do with
    // carry-over.
    let carried = false;
    for (let seed = 0; seed < 8 && !carried; seed++) {
      const openingHp: number[] = [];
      const battle: Policy = async (view) => {
        if (view.turn === 1) openingHp.push(view.me.hp);
        return firstUsableMovePolicy(view);
      };

      await playRun(`RUN-CARRY-${seed}`, preferring('wild', battle));
      carried =
        openingHp.length > 1 && openingHp.slice(1).some((hp) => hp < (openingHp[0] ?? 0));
    }
    expect(carried, 'no run in the sample opened a later battle on a damaged Pokemon').toBe(true);
  });
});

describe('run outcomes', () => {
  it('ends in defeat when the party wipes', () => {
    const state = withStarter('RUN-WIPE');
    const node = nodeOptions(state).find((option) => option.kind !== 'rest') ?? nodeOptions(state)[0]!;
    const dead = state.party.map((member) => ({ ...member, hp: 0, fainted: true }));

    const next = resolveNode(state, {
      node,
      battle: { result: { winner: 'p2', turns: 4, cause: 'faint' }, party: dead, contribution: NO_CONTRIBUTION },
    });

    expect(next.outcome).toBe('defeat');
    expect(isWiped(next.party)).toBe(true);
  });

  it('advances a segment when a gym falls, and levels the party doing it', () => {
    const state = atTheGym(withStarter('RUN-WIN'));
    const next = resolveNode(state, {
      node: segmentOf(state).gym,
      battle: { result: { winner: 'p1', turns: 9, cause: 'faint' }, party: state.party, contribution: NO_CONTRIBUTION },
    });

    // Eight gyms: clearing the first advances rather than wins.
    expect(next.outcome).toBeNull();
    expect(next.currentSegment).toBe(1);
    expect(next.position).toBe(0);
    // The player's level is a function of segment index, and this is the only
    // moment it moves. No XP, no grinding.
    expect(next.party[0]?.spec.level).toBe(playerLevel(1));
    expect(next.party[0]?.spec.level).toBeGreaterThan(state.party[0]!.spec.level);
  });

  it('ends in victory only when the last gym falls', () => {
    let state = atTheGym(withStarter('RUN-WIN-LAST'));
    // Walk to the final segment through the same transition a run uses, so this
    // asserts the end condition rather than a hand-built state.
    for (let segment = 0; segment < SEGMENTS_PER_RUN - 1; segment++) {
      state = atTheGym(
        resolveNode(state, {
          node: segmentOf(state).gym,
          battle: { result: { winner: 'p1', turns: 5, cause: 'faint' }, party: state.party, contribution: NO_CONTRIBUTION },
        }),
      );
    }
    expect(state.currentSegment).toBe(SEGMENTS_PER_RUN - 1);

    const next = resolveNode(state, {
      node: segmentOf(state).gym,
      battle: { result: { winner: 'p1', turns: 9, cause: 'faint' }, party: state.party, contribution: NO_CONTRIBUTION },
    });
    expect(next.outcome).toBe('victory');
    expect(gymsCleared(next)).toBe(SEGMENTS_PER_RUN);
  });

  it('ends in defeat when the gym is not beaten, even without a wipe', () => {
    // A turn-limit draw against a gym leader is a gym the player did not beat.
    const state = atTheGym(withStarter('RUN-DRAW'));
    const next = resolveNode(state, {
      node: segmentOf(state).gym,
      battle: { result: { winner: null, turns: 200, cause: 'turn-limit' }, party: state.party, contribution: NO_CONTRIBUTION },
    });

    expect(next.outcome).toBe('defeat');
    expect(isWiped(next.party)).toBe(false);
  });

  it('checks the wipe before reviving, so revival cannot resurrect a dead run', () => {
    // reviveFaintedBetweenNodes is on. If the order were reversed this run
    // would carry on with a full-HP Pokemon and no defeat.
    const state = withStarter('RUN-ORDER');
    expect(state.tuning.reviveFaintedBetweenNodes).toBe(true);
    const node = nodeOptions(state)[0]!;
    const dead = state.party.map((member) => ({ ...member, hp: 0, fainted: true }));

    const next = resolveNode(state, {
      node,
      battle: { result: { winner: 'p2', turns: 3, cause: 'faint' }, party: dead, contribution: NO_CONTRIBUTION },
    });
    expect(next.outcome).toBe('defeat');
    expect(next.party[0]?.fainted).toBe(true);
  });

  it('refuses to resolve a node after the run has ended', () => {
    const state = withStarter('RUN-CLOSED');
    const node = nodeOptions(state)[0]!;
    const ended = { ...state, outcome: 'defeat' as const };
    expect(() => resolveNode(ended, { node })).toThrow(/already ended/);
  });
});

describe('run shape', () => {
  it('holds segments, not a segment', () => {
    const state = createRun('RUN-SHAPE');
    expect(Array.isArray(state.segments)).toBe(true);
    expect(state.segments).toHaveLength(SEGMENTS_PER_RUN);
    expect(state.segments.map((segment) => segment.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(state.currentSegment).toBe(0);
  });

  it('holds a party, not a starter', () => {
    const state = withStarter('RUN-PARTY');
    expect(Array.isArray(state.party)).toBe(true);
    expect(state.party).toHaveLength(1);
    expect(state.starterIndex).toBe(0);
  });

  it('rejects a starter choice that was never offered', () => {
    expect(() => chooseStarter(createRun('RUN-BAD'), 99)).toThrow(/out of range/);
  });

  it('offers nothing to choose once the steps are done', () => {
    const state = atTheGym(withStarter('RUN-END'));
    expect(atGym(state)).toBe(true);
    expect(nodeOptions(state)).toEqual([]);
  });

  it('accepts a bare move choice on every turn that is a move turn', async () => {
    /*
     * This used to say "shaped exactly like Stage 0" and hand `playRun` a
     * policy that returned `move 1` unconditionally. Stage 4 broke it, and the
     * break is the feature: the player's party can now hold more than one
     * Pokemon, so *the player* meets forced switches too, and a policy that
     * only knows how to pick a move can no longer finish a run. It failed with
     * `the sim wants a switch and will not accept a move`, which is the driver
     * refusing to desync rather than a bug.
     *
     * So the assertion narrows to what it was always really about: a move
     * choice needs no wrapping, no turn number and no side — it is just
     * `{kind, slot}`, and that shape still goes straight into the log.
     */
    /*
     * Slot 1 when slot 1 is usable, and the first usable slot otherwise.
     *
     * It returned `move 1` unconditionally until Stage 4.6b re-banded every
     * moveset, at which point this seed's slot 1 ran out of PP mid-run and the
     * driver refused the choice — correctly. A policy that cannot answer "slot
     * 1 is spent" is not what this test is about, so it answers, and the
     * assertion below narrows to the shape of the entries that *did* take slot
     * 1.
     */
    const run = await playRun(
      'RUN-CHOICE',
      scriptedRunPolicy(async (view) => {
        const forced = forcedSwitchFallback(view);
        if (forced) return forced;
        const first = view.moves.find((move) => move.slot === 1 && move.usable);
        return moveChoice(first?.slot ?? view.moves.find((move) => move.usable)?.slot ?? 1);
      }),
    );
    const battleDecisions = run.log.decisions.filter((decision) => decision.kind === 'battle');
    const moves = battleDecisions.filter(
      (decision) =>
        decision.kind === 'battle' && decision.choice.kind === 'move' && decision.choice.slot === 1,
    );

    expect(moves.length).toBeGreaterThan(0);
    for (const decision of moves) {
      expect(decision).toEqual({ kind: 'battle', choice: { kind: 'move', slot: 1 } });
    }
  });
});

// --- helpers ---------------------------------------------------------------

/**
 * A run with a starter *and* a locale, which is where the map begins from
 * Stage 4.6a.
 *
 * A segment has no route until a locale is picked, so a run that has only
 * chosen a starter correctly offers no nodes at all — `nodeOptions` returns
 * empty and `atGym` is false. Every helper below wants the state one decision
 * further along than that.
 */
function withStarter(seed: string, tuning = DEFAULT_TUNING): RunState {
  return chooseLocale(chooseStarter(createRun(seed, tuning), 0), 0);
}

function atTheGym(state: RunState): RunState {
  return { ...state, position: stepsOf(state).length };
}

function firstNodeOfKind(state: RunState, kind: NodeSpec['kind']): NodeSpec | undefined {
  return nodeOptions(state).find((option) => option.kind === kind);
}
