/**
 * Defender Mode v0, step 3: the wave structure, the door, the intermission and
 * the boss. Headless `playRun` to completion.
 *
 * `docs/spec/gymrun-defender-mode-v0-fun-test.md`. Holds the prompt's test 1
 * over whole runs, and the run structure section.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { chooseDraftPick, chooseGymType } from '../src/core/defender/opening';
import { waveLength } from '../src/core/defender/waves';
import type { NodeSpec } from '../src/core/encounters';
import {
  atGym,
  createRun,
  gymsCleared,
  nodeOptions,
  partyCapacity,
  playRun,
  replayRun,
  resolveNode,
  scriptedRunPolicy,
  segmentOf,
  teachableNow,
  type NodeResult,
  type RunPolicy,
  type RunState,
} from '../src/core/run';
import type { Reward } from '../src/core/rewards';
import { DEFENDER_RANKS, DEFENDER_RELIC_IDS, DEFENDER_WAVE_LENGTH } from '../src/data/defender';
import { defenderOpponentIvs, opponentTeamSize } from '../src/data/scaling';
import { classesAtRank } from '../src/data/trainerClasses';
import { DEFAULT_TUNING } from '../src/data/tuning';

const SEEDS = Array.from({ length: 25 }, (_, i) => `WAVES-${i}`);

function relicsOn(options: readonly Reward[]): string[] {
  return options.flatMap((option) => (option.kind === 'relic' ? [option.relic, ...option.alternates] : []));
}

describe('the ranks, as generated', () => {
  it('builds eight ranks of [2,2,3,3,4,4,5,5] doors, an intermission and a boss, on every seed', () => {
    expect(DEFENDER_WAVE_LENGTH).toEqual([2, 2, 3, 3, 4, 4, 5, 5]);
    for (const seed of SEEDS) {
      const run = createRun(seed, DEFAULT_TUNING, 'defender');
      expect(run.segments).toHaveLength(DEFENDER_RANKS);
      run.segments.forEach((rank, r) => {
        expect(rank.localeOffer).toEqual([]);
        expect(rank.routes).toHaveLength(1);
        const steps = rank.routes[0]!.steps;
        expect(steps).toHaveLength(waveLength(r) + 1);
        const doors = steps.slice(0, -1);
        const intermission = steps[steps.length - 1]!;

        for (const door of doors) {
          expect(door.options).toHaveLength(2);
          const [a, b] = door.options as [NodeSpec, NodeSpec];
          expect(a.trainerClass).not.toBe(b.trainerClass);
          for (const node of door.options) {
            expect(node.kind).toBe('trainer');
            expect(node.tier).not.toBeNull();
            expect(classesAtRank(r).map((entry) => entry.id)).toContain(node.trainerClass);
            expect(node.reward?.options).toHaveLength(3);
            for (const spec of node.encounter?.team ?? []) expect(spec.ivs).toBe(defenderOpponentIvs(r));
          }
        }

        expect(intermission.options).toHaveLength(1);
        expect(intermission.options[0]?.kind).toBe('shop');
        expect(intermission.options[0]?.shop).not.toBeNull();

        expect(rank.gym.kind).toBe('gym');
        expect(rank.gym.encounter?.team).toHaveLength(opponentTeamSize('gym', r, 'normal'));
        for (const spec of rank.gym.encounter?.team ?? []) expect(spec.ivs).toBe(defenderOpponentIvs(r));
        expect(rank.gym.gymMoveOffer?.options).toHaveLength(3);
        expect(rank.gym.reward?.options).toHaveLength(3);
      });
    }
  });

  it('switches locales, wild nodes, rest nodes and events off', () => {
    for (const seed of SEEDS) {
      for (const rank of createRun(seed, DEFAULT_TUNING, 'defender').segments) {
        for (const node of rank.routes.flatMap((route) => route.steps.flatMap((step) => step.options))) {
          expect(['trainer', 'shop']).toContain(node.kind);
          expect(node.locale).toBeNull();
          expect(node.event).toBeNull();
          expect(node.acquisition).toBeNull();
        }
      }
    }
  });

  it('offers relics only from the defender list (ruling R2)', () => {
    const allowed = new Set<string>(DEFENDER_RELIC_IDS);
    let seen = 0;
    for (const seed of SEEDS) {
      for (const rank of createRun(seed, DEFAULT_TUNING, 'defender').segments) {
        const offers = [rank.gym.reward, ...rank.routes[0]!.steps.flatMap((step) => step.options.map((node) => node.reward))];
        for (const offer of offers) {
          for (const relic of relicsOn(offer?.options ?? [])) {
            seen++;
            expect(allowed.has(relic), relic).toBe(true);
          }
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('gives every node a unique id and a real sim seed', () => {
    const run = createRun('WAVES-IDS', DEFAULT_TUNING, 'defender');
    const nodes = run.segments.flatMap((rank) => [rank.gym, ...rank.routes[0]!.steps.flatMap((step) => step.options)]);
    expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
    for (const node of nodes) {
      if (node.encounter) expect(node.encounter.simSeed).not.toMatch(/^sodium,0+$/);
    }
  });

  it('generates the same map twice, and the same map whatever the gym type decides', () => {
    const first = createRun('WAVES-SAME', DEFAULT_TUNING, 'defender');
    expect(createRun('WAVES-SAME', DEFAULT_TUNING, 'defender')).toEqual(first);
    const fire = chooseGymType(first, 0);
    const flying = chooseGymType(first, 2);
    expect(fire.segments).toBe(first.segments);
    expect(flying.segments).toBe(first.segments);
  });
});

describe('a headless defender run (prompt test 1)', () => {
  const policy = (type: number, door: number): RunPolicy => ({
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseGymType: async () => type,
    chooseDoor: async () => door,
  });

  it('plays to an outcome under each gym type, and replays into the same run', async () => {
    for (const [type, seed] of ['WAVES-RUN-0', 'WAVES-RUN-1', 'WAVES-RUN-2'].entries()) {
      const run = await playRun(seed, policy(type, type % 2), DEFAULT_TUNING, { mode: 'defender' });
      expect(['victory', 'defeat']).toContain(run.outcome);
      expect(run.log.mode).toBe('defender');

      const again = await playRun(seed, policy(type, type % 2), DEFAULT_TUNING, { mode: 'defender' });
      expect(again.log).toEqual(run.log);
      expect(again.state).toEqual(run.state);

      const replayed = await replayRun(run.log, DEFAULT_TUNING, { mode: 'defender' });
      expect(replayed.log).toEqual(run.log);
      expect(replayed.state).toEqual(run.state);
    }
  }, 240_000);

  it('logs a door for every door entered and nothing for an intermission', async () => {
    const run = await playRun('WAVES-LOG', policy(1, 1), DEFAULT_TUNING, { mode: 'defender' });
    const kinds = run.log.decisions.map((decision) => decision.kind);
    for (const banned of ['starter', 'locale', 'node', 'event', 'acquisition']) expect(kinds).not.toContain(banned);
    const doorsEntered = run.state.history.filter((visit) => visit.node.kind === 'trainer');
    const intermissions = run.state.history.filter((visit) => visit.node.kind === 'shop');
    expect(kinds.filter((kind) => kind === 'door')).toHaveLength(doorsEntered.length);
    // A shop question is asked at each intermission, but no node question.
    expect(kinds.filter((kind) => kind === 'shop')).toHaveLength(intermissions.length);
    // The policy took the second challenger at every door.
    for (const visit of doorsEntered) expect(visit.node.id).toMatch(/-1$/);
  }, 120_000);

  it('refuses a defender run whose policy cannot answer a door', async () => {
    const { chooseDoor: _unused, ...noDoor } = policy(0, 0);
    void _unused;
    await expect(playRun('WAVES-NODOOR', noDoor, DEFAULT_TUNING, { mode: 'defender' })).rejects.toThrow(/chooseDoor/);
  });
});

/** A defender run past its opening: Fire, the first mon of every pick. */
function opened(seed: string): RunState {
  let state = chooseGymType(createRun(seed, DEFAULT_TUNING, 'defender'), 0);
  for (let pick = 0; pick < 3; pick++) state = chooseDraftPick(state, 0);
  return state;
}

