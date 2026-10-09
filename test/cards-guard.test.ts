/**
 * The guard bot, its trainer and the solver
 * (`docs/spec/gymrun-patch-card-battle-scenarios-and-bot.md`).
 */
import { describe, expect, it } from 'vitest';

import { ENCOUNTERS } from '../src/cardData/encounters';
import { GUARD_SEARCH, GUARD_WEIGHTS } from '../src/cardData/guardWeights';
import { runSuite } from '../src/core/cards/bench';
import { botStream, playBattle, randomBot } from '../src/core/cards/bots';
import { enemyMovesAndTelegraph } from '../src/core/cards/enemies';
import { evaluate, guardBot, incoming, planRound } from '../src/core/cards/guard';
import { checkInvariants } from '../src/core/cards/invariants';
import { replay } from '../src/core/cards/log';
import { solveBattle } from '../src/core/cards/solve';
import { mutate, train } from '../src/core/cards/train';
import { createRng } from '../src/core/rng';
import { cardTrainKey } from '../src/core/streamKeys';
import { at, begun, board } from './fixtures/card-battle';

const SCENARIOS = Object.keys(ENCOUNTERS);

describe('the guard bot', () => {
  it('plays whole battles in every scenario: every action accepted, invariants held, every battle ended', () => {
    for (const id of SCENARIOS) {
      for (let i = 0; i < 6; i++) {
        const problems: string[] = [];
        const played = playBattle(id, `GUARD${i}`, guardBot(), (_before, action, result) => {
          if (!result.ok) problems.push(`${JSON.stringify(action)} refused: ${result.reason}`);
          else problems.push(...checkInvariants(result.state));
        });
        expect(problems, `${id} GUARD${i}`).toEqual([]);
        expect(['won', 'lost'], `${id} GUARD${i}`).toContain(played.state.phase);
        // One Start per wave reached (Part C).
        const waves = played.events.filter((e) => e.t === 'waveStarted').length + 1;
        expect(played.log.actions.filter((a) => a.type === 'start')).toHaveLength(waves);
      }
    }
  });

  it('is deterministic: the same battle gives the same log', () => {
    const a = playBattle('skirmish', 'SAME', guardBot()).log;
    const b = playBattle('skirmish', 'SAME', guardBot()).log;
    expect(a).toEqual(b);
  });

  it('plays fair: the plan it picks does not change with what is still in the draw pile', () => {
    for (const seed of ['FAIR1', 'FAIR2', 'FAIR3']) {
      const { state } = begun('skirmish', seed);
      const shuffled = { ...state, piles: { ...state.piles, draw: [...state.piles.draw].reverse() } };
      expect(planRound(shuffled).actions, seed).toEqual(planRound(state).actions);
    }
  });

  it('reads a telegraphed Strike as aimed at the unit in front, and fears it more on a fragile unit', () => {
    // A Drone in lane 1 striking: A (1 HP) or C (3 HP) in front of it.
    const struck = (front: 'A' | 'C') => {
      const s = board({ enemies: [at(1, 6), null, null], units: { A: front === 'A' ? at(1, 2) : at(2, 1), C: front === 'C' ? at(1, 2) : at(3, 2) } });
      s.enemies[0]!.step = 0;
      enemyMovesAndTelegraph({ s, events: [] }, false);
      return s;
    };
    expect(incoming(struck('A'))).toEqual({ A: 1 });
    expect(incoming(struck('C'))).toEqual({ C: 1 });
    expect(evaluate(struck('C'))).toBeGreaterThan(evaluate(struck('A')));
  });

  it('places the Commander, the 1 HP unit, on the back row', () => {
    for (const id of SCENARIOS) {
      for (const seed of ['PLACE1', 'PLACE2']) {
        const played = playBattle(id, seed, guardBot());
        const started = replay({ ...played.log, actions: played.log.actions.slice(0, played.log.actions.findIndex((a) => a.type === 'start') + 1) });
        expect(started.state.units.find((u) => u.id === 'A')!.pos!.col, `${id} ${seed}`).toBe(1);
      }
    }
  });

  it('wins more battles than the random bot on the same seeds', () => {
    let i = 0;
    const random = runSuite(() => {
      const stream = botStream(`FLOOR${i++}`);
      return (state) => randomBot(state, stream);
    }, 'FLOOR', 4);
    const guard = runSuite(() => guardBot(), 'FLOOR', 4);
    expect(guard.filter((r) => r.won).length).toBeGreaterThan(random.filter((r) => r.won).length);
  });
});

describe('the trainer', () => {
  it('mutates from its own stream: the same stream gives the same child, and Lethal stays a share', () => {
    const child = () => mutate(GUARD_WEIGHTS, createRng('M').policy.at(cardTrainKey()), 0.5);
    expect(child()).toEqual(child());
    const stream = createRng('M2').policy.at(cardTrainKey());
    for (let i = 0; i < 50; i++) expect(mutate(GUARD_WEIGHTS, stream, 1).lethal).toBeLessThanOrEqual(1);
  });

  it('never ends on weights that score worse than its start, and is a function of its options', () => {
    const options = { seed: 'T', trainPrefix: 'TT', perScenario: 1, generations: 1, children: 2, sigma: 0.3, scenarios: ['test'], search: GUARD_SEARCH };
    const a = train(GUARD_WEIGHTS, options);
    expect(a.fitness).toBeGreaterThanOrEqual(a.startFitness);
    expect(a.battlesPlayed).toBe(3);
    expect(train(GUARD_WEIGHTS, options)).toEqual(a);
  });
});

describe('the solver', () => {
  it('finds a line whose log replays to the state it reports', () => {
    const solved = solveBattle('test', 'SOLVE1', { width: 4, branch: 3 });
    expect(['won', 'lost']).toContain(solved.state.phase);
    expect(replay(JSON.parse(JSON.stringify(solved.log))).state).toEqual(solved.state);
  });
});
