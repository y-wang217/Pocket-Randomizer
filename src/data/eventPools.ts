/**
 * What an event can pay, in four tiers. **The file a balance pass edits when
 * events are the thing being tuned.**
 *
 * Events before this patch were a small guaranteed handout with a relic check
 * bolted on: every choice paid something at every band, and the floor was
 * written into `data/events.ts` as a rule — "a player with nothing is
 * unrewarded, not punished". That rule is retired here. The floor is now the
 * **Safe option**, which every event carries, so a player who wants no downside
 * takes a flat `T1` and walks. Downside is opt in.
 *
 * ## Four tiers, and what separates them
 *
 * | tier | what it is |
 * |---|---|
 * | `T0` | a real cost, always paired with a consolation |
 * | `T1` | one small thing, the floor a Safe option pays |
 * | `T2` | a thing worth routing for: a move at band, a Pokemon, a premium item, a relic |
 * | `T3` | above what any other node pays, and **relic-gated with no exception** |
 *
 * `T3` is reachable only through the Attune archetype, which is only present
 * when the event's relic is held. That is the one hard rule in this file and
 * the distributions below enforce it structurally rather than by a check: no
 * non-Attune row has a non-zero `T3` weight, so there is no path to the top
 * tier that does not run through a relic. A test asserts it over the whole
 * table rather than trusting the reading.
 *
 * ## A cost is never alone
 *
 * Every `T0` entry carries both `cost` and `grant`, and `grant` is never empty.
 * A cost that arrived with nothing attached is the exact misread the old
 * "unrewarded, not punished" rule existed to prevent — the game taking
 * something and giving nothing reads as a bug rather than as a bet that went
 * the other way. The split into two fields is structural rather than
 * cosmetic: the result screen renders the consolation as its own line, and
 * `test/event-pools.test.ts` property-tests the whole `T0` pool for it.
 *
 * ## Templates, not outcomes
 *
 * Same split as `data/rewardPools.ts` and for the same reason: contents stay in
 * this file, draws stay in `core/`. An entry says "an item from these ten" or
 * "a move one band up"; core says which one. An entry that carried a resolved
 * outcome would mean every possible payout had to be enumerated by hand, and
 * the number of hand-written rows is what made the old event table feel small.
 *
 * Two effects deliberately stay unresolved until the player arrives, and
 * neither is a draw:
 *
 *   - `currencyFraction` is `max(floor, fraction x current gold)`. Current gold
 *     is not known when the map is built, so the *number* cannot be. It is
 *     arithmetic on state at resolution, which consumes no RNG and therefore
 *     cannot shift a stream.
 *   - `discard` names a count, not an item. What is in the backpack is a
 *     function of how the run went.
 *
 * Everything else — which item, which move, which Pokemon — is drawn at map
 * generation like every other event draw.
 *
 * ## Three keys: tier, segment band, and rarity
 *
 * Tier is "how good"; the segment band is "how far in"; rarity is "how swingy".
 * The first two work exactly as `data/rewardPools.ts` uses them, down to the
 * `throughSegment` row shape, so the two files can be read against each other.
 * Rarity is the third and it belongs to the *distributions* at the bottom
 * rather than to the pools: rarity changes which tier a Gamble lands on, never
 * what a tier contains.
 *
 * Every number here is a starting hypothesis. None of it is a finding.
 */

import { BERRIES, GOOD_ITEMS, MODEST_ITEMS, PREMIUM_ITEMS, TYPE_ITEMS } from './items';

// ---------------------------------------------------------------------------
// The vocabulary
// ---------------------------------------------------------------------------

/** How good an outcome is. Ordinal, and the ordering is the whole point. */
export type OutcomeTier = 'T0' | 'T1' | 'T2' | 'T3';

/** Every tier, ascending. A draw order, so reordering reshuffles recorded seeds. */
export const OUTCOME_TIERS: readonly OutcomeTier[] = ['T0', 'T1', 'T2', 'T3'];

/** How swingy one event node is. Drawn per node at map generation. */
export type EventRarity = 'common' | 'uncommon' | 'rare';

/** Every rarity, ascending. Also a draw order. */
export const EVENT_RARITIES: readonly EventRarity[] = ['common', 'uncommon', 'rare'];

