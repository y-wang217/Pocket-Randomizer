/**
 * Currency, shops and events.
 *
 * Two properties carry this file, and both are about state that must hold under
 * conditions no screen can enforce:
 *
 *   1. **Currency never goes below zero**, including through a replayed log and
 *      including when the log is corrupt. A shop screen that greys out what you
 *      cannot afford is a courtesy; the guarantee lives on the transition.
 *   2. **Event outcomes serialize and replay to identical state.** The coin was
 *      flipped when the map was built, so a save reloaded before the choice
 *      cannot reroll it — which is the only version of randomness a seeded game
 *      can honestly offer.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import {
  applyPurchases,
  basketCost,
  canAfford,
  generateShopStock,
  isBattleKind,
  nodePayout,
} from '../src/core/economy';
import { nodesOf, routeStepsOf, type NodeSpec } from '../src/core/encounters';
import { applyEventOutcome, definitionOf, describeOutcome, type EventOutcome } from '../src/core/events';
import { createParty } from '../src/core/party';
import { createRng } from '../src/core/rng';
import {
  createRun,
  playRun,
  replayRun,
  resumeRun,
  scriptedRunPolicy,
  type RunPolicy,
  type RunState,
} from '../src/core/run';
import type { RunLog } from '../src/core/types';
import { EVENTS } from '../src/data/events';
import { NODE_PAYOUT, shopEntriesFor, TIER_PAYOUT } from '../src/data/shop';
import { SEGMENT_COUNT } from '../src/data/scaling';
import { DEFAULT_TUNING, withTuning } from '../src/data/tuning';

const seeds = Array.from({ length: 24 }, (_, i) => `ECON-${i}`);

/** Every node of a seed's map, flattened. */
function allNodes(seed: string, tuning = DEFAULT_TUNING): NodeSpec[] {
  return createRun(seed, tuning).segments.flatMap(nodesOf);
}

/** A started run with a party, for the transition tests. */
function started(seed = 'ECON', currency = 0): RunState {
  const state = createRun(seed);
  return { ...state, starterIndex: 0, party: createParty([state.starterOptions[0]!]), currency };
}

/** Plays fights where it can, shops greedily, and always takes the first event option. */
function spender(): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseNode: async (options) => {
      const index = options.findIndex((option) => option.kind === 'shop' || option.kind === 'event');
      return index === -1 ? 0 : index;
    },
    chooseShopPurchases: async (stock, state) => {
      const basket: number[] = [];
      let left = state.currency;
      for (const [index, item] of stock.items.entries()) {
        if (item.price <= left) {
          basket.push(index);
          left -= item.price;
        }
      }
      return basket;
    },
    chooseEventOption: async () => 0,
  };
}

// ---------------------------------------------------------------------------
// 1. Generation: shops and events exist and are drawn from the seed
// ---------------------------------------------------------------------------

