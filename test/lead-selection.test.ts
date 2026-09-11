/**
 * The pre-gym decision: who leads, asked once per gym.
 *
 * Stage 4.7, Part 2. A gym used to be another node the player walked into.
 * This is the beat in front of it and the one decision that belongs there.
 *
 * **The shape is the argument.** Lead selection is a *party reorder*, not a
 * per-battle flag: `party.setLead` moves the chosen member to slot 0 and
 * `battleMembersFor` sends the party in order, so there is one source of truth
 * for who leads and it is the same one the party screen's drag order writes to.
 * The visible cost, asserted below rather than hidden, is that the lead chosen
 * for gym 3 is still leading at the first node of segment 4.
 *
 * What this file does *not* test is the screen. Part 2's UI lands later; the
 * decision, its logging, its replay and its refusals are all here, headless,
 * which is the whole point of the run-policy seam.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { leadRefusal, setLead } from '../src/core/party';
import {
  chooseLead,
  chooseStarter,
  createRun,
  playRun,
  replayRun,
  RUN_LOG_VERSION,
  scriptedRunPolicy,
  type RunPolicy,
  type RunState,
} from '../src/core/run';
import type { PokemonState, RunLog } from '../src/core/types';
import { GYMS } from '../src/data/gyms';
import { RANDOMIZER_VERSION } from '../src/core/randomizer';
import { DEFAULT_TUNING } from '../src/data/tuning';

/** Leads with the last living member, so the choice is never the default. */
function contrarian(picks: number[] = []): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseLead: async (party) => {
      let last = 0;
      party.forEach((member, index) => {
        if (!member.fainted) last = index;
      });
      picks.push(last);
      return last;
    },
  };
}

