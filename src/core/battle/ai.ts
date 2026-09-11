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
 *
 * ## Priority and speed, `gymrun-ai-3-priority` (overnight Branch 2)
 *
 * Until this version the AI was priority-blind and speed-blind: `MoveView`
 * carried no bracket and `BattleView` no Speed, so the greedy damage-max pick
 * could not know it was about to be outsped, or that it held a move that
 * would go first anyway. A slower opponent with Quick Attack in hand tackled
 * into its own knockout. **The whole rule, in front of the greedy pick and in
 * this order** — it is written here because every policy heuristic appears in
 * every balance report from this version on:
 *
 *   1. Compute expected damage for every legal choice, exactly as before
 *      (`scoreChoices`). Nothing below changes a score.
 *   2. Determine whether the AI acts first, second or `unknown` this turn from
 *      `battle/speed.ts` — Speed after stages and paralysis, ties `unknown`,
 *      move priority ignored.
 *   3. If the AI acts second or `unknown`, **and** the foe's best expected hit
 *      would knock the AI out this turn (`risk >= 1`: the same `incomingDamage`
 *      bound the switch logic already uses, evaluated from the foe's side — not
 *      a second damage model), then among the AI's moves with priority above
 *      zero pick the one with the highest expected damage. If it holds none,
 *      fall through.
 *   4. If any priority move knocks the foe out, pick it over a non-priority
 *      move that also would. A guaranteed first knockout beats a probable
 *      second one.
 *   5. Otherwise, the greedy pick.
 *
 * That is all of it. Out of scope, each its own pass and its own bump: switch
 * logic changes, status move valuation, secondary effects, Trick Room, and any
 * speed modifier beyond the three the helper models. The value of this version
 * is that its balance delta has one cause. `decide` reports which branch
 * produced a choice so the simulator can say how often the rule fired and how
 * often it changed the pick.
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
import { turnOrderOf, type TurnOrder } from './speed';
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
 * Bump it whenever `scoreChoices` would rank a choice set differently, or —
 * since `-3` — whenever `decide` would pick differently from the same scores.
 *
 * `-3`, the priority patch: the layer in the header. Recorded into every run
 * log's `versions.aiVersion` since the `contentHash` release, so a `-2` log
 * is refused at replay by name.
 */
export const AI_VERSION = 'gymrun-ai-3-priority';

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
 * The category is chosen from the foe's own attacking stats rather than by
 * taking the worse of the two, and **that changed after the first Stage 4
 * balance run.** Assuming a foe hits on whichever side hurts more roughly
 * doubles the estimated threat: a physically bulky Pokemon looks doomed to a
 * special attacker it is actually walling. The AI then read almost every turn
 * as lethal and switched out of matchups it was winning, and the simulator
 * measured `switch-aware` completing *less* often than `no-switch` — switching
 * was not a decision, it was a leak.
 *
 * Picking the side the foe is actually built to attack from is both more
 * accurate and fair game: base stats are public information, and a player
 * looking at a Gengar knows which number to worry about.
 */
const PROBE_BY_TYPE = new Map<string, Move>();

function probeFor(type: string, category: 'Physical' | 'Special'): Move {
  const key = `${type}/${category}`;
  const cached = PROBE_BY_TYPE.get(key);
  if (cached) return cached;
  // Tackle overridden rather than a real move per type: the calc wants a move
  // it knows, and every property that matters here is being replaced anyway.
  // The cast is on `type`, which the view carries as a plain string and the
  // calc types as its own `TypeName` union — a foe's types come from the sim,
  // so they are always members of it.
  const probe = new Move(gen, 'Tackle', {
    overrides: { basePower: 65, type: type as never, category, ignoreDefensive: false },
  });
  PROBE_BY_TYPE.set(key, probe);
  return probe;
}

