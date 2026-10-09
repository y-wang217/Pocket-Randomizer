/**
 * `legalActions` and `choicesFor`, both built on `checkPlan`, so the list a
 * bot or the UI is offered and the check `select` applies are one function.
 */
import type { Pos } from './defs';
import type { CardDef } from './defs';
import { asPlayBlock, cardDefOf, checkAppend, checkPlan, livingEnemies, livingUnits, needsOf, project } from './plan';
import type { Action, BattleState, CardIid, Choice, PlayBlock, TargetId, UnitId } from './state';
import { deployTiles } from './deploy';
import { blastCentres, moveDestinations, samePos } from './zones';

export interface Choices {
  units: TargetId[];
  tiles: Pos[];
}

const NONE: Choices = { units: [], tiles: [] };

function fits(state: BattleState, card: CardIid, unit: UnitId, choice: Choice | undefined): boolean {
  const play = choice ? { card, unit, choice } : { card, unit };
  return checkAppend(state, play).ok;
}

/**
 * The only tiles a choice could be: where a Move from the projected position
 * can end, or where a Blast may be centred. A narrowing for speed, never a
 * second rule: every candidate is still put through `checkPlan`.
 */
function candidateTiles(state: BattleState, def: CardDef, mover: UnitId): Pos[] {
  const projection = project(state);
  const from = projection[mover];
  if (!from) return [];
  const move = def.effects.find((e) => e.k === 'move' || e.k === 'grantMove');
  if (move) {
    const occupied = [
      ...Object.entries(projection).flatMap(([id, pos]) => (id !== mover && pos ? [pos] : [])),
      ...livingEnemies(state).map((e) => e.pos!),
    ];
    return moveDestinations('player', from, move.n, occupied);
  }
  return blastCentres('player', from);
}

/**
 * What the player may pick for `card` played by `unit`, on the projected
 * board. For Command, `units` is the allies that have any destination, and
 * `tiles` is that ally's destinations once `chosen` names it.
 */
export function choicesFor(state: BattleState, card: CardIid, unit: UnitId, chosen?: TargetId): Choices {
  const def = cardDefOf(state, card);
  if (state.phase !== 'plan' || !def || !state.piles.hand.includes(card)) return NONE;
  const friendlies = livingUnits(state).map((u) => u.id as TargetId);
  switch (needsOf(def)) {
    case 'none':
      return NONE;
    case 'unit': {
      const pool = def.effects.some((e) => e.k === 'target') ? livingEnemies(state).map((e) => e.id) : friendlies;
      return { units: pool.filter((u) => fits(state, card, unit, { unit: u })), tiles: [] };
    }
    case 'tile':
      return { units: [], tiles: candidateTiles(state, def, unit).filter((tile) => fits(state, card, unit, { tile })) };
    case 'unitThenTile': {
      const tilesFor = (ally: TargetId): Pos[] =>
        candidateTiles(state, def, ally as UnitId).filter((tile) => fits(state, card, unit, { unit: ally, tile }));
      const allies = friendlies.filter((ally) => ally !== unit && tilesFor(ally).length > 0);
      return { units: allies, tiles: chosen !== undefined && allies.includes(chosen) ? tilesFor(chosen) : [] };
    }
  }
}

/** Every complete choice for a card and unit; `[undefined]` when it asks for none. */
export function completeChoices(state: BattleState, card: CardIid, unit: UnitId): (Choice | undefined)[] {
  const def = cardDefOf(state, card)!;
  switch (needsOf(def)) {
    case 'none':
      return fits(state, card, unit, undefined) ? [undefined] : [];
    case 'unit':
      return choicesFor(state, card, unit).units.map((u) => ({ unit: u }));
    case 'tile':
      return choicesFor(state, card, unit).tiles.map((tile) => ({ tile }));
    case 'unitThenTile':
      return choicesFor(state, card, unit).units.flatMap((ally) =>
        choicesFor(state, card, unit, ally).tiles.map((tile) => ({ unit: ally, tile })),
      );
  }
}

/** Who may play a card: its owner, or for a Neutral any living unit. */
export function playersOf(state: BattleState, card: CardIid): UnitId[] {
  const def = cardDefOf(state, card);
  if (!def) return [];
  const living = livingUnits(state).map((u) => u.id);
  return def.owner === 'neutral' ? living : living.filter((id) => id === def.owner);
}

/** `null` when `unit` can play `card` now with some choice, else why not. */
export function playBlock(state: BattleState, card: CardIid, unit: UnitId): PlayBlock | null {
  if (completeChoices(state, card, unit).length > 0) return null;
  const def = cardDefOf(state, card);
  if (!def) return 'noTarget';
  // Probe with a choice of the right shape that names nothing, so the check
  // gets past the choice's shape and stops at the first real reason: MP, a
  // slot, the zone, or nothing to act on.
  const nowhere: Pos = { lane: 1, col: 1 };
  const probe: Choice | undefined = {
    none: undefined,
    unit: { unit: '' },
    tile: { tile: nowhere },
    unitThenTile: { unit: '', tile: nowhere },
  }[needsOf(def)];
  const check = checkPlan(state, [...state.plan, probe ? { card, unit, choice: probe } : { card, unit }]);
  return check.ok ? null : asPlayBlock(check.reason);
}

/** Every placement open now: each living unit onto each home tile it is not on. */
export function placeActions(state: BattleState): Action[] {
  if (state.phase !== 'deploy') return [];
  return livingUnits(state).flatMap((unit) =>
    deployTiles()
      .filter((tile) => !samePos(tile, unit.pos))
      .map((tile): Action => ({ type: 'place', unit: unit.id, tile })),
  );
}

export function legalActions(state: BattleState): Action[] {
  if (state.phase === 'deploy') return [...placeActions(state), { type: 'start' }];
  if (state.phase !== 'plan') return [];
  const out: Action[] = [];
  for (const card of state.piles.hand) {
    if (state.plan.some((p) => p.card === card)) continue;
    for (const unit of playersOf(state, card)) {
      for (const choice of completeChoices(state, card, unit)) {
        out.push(choice ? { type: 'select', card, unit, choice } : { type: 'select', card, unit });
      }
    }
  }
  state.plan.forEach((_, planIndex) => out.push({ type: 'unselect', planIndex }));
  out.push({ type: 'commit' });
  return out;
}
