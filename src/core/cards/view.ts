/**
 * `viewOf`: everything the sandbox screen draws, computed from the state. The
 * UI holds no rules: every playable flag, reason, needed choice, lit tile and
 * planned ghost comes from here, built on the same checks `step` applies.
 */
import { CARDS, DECKS } from '../../cardData/cards';
import { ENEMIES } from '../../cardData/enemies';
import { RULES } from '../../cardData/rules';
import { UNITS } from '../../cardData/units';
import type { CardOwner, ClassId, EnemyDefId, Effect, Pos, Zone } from './defs';
import { deployTiles } from './deploy';
import { playBlock, playersOf } from './legal';
import { cardDefOf, needsOf, project, slotsOf, type Needs } from './plan';
import { enemyThreat, previewPlay, type PlayPreview } from './preview';
import type { BattleState, CardIid, EnemyId, Intent, PlayBlock, UnitId } from './state';
import { allTiles, covers, samePos, zoneOf } from './zones';

/**
 * One enemy's telegraphed attack on one tile, as the board draws it. Unlike
 * `telegraphedBy`, which is every tile the intent names, a Strike's threat
 * ends on the first unit standing in its lane once the plan's moves land:
 * that unit takes the hit and shelters the tiles behind it. A Pierce and a
 * Slash light every tile they name.
 */
export interface TileThreat {
  enemy: EnemyId;
  act: 'strike' | 'pierce' | 'slash' | 'scream';
  n: number;
  /** The tile where a Strike stops, on the unit it will hit. */
  stop: boolean;
}

/** An enemy covers each tile of its footprint; `anchor` is the tile its token is drawn from (its position). */
export type Occupant = { kind: 'unit'; id: UnitId } | { kind: 'enemy'; id: EnemyId; def: EnemyDefId; anchor: boolean };

export interface TileView {
  pos: Pos;
  zone: Zone;
  /** Who stands here now, before any planned move resolves. */
  occupant: Occupant | null;
  /** Enemies whose telegraphed action lights this tile. */
  telegraphedBy: EnemyId[];
  /** The attacks lighting this tile, by kind, in spawn order. */
  threats: TileThreat[];
  /** A unit whose planned moves end here. */
  planGhost?: UnitId;
}

export interface PlannedView {
  planIndex: number;
  card: CardIid;
  name: string;
  /** For a Command in this unit's slot: the unit that played it. */
  by?: UnitId;
}

export interface UnitView {
  id: UnitId;
  name: string;
  role: string;
  class: ClassId;
  hp: number;
  maxHp: number;
  shield: number;
  baseShield: number;
  mp: number;
  mpCap: number;
  /** MP the plan has already spent. */
  reserved: number;
  slots: number;
  planned: PlannedView[];
  fainted: boolean;
  pos: Pos | null;
  /** Where its planned moves leave it. */
  projected: Pos | null;
}

export interface EnemyView {
  id: EnemyId;
  def: EnemyDefId;
  name: string;
  hp: number;
  maxHp: number;
  shield: number;
  baseShield: number;
  pos: Pos | null;
  dead: boolean;
  /** Starts on its first damaging step, so it attacks from round 1 (A1). */
  fast: boolean;
  /** Its footprint, lanes by columns: 1 by 1 for most, 2 by 2 for the Colossus. */
  size: { lanes: number; cols: number };
  /** Turns of a Harpoon's pin left (D). */
  pinned: number;
  /** The HP at which its one stalk comes, while it has not come (D3); `null` for an enemy that never stalks. */
  stalkAt: number | null;
  intent: { icon: Intent['act']; n: number; tiles: Pos[]; label?: string } | null;
}

