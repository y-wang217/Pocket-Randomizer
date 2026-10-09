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
 * `openingSteps` names what the starting roll draws among; `create.ts` draws.
 */
import { ENEMIES } from '../../cardData/enemies';
import { RULES } from '../../cardData/rules';
import type { ActRule, Cond, EnemyDef, HuntTieBreak, Lane, MoveRule, Pos } from './defs';
import { damage, screamTiles, type Ctx } from './keywords';
import { livingEnemies, livingUnits } from './plan';
import type { BattleState, EnemyState, Intent, UnitState } from './state';
import { covers, enemyTiles, inReach, laneFromSide, lanesOf, samePos, slashTiles, tile } from './zones';

/** An act that can deal damage: a damaging keyword, or a condition with one on either branch. */
export function actCanDamage(act: ActRule): boolean {
  if ('if' in act) return actCanDamage(act.then) || actCanDamage(act.else);
  return act.k !== 'none' && act.k !== 'shield';
}

/**
 * The steps an enemy's starting step is rolled among (E6, A1). A Fast enemy
 * has one: its first damaging step. Under opening grace any other enemy
 * rolls among the steps whose act cannot deal damage; with grace off, among
 * every step. The data test holds every non-Fast enemy to at least one such
 * step and every Fast enemy to a damaging one, so the list is never empty.
 */
export function openingSteps(def: EnemyDef): number[] {
  const steps = def.script.steps;
  const all = steps.map((_, index) => index);
  if (def.fast) return all.filter((i) => actCanDamage(steps[i]!.act)).slice(0, 1);
  return RULES.openingGrace ? all.filter((i) => !actCanDamage(steps[i]!.act)) : all;
}

function occupied(s: BattleState, pos: Pos): boolean {
  return livingUnits(s).some((u) => samePos(u.pos, pos)) || livingEnemies(s).some((e) => covers(e, pos));
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
      return RULES.enemySlashFromCols.includes(enemy.pos!.col) && unitsOn(s, enemySlashTiles(enemy)).length > 0;
  }
}

/** An enemy's Slash: the next column toward the player, across its lanes and one either side. */
function enemySlashTiles(enemy: EnemyState): Pos[] {
  const lanes = lanesOf(enemy);
  if (lanes.length === 1) return slashTiles('enemy', enemy.pos!);
  const out: Pos[] = [];
  for (let step = 1; step <= RULES.patterns.slashCols; step++) {
    const col = enemy.pos!.col + RULES.forward.enemy * step;
    for (let lane = Math.min(...lanes) - 1; lane <= Math.max(...lanes) + 1; lane++) {
      const p = tile(lane, col);
      if (p) out.push(p);
    }
  }
  return out;
}

/** Whether `enemy` could stand at `to`: every tile on the board, in its reach, and free of anyone else. */
function canStand(s: BattleState, enemy: EnemyState, to: Pos): boolean {
  const tiles = enemyTiles({ def: enemy.def, pos: to });
  const size = ENEMIES[enemy.def].size;
  if (tiles.length !== (size ? size.lanes * size.cols : 1)) return false;
  return tiles.every(
    (t) =>
      inReach('enemy', t) &&
      !livingUnits(s).some((u) => samePos(u.pos, t)) &&
      !livingEnemies(s).some((e) => e !== enemy && covers(e, t)),
  );
}

/**
 * D3: once, at half HP or under, the stalker comes on: up to `RULES.stalk.steps`
 * rows toward the player. Each step stomps the tiles it is about to move into,
 * hitting any unit there; a tile held by anyone, or the edge of its reach,
 * stops it there, so a unit close enough is hit without being walked over.
 */