/**
 * One button's role on the event screen.
 *
 * The archetype decides the distribution; `data/events.ts` decides the copy and
 * the price. That split is what lets 24 events be written from one template
 * instead of 24 bespoke outcome tables — if a bespoke outcome is ever needed
 * for one event, the pool below is missing an entry.
 */
export type EventArchetype = 'safe' | 'gamble' | 'toll' | 'attune';

/** Every archetype, in the order the screen lists them. */
export const EVENT_ARCHETYPES: readonly EventArchetype[] = ['safe', 'gamble', 'toll', 'attune'];

/**
 * Who an HP effect lands on.
 *
 * `party` is what `damage` has always meant — every standing member. `lead` is
 * new with this patch, because Part 1 prices some tolls against the lead alone
 * and the old outcome union could not say it. A lead-targeted cost is the
 * cheaper one to pay and the one a player with a deep bench can absorb, which
 * is the decision the two targets exist to create.
 */
export type EffectTarget = 'lead' | 'party';

/**
 * One atomic thing that happens to the run.
 *
 * A list of these rather than a single outcome, because two of the four tiers
 * are compound by definition: a `T0` is a cost *and* a consolation, and the
 * `T3` headline entries pair a thing with a rider. Keeping the atom small and
 * the list ordered means `core/events.ts` folds them left to right and no
 * effect needs to know about any other.
 */
export type EventEffect =
  /** Flat currency, signed. Scaled by segment at resolution, like a reward card. */
  | { kind: 'currency'; amount: number }
  /**
   * A currency *loss* of `max(floor, fraction x current gold)`.
   *
   * The floor is what stops a broke player paying nothing. Both numbers are
   * pre-scale: the floor is scaled by segment at resolution so it stays a real
   * price late, and the fraction needs no scaling because gold already has.
   */
  | { kind: 'currencyFraction'; fraction: number; floor: number }
  /** Percent of max HP off the target. Never faints; see `tuning.eventDamageFloor`. */
  | { kind: 'damage'; percent: number; target: EffectTarget }
  /** Percent of max HP and PP restored to the target. */
  | { kind: 'heal'; percent: number; target: EffectTarget }
  /** `count` items, each drawn from `pool`. */
  | { kind: 'item'; pool: readonly string[]; count: number }
  /**
   * Take one item the run is carrying, restricted to `pool`.
   *
   * "Lose a berry" rather than "lose an item": a berry is a consumable the run
   * replaces, so the cost is a tempo loss rather than the destruction of a
   * build. Carrying none makes this a no-op, which is deliberate — a player
   * with nothing to lose here loses nothing and still takes the consolation.
   */
  | { kind: 'loseItem'; pool: readonly string[] }
  /**
   * Forced backpack discard, `count` items, chosen by the run rather than the
   * player. The one cost that can reach a build rather than a consumable.
   */
  | { kind: 'discard'; count: number }
  /**
   * A damaging move, at the segment's move band plus `bandOffset`.
   *
   * No `Tier`, unlike a reward card: an event node has no tier, so there is no
   * `REWARD_BAND_OFFSET` to apply and the offset here is the whole shift.
   * `T2` pays at band, `T3` at band plus one.
   */
  | { kind: 'move'; bandOffset: number }
  /**
   * A Pokemon on the table, take it or leave it.
   *
   * **The 4.6c band 3 mechanism, unchanged, and deliberately not a fight.** An
   * event is a node with no battle in it, which is what makes an event unable
   * to end a run and what keeps every node completion on the single result
   * screen. `withItem` says whether the offer arrives holding something.
   */
  | { kind: 'acquisition'; bandOffset: number; withItem: boolean }
  /**
   * A relic the run does not already hold.
   *
   * Carries no id, for the same reason the reward pool's relic entry does not:
   * which relic is decided at *offer resolution*, because a relic already held
   * must not be offered twice and what the run holds is not known when the map
   * is built. The draw is invariant either way, so the filter cannot shift a
   * later roll.
   */
  | { kind: 'relic' };