/** Which side a Pokemon is built to attack from. Base stats are public. */
function attackingSide(attacker: Pokemon): 'Physical' | 'Special' {
  return attacker.stats.atk >= attacker.stats.spa ? 'Physical' : 'Special';
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
  const category = attackingSide(attacker);
  let worst = 0;
  for (const type of types) {
    worst = Math.max(worst, midpoint(attacker, target, probeFor(type, category), 0));
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
 * Exported and mutable so the simulator can sweep them. That is the same
 * reasoning `Tuning` rests on: a balance number the simulator cannot move
 * without a code change is not a lever, and these decide how often a switch
 * happens, which is the one behaviour this stage exists to price.
 *
 * Two currencies, and the conversion between them is `matchup`. `offense` and
 * `switchCost` are in **HP fractions**; a matchup quality is in **turns of
 * advantage**. Mixing them is the whole point — a move and a switch have to be
 * comparable — and `matchup` is the exchange rate.
 */
export const AI_WEIGHTS = {
  /** A kill outranks everything. Nothing else in this table can reach it. */
  kill: 100,
  /**
   * What a turn of matchup advantage is worth, in fractions of a HP bar.
   *
   * **The term that makes switching a real option, and it was missing from the
   * first cut.** That version scored a switch on one turn — what the incoming
   * member would threaten, minus what it took on arrival — against a move
   * scored on the same single turn. On a one-turn horizon a switch can never
   * win: it deals no damage and takes a free hit, so the only thing that could
   * ever justify it was a large penalty bolted onto staying.
   *
   * The simulator was unambiguous. Across every combination of that penalty and
   * the switch cost — twelve of them, from 1 to 6 and 0.4 to 1.2 —
   * `switch-aware` completed *fewer* runs than `no-switch`, by 1.2 to 2.8
   * points. Not once did switching pay. That is not a badly tuned cost, it is a
   * model that cannot express the benefit: a switch is an investment that pays
   * over the rest of the fight, and a one-turn score has nowhere to put that.
   *
   * So a body is now scored by the *race* it is in — how many turns it survives
   * against how many it needs to win — and a switch is worth the difference
   * between the incoming member's race and the current one's.
   */
  matchup: 2,
  /** What a switch costs by definition: the turn, and the free hit. */
  switchCost: 3,
  /** A healthy body is worth a little; a real threat is worth more. */
  bulk: 0.35,
};

/*
 * `faintPenalty` and `threat` used to live in this table and are gone.
 *
 * They were the one-turn model: `faintPenalty` docked a move for staying in
 * when the active was about to be knocked out, and `threat` scaled what the
 * incoming member would deal on the turn it arrived. Both existed to
 * approximate a benefit the model could not represent, and neither worked — see
 * the note on `matchup`. Removing them rather than zeroing them is deliberate:
 * a weight left at zero is an invitation to turn it back on, and turning either
 * of these back on is re-adopting the model the simulator rejected.
 */

/**
 * The most turns of advantage a matchup is allowed to be worth.
 *
 * A body the foe cannot damage at all races to `Infinity`, and a score of
 * infinity is a score that cannot be compared or tie-broken. It is also a lie
 * about a real fight, where a stall eventually ends on PP or the turn limit.
 */
const MATCHUP_CAP = 4;

/**
 * How well a body is doing in its race against the foe, in turns of advantage.
 *
 * Positive when it kills before it dies. **This is the number a switch trades
 * one for another**, and it is what a player means by "bad matchup": not "I
 * will take damage" but "I lose this race and something else wins it".
 *
 * Both halves are per-turn rates from the same calc, so a body that resists the
 * foe and hits it hard scores twice — which is right, because that is exactly
 * the Pokemon you want to bring in.
 */
function matchupQuality(outgoing: number, incoming: number, bodyHp: number, foeHp: number): number {
  const turnsToKill = outgoing > 0 ? Math.max(1, foeHp) / outgoing : Number.POSITIVE_INFINITY;
  const turnsToDie = incoming > 0 ? Math.max(1, bodyHp) / incoming : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(turnsToDie) && !Number.isFinite(turnsToKill)) return 0;
  if (!Number.isFinite(turnsToDie)) return MATCHUP_CAP;
  if (!Number.isFinite(turnsToKill)) return -MATCHUP_CAP;
  return Math.max(-MATCHUP_CAP, Math.min(MATCHUP_CAP, turnsToDie - turnsToKill));
}

/**
 * Score a move: progress made this turn, plus the matchup it keeps you in.
 *
 * The second half is what makes this comparable to a switch. Attacking is not
 * only "deal damage now" — it is also "stay in this race", and a race you are
 * losing is worth less than one you are winning. A switch replaces that term
 * with a different body's race; the difference between them, minus the turn
 * spent, is the whole of the decision.
 *
 * `stay` is identical across every move on the turn, so it never reorders them
 * among themselves — it only ever moves moves as a block against switches,
 * which is exactly the comparison it exists to make.
 */
function scoreMove(
  view: BattleView,
  bodies: CalcBodies,
  move: MoveView,
  stay: number,
  selfRisk: number,
): ChoiceEvaluation {
  const foeMaxHp = Math.max(1, view.foe.maxHp);
  const damage = expectedDamageOf(bodies.me, bodies.foe, move);
  const accuracy = move.accuracy === true ? 1 : Math.max(0, Math.min(100, move.accuracy)) / 100;
  const offense = (damage / foeMaxHp) * accuracy;
  const kills = damage >= Math.max(1, view.foe.hp);

  return {
    choice: moveChoice(move.slot),
    move,
    offense,
    risk: selfRisk,
    kills,
    score: offense + (kills ? AI_WEIGHTS.kill * accuracy : 0) + stay * AI_WEIGHTS.matchup,
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
  const arrivingHp = incomingDamage(bodies.foe, view.foe.types, body);
  const arriving = arrivingHp / memberMaxHp;
  // Measured in HP, not in fractions of the maximum: a body at 20% dies to a
  // hit worth 25% of its bar, and the comparison that says so is against what
  // it has left rather than against what it started with.
  const survives = arrivingHp < member.hp;

  /*
   * The race the incoming member would be in, measured from the HP it will
   * actually have — after the free hit it takes on the way in. Scoring it at
   * full HP would price a switch as though arriving were free, which is the one
   * thing about switching that definitely is not.
   */
  const quality = matchupQuality(best, arrivingHp, member.hp - arrivingHp, view.foe.hp);

  return {
    choice: switchChoice(member.slot),
    member,
    offense,
    risk: arriving,
    kills: false,
    score: survives
      ? quality * AI_WEIGHTS.matchup + member.hpFraction * AI_WEIGHTS.bulk - AI_WEIGHTS.switchCost
      : Number.NEGATIVE_INFINITY,
  };
}

/**
 * The same candidate, scored for a forced switch.
 *
 * Three things differ, and each is a consequence of there being no alternative:
 * no turn is being spent, so the switch cost comes off; there is no current
 * matchup to trade away, because the active Pokemon is gone; and nothing may
 * score `-Infinity` for dying on arrival, because the whole bench might, and a
 * forced switch still has to produce an answer.
 *
 * What is left is "who is best against this foe", which is the right question.
 * It is deliberately built from `scoreSwitch`'s own numbers rather than
 * recomputed — the first cut called `matchupQuality` here with an incoming
 * damage of zero, which makes every candidate race to infinity and score
 * identically, quietly reducing the whole term to a constant.
 */
function scoreForcedSwitch(scored: ChoiceEvaluation, view: BattleView, member: SwitchView): ChoiceEvaluation {
  const foeMaxHp = Math.max(1, view.foe.maxHp);
  const memberMaxHp = Math.max(1, member.maxHp);
  const outgoing = scored.offense * foeMaxHp;
  const incoming = scored.risk * memberMaxHp;
  const quality = matchupQuality(outgoing, incoming, member.hp, view.foe.hp);

  return {
    ...scored,
    score: quality * AI_WEIGHTS.matchup + scored.offense + member.hpFraction * AI_WEIGHTS.bulk,
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
  const threat = forced ? 0 : incomingDamage(bodies.foe, view.foe.types, bodies.me);
  const selfRisk = threat / Math.max(1, view.me.hp);
  /*
   * The race the active Pokemon is currently in — the term a switch trades
   * away. Computed from its best available damage, which is the same number
   * the best move will score with, so "stay" and "attack" agree about how the
   * race is going.
   */
  const bestOutgoing = forced
    ? 0
    : Math.max(0, ...view.moves.map((move) => expectedDamageOf(bodies.me, bodies.foe, move)));
  const stay = forced ? 0 : matchupQuality(bestOutgoing, threat, view.me.hp, view.foe.hp);

  return legalChoices(view).map((choice) => {
    if (choice.kind === 'switch') {
      const member = view.switches.find((entry) => entry.slot === choice.slot);
      if (!member) throw new Error(`No bench member in slot ${choice.slot}`);
      const scored = scoreSwitch(view, bodies, member);
      return forced ? scoreForcedSwitch(scored, view, member) : scored;
    }
    const move = view.moves.find((entry) => entry.slot === choice.slot);
    if (!move) throw new Error(`No move in slot ${choice.slot}`);
    return scoreMove(view, bodies, move, stay, selfRisk);
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

/** Which step of the header's rule produced a choice. */
export type DecisionBranch = 'greedy' | 'priority-escape' | 'priority-kill';

/** A choice, the branch that made it, and what the greedy pick alone would have been. */
export interface Decision {
  choice: Choice;
  branch: DecisionBranch;
  /** Step 5's answer, so a report can say how often the rule changed the pick. */
  greedy: Choice;
  /** Step 2's answer, for the Release C audit. */
  order: TurnOrder;
}

/** The highest-offense entry, ties toward the earlier one — the same tie-break as `bestOf`. */
function mostDamaging(moves: readonly ChoiceEvaluation[]): ChoiceEvaluation | undefined {
  let best: ChoiceEvaluation | undefined;
  for (const entry of moves) {
    if (!best || entry.offense > best.offense) best = entry;
  }
  return best;
}

/**
 * The rule in the header, applied to one turn. Exported so the fixed-position
 * tests can assert the branch and not only the slot, and so the simulator can
 * count how often the priority layer fires and how often it changes the pick.
 */
export function decide(view: BattleView): Decision {
  const evaluations = scoreChoices(view);
  if (evaluations.length === 0) {
    throw new Error(view.forceSwitch ? 'AI is forced to switch with nothing to switch to' : 'AI has no legal choice');
  }
  const greedy = bestOf(evaluations);
  const order = turnOrderOf(view);
  const base: Decision = { choice: greedy.choice, branch: 'greedy', greedy: greedy.choice, order };
  // A forced switch has no moves to order; the rule is about moves.
  if (view.forceSwitch) return base;

  const moves = evaluations.filter((entry): entry is ChoiceEvaluation & { move: MoveView } => entry.move !== undefined);
  const withPriority = moves.filter((entry) => entry.move.priority > 0);
  if (withPriority.length === 0) return base;

  // Step 3. `risk` on a move evaluation is the foe's best expected hit over
  // the AI's remaining HP, the same for every move this turn; at or above 1 it
  // is a knockout.
  const facingKo = moves.some((entry) => entry.risk >= 1);
  if (order !== 'first' && facingKo) {
    const escape = mostDamaging(withPriority);
    if (escape) return { ...base, choice: escape.choice, branch: 'priority-escape' };
  }

  // Step 4. Only when the greedy pick was not itself a priority knockout;
  // otherwise the rule changed nothing and says so.
  const priorityKills = withPriority.filter((entry) => entry.kills);
  if (priorityKills.length > 0 && !(greedy.move && greedy.move.priority > 0 && greedy.kills)) {
    const kill = mostDamaging(priorityKills);
    if (kill) return { ...base, choice: kill.choice, branch: 'priority-kill' };
  }

  return base;
}

/**
 * The opponent policy.
 *
 * Build the legal set, score it on one scale, apply the priority layer, take
 * the result. Adding hazard awareness or status pressure later means adding a
 * term to `scoreMove`, and nothing outside this file changes — the caller only
 * ever sees `Policy`.
 */
export const greedyAiPolicy: Policy = async (view: BattleView): Promise<Choice> => decide(view).choice;

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
