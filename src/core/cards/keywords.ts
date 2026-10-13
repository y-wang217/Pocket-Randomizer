/**
 * One resolver per implemented keyword, and the damage, defeat and faint
 * rules they share. Each works on a draft the caller already copied, so a
 * resolver mutates freely and the state the caller was handed never changes.
 *
 * Every number comes from the card's effect or from `RULES`; none is written
 * here.
 */
import { RULES } from '../../cardData/rules';
import type { CardDef, DamageKeyword, Pos } from './defs';
import { displace, stun } from './enemies';
import type { BattleEvent } from './events';
import { abilitiesOf, bonusOf, cardDefOf, damageOf, livingEnemies, livingUnits, unitOf } from './plan';
import type { BattleState, EnemyState, PileName, PlannedPlay, UnitId, UnitState } from './state';
import { blastTiles, covers, enemyTiles, laneFromSide, moveDestinations, samePos, slashTiles, tile as tileAt } from './zones';

export interface Ctx {
  s: BattleState;
  events: BattleEvent[];
}

const PILES: readonly PileName[] = ['draw', 'hand', 'discard', 'spent'];

/** Board order from the player's side: column, then lane. Pierce hits front to back. */
const byBoardOrder = (a: EnemyState, b: EnemyState): number => a.pos!.col - b.pos!.col || a.pos!.lane - b.pos!.lane;