export interface HandCardView {
  iid: CardIid;
  def: string;
  name: string;
  cost: number;
  owner: CardOwner;
  /** Uses left and the card's total, or `null` for a card without the keyword (D7). */
  uses: { left: number; of: number } | null;
  retain: boolean;
  /** Granted by an enemy rather than dealt from the deck: its frame is black. */
  granted: boolean;
  effects: readonly Effect[];
  /** In the plan already. */
  planned: boolean;
  playable: boolean;
  reason: PlayBlock | null;
  needs: Needs;
  /** The units that could play it now. */
  players: UnitId[];
  /** The living units that may play it but cannot now, each with why. */
  blocked: { unit: UnitId; block: PlayBlock }[];
}

export interface HandGroupView {
  owner: CardOwner;
  cards: HandCardView[];
}

/** A planned play's own telegraph: the tiles its attack lights and the units it lands on. */
export interface PlanPreview extends PlayPreview {
  planIndex: number;
  unit: UnitId;
}

export interface BattleView {
  round: number;
  /** The wave being fought, from 0, and how many the scenario has (Part C). */
  wave: number;
  waves: number;
  phase: BattleState['phase'];
  canCommit: boolean;
  /** Before the battle starts: the tiles a unit may be placed on. Empty once it has. */
  deployTiles: Pos[];
  tiles: TileView[];
  units: UnitView[];
  enemies: EnemyView[];
  hand: HandGroupView[];
  /** One per planned play, in plan order. */
  previews: PlanPreview[];
  piles: { draw: number; discard: number; spent: number; removed: number; reserve: number };
}

/** An enemy's number as the screen shows it: its place in its wave, from 1 (the wave's first is 1). */
export function enemyNumber(state: BattleState, id: EnemyId): number {
  const enemy = state.enemies.find((e) => e.id === id);
  return enemy ? state.enemies.filter((e) => e.wave === enemy.wave).indexOf(enemy) + 1 : 0;
}