/**
 * One drawable outcome in a tier pool.
 *
 * `id` is a stable string and it earns its place three ways: the simulator
 * reports tier distribution by entry, `test/event-pools.test.ts` names the
 * entry that failed rather than an index, and a pool edit that renames an
 * entry is visible in a diff. It is **not** a logged identity — nothing in the
 * run log names one of these, because the outcome is derived from the seed.
 */
export interface TierEntry {
  id: string;
  weight: number;
  /**
   * What this costs. `T0` only, and every `T0` entry has one.
   *
   * Absent on every other tier rather than empty, so "is this a setback" is a
   * property of the shape instead of a length check somewhere in core.
   */
  cost?: readonly EventEffect[];
  /** What this pays. **Never empty, on any tier, `T0` included.** */
  grant: readonly EventEffect[];
}

/** A stretch of the run, and what a tier offers across it. */
export interface TierBand {
  /** The last segment index this row covers. Rows are read in order. */
  throughSegment: number;
  entries: readonly TierEntry[];
}

const ids = (entries: readonly { id: string }[]): readonly string[] => entries.map((entry) => entry.id);

const BERRY_IDS = ids(BERRIES);
const TYPE_ITEM_IDS = ids(TYPE_ITEMS);
const MODEST_ITEM_IDS = ids(MODEST_ITEMS);
const GOOD_ITEM_IDS = ids(GOOD_ITEMS);
const PREMIUM_ITEM_IDS = ids(PREMIUM_ITEMS);

/** One berry. The unit the consolations and the small costs are priced in. */
const berry = (count = 1): EventEffect => ({ kind: 'item', pool: BERRY_IDS, count });

// ---------------------------------------------------------------------------
// T0 — Setback
// ---------------------------------------------------------------------------

/**
 * The costs, from Part 1: 15 to 25 percent HP off the lead or the party, a
 * berry, 30 to 40 percent of gold against a floor, or one forced discard.
 *
 * The consolations are small on purpose. A `T0` that paid a consolation worth
 * the cost would not be a setback, it would be a trade, and the Gamble would
 * stop having a downside to weigh. What the consolation buys is *legibility* —
 * the player can name what happened and see that the game noticed.
 *
 * The bands escalate the costs rather than the consolations, because a
 * percentage cost already escalates with the party it is taken from while a
 * flat consolation does not.
 */
