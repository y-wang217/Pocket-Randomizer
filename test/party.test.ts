/**
 * The party: slots, acquisition, release, revival, and item targeting.
 *
 * Stage 4's rules, and every one of them is a rule that was *unreachable*
 * before this stage. At one slot a faint was a wipe, an acquisition was a
 * forced swap, a release would have emptied the party, and every reward landed
 * on the only member there was. So none of these had ever been executed, which
 * is the honest reason to test them all at once rather than trusting the code
 * that was written against them.
 */
import { describe, expect, it } from 'vitest';

import type { Policy } from '../src/core/battle/policy';
import { moveChoice, switchChoice } from '../src/core/types';

import {
  applyAcquisition,
  decisionRefusal,
  hasRoom,
  joinLevelFor,
  type AcquisitionOffer,
} from '../src/core/acquisition';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { generateSegment, generateStarterOptions, nodesOf } from '../src/core/encounters';
import { createRng } from '../src/core/rng';
import { giveItem } from '../src/core/items';
import {
  betweenNodes,
  createParty,
  isWiped,
  releaseMember,
  reorderParty,
  restParty,
  reviveHpFor,
} from '../src/core/party';
import { applyReward } from '../src/core/rewards';
import {
  RUN_LOG_VERSION,
  createRun,
  chooseStarter,
  defaultMoveReplacement,
  gymsCleared,
  playRun,
  replayRun,
  resolveNode,
  resumeRun,
  scriptedRunPolicy,
  SEGMENTS_PER_RUN,
  type RunPolicy,
  type RunState,
  type RunResult,
  chooseLocale,
  stepsOf,
} from '../src/core/run';
import type { PokemonSpec, PokemonState, RunLog } from '../src/core/types';
import { PARTY_SIZE, PARTY_TUNING } from '../src/data/partyTuning';
import { RANDOMIZER_VERSION } from '../src/core/randomizer';
import { playerLevel } from '../src/data/scaling';
import { DEFAULT_TUNING, withTuning } from '../src/data/tuning';

const SPECS: PokemonSpec[] = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Curse'], level: 30 },
  { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 30 },
  { species: 'Blissey', ability: 'Natural Cure', moves: ['Soft-Boiled'], level: 30 },
  { species: 'Skarmory', ability: 'Sturdy', moves: ['Brave Bird'], level: 30 },
];

const OFFER: AcquisitionOffer = {
  nodeId: 's0-1-0',
  source: 'encounter',
  spec: { species: 'Tyranitar', ability: 'Sand Stream', moves: ['Crunch'], level: 27 },
};

function partyOf(count: number): PokemonState[] {
  return createParty(SPECS.slice(0, count));
}

// ---------------------------------------------------------------------------
// Party full
// ---------------------------------------------------------------------------

