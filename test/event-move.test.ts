/**
 * A move an event pays reaches a Pokemon's moveset.
 *
 * **The defect this file was written for, in the reporter's words: "I picked
 * minus hp for T2 ... didnt get the reward move."** A `T2` outcome grants a
 * move at the segment's band and a `T3` one at band plus one, both resolved to
 * a concrete move name when the map is built. `applyEffect` returned the run
 * untouched for a `move`, and its comment said the questions belonged to
 * `playRun` — which was the right design and was never built. So the move was
 * drawn, named on the reveal, and dropped.
 *
 * It is the third instance in this repo of one shape: an effect that folds
 * correctly at one end, is announced at the other, and is joined by nothing in
 * between. The other two are recorded in `docs/generation.md` section 14.
 *
 * ## Where these assertions sit, and why
 *
 * Two seams, because the defect could live at either and a test at one cannot
 * see the other.
 *
 * - `resolveNode`, for the fold: given the answers, does the move land on the
 *   member the answers name? That is where `applyReward` is called.
 * - `playRun`, for the questions: does a run that walks into a question mark
 *   paying a move record a `target` for it, and does that log replay? A fold
 *   that works and a question nobody asks produce exactly the bug above.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { createPartyMember } from '../src/core/party';
import { RANDOMIZER_VERSION } from '../src/core/randomizer';
import {
  createRun,
  playRun,
  replayRun,
  resolveNode,
  RUN_LOG_VERSION,
  scriptedRunPolicy,
  type NodeResult,
  type RunPolicy,
  type RunState,
} from '../src/core/run';
import { grantedMove, type EventInstance, type EventOption, type EventOutcome } from '../src/core/events';
import type { EventArchetype } from '../src/data/eventPools';
import type { RunDecision } from '../src/core/types';
import { DEFAULT_TUNING } from '../src/data/tuning';

const SEEDS = ['S49R-1', 'S49R-3', 'S49R-9'];

function movePaid(move: string): EventOutcome {
  return { tier: 'T2', entryId: 't2-move', cost: [], grant: [{ kind: 'move', move }] };
}

function option(archetype: EventArchetype, paid: EventOutcome): EventOption {
  return {
    archetype,
    label: archetype,
    hint: archetype,
    toll: null,
    outcomes: { T0: paid, T1: paid, T2: paid, T3: paid },
    tierAt: { none: 'T2', latent: 'T2', known: 'T2' },
  };
}

function eventWith(paid: EventOutcome): EventInstance {
  return {
    nodeId: 'n1',
    eventId: 'test',
    locale: 'forest',
    rarity: 'common',
    prompt: 'p',
    requires: 'cut',
    options: [option('safe', paid)],
  };
}

/** Two members: one with a free move slot, one with four moves already. */
function runWithParty(): RunState {
  const base = createRun('EVENT-MOVE', DEFAULT_TUNING);
  return {
    ...base,
    relics: [],
    party: [
      createPartyMember({ species: 'Snorlax', ability: 'Immunity', moves: ['Tackle'], level: 30 }),
      createPartyMember({
        species: 'Pidgeot',
        ability: 'Keen Eye',
        moves: ['Tackle', 'Gust', 'Quick Attack', 'Sand Attack'],
        level: 30,
      }),
    ],
  };
}

function resolveWith(state: RunState, paid: EventOutcome, answers: Partial<NodeResult>): RunState {
  const node = { ...state.segments[0]!.gym, kind: 'event' as const, encounter: null, event: eventWith(paid) };
  const result: NodeResult = { node, eventChoice: 'safe', ...answers };
  return resolveNode(state, result);
}