function stalk(ctx: Ctx, enemy: EnemyState): void {
  const { s } = ctx;
  enemy.stalked = true;
  ctx.events.push({ t: 'stalked', enemy: enemy.id });
  for (let i = 0; i < RULES.stalk.steps; i++) {
    if (s.phase !== 'plan') return;
    const from = enemy.pos!;
    const to = tile(from.lane, from.col + RULES.forward.enemy);
    const ahead = lanesOf(enemy).flatMap((lane) => {
      const p = tile(lane, from.col + RULES.forward.enemy);
      return p ? [p] : [];
    });
    if (ahead.length === 0) return;
    const free = to !== null && canStand(s, enemy, to);
    ctx.events.push({ t: 'stomped', enemy: enemy.id, tiles: ahead.map((t) => ({ ...t })), from: { ...from }, to: free ? { ...to } : null });
    for (const unit of unitsOn(s, ahead)) {
      if (s.phase !== 'plan') return;
      damage(ctx, unit, RULES.stalk.damage);
    }
    if (!free) return;
    enemy.pos = { ...to };
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
  const def = ENEMIES[enemy.def];
  const steps = def.script.steps;
  // D: a pinned enemy neither moves nor moves on in its script; the pin wears off a turn at a time.
  if (enemy.pinned > 0) {
    if (!advance) return;
    enemy.pinned -= 1;
    if (enemy.pinned === 0) ctx.events.push({ t: 'pinEnded', enemy: enemy.id });
    else ctx.events.push({ t: 'enemyWaited', enemy: enemy.id, why: 'pinned' });
    enemy.conds = { slashInRange: holds(s, enemy, 'slashInRange') };
    return;
  }
  if (advance) enemy.step = (enemy.step + 1) % steps.length;
  const current = steps[enemy.step]!;
  // Each condition is evaluated once, here, before the move; the act reads the stored result.
  enemy.conds = { slashInRange: holds(s, enemy, 'slashInRange') };
  // D3: the stalk replaces the step's move, once.
  if (advance && def.stalks && !enemy.stalked && enemy.hp <= def.hp * RULES.stalk.atHpShare) {
    stalk(ctx, enemy);
    if (enemy.pos) enemy.conds = { slashInRange: holds(s, enemy, 'slashInRange') };
    return;
  }
  const rule = pickMove(current.move, enemy);
  const from = enemy.pos!;
  if (rule === 'hunt' && def.size) {
    // A big enemy has no hunt: it stands in two lanes of three.
    ctx.events.push({ t: 'enemyWaited', enemy: enemy.id, why: 'noLane' });
  } else if (rule === 'hunt') {
    const lane = huntLane(s, enemy);
    if (lane === null) ctx.events.push({ t: 'enemyWaited', enemy: enemy.id, why: 'noLane' });
    else moveEnemy(ctx, enemy, tile(lane, from.col)!, 'hunt');
  } else if (rule === 'advance') {
    // E4: one column toward the player per step, never past the limit, waiting when blocked.
    for (let i = 0; i < (def.advanceSteps ?? 1); i++) {
      const at = enemy.pos!;
      const col = at.col + RULES.forward.enemy * RULES.advance.cols;
      const past = RULES.forward.enemy < 0 ? col < RULES.advance.limitCol : col > RULES.advance.limitCol;
      const to = tile(at.lane, col);
      const why = past || !to || !inReach('enemy', to) ? 'limit' : !canStand(s, enemy, to) ? 'blocked' : null;
      if (why) {
        // Only a step that never got going is a wait.
        if (i === 0) ctx.events.push({ t: 'enemyWaited', enemy: enemy.id, why });
        break;
      }
      moveEnemy(ctx, enemy, to!, 'advance');
    }
  }
}

/** Phase 7 for one enemy: the act rule, with its lit tiles from where the enemy now stands. */
function telegraph(ctx: Ctx, enemy: EnemyState): void {
  const step = ENEMIES[enemy.def].script.steps[enemy.step]!;
  const act = pickAct(step.act, enemy);
  const own = enemyTiles(enemy);
  let intent: Intent;
  // D2: pinned, it Screams instead.
  if (enemy.pinned > 0) {
    enemy.intent = { act: 'scream', n: RULES.scream.n, tiles: screamTiles(enemy) };
    ctx.events.push({ t: 'telegraphed', enemy: enemy.id, step: enemy.step, intent: { ...enemy.intent, tiles: enemy.intent.tiles.map((t) => ({ ...t })) } });
    return;
  }
  switch (act.k) {
    case 'none':
      intent = { act: 'none', n: 0, tiles: [] };
      break;
    case 'shield':
      intent = { act: 'shield', n: act.n, tiles: [] };
      break;
    case 'strike':
    case 'pierce':
      // Each lane it stands in, in player reach, less its own tiles: the danger zone is in both reaches.
      intent = { act: act.k, n: act.n, tiles: lanesOf(enemy).flatMap((lane) => laneTiles(lane)).filter((t) => !own.some((o) => samePos(o, t))) };
      break;
    case 'slash':
      intent = { act: 'slash', n: act.n, tiles: enemySlashTiles(enemy) };
      break;
  }
  if (step.label && intent.act !== 'none') intent.label = step.label;
  enemy.intent = intent;
  ctx.events.push({ t: 'telegraphed', enemy: enemy.id, step: enemy.step, intent: { ...intent, tiles: intent.tiles.map((t) => ({ ...t })) } });
}

/** Phase 5 for one enemy. */
function enemyAct(ctx: Ctx, enemy: EnemyState): void {
  const { s } = ctx;
  if (enemy.shield > 0) {
    ctx.events.push({ t: 'shieldCleared', unit: enemy.id, amount: enemy.shield });
    enemy.shield = 0;
  }
  // D9: a pinned boss's shields renew on its second pinned turn.
  if (enemy.pinned === 1 && enemy.stripped > 0) {
    enemy.baseShield = enemy.stripped;
    ctx.events.push({ t: 'shieldsReturned', enemy: enemy.id, amount: enemy.stripped });
    enemy.stripped = 0;
  }
  const intent = enemy.intent;
  if (!intent || intent.act === 'none') return;
  ctx.events.push({ t: 'enemyActed', enemy: enemy.id, act: intent.act, n: intent.n });
  if (intent.act === 'scream') {
    // D2: every unit and every other enemy on the tiles touching it.
    const units = unitsOn(s, intent.tiles);
    const others = livingEnemies(s).filter((e) => e !== enemy && intent.tiles.some((t) => covers(e, t)));
    if (units.length + others.length === 0) ctx.events.push({ t: 'enemyMissed', enemy: enemy.id, act: 'scream' });
    for (const target of [...units, ...others]) {
      if (s.phase !== 'plan') return;
      if (target.pos) damage(ctx, target, intent.n);
    }
    return;
  }
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

