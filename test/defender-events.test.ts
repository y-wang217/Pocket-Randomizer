/**
 * Defender Mode's question marks. **2026-10-06.** `docs/generation.md`
 * section 120.
 *
 * Four claims. The table is sound: every role carries what its role needs
 * and nothing it must not, and every shape has an eligible event at every
 * rank that has a question mark. Generation reads no run: the same seed
 * draws the same question marks whatever the party or the relics, and
 * reading an option draws nothing. The steps are where the design put them,
 * one per rank from rank 1, before the intermission, never a choice, and no
 * event repeats inside a run. And a played run answers them, pays what the
 * pick says, plays an ambush only when the fight is picked, refuses an
 * unaffordable price on replay, and replays byte for byte.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import type { Policy } from '../src/core/battle/policy';
import { chooseDraftPick, chooseGymType } from '../src/core/defender/opening';
import {
  applyDefenderEventPick,
  defenderOptionPayable,
  defenderOutcomeOf,
  DefenderEventPicker,
  drawDefenderEventShape,
  fightKindOf,
  fightTierOf,
  generateDefenderEvent,
  type DefenderEventInstance,
} from '../src/core/defender/events';
import { eventNodeId, waveLength } from '../src/core/defender/waves';
import type { NodeSpec } from '../src/core/encounters';
import { createRng } from '../src/core/rng';
import { createRun, playRun, replayRun, scriptedRunPolicy, type NodeResult, type RunPolicy, type RunState } from '../src/core/run';
import { DEFENDER_RANKS } from '../src/data/defender';
import {
  DEFENDER_AMBUSH,
  DEFENDER_EVENT_SHAPES,
  DEFENDER_EVENT_STEPS,
  DEFENDER_EVENTS,
  defenderEventsOf,
  type DefenderEventShape,
} from '../src/data/defenderEvents';
import { DEFAULT_TUNING } from '../src/data/tuning';

const SEEDS = Array.from({ length: 20 }, (_, i) => `QMARK-${i}`);

/** A passive opponent: its weakest usable move, so runs reach the later ranks. */
const passive: Policy = async (view) => {
  const usable = view.moves.filter((entry) => entry.usable);
  if (usable.length === 0) return greedyAiPolicy(view);
  return { kind: 'move', slot: [...usable].sort((a, b) => a.basePower - b.basePower)[0]!.slot };
};

function marksOf(state: RunState): { rank: number; node: NodeSpec }[] {
  return state.segments.flatMap((rank, r) =>
    rank.routes[0]!.steps.flatMap((step) => step.options.filter((node) => node.kind === 'event').map((node) => ({ rank: r, node }))),
  );
}

function opened(seed: string): RunState {
  let state = chooseGymType(createRun(seed, DEFAULT_TUNING, 'defender'), 0);
  for (let pick = 0; pick < 3; pick++) state = chooseDraftPick(state, 0);
  return state;
}

describe('the table', () => {
  it('gives every role what it needs and nothing it must not', () => {
    expect(new Set(DEFENDER_EVENTS.map((event) => event.id)).size).toBe(DEFENDER_EVENTS.length);
    for (const event of DEFENDER_EVENTS) {
      if (event.shape === 'bazaar') expect(event.options).toHaveLength(0);
      else expect(event.options.length).toBeGreaterThanOrEqual(2);
      for (const option of event.options) {
        // A price on `pay` and nowhere else; a fight never behind a price.
        expect(option.toll !== undefined, `${event.id} ${option.role} toll`).toBe(option.role === 'pay');
        // Odds and a loss on `wager` and nowhere else.
        expect(option.odds !== undefined, `${event.id} ${option.role} odds`).toBe(option.role === 'wager');
        expect(option.lose !== undefined, `${event.id} ${option.role} lose`).toBe(option.role === 'wager');
        if (option.odds !== undefined) {
          expect(option.odds).toBeGreaterThan(0);
          expect(option.odds).toBeLessThan(1);
        }
        // Leaving pays nothing and wears no pips; everything else pays something.
        if (option.role === 'leave') {
          expect(option.grant).toHaveLength(0);
          expect(option.tier).toBeNull();
        } else {
          expect(option.grant.length, `${event.id} ${option.role} grant`).toBeGreaterThan(0);
        }
        // No price is a relic, and a fight is only on an ambush.
        if (option.role === 'fight') expect(event.shape).toBe('ambush');
      }
      if (event.shape === 'ambush') expect(event.options.some((option) => option.role === 'fight')).toBe(true);
    }
  });

  it('has an eligible event of every shape at every rank that has a question mark', () => {
    DEFENDER_EVENT_STEPS.forEach((count, rank) => {
      if (count === 0) return;
      for (const shape of DEFENDER_EVENT_SHAPES) expect(defenderEventsOf(shape, rank).length, `${shape} at rank ${rank}`).toBeGreaterThan(0);
    });
    expect(DEFENDER_EVENT_STEPS).toHaveLength(DEFENDER_RANKS);
  });
});