describe('acquiring at a full party', () => {
  it('has room below PARTY_SIZE and not at it', () => {
    expect(hasRoom(partyOf(PARTY_SIZE - 1))).toBe(true);
    expect(hasRoom(partyOf(PARTY_SIZE))).toBe(false);
  });

  it('refuses a plain accept once full, and requires a release instead', () => {
    const full = partyOf(PARTY_SIZE);
    expect(decisionRefusal(full, { kind: 'accept' })).toMatch(/full/);
    expect(decisionRefusal(full, { kind: 'release', slot: 0 })).toBe(null);
    expect(decisionRefusal(full, { kind: 'decline' })).toBe(null);
  });

  it('refuses a release when there is room, so the two answers cannot be confused', () => {
    const room = partyOf(1);
    expect(decisionRefusal(room, { kind: 'release', slot: 0 })).toMatch(/has room/);
    expect(decisionRefusal(room, { kind: 'accept' })).toBe(null);
  });

  it('never produces a party over PARTY_SIZE, by either path', () => {
    const full = partyOf(PARTY_SIZE);
    expect(applyAcquisition(full, OFFER, { kind: 'decline' }).party).toHaveLength(PARTY_SIZE);
    expect(applyAcquisition(full, OFFER, { kind: 'release', slot: 1 }).party).toHaveLength(PARTY_SIZE);
    expect(applyAcquisition(partyOf(1), OFFER, { kind: 'accept' }).party).toHaveLength(2);
  });

  it('releases the member named and nobody else', () => {
    const full = partyOf(PARTY_SIZE);
    const after = applyAcquisition(full, OFFER, { kind: 'release', slot: 1 }).party;

    expect(after.map((member) => member.spec.species)).not.toContain(SPECS[1]!.species);
    expect(after.map((member) => member.spec.species)).toContain('Tyranitar');
    expect(after.map((member) => member.spec.species)).toContain(SPECS[0]!.species);
  });

  it('throws rather than clamping an illegal decision', () => {
    // Silently turning "release slot 9" into something legal would be a log
    // that replays into a different run, which is the failure the whole
    // decision-log design exists to prevent.
    expect(() => applyAcquisition(partyOf(PARTY_SIZE), OFFER, { kind: 'release', slot: 9 })).toThrow(
      /no party member in slot 9/,
    );
    expect(() => applyAcquisition(partyOf(PARTY_SIZE), OFFER, { kind: 'accept' })).toThrow(/full/);
  });

  it('declining leaves the party untouched, and is always legal', () => {
    for (const size of [1, PARTY_SIZE]) {
      const before = partyOf(size);
      const after = applyAcquisition(before, OFFER, { kind: 'decline' }).party;
      expect(after.map((m) => m.spec.species)).toEqual(before.map((m) => m.spec.species));
    }
  });

  it('joins at full HP, at the offer level, and below the segment curve', () => {
    const joined = applyAcquisition(partyOf(1), OFFER, { kind: 'accept' }).party[1]!;
    expect(joined.hp).toBe(joined.maxHp);
    expect(joined.fainted).toBe(false);
    expect(joined.spec.level).toBe(OFFER.spec.level);

    for (const segment of [0, 3, 7]) {
      expect(joinLevelFor(segment)).toBe(playerLevel(segment) - PARTY_TUNING.joinLevelOffset);
      expect(joinLevelFor(segment)).toBeLessThan(playerLevel(segment));
    }
  });
});

// ---------------------------------------------------------------------------
// Party management
// ---------------------------------------------------------------------------

