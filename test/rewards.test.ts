/**
 * Rewards and held items.
 *
 * The centre of this file is section 3, and it is the reason the checkpoint
 * exists at all: **an item has to actually fire in the sim**. Everything else
 * here is bookkeeping around a feature that either reaches the engine or does
 * not, and a test that asserted `member.item === 'leftovers'` would pass just
 * as happily on a build where the item never left `core/`.
 *
 * So the item assertions read the **battle protocol** — the lines the engine
 * itself emitted — rather than any state this repo maintains. That is the only
 * evidence that the plumbing works, and it is the assertion that would have
 * caught the read-back bug documented in `party.applyBattleState`.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { describeMove, runBattle } from '../src/core/battle/driver';
import { usableMoves, type Policy } from '../src/core/battle/policy';
import { nodesOf } from '../src/core/encounters';
import { battleSpecFor, giveItem, itemSuitsTypes } from '../src/core/items';
import { createParty, createPartyMember, teachMove } from '../src/core/party';
import { createRng } from '../src/core/rng';
import {
  createRun,
  defaultMoveReplacement,
  playRun,
  RUN_LOG_VERSION,
  replayRun,
  scriptedRunPolicy,
  type RunPolicy,
  type RunState,
} from '../src/core/run';
import { applyReward, describeReward, OFFER_SIZE } from '../src/core/rewards';
import { moveChoice, type PokemonSpec, type RunLog, type TeamSpec } from '../src/core/types';
import { ITEMS, itemById } from '../src/data/items';
import { RANDOMIZER_VERSION } from '../src/core/randomizer';
import { REWARD_POOLS, rewardEntriesFor } from '../src/data/rewardPools';
import { SEGMENT_COUNT } from '../src/data/scaling';
import { DEFAULT_TUNING, withTuning } from '../src/data/tuning';

const seeds = Array.from({ length: 20 }, (_, i) => `REW-${i}`);

/** Every offer a seed's map generated, with the node that carries it. */
function offersOf(seed: string, tuning = DEFAULT_TUNING) {
  return createRun(seed, tuning)
    .segments.flatMap(nodesOf)
    .flatMap((node) => (node.reward ? [{ node, offer: node.reward }] : []));
}

// ---------------------------------------------------------------------------
// 1. The offer: three distinct options, drawn from the seed
// ---------------------------------------------------------------------------