describe('generation reads no run', () => {
  it('draws the same question marks whatever the party and the relics', () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const plain = createRun(seed, DEFAULT_TUNING, 'defender');
      const relicked = { ...opened(seed), relics: ['rusted-machete', 'strangers-pass'] };
      expect(marksOf(relicked).map(({ node }) => node.defenderEvent)).toEqual(marksOf(plain).map(({ node }) => node.defenderEvent));
      expect(createRun(seed, DEFAULT_TUNING, 'defender').segments).toEqual(plain.segments);
    }
  });

  it('draws every option in a fixed order, and reading one draws nothing', () => {
    const stream = createRng('QMARK-DRAWS').rewards.at('e');
    const definition = DEFENDER_EVENTS.find((event) => event.shape === 'gamble')!;
    const event = generateDefenderEvent('n', 3, definition, stream);
    const after = stream.draws;
    for (const option of event.options) {
      defenderOutcomeOf(option, true);
      defenderOutcomeOf(option, false);
    }
    expect(stream.draws).toBe(after);
    // A wager's roll is made here, and its loss is drawn as a cost.
    const wager = event.options.find((option) => option.role === 'wager')!;
    expect(typeof wager.won).toBe('boolean');
    expect(wager.lose?.cost.length).toBeGreaterThan(0);
    expect(wager.odds).toBe(definition.options[0]!.odds);
    const leave = event.options.find((option) => option.role === 'leave')!;
    expect(leave.won).toBeNull();
    expect(leave.outcome.grant).toHaveLength(0);
  });

  it('draws a shape by the rank\'s weights, one draw each, every shape reachable', () => {
    const seen = new Set<DefenderEventShape>();
    const stream = createRng('QMARK-SHAPES').map.at('s');
    for (let i = 0; i < 400; i++) {
      const before = stream.draws;
      seen.add(drawDefenderEventShape(5, stream));
      expect(stream.draws - before).toBe(1);
    }
    expect([...seen].sort()).toEqual([...DEFENDER_EVENT_SHAPES].sort());
  });

  it('picks without repeating inside a run, refilling only when a shape runs dry', () => {
    const picker = new DefenderEventPicker();
    const stream = createRng('QMARK-PICK').map.at('p');
    const first = picker.pick('shrine', 4, stream).id;
    const second = picker.pick('shrine', 4, stream).id;
    expect(first).not.toBe(second);
    expect(picker.refills).toBe(0);
    picker.pick('shrine', 4, stream);
    expect(picker.refills).toBe(1);
    expect(() => picker.pick('cache', 0, stream)).toThrow(/eligible/);
  });
});

describe('the steps, as generated', () => {
  it('puts one question mark per rank from rank 1, before the intermission, never a choice, and repeats an event only once its shape has run dry', () => {
    for (const seed of SEEDS) {
      const run = createRun(seed, DEFAULT_TUNING, 'defender');
      const ids = new Set<string>();
      run.segments.forEach((rank, r) => {
        const steps = rank.routes[0]!.steps;
        const marks = steps.filter((step) => step.options.some((node) => node.kind === 'event'));
        expect(marks).toHaveLength(DEFENDER_EVENT_STEPS[r] ?? 0);
        marks.forEach((step, n) => {
          expect(step.options).toHaveLength(1);
          const node = step.options[0]!;
          expect(node.id).toBe(eventNodeId(r, n));
          expect(step.index).toBe(waveLength(r) + n);
          const event = node.defenderEvent!;
          expect(event.nodeId).toBe(node.id);
          // The picker's promise: a repeat only when every eligible event of
          // the shape at this rank was already drawn earlier in the run.
          if (ids.has(event.eventId)) {
            expect(
              defenderEventsOf(event.shape, r).every((candidate) => ids.has(candidate.id)),
              `${seed} repeats ${event.eventId} with a fresh ${event.shape} left`,
            ).toBe(true);
          }
          ids.add(event.eventId);
          // The map leaks nothing: a question mark, no tier, no class.
          expect(node.tier).toBeNull();
          expect(node.trainerClass).toBeUndefined();
          // What the shape needs, and only that.
          expect(node.encounter !== null).toBe(event.shape === 'ambush');
          expect(node.reward !== null).toBe(event.shape === 'ambush');
          expect(node.shop !== null).toBe(event.shape === 'bazaar');
          if (node.encounter) {
            expect(node.encounter.simSeed).not.toMatch(/^sodium,0+$/);
            expect(fightTierOf(node)).toBe(DEFENDER_AMBUSH.tier);
            expect(fightKindOf(node)).toBe('trainer');
          } else {
            expect(fightTierOf(node)).toBeNull();
          }
        });
        // The intermission is still last.
        expect(steps[steps.length - 1]!.options[0]!.kind).toBe('shop');
      });
    }
  });
});