export function enemiesOn(s: BattleState, tiles: readonly Pos[]): EnemyState[] {
  return livingEnemies(s)
    .filter((e) => tiles.some((t) => covers(e, t)))
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
  delete unit.stealth;
  delete unit.cover;
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

/** Bonus MP a card owes the shared pool's next `turns` refills. */
function queueMp(ctx: Ctx, play: PlannedPlay, n: number, turns: number): void {
  ctx.s.pendingMp.push({ n, turns });
  ctx.events.push({ t: 'mpQueued', card: play.card, unit: play.unit, n, turns });
}

/** Where a player's damage keyword lands without Target, from where the unit stands. */
function patternHits(ctx: Ctx, k: DamageKeyword, from: Pos, tile: Pos | undefined): EnemyState[] {
  const { s } = ctx;
  switch (k) {
    case 'strike': {
      // R4: the first enemy in the lane, counted from the attacker's side of the board.
      const lane = laneFromSide('player', from.lane);
      const first = lane.map((t) => livingEnemies(s).find((e) => covers(e, t))).find((e) => e !== undefined);
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

/**
 * D: a Harpoon pins a boss for `turns` of its turns. Every shield goes (the
 * base shield is held, returned on its second pinned turn), and its telegraph
 * becomes a Scream at once, so the board shows what the pin changed.
 */
export function pin(ctx: Ctx, boss: EnemyState, turns: number, card: string): void {
  const shields = boss.shield + boss.baseShield;
  boss.pinned = turns;
  boss.stripped = boss.baseShield;
  boss.baseShield = 0;
  boss.shield = 0;
  boss.intent = { act: 'scream', n: RULES.scream.n, tiles: screamTiles(boss) };
  ctx.events.push({ t: 'harpooned', enemy: boss.id, card, turns, shields });
}

/** The tiles touching an enemy's footprint, along lanes and rows (no diagonals). */
export function screamTiles(enemy: EnemyState): Pos[] {
  const own = enemyTiles(enemy);
  const out: Pos[] = [];
  for (const t of own) {
    for (const [dl, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const p = tileAt(t.lane + dl, t.col + dc);
      if (p && !own.some((o) => samePos(o, p)) && !out.some((o) => samePos(o, p))) out.push(p);
    }
  }
  return out;
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
    ...livingEnemies(s).flatMap((e) => enemyTiles(e)),
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
  // Every enemy the damage landed on, for a Push.
  let landed: EnemyState[] = [];

  if (dmg) {
    let k = dmg.k;
    const ability = abilitiesOf(s, unit.id).find((a) => a.k === 'firstCardConverts');
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
    // A talent's bonus (5a) rides the keyword the card resolves as, from where the unit stands.
    const amount = dmg.n + bonusOf(s, unit.id, k, unit.pos);
    for (const enemy of hits) if (enemy.pos) damage(ctx, enemy, amount);
    landed = hits;
    // R14: the Blast hits the allies on its tiles too, after the enemies.
    for (const ally of allies) {
      if (s.phase !== 'plan' || !ally.pos) continue;
      ctx.events.push({ t: 'friendlyFire', card: play.card, unit: ally.id });
      damage(ctx, ally, amount);
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
        const amount = effect.n + bonusOf(s, unit.id, 'shield', unit.pos);
        to.shield += amount;
        ctx.events.push({ t: 'shielded', unit: to.id, amount });
        // Bodyguard (5a): a Shield the unit gives itself has it Cover its neighbours too.
        if (to === unit && abilitiesOf(s, unit.id).some((a) => a.k === 'coverOnShield')) setCover(ctx, unit, 1);
        break;
      }
      case 'gainMp':
        // R12: the plan already spent this turn's MP, so it is next turn's, on top of the refill.
        queueMp(ctx, play, effect.n, 1);
        break;
      case 'mpNextTurns':
        queueMp(ctx, play, effect.n, effect.turns);
        break;
      case 'gainMpNow':
        s.mp += effect.n;
        ctx.events.push({ t: 'mpGainedNow', card: play.card, unit: play.unit, n: effect.n });
        break;
      case 'drawNext':
        s.pendingDraws.push({ n: effect.n, filter: effect.filter, owner: def.owner });
        ctx.events.push({ t: 'drawQueued', card: play.card, n: effect.n });
        break;
      case 'push':
        // Away from the player: the player's forward. A defeated enemy has left the board.
        for (const enemy of landed) if (enemy.pos) displace(ctx, enemy, RULES.forward.player as 1 | -1, effect.n, play.card, 'push');
        break;
      case 'pull': {
        const enemy = livingEnemies(s).find((e) => e.id === play.choice?.unit);
        if (!enemy) {
          ctx.events.push({ t: 'fizzled', card: play.card, unit: unit.id, why: 'targetGone' });
          break;
        }
        displace(ctx, enemy, RULES.forward.enemy as 1 | -1, effect.n, play.card, 'pull');
        break;
      }
      case 'repair': {
        const to = livingUnits(s).find((u) => u.id === play.choice?.unit);
        if (!to) {
          ctx.events.push({ t: 'fizzled', card: play.card, unit: unit.id, why: 'targetGone' });
          break;
        }
        const amount = Math.min(effect.n + bonusOf(s, unit.id, 'repair', unit.pos), to.maxHp - to.hp);
        to.hp += amount;
        ctx.events.push({ t: 'repaired', unit: to.id, card: play.card, amount });
        break;
      }
      case 'stealth':
        unit.stealth = Math.max(unit.stealth ?? 0, effect.n);
        ctx.events.push({ t: 'stealthed', unit: unit.id, card: play.card, turns: effect.n });
        break;
      case 'cover':
        setCover(ctx, unit, effect.n);
        break;
      case 'stun':
        // Every enemy the damage landed on and left standing, not a boss: the Harpoon pins those.
        for (const enemy of landed) if (enemy.pos) stun(ctx, enemy, effect.n, play.card);
        break;
      case 'harpoon': {
        const boss = livingEnemies(s).find((e) => e.id === play.choice?.unit);
        if (!boss || boss.pinned > 0) {
          ctx.events.push({ t: 'fizzled', card: play.card, unit: unit.id, why: 'targetGone' });
          break;
        }
        pin(ctx, boss, effect.pin, play.card);
        break;
      }
      default:
        // Damage, Target, Move and Command are handled above or in the move phase.
        break;
    }
  }

  // Quartermaster (5a): equipment the unit plays also queues extra cards.
  if (def.equipment) {
    for (const a of abilitiesOf(s, unit.id)) {
      if (a.k !== 'equipmentDraws') continue;
      s.pendingDraws.push({ n: a.n, filter: 'notOwner', owner: def.owner });
      ctx.events.push({ t: 'drawQueued', card: play.card, n: a.n });
    }
  }
}

/** Cover (5a): the unit takes its neighbours' hits for the next `turns` enemy phases. */
function setCover(ctx: Ctx, unit: UnitState, turns: number): void {
  unit.cover = Math.max(unit.cover ?? 0, turns);
  ctx.events.push({ t: 'covering', unit: unit.id, turns });
}

/** A played card leaves the hand: for `spent` on its last use, otherwise for `discard`. */
export function retire(ctx: Ctx, play: PlannedPlay): void {
  const { s } = ctx;
  const def = cardDefOf(s, play.card)!;
  s.piles.hand = s.piles.hand.filter((c) => c !== play.card);
  // A fainted owner's cards are already in `removed`; nothing to retire.
  if (s.piles.removed.includes(play.card)) return;
  // Uses (D7): the last one spends the card until the next wave; before that it goes back into the deck.
  if (def.uses !== undefined) {
    s.uses[play.card] = (s.uses[play.card] ?? def.uses) - 1;
    if (s.uses[play.card]! <= 0) {
      s.piles.spent.push(play.card);
      ctx.events.push({ t: 'usedUp', card: play.card });
      return;
    }
  }
  s.piles.discard.push(play.card);
}

/** A card's cost leaves the shared pool, whichever unit plays it. */
export function payFor(s: BattleState, def: CardDef): void {
  s.mp = Math.max(0, s.mp - def.cost);
}

