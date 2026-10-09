/**
 * The plan: `select`, `unselect`, and the projection every legality question
 * reads.
 *
 * ## Legality is checked against the board each play resolves on
 *
 * The plan resolves in the order it was made, Moves included (the author's
 * amendment, `docs/spec/gymrun-patch-card-battle-neutral-attack.md`): a unit
 * may shoot and then move, or move into the danger zone and then Slash, and
 * which comes first is the player's call. `project` is the board after every
 * planned Move, and no zone, range or choice check ever reads the raw board.
 *
 * `checkPlan` is the one definition of a legal plan. Each play is checked in
 * plan order against the board as the Moves before it leave it, because that
 * is the board it resolves on. A play appended last never changes what an
 * earlier one sees. A plan is legal only as a whole: `unselect` drops every
 * later play the removal leaves illegal, naming each.
 *
 * Neither draws from any RNG.
 */
import { CARDS } from '../../cardData/cards';
import { CLASS_SLOTS } from '../../cardData/classes';
import { RULES } from '../../cardData/rules';
import { UNITS } from '../../cardData/units';
import type { CardDef, DamageKeyword, Effect, Pos } from './defs';
import type { BattleEvent } from './events';
import type { Action, BattleState, Choice, IllegalReason, PlannedPlay, PlayBlock, UnitId, UnitState } from './state';
import { blastCentres, blastTiles, inDanger, moveDestinations, onBoard, samePos, slashTiles } from './zones';

export type StepResult =
  | { ok: true; state: BattleState; events: BattleEvent[] }
  | { ok: false; state: BattleState; reason: IllegalReason };

/** What a card asks the player to choose. Drives the UI's tap flow. */
export type Needs = 'none' | 'unit' | 'tile' | 'unitThenTile';

/** Unit positions after the planned Moves; `null` for a fainted unit. */
export type Projection = Record<UnitId, Pos | null>;

export type PlanCheck = { ok: true; positions: Projection } | { ok: false; index: number; reason: IllegalReason };

const DAMAGE: readonly DamageKeyword[] = ['strike', 'pierce', 'slash', 'blast'];

export function cardDefOf(state: BattleState, iid: string): CardDef | undefined {
  const instance = Object.hasOwn(state.cards, iid) ? state.cards[iid] : undefined;
  return instance && Object.hasOwn(CARDS, instance.def) ? CARDS[instance.def] : undefined;
}

export function damageOf(def: CardDef): { k: DamageKeyword; n: number } | undefined {
  return def.effects.find((e): e is { k: DamageKeyword; n: number } => (DAMAGE as readonly string[]).includes(e.k));
}

function effect<K extends Effect['k']>(def: CardDef, k: K): Extract<Effect, { k: K }> | undefined {
  return def.effects.find((e) => e.k === k) as Extract<Effect, { k: K }> | undefined;
}

/** A play that moves a unit: a Move, or a Move placed by Command. */
export function isMoveCard(def: CardDef): boolean {
  return def.effects.some((e) => e.k === 'move' || e.k === 'grantMove');
}

export function needsOf(def: CardDef): Needs {
  if (effect(def, 'grantMove')) return 'unitThenTile';
  if (effect(def, 'move')) return 'tile';
  if (effect(def, 'target')) return 'unit';
  if (effect(def, 'blast')) return 'tile';
  if (effect(def, 'shield')?.to === 'friendly') return 'unit';
  return 'none';
}

export function unitOf(state: BattleState, id: unknown): UnitState | undefined {
  return state.units.find((u) => u.id === id);
}

export function livingUnits(state: BattleState): UnitState[] {
  return state.units.filter((u) => !u.fainted && u.pos !== null);
}

export function livingEnemies(state: BattleState): BattleState['enemies'] {
  return state.enemies.filter((e) => e.pos !== null && e.hp > 0);
}

export function slotsOf(id: UnitId): number {
  return CLASS_SLOTS[UNITS[id].class];
}

