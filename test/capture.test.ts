/**
 * Capture: the offer every won wild encounter makes, and what taking it costs.
 *
 * **Stage 4.6a, and the headline is a subtraction.** Through 4.5.2 a wild node
 * offered its species at a rate keyed to tier — 0.55 / 0.7 / 0.85 — rolled at
 * map generation off the `rewards` stream. That roll is gone. Capture is
 * offered on every wild victory, guaranteed, and the cost the rate used to
 * represent is now a cost the player can see: 4.6a guarantees exactly one wild
 * encounter per segment and it occupies one of that segment's limited steps.
 *
 * The decision itself is 4.5.1's, unchanged and deliberately so: decline,
 * accept into a free slot, or release a named member. The recipient-selection
 * shape is the same one a move reward uses, which is why this file asserts the
 * *rules* rather than a second flow.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import {
  applyAcquisition,
  decisionRefusal,
  generateEncounterAcquisition,
  hasRoom,
  type AcquisitionOffer,
} from '../src/core/acquisition';
import { nodesOf } from '../src/core/encounters';
import { createParty } from '../src/core/party';
import {
  createRun,
  playRun,
  resumeRun,
  replayRun,
  RUN_LOG_VERSION,
  scriptedRunPolicy,
  type RunPolicy,
} from '../src/core/run';
import type { PokemonSpec, PokemonState, RunLog } from '../src/core/types';
import { PARTY_SIZE } from '../src/data/partyTuning';
import { DEFAULT_TUNING } from '../src/data/tuning';

const spec = (species: string, extra: Partial<PokemonSpec> = {}): PokemonSpec => ({
  species,
  ability: 'Levitate',
  moves: ['Tackle', 'Growl'],
  level: 20,
  ...extra,
});

const offerOf = (species: string, extra: Partial<PokemonSpec> = {}): AcquisitionOffer => ({
  nodeId: 'n',
  source: 'encounter',
  spec: spec(species, extra),
});

// ---------------------------------------------------------------------------
// 1. The offer
// ---------------------------------------------------------------------------

describe('the offer', () => {
  it('appears on every wild node in a generated run', () => {
    let wilds = 0;
    for (const seed of ['CAP-0', 'CAP-1', 'CAP-2']) {
      for (const segment of createRun(seed).segments) {
        for (const node of nodesOf(segment)) {
          if (node.kind !== 'wild') continue;
          wilds++;
          expect(node.acquisition, `${seed} ${node.id}`).not.toBeNull();
          expect(node.acquisition?.source).toBe('encounter');
        }
      }
    }
    expect(wilds).toBeGreaterThan(50);
  });

  it('never appears on a trainer, a gym, a rest, a shop or an event', () => {
    for (const segment of createRun('CAP-KINDS').segments) {
      for (const node of nodesOf(segment)) {
        if (node.kind === 'wild') continue;
        expect(node.acquisition, `${node.id} (${node.kind})`).toBeNull();
      }
    }
  });

  it('carries the level, moveset and held item it was fought with', () => {
    const lead = spec('Poliwag', { level: 31, item: 'leftovers', moves: ['Surf', 'Ice Beam'] });
    const offer = generateEncounterAcquisition('n', lead, DEFAULT_TUNING);
    expect(offer?.spec.level).toBe(31);
    expect(offer?.spec.item).toBe('leftovers');
    expect(offer?.spec.moves).toEqual(['Surf', 'Ice Beam']);
    // A copy, not the node's own array: a party that shared a moves array with
    // the map would rewrite the map when it learned a move.
    expect(offer?.spec.moves).not.toBe(lead.moves);
  });

  it('makes no offer when captures are switched off, and draws nothing either way', () => {
    expect(generateEncounterAcquisition('n', spec('Zubat'), { ...DEFAULT_TUNING, allowEncounterAcquisitions: false })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. The three answers
// ---------------------------------------------------------------------------

describe('the three answers', () => {
  const partyOf = (...names: string[]): PokemonState[] => createParty(names.map((name) => spec(name)));
  /** Real species, because `createParty` asks the dex for max HP. */
  const FULL_PARTY = ['Bulbasaur', 'Squirtle', 'Charmander', 'Pidgey', 'Rattata', 'Zubat'].slice(0, PARTY_SIZE);

  it('fills an empty slot on accept', () => {
    const party = partyOf('Bulbasaur');
    const { party: after, freed } = applyAcquisition(party, offerOf('Poliwag'), { kind: 'accept' });

    expect(after.map((member) => member.spec.species)).toEqual(['Bulbasaur', 'Poliwag']);
    expect(freed).toEqual([]);
    // The original is untouched: every party transition returns a new party.
    expect(party).toHaveLength(1);
  });

  it('replaces the chosen member at a full party, and that member is gone', () => {
    const full = partyOf(...FULL_PARTY);
    expect(hasRoom(full)).toBe(false);

    const { party: after } = applyAcquisition(full, offerOf('Poliwag'), { kind: 'release', slot: 1 });
    expect(after).toHaveLength(PARTY_SIZE);
    expect(after.map((member) => member.spec.species)).not.toContain(FULL_PARTY[1]);
    expect(after.map((member) => member.spec.species)).toContain('Poliwag');
    // Appended rather than slotted in: release is a release, not a swap in
    // place, and reordering is the party screen's job.
    expect(after.at(-1)?.spec.species).toBe('Poliwag');
  });

  it('changes nothing on decline', () => {
    const party = partyOf('Bulbasaur', 'Squirtle');
    const { party: after, freed } = applyAcquisition(party, offerOf('Poliwag'), { kind: 'decline' });
    expect(after.map((member) => member.spec.species)).toEqual(['Bulbasaur', 'Squirtle']);
    expect(freed).toEqual([]);
  });

  it('refuses an accept at a full party and a release at a party with room', () => {
    const full = partyOf(...FULL_PARTY);
    const roomy = partyOf('Bulbasaur');

    expect(decisionRefusal(full, { kind: 'accept' })).toMatch(/full/);
    expect(decisionRefusal(roomy, { kind: 'release', slot: 0 })).toMatch(/has room/);
    expect(decisionRefusal(full, { kind: 'release', slot: 99 })).toMatch(/no party member/);
    // Refused rather than clamped: a decision silently turned into a different
    // decision is a log that replays into a different run.
    expect(() => applyAcquisition(full, offerOf('Poliwag'), { kind: 'accept' })).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// 3. Items
// ---------------------------------------------------------------------------

describe('what the items do', () => {
  it('sends the captured mon\'s held item to the backpack rather than its hands', () => {
    const party = createParty([spec('Bulbasaur')]);
    const { party: after, freed } = applyAcquisition(party, offerOf('Poliwag', { item: 'leftovers' }), {
      kind: 'accept',
    });

    expect(freed).toEqual(['leftovers']);
    // Nothing is lost: the party screen hands it straight back for free. What
    // the backpack buys is that going over capacity triggers the discard
    // choice, which is the sentence in the spec this reading exists to satisfy.
    expect(after.at(-1)?.item).toBeUndefined();
  });

  it('frees both items when a capture releases a member who was holding one', () => {
    const full = createParty(
      ['Bulbasaur', 'Squirtle', 'Charmander', 'Pidgey', 'Rattata', 'Zubat'].slice(0, PARTY_SIZE).map((name) => spec(name)),
    ).map((member, index) => (index === 1 ? { ...member, item: 'choiceband' } : member));

    const { freed } = applyAcquisition(full, offerOf('Poliwag', { item: 'leftovers' }), {
      kind: 'release',
      slot: 1,
    });
    expect([...freed].sort()).toEqual(['choiceband', 'leftovers']);
  });
});

// ---------------------------------------------------------------------------
// 4. The version guard
// ---------------------------------------------------------------------------

describe('the version guard', () => {
  /**
   * A 4.5.2 log is refused **by name**, and it has to be.
   *
   * Every decision in one is individually valid. What it is missing is a
   * `locale` entry at the top of every segment — the first question the run
   * asks — so a replay would read its starter pick as a starter pick, its first
   * node pick as a *locale* pick, and every entry after that as an answer to
   * the question before it. That reconstructs an entire run nobody played, on
   * the player's own seed, which is the failure the two guards exist to make
   * loud rather than silent.
   */
  it('refuses a Stage 4.5.2 log, naming both versions', () => {
    const stale: RunLog = {
      seed: 'STAGE452',
      version: 'gymrun-run-8/gymrun-0.3.0',
      randomizerVersion: 'gymrun-randomizer-6',
      decisions: [],
    };
    // Synchronous, deliberately: `replayRunPolicy` checks the stamp before
    // `playRun` is ever entered, so a bad log is refused before a run starts
    // rather than partway through one.
    expect(() => replayRun(stale)).toThrow(/gymrun-run-8/);
    expect(() => replayRun(stale)).toThrow(new RegExp(RUN_LOG_VERSION.replace(/[./]/g, '\\$&')));
  });

  it('refuses a log recorded before the streams were rekeyed', () => {
    // The other guard, and the other failure: the questions line up perfectly
    // and every answer means something else, because 4.6a moved every draw in
    // the game onto a different sequence.
    const stale: RunLog = {
      seed: 'REKEYED',
      version: RUN_LOG_VERSION,
      randomizerVersion: 'gymrun-randomizer-6',
      decisions: [],
    };
    expect(() => replayRun(stale)).toThrow(/gymrun-randomizer-6/);
    expect(() => replayRun(stale)).toThrow(/no longer produces the same run/);
  });
});

// ---------------------------------------------------------------------------
// 5. Headless, end to end
// ---------------------------------------------------------------------------

/** Catches whenever there is room, releases the lowest level when there is not. */
function catcher(caught: string[]): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseNode: async (options) => {
      const wild = options.findIndex((option) => option.kind === 'wild');
      return wild === -1 ? 0 : wild;
    },
    chooseAcquisition: async (offer, party) => {
      caught.push(offer.spec.species);
      if (hasRoom(party)) return { kind: 'accept' };
      let lowest = 0;
      party.forEach((member, index) => {
        if (member.spec.level < (party[lowest]?.spec.level ?? 0)) lowest = index;
      });
      return { kind: 'release', slot: lowest };
    },
  };
}

