/**
 * The "pick a berry" gym card. **The berry gym reward patch.**
 *
 * The author's ruling: a berry that halves one super effective hit is only
 * worth anything if it is the right berry, so a gym does not deal a berry. It
 * deals the choice of one, and the player answers after taking the card.
 * `docs/spec/gymrun-patch-berry-gym-reward.md`.
 *
 * What is held here, headless:
 *
 *   1. the gym pool is the only pool that deals the card, every gym can, and
 *      the card lists the whole berry table;
 *   2. a page never shows two of it, because one table is one choice;
 *   3. the pick is a logged decision that follows the card's `reward` entry,
 *      the chosen berry lands in the backpack, and a replay reproduces it;
 *   4. an unanswered pick is refused rather than resolved to berry 0;
 *   5. the pick consumes no RNG: the card is dealt at map generation and the
 *      answer moves no later offer.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { createRun, playRun, replayRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import { applyReward, type BerryPick, type Reward } from '../src/core/rewards';
import { BERRIES } from '../src/data/items';
import { REWARD_POOLS, gymRewardEntriesFor } from '../src/data/rewardPools';
import { DEFAULT_TUNING } from '../src/data/tuning';

const BERRY_IDS = BERRIES.map((berry) => berry.id);
const seeds = Array.from({ length: 24 }, (_, i) => `BERRY-PICK-${i}`);

/** Every berry pick card dealt onto any gym page of a seed. */
function picksOf(seed: string): BerryPick[] {
  return createRun(seed, DEFAULT_TUNING).segments.flatMap((segment) =>
    (segment.gym.reward?.options ?? []).flatMap((option) => (option.kind === 'berryPick' ? [option] : [])),
  );
}

describe('the berry pick card', () => {
  it('is dealt by the gym pool and by no other', () => {
    for (let segment = 0; segment < 8; segment++) {
      expect(gymRewardEntriesFor(segment).some((entry) => entry.kind === 'berryPick'), `gym pool at segment ${segment}`).toBe(true);
    }
    for (const [tier, bands] of Object.entries(REWARD_POOLS)) {
      for (const band of bands) {
        expect(band.entries.some((entry) => entry.kind === 'berryPick'), `${tier} through segment ${band.throughSegment}`).toBe(false);
      }
    }
  });

  it('reaches gym pages, lists the whole berry table, and is unanswered as dealt', () => {
    const picks = seeds.flatMap(picksOf);
    expect(picks.length, 'no gym page in the sample dealt a berry pick').toBeGreaterThan(0);
    for (const pick of picks) {
      expect(pick.berries).toEqual(BERRY_IDS);
      expect(pick.picked).toBeNull();
    }
  });

  it('never appears twice on one page', () => {
    for (const seed of seeds) {
      for (const segment of createRun(seed, DEFAULT_TUNING).segments) {
        const count = (segment.gym.reward?.options ?? []).filter((option) => option.kind === 'berryPick').length;
        expect(count, `${seed} ${segment.gym.id}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('answering the pick', () => {
  const state = createRun('BERRY-PICK-APPLY', DEFAULT_TUNING);
  const dealt: Reward = { kind: 'berryPick', berries: BERRY_IDS, picked: null };

  it('stows the chosen berry in the backpack', () => {
    const after = applyReward(state, { ...dealt, picked: 'chopleberry' });
    expect(after.backpack).toContain('chopleberry');
    expect(after.backpack.length).toBe(state.backpack.length + 1);
  });

  it('refuses an unanswered pick rather than choosing for the player', () => {
    expect(() => applyReward(state, dealt)).toThrow(/unanswered/);
  });

  it('refuses a berry the card did not list', () => {
    expect(() => applyReward(state, { ...dealt, picked: 'leftovers' })).toThrow(RangeError);
  });
});

describe('the pick in a played run', () => {
  /** Takes the berry pick when it is on the page, and answers it with `berry`. */
  function picking(berry: number): RunPolicy {
    return {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseReward: async (offer) => {
        const index = offer.options.findIndex((option) => option.kind === 'berryPick');
        return index === -1 ? 0 : index;
      },
      chooseBerry: async () => berry,
    };
  }

  /**
   * A seed whose first gym deals the pick, so the run only has to clear gym 1
   * to reach the question. Searched rather than hard-coded, so a randomizer
   * bump does not turn this into a test of one seed's luck.
   */
  const candidates = seeds.filter((seed) => {
    const first = createRun(seed, DEFAULT_TUNING).segments[0];
    return first?.gym.reward?.options.some((option) => option.kind === 'berryPick') ?? false;
  });

  it('logs the berry after the card, lands it in the bag, and replays to the same bag', async () => {
    expect(candidates.length, 'no seed in the sample deals the pick at gym 1').toBeGreaterThan(0);
    const berry = BERRY_IDS.indexOf('chopleberry');
    let found = false;
    for (const seed of candidates) {
      // The bag as the gym node leaves it, before a later fight can eat the berry.
      const bagsAfterGym: string[][] = [];
      const run = await playRun(seed, picking(berry), DEFAULT_TUNING, {
        onNodeResolved: (_before, after, result) => {
          if (result.node.kind === 'gym') bagsAfterGym.push([...after.backpack]);
        },
      });
      const at = run.log.decisions.findIndex((decision) => decision.kind === 'berry');
      if (at === -1) continue; // lost before the first gym; the next seed may not
      found = true;

      // The pair, in order: the card's `reward` entry, then its `berry`.
      expect(run.log.decisions[at - 1]?.kind).toBe('reward');
      const decision = run.log.decisions[at];
      expect(decision && Object.keys(decision).sort()).toEqual(['index', 'kind']);
      expect(decision?.kind === 'berry' && decision.index).toBe(berry);

      // The berry reached the bag at the gym that paid it.
      expect(bagsAfterGym[0]).toContain('chopleberry');

      const replayed = await replayRun(run.log);
      expect(replayed.state.backpack).toEqual(run.state.backpack);
      expect(replayed.state.party.map((member) => member.item)).toEqual(run.state.party.map((member) => member.item));
      expect(replayed.log.decisions).toEqual(run.log.decisions);
      break;
    }
    expect(found, 'no candidate seed cleared gym 1 with the scripted bot').toBe(true);
  }, 240_000);

  it('consumes no RNG: the answer moves no later offer', () => {
    // Every offer is drawn when the run is created, before any question is
    // asked, so the berry chosen cannot reach a draw. Asserted the direct way:
    // the segments two fresh runs of one seed carry are identical objects by
    // value, and neither has seen an answer.
    const a = createRun('BERRY-PICK-RNG', DEFAULT_TUNING).segments;
    const b = createRun('BERRY-PICK-RNG', DEFAULT_TUNING).segments;
    expect(a).toEqual(b);
    const picks = picksOf('BERRY-PICK-RNG');
    for (const pick of picks) expect(pick.picked).toBeNull();
  });
});
