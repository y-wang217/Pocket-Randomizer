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
import { applyReward } from '../src/core/rewards';
import {
  chooseStarter,
  createRun,
  defaultItemPlan,
  defaultMoveReplacement,
  playRun,
  replayRun,
  scriptedRunPolicy,
  type RunPolicy,
  type RunState,
  teachableNow,
} from '../src/core/run';
import { applyItemPlan } from '../src/core/items';
import type { PokemonSpec, PokemonState } from '../src/core/types';

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

  /*
   * **Two redirection cases were here and are gone with `recipientFor`.**
   *
   * They held that a move aimed at a fainted slot, or at a slot past the end of
   * the party, landed on the lead instead of crashing the run on its own reward
   * screen. Neither can happen now: a teach is composed at a rest or a shop
   * against the party as it stands, so a fainted slot is a deliberate choice
   * and an out-of-range one is a broken plan. The first is honoured below; the
   * second is the loud `RangeError` `applyItemPlan` raises, which
   * `test/backpack.test.ts` holds.
   */

  /*
   * The bug the shared resolution existed to prevent, restated for the plan.
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
  /*
   * **A fainted member is a legitimate recipient now, not a case to redirect.**
   *
   * This used to assert the `recipientFor` fallback: a move aimed at a fainted
   * slot landed on the lead instead, because the recipient was named at the
   * node that paid the card and the member the player wanted could have died in
   * the fight that paid for it. A teach is composed at a rest or a shop now,
   * against the party as it stands — and a fainted member revives between
   * nodes with the move still on it, so honouring the slot named is both
   * simpler and what the player meant.
   */
  it('teaches the slot the plan names, fainted or not, with no redirection', () => {
    const roster = party();
    expect(roster[1]!.fainted).toBe(true);
    // One move, so nothing is displaced — the point here is the recipient, not
    // the victim, and a free slot keeps the case to the one thing it asserts.
    expect(replacementNeeded(roster[1]!, 'Arm Thrust')).toBe('free');

    const state = { ...startedRun(), party: roster, tms: ['Arm Thrust'] };
    const after = applyItemPlan(
      state,
      {
        assignments: [],
        discards: [],
        discardTms: [],
        teaches: [{ move: 'Arm Thrust', slot: 1, replaceSlot: null }],
      },
      8,
      new Set(state.tms),
    );

    expect(after.party[1]!.spec.moves).toContain('Arm Thrust');
    expect(after.party[0]!.spec.moves).not.toContain('Arm Thrust');
    expect(after.tms).toEqual([]);
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
    // The last slot rather than the heuristic's, for the same reason.
    chooseItemPlan: async (state) => defaultItemPlan(state, teachableNow(state)),
  };
}

/*
 * **Three tests were here and are deleted, not skipped.**
 *
 * They held the ordering and the counting of the `target`/`replace` pair: a
 * replacement always immediately preceded by its recipient, never more
 * replacements than recipients, and a resume from a save taken *between* the
 * two questions asking the second one and no other. All three were true, and
 * the band recut had just re-pinned the first of them to a fresh seed — which
 * is worth noting, because it means they were live and passing right up to this
 * merge rather than quietly rotting.
 *
 * None of them describes this game. No move is taught at a node, so neither
 * entry is ever written and the mid-pair save point does not exist.
 * `teachMove`'s own rules are unchanged and are exercised below and through
 * `applyItemPlan`.
 *
 * `docs/spec/gymrun-stage-moves-as-inventory-tms.md`.
 */
describe('what teaching a move still costs', () => {
  it('asks no replacement when the recipient has a free slot', async () => {
    // The gate, tested against a party built for it rather than hunted for in a
    // seed. A two-move member is offered a move and must not be asked.
    const state = { ...startedRun('MOVE-FREE'), party: [snorlax(['Body Slam', 'Crunch'])] };

    expect(replacementNeeded(state.party[0]!, 'Arm Thrust')).toBe('free');

    // The card pays a TM into the bag and teaches nobody. The free-slot gate is
    // still the thing that decides whether a teach needs a victim named, and it
    // is read by `applyItemPlan` when the TM is actually spent.
    const after = applyReward(state, { kind: 'tm', move: 'Arm Thrust' });
    expect(after.tms).toEqual(['Arm Thrust']);
    expect(after.party[0]!.spec.moves).toEqual(['Body Slam', 'Crunch']);

    const taught = applyItemPlan(
      after,
      { assignments: [], discards: [], discardTms: [], teaches: [{ move: 'Arm Thrust', slot: 0, replaceSlot: null }] },
      8,
      new Set(after.tms),
    );
    expect(taught.party[0]!.spec.moves).toEqual(['Body Slam', 'Crunch', 'Arm Thrust']);
    expect(taught.tms).toEqual([]);
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

  /*
   * **"resumes identically from a save taken between the two questions" was
   * here.** There is no longer a point between two questions to save at: the
   * recipient and the victim are answered inside one `ItemPlan` and recorded as
   * one entry, so a save either has the teach or does not.
   */

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
        // Prefer a move card, then anything. The species card it used to fall
        // back to is gone in Stage 4.6b; capture is the acquisition route.
        const move = offer.options.findIndex((o) => o.kind === 'tm' || o.kind === 'tutor');
        return move === -1 ? 0 : move;
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
      // Take everything: accept while there is room, release slot 0 once full,
      // so a party swap really happens.
      chooseAcquisition: async (_offer, party, capacity) => {
        seen.add('acquisition');
        // Stage 4.8: the capacity the run hands the policy, not a constant.
        if (party.length < capacity) return { kind: 'accept' };
        seen.add('release');
        return { kind: 'release', slot: 0 };
      },
      chooseItemPlan: async (state) => {
        const plan = defaultItemPlan(state, teachableNow(state));
        if (plan.assignments.length > 0) seen.add('item-assign');
        if (plan.discards.length > 0) seen.add('item-discard');
        return plan;
      },
    };

    /*
     * The seed is chosen, not arbitrary. Most runs die before the party fills,
     * and a census that never reached a release would be asserting five things
     * and silently skipping the sixth. `ALL-DECISIONS-6` gets deep enough with
     * this policy to hit every branch.
     *
     * It was `ALL-DECISIONS` until Stage 4.6a rekeyed the RNG streams and then
     * added locales, and `ALL-DECISIONS-6` until the band recut and the
     * moves-as-inventory stage were merged. Nothing about the census changed
     * either time; every seed simply rolls a different run, which is what a
     * `RANDOMIZER_VERSION` bump means — and this time the *census itself* also
     * got shorter, because two of the six decisions it counted no longer exist.
     * `npx vite-node scripts/scan-seed.ts census` is how each replacement was
     * found, and its own wanted-list had to lose the same two entries first:
     * a scanner asking for a decision the game cannot produce searches every
     * seed and reports none.
     *
     * `ALL-DECISIONS-2` from `-23`, the inert-ability cut. Nothing about the
     * census changed that time either; an ability is drawn for every Pokemon in
     * every segment, so cutting thirty-three of them moves every seed's run.
     */
    const run = await playRun('ALL-DECISIONS-2', policy);

    expect(['victory', 'defeat']).toContain(run.outcome);
    /*
     * `move-recipient` and `move-replace` left this census with the questions
     * themselves. What replaced them is not a third entry here but the bag: a
     * run that takes a move card is carrying a TM from that node on, which is
     * what `item-assign` now fires on at every boundary after it.
     */
    for (const decision of ['acquisition', 'release', 'shop', 'item-assign']) {
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
