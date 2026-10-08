/**
 * What the engine reports a step did. Checkpoint 1 has the plan's events
 * only; resolution adds its own members at checkpoint 2.
 */
import type { CardIid, IllegalReason, UnitId } from './state';

export type BattleEvent =
  | { t: 'planned'; index: number; card: CardIid; unit: UnitId }
  | { t: 'unplanned'; card: CardIid; unit: UnitId }
  /** A later play that the unselect left illegal, removed with it. */
  | { t: 'planPruned'; card: CardIid; unit: UnitId; reason: IllegalReason };
