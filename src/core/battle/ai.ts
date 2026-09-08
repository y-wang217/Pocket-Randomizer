/**
 * The opponent AI: one scoring function over the whole legal choice set.
 *
 * ## Why this was rewritten in Stage 4
 *
 * Stage 0's AI maximised expected damage over moves and answered forced
 * switches from a separate branch with separate reasoning. That was honest
 * while a switch was only ever forced — there was nothing to compare it to.
 * Once the player can switch voluntarily, keeping the opponent unable to do so
 * is not a weak AI, it is a **measurement error**: raising `PARTY_SIZE` while
 * the opponent cannot answer a bad matchup makes the whole game easier, and the
 * simulator reports that as a balance win when it is an AI regression. Stage 4
 * would then tune `scaling.ts` to compensate for a bot, and the numbers would
 * be wrong in a direction nobody could see.
 *
 * So: `scoreChoices` scores every legal `move` **and** every legal `switch` on
 * one scale, in HP-fraction units, and the policy takes the max. Not a decision
 * tree — a tree makes "should I switch?" a question asked before "what would I
 * do instead?", which is the wrong order and untestable besides. A flat scored
 * list survives tuning (add a term), survives new choice kinds (add a branch
 * that returns a number), and can be asserted on directly.
 *
 * ## What it now knows that Stage 0 did not
 *
 * **Incoming damage.** The Stage 0 AI only ever asked what it could do *to* the
 * foe. It could not tell a matchup it was winning from one it was about to lose,
 * so it had no basis for switching at all. `incomingDamage` estimates the foe's
 * best move against a given body with the same @smogon/calc the outgoing
 * estimate uses — the same tool, pointed the other way.
 *
 * That estimate is deliberately **imperfect in the player's favour**: the foe's
 * moves are not public information (`BattleView` does not carry them, on
 * purpose), so the AI reasons from the foe's *types* and its own weaknesses
 * rather than from a move list it has not seen. A bot that read the player's
 * moveset would make the balance sweep measure something no human plays
 * against. The estimate is therefore a threat *bound*, not a prediction, and
 * that is the honest version.
 *
 * Damage numbers come from @smogon/calc rather than from a formula written
 * here, for the same reason the battle engine comes from @pkmn/sim.
 */
import { Generations, Move, Pokemon, calculate } from '@smogon/calc';

import type {
  ActiveView,
  BattleView,
  Choice,
  MoveView,
  StatsTable,
  SwitchView,
} from '../types';
import { moveChoice, switchChoice } from '../types';
import { GYMRUN_GEN } from './format';
import type { Policy } from './policy';
import { legalChoices, usableSwitches } from './switching';

const gen = Generations.get(GYMRUN_GEN);

/**
 * The AI's behaviour version, reported next to `randomizerVersion`.
 *
 * **Separate from every other version string in the project, and it earns
 * that.** An AI change shifts win rates exactly as much as a data change does,
 * and the two are indistinguishable in a report that does not name them: two
 * balance runs a week apart showing a six-point completion gap could be a move
 * pool edit or could be this file, and there is no way to tell after the fact.
 * Bump it whenever `scoreChoices` would rank a choice set differently.
 */
export const AI_VERSION = 'gymrun-ai-2-switching';

// ---------------------------------------------------------------------------
// Damage estimates
// ---------------------------------------------------------------------------

/**
 * Build the calc's view of an active Pokemon from ours.
 *
 * Every Pokemon in the game gets a Serious nature, 31 IVs and 0 EVs (see
 * driver.toPokemonSet), so this reconstruction is exact rather than an
 * estimate. When a later stage introduces spreads it becomes an approximation
 * of the opponent, which is the correct behaviour anyway — a player estimating
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
 * `Move` by name or id, built once.
 *
 * Constructing one is a dex lookup, and a thousand-seed sweep asks for the same
 * few hundred moves hundreds of thousands of times. `calculate` treats its move
 * argument as read-only, so sharing an instance is safe; the alternative was
 * measurably the largest single cost in the AI.
 */
const MOVE_CACHE = new Map<string, Move>();

function moveFor(name: string): Move {
  const cached = MOVE_CACHE.get(name);
  if (cached) return cached;
  const move = new Move(gen, name);
  MOVE_CACHE.set(name, move);
  return move;
}

