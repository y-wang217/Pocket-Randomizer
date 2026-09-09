/**
 * The headless balance simulator.
 *
 *   npm run sim -- --seeds 1000 --policy greedy
 *
 * This is the Stage 2 deliverable that matters most, and the reason is one
 * sentence: **you cannot balance a roguelike by playing it.** A designer can
 * play fifty runs in an afternoon and will remember the three that were
 * memorable. This plays a thousand in forty seconds and reports the
 * distribution, which is the only thing a difficulty curve is.
 *
 * It is deliberately a thin loop around `playRun`. Not a re-implementation of
 * the run loop with the UI parts removed — the *same* function the browser
 * calls, driven by a different `RunPolicy`. A simulator with its own run loop
 * measures its own run loop, and drifts out of agreement with the game at
 * exactly the moment the numbers start being used to make decisions.
 *
 * ## What it reports, and why each number is here
 *
 *   - **Clear rate per gym**, plus the drop from the previous gym. A curve is
 *     not "hard at the end", it is a slope, and the failure mode is a cliff:
 *     one gym that halves the population. The delta column is what finds it.
 *   - **Completion rate.** The headline, and the least informative number on
 *     its own.
 *   - **Cause of death**, split three ways: which gym, which opposing species,
 *     which move landed the kill. "Runs end at gym 4" is a hypothesis; "runs
 *     end at gym 4 to Sheer Force Boomburst off a Regigigas" is a fix.
 *   - **Turns per battle, per segment.** Stage 1's finding was that fights
 *     lasted 1.5 turns whatever the levels were, because a fully evolved
 *     Pokemon's best move one-shots another one. This is the number that says
 *     whether the move bands fixed it.
 *   - **Outlier seeds**, printed so they can be replayed in the browser. A
 *     distribution tells you there is a problem; a seed lets you watch it.
 *   - **Diversity.** The Stage 2 done condition is that each seed feels
 *     different, and win rate cannot measure that at all. If one species or one
 *     ability shows up in a disproportionate share of runs, the pools are too
 *     narrow — and a narrow pool that happens to be balanced would pass every
 *     other number in this report.
 *
 * ## The two policies
 *
 * `greedy` is the Stage 0 damage-maximising AI; `random` picks a legal move at
 * random from a seeded stream. **The gap between their win rates is the crude
 * measure of whether player skill matters.** If `random` clears gym 6, the game
 * has no depth and no amount of tuning the level curve will give it any.
 *
 * Both policies make the *same* node choices, so the gap measures move choice
 * and nothing else. `--nodes` compares node policies instead, which is the
 * other question and a different run.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AI_VERSION, greedyAiPolicy } from '../src/core/battle/ai';
import { ENGINE_VERSION } from '../src/core/battle/driver';
import { usableMoves, usableSwitches, withoutSwitching, type Policy } from '../src/core/battle/policy';
import type { NodeSpec } from '../src/core/encounters';
import { RANDOMIZER_VERSION } from '../src/core/randomizer';
import { createRng, type RngStream } from '../src/core/rng';
import {
  causeOfDeath,
  gymsCleared,
  playRun,
  RUN_LOG_VERSION,
  SEGMENTS_PER_RUN,
  type CauseOfDeath,
  type RunPolicy,
  type RunState,
} from '../src/core/run';
import { describeMove, describeSpecCard, type BattleSession } from '../src/core/battle/driver';
import type { EventOutcome } from '../src/core/events';
import { itemSuitsTypes } from '../src/core/items';
import type { MoveReward, Reward } from '../src/core/rewards';
import { hasRoom } from '../src/core/acquisition';
import {
  moveChoice,
  switchChoice,
  type ItemAssignment,
  type ItemPlan,
  type MoveSpec,
  type PokemonSpec,
  type PokemonState,
  type Tier,
} from '../src/core/types';
import { GYMS } from '../src/data/gyms';
import { itemById, ITEMS } from '../src/data/items';
import { DAMAGING_MOVES } from '../src/data/movePools';
import { expectedPartySize, opponentTeamSize, MOVESET, SEGMENTS } from '../src/data/scaling';
import { PARTY_SIZE } from '../src/data/partyTuning';
import { HEALTHY_BALANCE, priceAt } from '../src/data/shop';
import { DEFAULT_TUNING, type Tuning } from '../src/data/tuning';

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

/**
 * Who is playing.
 *
 * Two axes crammed into one flag, deliberately. `greedy` and `random` vary the
 * *battle* AI; `tier-averse` and `tier-greedy` vary *node selection* and always
 * use the greedy battle AI. The spec asks for the tier policies on `--policy`
 * because that is how a reader wants to type them —
 * `npm run sim -- --policy tier-greedy` — and the conflation is harmless as
 * long as it is written down: a tier policy is a node policy wearing the
 * battle AI it needs to be a fair comparison.
 */
type PolicyName =
  | 'greedy'
  | 'random'
  | 'tier-averse'
  | 'tier-greedy'
  /**
   * The Stage 4 pair, and the one comparison this stage is judged on.
   *
   * Same battle AI, same node policy, same seeds — the only difference is
   * whether a voluntary switch was ever on the table. `no-switch` is the
   * greedy AI wrapped in `withoutSwitching`, which blanks the bench rather
   * than discarding a switch the AI returned, so the two bots differ in
   * exactly one way (see `policy.withoutSwitching`).
   *
   * If the gap between them is under a few points, switching is decorative and
   * the switch cost or the party size is wrong. That is the whole hypothesis.
   */
  | 'switch-aware'
  | 'no-switch';
type NodePolicyName = 'rest' | 'wild' | 'trainer' | 'first' | 'random' | 'tier-averse' | 'tier-greedy';

/** The node policy a `--policy` name implies, if it implies one. */
const NODE_POLICY_FOR: Partial<Record<PolicyName, NodePolicyName>> = {
  'tier-averse': 'tier-averse',
  'tier-greedy': 'tier-greedy',
};

interface Options {
  seeds: number;
  policies: PolicyName[];
  nodePolicies: NodePolicyName[];
  prefix: string;
  outDir: string;
  tuning: Tuning;
  quiet: boolean;
}

const ALL_POLICIES: PolicyName[] = ['greedy', 'random'];
/** The Stage 4 headline: same AI, same seeds, switching on and off. */
const SWITCH_POLICIES: PolicyName[] = ['switch-aware', 'no-switch'];
const ALL_NODE_POLICIES: NodePolicyName[] = ['rest', 'wild', 'trainer', 'first'];
/** The Stage 3 headline: same seeds, same battle AI, opposite appetite for risk. */
const TIER_POLICIES: PolicyName[] = ['tier-averse', 'tier-greedy'];

function parseArgs(argv: string[]): Options {
  const options: Options = {
    seeds: 200,
    policies: ALL_POLICIES,
    nodePolicies: ['rest'],
    prefix: 'SIM',
    outDir: 'sim-reports',
    tuning: structuredClone(DEFAULT_TUNING),
    quiet: false,
  };
  const overrides: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    const value = (): string => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };

    switch (arg) {
      case '--seeds':
      case '-n':
        options.seeds = Number(value());
        break;
      case '--policy': {
        const name = value();
        options.policies =
          name === 'all'
            ? ALL_POLICIES
            : name === 'tiers'
              ? TIER_POLICIES
              : name === 'switching'
                ? SWITCH_POLICIES
                : [assertPolicy(name)];
        break;
      }
      case '--nodes': {
        const name = value();
        options.nodePolicies = name === 'all' ? ALL_NODE_POLICIES : [assertNodePolicy(name)];
        break;
      }
      case '--prefix':
        options.prefix = value();
        break;
      case '--out':
        options.outDir = value();
        break;
      case '--set':
        overrides.push(value());
        break;
      case '--quiet':
        options.quiet = true;
        break;
      case '--help':
      case '-h':
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        // A bare number is the seed count, so `npm run sim -- 500` works the
        // way the Stage 1 sweep did.
        if (/^\d+$/.test(arg)) options.seeds = Number(arg);
        else throw new Error(`Unknown argument "${arg}"\n${USAGE}`);
    }
  }

  if (!Number.isInteger(options.seeds) || options.seeds < 1) {
    throw new Error(`--seeds needs a positive integer, got ${options.seeds}`);
  }
  applyOverrides(options.tuning, overrides);
  return options;
}

const POLICY_NAMES: readonly string[] = [...ALL_POLICIES, ...TIER_POLICIES, ...SWITCH_POLICIES];

function assertPolicy(name: string): PolicyName {
  if (!POLICY_NAMES.includes(name)) {
    throw new Error(
      `--policy must be one of ${POLICY_NAMES.join(', ')}, tiers, switching or all (got "${name}")`,
    );
  }
  return name as PolicyName;
}

const NODE_POLICY_NAMES: readonly string[] = [...ALL_NODE_POLICIES, 'random', ...TIER_POLICIES];

function assertNodePolicy(name: string): NodePolicyName {
  if (!NODE_POLICY_NAMES.includes(name)) {
    throw new Error(`--nodes must be one of ${NODE_POLICY_NAMES.join(', ')}, or all`);
  }
  return name as NodePolicyName;
}

const USAGE = `
  npm run sim -- [options]

    --seeds N        how many seeds to play per policy (default 200)
    --policy NAME    greedy | random | switch-aware | no-switch | switching |
                     tier-averse | tier-greedy | tiers | all
                     greedy/random and switch-aware/no-switch vary the battle
                     AI; tier-* vary node choice and always use the greedy
                     battle AI                                (default all)
    --nodes NAME     rest | wild | trainer | first | random | tier-averse |
                     tier-greedy | all                        (default rest)
    --prefix TEXT    seed prefix, so two sweeps can use different populations
    --out DIR        where the JSON report lands   (default sim-reports)
    --set path=value override a Tuning field, e.g. --set stepsPerSegment.min=4
    --quiet          JSON only, no table

  The balance levers themselves live in src/data/scaling.ts and are edited
  there; --set reaches the map-shape knobs in src/data/tuning.ts.

  The Stage 3 headline:

    npm run sim -- --seeds 1000 --policy tiers

  The Stage 4 headline, and the one number this stage is judged on — the same
  battle AI with the bench visible and with it hidden:

    npm run sim -- --seeds 1000 --policy switching

  Party size is a module constant, not a --set field, because the difficulty
  curve is a function of it. GYMRUN_PARTY_SIZE=1 reproduces the Stage 3
  population on this build, which is how a completion-rate change gets
  attributed to the party rather than to a bug.
`;

