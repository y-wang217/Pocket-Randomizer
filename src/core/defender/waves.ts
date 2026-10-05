/**
 * A defender rank: a wave of doors, an intermission and a boss. **Defender
 * Mode v0, step 3.**
 *
 * Its own generator rather than `generateSegment` under different tuning
 * (report section 8): tuning can build the doors, but not switch locales off,
 * place the intermission, draw classes or narrow the relic pool, and every one
 * of those would have been a branch in the attacker's most fragile code. What
 * it emits is the attacker's own `Segment` shape, so the run loop, `playNode`,
 * `resolveNode`, the result screen and every payout downstream of them treat a
 * rank as a segment with one route.
 *
 * A rank's route is `DEFENDER_WAVE_LENGTH[rank]` door steps, each two trainer
 * nodes of two different classes, then one intermission step holding a single
 * shop node. The intermission is a step so `position`, `betweenNodes`, the shop
 * question and the teach gate all work unchanged; it is **not a choice**, and
 * the run loop plays it without asking (`core/run.ts`). The boss is the
 * segment's `gym`, fought after it.
 *
 * ## Passes, in the attacker's order and on the attacker's streams
 *
 *   1. Per door, on `map`: two classes, then two tiers.
 *   2. Per battle node, on `randomizer`: the team.
 *   3. Per battle node, on `battle`: the sim seed.
 *   4. Per node, on `rewards`: the reward offer, or the shop's stock.
 *   5. The boss payout, on `rewards`.
 *
 * Every key is a `defender/` key, so no attacker sequence is read, and each
 * key names a thing that draws (a door, a node, a rank's boss payout), never a
 * moment. Nothing here reads player state: the whole map is drawn at creation,
 * every door's both sides included.
 */
import {
  DEFENDER_BOSS_RELIC_IDS,
  DEFENDER_CONSUMABLE_ENTRY,
  DEFENDER_RELIC_IDS,
  DEFENDER_WAVE_LENGTH,
} from '../../data/defender';
import { defenderOpponentIvs } from '../../data/scaling';
import type { Tuning } from '../../data/tuning';
import { generateShopStock } from '../economy';
import { assignTiers, type NodeSpec, type Segment, type Step } from '../encounters';
import { generateBossTeam, generateClassTeam } from '../randomizer';
import { generateGymRewardOffer, generateRewardOffer } from '../rewards';
import type { Rng, SimSeed } from '../rng';
import { defenderBossRewardKey, defenderDoorKey, defenderNodeKey, defenderNodeRewardKey } from '../streamKeys';
import type { Tier } from '../types';
import { drawDoorClasses } from './classes';
import { drawTrade } from './trade';

/** Overwritten in pass 3; never reaches a battle. */
const PLACEHOLDER_SEED: SimSeed = `sodium,${'0'.repeat(64)}`;

/** Node ids. `r` is the rank, `d` the door, the last field the side. */
export function doorNodeId(rank: number, door: number, side: number): string {
  return `r${rank}-d${door}-${side}`;
}

export function intermissionNodeId(rank: number): string {
  return `r${rank}-intermission`;
}

export function bossNodeId(rank: number): string {
  return `r${rank}-boss`;
}

/** How many doors rank `rank` has. Clamped to the table's ends. */
export function waveLength(rank: number): number {
  const index = Math.max(0, Math.min(DEFENDER_WAVE_LENGTH.length - 1, rank));
  return DEFENDER_WAVE_LENGTH[index] ?? 0;
}

function emptyNode(id: string, kind: NodeSpec['kind'], label: string): NodeSpec {
  return {
    id,
    kind,
    locale: null,
    tier: null,
    label,
    encounter: null,
    reward: null,
    gymMoveOffer: null,
    shop: null,
    event: null,
    acquisition: null,
  };
}

export function generateRank(rank: number, rng: Rng, tuning: Tuning): Segment {
  const ivs = defenderOpponentIvs(rank);
  const steps: Step[] = [];

  // --- passes 1 and 2: each door's classes and tiers, then its teams --------
  for (let door = 0; door < waveLength(rank); door++) {
    const doorStream = rng.map.at(defenderDoorKey(rank, door));
    const classes = drawDoorClasses(rank, doorStream);
    const tiers = assignTiers(['trainer', 'trainer'], rank, doorStream, tuning);
    steps.push({
      index: door,
      options: classes.map((trainerClass, side) => {
        const id = doorNodeId(rank, door, side);
        const tier: Tier = tiers[side] ?? 'normal';
        const team = generateClassTeam(trainerClass.types, rank, tier, ivs, rng.randomizer.at(defenderNodeKey(id)));
        return {
          ...emptyNode(id, 'trainer', 'Trainer battle'),
          trainerClass: trainerClass.id,
          tier,
          encounter: { team, opponent: trainerClass.id, simSeed: PLACEHOLDER_SEED },
        };
      }),
    });
  }

  // The intermission: one shop node, a step of its own, never a choice.
  const intermission = emptyNode(intermissionNodeId(rank), 'shop', 'Intermission');
  steps.push({ index: steps.length, options: [intermission] });

  const boss: NodeSpec = {
    ...emptyNode(bossNodeId(rank), 'gym', 'Boss'),
    encounter: {
      team: generateBossTeam(rank, ivs, rng.randomizer.at(defenderNodeKey(bossNodeId(rank)))),
      opponent: 'boss',
      simSeed: PLACEHOLDER_SEED,
    },
  };

  const battles = [...steps.flatMap((step) => step.options), boss].filter((node) => node.encounter);

  // --- pass 3: sim seeds ------------------------------------------------------
  for (const node of battles) {
    if (node.encounter) node.encounter.simSeed = rng.battle.at(defenderNodeKey(node.id)).nextSimSeed();
  }

  // --- pass 4: what each node pays -------------------------------------------
  for (const node of steps.flatMap((step) => step.options)) {
    if (node.tier) {
      const offer = generateRewardOffer(
        node.id,
        node.tier,
        rank,
        rng.rewards.at(defenderNodeRewardKey(node.id, 'offer')),
        tuning,
        DEFENDER_RELIC_IDS,
        [DEFENDER_CONSUMABLE_ENTRY],
      );
      // At most one trade per offer, and it takes the last card. Drawn on its
      // own key whether or not it is carried (`drawTrade`).
      const trade = drawTrade(node.id, rank, rng);
      node.reward = trade ? { ...offer, options: [...offer.options.slice(0, -1), trade] } : offer;
    } else if (node.kind === 'shop') {
      node.shop = generateShopStock(node.id, rank, rng.rewards.at(defenderNodeRewardKey(node.id, 'shop')), tuning);
    }
  }

  // --- pass 5: the boss payout, both pages ----------------------------------
  // The boss page's relics include the Stranger's Pass; a door's never do.
  const pays = generateGymRewardOffer(boss.id, rank, rng.rewards.at(defenderBossRewardKey(rank)), tuning, DEFENDER_BOSS_RELIC_IDS);
  boss.reward = pays.offer;
  boss.gymMoveOffer = pays.moveOffer;

  return {
    index: rank,
    eventRefills: 0,
    leader: '',
    type: '',
    gymDefinition: { id: `defender-boss-${rank}`, leader: '', type: '', segment: rank, blurb: '' },
    localeOffer: [],
    routes: [{ locale: null, steps }],
    gym: boss,
  };
}