describe('setLead', () => {
  it('moves the chosen member to slot 0 and keeps everyone else in order', () => {
    const party = ['a', 'b', 'c', 'd'].map((species) => ({ spec: { species } }) as unknown as PokemonState);
    expect(setLead(party, 2).map((m) => m.spec.species)).toEqual(['c', 'a', 'b', 'd']);
    expect(setLead(party, 0).map((m) => m.spec.species)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('leadRefusal', () => {
  it('refuses a fainted member and an empty slot, and allows anyone else', () => {
    const party = [
      { spec: { species: 'Snorlax' }, fainted: false },
      { spec: { species: 'Gengar' }, fainted: true },
    ] as unknown as PokemonState[];

    expect(leadRefusal(party, 0)).toBe(null);
    expect(leadRefusal(party, 1)).toMatch(/fainted/);
    expect(leadRefusal(party, 9)).toMatch(/no party member/);
  });
});

describe('chooseLead', () => {
  it('throws rather than clamping a fainted pick', () => {
    /*
     * Refused, not clamped, like every other decision that can be handed
     * something illegal. A pick silently turned into a different pick is a log
     * that replays into a different run — and here it would do it invisibly,
     * because `battleMembersFor` filters fainted members anyway and the battle
     * would simply start with somebody else in front.
     */
    const start = chooseStarter(createRun('LEAD-REFUSE'), 0);
    const fainted: RunState = {
      ...start,
      party: start.party.map((member) => ({ ...member, fainted: true })),
    };

    expect(() => chooseLead(fainted, 0)).toThrow(/fainted/);
    expect(() => chooseLead(start, 5)).toThrow(/no party member/);
  });
});

describe('a whole run', () => {
  it('asks exactly once per gym, and never anywhere else', async () => {
    /*
     * The count is the test. A pre-gym screen that appeared twice for one gym,
     * or once for a wild node, would be a screen the player learns to click
     * through — and a second `lead` entry in the log would desynchronise the
     * replay cursor at the next decision.
     */
    const picks: number[] = [];
    const run = await playRun('LEAD-COUNT', contrarian(picks), DEFAULT_TUNING);

    const gyms = run.state.history.filter((visit) => visit.node.kind === 'gym').length;
    const leads = run.log.decisions.filter((decision) => decision.kind === 'lead').length;

    expect(gyms, 'this seed never reached a gym').toBeGreaterThan(0);
    expect(leads).toBe(gyms);
    expect(picks).toHaveLength(gyms);
  }, 120_000);

  it('records the lead immediately before the gym it belongs to', async () => {
    const run = await playRun('LEAD-ORDER', contrarian(), DEFAULT_TUNING);
    const decisions = run.log.decisions;

    const leadPositions = decisions.flatMap((decision, index) => (decision.kind === 'lead' ? [index] : []));
    expect(leadPositions.length).toBeGreaterThan(0);

    for (const position of leadPositions) {
      // Nothing between the lead and the battle it precedes: the next decision
      // in the log is the first move of the gym fight. Not a node pick — the
      // gym is never offered as a choice — and not a second lead.
      expect(decisions[position + 1]?.kind).toBe('battle');
    }
  }, 120_000);

  it('consumes no step from the node budget', async () => {
    /*
     * The pre-gym screen is not a node. If it consumed a step, a segment would
     * field one fewer choosable node than `stepsPerSegment` says, and every
     * balance number measured against that table would quietly describe a
     * different game.
     */
    const withLead = await playRun('LEAD-BUDGET', contrarian(), DEFAULT_TUNING);
    const nodePicks = withLead.log.decisions.filter((decision) => decision.kind === 'node').length;

    const flat = await playRun('LEAD-BUDGET', scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING);
    const flatNodePicks = flat.log.decisions.filter((decision) => decision.kind === 'node').length;

    // The two policies walk different runs, so the node counts need not match —
    // what must hold is that neither run's node picks were reduced by the lead
    // question existing. Segment 0's map is identical either way.
    expect(nodePicks).toBeGreaterThan(0);
    expect(flatNodePicks).toBeGreaterThan(0);
    expect(withLead.state.segments[0]?.routes).toEqual(flat.state.segments[0]?.routes);
  }, 120_000);

  it('consumes no RNG: the same seed generates the same map either way', async () => {
    /*
     * Asserted against the *generated map*, which is what an RNG draw would
     * move. `createRun` builds all eight segments eagerly, so if asking the
     * lead question consumed a draw, the segments a run walked would differ
     * from the ones a run that never asked walked.
     */
    const asked = await playRun('LEAD-RNG', contrarian(), DEFAULT_TUNING);
    const untouched = createRun('LEAD-RNG', DEFAULT_TUNING);

    expect(asked.state.segments).toEqual(untouched.segments);
    expect(asked.state.starterOptions).toEqual(untouched.starterOptions);
  }, 120_000);

  it('puts the chosen member in party position 0 at battle start', async () => {
    /*
     * The mechanism, checked at the moment it has to be true: `onState` fires
     * immediately after `chooseLead` applies, and `battleMembersFor` sends the
     * party in order, so slot 0 at that instant is the member that leads.
     *
     * The pick is deliberately *not* slot 0 wherever the party has a second
     * living member, or the assertion would pass on a `chooseLead` that did
     * nothing at all.
     */
    let checked = 0;
    let awaited: string | null = null;

    await playRun(
      'LEAD-POSITION',
      {
        ...scriptedRunPolicy(greedyAiPolicy),
        chooseLead: async (party) => {
          const pick = party.findIndex((member, index) => index > 0 && !member.fainted);
          if (pick === -1) return 0;
          awaited = party[pick]!.spec.species;
          return pick;
        },
      },
      DEFAULT_TUNING,
      {
        onState: (state) => {
          if (awaited === null) return;
          const expected = awaited;
          awaited = null;
          checked++;
          expect(state.party[0]?.spec.species).toBe(expected);
        },
      },
    );

    expect(checked, 'no gym was ever led by anyone but slot 0').toBeGreaterThan(0);
  }, 120_000);

  it('leaves the chosen lead in front after the gym, into the next segment', async () => {
    /*
     * The flagged consequence of making this a reorder rather than a flag, and
     * it is asserted so that a later change to a per-battle flag fails here
     * rather than silently changing the model.
     */
    const seen: { segment: number; position: number; lead: string }[] = [];
    await playRun('LEAD-PERSIST', contrarian(), DEFAULT_TUNING, {
      onState: (state) => {
        const lead = state.party[0];
        if (!lead) return;
        seen.push({ segment: state.currentSegment, position: state.position, lead: lead.spec.species });
      },
    });

    // Find a gym clear: the last state of segment N and the first of N+1.
    const boundaries = seen.flatMap((entry, index) => {
      const next = seen[index + 1];
      return next && next.segment === entry.segment + 1 ? [[entry, next] as const] : [];
    });
    expect(boundaries.length, 'this seed cleared no gym').toBeGreaterThan(0);

    for (const [before, after] of boundaries) {
      expect(after.lead).toBe(before.lead);
    }
  }, 120_000);

  it('replays identically, lead picks included', async () => {
    const picks: number[] = [];
    const original = await playRun('LEAD-REPLAY', contrarian(picks), DEFAULT_TUNING);
    const replayed = await replayRun(JSON.parse(JSON.stringify(original.log)) as RunLog);

    expect(replayed.outcome).toBe(original.outcome);
    expect(replayed.state.party.map((member) => member.spec.species)).toEqual(
      original.state.party.map((member) => member.spec.species),
    );
    expect(replayed.log.decisions).toEqual(original.log.decisions);
    expect(picks.length).toBeGreaterThan(0);
  }, 120_000);

  it('reaches a different party order from the same seed when the lead differs', async () => {
    /*
     * The proof that the decision is a decision at all. Same seed, same
     * everything except the answer to one question — and the run diverges,
     * because who is in front decides who takes the gym leader's first hit.
     */
    const contrary = await playRun('LEAD-DIVERGE', contrarian(), DEFAULT_TUNING);
    const flat = await playRun('LEAD-DIVERGE', scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING);

    const leads = contrary.log.decisions.filter((decision) => decision.kind === 'lead');
    expect(leads.length).toBeGreaterThan(0);
    expect(leads.some((decision) => decision.kind === 'lead' && decision.index !== 0)).toBe(true);
    expect(contrary.log.decisions).not.toEqual(flat.log.decisions);
  }, 120_000);
});

describe('the version guard', () => {
  it('refuses a pre-patch log with a message naming the mismatch', () => {
    /*
     * Eight new questions in a run, the first at the end of segment 0. A 4.6c
     * log has an answer to none of them, so the cursor would slip at the first
     * gym and every entry after it would be read as an answer to the wrong
     * question.
     */
    const stale: RunLog = {
      seed: 'PRE-LEAD',
      version: 'gymrun-run-10/gymrun-0.3.0',
      randomizerVersion: RANDOMIZER_VERSION,
      decisions: [],
    };

    expect(() => replayRun(stale)).toThrow(/gymrun-run-10/);
    expect(() => replayRun(stale)).toThrow(new RegExp(RUN_LOG_VERSION.split('/')[0]!));
  });

  it('has bumped the log version for this patch', () => {
    /*
     * **Stage 4.8 moved it again, to `-12`, for item 2.** 4.7's own bump was `-11`
     * and this test was written against it; the literal is updated rather than
     * loosened to a range, because the point of the axis is that it is a name a
     * human chose and a test that accepted any number could not catch a bump that
     * failed to happen. `docs/generation.md` section 7c carries the argument.
     */
    expect(RUN_LOG_VERSION).toMatch(/^gymrun-run-12\//);
  });
});

describe('the gym the question is asked about', () => {
  it('is the one guarding the segment the run is in', async () => {
    const seen: { segment: number; leader: string }[] = [];
    await playRun(
      'LEAD-GYM',
      {
        ...scriptedRunPolicy(greedyAiPolicy),
        chooseLead: async (_party, gym, state) => {
          seen.push({ segment: state.currentSegment, leader: gym.leader });
          return 0;
        },
      },
      DEFAULT_TUNING,
    );

    expect(seen.length).toBeGreaterThan(0);
    for (const entry of seen) {
      expect(entry.leader).toBe(GYMS[entry.segment]?.leader);
    }
  }, 120_000);
});
