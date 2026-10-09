/**
 * What a card or an enemy's intent will do, drawn before the round resolves:
 * the tiles an attack lights, the units a card lands on, and the move
 * destinations that step in front of a Strike. Every answer reads the same
 * rules the round applies (`keywords.ts`, `enemies.ts`, `resolve.ts`). A
 * planned card is read on the board as the Moves planned before it leave it,
 * since the plan resolves in order; a card being chosen, which would go last,
 * on the board after every planned Move.
 *
 * These are forecasts. A unit or enemy removed earlier in the same round can
 * change what a later attack hits; nothing here plays that out.
 */
import { RULES } from '../../cardData/rules';
import { UNITS } from '../../cardData/units';
import type { DamageKeyword, Pos } from './defs';
import { cardDefOf, damageOf, livingEnemies, project, projectAt, select, type Projection } from './plan';
import { firstSlots } from './resolve';
import type { BattleState, CardIid, EnemyId, EnemyState, PlannedPlay, TargetId, UnitId } from './state';
import { blastTiles, laneFromSide, samePos, slashTiles } from './zones';

export interface LitTile {
  pos: Pos;
  /** The tile a Strike stops on, where the one it hits stands. */
  stop: boolean;
}

export interface AttackPreview {
  act: DamageKeyword;
  n: number;
  tiles: LitTile[];
}

export interface PlayPreview {
  /** The tiles the card's damage keyword lights, or `null` for a card that deals none. */
  attack: AttackPreview | null;
  /** The units and enemies the card lands on, for a reticle. */
  targets: TargetId[];
}

export interface Intercept {
  pos: Pos;
  /** The enemies whose Strike a unit standing here takes in an ally's place. */
  blocks: EnemyId[];
}

const lit = (pos: Pos, stop = false): LitTile => ({ pos, stop });

/**
 * The tiles an enemy's intent lights, given where the plan leaves the units.
 * A Strike hits only the first unit in its lane (phase 5), so it runs from the
 * enemy's side and stops on that unit; with no unit in the lane it lights
 * every tile and misses. A Pierce and a Slash light every tile they name.
 */
export function enemyThreat(state: BattleState, enemy: EnemyState, projection: Projection = project(state)): LitTile[] {
  const intent = enemy.intent;
  if (!enemy.pos || !intent) return [];
  if (intent.act !== 'strike') return intent.tiles.map((pos) => lit(pos));
  const standing = state.units.filter((u) => !u.fainted).map((u) => projection[u.id]);
  const fromEnemy = [...intent.tiles].sort((a, b) => (a.col - b.col) * RULES.forward.enemy || a.lane - b.lane);
  const out: LitTile[] = [];
  for (const pos of fromEnemy) {
    const stop = standing.some((p) => samePos(p, pos));
    out.push(lit(pos, stop));
    if (stop) break;
  }
  return out;
}

/** Which unit each telegraphed Strike will hit once the plan's moves land. */
function strikeVictims(state: BattleState): Map<EnemyId, UnitId> {
  const projection = project(state);
  const out = new Map<EnemyId, UnitId>();
  for (const enemy of state.enemies) {
    if (enemy.intent?.act !== 'strike') continue;
    const stop = enemyThreat(state, enemy, projection).find((t) => t.stop);
    const unit = stop && state.units.find((u) => !u.fainted && samePos(projection[u.id], stop.pos));
    if (unit) out.set(enemy.id, unit.id);
  }
  return out;
}

/** A lane's tiles ahead of `from`, toward the enemy, nearest first. */
function laneAhead(from: Pos): Pos[] {
  return laneFromSide('player', from.lane).filter((p) => (p.col - from.col) * RULES.forward.player > 0);
}

/** A player's damage keyword fired from `from`, the same patterns `keywords.ts` resolves. */
function footprint(state: BattleState, k: DamageKeyword, from: Pos, tile: Pos | undefined): LitTile[] {
  const inLane = livingEnemies(state).filter((e) => e.pos!.lane === from.lane);
  switch (k) {
    case 'strike': {
      // R4: the first enemy in the lane from the player's edge, at any distance.
      const first = laneFromSide('player', from.lane).find((t) => inLane.some((e) => samePos(e.pos, t)));
      const ahead = laneAhead(from);
      if (!first) return ahead.map((pos) => lit(pos));
      const upTo = ahead.findIndex((p) => samePos(p, first));
      return upTo < 0 ? [lit(first, true)] : ahead.slice(0, upTo + 1).map((pos, i) => lit(pos, i === upTo));
    }
    case 'pierce': {
      const ahead = laneAhead(from);
      const behind = inLane.map((e) => e.pos!).filter((p) => !ahead.some((a) => samePos(a, p)));
      return [...behind, ...ahead].map((pos) => lit(pos));
    }
    case 'slash':
      return slashTiles('player', from).map((pos) => lit(pos));
    case 'blast':
      return tile ? blastTiles(tile).map((pos) => lit(pos)) : [];
  }
}