const T0_POOL: readonly TierBand[] = [
  {
    throughSegment: 2,
    entries: [
      {
        id: 't0-lead-bruise',
        weight: 5,
        cost: [{ kind: 'damage', percent: 0.15, target: 'lead' }],
        grant: [berry()],
      },
      {
        id: 't0-party-scrape',
        weight: 4,
        cost: [{ kind: 'damage', percent: 0.15, target: 'party' }],
        grant: [{ kind: 'currency', amount: 24 }],
      },
      {
        id: 't0-berry-spoiled',
        weight: 4,
        cost: [{ kind: 'loseItem', pool: BERRY_IDS }],
        grant: [{ kind: 'heal', percent: 0.25, target: 'party' }],
      },
      {
        /*
         * The gold cost opens at the bottom of Part 1's 30-to-40 band and at a
         * low floor, because segment 0 to 2 is where a run is poorest and a
         * fixed floor is at its most punishing relative to what is in the
         * purse. The fraction rises later, the floor rises with the scale.
         */
        id: 't0-purse-lightened',
        weight: 3,
        cost: [{ kind: 'currencyFraction', fraction: 0.3, floor: 18 }],
        grant: [berry()],
      },
    ],
  },
  {
    throughSegment: 5,
    entries: [
      {
        id: 't0-lead-mauled',
        weight: 5,
        cost: [{ kind: 'damage', percent: 0.2, target: 'lead' }],
        grant: [{ kind: 'currency', amount: 34 }],
      },
      {
        id: 't0-party-worn',
        weight: 4,
        cost: [{ kind: 'damage', percent: 0.2, target: 'party' }],
        grant: [{ kind: 'item', pool: TYPE_ITEM_IDS, count: 1 }],
      },
      {
        id: 't0-purse-cut',
        weight: 4,
        cost: [{ kind: 'currencyFraction', fraction: 0.35, floor: 26 }],
        grant: [{ kind: 'heal', percent: 0.35, target: 'party' }],
      },
      {
        /*
         * The forced discard arrives in the middle band and not before it.
         * Segment 0 to 2 is where a backpack is most often empty, and a cost
         * that no-ops on half the runs that draw it is a cost the player cannot
         * learn to fear.
         */
        id: 't0-bag-rifled',
        weight: 3,
        cost: [{ kind: 'discard', count: 1 }],
        grant: [{ kind: 'currency', amount: 42 }],
      },
      {
        id: 't0-berry-crushed',
        weight: 2,
        cost: [{ kind: 'loseItem', pool: BERRY_IDS }],
        grant: [berry(2)],
      },
    ],
  },
  {
    throughSegment: 7,
    entries: [
      {
        id: 't0-lead-broken',
        weight: 5,
        cost: [{ kind: 'damage', percent: 0.25, target: 'lead' }],
        grant: [{ kind: 'heal', percent: 0.3, target: 'party' }],
      },
      {
        id: 't0-party-spent',
        weight: 5,
        cost: [{ kind: 'damage', percent: 0.25, target: 'party' }],
        grant: [{ kind: 'currency', amount: 48 }],
      },
      {
        id: 't0-purse-emptied',
        weight: 4,
        cost: [{ kind: 'currencyFraction', fraction: 0.4, floor: 34 }],
        grant: [{ kind: 'item', pool: MODEST_ITEM_IDS, count: 1 }],
      },
      {
        id: 't0-bag-stripped',
        weight: 3,
        cost: [{ kind: 'discard', count: 1 }],
        /*
         * The one consolation that is not small, and it is here because this is
         * the one cost that can take a Leftovers off a segment-7 party. A
         * partial heal going into the last gyms is the only consolation at this
         * point in the run that reads as a consolation at all.
         */
        grant: [{ kind: 'heal', percent: 0.45, target: 'party' }],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// T1 — Minor
// ---------------------------------------------------------------------------

/**
 * Part 1: one held item, or two berries, or a mid gold lump, or a full heal on
 * one member.
 *
 * This is what Safe pays, flat, on every event in the game — so it is the tier
 * that decides whether an event node is worth stepping on at all when the
 * player wants nothing to do with the variance. It is deliberately close to
 * what a normal reward card pays: an event is a node, and the no-risk option on
 * a node should be worth about what the no-risk node next to it is worth.
 *
 * The bands follow `data/rewardPools.ts`: currency down and healing up as the
 * run goes on, because by segment 6 a shop is further away than the next gym.
 */
const T1_POOL: readonly TierBand[] = [
  {
    throughSegment: 2,
    entries: [
      { id: 't1-berries', weight: 5, grant: [berry(2)] },
      { id: 't1-type-item', weight: 4, grant: [{ kind: 'item', pool: TYPE_ITEM_IDS, count: 1 }] },
      { id: 't1-purse', weight: 5, grant: [{ kind: 'currency', amount: 45 }] },
      { id: 't1-tend-lead', weight: 3, grant: [{ kind: 'heal', percent: 1, target: 'lead' }] },
    ],
  },
  {
    throughSegment: 5,
    entries: [
      { id: 't1-berries', weight: 4, grant: [berry(2)] },
      { id: 't1-modest-item', weight: 4, grant: [{ kind: 'item', pool: MODEST_ITEM_IDS, count: 1 }] },
      { id: 't1-purse', weight: 4, grant: [{ kind: 'currency', amount: 60 }] },
      { id: 't1-tend-lead', weight: 5, grant: [{ kind: 'heal', percent: 1, target: 'lead' }] },
    ],
  },
  {
    throughSegment: 7,
    entries: [
      { id: 't1-berries', weight: 4, grant: [berry(2)] },
      { id: 't1-good-item', weight: 4, grant: [{ kind: 'item', pool: GOOD_ITEM_IDS, count: 1 }] },
      { id: 't1-purse', weight: 3, grant: [{ kind: 'currency', amount: 72 }] },
      { id: 't1-tend-lead', weight: 6, grant: [{ kind: 'heal', percent: 1, target: 'lead' }] },
    ],
  },
];

// ---------------------------------------------------------------------------
// T2 — Major
// ---------------------------------------------------------------------------

/**
 * Part 1: a move at the segment's current band, a Pokemon at band, a premium
 * held item, or a relic.
 *
 * This is what a Toll buys outright and what a Gamble is reaching for. It is
 * priced against an elite reward card rather than a normal one — which is the
 * point of the patch, since an event that could not pay better than the node
 * beside it was never worth routing toward.
 *
 * The Pokemon entry is the 4.6c band 3 offer, reused exactly. Declining it
 * still pays, and what it pays is a `T1` fallback: `core/events.ts` resolves
 * that, because the fallback is a *resolution* rule and not a second entry.
 */
const T2_POOL: readonly TierBand[] = [
  {
    throughSegment: 2,
    entries: [
      { id: 't2-move', weight: 8, grant: [{ kind: 'move', bandOffset: 0 }] },
      { id: 't2-pokemon', weight: 6, grant: [{ kind: 'acquisition', bandOffset: 0, withItem: false }] },
      /*
       * Premium items are held back one band, exactly as the reward pools hold
       * Choice items back: a whole-run item that lands before the player knows
       * what their moveset does is a card they cannot read. `GOOD_ITEMS` fills
       * the slot in the opening band.
       */
      { id: 't2-good-item', weight: 5, grant: [{ kind: 'item', pool: GOOD_ITEM_IDS, count: 1 }] },
      { id: 't2-relic', weight: 4, grant: [{ kind: 'relic' }] },
    ],
  },
  {
    throughSegment: 5,
    entries: [
      { id: 't2-move', weight: 8, grant: [{ kind: 'move', bandOffset: 0 }] },
      { id: 't2-pokemon', weight: 6, grant: [{ kind: 'acquisition', bandOffset: 0, withItem: false }] },
      { id: 't2-premium-item', weight: 5, grant: [{ kind: 'item', pool: PREMIUM_ITEM_IDS, count: 1 }] },
      { id: 't2-relic', weight: 5, grant: [{ kind: 'relic' }] },
    ],
  },
  {
    throughSegment: 7,
    entries: [
      { id: 't2-move', weight: 8, grant: [{ kind: 'move', bandOffset: 0 }] },
      /*
       * The Pokemon entry falls late and the relic rises. A party member joining
       * at segment 7 has two gyms to matter in and arrives under-levelled
       * against both; a relic's passive is worth the same whenever it lands.
       */
      { id: 't2-pokemon', weight: 4, grant: [{ kind: 'acquisition', bandOffset: 0, withItem: false }] },
      { id: 't2-premium-item', weight: 6, grant: [{ kind: 'item', pool: PREMIUM_ITEM_IDS, count: 1 }] },
      { id: 't2-relic', weight: 6, grant: [{ kind: 'relic' }] },
    ],
  },
];

// ---------------------------------------------------------------------------
// T3 — Windfall
// ---------------------------------------------------------------------------

/**
 * Part 1: a move at band plus one, a Pokemon at band plus one holding an item,
 * a strong relic, or a large gold lump plus a held item.
 *
 * **Reachable only through Attune, which is present only when the event's relic
 * is held.** Nothing in this pool is otherwise restricted; the gate is the
 * distribution table below, which carries a zero `T3` weight on every
 * non-Attune row. That is the structural version of the rule and it is the one
 * a test can hold.
 *
 * ## Deviation: there is no "strong relic" row
 *
 * Part 1 asks for a strong relic here against a common relic at `T2`. There is
 * no strength axis on `data/relics.ts` and adding one would mean ranking ten
 * relics by taste, which `CLAUDE.md` rules out — "it feels strong" is not a
 * reason, and a table populated that way is a table nobody can correct from
 * evidence. So `T3` pays **a relic and a held item**: the same object as `T2`
 * plus a `T1`-grade rider, which is strictly better by construction rather than
 * by judgement, and which needs no new column. Recorded in
 * `docs/generation.md` section 14.
 */
const T3_POOL: readonly TierBand[] = [
  {
    throughSegment: 2,
    entries: [
      { id: 't3-move', weight: 7, grant: [{ kind: 'move', bandOffset: 1 }] },
      { id: 't3-pokemon', weight: 6, grant: [{ kind: 'acquisition', bandOffset: 1, withItem: true }] },
      {
        id: 't3-relic-and-item',
        weight: 5,
        grant: [{ kind: 'relic' }, { kind: 'item', pool: GOOD_ITEM_IDS, count: 1 }],
      },
      {
        id: 't3-hoard',
        weight: 4,
        grant: [{ kind: 'currency', amount: 120 }, { kind: 'item', pool: GOOD_ITEM_IDS, count: 1 }],
      },
    ],
  },
  {
    throughSegment: 5,
    entries: [
      { id: 't3-move', weight: 7, grant: [{ kind: 'move', bandOffset: 1 }] },
      { id: 't3-pokemon', weight: 6, grant: [{ kind: 'acquisition', bandOffset: 1, withItem: true }] },
      {
        id: 't3-relic-and-item',
        weight: 6,
        grant: [{ kind: 'relic' }, { kind: 'item', pool: PREMIUM_ITEM_IDS, count: 1 }],
      },
      {
        id: 't3-hoard',
        weight: 4,
        grant: [{ kind: 'currency', amount: 165 }, { kind: 'item', pool: PREMIUM_ITEM_IDS, count: 1 }],
      },
    ],
  },
  {
    throughSegment: 7,
    entries: [
      { id: 't3-move', weight: 8, grant: [{ kind: 'move', bandOffset: 1 }] },
      { id: 't3-pokemon', weight: 4, grant: [{ kind: 'acquisition', bandOffset: 1, withItem: true }] },
      {
        id: 't3-relic-and-item',
        weight: 7,
        grant: [{ kind: 'relic' }, { kind: 'item', pool: PREMIUM_ITEM_IDS, count: 1 }],
      },
      {
        id: 't3-hoard',
        weight: 3,
        grant: [{ kind: 'currency', amount: 200 }, { kind: 'item', pool: PREMIUM_ITEM_IDS, count: 1 }],
      },
    ],
  },
];

/** Every tier's pool, by tier. */
export const TIER_POOLS: Readonly<Record<OutcomeTier, readonly TierBand[]>> = {
  T0: T0_POOL,
  T1: T1_POOL,
  T2: T2_POOL,
  T3: T3_POOL,
};

/**
 * The entries a tier offers at this segment. **The single accessor.**
 *
 * Rows are read in order and the first whose `throughSegment` covers the
 * segment wins; a segment past the last row falls to the last row rather than
 * to nothing, so a `SEGMENT_COUNT` change cannot empty a pool silently.
 */
export function tierEntriesFor(tier: OutcomeTier, segment: number): readonly TierEntry[] {
  const bands = TIER_POOLS[tier];
  const band = bands.find((row) => segment <= row.throughSegment) ?? bands[bands.length - 1];
  return band?.entries ?? [];
}

// ---------------------------------------------------------------------------
// The distributions
// ---------------------------------------------------------------------------

/** A weight per tier. Weights, not probabilities: they need not sum to 100. */
export type TierWeights = Readonly<Record<OutcomeTier, number>>;

/**
 * What a Gamble rolls, by rarity. **The variance knob.**
 *
 * Rarity moves weight off `T0` and onto `T2` as it rises, which is what makes a
 * rare event node worth routing toward for a player with no relic at all. `T3`
 * is zero on every row and that is the relic gate.
 */
export const GAMBLE_TIERS: Readonly<Record<EventRarity, TierWeights>> = {
  common: { T0: 35, T1: 45, T2: 20, T3: 0 },
  uncommon: { T0: 25, T1: 45, T2: 30, T3: 0 },
  rare: { T0: 20, T1: 35, T2: 45, T3: 0 },
};

/**
 * What a Gamble rolls at `latent`: the same table, one notch kinder.
 *
 * **This is a deviation from Part 5, taken on a measurement.** Part 5 says to
 * collapse the three capability bands to a boolean if `latent` is dead under
 * relics. It is not dead — `data/capabilities.ts` records that a party of four
 * random pool species misses a given capability only 30 to 50 percent of the
 * time, so `latent` is where most parties sit for most events, and collapsing
 * it would delete the one thing a party's *typing* currently says about an
 * event it has no relic for.
 *
 * So the boolean Part 2 asks for is kept exactly where Part 2 puts it — Attune
 * is present at `known` and nowhere else, and `T3` stays relic-gated with no
 * exception — and `latent` buys something strictly smaller: five points off
 * `T0` onto `T2`. A party that rolled a Water type reads a Surf event a little
 * more kindly than a party that did not, and reads it no more kindly than a
 * party holding the Tidecaller Shell.
 *
 * If the simulator says this is noise, the fix is to delete this table and
 * point `tierWeightsFor` at `GAMBLE_TIERS` for both bands. That is one line,
 * and it is the collapse Part 5 describes.
 */
export const GAMBLE_TIERS_LATENT: Readonly<Record<EventRarity, TierWeights>> = {
  common: { T0: 30, T1: 45, T2: 25, T3: 0 },
  uncommon: { T0: 20, T1: 45, T2: 35, T3: 0 },
  rare: { T0: 15, T1: 35, T2: 50, T3: 0 },
};

/**
 * What an Attune rolls, by rarity. Present only when the event's relic is held.
 *
 * Weighted to `T3` and never to `T0`: the relic is the price already paid, and
 * an option that could still set the player back would make holding the relic a
 * reason to *avoid* the button it unlocks.
 *
 * **Never `T1` either, and that is a ruling rather than a rounding.** Part 3 of
 * the prompt gave `T1` a weight of 10 at common and 5 at uncommon, which
 * contradicted Part 8's statement that the option reads `Reward: T2 to T3`.
 * The screen label is derived from these weights, so it honestly read `T1 to
 * T3` and surfaced the contradiction — and the ruling went to Part 8:
 *
 * > An Attune paying `T1` means the player held a scarce relic, spent the
 * > gated option on it, and got a minor payout. That is the one outcome the
 * > gate exists to prevent.
 *
 * The two weights moved onto `T2` rather than being deleted, so the shape of
 * the distribution is unchanged apart from its floor: common still sits lower
 * than rare, and the `T3` weights are untouched. `docs/generation.md`
 * section 14.
 */
export const ATTUNE_TIERS: Readonly<Record<EventRarity, TierWeights>> = {
  common: { T0: 0, T1: 0, T2: 70, T3: 30 },
  uncommon: { T0: 0, T1: 0, T2: 55, T3: 45 },
  rare: { T0: 0, T1: 0, T2: 40, T3: 60 },
};

/** Safe: flat `T1`, no variance, on every event at every rarity. */
export const SAFE_TIERS: TierWeights = { T0: 0, T1: 1, T2: 0, T3: 0 };

/** Toll: guaranteed `T2`. A price, not a bet — the price is in `data/events.ts`. */
export const TOLL_TIERS: TierWeights = { T0: 0, T1: 0, T2: 1, T3: 0 };

/**
 * The tier weights one option rolls on. **The single accessor.**
 *
 * Every consumer goes through it — generation, the simulator's scorer, the
 * screen's readout — so that "which distribution" is answered once. `band` is
 * read only by Gamble; Safe and Toll are flat by definition, and Attune is not
 * offered at a band below `known` so it never needs to ask.
 */
export function tierWeightsFor(
  archetype: EventArchetype,
  rarity: EventRarity,
  band: 'known' | 'latent' | 'none',
): TierWeights {
  switch (archetype) {
    case 'safe':
      return SAFE_TIERS;
    case 'toll':
      return TOLL_TIERS;
    case 'attune':
      return ATTUNE_TIERS[rarity];
    case 'gamble':
      return band === 'none' ? GAMBLE_TIERS[rarity] : GAMBLE_TIERS_LATENT[rarity];
  }
}

/**
 * The tier range an option can pay, for the screen's readout.
 *
 * Derived from the weights rather than stated beside them, so a distribution
 * edit cannot leave the label saying something the table no longer does.
 * Returns `[lowest, highest]` with a non-zero weight.
 */
export function tierRangeOf(weights: TierWeights): readonly [OutcomeTier, OutcomeTier] {
  const present = OUTCOME_TIERS.filter((tier) => weights[tier] > 0);
  const first = present[0] ?? 'T1';
  return [first, present[present.length - 1] ?? first];
}