describe('managing the party between nodes', () => {
  it('reorders to set the battle lead', () => {
    const before = partyOf(3);
    const after = reorderParty(before, 2, 0);
    expect(after.map((m) => m.spec.species)).toEqual(['Blissey', 'Snorlax', 'Gengar']);
  });

  it('leaves the party alone on a fumbled reorder', () => {
    const before = partyOf(3);
    expect(reorderParty(before, 1, 1).map((m) => m.spec.species)).toEqual(
      before.map((m) => m.spec.species),
    );
    expect(reorderParty(before, 9, 0).map((m) => m.spec.species)).toEqual(
      before.map((m) => m.spec.species),
    );
  });

  it('releases a member permanently', () => {
    const after = releaseMember(partyOf(3), 1).party;
    expect(after.map((m) => m.spec.species)).toEqual(['Snorlax', 'Blissey']);
  });

  it('refuses to empty the party', () => {
    // A party of zero is neither wiped nor alive — `isWiped` reads `fainted` —
    // so it would be a state reached by a button rather than by losing.
    const one = partyOf(1);
    expect(releaseMember(one, 0).party).toHaveLength(1);
    expect(isWiped(releaseMember(one, 0).party)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Revival
// ---------------------------------------------------------------------------

describe('revival is partial', () => {
  const fainted = (): PokemonState[] => {
    const party = partyOf(2);
    return [{ ...party[0]!, hp: 0, fainted: true }, party[1]!];
  };

  // Stage 4.5.1: the fraction moved from `PARTY_TUNING.reviveHpFraction` to
  // `tuning.reviveHpPercent` so a sweep can vary it. Same number, same
  // behaviour — the assertion below reads it off the tuning now.
  it('brings a fainted member back at reviveHpPercent at the next node', () => {
    const revived = betweenNodes(fainted(), DEFAULT_TUNING)[0]!;
    expect(revived.fainted).toBe(false);
    expect(revived.hp).toBe(reviveHpFor(revived.maxHp, DEFAULT_TUNING.reviveHpPercent));
    // Which is a real cost, not a formality: it is not a full heal.
    expect(revived.hp).toBeLessThan(revived.maxHp);
  });

  it('honours a swept reviveHpPercent rather than a constant', () => {
    // The whole point of the move: `withTuning` can now reach this number.
    // At party size 1 these branches are unreachable, so the sweep is the only
    // thing that can tell the difference between them.
    const quarter = betweenNodes(fainted(), withTuning({ reviveHpPercent: 0.25 }))[0]!;
    const full = betweenNodes(fainted(), withTuning({ reviveHpPercent: 1 }))[0]!;
    expect(quarter.hp).toBe(reviveHpFor(quarter.maxHp, 0.25));
    expect(full.hp).toBe(full.maxHp);
    expect(quarter.hp).toBeLessThan(full.hp);
  });

  it('never revives a member to zero HP, however low the percent goes', () => {
    // `round(maxHp * 0)` is 0, and an un-fainted member at zero HP is a state
    // nothing downstream is written to survive.
    const revived = betweenNodes(fainted(), withTuning({ reviveHpPercent: 0 }))[0]!;
    expect(revived.fainted).toBe(false);
    expect(revived.hp).toBe(1);
  });

  it('restores fully at a rest node', () => {
    const rested = restParty(betweenNodes(fainted(), DEFAULT_TUNING), DEFAULT_TUNING)[0]!;
    expect(rested.hp).toBe(rested.maxHp);
    expect(rested.fainted).toBe(false);
  });

  it('leaves a wipe a wipe: every member fainted is still the only death rule', () => {
    const party = partyOf(2).map((member) => ({ ...member, hp: 0, fainted: true }));
    expect(isWiped(party)).toBe(true);
    // And a party with one member standing is not wiped, however badly hurt.
    expect(isWiped([{ ...party[0]!, hp: 1, fainted: false }, party[1]!])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Item targeting
// ---------------------------------------------------------------------------

describe('targeting a reward at a party member', () => {
  function state(): RunState {
    return { ...chooseStarter(createRun('TARGET'), 0), party: partyOf(3) };
  }

  /*
   * Stage 4.5.1: an item card is no longer targeted at all.
   *
   * It used to land on a named slot and destroy whatever was there. It now
   * lands in the backpack, and who holds it is settled on the party screen by a
   * separate, free, reversible decision — see `rewards.isTargeted` for why a
   * choice the player can undo ten seconds later does not belong on a reward
   * screen. The assertion is kept rather than deleted so the change is visible
   * as a change: same card, same call, different destination.
   */
  it('puts an item card in the backpack rather than on a party member', () => {
    const after = applyReward(state(), { kind: 'item', item: 'leftovers' }, 2);
    expect(after.backpack).toEqual(['leftovers']);
    expect(after.party.map((member) => member.item)).toEqual([undefined, undefined, undefined]);
  });

  it('teaches the move to the slot the player named', () => {
    const after = applyReward(state(), { kind: 'tm', move: 'Earthquake' }, 1);
    expect(after.party[1]!.spec.moves).toContain('Earthquake');
    expect(after.party[0]!.spec.moves).not.toContain('Earthquake');
  });

  /*
   * Stage 4.5.1: this test asserted the rule that this stage retires.
   *
   * It was called "destroys the item that was already held, with no inventory
   * to catch it", and there is an inventory to catch it now. The Stage 3 note
   * gated the reversal on there being a party to spread items across; there is
   * one, so the rule is gone rather than flagged off, and the assertion is
   * inverted rather than removed — nothing is destroyed except by an explicit
   * discard.
   */
  it('no longer destroys a held item: an item card cannot displace anything', () => {
    const before = state();
    const holding = { ...before, party: before.party.map((m, i) => (i === 0 ? giveItem(m, 'lifeorb').member : m)) };
    const after = applyReward(holding, { kind: 'item', item: 'leftovers' }, 0);

    expect(after.party[0]!.item).toBe('lifeorb');
    expect(after.backpack).toEqual(['leftovers']);
  });

  it('falls back to the lead rather than crashing on a fainted target', () => {
    // A member can faint in the fight that paid the card. A run ended by its
    // own reward screen would be a worse failure than the move moving.
    //
    // Stage 4.5.1: demonstrated with a TM rather than an item, because items
    // are no longer targeted and so can no longer name a fainted slot at all.
    // The fallback still has to hold for the cards that *are* targeted.
    const before = state();
    const withDead = {
      ...before,
      party: before.party.map((m, i) => (i === 1 ? { ...m, hp: 0, fainted: true } : m)),
    };
    const after = applyReward(withDead, { kind: 'tm', move: 'Earthquake' }, 1);
    expect(after.party[0]!.spec.moves).toContain('Earthquake');
    expect(after.party[1]!.spec.moves).not.toContain('Earthquake');
  });

  it('leaves untargeted rewards party-wide', () => {
    const before = { ...state(), currency: 0 };
    expect(applyReward(before, { kind: 'currency', amount: 40 }, 2).currency).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// Whole runs
// ---------------------------------------------------------------------------

/** A policy that fills the party, releases at full, and targets deliberately. */
function collector(): RunPolicy & { readonly taken: number; readonly released: number } {
  let taken = 0;
  let released = 0;
  /*
   * The greedy AI, not a `move 1` bot.
   *
   * A run has to actually *win* a wild node before it is ever offered a
   * Pokemon, and at Stage 4's team sizes a policy that always picks slot one
   * dies in the first segment — the acquisition assertions below then pass
   * vacuously or fail for a reason that has nothing to do with acquisition.
   */
  const base = scriptedRunPolicy(greedyAiPolicy);
  return {
    ...base,
    /*
     * Walks into wild nodes when offered one.
     *
     * `scriptedRunPolicy` takes option 0 at every step, and the first cut of
     * this test inherited that — so the runs it produced fought almost no wild
     * encounters, were offered almost no Pokemon, and the acquisition
     * assertions failed for a reason that had nothing to do with acquisition.
     * A wild node is where an encounter offer comes from, so a test about
     * acquisition has to actually go to one.
     */
    chooseNode: async (options) => {
      const wild = options.findIndex((option) => option.kind === 'wild');
      return wild === -1 ? 0 : wild;
    },
    // The last slot, so a target that was ignored shows up as slot 0 holding
    // everything.
    chooseMoveRecipient: async (_offer, party) => party.length - 1,
    chooseMoveToReplace: async (member, incoming) => defaultMoveReplacement(member, incoming),
    chooseAcquisition: async (_offer, party) => {
      taken++;
      if (party.length < PARTY_SIZE) return { kind: 'accept' };
      released++;
      return { kind: 'release', slot: party.length - 1 };
    },
    get taken() {
      return taken;
    },
    get released() {
      return released;
    },
  };
}

describe('a whole run that acquires', () => {
  it('fills the party and never exceeds PARTY_SIZE at any point', async () => {
    let peak = 0;
    const run = await playRun('PARTY-D2', collector(), DEFAULT_TUNING, {
      onState: (state) => {
        peak = Math.max(peak, state.party.length);
      },
    });

    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(PARTY_SIZE);
    expect(run.state.party.length).toBeLessThanOrEqual(PARTY_SIZE);
  });

  it('records the target and the acquisition as decisions of their own', async () => {
    const run = await playRun('PARTY-D2', collector());
    const kinds = run.log.decisions.map((decision) => decision.kind);

    expect(kinds).toContain('acquisition');
    for (const decision of run.log.decisions) {
      if (decision.kind === 'acquisition') {
        expect(['decline', 'accept', 'release']).toContain(decision.decision.kind);
      }
      if (decision.kind === 'target') expect(typeof decision.index).toBe('number');
    }
  });

  it('replays a run that acquired, released and targeted to the same party', async () => {
    const original = await playRun('PARTY-D2', collector());
    const replayed = await replayRun(original.log);

    expect(replayed.outcome).toBe(original.outcome);
    expect(replayed.state.party.map((m) => [m.spec.species, m.hp, m.item])).toEqual(
      original.state.party.map((m) => [m.spec.species, m.hp, m.item]),
    );
    expect(replayed.log.decisions).toEqual(original.log.decisions);
  });

  it('offers an acquisition from the one route there is', async () => {
    /*
     * This asserted *both* routes — a wild node's offer and a `species` reward
     * card — because the point of `acquisitionOffered` was that two sources
     * produced one decision. Stage 4.6b deleted the card, so the assertion is
     * now that the encounter route is the only one, which is the property worth
     * holding: a second path to a party member is a second set of rules for
     * what a joined Pokemon is.
     */
    const sources = new Set<string>();
    for (let index = 0; index < 12; index++) {
      const state = createRun(`SOURCES-${index}`);
      for (const segment of state.segments) {
        for (const node of nodesOf(segment)) {
          if (node.acquisition) sources.add(node.acquisition.source);
        }
      }
    }
    expect([...sources]).toEqual(['encounter']);
  });
});

describe('a fainted member does not leave the party', () => {
  it('keeps the slot and revives into it', () => {
    const before = { ...chooseStarter(createRun('FAINT'), 0), party: partyOf(2) };
    const dead = before.party.map((m, i) => (i === 0 ? { ...m, hp: 0, fainted: true } : m));
    const node = before.segments[0]!.routes[0]!.steps[0]!.options[0]!;

    const after = resolveNode(before, {
      node,
      battle: { result: { winner: 'p1', turns: 6, cause: 'faint' }, party: dead },
    });

    expect(after.outcome).toBe(null);
    expect(after.party).toHaveLength(2);
    expect(after.party[0]!.fainted).toBe(false);
    expect(after.party[0]!.hp).toBeGreaterThan(0);
    expect(after.party[0]!.hp).toBeLessThan(after.party[0]!.maxHp);
  });
});

describe('the version guard', () => {
  it('refuses a Stage 3 log by name rather than replaying it as something else', () => {
    const stale: RunLog = {
      seed: 'STAGE3',
      version: 'gymrun-run-5/gymrun-0.1.0',
      randomizerVersion: 'gymrun-randomizer-4',
      decisions: [],
    };
    // Thrown synchronously, before `playRun` is entered: `replayRunPolicy`
    // asserts on construction, so the refusal arrives before a single decision
    // is reconstructed rather than partway through a run that never happened.
    expect(() => replayRun(stale)).toThrow(/gymrun-run-5\/gymrun-0\.1\.0/);
    // Against the constant rather than a literal. The property is "the message
    // names the build doing the refusing", not "the build is version 7" — and
    // pinning the number here means every future bump breaks a test about
    // something else, which is how a guard gets edited without being thought
    // about. Line 462 below already does it this way.
    expect(() => replayRun(stale)).toThrow(
      new RegExp(`this build replays ${RUN_LOG_VERSION.replace(/[.\\/]/g, '\\$&')}`),
    );
  });

  /*
   * Stage 4.5.1's own break, asserted separately from Stage 3's.
   *
   * A Stage 4.5 log is the *near* miss — one version back, same engine string —
   * and it is the one a player is actually holding, so it gets its own case
   * rather than being folded into the paragraph above. It must be refused by
   * name and not "mostly replayed": every decision in it is individually valid,
   * the sequence is simply one `items` entry short at every node boundary and
   * one `target` entry long at every item card.
   */
  it('refuses a Stage 4.5 log by name, naming both versions', () => {
    const stale: RunLog = {
      seed: 'STAGE45',
      version: 'gymrun-run-6/gymrun-0.2.0',
      randomizerVersion: RANDOMIZER_VERSION,
      decisions: [],
    };
    expect(() => replayRun(stale)).toThrow(/gymrun-run-6\/gymrun-0\.2\.0/);
    expect(() => replayRun(stale)).toThrow(
      new RegExp(`this build replays ${RUN_LOG_VERSION.replace(/[.\\/]/g, '\\$&')}`),
    );
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('acquisition draws stay on the rewards stream', () => {
  /*
   * The Stage 4 half of the invariant every stage has asserted.
   *
   * An encounter offer is one roll per wild node. If it came off `randomizer`
   * — which is where a species is normally rolled, and therefore the plausible
   * mistake — every encounter in the map would shift when the rate table moved.
   * If it came off `map`, the shape of the map would change; off `battle`, the
   * damage rolls would.
   */
  function positions(rate: number): Record<string, number> {
    const rng = createRng('ACQ-STREAMS');
    // The rate itself is data, so it is moved by moving the tier a node carries
    // rather than by editing the table: an all-elite map rolls the same *number*
    // of acquisition checks at a different success rate.
    const tuning = withTuning({
      tierBands: [{ throughSegment: 7, weights: { normal: 1, hard: 1, elite: rate } }],
    });
    generateStarterOptions(rng, tuning);
    for (let index = 0; index < SEGMENTS_PER_RUN; index++) generateSegment(index, rng, tuning);
    return {
      // Sub-stream totals: since 4.6a nothing draws off the unkeyed sequence.
      map: rng.map.totalDraws,
      randomizer: rng.randomizer.totalDraws,
      battle: rng.battle.totalDraws,
      rewards: rng.rewards.totalDraws,
    };
  }

  it('offers a capture at every wild node, and spends no draw doing it', () => {
    /*
     * **The Stage 4.6a inversion.** This test used to assert the opposite
     * property — exactly one *roll* per wild node, whether or not the offer
     * appeared — because the rate was keyed to tier and a check that only
     * rolled when it might succeed would have made the draw count depend on the
     * tier table.
     *
     * There is no rate now. A capture roll on a seeded run is a punch with no
     * counterplay, so capture is guaranteed and the cost lives where the player
     * can see it: the wild encounter occupies one of the segment's limited
     * steps. What is left to assert is that the offer is universal and free.
     */
    const rng = createRng('ACQ-COUNT');
    generateStarterOptions(rng, DEFAULT_TUNING);
    const segment = generateSegment(0, rng, DEFAULT_TUNING);

    const wilds = nodesOf(segment).filter((node) => node.kind === 'wild');
    expect(wilds.length).toBeGreaterThan(0);
    for (const node of wilds) {
      expect(node.acquisition, `${node.id} offered no capture`).not.toBeNull();
    }

    // And turning captures off is now free of side effects, which it could not
    // be while a roll existed to skip: the two maps are identical apart from
    // the offers themselves.
    const shape = (tuning: typeof DEFAULT_TUNING): string =>
      JSON.stringify(
        createRun('ACQ-COUNT', tuning).segments.map((seg) =>
          nodesOf(seg).map((node) => [node.id, node.kind, node.tier, node.encounter?.team ?? null]),
        ),
      );
    expect(shape(withTuning({ allowEncounterAcquisitions: false }))).toEqual(shape(DEFAULT_TUNING));
  });

  it('reproduces the identical map, encounters and battles for a fixed seed, twice', () => {
    expect(positions(1)).toEqual(positions(1));
  });

  it('puts every acquisition offer on one node the same way for one seed', () => {
    const offers = (): string[] => {
      const state = createRun('ACQ-STABLE');
      return state.segments.flatMap((segment) =>
        nodesOf(segment)
          .filter((node) => node.acquisition)
          .map((node) => `${node.id}:${node.acquisition?.spec.species}@${node.acquisition?.spec.level}`),
      );
    };
    expect(offers()).toEqual(offers());
    expect(offers().length).toBeGreaterThan(0);
  });

  it('offers the species the node actually fields, exactly as it was fought', () => {
    /*
     * "The defeated species", literally: the offer is the node's own lead, not
     * a fresh roll. A second generation path would be a second set of rules for
     * what a wild Pokemon is, and the first divergence between them would be
     * invisible.
     *
     * **At its own level from Stage 4.6a**, where it used to arrive re-levelled
     * down to `joinLevelFor(segment)`. The discount was the price of a free
     * Pokemon; the price is now the step the encounter occupies and the party
     * slot it takes, and a caught Pokemon weaker than the one just beaten is a
     * readout the player cannot square with what they watched.
     */
    const state = createRun('ACQ-SAME');
    let checked = 0;
    for (const segment of state.segments) {
      for (const node of nodesOf(segment)) {
        if (!node.acquisition) continue;
        const lead = node.encounter?.team[0];
        checked++;
        expect(node.acquisition.spec.species).toBe(lead?.species);
        expect(node.acquisition.spec.ability).toBe(lead?.ability);
        expect(node.acquisition.spec.moves).toEqual(lead?.moves);
        expect(node.acquisition.spec.level).toBe(lead?.level);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('save during a forced switch', () => {
  /*
   * **The boundary most likely to be wrong in this stage.**
   *
   * A forced switch is a decision recorded mid-battle, in the middle of a turn
   * the sim has not finished resolving, while the *other* side may be sitting
   * on a `wait`. A save taken there and resumed has to re-enter the battle at
   * exactly that point — not at the start of the turn, and not after it.
   */
  it('resumes from the save taken at every forced switch to an identical run', async () => {
    const saves: RunLog[] = [];
    const original = await playRun('FORCED-4', collector(), DEFAULT_TUNING, {
      onDecision: (log) => saves.push(JSON.parse(JSON.stringify(log)) as RunLog),
    });

    // The saves whose last decision is a switch: those are the ones taken
    // during a forced switch or immediately after a voluntary one.
    const atSwitch = saves.filter((save) => {
      const last = save.decisions.at(-1);
      return last?.kind === 'battle' && last.choice.kind === 'switch';
    });
    expect(atSwitch.length, 'this seed never switched, so it proves nothing').toBeGreaterThan(0);

    for (const [index, save] of atSwitch.entries()) {
      const resumed = await resumeRun(save, collector());
      expect(resumed.outcome, `resuming from switch save ${index}`).toBe(original.outcome);
      expect(resumed.log.decisions, `resuming from switch save ${index}`).toEqual(original.log.decisions);
      expect(
        resumed.state.party.map((member) => [member.spec.species, member.hp]),
        `resuming from switch save ${index}`,
      ).toEqual(original.state.party.map((member) => [member.spec.species, member.hp]));
    }
  });

  it('replays the whole run to the same state, switches and all', async () => {
    const original = await playRun('FORCED-4', collector());
    const replayed = await replayRun(original.log);

    const switches = original.log.decisions.filter(
      (decision) => decision.kind === 'battle' && decision.choice.kind === 'switch',
    );
    expect(switches.length).toBeGreaterThan(0);
    expect(replayed.state.party).toEqual(original.state.party);
    expect(replayed.state.history.map((visit) => visit.hpAfter)).toEqual(
      original.state.history.map((visit) => visit.hpAfter),
    );
  });
});

// ---------------------------------------------------------------------------
// The headless deliverable
// ---------------------------------------------------------------------------

describe('a full eight-gym run, headless', () => {
  /**
   * A scripted policy that does every Stage 4 thing there is to do.
   *
   * Walks into wild nodes (where captures come from), rests when hurt, fills
   * the party and then churns it, and targets the last member so a mis-wired
   * target shows up as slot 0 holding everything.
   */
  function everything(): RunPolicy {
    return {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseNode: async (options, state) => {
        const hp = state.party.reduce((total, member) => total + member.hp, 0);
        const max = state.party.reduce((total, member) => total + member.maxHp, 0);
        if (max > 0 && hp / max < 0.7) {
          const rest = options.findIndex((option) => option.kind === 'rest');
          if (rest !== -1) return rest;
        }
        const wild = options.findIndex((option) => option.kind === 'wild');
        return wild === -1 ? 0 : wild;
      },
      chooseMoveRecipient: async (_offer, party) => party.length - 1,
      chooseMoveToReplace: async (member, incoming) => defaultMoveReplacement(member, incoming),
      chooseAcquisition: async (_offer, party) =>
        hasRoom(party) ? { kind: 'accept' } : { kind: 'release', slot: party.length - 1 },
    };
  }

  /**
   * **A run that is *made* to reach the eighth gym, rather than a seed that
   * happens to.**
   *
   * This pinned `WINNING_SEED`, found by scanning, on the argument that a test
   * which plays until it loses proves `playRun` terminates and does not prove
   * the victory branch of `resolveNode` runs or that seven levellings and eight
   * segment heals compose.
   *
   * The argument was right and the mechanism was wrong. A seed only wins while
   * the *difficulty curve* lets it, so a mechanism test was pinned to a balance
   * number: three rescans in two stages, and then Stage 4.6b's mid-stage
   * trough, where no seed in six hundred wins because move banding has landed
   * and the reward ramp that climbs it has not. At that point the test was
   * asking a balance question and reporting it as a broken mechanism.
   *
   * So it is split in two. A **unit test** drives the victory transition
   * directly: a run standing at the last gym, a won battle, `resolveNode`, and
   * the assertion that the run ends in victory. And an **integration run**,
   * given a short segment and a conceding opponent, walks as deep as it can and
   * asserts everything that composes along the way — seven levellings, the
   * segment heals, the acquisitions and releases, and that the whole thing
   * replays.
   *
   * Neither can tell you whether the game is winnable. `npm run sim` is what
   * tells you that, and it is the thing that should.
   */
  const VICTORY_TUNING = withTuning({ stepsPerSegment: { min: 1, max: 1 } });

  /** An opponent that never attacks, so the run's *transitions* are the subject. */
  const pacifist: Policy = async (view) => {
    const usable = view.forceSwitch
      ? view.switches.find((option) => option.usable)?.slot
      : undefined;
    if (view.forceSwitch) return switchChoice(usable ?? 1);
    const weakest = [...view.moves]
      .filter((move) => move.usable)
      .sort((a, b) => a.basePower - b.basePower)[0];
    return moveChoice(weakest?.slot ?? 1);
  };

  const victoryRun = (): Promise<RunResult> =>
    playRun('WIN-MECHANISM', everything(), VICTORY_TUNING, { opponent: pacifist });

  it('reaches the last gym, levelling and healing all the way, acquiring and releasing', async () => {
    expect(typeof globalThis.document).toBe('undefined');

    const run = await victoryRun();
    const decisions = run.log.decisions;
    const acquisitions = decisions.filter((decision) => decision.kind === 'acquisition');
    const releases = acquisitions.filter(
      (decision) => decision.kind === 'acquisition' && decision.decision.kind === 'release',
    );

    // Seven cleared gyms is seven levellings and seven segment heals composed,
    // which is the thing that only happens on a run that goes the distance.
    expect(gymsCleared(run.state)).toBe(SEGMENTS_PER_RUN - 1);
    expect(run.state.currentSegment).toBe(SEGMENTS_PER_RUN - 1);
    expect(run.state.party[0]?.spec.level).toBe(playerLevel(SEGMENTS_PER_RUN - 1));
    expect(acquisitions.length, 'never acquired').toBeGreaterThan(0);
    expect(releases.length, 'never released').toBeGreaterThan(0);
    expect(run.state.party.length).toBe(PARTY_SIZE);
  });

  it('ends in victory when the last gym falls', () => {
    /*
     * The victory transition, driven directly.
     *
     * Every other way of reaching it goes through eight fights and therefore
     * through the difficulty curve, which is how this became a balance test
     * wearing a mechanism test's clothes. `resolveNode` is the transition;
     * this is it, with a won gym at the last segment and nothing else.
     */
    const start = chooseLocale(chooseStarter(createRun('WIN-TRANSITION'), 0), 0);
    const last: RunState = {
      ...start,
      currentSegment: SEGMENTS_PER_RUN - 1,
      localeChoices: start.localeChoices.map(() => 0),
      position: 0,
    };
    const gym = last.segments[SEGMENTS_PER_RUN - 1]!.gym;
    const after = resolveNode({ ...last, position: stepsOf(last).length }, {
      node: gym,
      battle: { result: { winner: 'p1', turns: 4, cause: 'faint' }, party: last.party },
    });

    expect(after.outcome).toBe('victory');
    expect(gymsCleared(after)).toBe(1);
    // And the run does *not* advance past the last segment: there is nowhere
    // to advance to, and a state pointing at segment 8 would throw on the
    // first thing that read it.
    expect(after.currentSegment).toBe(SEGMENTS_PER_RUN - 1);
  });

  it('produces an identical run from the same seed and decisions, twice', async () => {
    // The property everything else rests on, asserted on a run that switches:
    // a switch consumes battle-stream rolls a move does not, so a seed that
    // reproduced before Stage 4 could stop reproducing now without anything
    // else failing.
    const first = await victoryRun();
    const second = await victoryRun();

    expect(second.log.decisions).toEqual(first.log.decisions);
    expect(second.outcome).toBe(first.outcome);
    expect(second.state.party).toEqual(first.state.party);
    expect(second.state.history.map((visit) => [visit.node.id, visit.hpAfter, visit.result])).toEqual(
      first.state.history.map((visit) => [visit.node.id, visit.hpAfter, visit.result]),
    );
  });

  it('replays that run from its log to the same party, gym for gym', async () => {
    const original = await victoryRun();
    const replayed = await replayRun(original.log, VICTORY_TUNING, { opponent: pacifist });

    expect(replayed.outcome).toBe(original.outcome);
    expect(replayed.state.party).toEqual(original.state.party);
    expect(replayed.log.decisions).toEqual(original.log.decisions);
  });
});
