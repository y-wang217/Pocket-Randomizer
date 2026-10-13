/**
 * Every rule number the card engine reads, in one typed object. **The card
 * battle engine, checkpoint 1.**
 *
 * Values are the design snapshot's defaults, Appendix A of
 * `docs/spec/gymrun-card-battle-engine-prompt.md`, ids kept beside each. If a
 * tuning pass has to edit a resolver instead of this file, the split is wrong.
 *
 * Lives outside `src/data/` on purpose: the run's `contentHash` is a glob over
 * that directory, and the sandbox must not move it
 * (`docs/spec/gymrun-card-battle-engine-rulings.md`).
 */
import type { Rules } from '../core/cards/defs';

export const RULES: Rules = {
  // The danger zone is three deep, so it is harder to cross
  // (`docs/spec/gymrun-patch-card-battle-scenarios-and-bot.md`).
  board: { lanes: 3, cols: 7 },
  zones: {
    playerBackline: [1, 2],
    danger: [3, 4, 5],
    enemyBackline: [6, 7],
  },
  deployZone: 'playerBackline',
  spawnZone: 'enemyBackline',
  reach: {
    player: { min: 1, max: 5 },
    enemy: { min: 3, max: 7 },
  },
  forward: { player: 1, enemy: -1 },
  handSize: 5,
  // R2, superseded by the shared mana ruling of 2026-10-12
  // (`docs/spec/gymrun-patch-card-battle-shared-mana.md`): one pool for every
  // unit, refilled each turn to the sum of their max MP, one each by default.
  mp: { perUnit: 1 },
  // The supply pack after each wave (`docs/spec/gymrun-patch-card-battle-fewer-rests-wave-reward.md`).
  // First drafts: a wave's pack is smaller than a fight's 2 supplies.
  waveReward: { supplies: 1, hp: 1, mp: 2 },
  // Melee into the end zone (`docs/reports/floor-2-design.md`): one hit there, then repelled.
  endZone: { meleeReachMax: 7, repelCol: 5 },
  playerShieldClears: 'nextTurnStart', // R3
  strikeReach: 'anyDistanceInLane', // R4
  patterns: { slashCols: 1, blastCols: 2, blastNeighbours: 'orthogonal' }, // R5
  keywordZone: { strike: 'anywhere', pierce: 'anywhere', slash: 'danger', blast: 'danger' },
  damageNeedsTarget: true,
  targetOnFriendly: 'friendlyUnits', // R6
  faintScope: 'battle', // R10
  baseShield: 'oneTime', // R11
  mpFromCards: 'usableNextTurn', // R12
  targetOnPattern: 'chosenUnitAnyRange', // R13
  // R14, Blast only: it hits allies on its tiles, not the unit that plays it
  // (`docs/spec/gymrun-patch-card-battle-grace-friendly-fire.md` A2).
  blastFriendlyFire: 'alliesExceptCaster',
  moveShape: 'orthogonalInsideReach', // R15
  huntTieBreak: ['nearestLane', 'lowestHp', 'upperLane'], // E1
  huntDistance: 'anyLanesBeforeBlocker', // E2
  enemySlashFromCols: [3, 4, 5], // E3: the danger zone
  advance: { cols: 1, limitCol: 3, ifBlocked: 'wait' }, // E4
  enemyShieldClears: 'ownNextAction', // E5
  startingStep: 'rolledPerEnemy', // E6
  // Round 1: a non-Fast enemy opens on a step that deals no damage (A1).
  openingGrace: true,
  // Not in the snapshot. The fun test expects 4 to 7 rounds; the cap only
  // guarantees a battle ends, and the fuzz gate asserts no bot reaches it.
  roundCap: 30,
  // D2 and D3 (`docs/spec/gymrun-card-battle-rulings-waves-boss-reskin.md`).
  scream: { n: 1 },
  stalk: { steps: 3, damage: 1, atHpShare: 0.5 },
  // The author's ruling of 2026-10-11 (`docs/spec/gymrun-card-run-shapes-prompt.md`),
  // superseding C1 to C5: only the cards reset between waves.
  betweenWaves: { units: 'keepAll', deck: 'reshuffleAll', extraDraws: 'clear', placement: 'none' },
};
