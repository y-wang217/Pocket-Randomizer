/**
 * The enemies. Each plays its steps in order, one per round, then loops; the
 * starting step is rolled per enemy (E6), among its non-damaging steps under
 * opening grace, and a Fast enemy starts on its first damaging step.
 *
 * Drone and Lancer are Appendix A. The other five are
 * `docs/spec/gymrun-patch-card-battle-grace-friendly-fire.md` A3, built from
 * the existing vocabulary only. Every `grade` is provisional: the bot's
 * per-scenario numbers (Part B) are what correct them.
 */
import type { EnemyDef, EnemyDefId } from '../core/cards/defs';

export const ENEMIES: Readonly<Record<EnemyDefId, EnemyDef>> = {
  drone: {
    id: 'drone',
    name: 'Drone',
    hp: 3,
    baseShield: 1,
    grade: 2,
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
    grade: 1,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'none', act: { k: 'shield', n: 1 } },
        { move: 'hunt', act: { k: 'none' } },
        { move: 'none', act: { k: 'pierce', n: 1 } },
      ],
    },
  },
  hound: {
    id: 'hound',
    name: 'Hound',
    hp: 2,
    baseShield: 0,
    fast: true,
    grade: 1,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'hunt', act: { k: 'strike', n: 1 } },
        { move: 'advance', act: { k: 'none' } },
      ],
    },
  },
  turret: {
    id: 'turret',
    name: 'Turret',
    hp: 4,
    baseShield: 1,
    grade: 2,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'none', act: { k: 'shield', n: 1 } },
        { move: 'none', act: { k: 'strike', n: 2 } },
        { move: 'none', act: { k: 'none' } },
      ],
    },
  },
  bulwark: {
    id: 'bulwark',
    name: 'Bulwark',
    hp: 4,
    baseShield: 2,
    grade: 2,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'advance', act: { k: 'shield', n: 2 } },
        {
          move: { if: 'slashInRange', then: 'none', else: 'hunt' },
          act: { if: 'slashInRange', then: { k: 'slash', n: 1 }, else: { k: 'shield', n: 1 } },
        },
        { move: 'none', act: { k: 'none' } },
      ],
    },
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    hp: 2,
    baseShield: 0,
    grade: 3,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'hunt', act: { k: 'none' } },
        { move: 'none', act: { k: 'none' } },
        { move: 'none', act: { k: 'strike', n: 3 } },
      ],
    },
  },
  pikeman: {
    id: 'pikeman',
    name: 'Pikeman',
    hp: 3,
    baseShield: 1,
    grade: 3,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'none', act: { k: 'shield', n: 1 } },
        { move: 'hunt', act: { k: 'none' } },
        { move: 'none', act: { k: 'none' } },
        { move: 'none', act: { k: 'pierce', n: 2 } },
      ],
    },
  },
  // Part D (`docs/spec/gymrun-card-battle-rulings-waves-boss-reskin.md`):
  // two by two, it Crushes both its lanes, Stomps every lane in front of it,
  // advances up to three rows, and once, at half HP, stalks.
  colossus: {
    id: 'colossus',
    name: 'Colossus',
    hp: 12,
    baseShield: 3,
    grade: 10,
    size: { lanes: 2, cols: 2 },
    advanceSteps: 3,
    boss: true,
    stalks: true,
    grants: 'harpoon',
    script: {
      kind: 'cycle',
      steps: [
        { move: 'none', act: { k: 'pierce', n: 2 }, label: 'Crush' },
        { move: 'advance', act: { k: 'slash', n: 1 }, label: 'Stomp' },
        { move: 'none', act: { k: 'shield', n: 3 } },
      ],
    },
  },
};