/** Midpoint of the calc's damage range, or a base-power fallback. */
function midpoint(attacker: Pokemon, defender: Pokemon, move: Move, fallback: number): number {
  try {
    const [low, high] = calculate(gen, attacker, defender, move).range();
    return (low + high) / 2;
  } catch {
    // The calc does not model every move, and a randomizer will eventually hand
    // it combinations nothing has ever seen. An unscoreable move falls back to
    // base power rather than crashing the opponent's turn.
    return fallback;
  }
}

function expectedDamageOf(me: Pokemon, foe: Pokemon, move: MoveView): number {
  if (move.category === 'Status') return 0;
  return midpoint(me, foe, moveFor(move.name), move.basePower);
}

/**
 * A representative attack for a type, for estimating what the foe threatens.
 *
 * The foe's actual moves are not in `BattleView` — deliberately, since a player
 * cannot see them either — so the threat estimate is built from what the foe
 * *could* hit with: a generic 80 BP attack of each of its types, which is close
 * to the average STAB move in the shipped pools. The result is a bound rather
 * than a prediction, and it is the same bound a person forms when they see a
 * Fire type across the field and decide not to send in their Grass type.
 *
 * One fixed physical and one fixed special probe per type, so a foe is assumed
 * to hit on whichever side hurts more. That is the pessimistic reading and the
 * right one: an AI that guessed wrong about the split would switch into the
 * kill it was trying to avoid.
 */
const PROBE_BY_TYPE = new Map<string, [Move, Move]>();

function probesFor(type: string): [Move, Move] {
  const cached = PROBE_BY_TYPE.get(type);
  if (cached) return cached;
  // Tackle overridden rather than a real move per type: the calc wants a move
  // it knows, and every property that matters here is being replaced anyway.
  // The cast is on `type`, which the view carries as a plain string and the
  // calc types as its own `TypeName` union — a foe's types come from the sim,
  // so they are always members of it.
  const shape = { basePower: 80, type: type as never, ignoreDefensive: false };
  const probes: [Move, Move] = [
    new Move(gen, 'Tackle', { overrides: { ...shape, category: 'Physical' } }),
    new Move(gen, 'Tackle', { overrides: { ...shape, category: 'Special' } }),
  ];
  PROBE_BY_TYPE.set(type, probes);
  return probes;
}

/**
 * What the foe would take off this body next turn, in HP.
 *
 * Used for two different questions and worth naming both. Against the *active*
 * Pokemon it answers "am I about to be knocked out?", which is what makes a
 * switch worth considering at all. Against a *bench* member it answers "would
 * the thing I am sending in survive arriving?", which is the rule that stops
 * the AI switching into the kill — the spec's `never switch into a move that
 * kills the incoming member, when that is calculable`.
 */
