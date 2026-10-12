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
  // The tutorial's target (`docs/spec/gymrun-patch-card-battle-hearts-and-tutorial.md`):
  // it never moves and never attacks, and a base shield shows a bubble popping.
  dummy: {
    id: 'dummy',
    name: 'Target Dummy',
    hp: 3,
    baseShield: 1,
    grade: 0,
    script: {
      kind: 'cycle',
      steps: [{ move: 'none', act: { k: 'none' } }],
    },
  },

  // Checkpoint 6 (`docs/spec/gymrun-card-run-shapes-prompt.md`): the card
  // run's veterans, one per enemy, each the same body with a harder pattern:
  // fewer idle steps, or a bigger hit. Act 2's lead waves and every wave of
  // act 3 field them (`encounters.ts` `VETERAN`). Every number and grade is
  // a first draft.
  'drone-mk2': {
    id: 'drone-mk2',
    name: 'Drone Mk II',
    hp: 3,
    baseShield: 1,
    grade: 3,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'hunt', act: { k: 'strike', n: 1 } },
        { move: 'advance', act: { k: 'none' } },
        {
          move: { if: 'slashInRange', then: 'none', else: 'hunt' },
          act: { if: 'slashInRange', then: { k: 'slash', n: 1 }, else: { k: 'strike', n: 1 } },
        },
        // The Drone's shield step, swapped for a heavier shot.
        { move: 'hunt', act: { k: 'strike', n: 2 } },
      ],
    },
  },
  'lancer-captain': {
    id: 'lancer-captain',
    name: 'Lancer Captain',
    hp: 3,
    baseShield: 0,
    grade: 2,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'none', act: { k: 'shield', n: 1 } },
        { move: 'hunt', act: { k: 'none' } },
        { move: 'none', act: { k: 'pierce', n: 2 } },
      ],
    },
  },
  'dire-hound': {
    id: 'dire-hound',
    name: 'Dire Hound',
    hp: 2,
    baseShield: 0,
    fast: true,
    grade: 2,
    script: {
      kind: 'cycle',
      // Every step bites: no advance step to rest on.
      steps: [
        { move: 'hunt', act: { k: 'strike', n: 1 } },
        { move: 'advance', act: { k: 'strike', n: 1 } },
      ],
    },
  },
  'heavy-turret': {
    id: 'heavy-turret',
    name: 'Heavy Turret',
    hp: 4,
    baseShield: 2,
    grade: 3,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'none', act: { k: 'shield', n: 1 } },
        { move: 'none', act: { k: 'strike', n: 2 } },
        { move: 'none', act: { k: 'strike', n: 2 } },
      ],
    },
  },
  juggernaut: {
    id: 'juggernaut',
    name: 'Juggernaut',
    hp: 5,
    baseShield: 2,
    grade: 3,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'advance', act: { k: 'shield', n: 2 } },
        {
          move: { if: 'slashInRange', then: 'none', else: 'hunt' },
          act: { if: 'slashInRange', then: { k: 'slash', n: 2 }, else: { k: 'shield', n: 1 } },
        },
        { move: 'none', act: { k: 'none' } },
      ],
    },
  },
  deadeye: {
    id: 'deadeye',
    name: 'Deadeye',
    hp: 2,
    baseShield: 1,
    grade: 4,
    script: {
      kind: 'cycle',
      // The Sniper's aim, one step shorter.
      steps: [
        { move: 'hunt', act: { k: 'none' } },
        { move: 'none', act: { k: 'strike', n: 3 } },
      ],
    },
  },
  halberdier: {
    id: 'halberdier',
    name: 'Halberdier',
    hp: 3,
    baseShield: 1,
    grade: 4,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'none', act: { k: 'shield', n: 1 } },
        { move: 'hunt', act: { k: 'none' } },
        { move: 'none', act: { k: 'pierce', n: 2 } },
      ],
    },
  },
  // The second boss, act 2's: one tile, so it hunts lanes as no Colossus can,
  // and hits harder than anything but the Colossus. A boss, so Push, Pull and
  // Stun do not move or hold it; it grants no Harpoon, which is the
  // Colossus's answer, but the Harpoon pins it if one is in hand.
  warlord: {
    id: 'warlord',
    name: 'Warlord',
    hp: 10,
    baseShield: 2,
    grade: 8,
    boss: true,
    script: {
      kind: 'cycle',
      steps: [
        { move: 'none', act: { k: 'shield', n: 2 } },
        { move: 'hunt', act: { k: 'pierce', n: 2 }, label: 'Lance' },
        {
          move: { if: 'slashInRange', then: 'none', else: 'advance' },
          act: { if: 'slashInRange', then: { k: 'slash', n: 2 }, else: { k: 'strike', n: 2 } },
          label: 'Cleave',
        },
      ],
    },
  },
};
