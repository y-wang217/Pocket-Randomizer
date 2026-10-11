/**
 * Scoring a policy over many battles: the numbers `cards:bench` prints and
 * `cards:train` optimizes. Counts only; nothing here judges a scenario.
 */
import { BENCH_IDS } from '../../cardData/encounters';
import { ENEMIES } from '../../cardData/enemies';
import { RULES } from '../../cardData/rules';
import { playBattle } from './bots';
import type { Pos } from './defs';
import type { Action, BattleState, UnitId } from './state';

export interface BattleResult {
  encounterId: string;
  seed: string;
  won: boolean;
  /** Units standing when the battle ended. */
  alive: number;
  rounds: number;
  /** Share of the enemies' total HP, shield and base shield removed, 0 to 1. */
  damageDone: number;
  /** Where each unit stood when the battle started. */
  deployed: Partial<Record<UnitId, Pos>>;
}

export interface ScenarioSummary {
  encounterId: string;
  battles: number;
  wins: number;
  /** Mean units standing at the end of a won battle. */
  aliveOnWin: number;
  /** Mean rounds to a win. */
  roundsToWin: number;
  /** Mean of `fitness` over the battles. */
  fitness: number;
}

/**
 * One battle's worth: a win is 1, plus up to 0.5 for the units kept, plus up
 * to 0.1 for winning sooner; a loss is up to 0.25 for the damage it did.
 * Defence first: one more unit kept (about 0.17) outweighs any speed.
 */
export function fitness(r: BattleResult): number {
  return r.won ? 1 + 0.5 * (r.alive / 3) + 0.1 * (1 - Math.min(r.rounds, RULES.roundCap) / RULES.roundCap) : 0.25 * r.damageDone;
}

/** HP, shield and base shield still on the enemies. */
function enemyLeft(s: BattleState): number {
  return s.enemies.reduce((sum, e) => sum + (e.pos ? e.hp + e.shield + e.baseShield : 0), 0);
}

/** What the enemies start with: HP and base shield. */
function enemyStart(s: BattleState): number {
  return s.enemies.reduce((sum, e) => sum + ENEMIES[e.def].hp + ENEMIES[e.def].baseShield, 0);
}

export function runBattle(encounterId: string, seed: string, policy: (state: BattleState) => Action | null): BattleResult {
  let deployed: Partial<Record<UnitId, Pos>> = {};
  const played = playBattle(encounterId, seed, policy, (_before, action, result) => {
    if (action.type === 'start' && result.ok) deployed = Object.fromEntries(result.state.units.map((u) => [u.id, u.pos!]));
  });
  const start = enemyStart(played.state);
  const left = enemyLeft(played.state);
  return {
    encounterId,
    seed,
    won: played.state.phase === 'won',
    alive: played.state.units.filter((u) => !u.fainted).length,
    rounds: played.state.round,
    damageDone: start > 0 ? (start - left) / start : 1,
    deployed,
  };
}

/** Every scenario, `count` seeds each, named `${prefix}${i}`. */
export function runSuite(
  makePolicy: () => (state: BattleState) => Action | null,
  prefix: string,
  count: number,
  scenarios: readonly string[] = BENCH_IDS,
): BattleResult[] {
  const out: BattleResult[] = [];
  for (const encounterId of scenarios) for (let i = 0; i < count; i++) out.push(runBattle(encounterId, `${prefix}${i}`, makePolicy()));
  return out;
}

export function summarize(results: readonly BattleResult[]): ScenarioSummary[] {
  const ids = [...new Set(results.map((r) => r.encounterId))];
  return ids.map((encounterId) => {
    const rs = results.filter((r) => r.encounterId === encounterId);
    const wins = rs.filter((r) => r.won);
    const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    return {
      encounterId,
      battles: rs.length,
      wins: wins.length,
      aliveOnWin: mean(wins.map((r) => r.alive)),
      roundsToWin: mean(wins.map((r) => r.rounds)),
      fitness: mean(rs.map(fitness)),
    };
  });
}

export const meanFitness = (results: readonly BattleResult[]): number => results.reduce((sum, r) => sum + fitness(r), 0) / Math.max(1, results.length);