/**
 * Visiting `node` with every battle won on paper: the party comes back at
 * `hp`, or as it went in. A walk through the structure, not a fight.
 */
function won(state: RunState, node: NodeSpec, hp?: number): NodeResult {
  if (!node.encounter) return { node };
  return {
    node,
    battle: {
      result: { winner: 'p1', turns: 1, cause: 'faint' },
      party: state.party.map(({ spec, maxHp, moves, status, fainted, item, hp: before }) => ({
        spec,
        maxHp,
        hp: hp ?? before,
        moves,
        status,
        fainted,
        ...(item ? { item } : {}),
      })),
      contribution: [],
    },
  };
}

function walkToVictory(seed: string): { state: RunState; capacities: number[] } {
  let state = opened(seed);
  const capacities = [partyCapacity(state)];
  for (let guard = 0; guard < 200 && !state.outcome; guard++) {
    const node = atGym(state) ? segmentOf(state).gym : nodeOptions(state)[0]!;
    state = resolveNode(state, won(state, node));
    if (node.kind === 'gym' && !state.outcome) capacities.push(partyCapacity(state));
  }
  return { state, capacities };
}

describe('the structure, walked to the end', () => {
  it('reaches victory after the eighth boss, through every door and intermission', () => {
    const { state } = walkToVictory('WAVES-WALK');
    expect(state.outcome).toBe('victory');
    expect(gymsCleared(state)).toBe(DEFENDER_RANKS);
    const kinds = state.history.map((visit) => visit.node.kind);
    expect(kinds.filter((kind) => kind === 'trainer')).toHaveLength(DEFENDER_WAVE_LENGTH.reduce((a, b) => a + b, 0));
    expect(kinds.filter((kind) => kind === 'shop')).toHaveLength(DEFENDER_RANKS);
  });

  it('unlocks slots on the schedule read one row ahead: 3, 3, 4, 4, 5, 5, 6, 6', () => {
    expect(walkToVictory('WAVES-SLOTS').capacities).toEqual([3, 3, 4, 4, 5, 5, 6, 6]);
  });

  it('restores the party fully after a boss, and not before it', () => {
    let state = opened('WAVES-HEAL');
    while (!atGym(state)) state = resolveNode(state, won(state, nodeOptions(state)[0]!, 1));
    // Nothing between the last door and the boss healed anyone.
    for (const member of state.party) expect(member.hp).toBeLessThan(member.maxHp);
    const after = resolveNode(state, won(state, segmentOf(state).gym, 1));
    for (const member of after.party) expect(member.hp).toBe(member.maxHp);
  });
});

describe('TMs are taught only at the intermission', () => {
  it('opens teaching after the intermission and keeps it shut after a door or a boss', () => {
    const run = createRun('WAVES-TM', DEFAULT_TUNING, 'defender');
    const rank = run.segments[0]!;
    const door = rank.routes[0]!.steps[0]!.options[0]!;
    const shop = rank.routes[0]!.steps[rank.routes[0]!.steps.length - 1]!.options[0]!;
    const visit = (node: NodeSpec) => ({ node, segment: 0, result: null, hpAfter: 1, casualties: [], tmsPaid: ['Flamethrower'] });
    const at = (node: NodeSpec) => teachableNow({ mode: 'defender', tms: ['Flamethrower'], history: [visit(node)] });
    expect([...at(door)]).toEqual([]);
    expect([...at(rank.gym)]).toEqual([]);
    expect([...at(shop)]).toEqual(['Flamethrower']);
    // Attacker teaching is untouched: a door's own paid move is teachable there.
    expect([...teachableNow({ tms: ['Flamethrower'], history: [visit(door)] })]).toEqual(['Flamethrower']);
  });
});
