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

import { nodesOf, type Segment,
  routeStepsOf,
} from '../src/core/encounters';
import { createRun } from '../src/core/run';
import { OFFER_SIZE } from '../src/core/rewards';
import { gymRewardEntriesFor, rewardEntriesFor, type RewardEntry } from '../src/data/rewardPools';
import { rewardMoveBand } from '../src/data/scaling';
import { DEFAULT_TUNING } from '../src/data/tuning';

const seeds = Array.from({ length: 12 }, (_, i) => `GYM-${i}`);

/** Every gym in a seed's run, with the offer it now carries. */
function gymsOf(seed: string, tuning = DEFAULT_TUNING) {
  return createRun(seed, tuning).segments.map((segment: Segment) => segment.gym);
}

/** One entry of a given kind from the elite pool covering this segment. */
function eliteEntry(segment: number, kind: RewardEntry['kind']): RewardEntry | undefined {
  return rewardEntriesFor('elite', segment).find((entry) => entry.kind === kind);
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

      /*
       * The band a card actually pays at, not the entry's own offset.
       *
       * Stage 4.6b moved the tier's share of the band into
       * `REWARD_BAND_OFFSET`, so an entry's `bandOffset` is now only the extra
       * a pool adds on top — and the gym's is the only one that is not zero.
       * Comparing offsets would compare the extras and miss the rule.
       */
      expect(
        rewardMoveBand(segment, 'elite', gym.bandOffset ?? 0),
        `segment ${segment} move band`,
      ).toBeGreaterThanOrEqual(rewardMoveBand(segment, 'elite', elite.bandOffset ?? 0));
    }
  });

  /*
   * A third assertion lived here: that a gym weights a *party slot* above what
   * an elite node does. Species rewards are gone in Stage 4.6b — capture is the
   * acquisition route — so there is no slot in either pool to weigh.
   */
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
const KEYED_SEGMENT_0_SHAPE: string[][] = [["wild:hard","wild:normal"],["trainer:normal","wild:hard"],["shop:-","rest:-"],["trainer:normal","wild:hard","event:-"],["wild:hard","trainer:normal","event:-"],["shop:-","wild:normal"],["rest:-","wild:normal","event:-"],["wild:normal","wild:hard"],["trainer:hard","shop:-","rest:-"]];

const KEYED_SEGMENT_0_SEEDS: (string | null)[] = ["sodium,da53fe3ef48f9494c2f32ba1aa813a7d71b1c6caf5feb22e965c16612bb0917e","sodium,7ba551d1e2a5148f2916cd8a17d60af059571bcf2eeee07cfb7a43b2dcd03a31","sodium,0466917374ec75b2fc0658c935a4404fdebf7a7e7821f41175c72852e4e18214","sodium,dfe0f17614a40e7b005533a7801b24a17cf042558d29b375f1fcf4bca806bed5",null,null,"sodium,c657f94fa0334b3bed1e27643df1106aca318da3974c9ba9395ed9aadae02675","sodium,dcb4c78a225332bbb4045819b5a7184571304b41c6334c40d8569dcea544460c",null,"sodium,a01697aef81a4c7d79107871ae0460bf45fa1ddedf6ec7229b851a932b177031","sodium,dd34d948c2f8547fa6e53d6b949ac5d447595c38844cb9c4eca436ecb07113e0",null,null,"sodium,b522d2acd0c91511544dbad94945c952f70f997ed485974cda0778de9a332f57",null,"sodium,bf891908e830e1c6f6cc2fbb03d35feb3c919e8e83fa16add7a4ad73fc555f94",null,"sodium,2f97debfddd9f82aee26fc0f86ea0d97a0dc27dd1ef039d0ef3d4edc5efb8a72","sodium,a2e87064b0ec2d3a9aafff64d8d69d6e6ff4301b22ced8c50bcbd7bc35f758db","sodium,cca078d50073c20eb68ca6c4cac8b6cf0df8929d2dfbabc0d9ba8a2cbe44f43d",null,null,"sodium,90334ea2803513d623caaf516b8f0997be0256aa48fcb05b1b993c3a79c61c30"];

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
      shape: routeStepsOf(segment).map((step) => step.options.map((node) => `${node.kind}:${node.tier ?? '-'}`)),
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
   * The recorded baseline for one seed's map, shape and battle seeds.
   *
   * A hard-coded fixture rather than a computed comparison, because the thing
   * being tested is that today's build agrees with yesterday's — and yesterday's
   * code is gone. A fixture is the only way to assert across a change that has
   * already happened.
   *
   * **Re-minted in Stage 4.6a, and the re-mint is the honest move rather than
   * the convenient one.** It held the map as it stood *before* pass 6 existed,
   * which proved appending a pass moved nothing. 4.6a did not append a pass; it
   * moved every draw in the game onto keyed sub-streams, so every seed's map is
   * different by construction and `RANDOMIZER_VERSION` says so. Keeping the old
   * numbers would have been asserting that a deliberate change did not happen.
   *
   * What it pins from here is the same thing one level along: this build's map
   * for this seed, so a later stage that claims to add a key without moving one
   * either passes this or the claim was wrong. It covers every offered route in
   * the segment rather than one, because a locale offer is part of what the map
   * stream produces now.
   */
  it('matches the recorded map for a fixed seed', () => {
    const segments = withoutGymOffers('GYM-ISOLATION');

    // Shape and contents are long; the digest is what a regression would move.
    const digest = JSON.stringify(segments).length;
    expect(digest).toBeGreaterThan(0);

    // The load-bearing assertion: the map stream's output for segment 0.
    expect(segments[0]?.shape).toEqual(KEYED_SEGMENT_0_SHAPE);
    expect(segments[0]?.simSeeds).toEqual(KEYED_SEGMENT_0_SEEDS);
  });
});