describe('the move an event pays', () => {
  it('lands in a free slot on the member the answer names', () => {
    const after = resolveWith(runWithParty(), movePaid('Earthquake'), {
      eventMove: { kind: 'tm', move: 'Earthquake' },
      eventMoveTarget: 0,
    });

    expect(after.party[0]?.spec.moves).toEqual(['Tackle', 'Earthquake']);
    // And nowhere else. A move taught to the whole party would be a fold that
    // ignored the target, which reads as working on a party of one.
    expect(after.party[1]?.spec.moves).not.toContain('Earthquake');
  });

  it('displaces the slot the answer names when the recipient is full', () => {
    const after = resolveWith(runWithParty(), movePaid('Earthquake'), {
      eventMove: { kind: 'tm', move: 'Earthquake' },
      eventMoveTarget: 1,
      eventMoveReplaceSlot: 2,
    });

    expect(after.party[1]?.spec.moves).toEqual(['Tackle', 'Gust', 'Earthquake', 'Sand Attack']);
  });

  it('is read off the outcome by one function, so the question and the fold agree', () => {
    expect(grantedMove(movePaid('Earthquake'))).toBe('Earthquake');
    expect(grantedMove({ tier: 'T1', entryId: 't1-purse', cost: [], grant: [{ kind: 'currency', amount: 40 }] })).toBeNull();
  });
});

describe('the version axes this patch moved', () => {
  it('bumped the run log, because an event asks a question in a new place', () => {
    // A literal, like every other assertion on this axis: the point of the
    // axis is that a human chose the number, so a computed check could not
    // catch a bump that failed to happen.
    expect(Number(/^gymrun-run-(\d+)\//.exec(RUN_LOG_VERSION)?.[1])).toBeGreaterThanOrEqual(15);
  });

  it('bumped the randomizer, because a relic grant now draws an order', () => {
    expect(RANDOMIZER_VERSION).toBe('gymrun-randomizer-17');
  });
});

/**
 * The `playRun` half. Slow, because it plays real battles, and worth it: the
 * question being asked at all is the half a seam test cannot see.
 */
describe('a played run that walks into a paying question mark', () => {
  /** Always the priced option, which buys a guaranteed `T2`. */
  function tollPolicy(): RunPolicy {
    return { ...scriptedRunPolicy(greedyAiPolicy), chooseEventOption: async () => 'toll' };
  }

  it('records a target for the move, and replays to the same movesets', async () => {
    let paying = 0;

    for (const seed of SEEDS) {
      const decisions: RunDecision[] = [];
      const live = await playRun(seed, tollPolicy(), DEFAULT_TUNING, {
        onDecision: (log) => {
          decisions.length = 0;
          decisions.push(...log.decisions);
        },
      });

      /*
       * **An `event` entry immediately followed by a `target` entry** is the
       * signature of the question this patch added, and counting it is what
       * stops the file passing vacuously: before the fix there was no place in
       * the log where those two could be adjacent.
       *
       * A `T2` is one of four pool entries, so not every question mark pays a
       * move — hence a count across seeds rather than a per-seed assertion.
       */
      paying += decisions.filter(
        (decision, at) => decision.kind === 'event' && decisions[at + 1]?.kind === 'target',
      ).length;

      const again = await replayRun(live.log, DEFAULT_TUNING);
      expect(again.state.party.map((member) => member.spec.moves)).toEqual(
        live.state.party.map((member) => member.spec.moves),
      );
      expect(again.state.relics).toEqual(live.state.relics);
      expect(again.state.backpack).toEqual(live.state.backpack);
    }

    expect(paying, 'no seed was paid a move by an event, so nothing was tested').toBeGreaterThan(0);
  }, 300_000);

  it('puts the relic an event pays onto the run', async () => {
    /*
     * The other half of the same report. A `T2` relic was `return state` and a
     * `T3` paid its item and swallowed its relic, so a run could take the
     * priced option at every question mark and finish holding nothing.
     *
     * Asserted across seeds for the reason above: which of the four `T2`
     * entries a node drew is a property of the seed.
     */
    let held = 0;
    for (const seed of SEEDS) {
      const live = await playRun(seed, tollPolicy(), DEFAULT_TUNING);
      held += live.state.relics.length;
      // No relic twice, whatever route put it there.
      expect(new Set(live.state.relics).size).toBe(live.state.relics.length);
    }
    expect(held, 'no seed finished holding a relic').toBeGreaterThan(0);
  }, 300_000);
});