function choiceFits(needs: Needs, choice: Choice | undefined): boolean {
  const unit = choice?.unit !== undefined;
  const tile = choice?.tile !== undefined;
  switch (needs) {
    case 'none':
      return !unit && !tile;
    case 'unit':
      return unit && !tile;
    case 'tile':
      return tile && !unit;
    case 'unitThenTile':
      return unit && tile;
  }
}

/** The positions every other unit and every living enemy hold, as obstacles. */
function obstacles(state: BattleState, positions: Projection, except: UnitId): Pos[] {
  const out: Pos[] = [];
  for (const [id, pos] of Object.entries(positions)) if (id !== except && pos) out.push(pos);
  for (const enemy of livingEnemies(state)) out.push(enemy.pos!);
  return out;
}

function checkMove(
  state: BattleState,
  play: PlannedPlay,
  def: CardDef,
  positions: Projection,
  memo?: Map<string, Pos[]>,
): IllegalReason | null {
  const granted = effect(def, 'grantMove');
  const mover = granted ? play.choice?.unit : play.unit;
  const n = granted ? granted.n : effect(def, 'move')!.n;
  const from = typeof mover === 'string' && Object.hasOwn(positions, mover) ? positions[mover as UnitId] : null;
  if (!from) return granted ? 'badChoice' : 'fainted';
  // `memo` is only passed for one fixed board, so a mover and a distance name one answer.
  const key = `${mover}:${n}`;
  let destinations = memo?.get(key);
  if (!destinations) {
    destinations = moveDestinations('player', from, n, obstacles(state, positions, mover as UnitId));
    memo?.set(key, destinations);
  }
  if (destinations.length === 0) return 'noTarget';
  if (!destinations.some((d) => samePos(d, play.choice?.tile))) return 'badChoice';
  positions[mover as UnitId] = { ...play.choice!.tile! };
  return null;
}

/** Every non-move play, against the board as the Moves before it leave it. */
function checkEffects(state: BattleState, play: PlannedPlay, def: CardDef, positions: Projection): IllegalReason | null {
  const pos = positions[play.unit];
  if (!pos) return 'fainted';
  const enemies = livingEnemies(state);
  const damage = damageOf(def);
  if (damage) {
    if (RULES.keywordZone[damage.k] === 'danger' && !inDanger(pos)) return 'wrongZone';
    if (effect(def, 'target')) {
      if (enemies.length === 0) return 'noTarget';
      return enemies.some((e) => e.id === play.choice?.unit) ? null : 'badChoice';
    }
    const hits = (tiles: Pos[]): boolean => enemies.some((e) => tiles.some((t) => samePos(t, e.pos)));
    switch (damage.k) {
      case 'strike':
      case 'pierce':
        if (RULES.damageNeedsTarget && !enemies.some((e) => e.pos!.lane === pos.lane)) return 'noTarget';
        break;
      case 'slash':
        if (RULES.damageNeedsTarget && !hits(slashTiles('player', pos))) return 'noTarget';
        break;
      case 'blast': {
        const centres = blastCentres('player', pos).filter((c) => !RULES.damageNeedsTarget || hits(blastTiles(c)));
        if (centres.length === 0) return 'noTarget';
        if (!centres.some((c) => samePos(c, play.choice?.tile))) return 'badChoice';
        break;
      }
    }
  }
  if (effect(def, 'shield')?.to === 'friendly') {
    // R6: Target on a friendly keyword picks a friendly unit, the player included.
    if (!livingUnits(state).some((u) => u.id === play.choice?.unit)) return 'badChoice';
  }
  return null;
}

/** What a walk through the plan has spent so far. */
interface Spent {
  mpUsed: Partial<Record<UnitId, number>>;
  slotsUsed: Partial<Record<UnitId, number>>;
  seen: string[];
}

