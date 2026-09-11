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
  SeenKnowledge,
  BattleView,
  Choice,
  MoveView,
  StatsTable,
  SwitchView,
} from '../types';
import { moveChoice, switchChoice } from '../types';
// The chart lookup, from the adapter that owns every dex read. `crudeDamageOf`
// is the only caller here; nothing else in this file reads a type chart,
// because the calc does it properly.
import { describeMove, typeMultiplier } from './driver';
import { itemById } from '../../data/items';
import { HP_AWARE } from '../../data/ai';
import { GYMRUN_GEN } from './format';
import type { RngStream } from '../rng';
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
 *
 * `-4`, the unknown ability: `UNKNOWN_ABILITY` below. No new reasoning, one
 * fewer false fact — the calc stopped substituting the species' default
 * ability for a foe whose ability is not public, so damage estimates against a
 * randomized ability changed and with them the ranking. Its own commit and its
 * own benchmark row, `docs/balance.md` section 16.
 */
export const AI_VERSION = 'gymrun-ai-4-ability';

// ---------------------------------------------------------------------------
// Flags, and the one profile the whole file is parameterised by
// ---------------------------------------------------------------------------

/**
 * One switchable piece of the scorer.
 *
 * **One pipeline, one flag space, three tiers.** Every tier runs the code
 * below; what differs is which flags it holds. That is the shape every
 * reference implementation converged on — pokeemerald-expansion's per-trainer
 * flag sets, Essentials' cumulative skill bands — and the reason is that three
 * scorers are three things to keep honest, and a report cannot say which one
 * it measured.
 *
 * **Additive flags and handicap flags live in the same space, deliberately.**
 * The expansion does the same thing (`AI_FLAG_CONSERVATIVE` and
 * `AI_FLAG_SEQUENCE_SWITCHING` sit beside `AI_FLAG_TRY_TO_FAINT`), and it is
 * the honest encoding here for a specific reason: **the baseline is the full
 * `@smogon/calc` estimate, not a feature.** The AI has had a real damage
 * calculation since Stage 0. Modelling "does full damage" as a flag to add
 * would say the opposite, and the first thing a reader would do with it is
 * write the reference implementations' base-power proxy — which is a *worse*
 * estimate than the one already here, because poke-env writes that proxy
 * having no calc on hand and we have one.
 *
 * So `crudeDamage` takes the calc away, and easy tier is built by holding it.
 * Everything else is an addition to the frozen baseline below.
 */
export type AiFlag =
  /** Never pick a move that does nothing: an immunity, a status onto a statused target. */
  | 'avoidFailingMoves'
  /** Prefer a move that faints, and the priority layer in the header. */
  | 'takeTheKo'
  /** No setup at low HP, no status into a target that is nearly dead. */
  | 'hpAware'
  /** Read held items — its own and any the battle has revealed — into the estimate and the kill line. */
  | 'itemAware'
  /** Remember what this battle has actually shown: moves, ability, item. Forgotten on a switch out. */
  | 'seenKnowledge'
  /** Score a choice against the board it produces, including the foe's expected reply. */
  | 'oneStepLookahead'
  /** Choose the send-in after a knockout by matchup rather than by party order. */
  | 'smartSendIn'
  /** Consider a voluntary switch at all. */
  | 'smartSwitching'
  /** **Handicap.** Base power and type effectiveness only: no stats, no boosts, no STAB, no accuracy. */
  | 'crudeDamage';

/** A tier's whole behaviour: which flags it holds, and how often it takes a lesser choice. */
export interface AiProfile {
  flags: readonly AiFlag[];
  /**
   * Probability of taking a move other than the top-scored one, weighted by
   * score. Zero is deterministic. See `withNoise` for the weighting and
   * `core/rng.ts` for where the roll comes from.
   */
  noise: number;
  /**
   * Probability that a voluntary switch this profile wanted is not taken.
   *
   * Independent of `noise` on purpose: the expansion's switch checks carry
   * their own failure rate, because a switch is the decision a player can most
   * easily bait. Never applies to a forced switch.
   */
  switchFailure: number;
}

function has(profile: AiProfile, flag: AiFlag): boolean {
  return profile.flags.includes(flag);
}

