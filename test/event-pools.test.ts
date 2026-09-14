/**
 * Event rejig step 2: the four tier pools and the distributions that select
 * them.
 *
 * Data only. Nothing here generates an event, because nothing is wired yet —
 * these are the properties the tables have to hold before `core/events.ts` is
 * allowed to draw on them, and two of them are the patch's hard rules:
 *
 *   - **`T3` is unreachable without a satisfied relic.** Enforced structurally,
 *     by every non-Attune distribution carrying a zero `T3` weight, so there is
 *     no path to the top tier that does not run through a relic.
 *   - **A cost is never alone.** Every `T0` entry grants something, over the
 *     whole pool and every band, so the result screen always has a consolation
 *     line to draw.
 */
import { describe, expect, it } from 'vitest';
import {
  ATTUNE_TIERS,
  EVENT_ARCHETYPES,
  EVENT_RARITIES,
  GAMBLE_TIERS,
  GAMBLE_TIERS_LATENT,
  OUTCOME_TIERS,
  SAFE_TIERS,
  TIER_POOLS,
  TOLL_TIERS,
  tierEntriesFor,
  tierRangeOf,
  tierWeightsFor,
  type EventEffect,
  type OutcomeTier,
  type TierEntry,
} from '../src/data/eventPools';
import { EVENT_RARITY_WEIGHTS, eventRarityWeights, SEGMENT_COUNT } from '../src/data/scaling';
import { itemById } from '../src/data/items';

const BANDS = ['none', 'latent', 'known'] as const;
const SEGMENTS = Array.from({ length: SEGMENT_COUNT }, (_, index) => index);

/** Every entry in a tier, across every band, with the band it came from. */
function entriesOf(tier: OutcomeTier): { band: number; entry: TierEntry }[] {
  return TIER_POOLS[tier].flatMap((band) =>
    band.entries.map((entry) => ({ band: band.throughSegment, entry })),
  );
}

const ALL_ENTRIES = OUTCOME_TIERS.flatMap((tier) =>
  entriesOf(tier).map(({ band, entry }) => ({ tier, band, entry })),
);

/** Every effect an entry carries, cost and grant alike. */
function effectsOf(entry: TierEntry): readonly EventEffect[] {
  return [...(entry.cost ?? []), ...entry.grant];
}

describe('the pools are well formed', () => {
  it('offers something at every tier in every segment', () => {
    for (const tier of OUTCOME_TIERS) {
      for (const segment of SEGMENTS) {
        const entries = tierEntriesFor(tier, segment);
        expect(entries.length, `${tier} at segment ${segment}`).toBeGreaterThan(0);
      }
    }
  });

  it('falls to the last band rather than to nothing past the last segment', () => {
    for (const tier of OUTCOME_TIERS) {
      const last = TIER_POOLS[tier][TIER_POOLS[tier].length - 1]!;
      expect(tierEntriesFor(tier, SEGMENT_COUNT + 40)).toEqual(last.entries);
    }
  });

  it('reads its bands in ascending order, so the first match is the right one', () => {
    for (const tier of OUTCOME_TIERS) {
      const rows = TIER_POOLS[tier].map((band) => band.throughSegment);
      expect([...rows].sort((a, b) => a - b), tier).toEqual(rows);
    }
  });

  it('gives every entry a positive weight and a non-empty grant', () => {
    for (const { tier, band, entry } of ALL_ENTRIES) {
      const where = `${tier}/${band}/${entry.id}`;
      expect(entry.weight, where).toBeGreaterThan(0);
      expect(entry.grant.length, where).toBeGreaterThan(0);
    }
  });

  it('keeps entry ids unique inside one band', () => {
    for (const tier of OUTCOME_TIERS) {
      for (const band of TIER_POOLS[tier]) {
        const ids = band.entries.map((entry) => entry.id);
        expect(new Set(ids).size, `${tier}/${band.throughSegment}`).toBe(ids.length);
      }
    }
  });

  it('names only items the item table knows', () => {
    for (const { tier, entry } of ALL_ENTRIES) {
      for (const effect of effectsOf(entry)) {
        if (effect.kind !== 'item' && effect.kind !== 'loseItem') continue;
        expect(effect.pool.length, `${tier}/${entry.id}`).toBeGreaterThan(0);
        for (const id of effect.pool) {
          expect(itemById(id), `${tier}/${entry.id} names ${id}`).not.toBeNull();
        }
      }
    }
  });
});

