/**
 * Deployment: before round 1 the player places its units on the home tiles,
 * then starts the battle (`docs/spec/gymrun-patch-card-battle-scenarios-and-bot.md`).
 *
 * A battle is created in `deploy`: every draw it will ever make at creation is
 * already made (starting steps, enemy spawns, the shuffle) and the opening
 * hand is in hand, so the player places knowing the hand and the enemy
 * positions. No enemy has moved or telegraphed yet, because a hunt reads where
 * the units stand. `start` runs the enemies' opening move and telegraph on
 * that placement, and the battle is in `plan` for round 1.
 *
 * Placing is a decision: it is logged, and it draws nothing.
 */
import { RULES } from '../../cardData/rules';
import type { Pos } from './defs';
import { enemyMovesAndTelegraph } from './enemies';
import type { Ctx } from './keywords';
import { type StepResult, unitOf } from './plan';
import type { Action, BattleState } from './state';
import { allTiles, onBoard, samePos, zoneOf } from './zones';

/** The tiles a unit may be placed on. */
export function deployTiles(): Pos[] {
  return allTiles().filter((pos) => zoneOf(pos) === RULES.deployZone);
}

function isPos(value: unknown): value is Pos {
  if (typeof value !== 'object' || value === null) return false;
  const { lane, col } = value as { lane?: unknown; col?: unknown };
  return typeof lane === 'number' && typeof col === 'number' && onBoard(lane, col);
}

/** Put a unit on a home tile. A unit already there takes the mover's old tile. */
export function place(state: BattleState, action: Extract<Action, { type: 'place' }> | unknown): StepResult {
  const { unit: id, tile } = (typeof action === 'object' && action !== null ? action : {}) as { unit?: unknown; tile?: unknown };
  if (typeof id !== 'string' || !isPos(tile)) return { ok: false, state, reason: 'malformed' };
  if (state.phase !== 'deploy') return { ok: false, state, reason: state.phase === 'plan' ? 'notDeploying' : 'battleOver' };
  const unit = unitOf(state, id);
  if (!unit) return { ok: false, state, reason: 'malformed' };
  if (!unit.pos) return { ok: false, state, reason: 'fainted' };
  const to: Pos = { lane: tile.lane, col: tile.col };
  if (zoneOf(to) !== RULES.deployZone || samePos(unit.pos, to)) return { ok: false, state, reason: 'badChoice' };
  const from = unit.pos;
  const other = state.units.find((u) => samePos(u.pos, to));
  const units = state.units.map((u) => (u === unit ? { ...u, pos: to } : u === other ? { ...u, pos: { ...from } } : u));
  return {
    ok: true,
    state: { ...state, units },
    events: [
      { t: 'placed', unit: unit.id, from, to },
      ...(other ? [{ t: 'placed' as const, unit: other.id, from: to, to: { ...from } }] : []),
    ],
  };
}

/** The placement stands: the enemies make their opening move and telegraph, and round 1 begins. */
export function start(state: BattleState): StepResult {
  if (state.phase !== 'deploy') return { ok: false, state, reason: state.phase === 'plan' ? 'notDeploying' : 'battleOver' };
  const s: BattleState = {
    ...state,
    phase: 'plan',
    enemies: state.enemies.map((e) => ({ ...e, pos: e.pos && { ...e.pos }, conds: { ...e.conds }, intent: null })),
  };
  const ctx: Ctx = { s, events: [{ t: 'started' }] };
  enemyMovesAndTelegraph(ctx, false);
  return { ok: true, state: s, events: ctx.events };
}
