/**
 * One resolver per implemented keyword, and the damage, defeat and faint
 * rules they share. Each works on a draft the caller already copied, so a
 * resolver mutates freely and the state the caller was handed never changes.
 *
 * Every number comes from the card's effect or from `RULES`; none is written
 * here.
 */
import { RULES } from '../../cardData/rules';
import { UNITS } from '../../cardData/units';
import type { CardDef, DamageKeyword, Pos } from './defs';
import type { BattleEvent } from './events';
import { cardDefOf, damageOf, livingEnemies, livingUnits, unitOf } from './plan';
import type { BattleState, EnemyState, PileName, PlannedPlay, UnitId, UnitState } from './state';
import { blastTiles, laneFromSide, moveDestinations, samePos, slashTiles } from './zones';

export interface Ctx {
  s: BattleState;
  events: BattleEvent[];
}

const PILES: readonly PileName[] = ['draw', 'hand', 'discard', 'spent'];

/** Board order from the player's side: column, then lane. Pierce hits front to back. */
const byBoardOrder = (a: EnemyState, b: EnemyState): number => a.pos!.col - b.pos!.col || a.pos!.lane - b.pos!.lane;

export function enemiesOn(s: BattleState, tiles: readonly Pos[]): EnemyState[] {
  return livingEnemies(s)
    .filter((e) => tiles.some((t) => samePos(t, e.pos)))
    .sort(byBoardOrder);
}

/** Shield, then base shield, then HP (R11: base shield never refreshes). */
export function damage(ctx: Ctx, target: UnitState | EnemyState, amount: number): void {
  let left = amount;
  const shield = Math.min(target.shield, left);
  target.shield -= shield;
  left -= shield;
  const baseShield = Math.min(target.baseShield, left);
  target.baseShield -= baseShield;
  left -= baseShield;
  const hp = Math.min(target.hp, left);
  target.hp -= hp;
  ctx.events.push({ t: 'damaged', target: target.id, amount, shield, baseShield, hp });
  if (target.hp > 0) return;
  if ('def' in target) defeat(ctx, target);
  else faint(ctx, target);
}

function defeat(ctx: Ctx, enemy: EnemyState): void {
  enemy.pos = null;
  enemy.shield = 0;
  enemy.intent = null;
  ctx.events.push({ t: 'defeated', enemy: enemy.id });
}

/**
 * A unit at 0 HP leaves the board, and its own cards leave every pile for
 * `removed`. Neutral cards stay where they are (R10: this battle only).
 */
export function faint(ctx: Ctx, unit: UnitState): void {
  const { s } = ctx;
  unit.pos = null;
  unit.fainted = true;
  unit.shield = 0;
  const removed: string[] = [];
  for (const pile of PILES) {
    s.piles[pile] = s.piles[pile].filter((iid) => {
      if (s.cards[iid]!.owner !== unit.id) return true;
      removed.push(iid);
      return false;
    });
  }
  s.piles.removed.push(...removed);
  s.plan = s.plan.filter((p) => p.unit !== unit.id && p.choice?.unit !== unit.id);
  ctx.events.push({ t: 'fainted', unit: unit.id, removed });
  if (livingUnits(s).length === 0 && s.phase === 'plan') {
    s.phase = 'lost';
    ctx.events.push({ t: 'lost', why: 'allFainted' });
  }
}

export function gainMp(ctx: Ctx, unit: UnitState, amount: number, source: 'card' | 'round' | 'ability' | 'focus'): void {
  const gained = Math.max(0, Math.min(amount, RULES.mp.cap - unit.mp));
  unit.mp += gained;
  if (gained > 0) ctx.events.push({ t: 'mpGained', unit: unit.id, amount: gained, source });
}

/** Where a player's damage keyword lands without Target, from where the unit stands. */
function patternHits(ctx: Ctx, k: DamageKeyword, from: Pos, tile: Pos | undefined): EnemyState[] {
  const { s } = ctx;
  switch (k) {
    case 'strike': {
      // R4: the first enemy in the lane, counted from the attacker's side of the board.
      const lane = laneFromSide('player', from.lane);
      const first = lane.map((t) => livingEnemies(s).find((e) => samePos(e.pos, t))).find((e) => e !== undefined);
      return first ? [first] : [];
    }
    case 'pierce':
      return enemiesOn(s, laneFromSide('player', from.lane));
    case 'slash':
      return enemiesOn(s, slashTiles('player', from));
    case 'blast':
      return tile ? enemiesOn(s, blastTiles(tile)) : [];
  }
}

/**
 * R14: the player units a Blast on `tiles` hits, by `RULES.blastFriendlyFire`.
 * Units are listed in deck order; `positions` reads a projected board (the
 * preview's), and the board itself when omitted.
 */
export function alliesOn(
  s: BattleState,
  caster: UnitId,
  tiles: readonly Pos[],
  positions?: Readonly<Record<UnitId, Pos | null>>,
): UnitId[] {
  const mode = RULES.blastFriendlyFire;
  if (mode === 'none' || tiles.length === 0) return [];
  return livingUnits(s)
    .filter((u) => (mode === 'allies' || u.id !== caster) && tiles.some((t) => samePos(t, positions ? positions[u.id] : u.pos)))
    .map((u) => u.id);
}

function alliesBlasted(s: BattleState, caster: UnitId, tiles: readonly Pos[]): UnitState[] {
  return alliesOn(s, caster, tiles).map((id) => unitOf(s, id)!);
}