/**
 * The AI as it played before this patch, frozen.
 *
 * **This set is pinned and does not move again.** Every figure in
 * `docs/balance.md` was measured with the simulator's `greedy` bot on *both*
 * sides, and `greedy` is this file's `decide`. So until this patch, every
 * opponent AI change silently moved the player-side control as well, and the
 * benchmark was read down a column whose meaning was drifting underneath it.
 * Two rows a month apart could differ because the game changed or because the
 * yardstick did, and nothing in the report said which.
 *
 * From here the yardstick is this constant, `greedy` is bound to it
 * permanently, and **`AI_VERSION` joins the seed prefix and seed count in
 * every benchmark stamp**: read down an AI version the same way you read down
 * a prefix. A future patch that wants a better baseline adds a *new* policy
 * name beside `greedy` rather than improving it.
 *
 * The three flags are exactly what `gymrun-ai-3-priority` did: take the
 * knockout and the priority layer in front of it, score a voluntary switch
 * against every move, answer a forced switch by matchup. It holds no
 * `avoidFailingMoves` because the pre-patch scorer had no such rule — a move
 * the foe is immune to simply scored zero and lost to anything positive, which
 * is not the same thing and is not asserted as though it were.
 *
 * `test/ai-tiers.test.ts` holds this set against the recorded fixture: the
 * baseline profile reproduces the pre-refactor AI byte for byte.
 */
export const GREEDY_BASELINE: AiProfile = {
  flags: ['takeTheKo', 'smartSendIn', 'smartSwitching'],
  noise: 0,
  switchFailure: 0,
};

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
/**
 * The ability handed to the calc when the real one is not public information.
 *
 * **The fix this patch opened with, and it is a correctness fix rather than a
 * tier feature.** `@smogon/calc` resolves its ability as
 * `options.ability || species.abilities[0]`, so omitting the field does not
 * mean "no ability" — it means **the species' default ability**. In a game
 * that ships species as they are that is a decent guess. Under full ability
 * randomization it is a wrong number: a Gengar the randomizer gave Cursed Body
 * was calculated as though it had Levitate, so a Ground move read as a 0x
 * no-op that would in fact have landed, and the AI declined the move that won
 * the turn.
 *
 * That is not the honest ignorance the header above describes. Ignorance is
 * *no* ability; this was a **false fact**, and it sat underneath every damage
 * estimate against every opponent whose ability had not been revealed — which
 * is all of them, since `ActiveView.ability` is null for the foe by design.
 *
 * So the unknown is passed explicitly. The string matches no real ability, so
 * every `hasAbility` check in the calc answers false and the estimate is made
 * with no ability effects at all — the bound the header claims to be making.
 * It must stay non-empty: the calc treats `''` as falsy and would fall back to
 * the species default again, and it treats `''` internally as *suppressed*,
 * which is a third meaning nobody wants here.
 *
 * Recorded in `docs/balance.md` section 16 with its own benchmark row, taken
 * before any other number in this patch.
 */
const UNKNOWN_ABILITY = '(unknown)';

