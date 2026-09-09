/**
 * Move replacement: two questions, in order, and what each one costs.
 *
 * **The logic change in Stage 4.5.1.** Everything else in the stage is display
 * or tuning; this is the one place where the rules of the game moved. Until
 * now a move reward resolved itself — the game picked the recipient (there was
 * only one at Stage 3, and the lead at Stage 4) and the game picked the
 * displaced move. Both are the player's now.
 *
 * Three properties are worth more than the rest, and each has a section:
 *
 *   1. **The questions are asked in the right order, about the right Pokemon.**
 *      Recipient first, because which four moves are on the table depends
 *      entirely on who is learning.
 *   2. **A question that costs nothing is not asked.** A free move slot and a
 *      move already known both skip the prompt, and they skip it identically in
 *      a live run and in a replay — otherwise the log runs out of step.
 *   3. **Neither decision consumes RNG.** These are player decisions. A seed
 *      whose later rolls depended on who learned Earthquake would make the map
 *      a function of play.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { describeMove } from '../src/core/battle/driver';
import { createPartyMember, replacementNeeded, teachMove } from '../src/core/party';
import { applyReward, recipientFor } from '../src/core/rewards';
import {
  chooseStarter,
  createRun,
  defaultItemPlan,
  defaultMoveReplacement,
  playRun,
  replayRun,
  resumeRun,
  scriptedRunPolicy,
  type RunPolicy,
  type RunState,
} from '../src/core/run';
import type { PokemonSpec, PokemonState, RunLog } from '../src/core/types';
import { PARTY_SIZE } from '../src/data/partyTuning';

const snorlax = (moves: string[]): PokemonState =>
  createPartyMember({ species: 'Snorlax', ability: 'Thick Fat', moves, level: 50 } as PokemonSpec);

const FOUR = ['Body Slam', 'Crunch', 'Earthquake', 'Rest'];

// ---------------------------------------------------------------------------
// When the question exists at all
// ---------------------------------------------------------------------------

describe('replacementNeeded', () => {
  it('says a full moveset must choose', () => {
    expect(replacementNeeded(snorlax(FOUR), 'Arm Thrust')).toBe('choose');
  });

  it('says a free slot chooses nothing', () => {
    expect(replacementNeeded(snorlax(['Body Slam', 'Crunch']), 'Arm Thrust')).toBe('free');
  });

  it('says an already-known move chooses nothing', () => {
    expect(replacementNeeded(snorlax(FOUR), 'Crunch')).toBe('known');
  });

  it('distinguishes free from known rather than collapsing them to a boolean', () => {
    // They do different things downstream: one appends, the other refills PP.
    // A caller that could not tell them apart would refill PP on an empty slot.
    expect(new Set([replacementNeeded(snorlax(['Body Slam']), 'Body Slam')])).toEqual(
      new Set(['known']),
    );
  });
});

// ---------------------------------------------------------------------------
// What teaching does
// ---------------------------------------------------------------------------

describe('teachMove with a chosen slot', () => {
  it('puts the incoming move in the slot and removes the one that was there', () => {
    const after = teachMove(snorlax(FOUR), 'Arm Thrust', 1);
    expect(after.spec.moves).toEqual(['Body Slam', 'Arm Thrust', 'Earthquake', 'Rest']);
  });

  it('leaves the displaced move gone — there is no storage and no relearner', () => {
    const after = teachMove(snorlax(FOUR), 'Arm Thrust', 1);
    expect(after.spec.moves).not.toContain('Crunch');
    expect(after.moves.some((move) => move.name === 'Crunch')).toBe(false);
  });

  it('fills an empty slot without a prompt, and appends rather than reordering', () => {
    const after = teachMove(snorlax(['Body Slam', 'Crunch']), 'Arm Thrust');
    expect(after.spec.moves).toEqual(['Body Slam', 'Crunch', 'Arm Thrust']);
  });

  it('carries PP by move id, so a replaced slot shifts nothing else', () => {
    const member = snorlax(FOUR);
    const spent = { ...member, moves: member.moves.map((move) => ({ ...move, pp: 3 })) };
    const after = teachMove(spent, 'Arm Thrust', 1);

    // Every survivor keeps its 3 PP; the newcomer arrives full.
    for (const name of ['Body Slam', 'Earthquake', 'Rest']) {
      expect(after.moves.find((move) => move.name === name)?.pp, name).toBe(3);
    }
    const arrived = after.moves.find((move) => move.name === 'Arm Thrust')!;
    expect(arrived.pp).toBe(arrived.maxPp);
  });

  it('refills PP for a move already known, and only that move', () => {
    const member = snorlax(FOUR);
    const spent = { ...member, moves: member.moves.map((move) => ({ ...move, pp: 1 })) };
    const after = teachMove(spent, 'Crunch');

    expect(after.spec.moves).toEqual(FOUR);
    const crunch = after.moves.find((move) => move.name === 'Crunch')!;
    expect(crunch.pp).toBe(crunch.maxPp);
    expect(after.moves.find((move) => move.name === 'Rest')?.pp).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The recipient, and the fainted-member trap
// ---------------------------------------------------------------------------

describe('the recipient is resolved once', () => {
  const party = (): PokemonState[] => [
    snorlax(FOUR),
    { ...snorlax(['Tackle']), hp: 0, fainted: true },
    snorlax(['Tackle', 'Growl']),
  ];

  it('redirects a fainted target to the lead, rather than crashing', () => {
    // A member can faint in the fight that paid the card. One roster, because
    // `toBe` is identity and `party()` builds fresh objects on every call.
    const roster = party();
    expect(recipientFor(roster, 1)).toBe(roster[0]);
  });

  it('redirects an out-of-range target to the lead', () => {
    const roster = party();
    expect(recipientFor(roster, 9)).toBe(roster[0]);
  });

  /*
   * The bug the shared resolution exists to prevent.
   *
   * The replacement slot is chosen against a *particular* Pokemon's four moves.
   * If `playRun` asked about the fainted member at slot 1 and `applyReward`
   * quietly redirected the card to the lead, the answer would land on the
   * lead's move list and displace whatever happened to sit at that index — a
   * move the player was never shown, on a Pokemon they did not pick.
   *
   * Both sides go through `recipientFor`, so the member asked about and the
   * member taught are the same object.
   */
  it('asks and applies against the same member when the target has fainted', () => {
    const roster = party();
    const asked = recipientFor(roster, 1)!;
    expect(replacementNeeded(asked, 'Arm Thrust')).toBe('choose');

    const state = { ...startedRun(), party: roster };
    const after = applyReward(state, { kind: 'tm', move: 'Arm Thrust' }, 1, 1);

    // Slot 0 is the lead and is what actually learned it, at the slot chosen.
    expect(after.party[0]!.spec.moves).toEqual(['Body Slam', 'Arm Thrust', 'Earthquake', 'Rest']);
    expect(after.party[2]!.spec.moves).toEqual(['Tackle', 'Growl']);
  });
});