/** Move: the unit, or for Command the chosen ally, steps to the chosen tile. */
export function resolveMove(ctx: Ctx, play: PlannedPlay, def: CardDef): void {
  const { s } = ctx;
  const granted = def.effects.find((e) => e.k === 'grantMove');
  const mover = unitOf(s, granted ? play.choice?.unit : play.unit);
  const n = granted?.n ?? def.effects.find((e) => e.k === 'move')!.n;
  const to = play.choice?.tile;
  if (!mover || !mover.pos || !to) {
    ctx.events.push({ t: 'fizzled', card: play.card, unit: play.unit, why: 'targetGone' });
    return;
  }
  const occupied = [
    ...livingUnits(s).filter((u) => u.id !== mover.id).map((u) => u.pos!),
    ...livingEnemies(s).map((e) => e.pos!),
  ];
  if (!moveDestinations('player', mover.pos, n, occupied).some((d) => samePos(d, to))) {
    ctx.events.push({ t: 'fizzled', card: play.card, unit: play.unit, why: 'nothingHit' });
    return;
  }
  const from = mover.pos;
  mover.pos = { ...to };
  ctx.events.push({ t: 'moved', unit: mover.id, from, to: { ...to }, card: play.card });
}

/**
 * Every other card: its damage keyword (with Target if it has one), Shield,
 * MP and draw effects, in the order the card lists them.
 */
export function resolveEffects(ctx: Ctx, play: PlannedPlay, def: CardDef, converts: boolean): void {
  const { s } = ctx;
  const unit = unitOf(s, play.unit)!;
  const dmg = damageOf(def);
  const targeted = def.effects.some((e) => e.k === 'target');
  let fizzled = false;

  if (dmg) {
    let k = dmg.k;
    const ability = UNITS[unit.id].abilities.find((a) => a.k === 'firstCardConverts');
    if (converts && ability?.k === 'firstCardConverts' && k === ability.from && !targeted) {
      k = ability.to;
      ctx.events.push({ t: 'converted', unit: unit.id, card: play.card, from: ability.from, to: ability.to });
    }
    let hits: EnemyState[];
    // A Blast's footprint, fixed before anything on it is hit.
    let blasted: Pos[] = [];
    if (targeted) {
      // R13: Target lands on the chosen unit at any range; a Blast centres on it.
      const chosen = livingEnemies(s).find((e) => e.id === play.choice?.unit);
      if (chosen && k === 'blast') blasted = blastTiles(chosen.pos!);
      hits = !chosen ? [] : k === 'blast' ? enemiesOn(s, blasted) : [chosen];
      if (!chosen) {
        fizzled = true;
        ctx.events.push({ t: 'fizzled', card: play.card, unit: unit.id, why: 'targetGone' });
      }
    } else {
      if (k === 'blast' && play.choice?.tile) blasted = blastTiles(play.choice.tile);
      hits = patternHits(ctx, k, unit.pos!, play.choice?.tile);
    }
    const allies = alliesBlasted(s, unit.id, blasted);
    if (!fizzled && hits.length === 0 && allies.length === 0) {
      fizzled = true;
      ctx.events.push({ t: 'fizzled', card: play.card, unit: unit.id, why: 'nothingHit' });
    }
    for (const enemy of hits) if (enemy.pos) damage(ctx, enemy, dmg.n);
    // R14: the Blast hits the allies on its tiles too, after the enemies.
    for (const ally of allies) {
      if (s.phase !== 'plan' || !ally.pos) continue;
      ctx.events.push({ t: 'friendlyFire', card: play.card, unit: ally.id });
      damage(ctx, ally, dmg.n);
    }
  }

  for (const effect of def.effects) {
    switch (effect.k) {
      case 'shield': {
        const to = effect.to === 'self' ? unit : livingUnits(s).find((u) => u.id === play.choice?.unit);
        if (!to) {
          if (!fizzled) ctx.events.push({ t: 'fizzled', card: play.card, unit: unit.id, why: 'targetGone' });
          break;
        }
        to.shield += effect.n;
        ctx.events.push({ t: 'shielded', unit: to.id, amount: effect.n });
        break;
      }
      case 'gainMp':
        // R12: it lands now, and the plan already spent this turn's MP, so it is next turn's.
        gainMp(ctx, unit, effect.n, 'card');
        break;
      case 'mpNextTurns':
        unit.pendingMp.push({ n: effect.n, turns: effect.turns });
        break;
      case 'drawNext':
        s.pendingDraws.push({ n: effect.n, filter: effect.filter, owner: def.owner });
        ctx.events.push({ t: 'drawQueued', card: play.card, n: effect.n });
        break;
      default:
        // Damage, Target, Move and Command are handled above or in the move
        // phase; the reserved effects have no resolver and no shipped card uses one.
        break;
    }
  }
}

/** A played card leaves the hand: Once cards for `spent`, the rest for `discard`. */
export function retire(s: BattleState, play: PlannedPlay): void {
  const def = cardDefOf(s, play.card)!;
  s.piles.hand = s.piles.hand.filter((c) => c !== play.card);
  // A fainted owner's cards are already in `removed`; nothing to retire.
  if (s.piles.removed.includes(play.card)) return;
  s.piles[def.once ? 'spent' : 'discard'].push(play.card);
}

export function payFor(unit: UnitState | undefined, def: CardDef): void {
  if (unit) unit.mp = Math.max(0, unit.mp - def.cost);
}