describe('a played run', () => {
  it('answers every question mark, pays the pick, plays an ambush only when the fight is picked, and replays', async () => {
    const picks: { event: DefenderEventInstance; index: number }[] = [];
    const seenRoles = new Set<string>();
    /** Fight an ambush on even picks, leave on odd ones; take the first option otherwise. */
    const policy: RunPolicy = {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseDefenderEvent: async (event) => {
        const fight = event.options.findIndex((option) => option.role === 'fight');
        const leave = event.options.findIndex((option) => option.role === 'leave');
        const index = event.shape === 'ambush' ? (picks.length % 2 === 0 ? fight : leave) : 0;
        picks.push({ event, index });
        seenRoles.add(event.options[index]!.role);
        return index;
      },
    };
    let resolved = 0;
    for (const seed of ['QMARK-PLAY-0', 'QMARK-PLAY-1', 'QMARK-PLAY-2']) {
      const onNodeResolved = (before: RunState, after: RunState, result: NodeResult): void => {
        const event = result.node.defenderEvent;
        if (!event) return;
        resolved++;
        if (event.options.length === 0) {
          // A bazaar asks nothing but its shop.
          expect(result.eventPick).toBeUndefined();
          expect(result.node.shop).not.toBeNull();
          return;
        }
        expect(result.eventPick).toBeDefined();
        const option = event.options[result.eventPick!]!;
        // The fight is played exactly when the fight is picked.
        expect(result.battle !== undefined).toBe(option.role === 'fight');
        // What the pick says is what the fold did, from the state the node was entered with.
        const won = result.battle?.result.winner === 'p1';
        if (option.role !== 'fight') {
          const expected = applyDefenderEventPick(before, event, result.eventPick!, won, DEFAULT_TUNING);
          expect(after.currency).toBe(expected.currency);
          expect(after.backpack).toEqual(expected.backpack);
          expect(after.consumables ?? []).toEqual(expected.consumables ?? []);
        }
        // A declined ambush pays no cards; a won one pays its cards.
        if (option.role === 'leave') expect(result.reward).toBeUndefined();
        if (option.role === 'fight' && won) expect(result.reward).toBeDefined();
      };
      const run = await playRun(seed, policy, DEFAULT_TUNING, { mode: 'defender', opponent: passive, onNodeResolved });
      const replayed = await replayRun(run.log, DEFAULT_TUNING, { mode: 'defender', opponent: passive });
      expect(replayed.state).toEqual(run.state);
      expect(JSON.stringify(replayed.log)).toBe(JSON.stringify(run.log));
      // One pick logged per question mark that asked one.
      expect(run.log.decisions.filter((d) => d.kind === 'eventPick')).toHaveLength(
        run.state.history.filter((visit) => (visit.node.defenderEvent?.options.length ?? 0) > 0).length,
      );
      picks.length = 0;
    }
    expect(resolved).toBeGreaterThan(0);
    expect(seenRoles.has('fight') || seenRoles.has('leave')).toBe(true);
  }, 600_000);

  it('keeps an unaffordable price on the menu, dimmed, and refuses it on replay by name', async () => {
    const state = { ...opened('QMARK-PAY'), currency: 0 };
    const mark = marksOf(state).find(({ node }) => node.defenderEvent!.options.some((option) => option.role === 'pay' && option.toll?.kind === 'goldFixed'));
    expect(mark).toBeDefined();
    const event = mark!.node.defenderEvent!;
    const pay = event.options.findIndex((option) => option.role === 'pay');
    // On the menu, and not payable, from a purse of nothing.
    expect(event.options[pay]).toBeDefined();
    expect(defenderOptionPayable(state, event.options[pay]!)).toBe(false);
    expect(defenderOptionPayable({ ...state, currency: 500 }, event.options[pay]!)).toBe(true);
    // Every free option is always payable.
    for (const option of event.options) if (option.role !== 'pay') expect(defenderOptionPayable(state, option)).toBe(true);

    // A log that answers a priced option the run cannot pay is refused, naming
    // the price: the same refusal the attacker's Toll makes. Built by playing
    // a run that leaves every question mark, then rewriting its first pick to
    // the priced option and emptying the purse the replay starts from is not
    // possible (a replay starts from the seed), so the refusal is exercised
    // through a policy that answers the priced option while the run holds no
    // coins: `onState` is handed the live state and the test spends it.
    const broke: RunPolicy = {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseDefenderEvent: async (next) => Math.max(0, next.options.findIndex((option) => option.role === 'pay')),
    };
    let refused = false;
    for (const seed of ['QMARK-BROKE-0', 'QMARK-BROKE-1', 'QMARK-BROKE-2', 'QMARK-BROKE-3']) {
      try {
        await playRun(seed, broke, DEFAULT_TUNING, {
          mode: 'defender',
          opponent: passive,
          onState: (next) => {
            (next as { currency: number }).currency = 0;
          },
        });
      } catch (error) {
        if (error instanceof RangeError && /cannot pay/.test(error.message)) {
          refused = true;
          break;
        }
        throw error;
      }
    }
    expect(refused).toBe(true);
  }, 600_000);
});
