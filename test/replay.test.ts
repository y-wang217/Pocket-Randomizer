/**
 * A serialized RunLog must replay to the identical end state.
 *
 * The log stores a seed and a decision sequence and nothing derived. This test
 * is what makes that a guarantee rather than an intention: if anything ever
 * enters the battle that is not a function of (seed, decisions) — an unseeded
 * roll, a Date.now(), a Map iteration order — the reconstructed protocol stops
 * matching and this fails.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { ENGINE_VERSION, replayRunLog, runBattle, stripNondeterministic } from '../src/core/battle/driver';
import type { RunLog } from '../src/core/types';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../src/data/mons';

const TEAMS = { p1: PLAYER_TEAM, p2: OPPONENT_TEAM };

describe('run log replay', () => {
  it('reconstructs the battle exactly from seed plus decisions', async () => {
    const original = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, 'REPLAY-1', greedyAiPolicy, greedyAiPolicy);

    // Round-trip through JSON: the log has to survive localStorage.
    const serialized = JSON.stringify(original.runLog);
    const restored = replayRunLog(JSON.parse(serialized) as RunLog, TEAMS);

    expect(stripNondeterministic(restored.protocolFor('p1'))).toEqual(stripNondeterministic(original.protocol));
    expect(restored.result).toEqual(original.result);
    expect(restored.turn).toBe(original.result.turns);
  });

  it('records only the seed and the decisions', async () => {
    const { runLog } = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, 'REPLAY-2', greedyAiPolicy, greedyAiPolicy);

    expect(Object.keys(runLog).sort()).toEqual(['decisions', 'seed', 'version']);
    expect(runLog.seed).toBe('REPLAY-2');
    expect(runLog.version).toBe(ENGINE_VERSION);
    for (const decision of runLog.decisions) {
      expect(Object.keys(decision).sort()).toEqual(['choice', 'side', 'turn']);
      expect(decision.choice.kind).toBe('move');
    }
  });

  it('replays a human-style log of raw move slots', async () => {
    const original = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, 'REPLAY-3', greedyAiPolicy, greedyAiPolicy);
    const replayed = replayRunLog(original.runLog, TEAMS);
    const again = replayRunLog(replayed.toRunLog(), TEAMS);

    expect(stripNondeterministic(again.protocolFor('p1'))).toEqual(stripNondeterministic(original.protocol));
  });

  it('refuses a log recorded against a different engine version', () => {
    const stale: RunLog = { seed: 'REPLAY-4', version: 'gymrun-0.0.0-old', decisions: [] };
    expect(() => replayRunLog(stale, TEAMS)).toThrow(/recorded on/);
  });
});
