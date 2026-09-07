/**
 * The opponent AI: a greedy damage-maximising policy.
 *
 * "Greedy" is the honest description — it picks the move with the highest
 * expected damage against the current target and thinks no further. That is
 * deliberately weak. Stage 0 exists to prove the engine and the seams, and a
 * clever AI here would be effort spent before we know what the fights even
 * look like.
 *
 * What matters is the *shape*. Move evaluation is separated from move
 * selection, and every evaluation carries a `score` distinct from its
 * `expectedDamage`. Adding status awareness later means adding terms to
 * `scoreMove`; adding switch logic means returning a different `Choice` kind
 * from the policy. Neither requires the caller to change, because the caller
 * only ever sees `Policy`.
 *
 * Damage numbers come from @smogon/calc rather than from a formula written
 * here, for the same reason the battle engine comes from @pkmn/sim.
 */
import { Generations, Move, Pokemon, calculate } from '@smogon/calc';

import type { ActiveView, BattleView, Choice, MoveView, StatsTable, SwitchView } from '../types';
import { moveChoice, switchChoice } from '../types';
import { GYMRUN_GEN } from './format';
import { usableMoves, usableSwitches, type Policy } from './policy';

const gen = Generations.get(GYMRUN_GEN);

export interface MoveEvaluation {
  move: MoveView;
  /** Midpoint of the calc's damage roll range, in HP. */
  expectedDamage: number;
  /** `expectedDamage` as a fraction of the target's max HP. */
  expectedFraction: number;
  /** True when even the low roll faints the target. */
  guaranteedKo: boolean;
  /** What the policy actually maximises. Higher is better. */
  score: number;
}

/**
 * Build the calc's view of a Pokemon from ours.
 *
 * Stage 0 gives every Pokemon a Serious nature, 31 IVs and 0 EVs (see
 * driver.toPokemonSet), so this reconstruction is exact rather than an
 * estimate. When Stage 3+ introduces spreads this becomes an approximation of
 * the opponent, which is the correct behaviour anyway — a player estimating
 * damage is doing the same thing.
 */
function toCalcPokemon(active: ActiveView): Pokemon {
  const boosts: Partial<StatsTable> = {
    atk: active.statStages.atk,
    def: active.statStages.def,
    spa: active.statStages.spa,
    spd: active.statStages.spd,
    spe: active.statStages.spe,
  };
  return new Pokemon(gen, active.species, {
    level: active.level,
    nature: 'Serious',
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    boosts,
    curHP: Math.max(1, active.hp),
    status: active.status ?? '',
    ...(active.ability ? { ability: active.ability } : {}),
  });
}

function expectedDamageOf(view: BattleView, move: MoveView): number {
  if (move.category === 'Status') return 0;
  try {
    const result = calculate(gen, toCalcPokemon(view.me), toCalcPokemon(view.foe), new Move(gen, move.name));
    const [low, high] = result.range();
    return (low + high) / 2;
  } catch {
    // The calc does not model every move (and a randomizer will eventually
    // hand it combinations nothing has ever seen). An unscoreable move falls
    // back to base power rather than crashing the opponent's turn.
    return move.basePower;
  }
}

/**
 * Turn expected damage into a preference.
 *
 * Right now this is barely more than the damage itself, with one adjustment:
 * a guaranteed KO outranks any amount of overkill, so the AI does not waste a
 * turn on a bigger number when a smaller one already ends it. Accuracy is
 * folded in so a 70%-accurate nuke does not always beat a reliable move.
 *
 * This is the function to grow. Status awareness ("do not burn a burned
 * target"), hazard setting, and switch pressure all belong here as extra terms,
 * and none of them change anything outside this file.
 */
function scoreMove(evaluation: Omit<MoveEvaluation, 'score'>, move: MoveView): number {
  const accuracy = move.accuracy === true ? 1 : Math.max(0, Math.min(100, move.accuracy)) / 100;
  const base = evaluation.expectedDamage * accuracy;
  return evaluation.guaranteedKo ? base + 1_000_000 * accuracy : base;
}

/** Score every legal move this turn. Exported so tests can inspect reasoning. */
export function evaluateMoves(view: BattleView): MoveEvaluation[] {
  const foeHp = Math.max(1, view.foe.hp);
  const foeMaxHp = Math.max(1, view.foe.maxHp);

  return usableMoves(view).map((move) => {
    const expectedDamage = expectedDamageOf(view, move);
    const partial = {
      move,
      expectedDamage,
      expectedFraction: expectedDamage / foeMaxHp,
      guaranteedKo: expectedDamage >= foeHp,
    };
    return { ...partial, score: scoreMove(partial, move) };
  });
}

/**
 * Which bench member to send out after a faint.
 *
 * Greedy in the same sense the move choice is: it asks what each candidate
 * would *threaten* the current foe with, using the same damage calc, and sends
 * the one with the best answer. It does not ask what the foe would do back,
 * because it cannot — the foe's moves are not public information, and giving
 * the AI a peek at them would make the balance sweep measure a bot that cheats.
 *
 * Ties break toward remaining HP, then toward the lower slot. Both tie-breaks
 * are specified rather than incidental, for the same reason the move tie-break
 * is: a choice that depended on array order would stop a seed reproducing.
 */
export function evaluateSwitches(view: BattleView): { member: SwitchView; score: number }[] {
  const foeMaxHp = Math.max(1, view.foe.maxHp);

  return usableSwitches(view).map((member) => {
    let best = 0;
    for (const id of member.moves) {
      const move = new Move(gen, id);
      if (move.category === 'Status') continue;
      try {
        const result = calculate(gen, toCalcSwitch(member), toCalcPokemon(view.foe), move);
        const [low, high] = result.range();
        best = Math.max(best, (low + high) / 2);
      } catch {
        best = Math.max(best, move.bp);
      }
    }
    // Damage dealt is the term that matters; HP is a tie-break worth a
    // hundredth of it, which keeps a healthy body from outranking a real threat.
    return { member, score: best / foeMaxHp + member.hpFraction * 0.01 };
  });
}

/** A benched member, in the calc's terms. The bench is our own, so this is exact. */
function toCalcSwitch(member: SwitchView): Pokemon {
  return new Pokemon(gen, member.species, {
    level: member.level,
    nature: 'Serious',
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    curHP: Math.max(1, member.hp),
    status: member.status ?? '',
    ability: member.ability,
  });
}

/**
 * The greedy policy.
 *
 * Ties break toward the lower move slot. That is not cosmetic: an unspecified
 * tie-break would make the AI's choice depend on array iteration order, and a
 * seed would stop reproducing the same battle.
 */
export const greedyAiPolicy: Policy = async (view: BattleView): Promise<Choice> => {
  if (view.forceSwitch) {
    const candidates = evaluateSwitches(view);
    const first = candidates[0];
    if (!first) throw new Error('AI is forced to switch with nothing to switch to');
    let best = first;
    for (const candidate of candidates) {
      if (candidate.score > best.score) best = candidate;
    }
    return switchChoice(best.member.slot);
  }

  const evaluations = evaluateMoves(view);
  const first = evaluations[0];
  if (!first) throw new Error('AI has no move to choose');

  let best = first;
  for (const evaluation of evaluations) {
    if (evaluation.score > best.score) best = evaluation;
  }
  return moveChoice(best.move.slot);
};