describe('reward offers', () => {
  it('gives every battle node exactly three distinct options, and nothing else any', () => {
    for (const seed of seeds) {
      for (const segment of createRun(seed).segments) {
        for (const node of nodesOf(segment)) {
          if (!node.tier && node.kind !== 'gym') {
            expect(node.reward, `${node.id} is a ${node.kind} and should pay no cards`).toBeNull();
            continue;
          }
          /*
           * A gym has no tier and, from Stage 4.5.2, does have an offer — it
           * draws from a segment-keyed pool instead. It goes through the same
           * three-distinct-options check as everything else below, because the
           * shape of an offer is the same shape wherever it came from.
           */
          const options = node.reward?.options ?? [];
          expect(options, `${node.id}`).toHaveLength(OFFER_SIZE);
          // Distinct by *content*, not by kind: two `item` cards are a fine
          // offer as long as they are two different items. Two identical cards
          // are a choice of three printed as a choice of two.
          const signatures = options.map((option) => JSON.stringify(option));
          expect(new Set(signatures).size, `${node.id} repeats a card`).toBe(OFFER_SIZE);
        }
      }
    }
  });

  it('only ever offers a reward the current build can apply', () => {
    // "Legal for the run state" at generation time means: the payload resolves.
    // An item id off the whitelist or a move name the engine will not teach are
    // both cards that look fine on screen and do nothing when taken.
    for (const seed of seeds) {
      for (const { node, offer } of offersOf(seed)) {
        for (const option of offer.options) {
          if (option.kind === 'item') expect(itemById(option.item), `${node.id}`).not.toBeNull();
          if (option.kind === 'currency') expect(option.amount).toBeGreaterThan(0);
          if (option.kind === 'heal') expect(option.fraction).toBeGreaterThan(0);
          if (option.kind === 'tm' || option.kind === 'tutor') expect(option.move.length).toBeGreaterThan(0);
          expect(describeReward(option).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('gates species rewards on the tuning flag, in both directions', () => {
    /*
     * The gate is applied at the *draw*, not at the application. A card the
     * player can pick that then does nothing is worse than one never dealt.
     *
     * Both directions asserted against an explicit flag rather than against the
     * default, which flipped to on in Stage 4 — a party is somewhere to put an
     * acquired Pokemon, which is the condition Stage 3 said to wait for. A test
     * written against the default would have gone quiet at that moment instead
     * of failing.
     */
    const kinds = (tuning: typeof DEFAULT_TUNING): Set<string> => {
      const seen = new Set<string>();
      for (const seed of seeds) {
        for (const { offer } of offersOf(seed, tuning)) for (const o of offer.options) seen.add(o.kind);
      }
      return seen;
    };
    expect(kinds(withTuning({ allowSpeciesRewards: false })).has('species')).toBe(false);
    expect(kinds(withTuning({ allowSpeciesRewards: true })).has('species')).toBe(true);
    // And the shipped default is on, which is the Stage 4 change itself.
    expect(DEFAULT_TUNING.allowSpeciesRewards).toBe(true);
  });

  it('pays elite nodes from a strictly better table than normal ones', () => {
    // The property the whole stage rests on: an elite pool must not merely be a
    // longer normal pool. Asserted structurally — no entry an elite node can
    // draw may also be drawable at normal in the same band — because the
    // behavioural version of this claim is checkpoint 4's job and this one
    // should fail at the data rather than at a win rate.
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      const normalItems = new Set(
        rewardEntriesFor('normal', segment).flatMap((e) => (e.kind === 'item' ? e.items : [])),
      );
      const eliteItems = rewardEntriesFor('elite', segment).flatMap((e) => (e.kind === 'item' ? e.items : []));
      expect(eliteItems.length, `segment ${segment} elite offers no items`).toBeGreaterThan(0);
      for (const id of eliteItems) {
        expect(normalItems.has(id), `segment ${segment}: elite and normal share ${id}`).toBe(false);
      }
    }
  });

  it('has enough entries in every pool to fill an offer', () => {
    // A pool of two would surface as a reward screen with two buttons several
    // hundred nodes into a run. `generateRewardOffer` throws on it; this finds
    // it at the table.
    for (const [tier, bands] of Object.entries(REWARD_POOLS)) {
      for (const band of bands) {
        expect(band.entries.length, `${tier} through segment ${band.throughSegment}`).toBeGreaterThanOrEqual(
          OFFER_SIZE,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Determinism and stream isolation
// ---------------------------------------------------------------------------

describe('reward determinism', () => {
  it('offers the same cards to the same seed, twice', () => {
    expect(offersOf('REW-SAME').map((o) => o.offer)).toEqual(offersOf('REW-SAME').map((o) => o.offer));
  });

  it('offers different cards to different seeds', () => {
    expect(offersOf('REW-A').map((o) => o.offer)).not.toEqual(offersOf('REW-B').map((o) => o.offer));
  });

  it('draws every offer before the player decides anything', () => {
    // The decision docs/generation.md records, at the level a player would
    // notice it: the three cards were fixed when the map was built, so how the
    // battle went cannot have moved them.
    for (const { offer } of offersOf('REW-EAGER')) {
      expect(offer.options).toHaveLength(OFFER_SIZE);
    }
  });

  it('cannot be moved by draining any other stream', () => {
    const baseline = offersOf('REW-ISOLATE').map((o) => o.offer);
    for (const stream of ['map', 'battle', 'randomizer', 'policy'] as const) {
      const noisy = createRng('REW-ISOLATE');
      for (let i = 0; i < 5_000; i++) noisy[stream].nextUint32();
      expect(offersOf('REW-ISOLATE').map((o) => o.offer), `draining ${stream}`).toEqual(baseline);
    }
  });

  it('leaves the map and the encounters alone when the pools change', () => {
    // The other direction. Reward pools are the file checkpoint 4 will edit
    // repeatedly, and a pool edit that reshaped maps would make every balance
    // comparison between two runs of the simulator meaningless.
    const mapOf = (tuning: typeof DEFAULT_TUNING): unknown =>
      createRun('REW-POOLS', tuning).segments.map((segment) =>
        nodesOf(segment).map((node) => ({
          id: node.id,
          kind: node.kind,
          tier: node.tier,
          team: node.encounter?.team,
          simSeed: node.encounter?.simSeed,
        })),
      );
    expect(mapOf(withTuning({ allowSpeciesRewards: true }))).toEqual(mapOf(DEFAULT_TUNING));
  });
});

// ---------------------------------------------------------------------------
// 3. Items actually fire in the sim
// ---------------------------------------------------------------------------

/**
 * A long, survivable fight against something that cannot kill quickly.
 *
 * Blissey at half HP gives Leftovers a lot of room to heal into and enough
 * turns for the healing to appear more than once; Shuckle using Bide is the
 * cheapest opponent that will not end the battle on turn one and will not do
 * anything interesting enough to confuse the protocol.
 */
const HOLDER: PokemonSpec = {
  species: 'Blissey',
  ability: 'Natural Cure',
  moves: ['Tackle', 'Water Gun', 'Ember', 'Vine Whip'],
  level: 50,
};
const PUNCHBAG: TeamSpec = [{ species: 'Shuckle', ability: 'Sturdy', moves: ['Bide'], level: 50 }];

/** Cycles moves by turn, so a Choice lock is the only thing that can stop it. */
const cyclingPolicy: Policy = async (view) => {
  const moves = usableMoves(view);
  const pick = moves[view.turn % moves.length];
  return moveChoice((pick ?? moves[0]!).slot);
};

async function fightHolding(item: string | undefined, seed: string) {
  const member = createPartyMember(HOLDER);
  const held = item ? giveItem(member, item).member : member;
  const hurt = { ...held, hp: Math.floor(held.maxHp / 2) };
  return runBattle([battleSpecFor(hurt)], PUNCHBAG, seed, cyclingPolicy, greedyAiPolicy, {
    carryOver: [hurt],
  });
}

describe('held items reach the engine', () => {
  it('heals at the end of every turn when holding Leftovers', async () => {
    const run = await fightHolding('leftovers', 'ITEM-LEFTOVERS');
    const heals = run.protocol.filter((line) => line.includes('[from] item: Leftovers'));

    // Read off the protocol, not off any state this repo keeps. The engine said
    // it healed, and it said the item's name while doing it.
    expect(heals.length).toBeGreaterThan(3);
    expect(heals[0]).toMatch(/^\|-heal\|p1a: Blissey\|\d+\/\d+\|\[from\] item: Leftovers$/);

    // And the same fight without the item produces none, so the assertion above
    // is about Leftovers rather than about Blissey healing some other way.
    const control = await fightHolding(undefined, 'ITEM-LEFTOVERS');
    expect(control.protocol.filter((line) => line.includes('[from] item: Leftovers'))).toHaveLength(0);
  });

  it('locks the holder into one move when holding a Choice item', async () => {
    // The policy deliberately cycles moves by turn number, so *it* is not the
    // thing keeping the move constant. Without the item it uses several; with
    // it, the engine only ever emits one.
    const control = await fightHolding(undefined, 'ITEM-CHOICE');
    const locked = await fightHolding('choiceband', 'ITEM-CHOICE');

    const movesUsed = (protocol: readonly string[]): Set<string> =>
      new Set(protocol.filter((line) => line.startsWith('|move|p1a')).map((line) => line.split('|')[3] ?? ''));

    expect(movesUsed(control.protocol).size).toBeGreaterThan(1);
    expect(movesUsed(locked.protocol).size).toBe(1);
  });

  it('drops an item the whitelist does not know rather than passing it through', () => {
    const member = createPartyMember(HOLDER);
    expect(giveItem(member, 'masterball').member.item).toBeUndefined();
    expect(battleSpecFor({ ...member, item: 'masterball' }).item).toBeUndefined();
    expect(battleSpecFor(giveItem(member, 'leftovers').member).item).toBe('leftovers');
  });

  it('keeps the item off the identity spec, and out of the way of a read-back', async () => {
    /*
     * The regression guard for the bug this checkpoint introduced and fixed.
     *
     * `battleTeamFor` merges the item into a *new* spec object. Stage 2's
     * `applyBattleState` matched party members to read-back state by spec
     * identity, so with a merged spec it would have matched nothing, returned
     * the party untouched, and silently discarded every point of damage from
     * every battle — while passing every type check and every Stage 2 test.
     *
     * So: hold an item, take a real fight, and assert HP actually moved.
     */
    const state = createRun('ITEM-READBACK');
    const party = createParty([state.starterOptions[0]!]).map((member) => giveItem(member, 'leftovers').member);
    expect(party[0]!.spec.item).toBeUndefined();
    expect(battleSpecFor(party[0]!).item).toBe('leftovers');

    const run = await playRun('ITEM-READBACK', scriptedRunPolicy(greedyAiPolicy));
    /*
     * HP went *down*, which is the property this guards.
     *
     * It read `hpAfter > 0` until Stage 4.6b, which says "the party survived a
     * fight with something left" — true of a run that wins its first fight and
     * false of one that loses it, so the test was a seed's survival wearing a
     * regression guard's clothes. The bug it exists for is damage being
     * silently discarded, and the assertion for that is that damage landed.
     */
    const startingHp = party.reduce((total, member) => total + member.maxHp, 0);
    const damaged = run.state.history.some((visit) => visit.result && visit.hpAfter < startingHp);
    expect(damaged, 'no fight moved a single point of HP').toBe(true);
  });

  it('names a type item that does nothing for this Pokemon', () => {
    const charcoal = itemById('charcoal')!;
    const leftovers = itemById('leftovers')!;
    expect(itemSuitsTypes(charcoal, ['Fire', 'Flying'])).toBe(true);
    expect(itemSuitsTypes(charcoal, ['Water'])).toBe(false);
    // A non-type item suits everything; the reward screen must not mark it dud.
    expect(itemSuitsTypes(leftovers, ['Water'])).toBe(true);
  });

  it('keeps every whitelisted item known to the engine', async () => {
    // The whitelist is hand-written and the dex is not. A typo'd id would be
    // dropped silently by `battleSpecFor`, which is exactly the failure mode
    // that never surfaces.
    const { Dex } = await import('@pkmn/sim');
    for (const entry of ITEMS) {
      const item = Dex.forGen(9).items.get(entry.id);
      expect(item.exists, `${entry.id} is not an item`).toBe(true);
      expect(item.name).toBe(entry.name);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Applying a reward
// ---------------------------------------------------------------------------

describe('applyReward', () => {
  function started(seed = 'APPLY'): RunState {
    const state = createRun(seed);
    return { ...state, starterIndex: 0, party: createParty([state.starterOptions[0]!]) };
  }

  it('adds currency and never subtracts it', () => {
    const state = started();
    expect(applyReward(state, { kind: 'currency', amount: 40 }).currency).toBe(40);
    // A negative payout is a data bug; clamping it is cheaper than a run that
    // owes money it can never repay.
    expect(applyReward(state, { kind: 'currency', amount: -40 }).currency).toBe(0);
  });

  /*
   * Stage 4.5.1: banked, which is exactly what the old version said would not
   * happen.
   *
   * The previous assertion ended "the old one is gone, not banked", and the
   * backpack is the bank. Two item cards in a row used to leave the lead
   * holding the second and the first destroyed; they now leave the run holding
   * both, and the choice of who wears which is made elsewhere and is free.
   */
  it('banks both item cards rather than having the second destroy the first', () => {
    let state = applyReward(started(), { kind: 'item', item: 'leftovers' });
    state = applyReward(state, { kind: 'item', item: 'lifeorb' });
    expect(state.backpack).toEqual(['leftovers', 'lifeorb']);
    expect(state.party[0]?.item).toBeUndefined();
  });

  it('heals without ever exceeding max HP', () => {
    const base = started();
    const hurt = { ...base, party: base.party.map((m) => ({ ...m, hp: 1 })) };
    const healed = applyReward(hurt, { kind: 'heal', fraction: 1 });
    expect(healed.party[0]?.hp).toBe(healed.party[0]?.maxHp);
  });

  /*
   * Stage 4.5.1: `teachMove` no longer picks. It is told.
   *
   * This asserted the rule that chose the weakest attack and protected status
   * moves. That rule is now the *player's* choice, so the test asserts the new
   * contract instead: the named slot is what goes, and nothing else moves. The
   * old rule survives as `run.defaultMoveReplacement`, which is tested for what
   * it now is — one policy's answer among several — rather than as a law.
   */
  it('displaces exactly the move slot it is given, and nothing else', () => {
    const member = createPartyMember({
      species: 'Snorlax',
      ability: 'Thick Fat',
      moves: ['Pound', 'Body Slam', 'Rest', 'Giga Impact'],
      level: 50,
    });
    const taught = teachMove(member, 'Earthquake', 2);
    const names = taught.spec.moves;

    // Slot 2 was Rest, and the player is now allowed to spend it.
    expect(names).toEqual(['Pound', 'Body Slam', 'Earthquake', 'Giga Impact']);
  });

  it('refuses a slot when the member has a free one, rather than ignoring it', () => {
    const member = createPartyMember({
      species: 'Snorlax',
      ability: 'Thick Fat',
      moves: ['Pound', 'Body Slam'],
      level: 50,
    });
    // Loud, because a silently ignored slot means a log entry that changed
    // nothing, and the next replay finds an entry the run no longer asks for.
    expect(() => teachMove(member, 'Earthquake', 0)).toThrow(/has a free move slot/);
    expect(teachMove(member, 'Earthquake').spec.moves).toEqual(['Pound', 'Body Slam', 'Earthquake']);
  });

  it('refuses to teach a fifth move without being told what it displaces', () => {
    const member = createPartyMember({
      species: 'Snorlax',
      ability: 'Thick Fat',
      moves: ['Pound', 'Body Slam', 'Rest', 'Giga Impact'],
      level: 50,
    });
    expect(() => teachMove(member, 'Earthquake')).toThrow(/must displace one/);
  });

  it('refuses a slot outside the member move list', () => {
    const member = createPartyMember({
      species: 'Snorlax',
      ability: 'Thick Fat',
      moves: ['Pound', 'Body Slam', 'Rest', 'Giga Impact'],
      level: 50,
    });
    expect(() => teachMove(member, 'Earthquake', 4)).toThrow(/out of range/);
    expect(() => teachMove(member, 'Earthquake', -1)).toThrow(/out of range/);
  });

  it('refills PP instead of doing nothing when the move is already known', () => {
    const member = createPartyMember({
      species: 'Snorlax',
      ability: 'Thick Fat',
      moves: ['Body Slam', 'Rest', 'Crunch', 'Earthquake'],
      level: 50,
    });
    const spent = { ...member, moves: member.moves.map((m) => ({ ...m, pp: 1 })) };
    const taught = teachMove(spent, 'Crunch');
    const crunch = taught.moves.find((m) => m.name === 'Crunch');

    expect(taught.spec.moves).toEqual(member.spec.moves);
    expect(crunch?.pp).toBe(crunch?.maxPp);
    // Only that move refilled — the card is a move tutor, not a free rest.
    expect(taught.moves.find((m) => m.name === 'Rest')?.pp).toBe(1);
  });

  it('CAN now leave the party weaker, which is the invariant this stage gave up', () => {
    /*
     * **This test used to assert the opposite, and the inversion is deliberate.**
     *
     * The old rule refused to teach a move weaker than everything the member
     * knew — "nothing learned, nothing lost, PP topped up instead" — and that
     * clause was what made a move card safe to be forced into. Stage 4.5.1
     * removes the safety on purpose: which move you give up is a more
     * interesting decision than which you gain, and a rule guaranteeing you
     * never lose is a rule that removes the decision.
     *
     * The escape hatch moved rather than disappearing. It lives at the reward
     * screen, where this card was chosen over two alternatives; offering a
     * second one here would make that pick meaningless.
     *
     * So Arm Thrust (15 BP) really does displace Giga Impact if that is what
     * the player says. The test exists to make that a decision someone made
     * rather than a regression someone will "fix".
     */
    const member = createPartyMember({
      species: 'Snorlax',
      ability: 'Thick Fat',
      moves: ['Body Slam', 'Crunch', 'Earthquake', 'Giga Impact'],
      level: 50,
    });
    const after = teachMove(member, 'Arm Thrust', 3);

    expect(after.spec.moves).toEqual(['Body Slam', 'Crunch', 'Earthquake', 'Arm Thrust']);
  });

  /*
   * What the old rule became, tested as what it now is.
   *
   * Stage 4.5 protected status moves by spending them: an incoming move weaker
   * than every attack took the status slot, so the *attacks* could never get
   * worse. `defaultMoveReplacement` deliberately does not carry that clause
   * over. It is the scripted baseline's answer, not the game's, and it is
   * simpler on purpose — it never reads the incoming move's power at all, which
   * is why the parameter is explicitly discarded.
   *
   * The visible consequence, asserted here so it is a decision rather than a
   * surprise: the baseline now drops its *weakest attack* and keeps Rest, which
   * is the opposite trade the old rule made. The simulator does not use this
   * heuristic — `scripts/sim.ts` has its own, which does spend a spare status
   * move — so the balance report is not measuring this behaviour.
   */
  it('drops the weakest attack and keeps a status move, which inverts the Stage 4.5 trade', () => {
    const member = createPartyMember({
      species: 'Snorlax',
      ability: 'Thick Fat',
      moves: ['Body Slam', 'Crunch', 'Earthquake', 'Rest'],
      level: 50,
    });
    const incoming = describeMove('Arm Thrust')!;
    const slot = defaultMoveReplacement(member, incoming);
    const after = teachMove(member, 'Arm Thrust', slot);

    // Crunch (80) is the weakest of the three attacks; Body Slam is 85 and
    // Earthquake 100. Rest survives because the rule never looks at it.
    expect(after.spec.moves).toEqual(['Body Slam', 'Arm Thrust', 'Earthquake', 'Rest']);
  });

  it('falls back to a status slot only when there is no attack to drop', () => {
    const member = createPartyMember({
      species: 'Snorlax',
      ability: 'Thick Fat',
      moves: ['Rest', 'Amnesia', 'Curse', 'Yawn'],
      level: 50,
    });
    const slot = defaultMoveReplacement(member, describeMove('Arm Thrust')!);
    // The last status move, so the choice is stable rather than dependent on
    // move order at the front of the list.
    expect(slot).toBe(3);
  });

  it('never offers a move card that cannot do anything', () => {
    // The data half of the same rule: every tm and tutor entry draws from at
    // least one band above the node's own, so an early TM is not automatically
    // weaker than the kit the player started with.
    for (const [tier, bands] of Object.entries(REWARD_POOLS)) {
      for (const band of bands) {
        for (const entry of band.entries) {
          if (entry.kind !== 'tm' && entry.kind !== 'tutor') continue;
          expect(entry.bandOffset, `${tier} through segment ${band.throughSegment}`).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('fills an empty slot before replacing anything', () => {
    const member = createPartyMember({
      species: 'Snorlax',
      ability: 'Thick Fat',
      moves: ['Body Slam', 'Rest'],
      level: 50,
    });
    const taught = teachMove(member, 'Crunch');
    expect(taught.spec.moves).toEqual(['Body Slam', 'Rest', 'Crunch']);
  });

  it('leaves a wiped party alone rather than reaching for slot zero', () => {
    const base = started();
    const wiped = { ...base, party: base.party.map((m) => ({ ...m, hp: 0, fainted: true })) };
    expect(applyReward(wiped, { kind: 'item', item: 'leftovers' }).party[0]?.item).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Through a whole run
// ---------------------------------------------------------------------------

describe('rewards in a played run', () => {
  /** Takes the first item card it is offered, so a run visibly accumulates one. */
  function itemHungry(): RunPolicy {
    return {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseNode: async (options) => {
        // A *fight*, specifically. "Not a rest" used to mean the same thing and
        // stopped meaning it when shops and events arrived: a run that took
        // every shop it saw would never win a battle and never be offered a
        // card, which is a fact about the policy rather than about rewards.
        const index = options.findIndex((option) => option.tier !== null);
        return index === -1 ? 0 : index;
      },
      chooseReward: async (offer) => {
        const index = offer.options.findIndex((option) => option.kind === 'item');
        return index === -1 ? 0 : index;
      },
    };
  }

  it('plays headless, takes rewards, and records the choice in the log', async () => {
    expect(typeof globalThis.document).toBe('undefined');

    // Over a population rather than one seed. A single seed can lose its first
    // fight and pay out nothing, which is a fact about that seed and would make
    // this assert nothing on the day it happens to hold.
    const runs = await Promise.all(seeds.slice(0, 6).map((seed) => playRun(seed, itemHungry())));
    const run = runs.find((candidate) => candidate.log.decisions.some((d) => d.kind === 'reward'));
    expect(run, 'no seed in the sample ever won a fight').toBeDefined();
    if (!run) return;

    const rewardDecisions = run.log.decisions.filter((d) => d.kind === 'reward');
    expect(rewardDecisions.length).toBeGreaterThan(0);
    // The log stores an index. Not the reward — that is derived from the seed,
    // and a log holding derived state is one that can disagree with the engine.
    for (const decision of rewardDecisions) {
      expect(Object.keys(decision).sort()).toEqual(['index', 'kind']);
    }
    expect(JSON.stringify(run.log)).not.toContain('leftovers');
  });

  it('replays a run with rewards to exactly the same state', async () => {
    const original = await playRun('REW-REPLAY', itemHungry());
    const replayed = await replayRun(original.log);

    expect(replayed.outcome).toBe(original.outcome);
    expect(replayed.state.currency).toBe(original.state.currency);
    expect(replayed.state.party.map((m) => m.item)).toEqual(original.state.party.map((m) => m.item));
    expect(replayed.state.party.map((m) => m.spec.moves)).toEqual(original.state.party.map((m) => m.spec.moves));
  });

  it('pays nothing for a fight the player lost', async () => {
    // A reward is asked for only on a win, which is what makes the elite node
    // next to the normal one a risk rather than a slower payout.
    let losses = 0;
    let rewardAsks = 0;
    for (const seed of seeds) {
      const run = await playRun(seed, {
        ...itemHungry(),
        chooseReward: async (offer) => {
          rewardAsks++;
          return offer.options.findIndex((o) => o.kind === 'item') === -1 ? 0 : 0;
        },
      });
      const fought = run.state.history.filter((visit) => visit.result).length;
      const won = run.state.history.filter((visit) => visit.result?.winner === 'p1').length;
      losses += fought - won;
    }
    expect(losses).toBeGreaterThan(0);
    expect(rewardAsks).toBeGreaterThan(0);
  });

  it('rejects a Stage 2 log by version rather than replaying it', () => {
    // The failure this prevents: a Stage 2 log has no reward decisions, so a
    // replay would run out of step the first time a node paid out — but only
    // after reconstructing several nodes of a run that was never played. The
    // guard refuses up front and names both versions.
    const stale: RunLog = {
      seed: 'REW-STALE',
      version: 'gymrun-run-3/gymrun-0.1.0',
      randomizerVersion: RANDOMIZER_VERSION,
      decisions: [{ kind: 'starter', index: 0 }],
    };
    // Thrown synchronously, before `playRun` is even entered: `replayRunPolicy`
    // asserts on construction, so an incompatible log cannot reach a single
    // node of a run. That is the difference between refusing and crashing.
    expect(() => replayRun(stale)).toThrow(/gymrun-run-3/);
    expect(() => replayRun(stale)).toThrow(RUN_LOG_VERSION);
  });
});
