/**
 * The guard bot: a player that plays to keep every unit alive
 * (`docs/spec/gymrun-patch-card-battle-scenarios-and-bot.md`).
 *
 * Each round it searches plans with a beam: from the empty plan it tries
 * every legal card play, commits each candidate plan on a copy through the
 * engine's own `step`, scores the board the round leaves, keeps the best few
 * partial plans and extends them, up to `maxPlays` cards. The best plan seen
 * at any depth, the empty plan included, is the one it plays.
 *
 * **It reads only what the player can see.** The score reads the board, HP,
 * shields, MP, the enemies, and the telegraphs the enemies show next, which
 * follow from scripts the player knows. It never reads the hand the commit
 * drew or anything still in the draw pile.
 *
 * Before the battle starts it scores every placement of the units on the
 * home tiles by the threats the enemies open with, then runs a full round 1
 * search on the best few and places the units as the winner says.
 *
 * It draws no randomness: the same state always gets the same answer.
 */
import { GUARD_SEARCH, GUARD_WEIGHTS } from '../../cardData/guardWeights';
import type { GuardSearch, GuardWeights, Pos } from './defs';
import { deployTiles } from './deploy';
import { legalActions } from './legal';
import { livingEnemies, livingUnits } from './plan';
import { enemyThreat } from './preview';
import type { Action, BattleState, UnitId } from './state';
import { step } from './step';
import { inDanger, lanesOf, samePos } from './zones';

function apply(state: BattleState, action: Action): BattleState {
  const result = step(state, action);
  if (!result.ok) throw new Error(`guard bot: its own action ${JSON.stringify(action)} was refused: ${result.reason}`);
  return result.state;
}

/** Telegraphed damage aimed at each unit where it stands now. */
export function incoming(state: BattleState): Partial<Record<UnitId, number>> {
  const positions = Object.fromEntries(state.units.map((u) => [u.id, u.pos])) as Record<UnitId, Pos | null>;
  const out: Partial<Record<UnitId, number>> = {};
  for (const enemy of livingEnemies(state)) {
    const intent = enemy.intent;
    if (!intent || intent.act === 'none' || intent.act === 'shield') continue;
    for (const tile of enemyThreat(state, enemy, positions)) {
      if (intent.act === 'strike' && !tile.stop) continue;
      const unit = livingUnits(state).find((u) => samePos(u.pos, tile.pos));
      if (unit) out[unit.id] = (out[unit.id] ?? 0) + intent.n;
    }
  }
  return out;
}

/** What a board is worth to the guard. Higher is better. */
export function evaluate(state: BattleState, w: GuardWeights = GUARD_WEIGHTS): number {
  const enemyLeft = state.enemies.reduce((sum, e) => sum + (e.pos ? e.hp + e.shield + e.baseShield : 0), 0);
  const enemyCost = w.enemyHp * enemyLeft + w.enemyAlive * livingEnemies(state).length;
  if (state.phase === 'lost') return -w.win - enemyCost;

  let score = -enemyCost - w.round * state.round;
  const lanes = new Set(livingUnits(state).map((u) => u.pos!.lane));
  const reach = w.reach * (1 + w.urgency * state.round);
  score += reach * livingEnemies(state).filter((e) => lanesOf(e).some((lane) => lanes.has(lane))).length;
  if (state.phase === 'won') score += w.win;
  // A wave cleared is worth a win: the next wave's enemies cost as any do, so
  // without it the search would rather leave the last enemy of a wave standing.
  score += w.win * state.wave;
  const threats = state.phase === 'won' ? {} : incoming(state);
  for (const unit of livingUnits(state)) {
    score += w.unit[unit.id] + w.hp * unit.hp + w.baseShield * unit.baseShield + w.mp * unit.mp;
    if (inDanger(unit.pos!)) score += w.forward;
    const dmg = threats[unit.id] ?? 0;
    if (dmg === 0) continue;
    // A shield on the board now has cleared by the time the telegraph lands.
    const soak = unit.hp + unit.baseShield;
    score -= dmg >= soak ? w.lethal * w.unit[unit.id] : (w.threat * dmg) / soak;
  }
  return score;
}

/** Plays whose order cannot change the outcome share a key. */
function planKey(state: BattleState): string {
  const plays = state.plan.map((p) => JSON.stringify([p.card, p.unit, p.choice ?? null]));
  // Moves, Command and B's first-slot conversion make order matter; otherwise it does not.
  const ordered = state.plan.some((p) => {
    const def = state.cards[p.card]!.def;
    return def === 'move' || def === 'dash' || def === 'command';
  }) || state.plan.filter((p) => p.unit === 'B').length > 1;
  return (ordered ? plays : [...plays].sort()).join('|');
}

export interface RoundChoice {
  /** The selects, in order, then the commit. */
  actions: Action[];
  score: number;
}

/** The best plan for this round, by beam search over the engine's own resolution. */
export function planRound(state: BattleState, w: GuardWeights = GUARD_WEIGHTS, search: GuardSearch = GUARD_SEARCH): RoundChoice {
  return topPlans(state, w, search, 1)[0]!;
}

