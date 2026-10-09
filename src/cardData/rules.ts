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
  board: { lanes: 3, cols: 6 },
  zones: {
    playerBackline: [1, 2],
    danger: [3, 4],
    enemyBackline: [5, 6],
  },
  reach: {
    player: { min: 1, max: 4 },
    enemy: { min: 3, max: 6 },
  },
  forward: { player: 1, enemy: -1 },
  handSize: 5,
  // R2: the cap. MP is per unit, starts at 0 and gains 1 after each turn.
  mp: { start: 0, gainPerRound: 1, cap: 5 },
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
  friendlyFire: false, // R14
  moveShape: 'orthogonalInsideReach', // R15
  huntTieBreak: ['nearestLane', 'lowestHp', 'upperLane'], // E1
  huntDistance: 'anyLanesBeforeBlocker', // E2
  enemySlashFromCols: [3, 4], // E3
  advance: { cols: 1, limitCol: 3, ifBlocked: 'wait' }, // E4
  enemyShieldClears: 'ownNextAction', // E5
  startingStep: 'rolledPerEnemy', // E6
  // Not in the snapshot. The fun test expects 4 to 7 rounds; the cap only
  // guarantees a battle ends, and the fuzz gate asserts no bot reaches it.
  roundCap: 30,
};