describe('a headless run that catches', () => {
  it('completes under Node, taking captures as they come', async () => {
    expect(typeof globalThis.document).toBe('undefined');
    const caught: string[] = [];
    const run = await playRun('CAP-RUN', catcher(caught));

    expect(['victory', 'defeat']).toContain(run.outcome);
    expect(caught.length, 'this seed never offered a capture').toBeGreaterThan(0);
    expect(run.log.decisions.some((decision) => decision.kind === 'acquisition')).toBe(true);
    expect(run.log.decisions.some((decision) => decision.kind === 'locale')).toBe(true);
  }, 120_000);

  it('replays a catching run to the same party', async () => {
    const caught: string[] = [];
    const original = await playRun('CAP-RUN', catcher(caught));
    const replayed = await replayRun(original.log);

    expect(replayed.outcome).toBe(original.outcome);
    expect(replayed.state.party.map((member) => member.spec.species)).toEqual(
      original.state.party.map((member) => member.spec.species),
    );
    expect(replayed.state.backpack).toEqual(original.state.backpack);
  }, 120_000);

  it('logs a decline and reaches a different party from the same seed', async () => {
    const decliner: RunPolicy = {
      ...catcher([]),
      chooseAcquisition: async () => ({ kind: 'decline' }),
    };
    const greedy = await playRun('CAP-RUN', catcher([]));
    const averse = await playRun('CAP-RUN', decliner);

    const declines = averse.log.decisions.filter(
      (decision) => decision.kind === 'acquisition' && decision.decision.kind === 'decline',
    );
    expect(declines.length).toBeGreaterThan(0);
    expect(averse.state.party.length).toBeLessThan(greedy.state.party.length);
  }, 120_000);

  it('resumes from the save taken between a wild victory and the capture decision', async () => {
    /*
     * The spec's test 7, and the boundary most likely to be wrong: the run has
     * folded a battle into the party and is waiting on a decision that will
     * change it again. A resume that reconstructed the party but not the
     * pending question would diverge silently.
     *
     * The saves taken *immediately before* an acquisition entry are exactly
     * those points. Note what sits between the last battle choice and the
     * capture question: the reward card, and possibly a recipient and a
     * displaced move slot. That is the whole reason this is asserted by walking
     * the log rather than by assuming the capture follows the fight directly.
     */
    const saves: RunLog[] = [];
    const original = await playRun('CAP-SAVE', catcher([]), DEFAULT_TUNING, {
      onDecision: (log) => saves.push(JSON.parse(JSON.stringify(log)) as RunLog),
    });

    const beforeCapture = saves.filter(
      (_, index) => saves[index + 1]?.decisions.at(-1)?.kind === 'acquisition',
    );
    expect(beforeCapture.length, 'this seed never reached a capture decision').toBeGreaterThan(0);

    for (const save of beforeCapture) {
      const resumed = await resumeRun(save, catcher([]));
      expect(resumed.outcome).toBe(original.outcome);
      expect(resumed.log.decisions).toEqual(original.log.decisions);
      expect(resumed.state.party.map((member) => member.spec.species)).toEqual(
        original.state.party.map((member) => member.spec.species),
      );
    }
  }, 120_000);
});