/** The checks every play passes in plan order: the card, the unit, MP, slots, the choice's shape. */
function checkCommon(state: BattleState, play: PlannedPlay, def: CardDef | undefined, spent: Spent): IllegalReason | null {
  const { mpUsed, slotsUsed, seen } = spent;
  if (!def || !state.piles.hand.includes(play.card)) return 'notInHand';
  if (seen.includes(play.card)) return 'alreadyPlanned';
  seen.push(play.card);
  const unit = unitOf(state, play.unit);
  if (!unit) return 'malformed';
  if (unit.fainted) return 'fainted';
  if (def.owner !== 'neutral' && def.owner !== play.unit) return 'notOwner';

  mpUsed[unit.id] = (mpUsed[unit.id] ?? 0) + def.cost;
  if (mpUsed[unit.id]! > unit.mp) return 'noMp';
  slotsUsed[unit.id] = (slotsUsed[unit.id] ?? 0) + 1;
  if (slotsUsed[unit.id]! > slotsOf(unit.id)) return 'noSlot';

  if (effect(def, 'grantMove')) {
    // Command: another friendly unit's slot, none of its MP.
    const ally = unitOf(state, play.choice?.unit);
    if (!ally || ally.id === unit.id || ally.fainted) return 'badChoice';
    slotsUsed[ally.id] = (slotsUsed[ally.id] ?? 0) + 1;
    if (slotsUsed[ally.id]! > slotsOf(ally.id)) return 'noSlot';
  }

  return choiceFits(needsOf(def), play.choice) ? null : 'badChoice';
}

function walk(state: BattleState, plan: readonly PlannedPlay[]): { check: PlanCheck; spent: Spent } {
  const positions = Object.fromEntries(state.units.map((u) => [u.id, u.fainted || !u.pos ? null : { ...u.pos }])) as Projection;
  const spent: Spent = { mpUsed: {}, slotsUsed: {}, seen: [] };

  for (const [index, play] of plan.entries()) {
    const def = cardDefOf(state, play.card);
    const reason =
      checkCommon(state, play, def, spent) ??
      (isMoveCard(def!) ? checkMove(state, play, def!, positions) : checkEffects(state, play, def!, positions));
    if (reason) return { check: { ok: false, index, reason }, spent };
  }
  return { check: { ok: true, positions }, spent };
}

/** The one definition of a legal plan. See the header. */
export function checkPlan(state: BattleState, plan: readonly PlannedPlay[]): PlanCheck {
  return walk(state, plan).check;
}

const walks = new WeakMap<BattleState, ReturnType<typeof walk> & { moves: Map<string, Pos[]> }>();

/**
 * `checkPlan(state, [...state.plan, play])`, answered faster, for the many
 * candidate plays `legalActions` and `choicesFor` try against one state. The
 * current plan is walked once and cached; the new play runs the same checks
 * the full walk would give it last: its common checks, then a Move or its
 * effects against the cached projection. Same answers by construction, and
 * the fuzz gate holds `select`, which takes the full walk, to every action
 * this offers.
 */
export function checkAppend(state: BattleState, play: PlannedPlay): PlanCheck {
  let base = walks.get(state);
  if (!base) {
    base = { ...walk(state, state.plan), moves: new Map() };
    walks.set(state, base);
  }
  const def = cardDefOf(state, play.card);
  if (!base.check.ok) return checkPlan(state, [...state.plan, play]);
  const index = state.plan.length;
  const fail = (reason: IllegalReason): PlanCheck => ({ ok: false, index, reason });
  const spent: Spent = { mpUsed: { ...base.spent.mpUsed }, slotsUsed: { ...base.spent.slotsUsed }, seen: [...base.spent.seen] };
  const common = checkCommon(state, play, def, spent);
  if (common) return fail(common);
  if (!isMoveCard(def!)) {
    const reason = checkEffects(state, play, def!, base.check.positions);
    return reason ? fail(reason) : base.check;
  }
  const positions = { ...base.check.positions };
  const moved = checkMove(state, play, def!, positions, base.moves);
  return moved ? fail(moved) : { ok: true, positions };
}

/**
 * The board as the planned Moves before plan index `at` leave it; after every
 * planned Move when `at` is omitted. The raw position for a plan that is
 * somehow illegal.
 */
