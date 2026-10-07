/**
 * The Collector: the fight against everything the run traded away.
 * **Defender Mode, 2026-10-06.** `docs/generation.md` section 119.
 *
 * Three claims. The slot is drawn like any door and carries its extra pages
 * on every seed; the Collector is a *reading* of that slot against the run,
 * so a run that never trades sees the very object the seed drew; and a played
 * run that trades meets the Collector at the slot, is paid one page per mon
 * fielded, and replays.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import type { Policy } from '../src/core/battle/policy';
import { revengeNodeFor, revengeTeam } from '../src/core/defender/revenge';
import { revengeNodeId, waveLength } from '../src/core/defender/waves';
import { createRun, playRun, replayRun, scriptedRunPolicy, type NodeResult, type RunPolicy, type RunState } from '../src/core/run';
import type { NodeSpec } from '../src/core/encounters';
import type { PokemonSpec } from '../src/core/types';
import { DEFENDER_RANKS, DEFENDER_REVENGE } from '../src/data/defender';
import { defenderOpponentIvs, opponentLevel } from '../src/data/scaling';
import { DEFENDER_REVENGE_CLASS, TRAINER_CLASSES, classesAtRank, trainerClass } from '../src/data/trainerClasses';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { firstRunWhere, seedRange } from './seed-search';

const SEEDS = Array.from({ length: 20 }, (_, i) => `REVENGE-${i}`);

/** A passive opponent: its weakest usable move, so runs reach the later ranks. */
const passive: Policy = async (view) => {
  const usable = view.moves.filter((entry) => entry.usable);
  if (usable.length === 0) return greedyAiPolicy(view);
  return { kind: 'move', slot: [...usable].sort((a, b) => a.basePower - b.basePower)[0]!.slot };
};

function slotOf(state: RunState): NodeSpec {
  const rank = DEFENDER_REVENGE.rank;
  const step = state.segments[rank]!.routes[0]!.steps[waveLength(rank) - 1]!;
  return step.options[DEFENDER_REVENGE.side]!;
}

const mon = (species: string, level = 10): PokemonSpec => ({ species, ability: 'Blaze', moves: ['Ember'], level, item: 'oranberry' });

describe('the slot, as generated', () => {
  it('is one door in the run, drawn as an ordinary door, carrying its extra pages on every seed', () => {
    for (const seed of SEEDS) {
      const run = createRun(seed, DEFAULT_TUNING, 'defender');
      const slots: NodeSpec[] = [];
      run.segments.forEach((rank, r) => {
        for (const node of [...rank.routes[0]!.steps.flatMap((step) => step.options), rank.gym]) {
          if (node.revenge) {
            slots.push(node);
            expect(node.id).toBe(revengeNodeId(r));
          }
        }
      });
      expect(slots).toHaveLength(1);
      const slot = slots[0]!;
      expect(slot).toBe(slotOf(run));
      // The door it was drawn as: a class of its rank, never the Collector.
      expect(classesAtRank(DEFENDER_REVENGE.rank).map((entry) => entry.id)).toContain(slot.trainerClass);
      expect(slot.trainerClass).not.toBe(DEFENDER_REVENGE_CLASS.id);
      // The pages: one per mon beyond the first, three cards each, no trade among them.
      expect(slot.revenge!.offers).toHaveLength(DEFENDER_REVENGE.maxTeam - 1);
      for (const page of slot.revenge!.offers) {
        expect(page.options).toHaveLength(3);
        expect(page.options.some((card) => card.kind === 'trade')).toBe(false);
      }
    }
    expect(Array.from({ length: DEFENDER_RANKS }, (_, r) => revengeNodeId(r)).filter(Boolean)).toHaveLength(1);
  });

  it('keeps the Collector out of the door draw and in the class lookup', () => {
    expect(TRAINER_CLASSES.some((entry) => entry.id === DEFENDER_REVENGE_CLASS.id)).toBe(false);
    for (let r = 0; r < DEFENDER_RANKS; r++) expect(classesAtRank(r)).not.toContain(DEFENDER_REVENGE_CLASS);
    expect(trainerClass(DEFENDER_REVENGE_CLASS.id)).toBe(DEFENDER_REVENGE_CLASS);
  });
});

