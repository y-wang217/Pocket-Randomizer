/**
 * A run must be reconstructible from its seed and its decisions, and from
 * nothing else.
 *
 * This is the Stage 0 replay property widened from one battle to a whole run,
 * and it is the test that keeps `RunLog` honest. The moment anything that is
 * not a function of (seed, decisions) enters a run — an unseeded roll, a saved
 * HP value trusted instead of recomputed, a Map iteration order — the resumed
 * run stops matching the original and this fails.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { RANDOMIZER_VERSION } from '../src/core/randomizer';
import { firstUsableMovePolicy } from '../src/core/battle/policy';
import {
  RUN_LOG_VERSION,
  assertReplayable,
  isReplayable,
  playRun,
  replayRun,
  replayRunPolicy,
  resumeRun,
  scriptedRunPolicy,
  type RunPolicy,
  type RunResult,
  type RunState,
} from '../src/core/run';
import type { RunLog } from '../src/core/types';

/**
 * A policy that varies its answers but keeps no state of its own.
 *
 * Statelessness is the point. A resumed run reconstructs the recorded
 * decisions and then asks the live policy for the rest, so "resuming with the
 * same policy reproduces the run" is only a meaningful assertion if the policy
 * is a function of what it is shown. A call counter would restart at zero on
 * resume and answer differently from that point on — which is a fact about the
 * test, not about the run, and would make this file assert nothing.
 */
function wobbling(): RunPolicy {
  return {
    chooseStarter: async () => 1,
    chooseNode: async (options) => options.length - 1,
    // Last card, for the same reason as the last node: a policy that always
    // answers 0 would agree with the scripted default and prove nothing.
    chooseReward: async (offer) => offer.options.length - 1,
    // Buys the whole shelf when it can, so a replay has a non-trivial basket
    // to reproduce rather than an empty one.
    chooseShopPurchases: async (stock, state) => {
      const affordable: number[] = [];
      let left = state.currency;
      for (const [index, item] of stock.items.entries()) {
        if (item.price <= left) {
          affordable.push(index);
          left -= item.price;
        }
      }
      return affordable;
    },
    chooseEventOption: async (event) => event.choices.length - 1,
    battle: async (view) => {
      const moves = view.moves.filter((move) => move.usable);
      const pick = moves[view.turn % Math.max(1, moves.length)];
      return pick ? { kind: 'move', slot: pick.slot } : firstUsableMovePolicy(view);
    },
  };
}

/** Everything about a finished run that a replay has to reproduce. */
function fingerprint(result: RunResult): unknown {
  return {
    outcome: result.outcome,
    log: result.log,
    party: result.state.party,
    position: result.state.position,
    segment: result.state.currentSegment,
    history: result.state.history.map((visit) => [visit.node.id, visit.hpAfter, visit.result]),
  };
}

describe('run log', () => {
  it('records only the seed, the version and the decisions', async () => {
    const run = await playRun('LOG-SHAPE', scriptedRunPolicy(greedyAiPolicy));

    expect(Object.keys(run.log).sort()).toEqual(['decisions', 'randomizerVersion', 'seed', 'version']);
    expect(run.log.seed).toBe('LOG-SHAPE');
    expect(run.log.version).toBe(RUN_LOG_VERSION);
    // No turn numbers, no sides, no HP: all derived, none stored.
    for (const decision of run.log.decisions) {
      const keys = Object.keys(decision).sort();
      expect(keys === undefined).toBe(false);
      expect(keys.length).toBeLessThanOrEqual(2);
    }
  });

  it('holds the whole decision sequence, not just the battles', async () => {
    const run = await playRun('LOG-SEQ', scriptedRunPolicy(greedyAiPolicy));
    const kinds = run.log.decisions.map((decision) => decision.kind);

    expect(kinds[0]).toBe('starter');
    expect(kinds).toContain('node');
    expect(kinds).toContain('battle');
    // Exactly one starter decision, and it is first.
    expect(kinds.filter((kind) => kind === 'starter')).toHaveLength(1);
  });

  it('rejects a log from a different build rather than replaying it wrongly', () => {
    const stale: RunLog = { seed: 'LOG-OLD', version: 'gymrun-0.1.0', randomizerVersion: RANDOMIZER_VERSION, decisions: [] };

    expect(isReplayable(stale)).toBe(false);
    expect(() => assertReplayable(stale)).toThrow(/recorded on gymrun-0\.1\.0/);
    expect(() => replayRunPolicy(stale)).toThrow(/recorded on/);
  });

  it('refuses a log whose decisions do not match what the run asks for', () => {
    const scrambled: RunLog = {
      seed: 'LOG-SCRAMBLED',
      version: RUN_LOG_VERSION,
      randomizerVersion: RANDOMIZER_VERSION,
      decisions: [{ kind: 'node', index: 0 }],
    };
    // The run wants a starter first. A log that offers a node instead is
    // corrupt, and guessing would produce a run the player never played.
    return expect(replayRun(scrambled)).rejects.toThrow(/out of step/);
  });
});

