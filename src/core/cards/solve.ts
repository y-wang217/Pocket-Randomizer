/**
 * The solver: a tool-assisted run of one battle on one seed. It plays ahead
 * round after round, keeping the `width` best lines by the guard's score and
 * branching each into its `branch` best plans, and returns the best finished
 * line: a win before a loss, then more units standing, then fewer rounds.
 *
 * **Unlike the guard bot, it sees what is coming.** Playing a line ahead
 * reveals the hands that line draws, so a solved line can lean on a draw the
 * player could not have known. It answers whether a seed can be won and how
 * well, not how a player would play it. Its log replays and narrates like any
 * other.
 */
import { GUARD_SEARCH, GUARD_WEIGHTS } from '../../cardData/guardWeights';
import { createBattle } from './create';
import type { GuardSearch, GuardWeights } from './defs';
import { evaluate, rankPlacements, topPlans } from './guard';
import { newLog, type BattleLog } from './log';
import type { Action, BattleState } from './state';
import { step } from './step';

export interface SolveOptions {
  /** Lines kept after each round. */
  width: number;
  /** Plans each line branches into per round, and placements tried at the start. */
  branch: number;
  weights?: GuardWeights;
  search?: GuardSearch;
}

export interface Solved {
  log: BattleLog;
  state: BattleState;
  /** Lines scored across the whole search. */
  explored: number;
}

interface Line {
  state: BattleState;
  actions: Action[];
  score: number;
}

const better = (a: BattleState, b: BattleState): boolean => {
  const rank = (s: BattleState): number[] => [s.phase === 'won' ? 1 : 0, s.units.filter((u) => !u.fainted).length, -s.round];
  const [x, y] = [rank(a), rank(b)];
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i]! > y[i]!;
  return false;
};

/** Units and enemies where they stand, and how hurt: two lines here have the same future. */
function boardKey(s: BattleState): string {
  return JSON.stringify([s.round, s.units.map((u) => [u.pos, u.hp, u.baseShield, u.mp]), s.enemies.map((e) => [e.pos, e.hp, e.shield, e.baseShield, e.step]), s.piles.hand]);
}

export function solveBattle(encounterId: string, seed: string, options: SolveOptions): Solved {
  const w = options.weights ?? GUARD_WEIGHTS;
  const search = options.search ?? GUARD_SEARCH;
  const created = createBattle(encounterId, seed);
  if (!created.ok) throw new Error(`unknown encounter ${encounterId}`);
  let explored = 0;
  let lines: Line[] = rankPlacements(created.state, w)
    .slice(0, options.branch)
    .map((p) => ({ state: p.started, actions: p.actions, score: p.score }));
  let best = null as Line | null;
  while (lines.length > 0) {
    const next = new Map<string, Line>();
    for (const line of lines) {
      for (const plan of topPlans(line.state, w, search, options.branch)) {
        let state = line.state;
        for (const action of plan.actions) {
          const result = step(state, action);
          if (!result.ok) throw new Error(`solver: its own action was refused: ${result.reason}`);
          state = result.state;
        }
        explored++;
        const grown: Line = { state, actions: [...line.actions, ...plan.actions], score: evaluate(state, w) };
        if (state.phase !== 'plan') {
          if (!best || better(state, best.state)) best = grown;
          continue;
        }
        const key = boardKey(state);
        const held = next.get(key);
        if (!held || grown.score > held.score) next.set(key, grown);
      }
    }
    // A line can only end later than a win already found; it cannot beat a full-strength one.
    lines = [...next.values()]
      .filter((l) => !best || best.state.phase !== 'won' || l.state.round < best.state.round || l.state.units.some((u) => !u.fainted))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.width);
    if (best?.state.phase === 'won' && best.state.units.every((u) => !u.fainted)) break;
  }
  if (!best) throw new Error('solver: no line finished');
  const log = newLog(seed, encounterId, created.state.deckId);
  log.actions.push(...best.actions);
  return { log, state: best.state, explored };
}
