/**
 * The single most important property in the project.
 *
 * A roguelike whose seed does not reproduce its run has no seed. Every other
 * feature — replay, the rematch button, Stage 2's thousand-seed balance sweep,
 * a bug report that says "seed ABCD1234 turn 6" — is downstream of this test.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { runBattle, stripNondeterministic } from '../src/core/battle/driver';
import { firstUsableMovePolicy } from '../src/core/battle/policy';
import { createRng } from '../src/core/rng';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../src/data/mons';

const SEED = 'GYMRUN01';

describe('determinism', () => {
  it('produces an identical protocol log for the same seed and choices, twice', async () => {
    const first = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, SEED, firstUsableMovePolicy, firstUsableMovePolicy);
    const second = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, SEED, firstUsableMovePolicy, firstUsableMovePolicy);

    expect(stripNondeterministic(second.protocol)).toEqual(stripNondeterministic(first.protocol));
    expect(second.result).toEqual(first.result);
    expect(second.runLog.decisions).toEqual(first.runLog.decisions);
  });

  it('produces an identical log with the AI on both sides', async () => {
    const first = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, SEED, greedyAiPolicy, greedyAiPolicy);
    const second = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, SEED, greedyAiPolicy, greedyAiPolicy);

    expect(stripNondeterministic(second.protocol)).toEqual(stripNondeterministic(first.protocol));
    expect(second.result).toEqual(first.result);
  });

  it('produces a different battle for a different seed', async () => {
    // Not a guarantee in principle, but with damage rolls, accuracy and speed
    // ties in play, two seeds agreeing line-for-line would mean the sim seed is
    // not reaching the engine at all.
    const a = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, 'SEED-A', firstUsableMovePolicy, firstUsableMovePolicy);
    const b = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, 'SEED-B', firstUsableMovePolicy, firstUsableMovePolicy);

    expect(stripNondeterministic(a.protocol)).not.toEqual(stripNondeterministic(b.protocol));
  });

  it('derives the sim seed from the run seed', async () => {
    const run = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, SEED, firstUsableMovePolicy, firstUsableMovePolicy);
    expect(run.session.simSeed).toBe(createRng(SEED).battle.nextSimSeed());
  });
});

describe('rng streams', () => {
  it('gives the same values for the same seed', () => {
    const a = createRng('abc');
    const b = createRng('abc');
    expect([a.battle.nextUint32(), a.battle.nextUint32()]).toEqual([b.battle.nextUint32(), b.battle.nextUint32()]);
  });

  it('keeps streams independent, so later stages cannot shift battle rolls', () => {
    // This is the reason the streams exist. Stage 2 will draw heavily from
    // `map` and `rewards`; if either could advance `battle`, every seed
    // recorded before Stage 2 would replay as a different fight.
    const untouched = createRng('seed-x');
    const drained = createRng('seed-x');
    for (let i = 0; i < 500; i++) {
      drained.map.nextUint32();
      drained.rewards.nextUint32();
    }
    expect(drained.battle.nextSimSeed()).toBe(untouched.battle.nextSimSeed());
  });

  it('gives different streams different sequences for one seed', () => {
    const rng = createRng('seed-y');
    expect(rng.map.nextUint32()).not.toBe(rng.battle.nextUint32());
  });

  it('emits a sodium sim seed of the length @pkmn/sim expects', () => {
    const seed = createRng('seed-z').battle.nextSimSeed();
    expect(seed).toMatch(/^sodium,[0-9a-f]{64}$/);
  });
});
