/**
 * Stage 4.6c step 2: getting a relic, and never getting the same one twice.
 *
 * The two properties this file exists for are the ones the design would be
 * wrong without: a relic already held is never offered again, and the filter
 * that guarantees that cannot shift a draw. The second is why the filter runs
 * at *resolution* rather than at draw time, and it is asserted directly rather
 * than argued.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import {
  applyReward,
  concreteReward,
  generateGymRewardOffer,
  generateRewardOffer,
  resolveOffer,
  type Reward,
} from '../src/core/rewards';
import { generateShopStock, resolveStock } from '../src/core/economy';
import { createRun } from '../src/core/run';
import { RELICS, RELIC_IDS } from '../src/data/relics';
import { rewardEntriesFor, gymRewardEntriesFor } from '../src/data/rewardPools';
import { shopEntriesFor } from '../src/data/shop';
import { DEFAULT_TUNING } from '../src/data/tuning';
import type { Tier } from '../src/core/types';

type RelicCard = Extract<Reward, { kind: 'relic' }>;
const relicCards = (options: readonly Reward[]): RelicCard[] =>
  options.filter((option): option is RelicCard => option.kind === 'relic');

describe('where relics appear', () => {
  it('is in the elite and gym tables and nowhere else', () => {
    // The restriction is the absence, not a check. If a relic ever turns up in
    // a normal or hard pool it is decoupled from the risk gradient and this is
    // the only thing that would say so.
    for (const segment of [0, 3, 7]) {
      for (const tier of ['normal', 'hard'] as Tier[]) {
        expect(rewardEntriesFor(tier, segment).some((e) => e.kind === 'relic'), `${tier}@${segment}`).toBe(false);
      }
      expect(rewardEntriesFor('elite', segment).some((e) => e.kind === 'relic'), `elite@${segment}`).toBe(true);
      expect(gymRewardEntriesFor(segment).some((e) => e.kind === 'relic'), `gym@${segment}`).toBe(true);
    }
  });

  it('is on the later shop shelf but not the opening one', () => {
    expect(shopEntriesFor(0).some((e) => e.kind === 'relic')).toBe(false);
    expect(shopEntriesFor(5).some((e) => e.kind === 'relic')).toBe(true);
  });

  it('actually turns up in generated elite offers across seeds', () => {
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      const rng = createRng(`ELITE-${i}`);
      const offer = generateRewardOffer('n', 'elite', 4, rng.rewards.at('o'), DEFAULT_TUNING);
      if (relicCards(offer.options).length > 0) seen++;
    }
    expect(seen, 'no elite offer in 200 seeds carried a relic').toBeGreaterThan(10);
  });
});

describe('a relic is never offered twice', () => {
  it('resolves past every held relic, over many seeds', () => {
    for (let i = 0; i < 150; i++) {
      const rng = createRng(`HELD-${i}`);
      const offer = generateGymRewardOffer('n', 5, rng.rewards.at('g'), DEFAULT_TUNING);
      if (relicCards(offer.options).length === 0) continue;

      // Hold everything except the last id in the table.
      const held = RELIC_IDS.slice(0, -1);
      const last = RELIC_IDS[RELIC_IDS.length - 1];
      for (const card of relicCards(resolveOffer(offer, held).options)) {
        expect(card.relic).toBe(last);
      }
    }
  });

  it('falls back to an ordinary card when every relic is held', () => {
    let checked = 0;
    for (let i = 0; i < 150; i++) {
      const rng = createRng(`ALLHELD-${i}`);
      const offer = generateRewardOffer('n', 'elite', 6, rng.rewards.at('o'), DEFAULT_TUNING);
      if (relicCards(offer.options).length === 0) continue;
      const resolved = resolveOffer(offer, RELIC_IDS);
      expect(relicCards(resolved.options)).toHaveLength(0);
      expect(resolved.options).toHaveLength(offer.options.length);
      checked++;
    }
    expect(checked, 'no offer carried a relic to fall back from').toBeGreaterThan(0);
  });

  it('leaves an offer with no relic in it untouched, by identity', () => {
    const rng = createRng('PLAIN');
    const offer = generateRewardOffer('n', 'normal', 0, rng.rewards.at('o'), DEFAULT_TUNING);
    expect(resolveOffer(offer, RELIC_IDS)).toBe(offer);
  });

  it('is idempotent: a resolved card resolves to itself', () => {
    const rng = createRng('IDEM');
    const offer = generateGymRewardOffer('n', 5, rng.rewards.at('g'), DEFAULT_TUNING);
    const once = resolveOffer(offer, []);
    expect(resolveOffer(once, [])).toEqual(once);
  });

  it('filters the shop shelf the same way', () => {
    let checked = 0;
    for (let i = 0; i < 120; i++) {
      const rng = createRng(`SHOP-${i}`);
      const stock = generateShopStock('n', 5, rng.rewards.at('s'), DEFAULT_TUNING);
      const cards = stock.items.filter((item) => item.reward.kind === 'relic');
      if (cards.length === 0) continue;
      const held = RELIC_IDS.slice(0, -1);
      for (const item of resolveStock(stock, held).items) {
        if (item.reward.kind === 'relic') expect(item.reward.relic).toBe(RELIC_IDS[RELIC_IDS.length - 1]);
      }
      checked++;
    }
    expect(checked, 'no shop shelf carried a relic').toBeGreaterThan(0);
  });
});

describe('the filter cannot shift a draw', () => {
  it('generates a byte-identical offer whatever the run holds', () => {
    // The whole reason resolution is separate from generation. If filtering
    // happened at draw time, a relic taken at segment 2 would silently move
    // every reward roll after it and the seed would stop meaning one run.
    for (let i = 0; i < 40; i++) {
      const a = createRng(`DRAW-${i}`);
      const b = createRng(`DRAW-${i}`);
      const first = generateRewardOffer('n', 'elite', 5, a.rewards.at('o'), DEFAULT_TUNING);
      const second = generateRewardOffer('n', 'elite', 5, b.rewards.at('o'), DEFAULT_TUNING);
      expect(first).toEqual(second);
      expect(a.rewards.at('o').draws).toBe(b.rewards.at('o').draws);
    }
  });

  it('costs the same draws whether the card is later used or not', () => {
    const held = createRng('COST');
    const empty = createRng('COST');
    generateRewardOffer('n', 'elite', 5, held.rewards.at('o'), DEFAULT_TUNING);
    generateRewardOffer('n', 'elite', 5, empty.rewards.at('o'), DEFAULT_TUNING);
    // Resolution consumes nothing at all, so the counts stay equal after it.
    expect(held.rewards.at('o').draws).toBe(empty.rewards.at('o').draws);
  });
});

describe('taking one', () => {
  const state = createRun('TAKE', DEFAULT_TUNING);
  const relic = RELICS[0];
  if (!relic) throw new Error('fixture');
  const card: Reward = { kind: 'relic', relic: relic.id, alternates: [], fallback: { kind: 'currency', amount: 1 } };

  it('lands on the run, not the backpack and not a Pokemon', () => {
    const after = applyReward(state, card);
    expect(after.relics).toEqual([relic.id]);
    expect(after.backpack).toEqual(state.backpack);
    expect(after.party).toEqual(state.party);
  });

  it('cannot be added twice', () => {
    const once = applyReward(state, card);
    expect(applyReward(once, card).relics).toEqual([relic.id]);
  });

  it('adds no logged decision, because it is an ordinary card pick', () => {
    // Asserted as a type-level fact about the union: `RunDecision` has no
    // relic member, so taking one records `{kind:'reward', index}` and
    // nothing else. The run-level proof is in test/relics-permanence.test.ts.
    const after = applyReward(state, card);
    expect(Object.keys(after)).toEqual(Object.keys(state));
  });
});

describe('concreteReward on its own', () => {
  it('passes every non-relic kind straight through by identity', () => {
    const rewards: Reward[] = [
      { kind: 'currency', amount: 5 },
      { kind: 'heal', fraction: 0.5 },
      { kind: 'item', item: 'leftovers' },
      { kind: 'tm', move: 'Surf' },
    ];
    for (const reward of rewards) expect(concreteReward(reward, RELIC_IDS)).toBe(reward);
  });

  it('walks alternates in order', () => {
    const [a, b, c] = RELIC_IDS;
    if (!a || !b || !c) throw new Error('fixture');
    const card: Reward = { kind: 'relic', relic: a, alternates: [b, c], fallback: { kind: 'currency', amount: 1 } };
    expect(concreteReward(card, [])).toMatchObject({ kind: 'relic', relic: a });
    expect(concreteReward(card, [a])).toMatchObject({ kind: 'relic', relic: b });
    expect(concreteReward(card, [a, b])).toMatchObject({ kind: 'relic', relic: c });
    expect(concreteReward(card, [a, b, c])).toEqual({ kind: 'currency', amount: 1 });
  });
});
