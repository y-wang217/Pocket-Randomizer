/**
 * What a step did, in the order it happened. The UI applies the new state at
 * once and plays these back as skippable beats; a test reads them as the
 * record of a round. Plain JSON, like the state.
 */
import type { Pos } from './defs';
import type { CardIid, EnemyId, IllegalReason, Intent, TargetId, UnitId } from './state';

export type BattleEvent =
  // The plan.
  | { t: 'planned'; index: number; card: CardIid; unit: UnitId }
  | { t: 'unplanned'; card: CardIid; unit: UnitId }
  /** A later play that the unselect left illegal, removed with it. */
  | { t: 'planPruned'; card: CardIid; unit: UnitId; reason: IllegalReason }
  // Deployment.
  | { t: 'placed'; unit: UnitId; from: Pos; to: Pos }
  | { t: 'started' }
  // A round.
  | { t: 'committed'; round: number }
  | { t: 'played'; card: CardIid; unit: UnitId }
  | { t: 'moved'; unit: UnitId; from: Pos; to: Pos; card: CardIid }
  /** B's ability: the card's Strike resolves as a Pierce. */
  | { t: 'converted'; unit: UnitId; card: CardIid; from: 'strike'; to: 'pierce' }
  /** A card that resolved with nothing to act on: its target is gone or its pattern is empty. */
  | { t: 'fizzled'; card: CardIid; unit: UnitId; why: 'targetGone' | 'nothingHit' }
  /** R14: a Blast hits an ally on its tiles. Its `damaged` follows. */
  | { t: 'friendlyFire'; card: CardIid; unit: UnitId }
  | { t: 'damaged'; target: TargetId; amount: number; shield: number; baseShield: number; hp: number }
  | { t: 'shielded'; unit: TargetId; amount: number }
  | { t: 'defeated'; enemy: EnemyId }
  /** A unit at 0 HP leaves the board; its own cards leave every pile for `removed`. */
  | { t: 'fainted'; unit: UnitId; removed: CardIid[] }
  | { t: 'mpGained'; unit: UnitId; amount: number; source: 'card' | 'round' | 'ability' | 'focus' }
  /** Need Help: an extra card owed to the next hand. */
  | { t: 'drawQueued'; card: CardIid; n: number }
  // The enemies.
  | { t: 'enemyActed'; enemy: EnemyId; act: Intent['act']; n: number }
  /** A telegraphed hit that found nobody on its lit tiles: dodged. */
  | { t: 'enemyMissed'; enemy: EnemyId; act: Intent['act'] }
  | { t: 'enemyMoved'; enemy: EnemyId; from: Pos; to: Pos; rule: 'hunt' | 'advance' }
  | { t: 'enemyWaited'; enemy: EnemyId; why: 'noLane' | 'blocked' | 'limit' | 'pinned' }
  | { t: 'telegraphed'; enemy: EnemyId; step: number; intent: Intent }
  // The next hand.
  | { t: 'roundStarted'; round: number }
  | { t: 'shieldCleared'; unit: TargetId; amount: number }
  | { t: 'discarded'; cards: CardIid[] }
  | { t: 'reshuffled'; count: number }
  | { t: 'drew'; cards: CardIid[] }
  | { t: 'extraDrew'; card: CardIid }
  | { t: 'extraDrawFizzled' }
  // Part D.
  /** A Harpoon lands: the boss is pinned and its shields are taken. */
  | { t: 'harpooned'; enemy: EnemyId; card: CardIid; turns: number; shields: number }
  | { t: 'shieldsReturned'; enemy: EnemyId; amount: number }
  | { t: 'pinEnded'; enemy: EnemyId }
  /** Its one stalk begins, at half HP (D3). Each step follows as a `stomped`. */
  | { t: 'stalked'; enemy: EnemyId }
  /** One stalk step: the tiles it stomps, and where it moved, or `null` when something there stopped it. */
  | { t: 'stomped'; enemy: EnemyId; tiles: Pos[]; from: Pos; to: Pos | null }
  /** A card an enemy grants enters the hand. */
  | { t: 'granted'; card: CardIid }
  /** A card with Uses has none left: spent until the next wave. */
  | { t: 'usedUp'; card: CardIid }
  /** Part C: the last enemy of a wave fell and the next arrives; the battle is back in deploy. */
  | { t: 'waveStarted'; wave: number }
  // The end.
  | { t: 'won' }
  | { t: 'lost'; why: 'allFainted' | 'roundCap' };