/** `stepsPerSegment.min=4` -> that path replaced on the tuning object. */
function applyOverrides(tuning: Tuning, overrides: string[]): void {
  for (const override of overrides) {
    const [path, raw] = override.split('=');
    if (!path || raw === undefined) throw new Error(`Bad override "${override}", want path=value`);
    const keys = path.split('.');
    const leaf = keys.pop();
    if (!leaf) throw new Error(`Bad override "${override}"`);
    let cursor: Record<string, unknown> = tuning as unknown as Record<string, unknown>;
    for (const key of keys) {
      const child = cursor[key];
      if (typeof child !== 'object' || child === null) throw new Error(`Unknown tuning path "${path}"`);
      cursor = child as Record<string, unknown>;
    }
    if (!(leaf in cursor)) throw new Error(`Unknown tuning key "${path}"`);
    cursor[leaf] = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
  }
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

/**
 * Picks a legal move at random, from a seeded stream.
 *
 * The stream is `policy`, which exists for exactly this (see core/rng.ts). A
 * scripted bot borrowing the `battle` stream would change the damage rolls of
 * the battle it is playing, and the random policy's win rate would then be
 * measured against a different game from the greedy policy's.
 */
function randomMovePolicy(stream: RngStream): Policy {
  return async (view) => {
    if (view.forceSwitch) {
      const available = usableSwitches(view);
      const chosen = stream.pick(available);
      return switchChoice(chosen.slot);
    }
    const moves = usableMoves(view);
    return moveChoice(stream.pick(moves).slot);
  };
}

/**
 * The starter a policy picks.
 *
 * `greedy` takes the highest base stat total, which is what a player does when
 * handed three Pokemon and no other information. `random` takes one at random.
 * Both are deterministic given the seed; ties break toward the lower index so
 * the choice never depends on iteration order.
 *
 * This matters more than it looks. At `PARTY_SIZE` 1 the starter *was* the
 * entire run, so a starter policy that picked badly would report a difficulty
 * curve that was mostly a measurement of itself. With a party it is the first
 * of three and matters proportionally less — but it is still the only member
 * the player holds for the whole run, since acquisitions arrive later and at a
 * level penalty.
 */
function bestStarter(options: PokemonSpec[]): number {
  let best = 0;
  let bestHp = -1;
  for (const [index, option] of options.entries()) {
    // Max HP at the starter's level is the one bulk number available without
    // reaching into the species pool, and it correlates with what survives.
    const hp = describeSpecCard(option).maxHp;
    if (hp > bestHp) {
      bestHp = hp;
      best = index;
    }
  }
  return best;
}

const TIER_RANK: Record<Tier, number> = { normal: 0, hard: 1, elite: 2 };

/**
 * Below this share of party HP, both tier policies take a rest if offered.
 *
 * A threshold rather than "always rest", because resting means *not* taking a
 * fight and therefore not being paid — that trade is the run. Stage 2's
 * baseline bot took every rest it was offered, which measured a game where the
 * rest node has no cost; 0.7 is a careful player rather than a greedy or a
 * reckless one, and both tier policies use the same number so it cancels out
 * of the comparison they exist to make.
 */
const REST_THRESHOLD = 0.7;

/**
 * What the two tier policies share, so the only variable between them is which
 * *fight* they take.
 *
 * This preamble matters more than it looks. A `tier-averse` policy that also
 * happened to take every rest and every shop would be measuring risk aversion
 * *and* a shopping habit at once, and the report could not attribute the
 * difference to either. So both policies rest on the same threshold, shop on
 * the same rule, and diverge only when a step offers two fights.
 *
 * Returns -1 when nothing here applies and the tier rule should decide.
 */
function utilityChoice(options: NodeSpec[], state: RunState): number {
  const hp = state.party.reduce((total, member) => total + member.hp, 0);
  const maxHp = state.party.reduce((total, member) => total + member.maxHp, 0);

  if (maxHp > 0 && hp / maxHp < REST_THRESHOLD) {
    const rest = options.findIndex((option) => option.kind === 'rest');
    if (rest !== -1) return rest;
  }

  // Shop when there is something on the shelf we can actually pay for. Holding
  // money for a better shop later is a strategy; this bot does not have one,
  // and the currency curve is how you find out whether it should.
  const shop = options.findIndex(
    (option) => option.shop?.items.some((item) => item.price <= state.currency) ?? false,
  );
  if (shop !== -1) return shop;

  return -1;
}

/**
 * Prefers a node kind when a step offers it. `first` always takes index 0.
 *
 * The two tier policies are the Stage 3 addition and the reason this reads the
 * run state: "take the highest tier" is only a meaningful policy if the runs it
 * produces still rest and still shop, or it is a measurement of a bot that
 * never heals.
 */
function chooseNodeBy(kind: NodePolicyName, stream: RngStream) {
  return async (options: NodeSpec[], state: RunState): Promise<number> => {
    if (kind === 'first') return 0;
    if (kind === 'random') return stream.nextInt(Math.max(1, options.length));

    if (kind === 'tier-averse' || kind === 'tier-greedy') {
      const utility = utilityChoice(options, state);
      if (utility !== -1) return utility;

      const fights = options
        .map((option, index) => ({ index, tier: option.tier }))
        .filter((entry): entry is { index: number; tier: Tier } => entry.tier !== null);
      if (fights.length === 0) return 0;

      // Ties break to the lower index in both directions, so neither policy
      // picks up a hidden preference from array order.
      const best = fights.reduce((chosen, entry) =>
        (kind === 'tier-greedy'
          ? TIER_RANK[entry.tier] > TIER_RANK[chosen.tier]
          : TIER_RANK[entry.tier] < TIER_RANK[chosen.tier])
          ? entry
          : chosen,
      );
      return best.index;
    }

    const index = options.findIndex((option) => option.kind === kind);
    return index === -1 ? 0 : index;
  };
}

// ---------------------------------------------------------------------------
// Valuing a reward
// ---------------------------------------------------------------------------

/**
 * How much the bot thinks each staple is worth, before context.
 *
 * Taste, not measurement — which is the honest label. The report's "item
 * impact" section is the measurement, and if it disagrees with this table then
 * this table is what was wrong.
 */
const ITEM_VALUE: Record<string, number> = {
  leftovers: 105,
  lifeorb: 95,
  focussash: 90,
  choiceband: 85,
  choicespecs: 85,
  choicescarf: 80,
  assaultvest: 80,
  expertbelt: 70,
  shellbell: 65,
  rockyhelmet: 60,
  eviolite: 55,
  muscleband: 50,
  wiseglasses: 50,
  punchingglove: 45,
  weaknesspolicy: 45,
};

/**
 * What a card is worth to *this* run, right now.
 *
 * **This function is the reason the reward numbers in the report mean
 * anything.** A policy that took card 0 would make "reward take rate by kind" a
 * measurement of draw order and "win rate given you took an item" a measurement
 * of nothing at all. So the bot values a card roughly the way a player would: a
 * heal is worthless at full HP, a type item is worthless off type, a TM is
 * worth the gap between it and your worst attack, money is worth what it buys.
 *
 * It is deliberately *not* good. It has no plan, does not save for a better
 * shop, and cannot tell that a Choice item might be a trap. It is a floor on
 * competent play, which is what a balance measurement wants: a risk gradient
 * that only works for a bot playing perfectly does not work.
 */
function valueOfReward(reward: Reward, state: RunState, segment: number): number {
  const lead = state.party[0];
  if (!lead) return 0;
  const card = describeSpecCard(lead.spec);

  switch (reward.kind) {
    case 'item': {
      const entry = itemById(reward.item);
      if (!entry) return 0;
      // A type item off type is the near-dud the normal pool leans on. Pricing
      // that here is what lets the report show the gradient rather than hide it.
      if (entry.boostsType) return itemSuitsTypes(entry, card.types) ? 75 : 12;
      const base = ITEM_VALUE[entry.id] ?? 50;
      // Swapping costs whatever is already held, so an upgrade is worth the
      // difference and a sidegrade is worth very little.
      const held = lead.item ? (ITEM_VALUE[lead.item] ?? 40) : 0;
      return Math.max(5, base - held * 0.8);
    }

    case 'heal': {
      const missing = lead.maxHp > 0 ? 1 - lead.hp / lead.maxHp : 0;
      return missing * reward.fraction * 190;
    }

    case 'currency':
      // Valued at what it buys: a share of a good item at this segment's
      // prices, so a payout keeps its meaning as the scale climbs.
      return (reward.amount / priceAt(130, segment)) * 85;

    case 'tm':
    case 'tutor': {
      const incoming = DAMAGING_MOVES.find((move) => move.name === reward.move)?.basePower ?? 0;
      const attacks = card.moves.filter((move) => move.category !== 'Status');
      const weakest = attacks.length > 0 ? Math.min(...attacks.map((move) => move.basePower)) : 0;
      const strongest = attacks.length > 0 ? Math.max(...attacks.map((move) => move.basePower)) : 0;
      /*
       * Scored against the *best* move, not the worst.
       *
       * The first version of this valued a move at `incoming - weakest`, which
       * is what `teachMove` replaces — and it was wrong about what the reward
       * does. The greedy battle AI picks its highest-damage option every turn,
       * so a taught move only changes a fight if it beats what was already
       * being used; beating the worst slot merely retires a move nobody picked.
       * The bot took move rewards 3% of the time under the old model and the
       * report read that as "nobody wants a TM", which was a fact about the
       * scorer rather than about the pools.
       *
       * The small `weakest` term is the coverage half: a move that does not
       * out-damage your best still widens what you can hit for super effective,
       * which the greedy AI does exploit.
       */
      return Math.max(0, incoming - strongest) * 1.5 + Math.max(0, incoming - weakest) * 0.35;
    }

    case 'species':
      // Gated off, so unreachable. Zero rather than a guess: a number here would
      // be an untested opinion about a mechanic nobody has played yet.
      return 0;
  }
}

/**
 * What an event option is worth.
 *
 * **Scored, never executed.** This function is the thing `core/events.ts` gave
 * up callbacks for: a policy that had to run an arbitrary function to find out
 * what a button does could not compare two buttons, and every event number in
 * the report would be a measurement of a coin toss.
 */
function valueOfOutcome(outcome: EventOutcome, state: RunState, segment: number): number {
  const lead = state.party[0];
  if (!lead) return 0;

  switch (outcome.kind) {
    case 'nothing':
      return 0;
    case 'currency':
      return (outcome.amount / priceAt(130, segment)) * 85;
    case 'heal': {
      const missing = lead.maxHp > 0 ? 1 - lead.hp / lead.maxHp : 0;
      return missing * outcome.percent * 190;
    }
    case 'damage': {
      // Damage hurts more the less you have. Losing 20% at 30% HP can end a
      // run; at full HP the next rest undoes it.
      const share = lead.maxHp > 0 ? lead.hp / lead.maxHp : 1;
      return -outcome.percent * 200 * (1.4 - share);
    }
    case 'item':
      return valueOfReward({ kind: 'item', item: outcome.item }, state, segment);
  }
}

// ---------------------------------------------------------------------------
// Building one
// ---------------------------------------------------------------------------

/** What one run reported about itself, filled in by its policy as it played. */
interface RunCollector {
  rewards: { kind: Reward['kind']; segment: number; gym: boolean }[];
  shopVisits: { segment: number; balance: number; spent: number }[];
  itemsAcquired: string[];
  /** How many Pokemon this run was offered, taken, and released for. */
  acquisitionsOffered: number;
  acquisitionsTaken: number;
  releases: number;
}

function newCollector(): RunCollector {
  return {
    rewards: [],
    shopVisits: [],
    itemsAcquired: [],
    acquisitionsOffered: 0,
    acquisitionsTaken: 0,
    releases: 0,
  };
}

/**
 * How good a party member looks, before context.
 *
 * Max HP times the best attack it has, which is the cheapest number that moves
 * with both halves of what a Pokemon is for. Taste, not measurement — and it
 * only ever decides *which* member a full party releases, so a bad guess here
 * shows up in the report as churn rather than as a hidden difficulty change.
 */
function memberValue(card: ReturnType<typeof describeSpecCard>): number {
  const power = Math.max(0, ...card.moves.map((move) => (move.category === 'Status' ? 0 : move.basePower)));
  return card.maxHp * Math.max(20, power);
}

/**
 * What a targeted card is worth on a particular member.
 *
 * The only real rule is the type match, which is the one targeting decision
 * with an obviously right answer; past that it prefers a member holding
 * nothing, since swapping destroys what was there.
 */
/**
 * Index of the highest-scoring option. Ties to the lower index, always.
 *
 * Module scope rather than a closure inside `buildPolicy`, where it used to
 * live. The move heuristics below are module-level functions and reached it
 * through the temporal dead zone — which typechecks, because `scripts/` was
 * outside the `tsconfig.json` include list, and fails at the first move card.
 * Both halves of that are fixed: this is hoisted, and the include list now
 * covers this file.
 */
function bestBy<T>(items: readonly T[], score: (item: T) => number): number {
  let best = 0;
  let bestScore = -Infinity;
  for (const [index, item] of items.entries()) {
    const value = score(item);
    if (value > bestScore) {
      bestScore = value;
      best = index;
    }
  }
  return best;
}

/**
 * Who learns a taught move. **Deterministic, documented, and it will appear in
 * every balance report from here on.**
 *
 * Scored per member, highest wins, ties to the earlier slot (`bestBy`):
 *
 *   1. A fainted member scores -100 and is never chosen. It would be redirected
 *      to the lead anyway (`rewards.recipientFor`), and a policy that let that
 *      happen would be choosing a Pokemon it did not mean to.
 *   2. **+60 if the move's type matches one of the member's own** — the spec's
 *      suggested rule, and the one real piece of judgement in here: STAB is the
 *      largest single multiplier a move reward can buy.
 *   3. **+40 if the member has a free move slot**, because that member pays
 *      nothing for the move while everyone else gives one up.
 *   4. Otherwise, whoever gains most, which is whoever has the weakest
 *      best-attack — the same reasoning `valueOfReward` uses to price the card
 *      in the first place, so the bot's valuation and its placement agree.
 *
 * It is not clever, and rule 4 in particular is a proxy rather than an analysis.
 * It needs to be deterministic and written down, because a heuristic that
 * changes between reports makes two reports incomparable.
 */
function greedyMoveRecipient(offer: MoveReward, party: readonly PokemonState[]): number {
  const incoming = describeMove(offer.move);
  return bestBy(party, (member) => {
    if (member.fainted) return -100;
    const card = describeSpecCard(member.spec);

    let score = 0;
    if (incoming && card.types.includes(incoming.type)) score += 60;
    if (member.spec.moves.length < MOVESET.slots) score += 40;

    const attacks = card.moves.filter((move) => move.category !== 'Status');
    const strongest = attacks.length > 0 ? Math.max(...attacks.map((move) => move.basePower)) : 0;
    return score + (100 - strongest) / 100;
  });
}

/**
 * What the move costs them. **Deterministic, documented, same reason.**
 *
 *   1. The damaging move with the lowest base power, ties to the *later* slot.
 *   2. If the member holds more than one status move, the first of them —
 *      the spec's suggested rule. One status move is often the member's only
 *      answer to something; two means one is spare.
 *   3. Otherwise slot 0, which is unreachable for a member with four moves.
 *
 * Note what it does **not** consider: whether the incoming move is better than
 * the one being dropped. There is no decline, so the bot always gives something
 * up, and a run can be made worse by a card it took. That is the shape Stage
 * 4.5.1 intends, and the report is expected to show it — see `party.teachMove`.
 */
function greedyMoveToReplace(member: PokemonState, incoming: MoveSpec): number {
  void incoming;
  const known = member.spec.moves.map((name) => describeMove(name));
  const statusSlots = known.flatMap((move, index) => (!move || move.category === 'Status' ? [index] : []));
  if (statusSlots.length > 1) return statusSlots[0]!;

  let weakestSlot: number | null = null;
  let weakest = Number.POSITIVE_INFINITY;
  known.forEach((move, index) => {
    if (!move || move.category === 'Status') return;
    if (move.basePower <= weakest) {
      weakest = move.basePower;
      weakestSlot = index;
    }
  });

  return weakestSlot ?? statusSlots[0] ?? 0;
}

/**
 * What one item is worth to one party member. **The item half of the old
 * `valueOfTarget`**, split out when items stopped being a targeted reward and
 * became a backpack the bot re-plans at every node boundary.
 *
 * Same shallow scoring it always was: a type item is worth a lot to a member of
 * that type and nothing to anyone else, and everything else is worth having.
 * The one change is that "is this member already holding something" is no
 * longer part of the score, because the planner below reasons about the whole
 * allocation at once and does not need a tie-breaker standing in for one.
 */
function valueOfItemFor(itemId: string, member: PokemonState): number {
  if (member.fainted) return -100;
  const entry = itemById(itemId);
  if (!entry) return 0;
  const card = describeSpecCard(member.spec);
  if (entry.boostsType) return itemSuitsTypes(entry, card.types) ? 100 : 0;
  return 50;
}

/**
 * The greedy item plan. **Deterministic, documented, and it will appear in
 * every balance report from here on.**
 *
 * Four rules, in order:
 *
 *   1. The pool is the backpack *plus everything currently held*. The bot
 *      re-plans the whole allocation at each boundary rather than only placing
 *      what is loose, because reassignment is free and a policy that never
 *      revisits a placement would measure the game's first guess rather than
 *      its best one.
 *   2. Score every (slot, item) pair with `valueOfItemFor`. Take the highest
 *      scoring pair, commit it, remove both the slot and that item, repeat.
 *      Pairs scoring zero or less are never committed — a Charcoal on a Lapras
 *      is left in the bag rather than worn as decoration.
 *   3. Ties break on slot index first, then on the item's position in the pool.
 *      Both are stable orderings the seed reconstructs, which is what makes the
 *      plan replayable rather than merely repeatable.
 *   4. Whatever is left over stays in the backpack, and if that is still over
 *      capacity the lowest-scoring items are discarded — scored against the
 *      *best* member for each, so the thing thrown away is the thing that would
 *      have helped least whoever it ended up on.
 *
 * It is not clever. It needs to be deterministic and written down, because a
 * heuristic that changes between reports makes two reports incomparable.
 */
function greedyItemPlan(state: RunState): ItemPlan {
  const pool = [...state.backpack, ...state.party.flatMap((member) => (member.item ? [member.item] : []))];
  const openSlots = state.party.map((_, slot) => slot);
  const assignments: ItemAssignment[] = [];
  const remaining = [...pool];

  for (;;) {
    let best: { slot: number; item: string; index: number; score: number } | null = null;
    for (const slot of openSlots) {
      remaining.forEach((item, index) => {
        const score = valueOfItemFor(item, state.party[slot]!);
        if (score <= 0) return;
        // Strictly greater, so the first pair found at a given score wins — and
        // the iteration order is slot then pool position, which is rule 3.
        if (!best || score > best.score) best = { slot, item, index, score };
      });
    }
    if (!best) break;
    const pick: { slot: number; item: string; index: number; score: number } = best;
    assignments.push({ slot: pick.slot, item: pick.item });
    openSlots.splice(openSlots.indexOf(pick.slot), 1);
    remaining.splice(pick.index, 1);
  }

  // Every slot that won nothing is explicitly emptied, or an item the plan
  // decided not to place would stay on the Pokemon that happened to hold it.
  for (const slot of openSlots) {
    if (state.party[slot]?.item !== undefined) assignments.push({ slot, item: null });
  }

  const capacity = Math.max(0, Math.floor(state.tuning.backpackCapacity));
  const overflow = Math.max(0, remaining.length - capacity);
  if (overflow === 0) return { assignments, discards: [] };

  const ranked = remaining
    .map((item, index) => ({
      item,
      index,
      score: Math.max(...state.party.map((member) => valueOfItemFor(item, member)), 0),
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index);

  return { assignments, discards: ranked.slice(0, overflow).map((entry) => entry.item) };
}

function buildPolicy(
  policy: PolicyName,
  nodes: NodePolicyName,
  seed: string,
  collect: RunCollector,
): RunPolicy {
  const stream = createRng(seed).policy;
  const randomBattle = policy === 'random';
  /*
   * The battle AI this policy plays with.
   *
   * `no-switch` wraps the *same* greedy AI rather than substituting a different
   * one, which is what makes the pair a controlled comparison: two hand-written
   * bots would differ in a dozen small ways nobody chose, and the gap in
   * completion rate would measure those instead of switching.
   */
  const battlePolicy: Policy = randomBattle
    ? randomMovePolicy(stream)
    : policy === 'no-switch'
      ? withoutSwitching(greedyAiPolicy)
      : greedyAiPolicy;

  return {
    chooseStarter: async (options) =>
      randomBattle ? stream.nextInt(Math.max(1, options.length)) : bestStarter(options),

    /*
     * The locale, drawn from the policy stream for a random bot and taken as
     * offered otherwise.
     *
     * A placeholder until the locale metrics land: what a *greedy* locale
     * policy should be — cover the types the party cannot hit, or feed the next
     * gym — is a question the report has to answer before a bot encodes an
     * answer to it. Taking the first offer is the honest floor in the meantime,
     * and the random bot's pick distribution is what says whether every locale
     * is reachable at all.
     */
    chooseLocale: async (options) => (randomBattle ? stream.nextInt(Math.max(1, options.length)) : 0),

    chooseNode: chooseNodeBy(nodes, stream),

    chooseReward: async (offer, state) => {
      const segment = state.currentSegment;
      const best = bestBy(offer.options, (option) => valueOfReward(option, state, segment));
      const chosen = offer.options[best];
      if (chosen) {
        /*
         * Gym offers are tagged so the report can break them out, and the tag
         * comes off the node id rather than off a flag on the offer.
         *
         * `RewardOffer` deliberately has no "is this a gym" field: it is the one
         * shape every screen and policy reads, and adding a discriminator would
         * invite a policy to *treat* a gym card differently — which would make
         * the take rate measure the bot's special case instead of the pool.
         * The id is already `s<segment>-gym` by construction (`generateSegment`)
         * and is the same string the offer carries for exactly this kind of
         * tying-together.
         */
        collect.rewards.push({ kind: chosen.kind, segment, gym: offer.nodeId.endsWith('-gym') });
        if (chosen.kind === 'item') collect.itemsAcquired.push(chosen.item);
      }
      return best;
    },

    chooseShopPurchases: async (stock, state) => {
      const segment = state.currentSegment;
      const visit = { segment, balance: state.currency, spent: 0 };
      collect.shopVisits.push(visit);

      // Best value per coin first, then whatever still fits. Not optimal — a
      // knapsack would be — but a player does not solve a knapsack either, and
      // a bot that did would report purchasing power no human has.
      const order = stock.items
        .map((item, index) => ({
          index,
          price: item.price,
          score: valueOfReward(item.reward, state, segment) / Math.max(1, item.price),
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index);

      const basket: number[] = [];
      let left = state.currency;
      for (const entry of order) {
        const item = stock.items[entry.index];
        if (!item || entry.price > left || entry.score <= 0) continue;
        basket.push(entry.index);
        left -= entry.price;
        visit.spent += entry.price;
        if (item.reward.kind === 'item') collect.itemsAcquired.push(item.reward.item);
      }
      return basket;
    },

    chooseEventOption: async (event, state) => {
      const segment = state.currentSegment;
      const best = bestBy(event.choices, (choice) => valueOfOutcome(choice.outcome, state, segment));
      const outcome = event.choices[best]?.outcome;
      if (outcome?.kind === 'item') collect.itemsAcquired.push(outcome.item);
      return best;
    },

    /*
     * Who holds the item, scored the way a player would guess.
     *
     * Deliberately shallow, like every other valuation in this file: it puts a
     * type item on a member of that type, and everything else on whoever is
     * holding least. It has no plan and does not know which member will do the
     * fighting. That is the floor on competent play, which is what a balance
     * measurement wants — a targeting rule that only works when played
     * perfectly is a rule the report cannot generalise from.
     */
    chooseMoveRecipient: async (offer, party) => greedyMoveRecipient(offer, party),
    chooseMoveToReplace: async (member, incoming) => greedyMoveToReplace(member, incoming),

    chooseItemPlan: async (state) => greedyItemPlan(state),

    /*
     * Take a Pokemon while there is room; once full, take it only if it beats
     * the worst member the party has.
     *
     * The second half is the whole reason acquisition is a decision. A bot that
     * always accepted would churn its team on every offer and the release
     * counts would measure the bot; one that always declined once full would
     * report a party that fills at segment 1 and never changes again, and the
     * "did the player ever fill the party" metric would be a constant.
     */
    chooseAcquisition: async (offer, party) => {
      collect.acquisitionsOffered++;
      if (hasRoom(party)) {
        collect.acquisitionsTaken++;
        return { kind: 'accept' };
      }

      const incoming = memberValue(describeSpecCard(offer.spec));
      const worst = bestBy(party, (member) => -memberValue(describeSpecCard(member.spec)));
      const outgoing = party[worst];
      if (!outgoing || memberValue(describeSpecCard(outgoing.spec)) >= incoming) {
        return { kind: 'decline' };
      }
      collect.acquisitionsTaken++;
      collect.releases++;
      return { kind: 'release', slot: worst };
    },

    battle: battlePolicy,
  };
}

// ---------------------------------------------------------------------------
// Playing the sample
// ---------------------------------------------------------------------------

interface Encounter {
  species: string;
  ability: string;
}

interface RunRecord {
  seed: string;
  outcome: 'victory' | 'defeat';
  gymsCleared: number;
  /** The 1-based gym this run actually fought last, or 0 if it never got there. */
  deepestGymFought: number;
  nodes: number;
  totalTurns: number;
  /** Turns spent in each battle, tagged with the segment it happened in. */
  battles: { segment: number; kind: NodeSpec['kind']; turns: number }[];
  /** Every opposing Pokemon actually fought. Diversity is measured on these. */
  encounters: Encounter[];
  death: CauseOfDeath | null;
  starter: string;
  /** Which reward kinds this run took, in order. */
  rewards: { kind: Reward['kind']; segment: number; gym: boolean }[];
  /** Balance and spend at each shop visited. Drives the currency curve. */
  shopVisits: { segment: number; balance: number; spent: number }[];
  /** Every item this run acquired by any route. Item impact is measured on these. */
  itemsAcquired: string[];
  /** Coins held when the run ended. */
  currency: number;

  // --- Stage 4 ------------------------------------------------------------
  /**
   * Voluntary switches, per side, across the whole run.
   *
   * Counted separately because they answer different questions. The player's
   * rate says whether switching is a decision worth making; the AI's says
   * whether the scoring function weights switches at all — a rate of zero
   * there means the term is not wired in, and no amount of tuning the switch
   * *cost* would ever show up.
   *
   * Forced switches are excluded on both sides. They are not decisions.
   */
  playerSwitches: number;
  aiSwitches: number;
  /** Battles fought, so the two above can be reported per battle. */
  battleCount: number;
  /**
   * The player's voluntary switches in each battle, in order.
   *
   * Kept per battle rather than only as a total because the two questions the
   * spec asks are different: "median switches per battle" wants the
   * distribution, and a mean hides the shape completely — a bot that switches
   * four times in one fight and never again has the same mean as one that
   * switches once in four fights, and only one of those is a game.
   */
  switchesPerBattle: number[];
  /**
   * Party size at the start of each battle, tagged with its segment.
   *
   * **The number that says whether the difficulty curve is aimed at the right
   * target.** `scaling.opponentTeamSize` sizes every opponent against how big
   * the player's party is *expected* to be at that point in the run, and an
   * expectation nothing measures is a guess. This is the measurement.
   */
  partyBySegment: { segment: number; size: number }[];
  /** Offers seen, taken, and members released to make room. */
  acquisitionsOffered: number;
  acquisitionsTaken: number;
  releases: number;
  /** Whether the party ever reached PARTY_SIZE. Splits the completion rate. */
  everFilled: boolean;
  /** Party size when the last battle of the run began. */
  partyAtEnd: number;
  /**
   * Members still standing when the battle that ended the run began.
   *
   * **The number that decides whether party size is the binding constraint.**
   * Losses at a full healthy bench mean the run was lost to a single wall and
   * a fourth slot buys nothing; losses at zero or one alive with the bench
   * chewed through are a depth signal worth testing 4 against.
   */
  aliveAtLastBattle: number;
  /** Distinct types across the final party. A party of three sharing a weakness. */
  typeCoverage: number;
}

async function playSample(
  policy: PolicyName,
  nodes: NodePolicyName,
  options: Options,
  onProgress: (done: number) => void,
): Promise<RunRecord[]> {
  const records: RunRecord[] = [];

  for (let index = 0; index < options.seeds; index++) {
    const seed = `${options.prefix}-${index}`;
    const collect = newCollector();

    /*
     * Switch counts come off the live battle sessions, not off the run log.
     *
     * The log records the *player's* choices only — the opponent is a
     * deterministic policy over a view it is handed, so recording its answers
     * would be recording the engine's output as though it were input. The
     * session holds both sides' decisions, which is exactly what a report
     * comparing player and AI switch rates needs.
     */
    const sessions: BattleSession[] = [];
    // Party state at the start of each battle, so a defeat can be read back to
    // the party that walked into it. After the fight everyone is fainted, which
    // is what a wipe *is* and therefore measures nothing.
    let aliveAtLastBattle = 0;
    let partyAtEnd = 0;
    let everFilled = false;
    const partyBySegment: { segment: number; size: number }[] = [];

    const run = await playRun(seed, buildPolicy(policy, nodes, seed, collect), options.tuning, {
      onBattle: (session, _node, before) => {
        sessions.push(session);
        aliveAtLastBattle = before.party.filter((member) => !member.fainted).length;
        partyAtEnd = before.party.length;
        partyBySegment.push({ segment: before.currentSegment, size: before.party.length });
      },
      onState: (state) => {
        if (state.party.length >= PARTY_SIZE) everFilled = true;
      },
    });
    const { state } = run;

    /*
     * Voluntary switches only — the session counts them as it plays.
     *
     * A forced switch is not a decision, and counting it would turn the metric
     * into a measure of how often things fainted. Whether a switch was forced
     * is a fact about the request at the moment it was submitted, which is gone
     * by the time the log is read, so the driver records the count rather than
     * this file reconstructing it.
     */
    let playerSwitches = 0;
    let aiSwitches = 0;
    const switchesPerBattle: number[] = [];
    for (const session of sessions) {
      playerSwitches += session.voluntarySwitches.p1;
      aiSwitches += session.voluntarySwitches.p2;
      switchesPerBattle.push(session.voluntarySwitches.p1);
    }

    const battles = state.history
      .filter((visit) => visit.result)
      .map((visit) => ({ segment: visit.segment, kind: visit.node.kind, turns: visit.result?.turns ?? 0 }));

    const encounters = state.history.flatMap((visit) =>
      (visit.node.encounter?.team ?? []).map((member) => ({
        species: member.species,
        ability: member.ability,
      })),
    );

    const gymFights = state.history.filter((visit) => visit.node.kind === 'gym');

    records.push({
      seed,
      outcome: run.outcome,
      gymsCleared: gymsCleared(state),
      deepestGymFought: gymFights.length === 0 ? 0 : (gymFights[gymFights.length - 1]?.segment ?? 0) + 1,
      nodes: state.history.length,
      totalTurns: battles.reduce((total, battle) => total + battle.turns, 0),
      battles,
      encounters,
      death: causeOfDeath(state),
      starter: state.party[0]?.spec.species ?? '',
      rewards: collect.rewards,
      shopVisits: collect.shopVisits,
      itemsAcquired: [...new Set(collect.itemsAcquired)],
      currency: state.currency,
      playerSwitches,
      aiSwitches,
      battleCount: battles.length,
      switchesPerBattle,
      partyBySegment,
      acquisitionsOffered: collect.acquisitionsOffered,
      acquisitionsTaken: collect.acquisitionsTaken,
      releases: collect.releases,
      everFilled,
      partyAtEnd,
      aliveAtLastBattle,
      typeCoverage: new Set(state.party.flatMap((member) => describeSpecCard(member.spec).types)).size,
    });
    onProgress(index + 1);
  }
  return records;
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

interface GymRow {
  gym: number;
  leader: string;
  type: string;
  teamSize: number;
  reached: number;
  cleared: number;
  clearRate: number;
  /** Percentage points this gym's clear rate sits below the previous gym's. */
  dropFromPrevious: number;
}

interface Tally {
  label: string;
  count: number;
  share: number;
}

interface Sample {
  policy: PolicyName;
  nodes: NodePolicyName;
  runs: number;
  completionRate: number;
  meanGymsCleared: number;
  perGym: GymRow[];
  turnsBySegment: { segment: number; battles: number; meanTurns: number }[];
  deaths: {
    byGym: Tally[];
    bySpecies: Tally[];
    byMove: Tally[];
    indirect: Tally[];
  };
  outliers: {
    fastestWin: { seed: string; turns: number; nodes: number } | null;
    earliestLoss: { seed: string; gymsCleared: number; nodes: number; death: CauseOfDeath | null } | null;
  };
  /**
   * Which reward kinds the policy picked, and how runs that picked each fared.
   *
   * The conditional win rate is **correlational**, not causal: a run that took
   * a Leftovers is also a run that got far enough to be offered one. Sample
   * sizes are printed next to every figure for exactly that reason.
   */
  rewards: {
    taken: Tally[];
    /**
     * What a gym clear paid, separately from every other node. Stage 4.5.2.
     *
     * Broken out rather than folded in because the gym pool is the only one
     * that is *not* keyed by tier, and because the question a tuning pass has
     * about it is specific: does one entry dominate? A gym offers three cards
     * eight times a run at most, so a kind at 60% of gym picks is a pool that
     * has collapsed to one card, and that would be invisible inside a table
     * where ordinary nodes outnumber gyms forty to one.
     */
    gym: Tally[];
    /** Gym offers the policy was actually shown — the denominator for `gym`. */
    gymOffers: number;
    /** Completion rate among runs that took this kind at least once. */
    conditional: { kind: string; runs: number; completion: number }[];
  };
  /**
   * Median currency entering each shop, by segment.
   *
   * The read-out for "always broke or always flush". Either extreme means the
   * prices in data/shop.ts are wrong rather than the player being wrong.
   */
  currency: {
    bySegment: { segment: number; visits: number; medianBalance: number; medianSpent: number }[];
    medianAtEnd: number;
    brokeShare: number;
    flushShare: number;
  };
  /** Completion with and without each item. Noisy; see `MIN_SPLIT`. */
  items: {
    item: string;
    withRuns: number;
    withCompletion: number;
    withoutRuns: number;
    withoutCompletion: number;
    /** False when either side is too small to read. */
    readable: boolean;
  }[];
  diversity: {
    encounters: number;
    distinctSpecies: number;
    topSpecies: Tally[];
    distinctAbilities: number;
    topAbilities: Tally[];
    /** Share of *runs* the single most common species appears in. */
    topSpeciesRunShare: number;
    topAbilityRunShare: number;
    distinctStarters: number;
  };
  /**
   * Stage 4's section. Everything about the party, in one place.
   *
   * Every number here answers a question the earlier stages could not even
   * ask, because at one slot the party was a Pokemon and not a party.
   */
  party: {
    /** Voluntary switches per battle, both sides. */
    playerSwitchesPerBattle: number;
    aiSwitchesPerBattle: number;
    medianPlayerSwitchesPerBattle: number;
    /** Share of battles with at least one voluntary player switch. */
    battlesWithASwitch: number;
    /** Offers, takes and releases per run. */
    offersPerRun: number;
    takenPerRun: number;
    releasesPerRun: number;
    /** Share of offers accepted. Low means the join penalty reads as too harsh. */
    takeRate: number;
    /** Share of runs whose party ever reached PARTY_SIZE, and how they fared. */
    everFilled: number;
    completionWhenFilled: number;
    completionWhenNotFilled: number;
    /** Mean party size and members alive when the run's last battle began. */
    meanPartyAtEnd: number;
    meanAliveAtLastBattle: number;
    /** How the losses distribute over "members still standing". */
    aliveAtDeath: Tally[];
    /**
     * Mean party size walking into a battle, per segment, against what the
     * difficulty curve assumed.
     *
     * The two columns have to agree or the curve is aimed at a player who does
     * not exist — which is exactly the failure the first Stage 4 baseline hit:
     * every opponent was sized for a party of three against a player carrying
     * 1.54.
     */
    sizeBySegment: { segment: number; battles: number; meanSize: number; assumed: number }[];
    /** Distinct types on the final party, and how completion splits on it. */
    meanTypeCoverage: number;
    completionByCoverage: { coverage: string; runs: number; completion: number }[];
  };
  durationMs: number;
}

/**
 * The smallest split worth reading in the item-impact table.
 *
 * The spec's number, and it is a floor rather than a threshold of significance:
 * at a thousand seeds a rare item may be held by twenty runs, and the gap
 * between 20% and 40% completion across twenty runs is four runs. Below this,
 * the row is printed with its sample size and marked unreadable, because a
 * figure with no n next to it is how a balance pass talks itself into a change.
 */
const MIN_SPLIT = 50;

/** Median of a numeric sample. Zero for an empty one. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : (sorted[middle] ?? 0);
}

function completionOf(records: RunRecord[]): number {
  return records.length === 0 ? 0 : records.filter((r) => r.outcome === 'victory').length / records.length;
}

function tally(values: string[], top: number): Tally[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([label, count]) => ({ label, count, share: values.length === 0 ? 0 : count / values.length }));
}

/** How many runs contain at least one of `label`. Narrower pools show up here. */
function runShare(records: RunRecord[], pick: (record: RunRecord) => string[], label: string): number {
  if (records.length === 0 || label === '') return 0;
  return records.filter((record) => pick(record).includes(label)).length / records.length;
}

function summarize(
  policy: PolicyName,
  nodes: NodePolicyName,
  records: RunRecord[],
  durationMs: number,
): Sample {
  const runs = records.length;

  const perGym: GymRow[] = GYMS.map((gym) => {
    const number = gym.segment + 1;
    const reached = records.filter((record) => record.deepestGymFought >= number).length;
    const cleared = records.filter((record) => record.gymsCleared >= number).length;
    return {
      gym: number,
      leader: gym.leader,
      type: gym.type,
      // Read from the curve rather than written as a literal, so the column
      // cannot drift out of agreement with what the gym actually fielded.
      teamSize: opponentTeamSize('gym', gym.segment, 'normal', gym.teamSize),
      reached,
      cleared,
      clearRate: reached === 0 ? 0 : cleared / reached,
      dropFromPrevious: 0,
    };
  });
  for (const [index, row] of perGym.entries()) {
    const previous = perGym[index - 1];
    row.dropFromPrevious = previous ? (previous.clearRate - row.clearRate) * 100 : 0;
  }

  const turnsBySegment = SEGMENTS.map((segment) => {
    const battles = records.flatMap((record) => record.battles.filter((battle) => battle.segment === segment.segment));
    return {
      segment: segment.segment,
      battles: battles.length,
      meanTurns: battles.length === 0 ? 0 : battles.reduce((total, b) => total + b.turns, 0) / battles.length,
    };
  });

  const deaths = records.map((record) => record.death).filter((death): death is CauseOfDeath => death !== null);

  const wins = records.filter((record) => record.outcome === 'victory');
  const fastestWin = wins.reduce<RunRecord | null>(
    (best, record) => (!best || record.totalTurns < best.totalTurns ? record : best),
    null,
  );
  const losses = records.filter((record) => record.outcome === 'defeat');
  const earliestLoss = losses.reduce<RunRecord | null>(
    (worst, record) =>
      !worst || record.gymsCleared < worst.gymsCleared || (record.gymsCleared === worst.gymsCleared && record.nodes < worst.nodes)
        ? record
        : worst,
    null,
  );

  const allSpecies = records.flatMap((record) => record.encounters.map((encounter) => encounter.species));
  const allAbilities = records.flatMap((record) => record.encounters.map((encounter) => encounter.ability));
  const topSpecies = tally(allSpecies, 10);
  const topAbilities = tally(allAbilities, 10);

  // --- rewards ------------------------------------------------------------
  const rewardKinds = records.flatMap((record) => record.rewards.map((reward) => reward.kind));
  const gymPicks = records.flatMap((record) =>
    record.rewards.filter((reward) => reward.gym).map((reward) => reward.kind),
  );
  const conditional = [...new Set(rewardKinds)].sort().map((kind) => {
    const took = records.filter((record) => record.rewards.some((reward) => reward.kind === kind));
    return { kind, runs: took.length, completion: completionOf(took) };
  });

  // --- currency -----------------------------------------------------------
  const currencyBySegment = SEGMENTS.map((segment) => {
    const visits = records.flatMap((record) =>
      record.shopVisits.filter((visit) => visit.segment === segment.segment),
    );
    return {
      segment: segment.segment,
      visits: visits.length,
      medianBalance: median(visits.map((visit) => visit.balance)),
      medianSpent: median(visits.map((visit) => visit.spent)),
    };
  });
  const allVisits = records.flatMap((record) => record.shopVisits);

  // --- item impact --------------------------------------------------------
  const items = ITEMS.map((entry) => {
    const withIt = records.filter((record) => record.itemsAcquired.includes(entry.id));
    const withoutIt = records.filter((record) => !record.itemsAcquired.includes(entry.id));
    return {
      item: entry.name,
      withRuns: withIt.length,
      withCompletion: completionOf(withIt),
      withoutRuns: withoutIt.length,
      withoutCompletion: completionOf(withoutIt),
      readable: withIt.length >= MIN_SPLIT && withoutIt.length >= MIN_SPLIT,
    };
  }).sort((a, b) => b.withRuns - a.withRuns);

  return {
    policy,
    nodes,
    runs,
    completionRate: runs === 0 ? 0 : wins.length / runs,
    rewards: {
      taken: tally(rewardKinds, 8),
      gym: tally(gymPicks, 8),
      gymOffers: gymPicks.length,
      conditional,
    },
    currency: {
      bySegment: currencyBySegment,
      medianAtEnd: median(records.map((record) => record.currency)),
      // "Broke" and "flush" are read at the shop door, which is the only moment
      // the number means anything: money you never had a chance to spend is not
      // the same problem as money you chose not to.
      brokeShare:
        allVisits.length === 0
          ? 0
          : allVisits.filter((visit) => visit.balance < HEALTHY_BALANCE.min).length / allVisits.length,
      flushShare:
        allVisits.length === 0
          ? 0
          : allVisits.filter((visit) => visit.balance > HEALTHY_BALANCE.max).length / allVisits.length,
    },
    items,
    meanGymsCleared: runs === 0 ? 0 : records.reduce((total, r) => total + r.gymsCleared, 0) / runs,
    perGym,
    turnsBySegment,
    deaths: {
      byGym: tally(deaths.map((death) => `gym ${death.segment + 1} (${death.leader})`), SEGMENTS_PER_RUN),
      bySpecies: tally(deaths.map((death) => death.bySpecies ?? '(indirect)'), 10),
      byMove: tally(deaths.map((death) => death.byMove ?? '(no move)'), 10),
      indirect: tally(deaths.filter((death) => !death.byMove).map((death) => death.indirect ?? '(unknown)'), 5),
    },
    outliers: {
      fastestWin: fastestWin
        ? { seed: fastestWin.seed, turns: fastestWin.totalTurns, nodes: fastestWin.nodes }
        : null,
      earliestLoss: earliestLoss
        ? {
            seed: earliestLoss.seed,
            gymsCleared: earliestLoss.gymsCleared,
            nodes: earliestLoss.nodes,
            death: earliestLoss.death,
          }
        : null,
    },
    diversity: {
      encounters: allSpecies.length,
      distinctSpecies: new Set(allSpecies).size,
      topSpecies,
      distinctAbilities: new Set(allAbilities).size,
      topAbilities,
      topSpeciesRunShare: runShare(records, (r) => r.encounters.map((e) => e.species), topSpecies[0]?.label ?? ''),
      topAbilityRunShare: runShare(records, (r) => r.encounters.map((e) => e.ability), topAbilities[0]?.label ?? ''),
      distinctStarters: new Set(records.map((record) => record.starter)).size,
    },
    party: summarizeParty(records),
    durationMs,
  };
}

/**
 * The party section of the report.
 *
 * Split out rather than inlined into `summarize` because it is the one section
 * whose numbers are read *together* — a switch rate is meaningless without the
 * party size that produced it, and "runs that filled the party" is meaningless
 * without what happened to the ones that did not.
 */
function summarizeParty(records: RunRecord[]): Sample['party'] {
  const runs = Math.max(1, records.length);
  const battles = Math.max(1, sum(records.map((record) => record.battleCount)));
  // Every battle in the sample, as one flat list of the player's voluntary
  // switches in it. The median is taken over battles, not over runs: a run
  // average would weight a three-node run the same as a forty-node one.
  const perBattle = records.flatMap((record) => record.switchesPerBattle);
  const filled = records.filter((record) => record.everFilled);
  const unfilled = records.filter((record) => !record.everFilled);
  const offers = sum(records.map((record) => record.acquisitionsOffered));

  // Grouped by members still standing when the losing battle began, which is
  // the number that says whether the party was the binding constraint.
  const losses = records.filter((record) => record.outcome === 'defeat');
  const aliveAtDeath = tally(
    losses.map((record) => `${record.aliveAtLastBattle} alive`),
    6,
  );

  const coverage = new Map<number, RunRecord[]>();
  for (const record of records) {
    coverage.set(record.typeCoverage, [...(coverage.get(record.typeCoverage) ?? []), record]);
  }

  return {
    playerSwitchesPerBattle: sum(records.map((record) => record.playerSwitches)) / battles,
    aiSwitchesPerBattle: sum(records.map((record) => record.aiSwitches)) / battles,
    medianPlayerSwitchesPerBattle: median(perBattle),
    battlesWithASwitch: perBattle.length === 0 ? 0 : perBattle.filter((count) => count > 0).length / perBattle.length,
    offersPerRun: offers / runs,
    takenPerRun: sum(records.map((record) => record.acquisitionsTaken)) / runs,
    releasesPerRun: sum(records.map((record) => record.releases)) / runs,
    takeRate: offers === 0 ? 0 : sum(records.map((record) => record.acquisitionsTaken)) / offers,
    everFilled: filled.length / runs,
    completionWhenFilled: completionOf(filled),
    completionWhenNotFilled: completionOf(unfilled),
    meanPartyAtEnd: sum(records.map((record) => record.partyAtEnd)) / runs,
    meanAliveAtLastBattle: sum(records.map((record) => record.aliveAtLastBattle)) / runs,
    aliveAtDeath,
    sizeBySegment: Array.from({ length: SEGMENTS_PER_RUN }, (_, segment) => {
      const rows = records.flatMap((record) =>
        record.partyBySegment.filter((entry) => entry.segment === segment),
      );
      return {
        segment,
        battles: rows.length,
        meanSize: rows.length === 0 ? 0 : sum(rows.map((row) => row.size)) / rows.length,
        assumed: expectedPartySize(segment),
      };
    }),
    meanTypeCoverage: sum(records.map((record) => record.typeCoverage)) / runs,
    completionByCoverage: [...coverage]
      .sort((a, b) => a[0] - b[0])
      .map(([types, group]) => ({
        coverage: `${types} types`,
        runs: group.length,
        completion: completionOf(group),
      })),
  };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

function table(head: string[], rows: string[][]): string {
  const widths = head.map((_, column) =>
    Math.max(head[column]?.length ?? 0, ...rows.map((row) => row[column]?.length ?? 0)),
  );
  const line = (cells: string[]): string =>
    cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join('  ').trimEnd();
  return [line(head), widths.map((width) => '-'.repeat(width)).join('  '), ...rows.map(line)].join('\n');
}

function render(sample: Sample): string {
  const out: string[] = [];
  const title = `policy ${sample.policy} · nodes ${sample.nodes} · ${sample.runs} seeds · ${(sample.durationMs / 1000).toFixed(1)}s`;
  out.push('', title, '='.repeat(title.length));

  out.push('', 'Clear rate per gym — of the runs that reached it');
  out.push(
    table(
      ['gym', 'leader', 'type', 'team', 'reached', 'cleared', 'clear rate', 'drop'],
      sample.perGym.map((row) => [
        String(row.gym),
        row.leader,
        row.type,
        String(row.teamSize),
        String(row.reached),
        String(row.cleared),
        pct(row.clearRate),
        row.gym === 1 ? '—' : `${row.dropFromPrevious >= 0 ? '-' : '+'}${Math.abs(row.dropFromPrevious).toFixed(0)}pt`,
      ]),
    ),
  );

  out.push(
    '',
    `Run completion: ${pct(sample.completionRate)}   ·   mean gyms cleared: ${sample.meanGymsCleared.toFixed(2)} / ${SEGMENTS_PER_RUN}`,
  );

  /*
   * The party section, printed high because at Stage 4 it is the section that
   * explains the rest. A completion rate at party size three is a fact about
   * how big the party actually got, how often it was full, and whether
   * switching was ever a decision — and reading the gym table without those
   * numbers is how a tuning pass ends up moving levels to fix an acquisition
   * rate.
   */
  const party = sample.party;
  out.push('', 'Party — switching, acquisition, and what the run was carrying');
  out.push(
    table(
      ['measure', 'value', 'reads as'],
      [
        [
          'player switches / battle',
          party.playerSwitchesPerBattle.toFixed(2),
          party.playerSwitchesPerBattle > 1
            ? 'too cheap — switching every turn'
            : party.playerSwitchesPerBattle < 0.05
              ? 'decorative — nobody switches'
              : 'in band',
        ],
        [
          'AI switches / battle',
          party.aiSwitchesPerBattle.toFixed(2),
          party.aiSwitchesPerBattle < 0.01 ? 'AI scoring ignores switches' : 'AI switches',
        ],
        ['median switches / battle', party.medianPlayerSwitchesPerBattle.toFixed(2), 'target 0 < x < ~1'],
        ['battles with a switch', pct(party.battlesWithASwitch), ''],
        ['offers / run', party.offersPerRun.toFixed(2), ''],
        [
          'offers taken',
          pct(party.takeRate),
          party.takeRate < 0.5 ? 'join penalty or release cost too harsh' : '',
        ],
        ['releases / run', party.releasesPerRun.toFixed(2), ''],
        ['mean party at last battle', party.meanPartyAtEnd.toFixed(2), `of ${PARTY_SIZE}`],
        ['mean type coverage', party.meanTypeCoverage.toFixed(2), 'distinct types on the final party'],
      ],
    ),
  );

  out.push('', 'Party size by segment — measured against what the curve assumes');
  out.push(
    table(
      ['segment', 'battles', 'mean party', 'curve assumes', 'gap'],
      party.sizeBySegment
        .filter((row) => row.battles > 0)
        .map((row) => [
          String(row.segment + 1),
          String(row.battles),
          row.meanSize.toFixed(2),
          String(row.assumed),
          (row.meanSize - row.assumed).toFixed(2),
        ]),
    ),
  );

  out.push('', 'Did the party ever fill?');
  out.push(
    table(
      ['', 'share of runs', 'completion'],
      [
        ['filled', pct(party.everFilled), pct(party.completionWhenFilled)],
        ['never filled', pct(1 - party.everFilled), pct(party.completionWhenNotFilled)],
      ],
    ),
  );

  if (party.aliveAtDeath.length > 0) {
    /*
     * **The number that decides whether a fourth slot would help.**
     *
     * Losses at a full healthy bench mean the run was lost to a single wall and
     * the party was never the binding constraint. Losses at zero or one alive,
     * with the bench chewed through, are a real depth signal.
     */
    out.push('', 'Party composition at death — members standing when the last battle began');
    out.push(
      table(
        ['alive', 'runs', 'share'],
        party.aliveAtDeath.map((row) => [row.label, String(row.count), pct(row.share)]),
      ),
    );
    out.push(`  mean alive at the losing battle: ${party.meanAliveAtLastBattle.toFixed(2)}`);
  }

  if (party.completionByCoverage.length > 1) {
    out.push('', 'Type coverage of the final party, against completion');
    out.push(
      table(
        ['coverage', 'runs', 'completion'],
        party.completionByCoverage
          .filter((row) => row.runs >= 10)
          .map((row) => [row.coverage, String(row.runs), pct(row.completion)]),
      ),
    );
  }

  out.push('', 'Turns per battle, by segment');
  out.push(
    table(
      ['segment', 'battles', 'mean turns'],
      sample.turnsBySegment.map((row) => [
        String(row.segment + 1),
        String(row.battles),
        row.meanTurns.toFixed(2),
      ]),
    ),
  );

  if (sample.deaths.byGym.length > 0) {
    out.push('', 'Cause of death — where');
    out.push(
      table(
        ['segment', 'runs', 'share'],
        sample.deaths.byGym.map((row) => [row.label, String(row.count), pct(row.share)]),
      ),
    );
    out.push('', 'Cause of death — what killed them');
    out.push(
      table(
        ['species', 'runs', 'share', '', 'move', 'runs', 'share'],
        sample.deaths.bySpecies.map((row, index) => {
          const move = sample.deaths.byMove[index];
          return [
            row.label,
            String(row.count),
            pct(row.share),
            '',
            move?.label ?? '',
            move ? String(move.count) : '',
            move ? pct(move.share) : '',
          ];
        }),
      ),
    );
  }

  out.push('', 'Outlier seeds — replay these in the browser');
  const { fastestWin, earliestLoss } = sample.outliers;
  out.push(
    fastestWin
      ? `  fastest win    ${fastestWin.seed}  (${fastestWin.turns} turns over ${fastestWin.nodes} nodes)`
      : '  fastest win    none — no run finished',
  );
  out.push(
    earliestLoss
      ? `  earliest loss  ${earliestLoss.seed}  (${earliestLoss.gymsCleared} gyms, ${earliestLoss.nodes} nodes` +
          `${earliestLoss.death ? `, to ${describeDeath(earliestLoss.death)}` : ''})`
      : '  earliest loss  none — no run was lost',
  );

  out.push('', 'Rewards — what the policy picked, and how those runs ended');
  out.push(
    table(
      ['kind', 'picks', 'share of picks', 'runs that took it', 'their completion'],
      sample.rewards.taken.map((row) => {
        const conditional = sample.rewards.conditional.find((entry) => entry.kind === row.label);
        return [
          row.label,
          String(row.count),
          pct(row.share),
          conditional ? `${conditional.runs}` : '—',
          conditional ? pct(conditional.completion) : '—',
        ];
      }),
    ),
  );
  out.push(
    '  Conditional completion is correlational: a run that took a Leftovers is also',
    '  a run that survived long enough to be offered one. Read the n, not the rate.',
  );

  out.push('', `Gym clear rewards — ${sample.rewards.gymOffers} offers taken`);
  if (sample.rewards.gym.length === 0) {
    out.push('  none — no run cleared a gym');
  } else {
    out.push(
      table(
        ['kind', 'picks', 'share of gym picks'],
        sample.rewards.gym.map((row) => [row.label, String(row.count), pct(row.share)]),
      ),
    );
    const top = sample.rewards.gym[0];
    out.push(
      top && top.share > 0.6
        ? `  ${top.label} takes ${pct(top.share)} of gym picks — the pool has collapsed to one card.`
        : '  No entry dominates. A gym offer is still a choice.',
    );
  }

  out.push('', 'Currency — median balance walking into a shop');
  out.push(
    table(
      ['segment', 'visits', 'median held', 'median spent'],
      sample.currency.bySegment.map((row) => [
        String(row.segment + 1),
        String(row.visits),
        row.medianBalance.toFixed(0),
        row.medianSpent.toFixed(0),
      ]),
    ),
  );
  out.push(
    `  median held at run end ${sample.currency.medianAtEnd.toFixed(0)}   ·   ` +
      `broke on arrival ${pct(sample.currency.brokeShare)}   ·   flush on arrival ${pct(sample.currency.flushShare)}` +
      `   (healthy band ${HEALTHY_BALANCE.min}-${HEALTHY_BALANCE.max})`,
  );

  const readable = sample.items.filter((row) => row.readable);
  const thin = sample.items.filter((row) => !row.readable && row.withRuns > 0);
  out.push('', `Item impact — completion with and without (n >= ${MIN_SPLIT} on both sides)`);
  out.push(
    readable.length === 0
      ? `  nothing reached ${MIN_SPLIT} runs on both sides at this sample size; raise --seeds`
      : table(
          ['item', 'held by', 'completion', 'not held by', 'completion', 'delta'],
          readable.map((row) => [
            row.item,
            String(row.withRuns),
            pct(row.withCompletion),
            String(row.withoutRuns),
            pct(row.withoutCompletion),
            `${row.withCompletion >= row.withoutCompletion ? '+' : ''}${((row.withCompletion - row.withoutCompletion) * 100).toFixed(1)}pt`,
          ]),
        ),
  );
  if (thin.length > 0) {
    out.push(
      `  too thin to read: ${thin
        .slice(0, 8)
        .map((row) => `${row.item} (n=${row.withRuns})`)
        .join(', ')}`,
    );
  }

  out.push('', 'Diversity — the number win rate cannot measure');
  out.push(
    `  ${sample.diversity.distinctSpecies} distinct species and ${sample.diversity.distinctAbilities} distinct abilities across ` +
      `${sample.diversity.encounters} encounters; ${sample.diversity.distinctStarters} distinct starters chosen`,
  );
  out.push(
    table(
      ['top species', 'seen', 'of all', 'in runs', '', 'top ability', 'seen', 'of all'],
      sample.diversity.topSpecies.map((row, index) => {
        const ability = sample.diversity.topAbilities[index];
        return [
          row.label,
          String(row.count),
          pct(row.share),
          index === 0 ? pct(sample.diversity.topSpeciesRunShare) : '',
          '',
          ability?.label ?? '',
          ability ? String(ability.count) : '',
          ability ? pct(ability.share) : '',
        ];
      }),
    ),
  );
  out.push(...verdicts(sample));
  return out.join('\n');
}

function describeDeath(death: CauseOfDeath): string {
  const killer = death.bySpecies ?? death.indirect ?? 'something';
  return death.byMove ? `${killer}'s ${death.byMove}` : killer;
}

/**
 * The report reading itself against the Stage 2 targets.
 *
 * These are the spec's starting hypotheses, not truths, and the line says so.
 * Printing them is what turns a wall of numbers into a decision — a reader who
 * has to remember four thresholds to interpret a table will not.
 */
function verdicts(sample: Sample): string[] {
  const lines: string[] = ['', 'Against the Stage 2 targets (starting hypotheses, not truths)'];
  const gym1 = sample.perGym[0];
  const worst = sample.perGym.reduce((a, b) => (b.dropFromPrevious > a.dropFromPrevious ? b : a));

  const check = (ok: boolean, text: string): string => `  ${ok ? 'ok  ' : 'MISS'}  ${text}`;

  /*
   * Which targets apply is a property of the *policy*, not of "is it greedy".
   *
   * This used to be a two-branch if, so every sample that was not `greedy` was
   * checked against the random policy's targets — including `switch-aware` and
   * `no-switch`, which are competent bots. `npm run sim -- --policy switching`
   * is the headline command of two stages now, and it was printing three MISS
   * lines saying a random policy clears gym 6 in 23.6% of runs when no random
   * policy had been run at all. A report that cries wolf on its own headline is
   * worse than one with no checklist.
   *
   * Competent policies take the completion band; `random` takes the depth
   * tests; the gym-1 target is `greedy`'s alone, because it was written against
   * that bot.
   */
  const COMPETENT: readonly string[] = ['greedy', 'switch-aware', 'no-switch', 'tier-averse', 'tier-greedy'];
  const competent = COMPETENT.includes(sample.policy);

  if (competent) {
    if (sample.policy === 'greedy') {
      lines.push(check(!!gym1 && gym1.clearRate >= 0.85 && gym1.clearRate <= 0.95, `gym 1 clear rate ${pct(gym1?.clearRate ?? 0)} (target ~90%)`));
    }
    lines.push(check(sample.completionRate >= 0.05 && sample.completionRate <= 0.15, `full run completion ${pct(sample.completionRate)} (target 5-15%)`));
  } else if (sample.policy === 'random') {
    // Two lines, because the spec's sentence about the random policy is really
    // two claims and only the second one is a depth test. "Rarely gets past gym
    // 3" is about how forgiving the early game is; "if a random policy clears
    // gym 6, the game has no depth" is about whether move choice matters at
    // all, and that is the one worth failing a build over.
    const past3 = (sample.perGym[2]?.cleared ?? 0) / Math.max(1, sample.runs);
    const clearedSix = (sample.perGym[5]?.cleared ?? 0) / Math.max(1, sample.runs);
    lines.push(check(past3 <= 0.25, `random gets past gym 3 in ${pct(past3)} of runs (target: rarely)`));
    lines.push(check(clearedSix <= 0.02, `random clears gym 6 in ${pct(clearedSix)} of runs — the depth test (target: ~never)`));
    lines.push(check(sample.completionRate <= 0.01, `random completes a run in ${pct(sample.completionRate)} (target: ~never)`));
  }
  /*
   * The curve and economy targets describe the game *a competent player*
   * meets, so they are only checked against a competent policy.
   *
   * The mirror image of the bug above, and it showed up the moment a real
   * `random` sample was run: the bot reaches gym 8 in three runs out of a
   * thousand, goes 0 for 3, and the checklist reports a 57-point drop as a
   * balance failure. It is a sample size of three. Likewise "items are 51.8% of
   * picks" from a bot picking uniformly at random says nothing about whether
   * the reward mix is right, and "broke on arrival 37.2%" measures a bot that
   * never won a fight rather than an economy that is too tight.
   *
   * Species diversity is the exception and stays on for every policy: it is a
   * property of the *randomizer*, not of play, and a random bot is as good a
   * sampler of it as any.
   */
  if (competent) {
    lines.push(check(worst.dropFromPrevious <= 25, `steepest drop ${worst.dropFromPrevious.toFixed(0)}pt at gym ${worst.gym} (${worst.leader}) (target <=25pt)`));

    // Stage 3's own targets, which are about the *choice* rather than the curve.
    const topKind = sample.rewards.taken[0];
    if (topKind) {
      lines.push(
        check(
          topKind.share <= 0.5,
          `most-picked reward kind (${topKind.label}) is ${pct(topKind.share)} of picks (target <=50%)`,
        ),
      );
    }
    lines.push(
      check(
        sample.currency.brokeShare <= 0.35 && sample.currency.flushShare <= 0.35,
        `arriving at a shop broke ${pct(sample.currency.brokeShare)} / flush ${pct(sample.currency.flushShare)} (target <=35% each)`,
      ),
    );
  }
  lines.push(
    check(
      sample.diversity.topSpeciesRunShare <= 0.25,
      `most common species (${sample.diversity.topSpecies[0]?.label ?? '—'}) appears in ${pct(sample.diversity.topSpeciesRunShare)} of runs (target <=25%)`,
    ),
  );
  return lines;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const options = parseArgs(process.argv.slice(2));
const samples: Sample[] = [];
const startedAt = new Date();

for (const nodes of options.nodePolicies) {
  for (const policy of options.policies) {
    // A tier policy *is* a node policy, so it overrides whatever `--nodes` says
    // rather than being crossed with it. `--policy tier-greedy --nodes rest`
    // would otherwise silently measure a rest-seeking bot.
    const effectiveNodes = NODE_POLICY_FOR[policy] ?? nodes;
    const label = `${policy}/${effectiveNodes}`;
    const started = Date.now();
    const records = await playSample(policy, effectiveNodes, options, (done) => {
      if (options.quiet || done % 50 !== 0) return;
      process.stderr.write(`\r  ${label}: ${done}/${options.seeds}   `);
    });
    if (!options.quiet) process.stderr.write(`\r  ${label}: ${options.seeds}/${options.seeds}   \n`);
    samples.push(summarize(policy, effectiveNodes, records, Date.now() - started));
  }
}

const report = {
  generatedAt: startedAt.toISOString(),
  // Stamped so a report can be matched to the data that produced it. A balance
  // report whose randomizer version you cannot recover is a screenshot.
  randomizerVersion: RANDOMIZER_VERSION,
  runLogVersion: RUN_LOG_VERSION,
  engineVersion: ENGINE_VERSION,
  /*
   * The AI's behaviour version, next to the data version and not folded into
   * it.
   *
   * An AI change shifts win rates as much as a pool edit does, and two reports
   * a week apart showing a six-point gap are unattributable without both
   * stamps. This is the one that says the bot changed.
   */
  aiVersion: AI_VERSION,
  partySize: PARTY_SIZE,
  segments: SEGMENTS_PER_RUN,
  seedPrefix: options.prefix,
  seeds: options.seeds,
  tuning: options.tuning,
  scaling: SEGMENTS,
  samples,
};

mkdirSync(options.outDir, { recursive: true });
const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
const file = join(options.outDir, `${stamp}-${RANDOMIZER_VERSION}-${options.seeds}.json`);
writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);

if (!options.quiet) {
  for (const sample of samples) console.log(render(sample));
  if (samples.length > 1) {
    console.log('\nSide by side');
    console.log(comparison(samples));
  }
  const riskGradient = renderRiskGradient(samples);
  if (riskGradient) console.log(riskGradient);
}
console.log(`\nreport written to ${file}`);

/**
 * The Stage 3 headline: does taking risk pay?
 *
 * Printed only when both tier policies are in the run, because it is the one
 * section no single sample can produce and the one the whole stage is judged
 * on. The spec's four hypotheses are checked here rather than in `verdicts`,
 * which reads one sample at a time and structurally cannot see a comparison.
 */
function renderRiskGradient(all: Sample[]): string | null {
  const averse = all.find((sample) => sample.policy === 'tier-averse');
  const greedy = all.find((sample) => sample.policy === 'tier-greedy');
  if (!averse || !greedy) return null;

  const out: string[] = ['', 'The risk gradient — the Stage 3 question', '='.repeat(39), ''];
  out.push(
    table(
      ['policy', 'completion', 'mean gyms', 'died before gym 2', 'full clears', 'median coins at end'],
      [averse, greedy].map((sample) => {
        const reachedTwo = sample.perGym[1]?.reached ?? 0;
        return [
          sample.policy,
          pct(sample.completionRate),
          sample.meanGymsCleared.toFixed(2),
          pct(1 - reachedTwo / Math.max(1, sample.runs)),
          String(Math.round(sample.completionRate * sample.runs)),
          sample.currency.medianAtEnd.toFixed(0),
        ];
      }),
    ),
  );

  const check = (ok: boolean, text: string): string => `  ${ok ? 'ok  ' : 'MISS'}  ${text}`;
  const ratio = averse.completionRate === 0 ? Infinity : greedy.completionRate / averse.completionRate;
  const earlyDeath = (sample: Sample): number => 1 - (sample.perGym[1]?.reached ?? 0) / Math.max(1, sample.runs);

  out.push('', 'Against the Stage 3 hypotheses (starting hypotheses, not truths)');
  out.push(
    check(
      greedy.completionRate > averse.completionRate,
      `tier-greedy completes ${pct(greedy.completionRate)} vs tier-averse ${pct(averse.completionRate)} ` +
        '(target: greedy ahead by a visible margin)',
    ),
  );
  out.push(
    check(
      earlyDeath(greedy) > earlyDeath(averse) && greedy.completionRate > averse.completionRate,
      `greedy dies before gym 2 in ${pct(earlyDeath(greedy))} vs ${pct(earlyDeath(averse))}, and still clears more ` +
        '(target: more early deaths AND more full clears — risk should mean risk)',
    ),
  );
  out.push(
    check(
      ratio <= 3,
      `greedy wins ${ratio === Infinity ? 'infinitely' : `${ratio.toFixed(1)}x`} as often ` +
        '(target <=3x — beyond that, check the encounter side before the rewards)',
    ),
  );
  if (greedy.completionRate <= averse.completionRate) {
    out.push(
      '',
      '  tier-averse is ahead. Per the spec: do not touch core/rewards.ts.',
      '  The fix is data/rewardPools.ts (pools too weak) or data/scaling.ts (tiers too harsh).',
    );
  }
  return out.join('\n');
}

/**
 * The one number two samples exist to produce.
 *
 * The gap between greedy and random is the crude measure of whether player
 * skill matters. It is printed last because it is the only line in the whole
 * report that no single sample can produce.
 */
function comparison(all: Sample[]): string {
  return table(
    ['policy', 'nodes', 'completion', 'mean gyms', 'gym 1', 'gym 4', 'gym 8'],
    all.map((sample) => [
      sample.policy,
      sample.nodes,
      pct(sample.completionRate),
      sample.meanGymsCleared.toFixed(2),
      pct(sample.perGym[0]?.clearRate ?? 0),
      pct(sample.perGym[3]?.clearRate ?? 0),
      pct(sample.perGym[7]?.clearRate ?? 0),
    ]),
  );
}