describe('a cost is never alone', () => {
  /*
   * Part 1: "Never a cost with nothing attached." The old events could not
   * punish at all, and the rule that made that so — "a player with nothing is
   * unrewarded, not punished" — is retired by this patch. What replaces it is
   * this: a setback is a bet that went the other way, and it says so by paying
   * something on the way out.
   */
  it('grants a consolation on every T0 entry, across the whole pool', () => {
    const entries = entriesOf('T0');
    expect(entries.length).toBeGreaterThan(6);
    for (const { band, entry } of entries) {
      const where = `T0/${band}/${entry.id}`;
      expect(entry.cost, where).toBeDefined();
      expect(entry.cost!.length, where).toBeGreaterThan(0);
      expect(entry.grant.length, where).toBeGreaterThan(0);
    }
  });

  it('puts a cost on no tier but T0', () => {
    for (const tier of OUTCOME_TIERS) {
      if (tier === 'T0') continue;
      for (const { band, entry } of entriesOf(tier)) {
        expect(entry.cost, `${tier}/${band}/${entry.id}`).toBeUndefined();
      }
    }
  });

  it('never grants a cost-shaped effect, and never costs a grant-shaped one', () => {
    const costly = new Set(['damage', 'currencyFraction', 'loseItem', 'discard']);
    for (const { tier, entry } of ALL_ENTRIES) {
      for (const effect of entry.grant) {
        expect(costly.has(effect.kind), `${tier}/${entry.id} grants ${effect.kind}`).toBe(false);
        if (effect.kind === 'currency') {
          expect(effect.amount, `${tier}/${entry.id}`).toBeGreaterThan(0);
        }
      }
      for (const effect of entry.cost ?? []) {
        expect(costly.has(effect.kind), `${tier}/${entry.id} costs ${effect.kind}`).toBe(true);
      }
    }
  });
});

describe('the costs stay inside the band Part 1 set', () => {
  it('takes 15 to 25 percent HP, and never more', () => {
    for (const { entry } of entriesOf('T0')) {
      for (const effect of entry.cost ?? []) {
        if (effect.kind !== 'damage') continue;
        expect(effect.percent, entry.id).toBeGreaterThanOrEqual(0.15);
        expect(effect.percent, entry.id).toBeLessThanOrEqual(0.25);
      }
    }
  });

  it('takes 30 to 40 percent of gold, always against a floor', () => {
    for (const { entry } of entriesOf('T0')) {
      for (const effect of entry.cost ?? []) {
        if (effect.kind !== 'currencyFraction') continue;
        expect(effect.fraction, entry.id).toBeGreaterThanOrEqual(0.3);
        expect(effect.fraction, entry.id).toBeLessThanOrEqual(0.4);
        expect(effect.floor, entry.id).toBeGreaterThan(0);
      }
    }
  });

  it('discards one backpack item at a time, never a handful', () => {
    for (const { entry } of entriesOf('T0')) {
      for (const effect of entry.cost ?? []) {
        if (effect.kind !== 'discard') continue;
        expect(effect.count, entry.id).toBe(1);
      }
    }
  });

  it('escalates its HP costs as the run goes on rather than its consolations', () => {
    const worst = TIER_POOLS.T0.map((band) =>
      Math.max(
        0,
        ...band.entries.flatMap((entry) =>
          (entry.cost ?? []).flatMap((effect) => (effect.kind === 'damage' ? [effect.percent] : [])),
        ),
      ),
    );
    expect(worst).toEqual([...worst].sort((a, b) => a - b));
    expect(worst[worst.length - 1]).toBeGreaterThan(worst[0]!);
  });
});

describe('T3 is relic-gated, structurally', () => {
  /*
   * The patch's one hard rule. It is held here rather than by a check in core
   * because a check is a thing to forget at the next call site: if no
   * non-Attune distribution can name T3, then no amount of wiring can reach it
   * without the relic.
   */
  it('carries a zero T3 weight on every non-Attune distribution', () => {
    for (const rarity of EVENT_RARITIES) {
      expect(GAMBLE_TIERS[rarity].T3, `gamble/${rarity}`).toBe(0);
      expect(GAMBLE_TIERS_LATENT[rarity].T3, `gamble-latent/${rarity}`).toBe(0);
    }
    expect(SAFE_TIERS.T3).toBe(0);
    expect(TOLL_TIERS.T3).toBe(0);
  });

  it('reaches T3 from no archetype but Attune, at any rarity and any band', () => {
    for (const archetype of EVENT_ARCHETYPES) {
      for (const rarity of EVENT_RARITIES) {
        for (const band of BANDS) {
          const weights = tierWeightsFor(archetype, rarity, band);
          if (archetype === 'attune') continue;
          expect(weights.T3, `${archetype}/${rarity}/${band}`).toBe(0);
        }
      }
    }
  });

  it('weights Attune to T3, and never to T0 or T1', () => {
    for (const rarity of EVENT_RARITIES) {
      expect(ATTUNE_TIERS[rarity].T0, rarity).toBe(0);
      /*
       * The floor. An Attune paying T1 would mean the player held a scarce
       * relic, spent the gated option on it and got a minor payout — the one
       * outcome the gate exists to prevent.
       */
      expect(ATTUNE_TIERS[rarity].T1, rarity).toBe(0);
      expect(ATTUNE_TIERS[rarity].T3, rarity).toBeGreaterThan(0);
    }
    // Rarity buys the top tier, monotonically.
    expect(ATTUNE_TIERS.common.T3).toBeLessThan(ATTUNE_TIERS.uncommon.T3);
    expect(ATTUNE_TIERS.uncommon.T3).toBeLessThan(ATTUNE_TIERS.rare.T3);
  });
});