export function viewOf(state: BattleState): BattleView {
  const projection = project(state);
  const live = state.phase === 'plan';
  const threatened = state.enemies.map((enemy) => ({ enemy, tiles: enemyThreat(state, enemy, projection) }));
  const previews: PlanPreview[] = state.plan.map((play, planIndex) => ({ planIndex, unit: play.unit, ...previewPlay(state, play, planIndex) }));

  const tiles: TileView[] = allTiles().map((pos) => {
    const unit = state.units.find((u) => samePos(u.pos, pos));
    const enemy = state.enemies.find((e) => covers(e, pos));
    const occupant: Occupant | null = unit
      ? { kind: 'unit', id: unit.id }
      : enemy
        ? { kind: 'enemy', id: enemy.id, def: enemy.def, anchor: samePos(enemy.pos, pos) }
        : null;
    const view: TileView = {
      pos,
      zone: zoneOf(pos),
      occupant,
      telegraphedBy: state.enemies.filter((e) => e.pos && e.intent?.tiles.some((t) => samePos(t, pos))).map((e) => e.id),
      threats: threatened.flatMap(({ enemy, tiles }) => {
        const hit = tiles.find((t) => samePos(t.pos, pos));
        const act = enemy.intent?.act;
        if (!hit || (act !== 'strike' && act !== 'pierce' && act !== 'slash' && act !== 'scream')) return [];
        return [{ enemy: enemy.id, act, n: enemy.intent!.n, stop: hit.stop }];
      }),
    };
    const ghost = state.units.find((u) => u.pos && !samePos(u.pos, projection[u.id]) && samePos(projection[u.id], pos));
    if (ghost) view.planGhost = ghost.id;
    return view;
  });

  const units: UnitView[] = state.units.map((u) => {
    const planned: PlannedView[] = [];
    let reserved = 0;
    state.plan.forEach((play, planIndex) => {
      const def = cardDefOf(state, play.card)!;
      if (play.unit === u.id) {
        planned.push({ planIndex, card: play.card, name: def.name });
        reserved += def.cost;
      } else if (play.choice?.unit === u.id && def.effects.some((e) => e.k === 'grantMove')) {
        planned.push({ planIndex, card: play.card, name: def.name, by: play.unit });
      }
    });
    const def = UNITS[u.id];
    return {
      id: u.id,
      name: def.name,
      role: def.role,
      class: def.class,
      hp: u.hp,
      maxHp: u.maxHp,
      shield: u.shield,
      baseShield: u.baseShield,
      mp: u.mp,
      mpCap: RULES.mp.cap,
      reserved,
      slots: slotsOf(state, u.id),
      planned,
      fainted: u.fainted,
      pos: u.pos,
      projected: projection[u.id] ?? null,
    };
  });

  // The current wave's enemies: an earlier wave's are gone, a later one's not here yet.
  const enemies: EnemyView[] = state.enemies.filter((e) => e.wave === state.wave).map((e) => ({
    id: e.id,
    def: e.def,
    name: ENEMIES[e.def].name,
    hp: e.hp,
    maxHp: ENEMIES[e.def].hp,
    shield: e.shield,
    baseShield: e.baseShield,
    pos: e.pos,
    dead: e.pos === null,
    fast: ENEMIES[e.def].fast === true,
    size: ENEMIES[e.def].size ?? { lanes: 1, cols: 1 },
    pinned: e.pinned,
    stalkAt: ENEMIES[e.def].stalks && !e.stalked ? Math.floor(ENEMIES[e.def].hp * RULES.stalk.atHpShare) : null,
    intent: e.pos && e.intent ? { icon: e.intent.act, n: e.intent.n, tiles: e.intent.tiles, ...(e.intent.label ? { label: e.intent.label } : {}) } : null,
  }));

  // Grouped by owner in the deck's unit order, Neutrals last.
  const owners: CardOwner[] = [...(DECKS[state.deckId]?.units ?? []), 'neutral'];
  const hand: HandGroupView[] = owners
    .map((owner) => ({
      owner,
      cards: state.piles.hand
        .filter((iid) => state.cards[iid]!.owner === owner)
        .map((iid) => cardView(state, iid, live)),
    }))
    .filter((group) => group.cards.length > 0);

  return {
    round: state.round,
    wave: state.wave,
    waves: Math.max(...state.enemies.map((e) => e.wave)) + 1,
    phase: state.phase,
    canCommit: live,
    deployTiles: state.phase === 'deploy' ? deployTiles() : [],
    tiles,
    units,
    enemies,
    hand,
    previews,
    piles: {
      draw: state.piles.draw.length,
      discard: state.piles.discard.length,
      spent: state.piles.spent.length,
      removed: state.piles.removed.length,
      reserve: state.piles.reserve.length,
    },
  };
}

function cardView(state: BattleState, iid: CardIid, live: boolean): HandCardView {
  const def = CARDS[state.cards[iid]!.def]!;
  const planned = state.plan.some((p) => p.card === iid);
  const candidates = def.owner === 'neutral' ? state.units.filter((u) => !u.fainted).map((u) => u.id) : [def.owner];
  const blocks = live && !planned ? candidates.map((unit) => ({ unit, block: playBlock(state, iid, unit) })) : [];
  const players = live && !planned ? playersOf(state, iid).filter((unit) => blocks.find((b) => b.unit === unit)?.block === null) : [];
  return {
    iid,
    def: def.id,
    name: def.name,
    cost: def.cost,
    owner: def.owner,
    uses: def.uses === undefined ? null : { left: state.uses[iid] ?? def.uses, of: def.uses },
    retain: def.retain === true,
    granted: state.cards[iid]!.granted === true,
    effects: def.effects,
    planned,
    playable: players.length > 0,
    reason: players.length > 0 || planned || !live ? null : (blocks[0]?.block ?? 'fainted'),
    needs: needsOf(def),
    players,
    blocked: blocks.flatMap(({ unit, block }) => (block === null ? [] : [{ unit, block }])),
  };
}
