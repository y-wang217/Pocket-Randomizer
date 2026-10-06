/**
 * The Collector: the fight against everything the run traded away.
 * **Defender Mode, 2026-10-06.**
 *
 * One door slot (`DEFENDER_REVENGE`) is drawn at generation like every other
 * door: a class, a tier, a team, a sim seed and an offer. What this file adds
 * is a *reading* of that node against the run as it stands: once any trade has
 * happened, the slot is the Collector, a hard-tier trainer fielding the mons
 * the player gave away, at the rank's level; until then it is the door it was
 * drawn as. The reading happens where the run reads its options
 * (`run.nodeOptions`), so the map, the fight and the replay all see one node
 * and `segments` is never written.
 *
 * **Nothing here draws.** The team is a function of player decisions (which
 * trades were taken), which are inputs; the sim seed is the slot's own keyed
 * seed, untouched. So the Collector consumes no RNG, and a run that never
 * trades plays the slot exactly as a run on an older build would have.
 *
 * Beating the Collector pays one three-card offer per mon fielded, the extra
 * pages drawn on the slot at generation (`waves.ts`, `NodeSpec.revenge`), cap
 * `DEFENDER_REVENGE.maxTeam`.
 */
import { DEFENDER_REVENGE } from '../../data/defender';
import { defenderOpponentIvs, opponentLevel } from '../../data/scaling';
import { DEFENDER_REVENGE_CLASS } from '../../data/trainerClasses';
import type { NodeSpec } from '../encounters';
import type { DefenderRunState } from './opening';
import type { PokemonSpec, TeamSpec } from '../types';

/**
 * The Collector's team: the most recent `maxTeam` mons traded away, each as it
 * left (species, ability, moves, nickname), at the rank's hard-tier trainer
 * level with the rank's flat IV, and holding nothing: the item went to the
 * player's bag when the trade was taken.
 */
export function revengeTeam(tradedAway: readonly PokemonSpec[], rank: number): TeamSpec {
  const level = opponentLevel('trainer', rank, DEFENDER_REVENGE.tier).max;
  const ivs = defenderOpponentIvs(rank);
  return tradedAway.slice(-DEFENDER_REVENGE.maxTeam).map((spec) => {
    const { item: _item, ...rest } = spec;
    return { ...rest, level, ivs };
  });
}

/** Whether `node` is the slot the Collector can stand in: drawn with extra pages. */
export function isRevengeSlot(node: NodeSpec): boolean {
  return node.revenge !== undefined;
}

/**
 * `node` as the run sees it: the Collector, when `node` is the slot and the
 * run has traded; otherwise `node` itself, the same object, so a run that
 * never trades can tell nothing happened.
 */
export function revengeNodeFor(
  node: NodeSpec,
  state: { defender?: Pick<DefenderRunState, 'tradedAway'> | null; currentSegment: number },
): NodeSpec {
  const traded = state.defender?.tradedAway ?? [];
  if (!isRevengeSlot(node) || !node.encounter || traded.length === 0) return node;
  return {
    ...node,
    trainerClass: DEFENDER_REVENGE_CLASS.id,
    tier: DEFENDER_REVENGE.tier,
    encounter: {
      ...node.encounter,
      team: revengeTeam(traded, state.currentSegment),
      opponent: DEFENDER_REVENGE_CLASS.id,
    },
  };
}