describe('the distributions', () => {
  it('gives every archetype somewhere to land, at every rarity and band', () => {
    for (const archetype of EVENT_ARCHETYPES) {
      for (const rarity of EVENT_RARITIES) {
        for (const band of BANDS) {
          const weights = tierWeightsFor(archetype, rarity, band);
          const total = OUTCOME_TIERS.reduce((sum, tier) => sum + weights[tier], 0);
          expect(total, `${archetype}/${rarity}/${band}`).toBeGreaterThan(0);
          for (const tier of OUTCOME_TIERS) {
            expect(weights[tier], `${archetype}/${rarity}/${band}/${tier}`).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('is flat for Safe and Toll: T1 and T2, with no variance at all', () => {
    for (const rarity of EVENT_RARITIES) {
      for (const band of BANDS) {
        expect(tierWeightsFor('safe', rarity, band)).toEqual(SAFE_TIERS);
        expect(tierWeightsFor('toll', rarity, band)).toEqual(TOLL_TIERS);
      }
    }
    expect(tierRangeOf(SAFE_TIERS)).toEqual(['T1', 'T1']);
    expect(tierRangeOf(TOLL_TIERS)).toEqual(['T2', 'T2']);
  });

  it('moves a Gamble off T0 and onto T2 as rarity rises', () => {
    const setbacks = EVENT_RARITIES.map((rarity) => GAMBLE_TIERS[rarity].T0);
    const majors = EVENT_RARITIES.map((rarity) => GAMBLE_TIERS[rarity].T2);
    expect(setbacks).toEqual([...setbacks].sort((a, b) => b - a));
    expect(majors).toEqual([...majors].sort((a, b) => a - b));
  });

  it('makes latent strictly kinder than none, and strictly less than Attune', () => {
    for (const rarity of EVENT_RARITIES) {
      const none = GAMBLE_TIERS[rarity];
      const latent = GAMBLE_TIERS_LATENT[rarity];
      expect(latent.T0, rarity).toBeLessThan(none.T0);
      expect(latent.T2, rarity).toBeGreaterThan(none.T2);
      // The gate stays where Part 2 puts it: latent buys no T3 and no Attune.
      expect(latent.T3, rarity).toBe(0);
      expect(latent.T2, rarity).toBeLessThan(ATTUNE_TIERS[rarity].T2 + ATTUNE_TIERS[rarity].T3);
    }
  });

  it('reads a Gamble at none and latent, and an Attune at any band', () => {
    for (const rarity of EVENT_RARITIES) {
      expect(tierWeightsFor('gamble', rarity, 'none')).toEqual(GAMBLE_TIERS[rarity]);
      expect(tierWeightsFor('gamble', rarity, 'latent')).toEqual(GAMBLE_TIERS_LATENT[rarity]);
      expect(tierWeightsFor('gamble', rarity, 'known')).toEqual(GAMBLE_TIERS_LATENT[rarity]);
      expect(tierWeightsFor('attune', rarity, 'known')).toEqual(ATTUNE_TIERS[rarity]);
    }
  });

  it('names the range the screen shows, off the weights rather than beside them', () => {
    expect(tierRangeOf(GAMBLE_TIERS.common)).toEqual(['T0', 'T2']);
    expect(tierRangeOf(GAMBLE_TIERS.rare)).toEqual(['T0', 'T2']);
    // `T2 to T3` at every rarity since the Attune floor was raised: Part 8's
    // label was right and Part 3's T1 weights were the half that gave way.
    expect(tierRangeOf(ATTUNE_TIERS.common)).toEqual(['T2', 'T3']);
    expect(tierRangeOf(ATTUNE_TIERS.rare)).toEqual(['T2', 'T3']);
  });
});

describe('the rarity ramp', () => {
  it('covers every segment and reads in ascending order', () => {
    const rows = EVENT_RARITY_WEIGHTS.map((row) => row.throughSegment);
    expect([...rows].sort((a, b) => a - b)).toEqual(rows);
    expect(rows[rows.length - 1]).toBe(SEGMENT_COUNT - 1);
    for (const segment of SEGMENTS) {
      const weights = eventRarityWeights(segment);
      expect(weights.common + weights.uncommon + weights.rare, `segment ${segment}`).toBeGreaterThan(0);
    }
  });

  it('matches Part 3 exactly, since the table is the hypothesis', () => {
    expect(eventRarityWeights(0)).toEqual({ common: 60, uncommon: 30, rare: 10 });
    expect(eventRarityWeights(2)).toEqual({ common: 60, uncommon: 30, rare: 10 });
    expect(eventRarityWeights(3)).toEqual({ common: 50, uncommon: 33, rare: 17 });
    expect(eventRarityWeights(5)).toEqual({ common: 50, uncommon: 33, rare: 17 });
    expect(eventRarityWeights(6)).toEqual({ common: 40, uncommon: 35, rare: 25 });
    expect(eventRarityWeights(7)).toEqual({ common: 40, uncommon: 35, rare: 25 });
  });

  it('tilts upward: rare rises and common falls, every band', () => {
    const rare = EVENT_RARITY_WEIGHTS.map((row) => row.rare);
    const common = EVENT_RARITY_WEIGHTS.map((row) => row.common);
    expect(rare).toEqual([...rare].sort((a, b) => a - b));
    expect(common).toEqual([...common].sort((a, b) => b - a));
  });

  it('falls to the last row rather than to nothing past the last segment', () => {
    expect(eventRarityWeights(SEGMENT_COUNT + 40)).toEqual(eventRarityWeights(SEGMENT_COUNT - 1));
  });
});

describe('what each tier is for', () => {
  it('pays a move at band in T2 and one band up in T3', () => {
    const offsets = (tier: OutcomeTier): number[] =>
      entriesOf(tier).flatMap(({ entry }) =>
        entry.grant.flatMap((effect) => (effect.kind === 'move' ? [effect.bandOffset] : [])),
      );
    expect(offsets('T2').length).toBeGreaterThan(0);
    expect(new Set(offsets('T2'))).toEqual(new Set([0]));
    expect(offsets('T3').length).toBeGreaterThan(0);
    expect(new Set(offsets('T3'))).toEqual(new Set([1]));
  });

  it('offers a Pokemon holding something only at T3', () => {
    for (const tier of OUTCOME_TIERS) {
      for (const { entry } of entriesOf(tier)) {
        for (const effect of entry.grant) {
          if (effect.kind !== 'acquisition') continue;
          expect(effect.withItem, `${tier}/${entry.id}`).toBe(tier === 'T3');
          expect(effect.bandOffset, `${tier}/${entry.id}`).toBe(tier === 'T3' ? 1 : 0);
        }
      }
    }
  });

  it('offers a relic at T2 and T3 only, and pairs it with an item at T3', () => {
    for (const tier of OUTCOME_TIERS) {
      for (const { entry } of entriesOf(tier)) {
        const relics = entry.grant.filter((effect) => effect.kind === 'relic');
        if (relics.length === 0) continue;
        expect(tier === 'T2' || tier === 'T3', `${tier}/${entry.id}`).toBe(true);
        /*
         * The deviation from Part 1 recorded in `data/eventPools.ts`: there is
         * no strength axis on relics, so T3's relic is the T2 relic plus a
         * rider — strictly better by construction rather than by judgement.
         */
        if (tier === 'T3') {
          expect(entry.grant.some((effect) => effect.kind === 'item'), entry.id).toBe(true);
        }
      }
    }
  });

  it('keeps T1 flat: no move, no Pokemon, no relic, at any band', () => {
    for (const { entry } of entriesOf('T1')) {
      for (const effect of entry.grant) {
        expect(['item', 'currency', 'heal'], entry.id).toContain(effect.kind);
      }
    }
  });

  it('pays strictly more gold at T3 than at T1, band for band', () => {
    const lump = (tier: OutcomeTier, band: number): number =>
      Math.max(
        0,
        ...TIER_POOLS[tier]
          .filter((row) => row.throughSegment === band)
          .flatMap((row) =>
            row.entries.flatMap((entry) =>
              entry.grant.flatMap((effect) => (effect.kind === 'currency' ? [effect.amount] : [])),
            ),
          ),
      );
    for (const band of [2, 5, 7]) {
      expect(lump('T3', band), `band ${band}`).toBeGreaterThan(lump('T1', band));
    }
  });
});
