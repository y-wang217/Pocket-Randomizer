/**
 * The enemy script interpreter: phases 5 to 7 of a round.
 *
 *   5. Actions, in spawn order. An enemy's own Shield from its previous action
 *      clears first (E5); then its telegraphed action resolves against the
 *      board as it now stands. The battle is lost the moment the last unit
 *      faints.
 *   6. Moves, in spawn order. Each enemy advances its cycle one step,
 *      evaluates that step's condition once, and performs its move rule.
 *   7. Telegraph. Each enemy resolves the step's act rule, reading the
 *      condition stored in phase 6, into an intent with its lit tiles.
 *
 * Battle start runs 6 and 7 once on the rolled starting step, without
 * advancing past it. Every tie-break is a fixed rule; nothing here draws.
 */
import { ENEMIES } from '../../cardData/enemies';
import { RULES } from '../../cardData/rules';
import type { ActRule, Cond, HuntTieBreak, Lane, MoveRule, Pos } from './defs';
import { damage, type Ctx } from './keywords';
import { livingEnemies, livingUnits } from './plan';
import type { BattleState, EnemyState, Intent, UnitState } from './state';
import { inReach, laneFromSide, samePos, slashTiles, tile } from './zones';

function occupied(s: BattleState, pos: Pos): boolean {
  return livingUnits(s).some((u) => samePos(u.pos, pos)) || livingEnemies(s).some((e) => samePos(e.pos, pos));
}

/** Player units on `tiles`, ordered from the enemy's side of the board. */
function unitsOn(s: BattleState, tiles: readonly Pos[]): UnitState[] {
  const order = (p: Pos): number => -p.col * 10 + p.lane;
  return livingUnits(s)
    .filter((u) => tiles.some((t) => samePos(t, u.pos)))
    .sort((a, b) => order(a.pos!) - order(b.pos!));
}

/** The lane's tiles a player unit may stand on, from the enemy's side. */
function laneTiles(lane: Lane): Pos[] {
  return laneFromSide('enemy', lane).filter((p) => inReach('player', p));
}

export function holds(s: BattleState, enemy: EnemyState, cond: Cond): boolean {
  switch (cond) {
    case 'slashInRange':
      // E3: from the danger zone, a player unit on one of the next column's tiles.
      return RULES.enemySlashFromCols.includes(enemy.pos!.col) && unitsOn(s, slashTiles('enemy', enemy.pos!)).length > 0;
  }
}

function pickMove(rule: MoveRule, enemy: EnemyState): 'none' | 'hunt' | 'advance' {
  return typeof rule === 'string' ? rule : pickMove(enemy.conds[rule.if] ? rule.then : rule.else, enemy);
}

function pickAct(rule: ActRule, enemy: EnemyState): Exclude<ActRule, { if: Cond }> {
  return 'if' in rule ? pickAct(enemy.conds[rule.if] ? rule.then : rule.else, enemy) : rule;
}

/**
 * Hunt (E1, E2). Candidates are the lanes holding a player unit that the
 * enemy can reach by moving along its own column through empty tiles; its own
 * lane counts at distance 0. Ties break by `RULES.huntTieBreak`. With no
 * candidate it stays.
 */
function huntLane(s: BattleState, enemy: EnemyState): Lane | null {
  const from = enemy.pos!;
  const candidates: { lane: Lane; distance: number; frontHp: number }[] = [];
  for (let lane = 1; lane <= RULES.board.lanes; lane++) {
    const front = unitsOn(s, laneTiles(lane as Lane))[0];
    if (!front) continue;
    const dir = Math.sign(lane - from.lane);
    let clear = true;
    for (let l = from.lane + dir; dir !== 0 && clear; l += dir) {
      if (occupied(s, tile(l, from.col)!)) clear = false;
      if (l === lane) break;
    }
    if (clear) candidates.push({ lane: lane as Lane, distance: Math.abs(lane - from.lane), frontHp: front.hp });
  }
  const key: Record<HuntTieBreak, (c: (typeof candidates)[number]) => number> = {
    nearestLane: (c) => c.distance,
    lowestHp: (c) => c.frontHp,
    upperLane: (c) => c.lane,
  };
  candidates.sort((a, b) => {
    for (const rule of RULES.huntTieBreak) {
      const diff = key[rule](a) - key[rule](b);
      if (diff !== 0) return diff;
    }
    return 0;
  });
  return candidates[0]?.lane ?? null;
}

function moveEnemy(ctx: Ctx, enemy: EnemyState, to: Pos, rule: 'hunt' | 'advance'): void {
  const from = enemy.pos!;
  if (samePos(from, to)) return;
  enemy.pos = { ...to };
  ctx.events.push({ t: 'enemyMoved', enemy: enemy.id, from, to: { ...to }, rule });
}

