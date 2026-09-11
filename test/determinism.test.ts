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
import { createRng, RNG_STREAMS } from '../src/core/rng';
import { FIXTURE_BATTLE_KEY } from '../src/core/streamKeys';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../src/data/mons';

const SEED = 'GYMRUN01';

describe('determinism', () => {
  it('produces an identical protocol log for the same seed and choices, twice', async () => {
    const first = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, SEED, firstUsableMovePolicy, firstUsableMovePolicy);
    const second = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, SEED, firstUsableMovePolicy, firstUsableMovePolicy);

    expect(stripNondeterministic(second.protocol)).toEqual(stripNondeterministic(first.protocol));
    expect(second.result).toEqual(first.result);
    expect(second.battleLog.decisions).toEqual(first.battleLog.decisions);
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
    expect(run.session.simSeed).toBe(createRng(SEED).battle.at(FIXTURE_BATTLE_KEY).nextSimSeed());
  });
});

describe('rng streams', () => {
  /*
   * Two tests that lived here — "the same values for the same seed" and
   * "different streams, different sequences" — drew off the unkeyed root of a
   * named stream, and the `contentHash` release deleted that root. Both
   * properties are held at the key level by `test/stream-keys.test.ts`
   * (groups 2 and 4), so they are deleted rather than ported. The two below
   * are ported to keys, and the last one guards the deletion itself.
   */
  it('keeps streams independent, so later stages cannot shift battle rolls', () => {
    // This is the reason the streams exist. Stage 2 draws heavily from `map`
    // and `rewards`; if either could advance `battle`, every seed recorded
    // before Stage 2 would replay as a different fight.
    const untouched = createRng('seed-x');
    const drained = createRng('seed-x');
    for (let i = 0; i < 500; i++) {
      drained.map.at('drain').nextUint32();
      drained.rewards.at('drain').nextUint32();
    }
    expect(drained.battle.at(FIXTURE_BATTLE_KEY).nextSimSeed()).toBe(untouched.battle.at(FIXTURE_BATTLE_KEY).nextSimSeed());
  });

  it('emits a sodium sim seed of the length @pkmn/sim expects', () => {
    const seed = createRng('seed-z').battle.at(FIXTURE_BATTLE_KEY).nextSimSeed();
    expect(seed).toMatch(/^sodium,[0-9a-f]{64}$/);
  });

  it('has no unkeyed sequence: a named stream opens keys and draws nothing itself', () => {
    /*
     * The deletion, guarded. From 4.6a to the `contentHash` release
     * `rng.map.nextUint32()` was a draw off a root sequence with a global
     * position — the exact coupling keying exists to remove — and it was
     * exported, so someone could reach for it. A named stream is now `at`,
     * `keys` and `totalDraws`, and this test is what makes putting the root
     * back a red test rather than a quiet regression.
     */
    const rng = createRng('no-root');
    for (const name of RNG_STREAMS) {
      const stream: object = rng[name];
      expect(Object.keys(stream).sort(), name).toEqual(['at', 'keys', 'totalDraws']);
      for (const method of ['nextUint32', 'nextFloat', 'nextInt', 'pick', 'inRange', 'nextSimSeed', 'draws']) {
        expect(method in stream, `${name}.${method} exists`).toBe(false);
      }
    }
    // And at the type level, so the compiler refuses the old spelling too.
    // @ts-expect-error the unkeyed sequence was deleted; draw through a key
    expect(() => rng.map.nextUint32()).toThrow();
  });
});