/**
 * B's ability, as the round applies it: the card in its first slot turns a
 * Strike into a Pierce when the unit started the turn at full HP. A play not
 * yet in the plan is read as appended to it.
 */
function convertsTo(state: BattleState, play: PlannedPlay, k: DamageKeyword, targeted: boolean): DamageKeyword {
  const ability = UNITS[play.unit].abilities.find((a) => a.k === 'firstCardConverts');
  if (!ability || ability.k !== 'firstCardConverts' || targeted || k !== ability.from) return k;
  const unit = state.units.find((u) => u.id === play.unit);
  if (!unit || unit.hp !== unit.maxHp) return k;
  let index = state.plan.findIndex((p) => p.card === play.card);
  const plan = index < 0 ? [...state.plan, play] : state.plan;
  if (index < 0) index = plan.length - 1;
  return firstSlots(state, plan)[play.unit] === index ? ability.to : k;
}

/**
 * What one play will do: the tiles its attack lights from where its unit
 * stands once the Moves planned before plan index `at` land, and the units it
 * lands on. The play may be in the
 * plan or a candidate not yet selected; a choice it has not made yet lights
 * nothing that depends on it.
 */
export function previewPlay(state: BattleState, play: PlannedPlay, at: number = state.plan.length): PlayPreview {
  const def = cardDefOf(state, play.card);
  if (!def) return { attack: null, targets: [] };
  const targets: TargetId[] = [];
  const add = (id: TargetId | undefined): void => {
    if (id !== undefined && id !== '' && !targets.includes(id)) targets.push(id);
  };
  let attack: AttackPreview | null = null;

  const dmg = damageOf(def);
  const targeted = def.effects.some((e) => e.k === 'target');
  const from = projectAt(state, at)[play.unit];
  if (dmg && from) {
    const k = convertsTo(state, play, dmg.k, targeted);
    if (targeted) {
      const chosen = livingEnemies(state).find((e) => e.id === play.choice?.unit);
      add(chosen?.id);
      const tiles = !chosen ? [] : k === 'blast' ? blastTiles(chosen.pos!).map((pos) => lit(pos)) : [lit(chosen.pos!, true)];
      attack = { act: k, n: dmg.n, tiles };
    } else {
      attack = { act: k, n: dmg.n, tiles: footprint(state, k, from, play.choice?.tile) };
    }
  }

  for (const effect of def.effects) {
    switch (effect.k) {
      case 'shield':
        add(effect.to === 'self' ? play.unit : play.choice?.unit);
        break;
      case 'gainMp':
      case 'mpNextTurns':
        add(play.unit);
        break;
      case 'grantMove':
        add(play.choice?.unit);
        break;
      default:
        break;
    }
  }
  return { attack, targets };
}

/**
 * For a Move being chosen, the destinations where the moving unit steps in
 * front of a telegraphed Strike that would otherwise hit another unit. Each
 * candidate is selected on a copy of the plan, so the answer is the round's
 * own projection, not a second reading of the board.
 */
export function interceptsFor(state: BattleState, card: CardIid, unit: UnitId, tiles: readonly Pos[], ally?: TargetId): Intercept[] {
  const before = strikeVictims(state);
  if (before.size === 0) return [];
  const mover = (ally ?? unit) as UnitId;
  const out: Intercept[] = [];
  for (const tile of tiles) {
    const choice = ally !== undefined ? { unit: ally, tile } : { tile };
    const result = select(state, { type: 'select', card, unit, choice });
    if (!result.ok) continue;
    const after = strikeVictims(result.state);
    const blocks = [...after].filter(([enemy, hit]) => hit === mover && before.has(enemy) && before.get(enemy) !== mover).map(([enemy]) => enemy);
    if (blocks.length > 0) out.push({ pos: tile, blocks });
  }
  return out;
}