describe('shop and event nodes', () => {
  it('generates both kinds, with contents, across a population of seeds', () => {
    let shops = 0;
    let events = 0;
    for (const seed of seeds) {
      for (const node of allNodes(seed)) {
        if (node.kind === 'shop') {
          shops++;
          expect(node.shop, `${node.id}`).not.toBeNull();
          expect(node.shop?.items.length, `${node.id} stocks nothing`).toBeGreaterThan(0);
          expect(node.event).toBeNull();
        }
        if (node.kind === 'event') {
          events++;
          expect(node.event, `${node.id}`).not.toBeNull();
          expect(node.event?.choices.length, `${node.id}`).toBeGreaterThanOrEqual(2);
          expect(node.shop).toBeNull();
        }
      }
    }
    expect(shops, 'no shop nodes generated at all').toBeGreaterThan(10);
    expect(events, 'no event nodes generated at all').toBeGreaterThan(10);
  });

  it('gives shops and events no tier, no encounter and no reward offer', () => {
    // They are not fights: nothing to scale, no pool to key, nobody to beat.
    for (const seed of seeds) {
      for (const node of allNodes(seed)) {
        if (node.kind !== 'shop' && node.kind !== 'event') continue;
        expect(node.tier, `${node.id}`).toBeNull();
        expect(node.encounter, `${node.id}`).toBeNull();
        expect(node.reward, `${node.id}`).toBeNull();
        expect(isBattleKind(node.kind)).toBe(false);
      }
    }
  });

  it('draws stock and outcomes from the seed, identically twice', () => {
    const shape = (seed: string): unknown =>
      allNodes(seed).map((node) => ({ shop: node.shop, event: node.event }));
    expect(shape('ECON-SAME')).toEqual(shape('ECON-SAME'));
    expect(shape('ECON-A')).not.toEqual(shape('ECON-B'));
  });

  it('keeps shop and event draws on the rewards stream and nowhere else', () => {
    // Same assertion as the tier and reward ones, for the third consumer. The
    // plausible mistake here is drawing an event's outcome from `map`, since a
    // node's *kind* comes from there.
    const baseline = allNodes('ECON-ISOLATE').map((node) => ({ shop: node.shop, event: node.event }));
    for (const stream of ['map', 'battle', 'randomizer', 'policy'] as const) {
      const noisy = createRng('ECON-ISOLATE');
      for (let i = 0; i < 5_000; i++) noisy[stream].nextUint32();
      expect(
        allNodes('ECON-ISOLATE').map((node) => ({ shop: node.shop, event: node.event })),
        `draining ${stream}`,
      ).toEqual(baseline);
    }
  });

  it('prices every shelf item above zero and stocks what the segment sells', () => {
    for (const seed of seeds) {
      for (const segment of createRun(seed).segments) {
        const sellable = new Set(shopEntriesFor(segment.index).map((entry) => entry.kind));
        for (const node of nodesOf(segment)) {
          for (const item of node.shop?.items ?? []) {
            expect(item.price, `${node.id}`).toBeGreaterThan(0);
            expect(sellable.has(item.reward.kind), `${node.id} sells a ${item.reward.kind}`).toBe(true);
            // A shop that sold currency would be a rounding error with a screen.
            expect(item.reward.kind).not.toBe('currency');
            expect(item.reward.kind).not.toBe('species');
          }
        }
      }
    }
  });

  it('never stocks the same thing twice on one shelf', () => {
    for (const seed of seeds) {
      for (const node of allNodes(seed)) {
        const signatures = (node.shop?.items ?? []).map((item) => JSON.stringify(item.reward));
        expect(new Set(signatures).size, `${node.id} repeats stock`).toBe(signatures.length);
      }
    }
  });

  it('respects the stock-size tuning', () => {
    const big = withTuning({ shopStockSize: { min: 6, max: 6 } });
    const sizes = new Set<number>();
    for (const seed of seeds) {
      for (const node of allNodes(seed, big)) if (node.shop) sizes.add(node.shop.items.length);
    }
    expect(sizes.size).toBeGreaterThan(0);
    // Dedup can shorten a shelf but never lengthen it past the draw.
    for (const size of sizes) expect(size).toBeLessThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// 2. Earning
// ---------------------------------------------------------------------------

describe('currency earned per node', () => {
  it('pays nothing for a node that is not a fight', () => {
    for (const seed of seeds) {
      for (const node of allNodes(seed)) {
        if (isBattleKind(node.kind)) continue;
        expect(nodePayout(node, 0), `${node.id} is a ${node.kind} and should pay nothing`).toBe(0);
      }
    }
  });

  it('pays more for a harder tier and for a harder kind', () => {
    const node = (kind: NodeSpec['kind'], tier: NodeSpec['tier']): NodeSpec => ({
      id: 'x',
      kind,
      tier,
      label: '',
      encounter: null,
      reward: null,
      shop: null,
      event: null,
      acquisition: null,
    });

    expect(nodePayout(node('wild', 'hard'), 0)).toBeGreaterThan(nodePayout(node('wild', 'normal'), 0));
    expect(nodePayout(node('wild', 'elite'), 0)).toBeGreaterThan(nodePayout(node('wild', 'hard'), 0));
    expect(nodePayout(node('trainer', 'normal'), 0)).toBeGreaterThan(nodePayout(node('wild', 'normal'), 0));
    expect(nodePayout(node('gym', null), 0)).toBeGreaterThan(nodePayout(node('trainer', 'elite'), 0));
    // And it grows with the run, so a late fight is worth a late price.
    expect(nodePayout(node('wild', 'normal'), 7)).toBeGreaterThan(nodePayout(node('wild', 'normal'), 0));
  });

  it('keeps the payout table and the tier multipliers ordered', () => {
    // The claim the risk gradient rests on, asserted at the data so it fails
    // here rather than as a shrug in a win rate.
    expect(NODE_PAYOUT.gym).toBeGreaterThan(NODE_PAYOUT.trainer);
    expect(NODE_PAYOUT.trainer).toBeGreaterThan(NODE_PAYOUT.wild);
    expect(TIER_PAYOUT.elite).toBeGreaterThan(TIER_PAYOUT.hard);
    expect(TIER_PAYOUT.hard).toBeGreaterThan(TIER_PAYOUT.normal);
    expect(TIER_PAYOUT.normal).toBe(1);
  });

  it('actually banks money over a played run', async () => {
    const run = await playRun('ECON-BANK', scriptedRunPolicy(greedyAiPolicy));
    const fights = run.state.history.filter((visit) => visit.result?.winner === 'p1').length;
    if (fights > 0) expect(run.state.currency).toBeGreaterThan(0);
    expect(run.state.currency).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Spending, and the rule that cannot be broken
// ---------------------------------------------------------------------------

describe('currency never goes negative', () => {
  const stock = generateShopStock('shop-test', 0, createRng('ECON-SHOP').rewards, DEFAULT_TUNING);

  it('rejects a basket the run cannot pay for', () => {
    const cost = basketCost(stock, [0]);
    const broke = started('ECON', cost - 1);
    expect(canAfford(broke, stock, [0])).toBe(false);
    expect(() => applyPurchases(broke, stock, [0])).toThrow(/never go negative/);
    // ...and the state is untouched, not partially charged.
    expect(broke.currency).toBe(cost - 1);
  });

  it('rejects the whole basket rather than buying the affordable part', () => {
    // A player who selected three things and can afford two has not said which
    // two. A partial purchase is a decision nobody made.
    expect(stock.items.length, 'the fixture shelf is too short to test a basket').toBeGreaterThan(1);
    const all = stock.items.map((_, index) => index);
    const state = started('ECON', basketCost(stock, all) - 1);
    expect(() => applyPurchases(state, stock, all)).toThrow(/never go negative/);
  });

  it('rejects buying the same shelf slot twice', () => {
    const rich = started('ECON', 100_000);
    expect(() => applyPurchases(rich, stock, [0, 0])).toThrow(/same slot twice/);
  });

  it('rejects a slot that is not on the shelf', () => {
    const rich = started('ECON', 100_000);
    expect(() => applyPurchases(rich, stock, [stock.items.length])).toThrow(/does not exist/);
  });

  it('charges exactly the basket price and applies every item', () => {
    const rich = started('ECON', 100_000);
    const basket = stock.items.map((_, index) => index);
    const after = applyPurchases(rich, stock, basket);
    expect(after.currency).toBe(100_000 - basketCost(stock, basket));
    expect(after.currency).toBeGreaterThanOrEqual(0);
  });

  it('leaves the run alone on an empty basket', () => {
    const state = started('ECON', 500);
    expect(applyPurchases(state, stock, [])).toBe(state);
  });

  it('stays non-negative across a whole played run that spends everything', async () => {
    for (const seed of seeds.slice(0, 8)) {
      const run = await playRun(seed, spender());
      expect(run.state.currency, seed).toBeGreaterThanOrEqual(0);
    }
  });

  it('stays non-negative through a replayed log', async () => {
    // The condition the guarantee is really about: replay has no screen to grey
    // out a button, so if the rule lived in the UI this is where it would fail.
    for (const seed of seeds.slice(0, 8)) {
      const original = await playRun(seed, spender());
      const replayed = await replayRun(original.log);
      expect(replayed.state.currency, seed).toBe(original.state.currency);
      expect(replayed.state.currency).toBeGreaterThanOrEqual(0);
    }
  });

  it('refuses a tampered log that asks for a basket the run cannot pay for', async () => {
    // A corrupt log, which is the only way an unaffordable purchase can reach
    // the transition. It must throw rather than silently drop the item and
    // reconstruct a run that was never played.
    // Search the population for a run that actually reaches a shop. Returning
    // early on the first seed that does not would let this pass vacuously,
    // which for a test about a guarantee is worse than not having it.
    let original: Awaited<ReturnType<typeof playRun>> | null = null;
    let shopIndex = -1;
    for (const candidate of seeds) {
      const run = await playRun(candidate, { ...spender(), chooseShopPurchases: async () => [] });
      const index = run.log.decisions.findIndex((d) => d.kind === 'shop');
      if (index !== -1) {
        original = run;
        shopIndex = index;
        break;
      }
    }
    expect(original, 'no seed in the sample ever reached a shop').not.toBeNull();
    if (!original) return;

    const tampered: RunLog = {
      ...original.log,
      decisions: original.log.decisions.map((decision, index) =>
        index === shopIndex ? { kind: 'shop', indexes: [0, 1, 2, 3] } : decision,
      ),
    };
    await expect(replayRun(tampered)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. Events
// ---------------------------------------------------------------------------

describe('events', () => {
  it('resolves one outcome per choice when the map is built, not when it is picked', () => {
    for (const seed of seeds) {
      for (const node of allNodes(seed)) {
        const event = node.event;
        if (!event) continue;
        const definition = definitionOf(event);
        expect(definition, `${event.eventId} is not in the table`).not.toBeNull();
        expect(event.choices).toHaveLength(definition?.choices.length ?? 0);
        for (const choice of event.choices) {
          // Resolved: a concrete kind and a concrete payload, no pool left.
          // All three bands, since Stage 4.6c draws all three at generation
          // and any of them can be the one this run is paid at.
          for (const outcome of Object.values(choice.outcomes)) {
            expect(describeOutcome(outcome).length).toBeGreaterThan(0);
            if (outcome.kind === 'item') expect(typeof outcome.item).toBe('string');
          }
        }
      }
    }
  });

  it('cannot be rerolled by reloading before the choice', () => {
    // The whole point of resolving at generation. Two `createRun` calls on one
    // seed — which is what a reload is — must produce the same outcomes.
    const outcomes = (seed: string): EventOutcome[] =>
      allNodes(seed).flatMap((node) =>
        node.event?.choices.flatMap((choice) => Object.values(choice.outcomes)) ?? [],
      );
    expect(outcomes('ECON-EVENT')).toEqual(outcomes('ECON-EVENT'));
    expect(outcomes('ECON-EVENT').length).toBeGreaterThan(0);
  });

  it('serializes an outcome to plain data with no functions in it', () => {
    // A callback outcome would break the run log and would stop the simulator
    // being able to score a choice without executing it.
    for (const seed of seeds) {
      for (const node of allNodes(seed)) {
        for (const choice of node.event?.choices ?? []) {
          // Every band, since a callback smuggled into one of the two the
          // player is less likely to reach would be exactly as fatal.
          const round = JSON.parse(JSON.stringify(choice.outcomes)) as Record<string, EventOutcome>;
          expect(round).toEqual(choice.outcomes);
        }
      }
    }
  });

  it('never lets an event faint a party member or end a run', () => {
    // An event is a node with no battle in it. A run lost to one is a run lost
    // to a coin flip the player could see but never play.
    const state = started('ECON', 0);
    const nearlyDead = { ...state, party: state.party.map((m) => ({ ...m, hp: 1 })) };
    const after = applyEventOutcome(nearlyDead, { kind: 'damage', percent: 0.99 }, DEFAULT_TUNING);

    expect(after.party[0]!.hp).toBeGreaterThan(0);
    expect(after.party[0]!.fainted).toBe(false);
  });

  it('never lets an event drive currency below zero', () => {
    const broke = started('ECON', 10);
    const after = applyEventOutcome(broke, { kind: 'currency', amount: -500 }, DEFAULT_TUNING);
    expect(after.currency).toBe(0);
  });

  it('heals, pays and gives an item as the outcome says', () => {
    const hurt = { ...started('ECON', 0), party: started('ECON').party.map((m) => ({ ...m, hp: 1 })) };
    expect(applyEventOutcome(hurt, { kind: 'heal', percent: 1 }, DEFAULT_TUNING).party[0]!.hp).toBe(
      hurt.party[0]!.maxHp,
    );
    expect(applyEventOutcome(hurt, { kind: 'currency', amount: 60 }, DEFAULT_TUNING).currency).toBe(60);
    // Stage 4.5.1: an event item goes to the backpack like every other item the
    // run acquires. It used to be forced onto the lead, which silently
    // destroyed whatever that member was holding — the Stage 3 swap rule firing
    // on a decision the player was never offered.
    expect(
      applyEventOutcome(hurt, { kind: 'item', item: 'leftovers' }, DEFAULT_TUNING).backpack,
    ).toEqual(['leftovers']);
    expect(applyEventOutcome(hurt, { kind: 'nothing' }, DEFAULT_TUNING)).toBe(hurt);
  });

  it('gives every event at least two choices and every choice an outcome', () => {
    // A one-choice event is a cutscene. Asserted at the table so a bad event
    // fails here rather than as an empty screen mid-run.
    for (const event of EVENTS) {
      expect(event.choices.length, event.id).toBeGreaterThanOrEqual(2);
      expect(event.prompt.length, event.id).toBeGreaterThan(0);
      for (const choice of event.choices) {
        expect(choice.outcomes.length, `${event.id}/${choice.label}`).toBeGreaterThan(0);
        expect(choice.hint.length, `${event.id}/${choice.label}`).toBeGreaterThan(0);
        const total = choice.outcomes.reduce((sum, entry) => sum + entry.weight, 0);
        expect(total, `${event.id}/${choice.label} has no weight`).toBeGreaterThan(0);
      }
    }
  });

  it('replays an event to identical state', async () => {
    let replayedEvents = 0;
    for (const seed of seeds.slice(0, 8)) {
      const original = await playRun(seed, spender());
      if (!original.log.decisions.some((d) => d.kind === 'event')) continue;
      replayedEvents++;
      const replayed = await replayRun(original.log);
      expect(replayed.state.currency, seed).toBe(original.state.currency);
      expect(replayed.state.party.map((m) => m.hp), seed).toEqual(original.state.party.map((m) => m.hp));
      expect(replayed.state.party.map((m) => m.item), seed).toEqual(original.state.party.map((m) => m.item));
    }
    expect(replayedEvents, 'no seed in the sample resolved an event').toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Save, reload and resume across the new decision boundaries
// ---------------------------------------------------------------------------

describe('mid-run save across a reward, shop and event boundary', () => {
  it('resumes from every point in a run that shops, events and takes cards', async () => {
    /*
     * The spec names the boundary most likely to be wrong: a save taken
     * *between a battle and its reward choice*. That is the one point where the
     * run has already folded a fight into the party and is waiting on a
     * decision that will change it again, so a resume that reconstructed the
     * party from the log but not the pending question would diverge silently.
     *
     * Rather than guess which save that is, this resumes from all of them.
     */
    // `ECON-RESUME` until Stage 4.6a, after which that seed's run ended before
    // it was paid a card and the assertion below — which exists to stop exactly
    // that — said so. `scripts/scan-seed.ts spender` finds the replacement, and
    // bounds its length: this resumes from *every* save, so the test is
    // quadratic in the run.
    const seed = 'ECON-RESUME';
    const saves: RunLog[] = [];
    const original = await playRun(seed, spender(), DEFAULT_TUNING, {
      onDecision: (log) => saves.push(JSON.parse(JSON.stringify(log)) as RunLog),
    });

    const kinds = new Set(saves.at(-1)?.decisions.map((d) => d.kind));
    expect(kinds.has('reward'), 'this seed never paid a card, so it proves nothing').toBe(true);

    for (const [index, save] of saves.entries()) {
      const resumed = await resumeRun(save, spender());
      expect(resumed.outcome, `resuming from save ${index}`).toBe(original.outcome);
      expect(resumed.state.currency, `resuming from save ${index}`).toBe(original.state.currency);
      expect(resumed.log.decisions, `resuming from save ${index}`).toEqual(original.log.decisions);
    }
  });

  it('resumes correctly from the save taken immediately after a battle decision', async () => {
    // The named boundary, isolated. Every save whose last decision is a battle
    // choice is a save where a reward question may be the very next thing.
    const seed = 'ECON-BOUNDARY';
    const saves: RunLog[] = [];
    const original = await playRun(seed, spender(), DEFAULT_TUNING, {
      onDecision: (log) => saves.push(JSON.parse(JSON.stringify(log)) as RunLog),
    });

    const afterBattle = saves.filter((save) => save.decisions.at(-1)?.kind === 'battle');
    expect(afterBattle.length).toBeGreaterThan(0);
    for (const save of afterBattle) {
      const resumed = await resumeRun(save, spender());
      expect(resumed.state.currency).toBe(original.state.currency);
      expect(resumed.outcome).toBe(original.outcome);
    }
  });

  it('records shop and event decisions as indexes and nothing else', async () => {
    const runs = await Promise.all(seeds.slice(0, 8).map((seed) => playRun(seed, spender())));
    let shopDecisions = 0;
    let eventDecisions = 0;

    for (const run of runs) {
      for (const decision of run.log.decisions) {
        if (decision.kind === 'shop') {
          shopDecisions++;
          expect(Object.keys(decision).sort()).toEqual(['indexes', 'kind']);
        }
        if (decision.kind === 'event') {
          eventDecisions++;
          expect(Object.keys(decision).sort()).toEqual(['index', 'kind']);
        }
      }
      /*
       * Nothing derived: no prices, no item ids, no outcome text — checked
       * against the shop and event decisions rather than against the whole log.
       *
       * It used to scan `JSON.stringify(run.log)`, which was over-broad and
       * only passing by luck. Since Stage 4.5.1 an `items` decision carries the
       * ids of the items the player assigned — that is the *point* of it, a
       * backpack layout is a decision and an id is how it is recorded — so any
       * seed whose plan happened to assign Leftovers failed a test about shops.
       * Stage 4.5.2 shifted the rewards stream and found one.
       */
      const derived = run.log.decisions.filter(
        (decision) => decision.kind === 'shop' || decision.kind === 'event',
      );
      expect(JSON.stringify(derived)).not.toMatch(/price|leftovers|coins/i);
    }
    expect(shopDecisions + eventDecisions).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 6. The map still makes sense with five choosable kinds
// ---------------------------------------------------------------------------

describe('map shape with shops and events', () => {
  it('still guarantees somewhere to rest in every segment', () => {
    for (const seed of seeds) {
      for (const segment of createRun(seed).segments) {
        const restSteps = routeStepsOf(segment).filter((step) => step.options.some((o) => o.kind === 'rest'));
        expect(restSteps.length, `${seed} segment ${segment.index}`).toBeGreaterThanOrEqual(
          DEFAULT_TUNING.minRestSteps,
        );
      }
    }
  });

  it('still never repeats a kind within a step', () => {
    for (const seed of seeds) {
      for (const segment of createRun(seed).segments) {
        for (const step of routeStepsOf(segment)) {
          const kinds = step.options.map((option) => option.kind);
          // The 4.6a wild step is all-wild by design; test/generation.test.ts
          // carries the exception and asserts its tiers are distinct instead.
          if (kinds.every((kind) => kind === 'wild')) continue;
          expect(new Set(kinds).size, `${seed} s${segment.index} step ${step.index}`).toBe(kinds.length);
        }
      }
    }
  });

  it('still offers a fight in most steps', () => {
    // Shops and events are texture, not the run. A map where half the steps
    // have no fight in them is a map with no attrition and no pressure.
    let steps = 0;
    let withFight = 0;
    for (const seed of seeds) {
      for (let index = 0; index < SEGMENT_COUNT; index++) {
        for (const step of routeStepsOf(createRun(seed).segments[index])) {
          steps++;
          if (step.options.some((option) => option.tier !== null)) withFight++;
        }
      }
    }
    expect(withFight / steps).toBeGreaterThan(0.85);
  });
});
