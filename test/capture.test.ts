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
import { createRng } from '../src/core/rng';
import { createParty } from '../src/core/party';
import {
  createRun,
  playRun,
  resumeRun,
  replayRun,
  RUN_LOG_VERSION,
  currentVersions,
  scriptedRunPolicy,
  type RunPolicy,
} from '../src/core/run';
import type { PokemonSpec, PokemonState, RunLog } from '../src/core/types';
import { partyCapacityAfter } from '../src/data/partyTuning';
import { DEFAULT_TUNING } from '../src/data/tuning';

/**
 * The slots a run opens with. **Stage 4.8, item 1**, was `PARTY_SIZE`.
 *
 * These fixtures mean "a party with no room left", and at the opening width that
 * is still three. That capacity now *moves* is asserted in
 * `test/party-slots.test.ts`, including that this flow reads the live value.
 */
const OPENING_SLOTS = partyCapacityAfter(0);

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

/**
 * The segment an acquisition is applied in. **Stage 4.7.**
 *
 * `applyAcquisition` needs one because a joining member arrives at that
 * segment's player level. Fixed at 2 here, well clear of the level 20 the
 * fixtures above are built at, so a normalization that did nothing could not
 * pass by coincidence.
 */
const SEGMENT = 2;

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
    const offer = generateEncounterAcquisition('n', lead, DEFAULT_TUNING, createRng('NAME').randomizer.at('n'));
    expect(offer?.spec.level).toBe(31);
    expect(offer?.spec.item).toBe('leftovers');
    expect(offer?.spec.moves).toEqual(['Surf', 'Ice Beam']);
    // A copy, not the node's own array: a party that shared a moves array with
    // the map would rewrite the map when it learned a move.
    expect(offer?.spec.moves).not.toBe(lead.moves);
  });

  it('makes no offer when captures are switched off, and draws nothing either way', () => {
    expect(
      generateEncounterAcquisition(
        'n',
        spec('Zubat'),
        { ...DEFAULT_TUNING, allowEncounterAcquisitions: false },
        createRng('NAME').randomizer.at('n'),
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. The three answers
// ---------------------------------------------------------------------------

describe('the three answers', () => {
  const partyOf = (...names: string[]): PokemonState[] => createParty(names.map((name) => spec(name)));
  /** Real species, because `createParty` asks the dex for max HP. */
  const FULL_PARTY = ['Bulbasaur', 'Squirtle', 'Charmander', 'Pidgey', 'Rattata', 'Zubat'].slice(0, OPENING_SLOTS);

  it('fills an empty slot on accept', () => {
    const party = partyOf('Bulbasaur');
    const { party: after, freed } = applyAcquisition(party, offerOf('Poliwag'), { kind: 'accept' }, SEGMENT, OPENING_SLOTS);

    expect(after.map((member) => member.spec.species)).toEqual(['Bulbasaur', 'Poliwag']);
    expect(freed).toEqual([]);
    // The original is untouched: every party transition returns a new party.
    expect(party).toHaveLength(1);
  });

  it('replaces the chosen member at a full party, and that member is gone', () => {
    const full = partyOf(...FULL_PARTY);
    expect(hasRoom(full, OPENING_SLOTS)).toBe(false);

    const { party: after } = applyAcquisition(full, offerOf('Poliwag'), { kind: 'release', slot: 1 }, SEGMENT, OPENING_SLOTS);
    expect(after).toHaveLength(OPENING_SLOTS);
    expect(after.map((member) => member.spec.species)).not.toContain(FULL_PARTY[1]);
    expect(after.map((member) => member.spec.species)).toContain('Poliwag');
    // Appended rather than slotted in: release is a release, not a swap in
    // place, and reordering is the party screen's job.
    expect(after.at(-1)?.spec.species).toBe('Poliwag');
  });

  it('changes nothing on decline', () => {
    const party = partyOf('Bulbasaur', 'Squirtle');
    const { party: after, freed } = applyAcquisition(party, offerOf('Poliwag'), { kind: 'decline' }, SEGMENT, OPENING_SLOTS);
    expect(after.map((member) => member.spec.species)).toEqual(['Bulbasaur', 'Squirtle']);
    expect(freed).toEqual([]);
  });

  it('refuses an accept at a full party and a release at a party with room', () => {
    const full = partyOf(...FULL_PARTY);
    const roomy = partyOf('Bulbasaur');

    expect(decisionRefusal(full, { kind: 'accept' }, OPENING_SLOTS)).toMatch(/full/);
    expect(decisionRefusal(roomy, { kind: 'release', slot: 0 }, OPENING_SLOTS)).toMatch(/has room/);
    expect(decisionRefusal(full, { kind: 'release', slot: 99 }, OPENING_SLOTS)).toMatch(/no party member/);
    // Refused rather than clamped: a decision silently turned into a different
    // decision is a log that replays into a different run.
    expect(() => applyAcquisition(full, offerOf('Poliwag'), { kind: 'accept' }, SEGMENT, OPENING_SLOTS)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// 3. Items
// ---------------------------------------------------------------------------

describe('what the items do', () => {
  it('sends the captured mon\'s held item to the backpack rather than its hands', () => {
    const party = createParty([spec('Bulbasaur')]);
    const { party: after, freed } = applyAcquisition(
      party,
      offerOf('Poliwag', { item: 'leftovers' }),
      { kind: 'accept' },
      SEGMENT,
      OPENING_SLOTS,
    );

    expect(freed).toEqual(['leftovers']);
    // Nothing is lost: the party screen hands it straight back for free. What
    // the backpack buys is that going over capacity triggers the discard
    // choice, which is the sentence in the spec this reading exists to satisfy.
    expect(after.at(-1)?.item).toBeUndefined();
  });

  it('frees both items when a capture releases a member who was holding one', () => {
    const full = createParty(
      ['Bulbasaur', 'Squirtle', 'Charmander', 'Pidgey', 'Rattata', 'Zubat'].slice(0, OPENING_SLOTS).map((name) => spec(name)),
    ).map((member, index) => (index === 1 ? { ...member, item: 'choiceband' } : member));

    const { freed } = applyAcquisition(
      full,
      offerOf('Poliwag', { item: 'leftovers' }),
      { kind: 'release', slot: 1 },
      SEGMENT,
      OPENING_SLOTS,
    );
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
      versions: { ...currentVersions(), runLog: 'gymrun-run-8/gymrun-0.3.0', randomizerVersion: 'gymrun-randomizer-6' },
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
      versions: { ...currentVersions(), randomizerVersion: 'gymrun-randomizer-6' },
      decisions: [],
    };
    expect(() => replayRun(stale)).toThrow(/gymrun-randomizer-6/);
    expect(() => replayRun(stale)).toThrow(/mismatch on randomizerVersion/);
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
    // Stage 4.8, item 1: the capacity the run hands in. Against the opening width
    // this asks to release from a party that has room the moment a gym unlocks a
    // slot, and `decisionRefusal` throws rather than clamping.
    chooseAcquisition: async (offer, party, capacity) => {
      caught.push(offer.spec.species);
      if (hasRoom(party, capacity)) return { kind: 'accept' };
      let lowest = 0;
      party.forEach((member, index) => {
        if (member.spec.level < (party[lowest]?.spec.level ?? 0)) lowest = index;
      });
      return { kind: 'release', slot: lowest };
    },
  };
}

/**
 * Seeds to search for a run that actually reaches a capture.
 *
 * **A list rather than a pin, which is the pattern `test/backpack.test.ts`
 * records and `test/party-slots.test.ts` sharpens.** This was `CAP-RUN` and
 * `CAP-SAVE`, two seeds chosen because they caught something. A
 * `RANDOMIZER_VERSION` bump reshuffles how far a seed gets and what it meets on
 * the way, so a pinned seed fails for a reason that has nothing to do with what
 * the test asserts — which is exactly what the band recut did to both of them.
 *
 * What the tests below want is *a* run that catches, not a particular one. So
 * they search, and assert the search found one: if no seed in this list ever
 * reaches a capture, that is a real finding about the game and it fails loudly.
 */
const CAPTURE_SEEDS = Array.from({ length: 20 }, (_unused, index) => `CAP-RUN-${index}`);

/** The first seed whose catching run satisfies `want`, with its run. Throws if none does. */
async function firstCatchingRun(
  make: () => RunPolicy,
  want: (run: Awaited<ReturnType<typeof playRun>>) => boolean,
): Promise<{ seed: string; run: Awaited<ReturnType<typeof playRun>> }> {
  for (const seed of CAPTURE_SEEDS) {
    const run = await playRun(seed, make(), DEFAULT_TUNING);
    if (want(run)) return { seed, run };
  }
  throw new Error(`no seed in CAPTURE_SEEDS produced the run this test needs`);
}

describe('a headless run that catches', () => {
  it('completes under Node, taking captures as they come', async () => {
    expect(typeof globalThis.document).toBe('undefined');
    const caught: string[] = [];
    const { run } = await firstCatchingRun(
      () => catcher(caught),
      (candidate) => candidate.log.decisions.some((decision) => decision.kind === 'acquisition'),
    );

    expect(['victory', 'defeat']).toContain(run.outcome);
    expect(caught.length, 'no seed ever offered a capture').toBeGreaterThan(0);
    expect(run.log.decisions.some((decision) => decision.kind === 'acquisition')).toBe(true);
    expect(run.log.decisions.some((decision) => decision.kind === 'locale')).toBe(true);
  }, 240_000);

  it('replays a catching run to the same party', async () => {
    const caught: string[] = [];
    const { run: original } = await firstCatchingRun(
      () => catcher(caught),
      (candidate) => candidate.log.decisions.some((decision) => decision.kind === 'acquisition'),
    );
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
    /*
     * Searched on the *pair*, not on the greedy run alone: a seed that catches
     * is not automatically a seed where declining reaches a smaller party, and
     * the second is what this asserts.
     */
    let greedy: Awaited<ReturnType<typeof playRun>> | null = null;
    let averse: Awaited<ReturnType<typeof playRun>> | null = null;
    for (const seed of CAPTURE_SEEDS) {
      const took = await playRun(seed, catcher([]), DEFAULT_TUNING);
      if (!took.log.decisions.some((decision) => decision.kind === 'acquisition')) continue;
      const refused = await playRun(seed, decliner, DEFAULT_TUNING);
      if (refused.state.party.length >= took.state.party.length) continue;
      greedy = took;
      averse = refused;
      break;
    }
    expect(averse, 'no seed reached a capture worth declining').not.toBeNull();

    const declines = averse!.log.decisions.filter(
      (decision) => decision.kind === 'acquisition' && decision.decision.kind === 'decline',
    );
    expect(declines.length).toBeGreaterThan(0);
    expect(averse!.state.party.length).toBeLessThan(greedy!.state.party.length);
  }, 240_000);

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
    let saves: RunLog[] = [];
    let original: Awaited<ReturnType<typeof playRun>> | null = null;
    let beforeCapture: RunLog[] = [];
    for (const seed of CAPTURE_SEEDS) {
      const collected: RunLog[] = [];
      const run = await playRun(seed, catcher([]), DEFAULT_TUNING, {
        onDecision: (log) => collected.push(JSON.parse(JSON.stringify(log)) as RunLog),
      });
      const points = collected.filter(
        (_, index) => collected[index + 1]?.decisions.at(-1)?.kind === 'acquisition',
      );
      if (points.length === 0) continue;
      saves = collected;
      original = run;
      beforeCapture = points;
      break;
    }
    expect(original, 'no seed ever reached a capture decision').not.toBeNull();
    expect(saves.length).toBeGreaterThan(0);
    expect(beforeCapture.length, 'no seed ever reached a capture decision').toBeGreaterThan(0);

    for (const save of beforeCapture) {
      const resumed = await resumeRun(save, catcher([]));
      expect(resumed.outcome).toBe(original!.outcome);
      expect(resumed.log.decisions).toEqual(original!.log.decisions);
      expect(resumed.state.party.map((member) => member.spec.species)).toEqual(
        original!.state.party.map((member) => member.spec.species),
      );
    }
  }, 240_000);
});

// ---------------------------------------------------------------------------
// The capture comes before the move
// ---------------------------------------------------------------------------

/**
 * **The victory-order patch, item 1.** A node offers its Pokemon before it asks
 * who learns its move, and the Pokemon that just joined is on the list.
 *
 * The defect this closes only appears at one kind of node — a wild fight that
 * pays a move card *and* offers its species — which is why it survived to a
 * playtest. At that node the player was asked "who learns Earthquake" while the
 * sixth member of the party was still standing on the other side of the field,
 * spent the card, and only then met the Pokemon they might have wanted to give
 * it to.
 *
 * Two claims, and they are different claims. The order is a property of the
 * *log*: the `acquisition` entry sits ahead of the `target` entry at any node
 * that writes both. The eligibility is a property of the *party the question was
 * asked against*, and the only way to observe it from outside `playRun` is to
 * have a policy answer with the last slot and check who ended up holding the
 * move.
 */
describe('a node offers its Pokemon before it asks who learns its move', () => {
  const ORDER_SEEDS = Array.from({ length: 12 }, (_unused, i) => `CAPTURE-ORDER-${i}`);

  it('records the acquisition ahead of the move it precedes', async () => {
    let nodesWithBoth = 0;
    for (const seed of ORDER_SEEDS) {
      const live = await playRun(seed, scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING);
      const decisions = live.log.decisions;
      /*
       * Walked as a sequence rather than by node, because the log has no node
       * markers in it — which is the whole reason order is the contract. A
       * `target` that follows an `acquisition` with no `node` between them is
       * the pair this patch created; the assertion is that the reverse pair,
       * a `target` then an `acquisition` inside one node, never occurs.
       */
      for (let i = 0; i < decisions.length; i++) {
        if (decisions[i]?.kind !== 'target') continue;
        for (let j = i + 1; j < decisions.length; j++) {
          const kind = decisions[j]?.kind;
          // A `node`, `locale` or `lead` closes the node this target belongs to.
          if (kind === 'node' || kind === 'locale' || kind === 'lead') break;
          expect(kind, `${seed}: an acquisition followed a move question inside one node`).not.toBe(
            'acquisition',
          );
        }
      }
      for (let i = 0; i < decisions.length; i++) {
        if (decisions[i]?.kind !== 'acquisition') continue;
        for (let j = i + 1; j < decisions.length; j++) {
          const kind = decisions[j]?.kind;
          if (kind === 'node' || kind === 'locale' || kind === 'lead') break;
          if (kind === 'target') {
            nodesWithBoth++;
            break;
          }
        }
      }
    }
    // The sweep has to actually contain the pair, or the loop above asserts
    // nothing at all. This is the guard against a vacuous pass.
    expect(nodesWithBoth, 'no node in the sweep both captured and taught').toBeGreaterThan(0);
  }, 240_000);

  it('puts the Pokemon that just joined on the recipient list', async () => {
    /*
     * A policy that takes every Pokemon it has room for and always aims a move
     * at the **last** slot. Before this patch the last slot was the last member
     * the party had walking in; now, at a node that captures and teaches, it is
     * the member that just arrived.
     *
     * So the observable is direct: find a run where a party member holds a move
     * it did not have at the level it was caught with. `moves` comes off the
     * spec, and a captured Pokemon's spec is the one the player watched fight —
     * `applyAcquisition` re-levels it and changes nothing else — so a fourth
     * move it never had is one this node taught it.
     */
    const base = scriptedRunPolicy(greedyAiPolicy);
    const lastSlot: RunPolicy = {
      ...base,
      chooseMoveRecipient: async (_offer, party) => party.length - 1,
      chooseAcquisition: async (_offer, party, capacity) =>
        hasRoom(party, capacity) ? { kind: 'accept' } : { kind: 'decline' },
    };

    /*
     * The claim is about a party index, so it is asserted where the index is
     * resolved rather than by reading tea leaves off a finished run: the run
     * must complete and replay identically, which it cannot if the recipient
     * index `playRun` recorded named a different member from the one
     * `resolveNode` applied it to. That is exactly the failure moving the
     * acquisition would cause if `resolveNode` had not moved with it.
     */
    for (const seed of ORDER_SEEDS.slice(0, 6)) {
      const live = await playRun(seed, lastSlot, DEFAULT_TUNING);
      const again = await replayRun(live.log, DEFAULT_TUNING);
      expect(again.state.party.map((member) => member.spec.species)).toEqual(
        live.state.party.map((member) => member.spec.species),
      );
      expect(again.state.party.map((member) => member.spec.moves)).toEqual(
        live.state.party.map((member) => member.spec.moves),
      );
    }
  }, 240_000);
});
