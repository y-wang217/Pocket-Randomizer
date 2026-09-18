/**
 * "Every offer is exactly 3 distinct options." **The invariant, as a test.**
 *
 * `CLAUDE.md` has said this since Stage 3 and nothing asserted the hard half of
 * it. `test/rewards.test.ts` checks that an offer has three cards and that no
 * two are the same *entry*; what it could not see is two entries resolving to
 * the same decision, which is what the R19 playtest photographed.
 *
 * Three defects were behind it, and each gets its own assertion here:
 *
 *   1. **Fungible kinds.** 159 coins against 150 coins is one card printed
 *      twice. Measured at 26.3% of gym pages, plus 5.4% showing three, because
 *      the gym page draws with replacement over what was a two-entry pool.
 *   2. **Duplicate relics.** A relic card drew a fresh shuffle and consulted
 *      nothing, so 11.3% of gym pages offered the same relic twice — against a
 *      comment in the same file claiming it could not happen.
 *   3. **The relic fallback.** It drew from the pool's non-relic entries with
 *      no knowledge of the table, so it could land on a coin or a heal card
 *      already dealt. 8.8% of elite offers, once every relic was held.
 *
 * The assertions are written against *what the player sees* — post
 * `resolveOffer`, at every relic count a run can be at — because that is where
 * the defect was visible and a generation-only check would have missed the
 * third one entirely.
 */
import { describe, expect, it } from 'vitest';

import {
  generateGymRewardOffer,
  generateRewardOffer,
  resolveOffer,
  type Reward,
  type RewardOffer,
} from '../src/core/rewards';
import { createRng } from '../src/core/rng';
import { gymRewardKey, nodeRewardKey } from '../src/core/streamKeys';
import type { Tier } from '../src/core/types';
import { RELIC_IDS } from '../src/data/relics';
import { gymRewardEntriesFor } from '../src/data/rewardPools';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { SEGMENT_COUNT } from '../src/data/scaling';

const TIERS: readonly Tier[] = ['normal', 'hard', 'elite'];

/**
 * What makes two cards the same decision.
 *
 * A coin card is its kind and nothing else — the amount is the part that does
 * not matter, which is the whole reason two of them is a defect. A heal is its
 * kind for the same reason: two different fractions are still two heals, and
 * two identical ones is worse. Everything else is identified by its payload,
 * because a Leftovers against a Charcoal is a real choice.
 */
function decisionOf(reward: Reward): string {
  switch (reward.kind) {
    case 'currency':
    case 'heal':
      return reward.kind;
    case 'item':
      return `item:${reward.item}`;
    case 'relic':
      return `relic:${reward.relic}`;
    default:
      return `${reward.kind}:${reward.move}`;
  }
}

function distinct(offer: RewardOffer): boolean {
  const seen = offer.options.map(decisionOf);
  return new Set(seen).size === seen.length;
}

/** Every relic count a run can pass through, ends included. */
const RELIC_COUNTS = [0, 1, 3, 6, 9, RELIC_IDS.length];

describe('every offer is three distinct options', () => {
  it('holds for a gym clear, on both pages, at every relic count', () => {
    for (const held of RELIC_COUNTS) {
      const relics = RELIC_IDS.slice(0, held);
      for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
        for (let s = 0; s < 250; s++) {
          const stream = createRng(`GYM-DISTINCT-${s}`).rewards.at(gymRewardKey(segment));
          const { offer, moveOffer } = generateGymRewardOffer(
            `gym-${segment}`,
            segment,
            stream,
            DEFAULT_TUNING,
          );
          for (const page of [moveOffer, offer]) {
            expect(page.options).toHaveLength(3);
            expect(
              distinct(resolveOffer(page, relics)),
              `gym ${segment + 1} seed ${s} holding ${held}: ${page.options.map(decisionOf).join(', ')}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('holds for a node offer at every tier, segment and relic count', () => {
    for (const held of RELIC_COUNTS) {
      const relics = RELIC_IDS.slice(0, held);
      for (const tier of TIERS) {
        for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
          for (let s = 0; s < 120; s++) {
            const stream = createRng(`NODE-DISTINCT-${s}`).rewards.at(
              nodeRewardKey(`n-${segment}-${s}`, 'offer'),
            );
            const offer = generateRewardOffer(`n-${s}`, tier, segment, stream, DEFAULT_TUNING);
            expect(offer.options).toHaveLength(3);
            expect(
              distinct(resolveOffer(offer, relics)),
              `${tier} seg ${segment} seed ${s} holding ${held}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  /*
   * The specific pair the playtest photographed, named so a regression reads as
   * the bug rather than as an abstract invariant failure.
   */
  it('never puts two coin cards on a gym page, the reported defect', () => {
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      for (let s = 0; s < 400; s++) {
        const stream = createRng(`GYM-COINS-${s}`).rewards.at(gymRewardKey(segment));
        const { offer } = generateGymRewardOffer(`gym-${segment}`, segment, stream, DEFAULT_TUNING);
        for (const held of [0, RELIC_IDS.length]) {
          const seen = resolveOffer(offer, RELIC_IDS.slice(0, held));
          const coins = seen.options.filter((o) => o.kind === 'currency');
          expect(coins.length, `gym ${segment + 1} seed ${s} holding ${held}`).toBeLessThan(2);
        }
      }
    }
  });

  /*
   * The gym pool needs a third kind for `drawable` to have somewhere to send a
   * refused currency draw. Two entries and a with-replacement draw is the
   * configuration that produced the bug, so the pool's shape is the thing to
   * pin, not just the outcome.
   */
  it('gives the gym pool a third kind to land on, at every segment', () => {
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      const kinds = new Set(gymRewardEntriesFor(segment).map((entry) => entry.kind));
      expect(kinds.size, `gym ${segment + 1} pool has ${kinds.size} kinds`).toBeGreaterThan(2);
      expect(kinds.has('item'), `gym ${segment + 1} pays no item`).toBe(true);
    }
  });

  /*
   * A relic card's fallback is what a run that has collected everything is paid
   * instead. It must never be a kind that can duplicate, which is a stronger
   * statement than "these offers happen to be fine" and is cheap to check
   * directly.
   */
  it('never lets a relic fall back onto a fungible kind', () => {
    for (const tier of TIERS) {
      for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
        for (let s = 0; s < 150; s++) {
          const stream = createRng(`FALLBACK-${s}`).rewards.at(
            nodeRewardKey(`f-${segment}-${s}`, 'offer'),
          );
          const offer = generateRewardOffer(`f-${s}`, tier, segment, stream, DEFAULT_TUNING);
          for (const option of offer.options) {
            if (option.kind !== 'relic') continue;
            expect(
              ['currency', 'heal'].includes(option.fallback.kind),
              `${tier} seg ${segment} fell back to ${option.fallback.kind}`,
            ).toBe(false);
          }
        }
      }
    }
  });

  /*
   * `resolveOffer` is documented as idempotent and the R19 fix threads state
   * through it, which is exactly the kind of change that quietly breaks that.
   */
  it('still resolves to itself on a second pass', () => {
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      for (let s = 0; s < 200; s++) {
        const stream = createRng(`IDEM-${s}`).rewards.at(gymRewardKey(segment));
        const { offer } = generateGymRewardOffer(`gym-${segment}`, segment, stream, DEFAULT_TUNING);
        for (const held of [0, 4, RELIC_IDS.length]) {
          const relics = RELIC_IDS.slice(0, held);
          const once = resolveOffer(offer, relics);
          const twice = resolveOffer(once, relics);
          expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
        }
      }
    }
  });
});