describe('replay', () => {
  it('reconstructs a whole run from seed plus decisions', async () => {
    const original = await playRun('REPLAY-RUN', wobbling());
    const replayed = await replayRun(JSON.parse(JSON.stringify(original.log)) as RunLog);

    expect(fingerprint(replayed)).toEqual(fingerprint(original));
  });

  it('survives a round trip through JSON, because that is what storage is', async () => {
    const original = await playRun('REPLAY-JSON', scriptedRunPolicy(greedyAiPolicy));
    const stored = JSON.stringify(original.log);
    const replayed = await replayRun(JSON.parse(stored) as RunLog);

    expect(JSON.stringify(replayed.log)).toBe(stored);
    expect(replayed.outcome).toBe(original.outcome);
  });
});

describe('save mid-run, reload, continue', () => {
  it('reaches an identical state whether played straight through or resumed', async () => {
    // Play once, keeping every intermediate save the UI would have written.
    const saves: RunLog[] = [];
    const original = await playRun('RESUME-1', wobbling(), undefined, {
      onDecision: (log) => saves.push(JSON.parse(JSON.stringify(log)) as RunLog),
    });

    expect(saves.length).toBe(original.log.decisions.length);

    // Reload from a save partway through and carry on with the same policy.
    const midpoint = saves[Math.floor(saves.length / 2)];
    expect(midpoint).toBeDefined();
    const resumed = await resumeRun(midpoint!, wobbling());

    expect(fingerprint(resumed)).toEqual(fingerprint(original));
  });

  it('resumes from every point in the run, not just a convenient one', async () => {
    const saves: RunLog[] = [];
    const original = await playRun('RESUME-EVERY', wobbling(), undefined, {
      onDecision: (log) => saves.push(JSON.parse(JSON.stringify(log)) as RunLog),
    });

    // Every save point, and there are now hundreds of them: eight segments of
    // decisions, each replayed from the beginning. Quadratic and deliberately
    // so — this is the test that would catch a resume that only works at node
    // boundaries — but it needs a timeout that reflects the run length rather
    // than the default five seconds sized for Stage 1's single segment.
    for (const save of saves) {
      const resumed = await resumeRun(save, wobbling());
      expect(fingerprint(resumed), `resuming after ${save.decisions.length} decisions`).toEqual(
        fingerprint(original),
      );
    }
  }, 120_000);

  it('hands control over at exactly the point the log ends', async () => {
    const saves: RunLog[] = [];
    await playRun('RESUME-HANDOVER', wobbling(), undefined, {
      onDecision: (log) => saves.push(JSON.parse(JSON.stringify(log)) as RunLog),
    });

    const midpoint = saves[2];
    expect(midpoint).toBeDefined();
    let liveCalls = 0;
    const live: RunPolicy = {
      chooseStarter: async () => {
        liveCalls++;
        return 0;
      },
      chooseNode: async () => {
        liveCalls++;
        return 0;
      },
      chooseReward: async () => {
        liveCalls++;
        return 0;
      },
      chooseShopPurchases: async () => {
        liveCalls++;
        return [];
      },
      chooseEventOption: async () => {
        liveCalls++;
        return 0;
      },
      battle: async (view) => {
        liveCalls++;
        return firstUsableMovePolicy(view);
      },
    };

    const policy = replayRunPolicy(midpoint!, live);
    expect(policy.remaining()).toBe(midpoint!.decisions.length);
    await playRun(midpoint!.seed, policy, undefined, {});

    // The live policy answered everything after the log, and nothing before it.
    expect(policy.remaining()).toBe(0);
    expect(liveCalls).toBeGreaterThan(0);
  });

  it('never serializes derived state, so a resumed party is recomputed not restored', async () => {
    const saves: RunLog[] = [];
    await playRun('RESUME-DERIVED', wobbling(), undefined, {
      onDecision: (log) => saves.push(log),
    });

    for (const save of saves) {
      const serialized = JSON.stringify(save);
      // The three things a save is allowed to contain. Anything about HP, PP,
      // party, map or nodes in here means derived state leaked into the log.
      expect(serialized).not.toMatch(/"hp"|"party"|"maxHp"|"segments"|"encounter"|"turn"/);
    }
  });
});

describe('resumed runs and live state', () => {
  it('reports the same state to a UI on resume as it did the first time', async () => {
    const seen: RunState[] = [];
    const original = await playRun('RESUME-STATE', wobbling(), undefined, {
      onState: (state) => seen.push(state),
    });

    const resumedSeen: RunState[] = [];
    await replayRun(original.log, undefined, { onState: (state) => resumedSeen.push(state) });

    expect(resumedSeen.map((s) => [s.position, s.currentSegment, s.outcome, s.party[0]?.hp])).toEqual(
      seen.map((s) => [s.position, s.currentSegment, s.outcome, s.party[0]?.hp]),
    );
  });
});
