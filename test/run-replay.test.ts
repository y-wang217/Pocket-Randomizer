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
  defaultItemPlan,
  defaultMoveReplacement,
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
    chooseLocale: async () => 0,
    chooseLead: async () => 0,
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
    // The last member, for the same reason as the last card: a policy that
    // always answered 0 would agree with the scripted default and prove
    // nothing about whether the target is really replayed.
    chooseMoveRecipient: async (_offer, party) => party.length - 1,
    chooseMoveToReplace: async (member, incoming) => defaultMoveReplacement(member, incoming),
    // Takes everything, releasing the lead once full. The most destructive
    // legal answer, so a replay that reproduces it has reproduced the party
    // churning rather than a party that only ever grew.
    chooseAcquisition: async (_offer, party, capacity) =>
      // Stage 4.8: live capacity, handed in by `playRun`.
      party.length < capacity ? { kind: 'accept' } : { kind: 'release', slot: 0 },
    chooseItemPlan: async (state) => defaultItemPlan(state),
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
    // Stage 4.5.1: the backpack is run state, so it belongs in the fingerprint.
    // A resume that reconstructed the party but not the bag would pass every
    // assertion above while quietly handing the player different items.
    backpack: result.state.backpack,
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

  /**
   * **The 4.5.2 guard, named against the version it has to refuse.**
   *
   * A real pre-patch log, not a synthetic one: `gymrun-run-7` was the shipped
   * version through Stage 4.5.1, and `gymrun-randomizer-5` the shipped
   * randomizer. Both moved for the gym clear offer, and each half refuses for a
   * different reason the message has to distinguish — the run half says the
   * *questions* changed (a cleared gym now asks a `reward`), the randomizer half
   * says the *answers would mean something else* (pass 6 appends a draw to the
   * rewards stream, so every offer after the first gym is a different card).
   *
   * Written as the literal old strings rather than as "the previous value",
   * because the point is to catch a future edit that bumps one guard and
   * forgets the other.
   */
  it('refuses a Stage 4.5.1 log on both halves of the guard', () => {
    const preGymRewards: RunLog = {
      seed: 'LOG-451',
      version: 'gymrun-run-7/gymrun-0.3.0',
      randomizerVersion: 'gymrun-randomizer-5',
      decisions: [],
    };

    expect(isReplayable(preGymRewards)).toBe(false);
    // The message names the mismatch, and names both sides of it.
    expect(() => assertReplayable(preGymRewards)).toThrow(/gymrun-run-7/);
    expect(() => assertReplayable(preGymRewards)).toThrow(new RegExp(RUN_LOG_VERSION.replace('/', '\\/')));

    // And the randomizer half refuses on its own, with the run half current.
    const staleRandomizer: RunLog = {
      seed: 'LOG-451',
      version: RUN_LOG_VERSION,
      randomizerVersion: 'gymrun-randomizer-5',
      decisions: [],
    };
    expect(isReplayable(staleRandomizer)).toBe(false);
    expect(() => assertReplayable(staleRandomizer)).toThrow(/gymrun-randomizer-5/);
    expect(() => assertReplayable(staleRandomizer)).toThrow(new RegExp(RANDOMIZER_VERSION));
  });

  it('has actually bumped both versions for this stage', () => {
    // The guard above only works if the constants moved. A patch that added
    // pass 6 and left these alone would replay a 4.5.1 log silently and wrongly,
    // which is the exact failure the versions exist to prevent.
    expect(RUN_LOG_VERSION).not.toContain('gymrun-run-7/');
    expect(RANDOMIZER_VERSION).not.toBe('gymrun-randomizer-5');
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
      chooseLocale: async () => {
        liveCalls++;
        return 0;
      },
      chooseLead: async () => {
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
      chooseMoveRecipient: async () => {
        liveCalls++;
        return 0;
      },
      chooseMoveToReplace: async (member, incoming) => {
        liveCalls++;
        return defaultMoveReplacement(member, incoming);
      },
      chooseAcquisition: async () => {
        liveCalls++;
        return { kind: 'decline' as const };
      },
      chooseItemPlan: async (state) => {
        liveCalls++;
        return defaultItemPlan(state);
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

  it('rebuilds contribution counters exactly, including from a mid-battle save', async () => {
    /*
     * **Stage 4.7, Part 5's determinism assertion, and it is the reason the
     * counters are derived rather than logged.**
     *
     * `fingerprint` already carries the whole party, so every resume test in
     * this file compares counters as a side effect. This one is separate
     * because it asserts the thing on purpose and says why: a counter is a
     * function of a battle protocol, a protocol is a function of the seed and
     * the decisions, so a rebuilt counter that disagrees with a saved one means
     * the *battle* diverged. A mismatch here is a determinism bug wearing a
     * stats feature as a disguise, and it would otherwise surface as a slightly
     * wrong number on a summary screen that nobody would think to distrust.
     *
     * The saves taken *during* a battle are the interesting ones — a save after
     * every `battle` decision is a save mid-fight, with a protocol half
     * written — because a reducer that only agreed at node boundaries would
     * pass every other test in this file.
     */
    const saves: RunLog[] = [];
    const original = await playRun('RESUME-CONTRIB', wobbling(), undefined, {
      onDecision: (log) => saves.push(JSON.parse(JSON.stringify(log)) as RunLog),
    });

    const counters = (result: RunResult): unknown =>
      result.state.party.map((member) => [member.spec.species, member.contribution]);

    // The run has to have done something, or this asserts that zero is zero.
    const totals = original.state.party.map((member) => member.contribution);
    expect(totals.some((counter) => counter.damageDealt > 0)).toBe(true);
    expect(totals.some((counter) => counter.turnsOnField > 0)).toBe(true);

    const midBattle = saves.filter((save) => save.decisions.at(-1)?.kind === 'battle');
    expect(midBattle.length, 'this seed never fought').toBeGreaterThan(0);

    for (const save of [midBattle[0]!, midBattle[Math.floor(midBattle.length / 2)]!, midBattle.at(-1)!]) {
      const resumed = await resumeRun(save, wobbling());
      expect(counters(resumed), `resuming after ${save.decisions.length} decisions`).toEqual(
        counters(original),
      );
    }
  }, 120_000);

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
      // Stage 4.7: contribution counters are derived too, and a log that
      // carried them would be a log that could disagree with the battle.
      expect(serialized).not.toMatch(/"contribution"|"damageDealt"|"kos"|"turnsOnField"/);
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