/** Phase 6 for one enemy. `advance` is false only at battle start, on the rolled step. */
function enemyMove(ctx: Ctx, enemy: EnemyState, advance: boolean): void {
  const { s } = ctx;
  const steps = ENEMIES[enemy.def].script.steps;
  if (advance) enemy.step = (enemy.step + 1) % steps.length;
  const current = steps[enemy.step]!;
  // Each condition is evaluated once, here, before the move; the act reads the stored result.
  enemy.conds = { slashInRange: holds(s, enemy, 'slashInRange') };
  const rule = pickMove(current.move, enemy);
  const from = enemy.pos!;
  if (rule === 'hunt') {
    const lane = huntLane(s, enemy);
    if (lane === null) ctx.events.push({ t: 'enemyWaited', enemy: enemy.id, why: 'noLane' });
    else moveEnemy(ctx, enemy, tile(lane, from.col)!, 'hunt');
  } else if (rule === 'advance') {
    // E4: one column toward the player, never past the limit, waiting when blocked.
    const col = from.col + RULES.forward.enemy * RULES.advance.cols;
    const past = RULES.forward.enemy < 0 ? col < RULES.advance.limitCol : col > RULES.advance.limitCol;
    const to = tile(from.lane, col);
    if (past || !to || !inReach('enemy', to)) ctx.events.push({ t: 'enemyWaited', enemy: enemy.id, why: 'limit' });
    else if (occupied(s, to)) ctx.events.push({ t: 'enemyWaited', enemy: enemy.id, why: 'blocked' });
    else moveEnemy(ctx, enemy, to, 'advance');
  }
}

/** Phase 7 for one enemy: the act rule, with its lit tiles from where the enemy now stands. */
function telegraph(ctx: Ctx, enemy: EnemyState): void {
  const act = pickAct(ENEMIES[enemy.def].script.steps[enemy.step]!.act, enemy);
  const pos = enemy.pos!;
  let intent: Intent;
  switch (act.k) {
    case 'none':
      intent = { act: 'none', n: 0, tiles: [] };
      break;
    case 'shield':
      intent = { act: 'shield', n: act.n, tiles: [] };
      break;
    case 'strike':
    case 'pierce':
      intent = { act: act.k, n: act.n, tiles: laneTiles(pos.lane) };
      break;
    case 'slash':
      intent = { act: 'slash', n: act.n, tiles: slashTiles('enemy', pos) };
      break;
  }
  enemy.intent = intent;
  ctx.events.push({ t: 'telegraphed', enemy: enemy.id, step: enemy.step, intent: structuredClone(intent) });
}

/** Phase 5 for one enemy. */
function enemyAct(ctx: Ctx, enemy: EnemyState): void {
  const { s } = ctx;
  if (enemy.shield > 0) {
    ctx.events.push({ t: 'shieldCleared', unit: enemy.id, amount: enemy.shield });
    enemy.shield = 0;
  }
  const intent = enemy.intent;
  if (!intent || intent.act === 'none') return;
  ctx.events.push({ t: 'enemyActed', enemy: enemy.id, act: intent.act, n: intent.n });
  if (intent.act === 'shield') {
    enemy.shield += intent.n;
    ctx.events.push({ t: 'shielded', unit: enemy.id, amount: intent.n });
    return;
  }
  // The board as it now stands: a unit that moved out of the lit tiles is missed.
  const struck = unitsOn(s, intent.tiles);
  const hits = intent.act === 'strike' ? struck.slice(0, 1) : struck;
  if (hits.length === 0) {
    ctx.events.push({ t: 'enemyMissed', enemy: enemy.id, act: intent.act });
    return;
  }
  for (const unit of hits) {
    if (s.phase !== 'plan') return;
    damage(ctx, unit, intent.n);
  }
}

/** Phase 5. Stops the moment the battle is lost. */
export function enemyActions(ctx: Ctx): void {
  for (const enemy of ctx.s.enemies) {
    if (ctx.s.phase !== 'plan') return;
    if (enemy.pos && enemy.hp > 0) enemyAct(ctx, enemy);
  }
}

/** Phases 6 and 7. */
export function enemyMovesAndTelegraph(ctx: Ctx, advance: boolean): void {
  for (const enemy of ctx.s.enemies) if (enemy.pos && enemy.hp > 0) enemyMove(ctx, enemy, advance);
  for (const enemy of ctx.s.enemies) if (enemy.pos && enemy.hp > 0) telegraph(ctx, enemy);
}

