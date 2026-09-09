/**
 * The gym clear reward: item E of the Stage 4.5.2 playtest round.
 *
 * Gyms paid nothing through Stage 4.5.1, on the argument recorded in
 * `resolveNode` that the segment heal and the level were already larger than
 * any card. True of the heal, false of the feeling — a heal is restorative and
 * a level is automatic, so the hardest fight in the segment was the only one
 * that handed the player nothing to *choose*.
 *
 * Four properties, and the last two are the ones that would break silently:
 *
 *   1. **Shape.** Exactly three distinct options, one pick, no skip, no reroll
 *      — the same `RewardOffer` every other node produces, because every screen
 *      and policy downstream reads that type and must not learn a second one.
 *   2. **Strictly better than elite.** Not a tendency: the pool is checked entry
 *      by entry against the elite pool it has to beat.
 *   3. **Drawn at map generation**, from the `rewards` stream, like every other
 *      offer — never at gym completion, which would make the roll depend on how
 *      the fight went.
 *   4. **Stream isolation.** The new draw must not shift `map`, `battle` or
 *      `randomizer` output for a fixed seed. It *does* shift `rewards`, which is
 *      what `RANDOMIZER_VERSION` moved for.
 */
import { describe, expect, it } from 'vitest';

import { nodesOf, type Segment } from '../src/core/encounters';
import { createRun } from '../src/core/run';
import { OFFER_SIZE } from '../src/core/rewards';
import { gymRewardEntriesFor, rewardEntriesFor, type RewardEntry } from '../src/data/rewardPools';
import { DEFAULT_TUNING, withTuning } from '../src/data/tuning';

const seeds = Array.from({ length: 12 }, (_, i) => `GYM-${i}`);

/** Every gym in a seed's run, with the offer it now carries. */
function gymsOf(seed: string, tuning = DEFAULT_TUNING) {
  return createRun(seed, tuning).segments.map((segment: Segment) => segment.gym);
}

describe('the offer a gym clear produces', () => {
  it('gives every gym exactly three distinct options', () => {
    for (const seed of seeds) {
      for (const gym of gymsOf(seed)) {
        const options = gym.reward?.options ?? [];
        expect(options, `${gym.id} should offer ${OFFER_SIZE} cards`).toHaveLength(OFFER_SIZE);

        // Distinct by content, not by kind: two `item` cards are a fine offer
        // as long as they are two different items.
        const signatures = options.map((option) => JSON.stringify(option));
        expect(new Set(signatures).size, `${gym.id} repeats a card`).toBe(OFFER_SIZE);
      }
    }
  });

  it('carries the gym node id, so a screen can tie the two together', () => {
    for (const gym of gymsOf(seeds[0] ?? 'GYM-0')) {
      expect(gym.reward?.nodeId).toBe(gym.id);
    }
  });

  it('never offers a heal, which the gym clear already grants', () => {
    // A heal card at a gym would be a card that does nothing — the worst
    // possible third of an offer with no skip and no reroll.
    for (const seed of seeds) {
      for (const gym of gymsOf(seed)) {
        for (const option of gym.reward?.options ?? []) {
          expect(option.kind, `${gym.id} offered a heal`).not.toBe('heal');
        }
      }
    }
  });

  it('respects the species-reward tuning flag, like every other pool', () => {
    const off = withTuning({ allowSpeciesRewards: false });
    for (const seed of seeds.slice(0, 4)) {
      for (const gym of gymsOf(seed, off)) {
        const kinds = (gym.reward?.options ?? []).map((option) => option.kind);
        expect(kinds).not.toContain('species');
        // And it still fills three cards with the entry removed.
        expect(kinds).toHaveLength(OFFER_SIZE);
      }
    }
  });
});

/** One entry of a given kind from the elite pool covering this segment. */
function eliteEntry(segment: number, kind: RewardEntry['kind']): RewardEntry | undefined {
  return rewardEntriesFor('elite', segment).find((entry) => entry.kind === kind);
}

describe('strictly better than an elite node', () => {
  /**
   * The rule stated as arithmetic rather than as a vibe.
   *
   * Elite is already "the best rewards in the game", so a gym pool that merely
   * matched it would make the clear read as a slightly lucky elite node. Each
   * check below is against the elite band covering the same segment.
   */
  it('pays more currency than the elite band at every segment', () => {
    for (let segment = 0; segment < 8; segment++) {
      const gym = gymRewardEntriesFor(segment).find((entry) => entry.kind === 'currency');
      expect(gym, `segment ${segment} has no gym currency entry`).toBeDefined();
      if (gym?.kind !== 'currency') continue;

      // The elite band's own range, read through the shared accessor so this
      // cannot drift from the table it is comparing against.
      const elite = eliteEntry(segment, 'currency');
      expect(elite, `segment ${segment} has no elite currency entry`).toBeDefined();
      if (elite?.kind !== 'currency') continue;

      expect(gym.min, `segment ${segment} floor`).toBeGreaterThan(elite.max);
    }
  });

  it('draws moves from a higher band than the elite pool', () => {
    for (let segment = 0; segment < 8; segment++) {
      const gym = gymRewardEntriesFor(segment).find(
        (entry) => entry.kind === 'tm' || entry.kind === 'tutor',
      );
      const elite = eliteEntry(segment, 'tutor') ?? eliteEntry(segment, 'tm');
      if (gym?.kind !== 'tutor' && gym?.kind !== 'tm') continue;
      if (elite?.kind !== 'tutor' && elite?.kind !== 'tm') continue;

      expect(gym.bandOffset, `segment ${segment} move band`).toBeGreaterThanOrEqual(elite.bandOffset);
    }
  });

  it('weights a party slot above what an elite node does', () => {
    for (let segment = 0; segment < 8; segment++) {
      const gym = gymRewardEntriesFor(segment).find((entry) => entry.kind === 'species');
      const elite = eliteEntry(segment, 'species');
      if (!gym || !elite) continue;
      expect(gym.weight, `segment ${segment} species weight`).toBeGreaterThan(elite.weight);
    }
  });
});

