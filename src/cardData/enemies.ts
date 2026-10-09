/**
 * Drone and Lancer. Appendix A, Enemies. Each plays its steps in order, one per
 * round, then loops; the starting step is rolled per enemy (E6).
 */
import type { EnemyDef, EnemyDefId } from '../core/cards/defs';

export const ENEMIES: Readonly<Record<EnemyDefId, EnemyDef>> = {
  drone: {
    id: 'drone',
    name: 'Drone',
    hp: 3,
    baseShield: 1,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'hunt', act: { k: 'strike', n: 1 } },
        { move: 'advance', act: { k: 'none' } },
        {
          move: { if: 'slashInRange', then: 'none', else: 'hunt' },
          act: { if: 'slashInRange', then: { k: 'slash', n: 1 }, else: { k: 'strike', n: 1 } },
        },
        { move: 'none', act: { k: 'shield', n: 1 } },
        { move: 'hunt', act: { k: 'strike', n: 1 } },
        { move: 'advance', act: { k: 'none' } },
      ],
    },
  },
  lancer: {
    id: 'lancer',
    name: 'Lancer',
    hp: 2,
    baseShield: 0,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'none', act: { k: 'shield', n: 1 } },
        { move: 'hunt', act: { k: 'none' } },
        { move: 'none', act: { k: 'pierce', n: 1 } },
      ],
    },
  },
};