/**
 * The `count` best distinct plans the round's beam search met, best first,
 * each as its selects then the commit. `planRound` is the first of them.
 */
export function topPlans(state: BattleState, w: GuardWeights, search: GuardSearch, count: number): RoundChoice[] {
  const commitScore = (s: BattleState): number => evaluate(apply(s, { type: 'commit' }), w);
  const all: { state: BattleState; score: number }[] = [{ state, score: commitScore(state) }];
  let beam: { state: BattleState; score: number }[] = [all[0]!];
  const seen = new Set<string>([planKey(state)]);
  for (let depth = 0; depth < search.maxPlays && beam.length > 0; depth++) {
    const next: { state: BattleState; score: number }[] = [];
    for (const node of beam) {
      for (const action of legalActions(node.state)) {
        if (action.type !== 'select') continue;
        const extended = apply(node.state, action);
        const key = planKey(extended);
        if (seen.has(key)) continue;
        seen.add(key);
        const scored = { state: extended, score: commitScore(extended) };
        next.push(scored);
        all.push(scored);
      }
    }
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, search.beam);
  }
  // Stable: among equal scores the plan found first, the shorter one, wins.
  return all
    .map((node, order) => ({ ...node, order }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, count)
    .map(({ state: planned, score }) => ({ actions: [...planned.plan.map(toSelect), { type: 'commit' } as Action], score }));
}

function toSelect(p: BattleState['plan'][number]): Action {
  return p.choice ? { type: 'select', card: p.card, unit: p.unit, choice: p.choice } : { type: 'select', card: p.card, unit: p.unit };
}

/** The place actions that move every unit onto its target tile, swaps included. */
export function placementActions(state: BattleState, targets: Partial<Record<UnitId, Pos>>): Action[] {
  const out: Action[] = [];
  let s = state;
  for (const unit of livingUnits(state)) {
    const to = targets[unit.id];
    const now = s.units.find((u) => u.id === unit.id)!.pos;
    if (!to || samePos(now, to)) continue;
    const action: Action = { type: 'place', unit: unit.id, tile: to };
    s = apply(s, action);
    out.push(action);
  }
  return out;
}

/** Every way to put the living units on distinct home tiles. */
function placements(state: BattleState): Partial<Record<UnitId, Pos>>[] {
  const units = livingUnits(state).map((u) => u.id);
  const tiles = deployTiles();
  const out: Partial<Record<UnitId, Pos>>[] = [];
  const walk = (index: number, used: Pos[], acc: Partial<Record<UnitId, Pos>>): void => {
    if (index === units.length) {
      out.push({ ...acc });
      return;
    }
    for (const tile of tiles) {
      if (used.some((u) => samePos(u, tile))) continue;
      walk(index + 1, [...used, tile], { ...acc, [units[index]!]: tile });
    }
  };
  walk(0, [], {});
  return out;
}

export interface PlacementOption {
  /** The placements, then the start. */
  actions: Action[];
  /** The battle once started on this placement. */
  started: BattleState;
  /** The started board's worth: the opening threats against this placement. */
  score: number;
}

/** Every placement, started and scored on the threats the enemies open with, best first. */
export function rankPlacements(state: BattleState, w: GuardWeights = GUARD_WEIGHTS): PlacementOption[] {
  return placements(state)
    .map((targets, order) => {
      const actions = placementActions(state, targets);
      const started = apply(actions.reduce(apply, state), { type: 'start' });
      return { actions: [...actions, { type: 'start' } as Action], started, score: evaluate(started, w), order };
    })
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ actions, started, score }) => ({ actions, started, score }));
}

/** The placement and the start: every placement scored on its opening threats, the best few searched a full round. */
export function planDeploy(state: BattleState, w: GuardWeights = GUARD_WEIGHTS, search: GuardSearch = GUARD_SEARCH): RoundChoice {
  let best: RoundChoice | null = null;
  for (const option of rankPlacements(state, w).slice(0, search.deployShortlist)) {
    const round = planRound(option.started, w, search);
    if (!best || round.score > best.score) best = { actions: option.actions, score: round.score };
  }
  return best!;
}

/**
 * The guard as a policy for `playBattle`: it plans a placement or a round,
 * then hands its actions over one at a time. A fresh policy per battle.
 */
export function guardBot(w: GuardWeights = GUARD_WEIGHTS, search: GuardSearch = GUARD_SEARCH): (state: BattleState) => Action | null {
  let queue: Action[] = [];
  let planned: BattleState | null = null;
  let index = 0;
  return (state) => {
    if (state.phase !== 'plan' && state.phase !== 'deploy') return null;
    // A queue belongs to the state it was planned on and the steps after it.
    if (planned === null || index >= queue.length || !follows(planned, state)) {
      queue = state.phase === 'deploy' ? planDeploy(state, w, search).actions : planRound(state, w, search).actions;
      planned = state;
      index = 0;
    }
    return queue[index++] ?? null;
  };
}

function follows(planned: BattleState, state: BattleState): boolean {
  return planned.seed === state.seed && planned.wave === state.wave && planned.round === state.round && planned.phase === state.phase;
}
