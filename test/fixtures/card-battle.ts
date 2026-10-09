/**
 * Fixed boards for the card engine's tests. Built from `layoutBattle` and
 * then edited, so every fixture starts from the shipped encounter and differs
 * from it only where a test says so.
 */
import { layoutBattle } from '../../src/core/cards/create';
import type { Pos } from '../../src/core/cards/defs';
import type { BattleState, CardIid, UnitId } from '../../src/core/cards/state';

export interface BoardSpec {
  /** Card def ids to put in hand, in order. */
  hand?: string[];
  mp?: Partial<Record<UnitId, number>>;
  /** Unit positions; `null` faints the unit. */
  units?: Partial<Record<UnitId, Pos | null>>;
  /** Enemy positions by spawn index; `null` kills it. */
  enemies?: (Pos | null)[];
}

export function board(spec: BoardSpec = {}): BattleState {
  const state = layoutBattle('test', 'FIXTURE')!;
  for (const def of spec.hand ?? []) {
    const iid = iidOf(state, def);
    state.piles.draw = state.piles.draw.filter((c) => c !== iid);
    state.piles.hand.push(iid);
  }
  for (const unit of state.units) {
    const mp = spec.mp?.[unit.id];
    if (mp !== undefined) unit.mp = mp;
    if (spec.units && unit.id in spec.units) {
      const pos = spec.units[unit.id];
      unit.pos = pos ?? null;
      unit.fainted = pos === null;
      if (pos === null) unit.hp = 0;
    }
  }
  spec.enemies?.forEach((pos, index) => {
    const enemy = state.enemies[index]!;
    enemy.pos = pos;
    if (pos === null) enemy.hp = 0;
  });
  return state;
}

/** The instance id of the one copy of a card def. */
export function iidOf(state: BattleState, def: string): CardIid {
  const found = Object.values(state.cards).find((c) => c.def === def);
  if (!found) throw new Error(`no card ${def}`);
  return found.iid;
}

export const at = (lane: 1 | 2 | 3, col: 1 | 2 | 3 | 4 | 5 | 6): Pos => ({ lane, col });