function startedRun(seed = 'MOVE-REPLACE'): RunState {
  return chooseStarter(createRun(seed), 0);
}

// ---------------------------------------------------------------------------
// Logging, order, and replay
// ---------------------------------------------------------------------------

/**
 * A policy that takes every move card it is offered and answers both questions
 * from run state rather than from a call counter.
 *
 * The counter discipline matters here for the same reason it does in
 * `backpack.test.ts` and `run-replay.test.ts`: a policy that counted its own
 * invocations would restart at zero on resume and answer differently from that
 * point on, which would make the resume assertions below meaningless.
 */
function movePicker(): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseReward: async (offer) => {
      const move = offer.options.findIndex((option) => option.kind === 'tm' || option.kind === 'tutor');
      return move === -1 ? 0 : move;
    },
    // The last member rather than the lead, so the recipient is a real answer
    // and not the value a missing implementation would return.
    chooseMoveRecipient: async (_offer, party) => party.length - 1,
    // The last slot rather than the heuristic's, for the same reason.
    chooseMoveToReplace: async (member) => member.spec.moves.length - 1,
    chooseItemPlan: async (state) => defaultItemPlan(state),
  };
}

describe('both decisions are logged, in order', () => {
  it('records the recipient before the replacement, always', async () => {
    const run = await playRun('MOVE-LOG', movePicker());
    const kinds = run.log.decisions.map((decision) => decision.kind);

    const replaces = kinds.flatMap((kind, index) => (kind === 'replace' ? [index] : []));
    expect(replaces.length).toBeGreaterThan(0);
    // Every replacement is immediately preceded by the recipient it belongs to.
    for (const index of replaces) {
      expect(kinds[index - 1], `decision ${index}`).toBe('target');
    }
  }, 60_000);

  it('never records more replacements than recipients', async () => {
    const run = await playRun('MOVE-GATE', movePicker());
    const kinds = run.log.decisions.map((decision) => decision.kind);
    const targets = kinds.filter((kind) => kind === 'target').length;
    const replaces = kinds.filter((kind) => kind === 'replace').length;

    /*
     * At most one replacement per recipient, and often fewer.
     *
     * Not *strictly* fewer, and the reason is worth writing down: every starter
     * and every generated Pokemon rolls a full four moves, so in most runs
     * every move card does need a replacement and the two counts are equal. The
     * gate still fires — a member that already knows the move skips it — but it
     * fires rarely enough that asserting on it from a seed would be asserting
     * on that seed. The scenario below tests the gate directly instead.
     */
    expect(replaces).toBeGreaterThan(0);
    expect(replaces).toBeLessThanOrEqual(targets);
  }, 60_000);

  it('asks no replacement when the recipient has a free slot', async () => {
    // The gate, tested against a party built for it rather than hunted for in a
    // seed. A two-move member is offered a move and must not be asked.
    const state = { ...startedRun('MOVE-FREE'), party: [snorlax(['Body Slam', 'Crunch'])] };

    expect(replacementNeeded(state.party[0]!, 'Arm Thrust')).toBe('free');
    const after = applyReward(state, { kind: 'tm', move: 'Arm Thrust' }, 0, null);
    expect(after.party[0]!.spec.moves).toEqual(['Body Slam', 'Crunch', 'Arm Thrust']);
  });

  it('replays to an identical party from the same log', async () => {
    const original = await playRun('MOVE-REPLAY', movePicker());
    const replayed = await replayRun(original.log);

    expect(replayed.state.party.map((member) => member.spec.moves)).toEqual(
      original.state.party.map((member) => member.spec.moves),
    );
    expect(replayed.outcome).toBe(original.outcome);
    expect(JSON.stringify(replayed.log)).toBe(JSON.stringify(original.log));
  }, 60_000);

  it('resumes identically from a save taken between the two questions', async () => {
    // The interesting save point: the recipient is recorded and the replacement
    // is not, so a resume has to ask the second question and no other.
    const saves: RunLog[] = [];
    const original = await playRun('MOVE-MIDSAVE', movePicker(), undefined, {
      onDecision: (log) => saves.push(JSON.parse(JSON.stringify(log)) as RunLog),
    });

    const between = saves.filter((log) => log.decisions.at(-1)?.kind === 'target');
    expect(between.length).toBeGreaterThan(0);

    for (const save of between) {
      const resumed = await resumeRun(save, movePicker());
      expect(
        resumed.state.party.map((member) => member.spec.moves),
        `resuming after ${save.decisions.length} decisions`,
      ).toEqual(original.state.party.map((member) => member.spec.moves));
    }
  }, 120_000);
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('neither decision consumes RNG', () => {
  it('produces the same map from the same seed whoever learns what', async () => {
    /*
     * Two runs, one seed, opposite answers to both move questions.
     *
     * If either decision drew from a stream, the maps would diverge from the
     * first move card onward and the node ids would stop matching. They are
     * player decisions, so the map is identical and only the party differs.
     */
    const lastSlot = await playRun('MOVE-RNG', movePicker());
    const firstSlot = await playRun('MOVE-RNG', {
      ...movePicker(),
      chooseMoveRecipient: async () => 0,
      chooseMoveToReplace: async () => 0,
    });

    const nodeIds = (result: typeof lastSlot): string[] =>
      result.state.history.map((visit) => visit.node.id);

    expect(nodeIds(firstSlot).slice(0, 6)).toEqual(nodeIds(lastSlot).slice(0, 6));
  }, 60_000);

  it('is a pure function of member and slot, so the same call twice agrees', () => {
    const member = snorlax(FOUR);
    expect(teachMove(member, 'Arm Thrust', 2)).toEqual(teachMove(member, 'Arm Thrust', 2));
  });
});

// ---------------------------------------------------------------------------
// The reference heuristic
// ---------------------------------------------------------------------------

describe('defaultMoveReplacement', () => {
  it('always names a slot, because there is no decline', () => {
    // The old rule could answer "displace nothing". This one cannot, and that
    // is the shape Stage 4.5.1 intends.
    for (const moves of [FOUR, ['Rest', 'Amnesia', 'Curse', 'Yawn'], ['Body Slam']]) {
      const slot = defaultMoveReplacement(snorlax(moves), describeMove('Arm Thrust')!);
      expect(Number.isInteger(slot)).toBe(true);
      expect(slot).toBeGreaterThanOrEqual(0);
    }
  });

  it('breaks ties toward the later slot, so the answer is stable', () => {
    // Two moves at the same base power: the later one goes, every time.
    const member = snorlax(['Tackle', 'Body Slam', 'Pound', 'Earthquake']);
    const slot = defaultMoveReplacement(member, describeMove('Arm Thrust')!);
    const powers = member.spec.moves.map((name) => describeMove(name)!.basePower);
    const lowest = Math.min(...powers);
    expect(powers[slot]).toBe(lowest);
    expect(powers.lastIndexOf(lowest)).toBe(slot);
  });
});

// ---------------------------------------------------------------------------
// The headless run the spec asks for
// ---------------------------------------------------------------------------

describe('a scripted run exercising every Stage 4.5.1 decision', () => {
  it('completes under Node, taking moves, species, items and a shop', async () => {
    /*
     * The spec's test 6, as one run: a policy that takes a move reward and
     * replaces a move, takes a species reward and swaps a party member, assigns
     * items, and buys from a shop.
     *
     * Written as a *census* rather than as a walkthrough — it asserts that each
     * decision kind actually occurred, because a policy that quietly never
     * reached one of them would otherwise pass by doing nothing.
     */
    const seen = new Set<string>();
    const policy: RunPolicy = {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseReward: async (offer) => {
        // Prefer a move card, then a species card, then anything.
        const move = offer.options.findIndex((o) => o.kind === 'tm' || o.kind === 'tutor');
        if (move !== -1) return move;
        const species = offer.options.findIndex((o) => o.kind === 'species');
        return species === -1 ? 0 : species;
      },
      chooseShopPurchases: async (stock, state) => {
        // Everything affordable, cheapest first, so the shop is really used.
        const order = stock.items
          .map((item, index) => ({ index, price: item.price }))
          .sort((a, b) => a.price - b.price);
        const basket: number[] = [];
        let left = state.currency;
        for (const entry of order) {
          if (entry.price > left) continue;
          basket.push(entry.index);
          left -= entry.price;
        }
        if (basket.length > 0) seen.add('shop');
        return basket;
      },
      chooseMoveRecipient: async (_offer, party) => {
        seen.add('move-recipient');
        return party.length - 1;
      },
      chooseMoveToReplace: async (member) => {
        seen.add('move-replace');
        return member.spec.moves.length - 1;
      },
      // Take everything: accept while there is room, release slot 0 once full,
      // so a party swap really happens.
      chooseAcquisition: async (_offer, party) => {
        seen.add('acquisition');
        if (party.length < PARTY_SIZE) return { kind: 'accept' };
        seen.add('release');
        return { kind: 'release', slot: 0 };
      },
      chooseItemPlan: async (state) => {
        const plan = defaultItemPlan(state);
        if (plan.assignments.length > 0) seen.add('item-assign');
        if (plan.discards.length > 0) seen.add('item-discard');
        return plan;
      },
    };

    /*
     * The seed is chosen, not arbitrary. Most runs die before the party fills,
     * and a census that never reached a release would be asserting five things
     * and silently skipping the sixth. `ALL-DECISIONS` gets four gyms deep with
     * this policy, which is far enough to hit every branch.
     */
    const run = await playRun('ALL-DECISIONS', policy);

    expect(['victory', 'defeat']).toContain(run.outcome);
    for (const decision of ['move-recipient', 'move-replace', 'acquisition', 'release', 'shop', 'item-assign']) {
      expect(seen.has(decision), `the run never exercised ${decision}`).toBe(true);
    }

    // And the whole thing replays from its own log.
    const replayed = await replayRun(run.log);
    expect(replayed.outcome).toBe(run.outcome);
    expect(replayed.state.party.map((member) => member.spec.moves)).toEqual(
      run.state.party.map((member) => member.spec.moves),
    );
    expect(replayed.state.backpack).toEqual(run.state.backpack);
  }, 120_000);
});