export function projectAt(state: BattleState, at: number): Projection {
  if (at >= state.plan.length) return project(state);
  const check = checkPlan(state, state.plan.slice(0, at));
  return check.ok ? check.positions : (Object.fromEntries(state.units.map((u) => [u.id, u.pos])) as Projection);
}

/** The board after every planned Move. The raw position for a plan that is somehow illegal. */
export function project(state: BattleState): Projection {
  // States are never mutated once returned, so one projection serves every
  // question asked of the same state object. A cache, not state: nothing here
  // reaches the JSON.
  const cached = projections.get(state);
  if (cached) return cached;
  const check = checkPlan(state, state.plan);
  const positions = check.ok ? check.positions : (Object.fromEntries(state.units.map((u) => [u.id, u.pos])) as Projection);
  projections.set(state, positions);
  return positions;
}

const projections = new WeakMap<BattleState, Projection>();

const PLAY_BLOCKS: readonly IllegalReason[] = ['noMp', 'noSlot', 'wrongZone', 'noTarget', 'fainted'];

/** Why a check failing on a play with no choice yet means the card is unplayable. */
export function asPlayBlock(reason: IllegalReason): PlayBlock {
  return (PLAY_BLOCKS.includes(reason) ? reason : 'noTarget') as PlayBlock;
}

function isPos(value: unknown): value is Pos {
  if (typeof value !== 'object' || value === null) return false;
  const { lane, col } = value as { lane?: unknown; col?: unknown };
  return typeof lane === 'number' && typeof col === 'number' && onBoard(lane, col);
}

/** A select action's play, or `null` for one whose shape is wrong. */
function parseSelect(action: unknown): PlannedPlay | null {
  if (typeof action !== 'object' || action === null) return null;
  const { card, unit, choice } = action as { card?: unknown; unit?: unknown; choice?: unknown };
  if (typeof card !== 'string' || typeof unit !== 'string') return null;
  const play: PlannedPlay = { card, unit: unit as UnitId };
  if (choice === undefined) return play;
  if (typeof choice !== 'object' || choice === null) return null;
  const { unit: target, tile } = choice as { unit?: unknown; tile?: unknown };
  if (target !== undefined && typeof target !== 'string') return null;
  if (tile !== undefined && !isPos(tile)) return null;
  const parsed: Choice = {};
  if (target !== undefined) parsed.unit = target;
  if (tile !== undefined) parsed.tile = { lane: tile.lane, col: tile.col };
  return { ...play, choice: parsed };
}

export function select(state: BattleState, action: Extract<Action, { type: 'select' }> | unknown): StepResult {
  if (state.phase !== 'plan') return { ok: false, state, reason: 'battleOver' };
  const play = parseSelect(action);
  if (!play) return { ok: false, state, reason: 'malformed' };
  const plan = [...state.plan, play];
  const check = checkPlan(state, plan);
  if (!check.ok) return { ok: false, state, reason: check.index < state.plan.length ? 'breaksPlan' : check.reason };
  return {
    ok: true,
    state: { ...state, plan },
    events: [{ t: 'planned', index: state.plan.length, card: play.card, unit: play.unit }],
  };
}

export function unselect(state: BattleState, action: Extract<Action, { type: 'unselect' }> | unknown): StepResult {
  if (state.phase !== 'plan') return { ok: false, state, reason: 'battleOver' };
  const index = typeof action === 'object' && action !== null ? (action as { planIndex?: unknown }).planIndex : undefined;
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= state.plan.length) {
    return { ok: false, state, reason: 'badPlanIndex' };
  }
  const removed = state.plan[index]!;
  const events: BattleEvent[] = [{ t: 'unplanned', card: removed.card, unit: removed.unit }];
  const kept: PlannedPlay[] = [];
  for (const play of state.plan.filter((_, i) => i !== index)) {
    const check = checkPlan(state, [...kept, play]);
    if (check.ok) kept.push(play);
    else events.push({ t: 'planPruned', card: play.card, unit: play.unit, reason: check.reason });
  }
  return { ok: true, state: { ...state, plan: kept }, events };
}