function toCalcPokemon(active: ActiveView, revealed?: string | null, item?: string | null): Pokemon {
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
    // Never omitted: an omitted ability is the species default, not an unknown
    // one. See `UNKNOWN_ABILITY`. `revealed` is what `seenKnowledge` watched the
    // protocol announce — an ability that has named itself is public, and a tier
    // holding that flag is allowed to have noticed.
    ability: active.ability ?? revealed ?? UNKNOWN_ABILITY,
    /*
     * `itemAware`. Undefined rather than a sentinel when nothing is known,
     * because "no item" is the calc's own default and is the right assumption:
     * unlike an ability, a Pokemon genuinely may be holding nothing, so
     * assuming none is ignorance rather than a false fact. A Life Orb or a
     * Choice Band changes what a turn does by half a bar, and berries are
     * common enough on trainer mons after 4.6b that a bot blind to them
     * misreads the kill line on a real share of turns.
     */
    ...(item ? { item: item as never } : {}),
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

function expectedDamageOf(me: Pokemon, foe: Pokemon, move: MoveView, profile: AiProfile, foeTypes: readonly string[]): number {
  if (move.category === 'Status') return 0;
  if (has(profile, 'crudeDamage')) return crudeDamageOf(move, foeTypes);
  return midpoint(me, foe, moveFor(move.name), move.basePower);
}

/**
 * The handicapped estimate: base power and type effectiveness, nothing else.
 *
 * **A restriction, and the shape of the restriction is the point.** It is what
 * a player knows on their first run — this move hits hard, that type chart
 * says it is super effective — with none of what they learn later: whose
 * attacking stat is better, what a +2 means, that a 70% move misses.
 *
 * The number is **not in HP** and is not meant to be. It is a ranking key, and
 * every flag that would compare a damage estimate against a HP number
 * (`takeTheKo`'s kill line, `smartSwitching`'s race, `oneStepLookahead`'s
 * post-turn board) is a flag the tier holding this one does not have. If a
 * future tier ever holds both, this becomes wrong and the tier table is what
 * changed, not this function.
 */
function crudeDamageOf(move: MoveView, foeTypes: readonly string[]): number {
  return move.basePower * typeMultiplier(move.type, foeTypes);
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
function incomingDamage(
  attacker: Pokemon,
  types: readonly string[],
  target: Pokemon,
  seen?: SeenKnowledge,
): number {
  const category = attackingSide(attacker);
  let worst = 0;
  /*
   * `seenKnowledge`: what has actually been used is scored as itself, and only
   * the types nothing has been seen from fall back to the generic probe.
   *
   * So the estimate sharpens in both directions, which is the point of an
   * information axis over a damage one. A foe that has shown a weak move of its
   * own type stops being feared at 65 base power; a foe that has shown a strong
   * one is feared exactly as hard as it hits. It is still a bound on the
   * unknown — a second, stronger move of a type already seen is invisible here,
   * which is what "seen" means and is the same limit the player plays under.
   */
  const revealed = new Set<string>();
  if (seen) {
    for (const name of seen.moves) {
      const move = moveFor(name);
      if (move.category === 'Status') continue;
      revealed.add(move.type);
      worst = Math.max(worst, midpoint(attacker, target, move, move.bp));
    }
  }
  for (const type of types) {
    if (revealed.has(type)) continue;
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
  /**
   * What a move that cannot do anything costs, under `avoidFailingMoves`.
   *
   * Large enough to lose to any move that does something, small enough that
   * `-Infinity` stays reserved for switching into a kill — a penalty a big
   * enough offensive term can outbid is a rule, and this is one.
   */
  failure: 50,
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
  profile: AiProfile,
): ChoiceEvaluation {
  const foeMaxHp = Math.max(1, view.foe.maxHp);
  const damage = expectedDamageOf(bodies.me, bodies.foe, move, profile, view.foe.types);
  // Accuracy is part of the full estimate and not of the crude one: a tier that
  // cannot read a stat cannot read a percentage either.
  const accuracy =
    has(profile, 'crudeDamage') || move.accuracy === true
      ? 1
      : Math.max(0, Math.min(100, move.accuracy)) / 100;
  const offense = (damage / foeMaxHp) * accuracy;
  const kills = damage >= killLine(view, profile);
  const takesTheKo = has(profile, 'takeTheKo');
  /*
   * `stay` is the race as it is *now*, identical across every move on the turn,
   * so it can only ever move moves as a block against switches. `oneStepLookahead`
   * replaces it with the race as it will be **after this particular move
   * resolves**, which is the first term in this file that tells one move from
   * another by anything other than damage.
   */
  const after = has(profile, 'oneStepLookahead')
    ? lookahead(view, move, damage, threatOf(view, selfRisk))
    : stay;

  return {
    choice: moveChoice(move.slot),
    move,
    offense,
    risk: selfRisk,
    kills,
    score:
      offense +
      (kills && takesTheKo ? AI_WEIGHTS.kill * accuracy : 0) +
      after * AI_WEIGHTS.matchup +
      failurePenalty(view, move, damage, profile),
  };
}

/**
 * How much damage it actually takes to knock this foe out.
 *
 * Its remaining HP, plus whatever a held berry is about to put back — under
 * `itemAware` and only when the item is known. **This is the "misreading the
 * kill line" case:** a foe on 40 HP holding a Sitrus Berry does not faint to a
 * 45-damage hit, it drops to low HP and heals a quarter of its bar, and a bot
 * that called that a knockout has just spent its turn on the wrong move and
 * will do it again next turn.
 *
 * Only a *known* item counts, so this sharpens exactly where the knowledge
 * does: its own side always, the foe's once the battle has shown it.
 */
function killLine(view: BattleView, profile: AiProfile): number {
  const hp = Math.max(1, view.foe.hp);
  if (!has(profile, 'itemAware')) return hp;
  const item = view.foe.item ?? (has(profile, 'seenKnowledge') ? (view.seen?.item ?? null) : null);
  const restores = item ? (itemById(toItemId(item))?.restores ?? null) : null;
  if (!restores) return hp;
  // A berry fires below half, so it only saves a foe that is above nothing and
  // below the line — which, for a damage estimate, is any foe this hit would
  // otherwise finish.
  return hp + (restores.flat ?? 0) + (restores.fraction ?? 0) * Math.max(1, view.foe.maxHp);
}

/** `Sitrus Berry` -> `sitrusberry`. The spelling `data/items.ts` keys on. */
function toItemId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The foe's best expected hit in HP, recovered from the per-turn risk the caller already computed. */
function threatOf(view: BattleView, selfRisk: number): number {
  return selfRisk * Math.max(1, view.me.hp);
}

/**
 * One step of lookahead: the board this move produces, and the reply it invites.
 *
 * **The rung the published ladder says is worth more than every heuristic
 * refinement put together** — max base power to one-step lookahead is the
 * largest single gap in the PokeChamp table. What it means here, exactly:
 *
 *   1. Resolve *my* move: the foe's HP after it lands.
 *   2. Decide whether the foe still gets to reply. It does, unless I act first
 *      and the move knocks it out. Acting first is `battle/speed.ts`'s forecast,
 *      plus the assumption the priority layer already makes — a bracket above
 *      zero goes before an ordinary move. A tie reads as second, which is the
 *      safe direction for a rule about not dying.
 *   3. Resolve the reply: the same `incomingDamage` bound the switch logic uses,
 *      applied to my remaining HP. Not a second damage model, and not a guess at
 *      *which* move — the foe's moves are not public information, and a
 *      lookahead that read them would be a different bot with a different score.
 *   4. Score the board that leaves: the race, from the HP both sides actually
 *      have after the turn.
 *
 * The gain is concentrated in two places, and they are the places a greedy
 * picker loses fights it could win. A move that knocks the foe out **before it
 * acts** scores the race at the cap rather than at whatever the current board
 * says. And a move that leaves me dead when the reply lands scores from zero
 * HP — so when another choice survives the turn, it wins, which is the
 * "throwing away a winnable fight" the whole patch is measured against.
 *
 * No RNG. Pure in its arguments, as every scoring term in this file is.
 */
function lookahead(view: BattleView, move: MoveView, damage: number, threat: number): number {
  const actsFirst = turnOrderOf(view) === 'first' || move.priority > 0;
  const foeHpAfter = Math.max(0, view.foe.hp - damage);
  const myHpAfter = Math.max(0, view.me.hp - threat);

  /*
   * **Resolved in order, and the order is the whole value of the step.** A
   * knockout the foe never sees is a won turn; the identical knockout from the
   * slower side, when the foe's hit lands first and finishes me, is a move that
   * never happens. Scoring both as a win is how a bot throws a fight it could
   * have won by switching, and the first cut of this function did exactly that
   * — caught by a twelve-seed smoke before the benchmark, not after.
   *
   * `MATCHUP_CAP` either way: the race is over, and there is nothing beyond the
   * cap on this scale by construction.
   */
  if (actsFirst) {
    if (foeHpAfter <= 0) return MATCHUP_CAP;
    if (myHpAfter <= 0) return -MATCHUP_CAP;
  } else {
    if (myHpAfter <= 0) return -MATCHUP_CAP;
    if (foeHpAfter <= 0) return MATCHUP_CAP;
  }

  return matchupQuality(damage, threat, myHpAfter, foeHpAfter);
}

/**
 * What a move that does nothing costs, or zero when the tier cannot tell.
 *
 * **`avoidFailingMoves`, and it is the one flag every tier holds.** The
 * reference implementations' floor rule: do not pick the move that cannot do
 * anything. An immunity, a status move aimed at an already-statused target.
 *
 * It is a penalty rather than a filter because a filter has to answer what
 * happens when *every* move fails, and the answer "pick the least useless one"
 * is a ranking, which is what this already is. The number is large enough to
 * lose to any real option and small enough that `-Infinity` stays reserved for
 * the one genuinely illegal outcome (switching into a kill).
 *
 * The pre-patch scorer had no such rule, which is why `GREEDY_BASELINE` does
 * not hold the flag: an immune move scored zero and lost to anything positive,
 * and that is a different behaviour that happens to agree most of the time.
 */
function failurePenalty(view: BattleView, move: MoveView, damage: number, profile: AiProfile): number {
  let penalty = 0;
  if (has(profile, 'avoidFailingMoves')) {
    if (move.category === 'Status') {
      // A status move onto a target that already carries one does nothing.
      if (view.foe.status) penalty -= AI_WEIGHTS.failure;
    } else if (damage <= 0) {
      penalty -= AI_WEIGHTS.failure;
    }
  }
  if (has(profile, 'hpAware')) penalty += hpPenalty(view, move);
  return penalty;
}

/**
 * The three bad ideas a HP bar makes obvious. **`hpAware`.**
 *
 * CHECK_BAD_MOVE's other half, restricted to what this view can prove: healing
 * at nearly full HP gives back less than the turn costs, setting up at low HP
 * spends a turn you are about to run out of, and a status that ticks over time
 * never ticks on a target that is one hit from fainting.
 *
 * The move's shape comes from `describeMove`, which is the one door onto a
 * move's fields and is already cached for the life of the process — so this is
 * a table lookup per move per turn, not a dex read.
 */
function hpPenalty(view: BattleView, move: MoveView): number {
  if (move.category !== 'Status') return 0;
  const shape = describeMove(move.id);
  if (!shape) return 0;

  let penalty = 0;
  if (shape.heal && view.me.hpFraction > HP_AWARE.healAbove) penalty -= AI_WEIGHTS.failure;
  if (shape.boosts?.some((boost) => boost.target === 'self' && boost.stages > 0)) {
    if (view.me.hpFraction < HP_AWARE.setupBelow) penalty -= AI_WEIGHTS.failure;
  }
  if (shape.status && view.foe.hpFraction < HP_AWARE.statusFoeBelow) penalty -= AI_WEIGHTS.failure;
  return penalty;
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
function scoreSwitch(
  view: BattleView,
  bodies: CalcBodies,
  member: SwitchView,
  profile: AiProfile,
  seen: SeenKnowledge | undefined,
): ChoiceEvaluation {
  const foeMaxHp = Math.max(1, view.foe.maxHp);
  const memberMaxHp = Math.max(1, member.maxHp);
  const body = toCalcSwitch(member);

  let best = 0;
  for (const id of member.moves) {
    const move = moveFor(id);
    if (move.category === 'Status') continue;
    // The handicap reaches the bench too, or a tier that cannot judge a matchup
    // on the field would judge one from it perfectly.
    best = Math.max(
      best,
      has(profile, 'crudeDamage')
        ? move.bp * typeMultiplier(move.type, view.foe.types)
        : midpoint(body, bodies.foe, move, move.bp),
    );
  }
  const offense = best / foeMaxHp;
  const arrivingHp = incomingDamage(bodies.foe, view.foe.types, body, seen);
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
export function scoreChoices(view: BattleView, profile: AiProfile = GREEDY_BASELINE): ChoiceEvaluation[] {
  const forced = view.forceSwitch;
  // Both active bodies built once per turn and shared by every branch below.
  // Constructing one is not free and the naive version rebuilt the foe for
  // every move, every bench member and every bench member's every move.
  const seen = has(profile, 'seenKnowledge') ? view.seen : undefined;
  const knowsItems = has(profile, 'itemAware');
  const foeItem = knowsItems ? (view.foe.item ?? seen?.item ?? null) : null;
  const bodies: CalcBodies = {
    me: toCalcPokemon(view.me, undefined, knowsItems ? view.me.item : null),
    foe: toCalcPokemon(view.foe, seen?.ability, foeItem),
  };
  // Likewise the question "am I about to be knocked out?" — one answer per
  // turn, shared by every move that has to be discounted by it.
  const threat = forced ? 0 : incomingDamage(bodies.foe, view.foe.types, bodies.me, seen);
  const selfRisk = threat / Math.max(1, view.me.hp);
  /*
   * The race the active Pokemon is currently in — the term a switch trades
   * away. Computed from its best available damage, which is the same number
   * the best move will score with, so "stay" and "attack" agree about how the
   * race is going.
   */
  const bestOutgoing = forced
    ? 0
    : Math.max(0, ...view.moves.map((move) => expectedDamageOf(bodies.me, bodies.foe, move, profile, view.foe.types)));
  const stay = forced ? 0 : matchupQuality(bestOutgoing, threat, view.me.hp, view.foe.hp);

  return legalChoices(view).map((choice) => {
    if (choice.kind === 'switch') {
      const member = view.switches.find((entry) => entry.slot === choice.slot);
      if (!member) throw new Error(`No bench member in slot ${choice.slot}`);
      const scored = scoreSwitch(view, bodies, member, profile, seen);
      if (!forced) {
        /*
         * Without `smartSwitching` a voluntary switch is not considered at all
         * — the pokeemerald handicap, where a trainer sends out in party order
         * and stays there. Scored and then refused rather than hidden, because
         * the evaluation is still what a test and the simulator read to ask how
         * close the switch came; `-Infinity` is the same answer this file
         * already gives to a switch it will not make.
         */
        return has(profile, 'smartSwitching') ? scored : { ...scored, score: Number.NEGATIVE_INFINITY };
      }
      return has(profile, 'smartSendIn')
        ? scoreForcedSwitch(scored, view, member)
        : sequenceSendIn(scored, member);
    }
    const move = view.moves.find((entry) => entry.slot === choice.slot);
    if (!move) throw new Error(`No move in slot ${choice.slot}`);
    return scoreMove(view, bodies, move, stay, selfRisk, profile);
  });
}

/**
 * The send-in a tier without `smartSendIn` makes: the next one in party order.
 *
 * `AI_FLAG_SEQUENCE_SWITCHING`, and it is the largest single handicap in the
 * table. The scores descend with the slot, so the lowest usable slot wins under
 * `bestOf`'s existing tie-break and the whole thing stays one ranked list —
 * a second code path for "who comes in" is the thing this file's header exists
 * to refuse.
 */
function sequenceSendIn(scored: ChoiceEvaluation, member: SwitchView): ChoiceEvaluation {
  return { ...scored, score: -member.slot };
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
export function decide(view: BattleView, profile: AiProfile = GREEDY_BASELINE): Decision {
  const evaluations = scoreChoices(view, profile);
  if (evaluations.length === 0) {
    throw new Error(view.forceSwitch ? 'AI is forced to switch with nothing to switch to' : 'AI has no legal choice');
  }
  const greedy = bestOf(evaluations);
  const order = turnOrderOf(view);
  const base: Decision = { choice: greedy.choice, branch: 'greedy', greedy: greedy.choice, order };
  // A forced switch has no moves to order; the rule is about moves.
  if (view.forceSwitch) return base;

  // The priority layer *is* the second half of `takeTheKo`: "do not die before
  // acting, and take the guaranteed knockout over the probable one" is what
  // TRY_TO_FAINT means in the reference implementations. A tier without the
  // flag is priority-blind, which is what every tier was before `-3`.
  if (!has(profile, 'takeTheKo')) return base;

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
 *
 * **Pinned to `GREEDY_BASELINE` permanently.** See that constant: this name is
 * the yardstick every figure in `docs/balance.md` is measured with, and a
 * yardstick that improves is not one.
 */
export const greedyAiPolicy: Policy = async (view: BattleView): Promise<Choice> => decide(view, GREEDY_BASELINE).choice;

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

/**
 * Take a lesser choice, sometimes.
 *
 * **Not a defect and not a difficulty dial in disguise.** Every reference
 * implementation is deliberately nondeterministic: the expansion's switch
 * checks carry intentional failure rates so that, in its own words, the player
 * cannot predict perfectly. A fully deterministic opponent is a puzzle with one
 * solution — solved once, never hard again — which is directly against the axis
 * this game is built on, that a player learns the system and gets better at it.
 *
 * Weighted by score, so noise is "a worse idea" rather than "a random idea": a
 * player watching an easy trainer should see a plausible move that is not the
 * best one, not Splash. The weights shift every candidate above zero by a tenth
 * of the spread, because a straight shift makes the lowest candidate weigh
 * nothing and a two-move set would then have no noise at all.
 *
 * **Moves only.** Whether to switch is a different decision with a different
 * failure mode, and it has its own rate below. A noise roll that answered
 * "switch" would be a tier making a strategic choice by accident, which is the
 * opposite of a handicap.
 */
function withNoise(
  evaluations: readonly ChoiceEvaluation[],
  best: ChoiceEvaluation,
  profile: AiProfile,
  rng: RngStream | undefined,
): ChoiceEvaluation {
  if (!rng || profile.noise <= 0 || best.move === undefined) return best;
  const alternatives = evaluations.filter(
    (entry) => entry.move !== undefined && entry !== best && Number.isFinite(entry.score),
  );
  if (alternatives.length === 0) return best;
  if (rng.nextFloat() >= profile.noise) return best;

  const scores = alternatives.map((entry) => entry.score);
  const low = Math.min(...scores);
  const span = Math.max(...scores) - low;
  const floor = (span > 0 ? span : 1) * 0.1;
  const weights = scores.map((score) => score - low + floor);
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let cursor = rng.nextFloat() * total;
  for (const [index, weight] of weights.entries()) {
    cursor -= weight;
    if (cursor <= 0) return alternatives[index] ?? best;
  }
  return alternatives[alternatives.length - 1] ?? best;
}

/**
 * The switch that does not happen. **An independent rate, per the expansion.**
 *
 * A switch is the decision a player can most easily read and pre-empt, so a
 * hard tier that switches every single time it should is a hard tier that can
 * be baited on every single turn. The rate is the probability that a voluntary
 * switch is abandoned for the best move instead; it is independent of move
 * noise and it never applies to a forced switch, which is not a decision.
 */
function withSwitchFailure(
  evaluations: readonly ChoiceEvaluation[],
  best: ChoiceEvaluation,
  profile: AiProfile,
  rng: RngStream | undefined,
  forced: boolean,
): ChoiceEvaluation {
  if (!rng || forced || best.member === undefined || profile.switchFailure <= 0) return best;
  if (rng.nextFloat() >= profile.switchFailure) return best;
  const moves = evaluations.filter((entry) => entry.move !== undefined && Number.isFinite(entry.score));
  if (moves.length === 0) return best;
  return bestOf(moves);
}

/**
 * A policy for one tier, in one battle.
 *
 * The stream is the battle's own (see `core/rng.ts`, `createAiStream`), so a
 * profile with noise is reproducible from the seed and a profile without it
 * draws nothing at all. A policy built without a stream is deterministic
 * whatever its profile says, which is what every test and every player-side
 * simulator bot wants.
 */
export function aiPolicy(profile: AiProfile, rng?: RngStream): Policy {
  return async (view: BattleView): Promise<Choice> => decideWith(view, profile, rng).choice;
}

/** `decide`, plus the two rolls. Exported so the simulator can count branches. */
export function decideWith(view: BattleView, profile: AiProfile, rng?: RngStream): Decision {
  const decision = decide(view, profile);
  if (!rng || (profile.noise <= 0 && profile.switchFailure <= 0)) return decision;

  const evaluations = scoreChoices(view, profile);
  const chosen = evaluations.find((entry) => sameChoice(entry.choice, decision.choice)) ?? bestOf(evaluations);
  const afterSwitch = withSwitchFailure(evaluations, chosen, profile, rng, view.forceSwitch);
  const afterNoise = withNoise(evaluations, afterSwitch, profile, rng);
  return { ...decision, choice: afterNoise.choice };
}

function sameChoice(a: Choice, b: Choice): boolean {
  return a.kind === b.kind && a.slot === b.slot;
}

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

export function evaluateMoves(view: BattleView, profile: AiProfile = GREEDY_BASELINE): MoveEvaluation[] {
  const foeMaxHp = Math.max(1, view.foe.maxHp);
  return scoreChoices(view, profile)
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
export function evaluateSwitches(view: BattleView, profile: AiProfile = GREEDY_BASELINE): { member: SwitchView; score: number }[] {
  return scoreChoices(view, profile)
    .filter((evaluation): evaluation is ChoiceEvaluation & { member: SwitchView } => evaluation.member !== undefined)
    .map((evaluation) => ({ member: evaluation.member, score: evaluation.score }));
}

/** Bench members the sim would accept right now. Re-exported for policy code. */
export { usableSwitches };