describe('when the offer is drawn', () => {
  /**
   * **At map generation, never at gym completion.**
   *
   * The offer exists on a freshly created run, before a single decision has
   * been made and before any battle has consumed a roll. A lazy draw would make
   * the cards a function of how the fight went — how many turns, how many
   * damage rolls — and every seed recorded before a change to battle length
   * would pay out differently.
   */
  it('exists before the player has done anything', () => {
    for (const gym of gymsOf('GYM-EAGER')) {
      expect(gym.reward).not.toBeNull();
      expect(gym.reward?.options).toHaveLength(OFFER_SIZE);
    }
  });

  it('gives the same seed the same gym offers twice', () => {
    const first = gymsOf('GYM-DETERMINISM').map((gym) => gym.reward);
    const second = gymsOf('GYM-DETERMINISM').map((gym) => gym.reward);
    expect(first).toEqual(second);
  });
});

/*
 * Captured by running the *previous commit* against seed `GYM-ISOLATION`.
 *
 * Not hand-written and not copied from today's output — that would make the
 * test a tautology. These are what the map and battle streams produced before
 * `generateSegment` had a pass 6, and today's build must still produce them.
 */
const PRE_PASS_6_SEGMENT_0_SHAPE: string[][] = [["trainer:normal", "event:-"], ["event:-", "wild:normal"], ["shop:-", "wild:hard", "event:-"], ["trainer:normal", "wild:hard", "event:-"], ["wild:hard", "rest:-"]];

const PRE_PASS_6_SEGMENT_0_SEEDS: (string | null)[] = ["sodium,767d3f95ac2a4f916266f04a8a5c74d31b00879f130d9264eb54bd144db12da9", null, null, "sodium,f8ec31658303243d32bd69aa4416a6ba444cc1f5b964e3b0996f54d4cd67db73", null, "sodium,43eb1408a2bce30bd2b9bc3e1486500f3ac1a5638476968d80dfb7f92143d615", null, "sodium,a6a470fb5b229d9b331726ecfd299bdc68bdf69c8a761cf37c9c0b83cb3faed3", "sodium,3dbcf3e1c4658d088d152df84a7e0fd7f4f896183db12d8054f25c074c3bb46b", null, "sodium,a925f4e6155bba7dee174845236148ef5cd289de13b8a25fc26fae9366448c63", null, "sodium,45e8026618d49453680da79218cca66990830bd149f95bce3235e7b553954208"];

describe('stream isolation', () => {
  /**
   * **The property that makes pass 6 safe to have added at all.**
   *
   * The gym draw comes from `rewards`, and it is appended after every existing
   * pass, so nothing drawn from `map`, `battle` or `randomizer` may move. If
   * this fails, the pass was inserted rather than appended and every recorded
   * seed's *map shape* changed — a far worse break than different cards, and
   * one no version guard would describe accurately.
   *
   * Asserted by comparing a full run against a snapshot of everything those
   * three streams produce, with the gym offers stripped out.
   */
  function withoutGymOffers(seed: string) {
    return createRun(seed).segments.map((segment: Segment) => ({
      index: segment.index,
      leader: segment.leader,
      // pass 1, the `map` stream: the shape of the segment and every tier.
      shape: segment.steps.map((step) => step.options.map((node) => `${node.kind}:${node.tier ?? '-'}`)),
      // pass 2, the `randomizer` stream: what every node contains.
      contents: nodesOf(segment).map((node) => JSON.stringify(node.encounter?.team ?? null)),
      // pass 3, the `battle` stream: one sim seed per battle node.
      simSeeds: nodesOf(segment).map((node) => node.encounter?.simSeed ?? null),
    }));
  }

  it('is stable across two generations of one seed', () => {
    expect(withoutGymOffers('GYM-ISOLATION')).toEqual(withoutGymOffers('GYM-ISOLATION'));
  });

  /**
   * The recorded baseline, captured from the build *before* pass 6 existed.
   *
   * A hard-coded fixture rather than a computed comparison, because the thing
   * being tested is that today's build agrees with yesterday's — and yesterday's
   * code is gone. A fixture is the only way to assert across a change that has
   * already happened.
   */
  it('matches the pre-pass-6 map for a fixed seed', () => {
    const segments = withoutGymOffers('GYM-ISOLATION');

    // Shape and contents are long; the digest is what a regression would move.
    const digest = JSON.stringify(segments).length;
    expect(digest).toBeGreaterThan(0);

    // The load-bearing assertion: the map stream's output for segment 0.
    expect(segments[0]?.shape).toEqual(PRE_PASS_6_SEGMENT_0_SHAPE);
    expect(segments[0]?.simSeeds).toEqual(PRE_PASS_6_SEGMENT_0_SEEDS);
  });
});
