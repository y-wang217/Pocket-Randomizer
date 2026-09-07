/**
 * A battle must be fully playable with no browser present.
 *
 * Stage 2 needs to run a thousand seeds headless to tune the randomizer. This
 * test is that capability, exercised at n=1 now so it cannot quietly rot into
 * a UI-coupled battle loop that only runs in a page.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy, evaluateMoves } from '../src/core/battle/ai';
import { createBattle, runBattle } from '../src/core/battle/driver';
import { createHumanPolicy, firstUsableMovePolicy } from '../src/core/battle/policy';
import { moveChoice, type TeamSpec } from '../src/core/types';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../src/data/mons';

describe('headless battle', () => {
  it('plays to completion under two AI policies with no DOM', async () => {
    expect(typeof globalThis.document).toBe('undefined');

    const run = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, 'HEADLESS', greedyAiPolicy, greedyAiPolicy);

    expect(run.result.winner).not.toBeNull();
    expect(run.result.turns).toBeGreaterThan(0);
    expect(run.result.cause).toBe('faint');
    expect(run.protocol.some((line) => line.startsWith('|win|'))).toBe(true);
  });

  it('runs many seeds in one process, which is what Stage 2 needs', async () => {
    const seeds = Array.from({ length: 25 }, (_, i) => `sweep-${i}`);
    const results = [];
    for (const seed of seeds) {
      results.push(await runBattle(PLAYER_TEAM, OPPONENT_TEAM, seed, greedyAiPolicy, firstUsableMovePolicy));
    }

    expect(results).toHaveLength(seeds.length);
    expect(results.every((run) => run.result.winner !== null)).toBe(true);
    // If every seed produced the same turn count the seed is not reaching the
    // damage rolls, and the sweep would be measuring one battle 25 times.
    expect(new Set(results.map((run) => run.result.turns)).size).toBeGreaterThan(1);
  });

  it('exposes a battle view that a policy can decide from', () => {
    const session = createBattle({ teams: { p1: PLAYER_TEAM, p2: OPPONENT_TEAM }, seed: 'VIEW' });
    const view = session.viewFor('p1');

    expect(view.awaitingChoice).toBe(true);
    expect(view.me.species).toBe('Charizard');
    expect(view.foe.species).toBe('Blastoise');
    expect(view.me.hpFraction).toBe(1);
    expect(view.moves).toHaveLength(4);
    expect(view.moves.map((m) => m.name)).toContain('Flamethrower');

    const flamethrower = view.moves.find((m) => m.name === 'Flamethrower');
    expect(flamethrower).toMatchObject({ type: 'Fire', category: 'Special', basePower: 90, usable: true });
    expect(flamethrower?.pp).toBe(24);
  });

  it('hides the opponent ability but reveals your own', () => {
    const session = createBattle({ teams: { p1: PLAYER_TEAM, p2: OPPONENT_TEAM }, seed: 'VIEW' });
    const view = session.viewFor('p1');
    expect(view.me.ability).toBe('Solar Power');
    expect(view.foe.ability).toBeNull();
  });

  it('accepts a team the standard formats would reject', async () => {
    // Stage 2's randomizer will produce exactly this kind of team, so the
    // engine has to take it without a validator in the way.
    const illegal: TeamSpec = [
      { species: 'Magikarp', ability: 'Levitate', moves: ['Boomburst', 'Judgment', 'Recover', 'Splash'], level: 50 },
    ];
    const run = await runBattle(illegal, OPPONENT_TEAM, 'ILLEGAL', firstUsableMovePolicy, firstUsableMovePolicy);

    expect(run.protocol.some((line) => line.includes('Boomburst'))).toBe(true);
    expect(run.result.winner).not.toBeNull();
  });

  it('drives a human policy from outside the battle loop', async () => {
    const human = createHumanPolicy();
    const finished = runBattle(PLAYER_TEAM, OPPONENT_TEAM, 'HUMAN', human.policy, greedyAiPolicy);

    // The UI does exactly this, only the ticks are clicks.
    for (let guard = 0; guard < 100; guard++) {
      await Promise.resolve();
      if (!human.isWaiting()) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (!human.isWaiting()) continue;
      }
      if (!human.submit(moveChoice(1))) break;
    }

    const run = await finished;
    expect(run.result.winner).not.toBeNull();
  });
});

describe('greedy ai', () => {
  it('prefers its highest-damage move', () => {
    const session = createBattle({ teams: { p1: PLAYER_TEAM, p2: OPPONENT_TEAM }, seed: 'AI' });
    const evaluations = evaluateMoves(session.viewFor('p2'));

    const byName = new Map(evaluations.map((e) => [e.move.name, e]));
    // Blastoise into Charizard: Surf is 4x, Ice Beam is neutral, and the two
    // status moves do nothing. If this ordering breaks, the calc is not wired
    // to the view correctly.
    expect(byName.get('Surf')!.expectedDamage).toBeGreaterThan(byName.get('Ice Beam')!.expectedDamage);
    expect(byName.get('Iron Defense')!.expectedDamage).toBe(0);
    expect(byName.get('Yawn')!.expectedDamage).toBe(0);
  });

  it('picks the winning move deterministically', async () => {
    const session = createBattle({ teams: { p1: PLAYER_TEAM, p2: OPPONENT_TEAM }, seed: 'AI' });
    const view = session.viewFor('p2');
    const surfSlot = view.moves.find((m) => m.name === 'Surf')!.slot;

    expect(await greedyAiPolicy(view)).toEqual(moveChoice(surfSlot));
    expect(await greedyAiPolicy(view)).toEqual(moveChoice(surfSlot));
  });
});