describe('the reading', () => {
  it('is the drawn door itself, the same object, while nothing has been traded', () => {
    const run = createRun('REVENGE-READ', DEFAULT_TUNING, 'defender');
    const slot = slotOf(run);
    expect(revengeNodeFor(slot, { defender: { tradedAway: [] }, currentSegment: DEFENDER_REVENGE.rank })).toBe(slot);
    expect(revengeNodeFor(slot, { defender: null, currentSegment: DEFENDER_REVENGE.rank })).toBe(slot);
    // And any other door is itself whatever was traded.
    const other = run.segments[0]!.routes[0]!.steps[0]!.options[0]!;
    expect(revengeNodeFor(other, { defender: { tradedAway: [mon('Charmander')] }, currentSegment: 0 })).toBe(other);
  });

  it('is the Collector once a trade has happened: the traded mons, capped, at the rank, with the slot\'s own seed and pages', () => {
    const run = createRun('REVENGE-READ', DEFAULT_TUNING, 'defender');
    const slot = slotOf(run);
    const traded = ['Charmander', 'Vulpix', 'Growlithe', 'Ponyta', 'Magby', 'Slugma', 'Numel'].map((s, i) => mon(s, 5 + i));
    const read = revengeNodeFor(slot, { defender: { tradedAway: traded }, currentSegment: DEFENDER_REVENGE.rank });
    expect(read).not.toBe(slot);
    expect(read.id).toBe(slot.id);
    expect(read.trainerClass).toBe(DEFENDER_REVENGE_CLASS.id);
    expect(read.tier).toBe(DEFENDER_REVENGE.tier);
    expect(read.encounter!.simSeed).toBe(slot.encounter!.simSeed);
    expect(read.encounter!.opponent).toBe(DEFENDER_REVENGE_CLASS.id);
    expect(read.reward).toBe(slot.reward);
    expect(read.revenge).toBe(slot.revenge);
    const team = read.encounter!.team;
    expect(team).toHaveLength(DEFENDER_REVENGE.maxTeam);
    expect(team.map((spec) => spec.species)).toEqual(traded.slice(-DEFENDER_REVENGE.maxTeam).map((spec) => spec.species));
    const level = opponentLevel('trainer', DEFENDER_REVENGE.rank, DEFENDER_REVENGE.tier).max;
    for (const spec of team) {
      expect(spec.level).toBe(level);
      expect(spec.ivs).toBe(defenderOpponentIvs(DEFENDER_REVENGE.rank));
      expect(spec.item).toBeUndefined();
      expect(spec.moves).toEqual(['Ember']);
    }
    expect(revengeTeam([mon('Charmander')], 3)).toHaveLength(1);
  });
});

describe('a played run that trades', () => {
  it('meets the Collector at the slot, is paid one page per mon fielded, and replays', async () => {
    let collected: { result: NodeResult; before: RunState; after: RunState } | null = null;
    const policy: RunPolicy = {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseReward: async (offer) => Math.max(0, offer.options.findIndex((card) => card.kind === 'trade')),
      chooseDoor: async (options) => Math.max(0, options.findIndex((node) => node.trainerClass === DEFENDER_REVENGE_CLASS.id)),
    };
    const { run } = await firstRunWhere(
      seedRange('REVENGE-PLAY-', 12),
      async (seed) => {
        collected = null;
        return playRun(seed, policy, DEFAULT_TUNING, {
          mode: 'defender',
          opponent: passive,
          onNodeResolved: (before, after, result) => {
            if (result.node.trainerClass === DEFENDER_REVENGE_CLASS.id) collected = { result, before, after };
          },
        });
      },
      (played) => played.state.history.some((visit) => visit.node.trainerClass === DEFENDER_REVENGE_CLASS.id),
      'met the Collector',
    );
    const met = collected as { result: NodeResult; before: RunState; after: RunState } | null;
    expect(met).not.toBeNull();
    const { result, before } = met!;
    expect(result.node.id).toBe(revengeNodeId(DEFENDER_REVENGE.rank));
    const fielded = result.node.encounter!.team.length;
    expect(fielded).toBe(Math.min(DEFENDER_REVENGE.maxTeam, before.defender!.tradedAway.length));
    if (result.battle?.result.winner === 'p1') {
      expect(result.reward).toBeDefined();
      expect(result.extraRewards ?? []).toHaveLength(fielded - 1);
    } else {
      expect(result.extraRewards).toBeUndefined();
    }
    const replayed = await replayRun(run.log, DEFAULT_TUNING, { mode: 'defender', opponent: passive });
    expect(replayed.state).toEqual(run.state);
    expect(JSON.stringify(replayed.log)).toBe(JSON.stringify(run.log));
  }, 600_000);
});
