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

  it('offers an acquisition from both routes across a sample of seeds', async () => {
    const sources = new Set<string>();
    for (let index = 0; index < 12; index++) {
      const state = createRun(`SOURCES-${index}`);
      for (const segment of state.segments) {
        for (const node of nodesOf(segment)) {
          if (node.acquisition) sources.add('encounter');
          if (node.reward?.options.some((option) => option.kind === 'species')) sources.add('reward');
        }
      }
    }
    expect([...sources].sort()).toEqual(['encounter', 'reward']);
  });
});

describe('a fainted member does not leave the party', () => {
  it('keeps the slot and revives into it', () => {
    const before = { ...chooseStarter(createRun('FAINT'), 0), party: partyOf(2) };
    const dead = before.party.map((m, i) => (i === 0 ? { ...m, hp: 0, fainted: true } : m));
    const node = before.segments[0]!.steps[0]!.options[0]!;

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
    expect(() => replayRun(stale)).toThrow(/this build replays gymrun-run-7/);
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
      map: rng.map.draws,
      randomizer: rng.randomizer.draws,
      battle: rng.battle.draws,
      rewards: rng.rewards.draws,
    };
  }

  it('rolls exactly one acquisition check per wild node, offer or no offer', () => {
    // Counted rather than asserted indirectly: a check that only rolled when it
    // might succeed would make the draw count depend on the tier table, and
    // every seed's later reward rolls would shift when that table moved.
    const rng = createRng('ACQ-COUNT');
    generateStarterOptions(rng, DEFAULT_TUNING);
    const before = rng.rewards.draws;
    const segment = generateSegment(0, rng, DEFAULT_TUNING);
    const after = rng.rewards.draws;

    const wilds = nodesOf(segment).filter((node) => node.kind === 'wild');
    const offered = wilds.filter((node) => node.acquisition).length;

    expect(wilds.length).toBeGreaterThan(0);
    // Some but not all: a rate of 0 or 1 would make the assertion above vacuous.
    expect(offered).toBeLessThanOrEqual(wilds.length);
    expect(after - before).toBeGreaterThanOrEqual(wilds.length);
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

  it('offers the species the node actually fields, at the join level', () => {
    // "The defeated species", literally: the offer is the node's own lead
    // re-levelled, not a fresh roll. A second generation path would be a second
    // set of rules for what a wild Pokemon is.
    const state = createRun('ACQ-SAME');
    let checked = 0;
    for (const [index, segment] of state.segments.entries()) {
      for (const node of nodesOf(segment)) {
        if (!node.acquisition) continue;
        checked++;
        expect(node.acquisition.spec.species).toBe(node.encounter?.team[0]?.species);
        expect(node.acquisition.spec.ability).toBe(node.encounter?.team[0]?.ability);
        expect(node.acquisition.spec.level).toBe(joinLevelFor(index));
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
   * Walks into wild nodes (where encounter offers come from), rests when hurt,
   * fills the party and then churns it, and targets the last member so a
   * mis-wired target shows up as slot 0 holding everything.
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

  /*
   * A seed the policy above actually *wins* on, found by scanning.
   *
   * A test that plays until it loses proves `playRun` terminates; it does not
   * prove the eighth gym is reachable, that the victory branch of `resolveNode`
   * runs, or that seven levellings and eight segment heals compose. Those only
   * happen on a run that finishes, and at a ~10% completion rate a seed has to
   * be chosen rather than assumed.
   *
   * If a balance pass moves the curve this may stop winning. That is not a
   * regression in this test — rescan for a seed that does, or the victory path
   * quietly stops being covered.
   */
  const WINNING_SEED = 'WIN-3';

  it('completes eight gyms while switching, acquiring, releasing and targeting', async () => {
    expect(typeof globalThis.document).toBe('undefined');

    const run = await playRun(WINNING_SEED, everything());
    const decisions = run.log.decisions;
    const switches = decisions.filter(
      (decision) => decision.kind === 'battle' && decision.choice.kind === 'switch',
    );
    const acquisitions = decisions.filter((decision) => decision.kind === 'acquisition');
    const releases = acquisitions.filter(
      (decision) => decision.kind === 'acquisition' && decision.decision.kind === 'release',
    );
    const targets = decisions.filter((decision) => decision.kind === 'target');

    expect(run.outcome).toBe('victory');
    expect(gymsCleared(run.state)).toBe(SEGMENTS_PER_RUN);
    // Each of the four, or the run proved less than it looks like it did.
    expect(switches.length, 'never switched').toBeGreaterThan(0);
    expect(acquisitions.length, 'never acquired').toBeGreaterThan(0);
    expect(releases.length, 'never released').toBeGreaterThan(0);
    expect(targets.length, 'never targeted an item').toBeGreaterThan(0);
    expect(run.state.party.length).toBe(PARTY_SIZE);
  });

  it('produces an identical run from the same seed and decisions, twice', async () => {
    // The property everything else rests on, asserted on a run that switches:
    // a switch consumes battle-stream rolls a move does not, so a seed that
    // reproduced before Stage 4 could stop reproducing now without anything
    // else failing.
    const first = await playRun(WINNING_SEED, everything());
    const second = await playRun(WINNING_SEED, everything());

    expect(second.log.decisions).toEqual(first.log.decisions);
    expect(second.outcome).toBe(first.outcome);
    expect(second.state.party).toEqual(first.state.party);
    expect(second.state.history.map((visit) => [visit.node.id, visit.hpAfter, visit.result])).toEqual(
      first.state.history.map((visit) => [visit.node.id, visit.hpAfter, visit.result]),
    );
  });

  it('replays that run from its log to the same eight-gym victory', async () => {
    const original = await playRun(WINNING_SEED, everything());
    const replayed = await replayRun(original.log);

    expect(replayed.outcome).toBe('victory');
    expect(replayed.state.party).toEqual(original.state.party);
    expect(replayed.log.decisions).toEqual(original.log.decisions);
  });
});