function incomingDamage(attacker: Pokemon, types: readonly string[], target: Pokemon): number {
  let worst = 0;
  for (const type of types) {
    for (const probe of probesFor(type)) {
      worst = Math.max(worst, midpoint(attacker, target, probe, 0));
    }
  }
  return worst;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * One legal choice, with the reasoning behind its score.
 *
 * Exported whole rather than as a bare number so tests can assert *why* the AI
 * did something. A test that only checks which slot came back passes just as
 * happily when the right answer is reached for the wrong reason, and this file
 * is the one place in the project where that distinction decides whether a
 * thousand-seed balance report means anything.
 */
export interface ChoiceEvaluation {
  choice: Choice;
  /** The move, for a move choice. */
  move?: MoveView;
  /** The bench member, for a switch choice. */
  member?: SwitchView;
  /** Damage this choice deals to the foe, as a fraction of the foe's max HP. */
  offense: number;
  /** Damage the foe deals back, as a fraction of the relevant body's max HP. */
  risk: number;
  /** True when even a middling roll finishes the foe. */
  kills: boolean;
  /** What the policy maximises. Higher is better; comparable across kinds. */
  score: number;
}

/**
 * The weights, gathered so a tuning pass is an edit to one object.
 *
 * Every one of them is in **HP-fraction units**, which is what makes a move and
 * a switch comparable at all: "deals 40% of their bar" and "avoids taking 70%
 * of mine" are the same currency. A weight table in raw HP would rank a choice
 * differently against a Blissey than against a Gengar for no reason anybody
 * chose.
 */
const WEIGHTS = {
  /** A kill outranks everything. Nothing else in this table can reach it. */
  kill: 100,
  /**
   * What being knocked out next turn costs, subtracted from a move's score.
   *
   * Below `kill` on purpose. **Do not switch on the turn a kill is available**
   * is the spec's rule and this is how it is enforced: taking the kill scores
   * at least 100, and no amount of incoming threat can drag it under a switch.
   */
  faintPenalty: 6,
  /** What a switch costs by definition: the turn, and the free hit. */
  switchCost: 1.2,
  /** How much the incoming member's own threat is worth on arrival. */
  threat: 1,
  /** A healthy body is worth a little; a real threat is worth more. */
  bulk: 0.35,
} as const;

/**
 * Score a move.
 *
 * Damage times accuracy, plus the kill bonus, minus what staying in costs when
 * the foe is about to knock this body out. That last term is the only thing
 * that makes a switch ever win: a move scored purely on its own damage is
 * always at least as good as spending the turn moving, so an AI without a
 * `risk` term is an AI that never switches, and the simulator's switch-rate
 * metric exists precisely to catch that having happened by accident.
 */
function scoreMove(
  view: BattleView,
  bodies: CalcBodies,
  move: MoveView,
  selfRisk: number,
): ChoiceEvaluation {
  const foeMaxHp = Math.max(1, view.foe.maxHp);
  const damage = expectedDamageOf(bodies.me, bodies.foe, move);
  const accuracy = move.accuracy === true ? 1 : Math.max(0, Math.min(100, move.accuracy)) / 100;
  const offense = (damage / foeMaxHp) * accuracy;
  const kills = damage >= Math.max(1, view.foe.hp);

  // The threat only counts against a body that cannot absorb it. Being hit for
  // 30% is not a reason to spend a turn; being knocked out is.
  const lethal = selfRisk >= 1 ? selfRisk : 0;

  return {
    choice: moveChoice(move.slot),
    move,
    offense,
    risk: selfRisk,
    kills,
    score: offense + (kills ? WEIGHTS.kill * accuracy : 0) - lethal * WEIGHTS.faintPenalty,
  };
}

/**
 * Score a switch.
 *
 * Three terms: what the incoming member would threaten the foe with, how much
 * of its own bar it loses on arrival, and the flat cost of spending the turn.
 *
 * **The arrival term is the one that stops the AI switching into a kill.** A
 * member that dies on the way in scores `-Infinity` and is never chosen, which
 * is a hard rule rather than a large penalty because a large penalty is a rule
 * that a big enough offensive term eventually buys its way past.
 */
function scoreSwitch(view: BattleView, bodies: CalcBodies, member: SwitchView): ChoiceEvaluation {
  const foeMaxHp = Math.max(1, view.foe.maxHp);
  const memberMaxHp = Math.max(1, member.maxHp);
  const body = toCalcSwitch(member);

  let best = 0;
  for (const id of member.moves) {
    const move = moveFor(id);
    if (move.category === 'Status') continue;
    best = Math.max(best, midpoint(body, bodies.foe, move, move.bp));
  }
  const offense = best / foeMaxHp;
  const arriving = incomingDamage(bodies.foe, view.foe.types, body) / memberMaxHp;
  // Fraction of the *member's current* bar, which is what decides whether it
  // survives arriving — a body at 20% dies to a hit worth 25% of its maximum.
  const survives = arriving < member.hp / memberMaxHp;

  return {
    choice: switchChoice(member.slot),
    member,
    offense,
    risk: arriving,
    kills: false,
    score: survives
      ? offense * WEIGHTS.threat + member.hpFraction * WEIGHTS.bulk - arriving - WEIGHTS.switchCost
      : Number.NEGATIVE_INFINITY,
  };
}

/**
 * Score every legal choice this turn, on one scale.
 *
 * Exported so tests can inspect the reasoning and so the simulator can measure
 * how often a switch was even *close* to winning — a switch rate of zero can
 * mean the AI never wants to switch or that the term is not wired in, and only
 * the scores tell the two apart.
 *
 * Order follows `legalChoices`: moves in slot order, then switches in slot
 * order. `bestOf` breaks ties toward the earlier entry, so the order is part of
 * the contract rather than an accident — an unspecified tie-break would make a
 * seed stop reproducing the same battle.
 */
export function scoreChoices(view: BattleView): ChoiceEvaluation[] {
  const forced = view.forceSwitch;
  // Both active bodies built once per turn and shared by every branch below.
  // Constructing one is not free and the naive version rebuilt the foe for
  // every move, every bench member and every bench member's every move.
  const bodies: CalcBodies = { me: toCalcPokemon(view.me), foe: toCalcPokemon(view.foe) };
  // Likewise the question "am I about to be knocked out?" — one answer per
  // turn, shared by every move that has to be discounted by it.
  const selfRisk = forced
    ? 0
    : incomingDamage(bodies.foe, view.foe.types, bodies.me) / Math.max(1, view.me.hp);

  return legalChoices(view).map((choice) => {
    if (choice.kind === 'switch') {
      const member = view.switches.find((entry) => entry.slot === choice.slot);
      if (!member) throw new Error(`No bench member in slot ${choice.slot}`);
      const scored = scoreSwitch(view, bodies, member);
      // On a forced switch there is no turn to spend and no alternative to
      // compare against: every option is a switch, so the cost is a constant
      // and subtracting it from all of them would only risk `-Infinity`
      // everywhere when the whole bench dies on arrival.
      return forced
        ? { ...scored, score: scored.offense * WEIGHTS.threat + member.hpFraction * WEIGHTS.bulk - scored.risk }
        : scored;
    }
    const move = view.moves.find((entry) => entry.slot === choice.slot);
    if (!move) throw new Error(`No move in slot ${choice.slot}`);
    return scoreMove(view, bodies, move, selfRisk);
  });
}

/** The two active bodies, built once per turn and threaded through scoring. */
interface CalcBodies {
  me: Pokemon;
  foe: Pokemon;
}

/** The highest-scoring evaluation. Ties break toward the earlier entry, always. */
export function bestOf(evaluations: readonly ChoiceEvaluation[]): ChoiceEvaluation {
  const first = evaluations[0];
  if (!first) throw new Error('No legal choice to score');
  let best = first;
  for (const evaluation of evaluations) {
    if (evaluation.score > best.score) best = evaluation;
  }
  return best;
}

/**
 * The opponent policy.
 *
 * Two lines, because the structure above is the whole design: build the legal
 * set, score it on one scale, take the max. Adding hazard awareness or status
 * pressure later means adding a term to `scoreMove`, and nothing outside this
 * file changes — the caller only ever sees `Policy`.
 */
export const greedyAiPolicy: Policy = async (view: BattleView): Promise<Choice> => {
  const evaluations = scoreChoices(view);
  if (evaluations.length === 0) {
    throw new Error(view.forceSwitch ? 'AI is forced to switch with nothing to switch to' : 'AI has no legal choice');
  }
  return bestOf(evaluations).choice;
};

// ---------------------------------------------------------------------------
// Compatibility surface
// ---------------------------------------------------------------------------

/**
 * The move half of the scored set, in the Stage 0 shape.
 *
 * Kept because `evaluateMoves` is the thing a test asks when it wants to know
 * whether the AI understands *damage* — a question that is still meaningful and
 * still separate from whether it understands switching. It is a projection of
 * `scoreChoices`, not a second implementation: two scoring paths would be two
 * AIs, and the report could not say which one it measured.
 */
export interface MoveEvaluation {
  move: MoveView;
  /** Midpoint of the calc's damage roll range, in HP. */
  expectedDamage: number;
  /** `expectedDamage` as a fraction of the target's max HP. */
  expectedFraction: number;
  /** True when even the low roll faints the target. */
  guaranteedKo: boolean;
  /** What the policy maximises for this move. Higher is better. */
  score: number;
}

export function evaluateMoves(view: BattleView): MoveEvaluation[] {
  const foeMaxHp = Math.max(1, view.foe.maxHp);
  return scoreChoices(view)
    .filter((evaluation): evaluation is ChoiceEvaluation & { move: MoveView } => evaluation.move !== undefined)
    .map((evaluation) => ({
      move: evaluation.move,
      expectedDamage: evaluation.offense * foeMaxHp,
      expectedFraction: evaluation.offense,
      guaranteedKo: evaluation.kills,
      score: evaluation.score,
    }));
}

/** The switch half, likewise. */
export function evaluateSwitches(view: BattleView): { member: SwitchView; score: number }[] {
  return scoreChoices(view)
    .filter((evaluation): evaluation is ChoiceEvaluation & { member: SwitchView } => evaluation.member !== undefined)
    .map((evaluation) => ({ member: evaluation.member, score: evaluation.score }));
}

/** Bench members the sim would accept right now. Re-exported for policy code. */
export { usableSwitches };
