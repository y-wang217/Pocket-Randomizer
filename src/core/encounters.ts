/**
 * Map generation.
 *
 * One rule dominates this file: **the whole map is generated in one pass at run
 * creation, before the player has made a single decision.** Not lazily, not at
 * node entry. Lazy draws make the roll order a function of player behaviour,
 * and the moment Stage 3 inserts a reward draw between two nodes, every seed
 * recorded before that change replays as a different map. Generating eagerly
 * costs a few hundred microseconds and buys seed compatibility that survives
 * three more stages.
 *
 * ## What Stage 4.6a changed about the contract
 *
 * Through Stage 4.5.2 the passes below were a **global draw order**: five
 * sweeps over the map, each consuming one long sequence, and the order between
 * them was the compatibility contract. That is why every stage appended a pass
 * rather than editing one — "the list only ever grows downward" was the whole
 * discipline, and it was load-bearing.
 *
 * Keyed sub-streams (`core/rng.ts`) retire that rule. Every draw here now names
 * a **key** — a node, a segment, a purpose — and two keys are independent
 * sequences. So:
 *
 *   - The passes are still passes, because they are readable that way and
 *     because pass 2 needs pass 1's kinds. They are no longer a draw order.
 *   - A new draw under a new key moves nothing at all. A new draw inside an
 *     existing key moves only that key's own later draws — one node's cards,
 *     not every node's.
 *   - Reordering the passes is now a refactor rather than a break, which is
 *     precisely what makes 4.6b and 4.6c cheap. `core/streamKeys.ts` holds the
 *     namespace and `docs/spec/gymrun-seeds-and-mappability.md` holds the argument.
 *
 * What has *not* changed is eagerness. Contents are still generated for every
 * option the player will never take, because the alternative makes the number
 * of draws a function of the path walked — and while keying means that can no
 * longer corrupt a *different* node, a lazily generated node would still be a
 * node whose contents depend on when it was visited.
 *
 * ## The passes
 *
 *   1. `map`, keyed per segment: segment length, then per step the option count
 *      and the node kinds, then the rest-availability fix-up, then per step the
 *      tiers of that step's battle nodes.
 *   2. `randomizer`, keyed per node: encounter contents — species, level,
 *      ability and moves — for every node, including options never taken.
 *   3. `battle`, keyed per node: one sim seed per battle node.
 *   4. `rewards`, keyed per node and purpose: the three-card offer for a node
 *      with a tier, the stock for a shop, the resolved outcomes for an event.
 *   5. `rewards`, keyed per node: whether a won wild node offers its species.
 *   6. `rewards`, keyed per segment: the gym clear offer.
 *
 * Pass 1's internal order still matters, because it is one key: the tier draw
 * comes *after* the rest fix-up, since the fix-up rewrites node kinds and a
 * tier drawn for a node that then became a rest would be a draw stranded in the
 * middle of that key's sequence.
 *
 * Pass 4 is at map generation for the reason the whole document exists.
 * Drawing an offer when the node is *completed* would make the roll depend on
 * how the battle went — how many turns it ran, how many damage rolls the sim
 * consumed — and the reward a seed pays out would quietly become a function of
 * play. Keying does not touch that argument; it is about *when*, not *where*.
 */
import {
  generateGymTeam,
  generateStarters,
  generateTrainerTeam,
  generateWildTeam,
} from './randomizer';
import { generateEncounterAcquisition, type AcquisitionOffer } from './acquisition';
import { generateShopStock, type ShopStock } from './economy';
import { generateEvent, type EventInstance } from './events';
import { generateGymRewardOffer, generateRewardOffer, type RewardOffer } from './rewards';
import type { Rng, RngStream, SimSeed } from './rng';
import { gymRewardKey, localeOfferKey, nodeKey, nodeRewardKey, routeKey, STARTERS_KEY } from './streamKeys';
import type { PokemonSpec, TeamSpec, Tier } from './types';
import { gymForSegment, type GymDefinition } from '../data/gyms';
import {
  localeOfferWeight,
  LOCALE_IDS,
  type LocaleId,
  type LocaleOfferContext,
} from '../data/locales';
import { starterLevel } from '../data/scaling';
import { tierWeightsFor, type ChoosableKind, type NodeKind, type Range, type Tuning } from '../data/tuning';

/** What a battle node fights. Generated eagerly; see the header. */
export interface EncounterSpec {
  team: TeamSpec;
  /** Shown once the encounter starts, not on the map. */
  opponent: string;
  /**
   * The sim PRNG seed for this battle.
   *
   * Drawn at generation rather than at battle start, because `createBattle`
   * derives its own seed from the *run* seed and would therefore hand every
   * battle in a run the identical PRNG — the same crits, on the same turns,
   * eight nodes running.
   */
  simSeed: SimSeed;
}

export interface NodeSpec {
  /** Stable within a run: `s<segment>-<step>-<option>`, or `s<segment>-gym`. */
  id: string;
  kind: NodeKind;
  /**
   * Difficulty tier, or **null for a node that does not have one**.
   *
   * Rest nodes and gyms are null, and that is a type decision rather than a
   * data one. Stage 2 wrote `normal` on every node including those, which was
   * harmless while nothing read the field and stops being harmless the moment
   * Stage 3 keys a reward pool off it: `REWARD_POOLS[node.tier]` would then
   * compile perfectly and quietly hand a rest node a normal-tier reward. Modelling
   * "no tier" as absent rather than as a value makes that a type error at the
   * call site instead of a bug on the reward screen.
   *
   * A gym is null for the second reason `generateGymTeam` takes no tier: a gym
   * is the segment's difficulty statement, and a second dial on the same number
   * is a dial the balance report cannot attribute.
   */
  tier: Tier | null;
  /** What the map shows. Deliberately says the kind and not the contents. */
  label: string;
  /** Null for nodes that are not a fight. */
  encounter: EncounterSpec | null;
  /**
   * The three cards this node pays out, drawn at map generation.
   *
   * Null wherever `tier` is null **except at a gym**, which draws from its own
   * segment-keyed pool (`data/rewardPools.gymRewardEntriesFor`) in pass 6.
   * Everything else without a tier is a rest, a shop or an event and has
   * nothing to draw from.
   *
   * Gyms paid nothing until Stage 4.5.2, on the argument that the segment heal
   * and the level were already a larger reward than any card. That is true of
   * the heal and false of the feeling: a heal is restorative and a level is
   * automatic, so the hardest fight in the segment was the only one that handed
   * the player nothing to *choose*.
   *
   * Present on the node rather than held in run state because it is part of
   * what the seed fixed. The player is shown it only after winning; see
   * `playRun`.
   */
  reward: RewardOffer | null;
  /** The shelf, for a shop node. Null for everything else. */
  shop: ShopStock | null;
  /**
   * The prompt and its already-resolved outcomes, for an event node.
   *
   * Resolved at map generation, which is the point: an event that reads
   * "might be a trap" has already flipped its coin, so reloading a save cannot
   * reroll it and two players on the same seed making the same choice get the
   * same result.
   */
  event: EventInstance | null;
  /**
   * The Pokemon this node offers if the player wins, or null.
   *
   * Wild nodes only, and drawn at map generation like every other offer — see
   * `core/acquisition.ts`. **Whether it appears cannot depend on how the battle
   * went, only on whether it was won.** A rate check rolled at node completion
   * would make the number of `rewards` draws a function of play, and every seed
   * recorded before a change to battle length would replay with a different set
   * of acquisitions.
   */
  acquisition: AcquisitionOffer | null;
}

export interface Step {
  index: number;
  options: NodeSpec[];
}

/**
 * One locale's road through a segment.
 *
 * **Stage 4.6a, and it is the reason `Segment.steps` is gone.** A segment offers
 * two or three locales and the player commits to one; each has its own route,
 * generated at run creation like everything else. The unpicked routes stay in
 * the map data and are never walked.
 *
 * Generating all of them up front rather than deriving the picked one at
 * selection time is the eager rule (docs/generation.md §1) applied to a new
 * decision. With keyed sub-streams the two are *identical* in output — a route
 * is a function of `(seed, 'map', 'seg<i>/<locale>/route')` and of nothing else
 * — so the choice is made on the other ground: eager is what the codebase
 * already does, and a lazy path would be a second way for content to exist,
 * differing from the first only in cases nobody would think to test.
 */
export interface LocaleRoute {
  locale: LocaleId;
  steps: Step[];
}

export interface Segment {
  index: number;
  /** The gym that caps this segment, for display. */
  leader: string;
  type: string;
  /** The full leader record, so a screen can show the blurb without a lookup. */
  gymDefinition: GymDefinition;
  /**
   * The locales this segment offers, in offer order. Two or three.
   *
   * The player's answer is an **index into this list**, recorded in the run log
   * — the same rule a reward decision follows, and for the same reason: the
   * offer is reconstructible from the seed, and a log naming `'marsh'` would
   * keep replaying after a table edit and walk a route the run never offered.
   */
  localeOffer: LocaleId[];
  /** One route per offered locale, aligned to `localeOffer`. */
  routes: LocaleRoute[];
  /** Not an option: reaching the end of the steps means fighting this. */
  gym: NodeSpec;
}

/** The route for one offered locale, by offer index. */
export function routeAt(segment: Segment, offerIndex: number): LocaleRoute {
  const route = segment.routes[offerIndex];
  if (!route) throw new RangeError(`Segment ${segment.index} has no route ${offerIndex}`);
  return route;
}

/**
 * Every step of every offered route, flattened.
 *
 * What a *property* of a segment is asserted over: "at least one rest is
 * reachable" has to hold on each route, not on one of them, because the player
 * picks the route and a guarantee that held only on the road not taken is not a
 * guarantee. Callers that care which route a step belongs to walk
 * `segment.routes` instead.
 */
export function routeStepsOf(segment: Segment | undefined): Step[] {
  return segment ? segment.routes.flatMap((route) => route.steps) : [];
}

/**
 * Every node in a segment, across **every** offered route, plus the gym.
 *
 * Generation's view rather than a player's: the passes below fill in contents,
 * sim seeds and payouts for routes the run will discard, because which one is
 * discarded is a decision and decisions do not draw.
 */
export function nodesOf(segment: Segment): NodeSpec[] {
  return [...segment.routes.flatMap((route) => route.steps.flatMap((step) => step.options)), segment.gym];
}

// ---------------------------------------------------------------------------
// Draws
// ---------------------------------------------------------------------------

/** Uniform inclusive integer from a range. */
function drawRange(stream: RngStream, range: Range): number {
  const span = range.max - range.min;
  if (span < 0) throw new RangeError(`Invalid range ${range.min}..${range.max}`);
  return range.min + stream.nextInt(span + 1);
}

/**
 * The kinds a step may offer, in a fixed sample order.
 *
 * The order is a draw order — `sampleWeighted` walks it — so appending is safe
 * and reordering reshuffles every recorded map. Stage 3's `shop` and `event`
 * are therefore appended rather than slotted in next to `rest` where they
 * would read more naturally.
 */
const CHOOSABLE_KINDS: readonly ChoosableKind[] = ['wild', 'trainer', 'rest', 'shop', 'event'];

/** Node kinds that are a fight, and therefore the only ones that carry a tier. */
const BATTLE_KINDS: readonly ChoosableKind[] = ['wild', 'trainer'];

/**
 * Weighted sample, optionally without replacement. One draw per item picked.
 *
 * Two callers, and both want the "without replacement" half for the same
 * reason. A step offering "wild or wild" is not a choice — the contents are
 * hidden on the map, so two nodes of the same kind read as one option printed
 * twice — and a step offering "hard or hard" is not a choice either, because
 * the tier is the whole of what the player can see about the trade. Stage 3
 * generalised the Stage 2 kind sampler rather than writing the same loop a
 * second time, because two copies of a weighted draw are two draw orders to
 * keep in agreement forever.
 *
 * `count` is capped by the caller at the number of items available, so the rule
 * cannot fail silently on an early step where rest is not yet allowed.
 *
 * The draw order is unchanged from Stage 2's `sampleKinds`: same loop, same one
 * `nextFloat` per pick, same tie-breaking. That is deliberate — a refactor here
 * that consumed a different number of draws would have reshuffled every
 * recorded map on a stage that has quite enough of that already.
 */
function sampleWeighted<T>(
  stream: RngStream,
  allowed: readonly T[],
  weightOf: (item: T) => number,
  count: number,
  distinct: boolean,
): T[] {
  const picked: T[] = [];
  let pool = [...allowed];

  for (let i = 0; i < count; i++) {
    if (pool.length === 0) break;
    const total = pool.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0);
    if (total <= 0) break;
    let roll = stream.nextFloat() * total;
    // Falls back to the last entry *with weight* only for floating-point
    // residue at the very top of the range, never as an unweighted default.
    // Reading `pool[pool.length - 1]` unconditionally, as Stage 2 did, was safe
    // only because no kind had weight zero; a zero-weight tier is exactly what
    // `tierBands` uses to keep elite out of the opening segments.
    let chosen = pool.filter((item) => weightOf(item) > 0).at(-1);
    for (const item of pool) {
      roll -= Math.max(0, weightOf(item));
      if (roll < 0) {
        chosen = item;
        break;
      }
    }
    if (chosen === undefined) break;
    const picked_ = chosen;
    picked.push(picked_);
    if (distinct) pool = pool.filter((item) => item !== picked_);
  }
  return picked;
}

/** The tiers a battle node may carry, in a fixed draw order. */
const TIERS: readonly Tier[] = ['normal', 'hard', 'elite'];

// ---------------------------------------------------------------------------
// Starters
// ---------------------------------------------------------------------------

/**
 * The Pokemon the starter screen offers.
 *
 * Drawn from the `randomizer` stream and drawn *first*, before the map, so that
 * widening the starter pool does not reshape a recorded seed's map. Species,
 * ability and moveset are all rolled — the player's Pokemon is randomized like
 * everything else, which is the difference between a randomizer and a game
 * about reacting to one.
 */
export function generateStarterOptions(rng: Rng, tuning: Tuning, unlocked?: readonly string[]): PokemonSpec[] {
  return generateStarters(tuning.starterOptionCount, starterLevel(), rng.randomizer.at(STARTERS_KEY), unlocked);
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

/** Segment 0's context: nothing offered before, nothing seen. */
const EMPTY_OFFER_CONTEXT: LocaleOfferContext = { previous: [], seen: [] };

/**
 * One locale's route: pass 1 (shape) and pass 2 (contents), on that locale's
 * own key.
 *
 * Keyed by segment **and locale**, which is what makes generating every offered
 * route as cheap in seed terms as generating one. The road through the Cave is
 * the same road whether the Marsh was offered beside it or not, so the offer
 * count can change without every route in the run changing with it.
 */
function buildRoute(segment: number, locale: LocaleId, rng: Rng, tuning: Tuning): LocaleRoute {
  // --- pass 1: shape, from `map`, keyed to this route ----------------------
  const shapeStream = rng.map.at(routeKey(segment, locale));
  const stepCount = drawRange(shapeStream, tuning.stepsPerSegment);
  const shape: ChoosableKind[][] = [];

  for (let step = 0; step < stepCount; step++) {
    const allowed = CHOOSABLE_KINDS.filter((kind) => kind !== 'rest' || step >= tuning.restEarliestStep);
    const wanted = drawRange(shapeStream, tuning.nodeChoiceCount);
    const count = tuning.distinctKindsPerStep ? Math.min(wanted, allowed.length) : wanted;
    shape.push(
      sampleWeighted(shapeStream, allowed, (kind) => tuning.nodeWeights[kind], count, tuning.distinctKindsPerStep),
    );
  }

  enforceComposition(shape, shapeStream, tuning);

  // Tiers, still pass 1 and still the `map` stream, but only once the kinds are
  // final. See the header: the fix-ups rewrite kinds, so a tier drawn before
  // them could belong to a node that is no longer a fight.
  const tiers = shape.map((kinds) => assignTiers(kinds, segment, shapeStream, tuning));

  // --- pass 2: contents, from `randomizer`, keyed per node -----------------
  const steps: Step[] = shape.map((kinds, step) => ({
    index: step,
    options: kinds.map((kind, option) =>
      buildNode(
        `s${segment}-${locale}-${step}-${option}`,
        kind,
        tiers[step]?.[option] ?? null,
        segment,
        locale,
        rng,
      ),
    ),
  }));

  return { locale, steps };
}

/**
 * Generate one segment: its locale offer, a route through each offered locale,
 * and the gym that caps all of them.
 *
 * Stage 1 called this once with `index: 0`; Stage 2 calls it eight times, and
 * the signature did not change. Stage 4.6a is the first change to it, and it is
 * the one the "no locale twice in a row" rule forces: the offer depends on what
 * the previous segment offered and on what the run has offered at all, so the
 * caller has to hand that over. `createRun` threads it; a test calling this
 * directly gets the empty context, which is segment 0's.
 */
export function generateSegment(
  index: number,
  rng: Rng,
  tuning: Tuning,
  context: LocaleOfferContext = EMPTY_OFFER_CONTEXT,
): Segment {
  const gymDef = gymForSegment(index);

  // --- pass 0: the locale offer, from `map`, keyed to this segment ---------
  /*
   * A pre-step, not a node. It consumes no step from the node budget, which is
   * what keeps the 4.5.1 balance table comparable: a segment is the same length
   * it was, with a decision in front of it.
   *
   * The weighting rule is `data/locales.ts`'s, not this function's. All the
   * generator knows is "sample without replacement by weight" — the same
   * `sampleWeighted` that draws kinds and tiers, so a zero weight locks a
   * locale out exactly the way a zero tier weight locks out `elite`.
   */
  const offerStream = rng.map.at(localeOfferKey(index));
  const wantedLocales = drawRange(offerStream, tuning.localeOfferCount);
  const localeOffer = sampleWeighted(
    offerStream,
    LOCALE_IDS,
    (locale) => localeOfferWeight(locale, context),
    Math.min(wantedLocales, LOCALE_IDS.length),
    true,
  );
  if (localeOffer.length === 0) throw new RangeError(`Segment ${index} was offered no locales`);

  // --- passes 1 and 2: one route per offered locale ------------------------
  const routes: LocaleRoute[] = localeOffer.map((locale) => buildRoute(index, locale, rng, tuning));

  const gym: NodeSpec = {
    id: `s${index}-gym`,
    kind: 'gym',
    tier: null,
    label: `${gymDef.leader}'s Gym`,
    encounter: {
      team: generateGymTeam(gymDef, index, rng.randomizer.at(nodeKey(`s${index}-gym`))),
      opponent: `${gymDef.leader} (${gymDef.type})`,
      // Filled by pass 3.
      simSeed: PLACEHOLDER_SEED,
    },
    reward: null,
    shop: null,
    event: null,
    acquisition: null,
  };

  const segment: Segment = {
    index,
    leader: gymDef.leader,
    type: gymDef.type,
    gymDefinition: gymDef,
    localeOffer,
    routes,
    gym,
  };

  // --- pass 3: sim seeds, from the `battle` stream -------------------------
  for (const node of nodesOf(segment)) {
    if (node.encounter) node.encounter.simSeed = rng.battle.at(nodeKey(node.id)).nextSimSeed();
  }

  // --- pass 4: reward offers, from the `rewards` stream --------------------
  // A separate loop rather than a branch inside pass 3, so that the two streams
  // are consumed in two independent index-ordered sweeps. Interleaving them
  // would be identical today and would couple their draw orders forever.
  for (const node of nodesOf(segment)) {
    if (node.tier) {
      node.reward = generateRewardOffer(
        node.id,
        node.tier,
        index,
        rng.rewards.at(nodeRewardKey(node.id, 'offer')),
        tuning,
      );
    } else if (node.kind === 'shop') {
      node.shop = generateShopStock(node.id, index, rng.rewards.at(nodeRewardKey(node.id, 'shop')), tuning);
    } else if (node.kind === 'event') {
      node.event = generateEvent(node.id, rng.rewards.at(nodeRewardKey(node.id, 'event')), tuning);
    }
  }

  // --- pass 5: encounter captures, no stream at all ------------------------
  /*
   * **Stage 4.6a: every wild node offers its Pokemon, and the offer is not
   * drawn.** This was a roll per wild node off the `rewards` stream at a rate
   * keyed to tier; it is now a fact about the node, so the pass consumes
   * nothing and could in principle be folded into `buildNode`.
   *
   * It stays a pass because it is still a *payout* — it belongs beside the
   * other four things a node pays, where anyone changing what a node offers
   * will find it — and because keeping it here means the day a capture needs a
   * draw again, the key already exists (`nodeRewardKey(id, 'capture')`) and
   * nothing else moves.
   */
  for (const node of nodesOf(segment)) {
    const lead = node.encounter?.team[0];
    if (node.kind !== 'wild' || !lead) continue;
    node.acquisition = generateEncounterAcquisition(node.id, lead, tuning);
  }

  // --- pass 6: the gym clear offer, also from the `rewards` stream ----------
  /*
   * Appended, like every pass before it, and for the reason the contract
   * exists: a new pass on the end cannot move the five above it. Folding this
   * draw into pass 4 — where it would read naturally, right beside every other
   * offer — would couple the two draw orders forever, so the next change to
   * gym rewards would reshuffle every acquisition in every recorded seed.
   *
   * A gym has no tier, so pass 4's `if (node.tier)` skips it; that is why this
   * is a pass rather than a condition relaxed there.
   */
  segment.gym.reward = generateGymRewardOffer(
    segment.gym.id,
    index,
    rng.rewards.at(gymRewardKey(index)),
    tuning,
  );

  return segment;
}

/** Overwritten in pass 3; never reaches a battle. */
const PLACEHOLDER_SEED: SimSeed = `sodium,${'0'.repeat(64)}`;

/**
 * The three composition guarantees, applied to a drawn shape in a fixed order.
 *
 * **Stage 4.6a, and it replaces `ensureRests` rather than sitting beside it.**
 * Three fix-ups that all rewrite kinds cannot be three independent functions:
 * the rest fix-up used to overwrite a step's last option unconditionally, which
 * with an event guarantee in play would have satisfied one rule by breaking
 * another. So there is one pass, one order, and a set of **claimed** steps that
 * a later fix-up may not touch.
 *
 * The order is deliberate and runs from least placeable to most:
 *
 *   1. **The wild step**, which takes a whole step, so it needs the most room.
 *   2. **The event**, which may go anywhere.
 *   3. **The rest**, which may not go before `restEarliestStep` but is otherwise
 *      free, and which is last because it is the guarantee the run can most
 *      easily do without for one segment.
 *
 * It runs in pass 1, before any contents are drawn, which is what lets it
 * rewrite kinds at all: at this point nothing has been drawn for these nodes, so
 * changing what they are strands no draw.
 */
function enforceComposition(shape: ChoosableKind[][], stream: RngStream, tuning: Tuning): void {
  const claimed = new Set<number>();

  /*
   * The wild step: every option a wild encounter, so the segment's one
   * guaranteed wild fight is reachable whatever the player picks.
   *
   * Its width is `tuning.wildStepOptionCount` rather than the width that step
   * happened to draw, and rather than the number of tiers the segment can
   * offer. The second of those was the first version and it was wrong in a way
   * `test/tiers.test.ts` caught immediately: deriving the width from the tier
   * weights makes `tierBands` — the knob a tuning pass reaches for first —
   * reshape every map it touches, and the whole point of that table is that it
   * moves risk and nothing else.
   */
  for (let placed = 0; placed < tuning.wildStepsPerSegment; placed++) {
    const eligible = shape.map((_, step) => step).filter((step) => !claimed.has(step));
    if (eligible.length === 0) break;
    const step = eligible[stream.nextInt(eligible.length)];
    if (step === undefined) break;
    const width = Math.max(1, tuning.wildStepOptionCount);
    shape[step] = Array.from({ length: width }, () => 'wild' as ChoosableKind);
    claimed.add(step);
  }

  ensureKind(shape, 'event', tuning.minEventSteps, stream, claimed, 0);
  ensureKind(shape, 'rest', tuning.minRestSteps, stream, claimed, tuning.restEarliestStep);
}

/**
 * Guarantee that at least `minimum` steps offer `kind`, and claim the steps
 * that provide it.
 *
 * Claiming covers steps that already had the kind as well as steps converted to
 * get it, and that is the half worth writing down: a segment that naturally
 * rolled an event and then had its rest fix-up overwrite that same option would
 * satisfy both counters and ship a segment with no event in it. The claim is
 * what makes the guarantees compose rather than race.
 *
 * Converts the **last** option of a deterministically chosen eligible step, and
 * draws one value per conversion. A weighted re-roll here would make the number
 * of draws depend on what was drawn, which is the dependency the whole eager
 * contract is written to avoid.
 */
function ensureKind(
  shape: ChoosableKind[][],
  kind: ChoosableKind,
  minimum: number,
  stream: RngStream,
  claimed: Set<number>,
  earliestStep: number,
): void {
  let have = 0;
  shape.forEach((kinds, step) => {
    if (have >= minimum || claimed.has(step) || !kinds.includes(kind)) return;
    claimed.add(step);
    have++;
  });

  while (have < minimum) {
    const eligible = shape
      .map((kinds, step) => ({ kinds, step }))
      .filter(({ kinds, step }) => step >= earliestStep && !claimed.has(step) && kinds.length > 0);
    if (eligible.length === 0) return;
    const target = eligible[stream.nextInt(eligible.length)];
    if (!target) return;
    target.kinds[target.kinds.length - 1] = kind;
    claimed.add(target.step);
    have++;
  }
}

/**
 * The tiers for one step's options, aligned to the step's kind list.
 *
 * `null` at an index whose kind is a rest, a tier at every index that is a
 * fight. The alignment is what lets `buildNode` take its tier by position
 * rather than by a second lookup.
 *
 * **The draw count depends only on how many fights the step has, never on what
 * was drawn.** That is the property the whole eager-generation contract rests
 * on: a weighted re-roll loop here would make a segment's later map draws
 * depend on its earlier ones, which is a dependency nobody can reason about
 * and every recorded seed would rest on.
 *
 * Without replacement by default, so a step's two fights are two different
 * trades rather than the same trade offered twice. See
 * `tuning.distinctTiersPerStep` for why that is the rule and not the option.
 */
function assignTiers(
  kinds: readonly ChoosableKind[],
  segment: number,
  stream: RngStream,
  tuning: Tuning,
): (Tier | null)[] {
  const battleSlots = kinds.filter((kind) => BATTLE_KINDS.includes(kind)).length;
  if (battleSlots === 0) return kinds.map(() => null);

  const weights = tierWeightsFor(tuning, segment);
  const available = TIERS.filter((tier) => weights[tier] > 0);
  const wanted = tuning.distinctTiersPerStep ? Math.min(battleSlots, available.length) : battleSlots;
  const drawn = sampleWeighted(stream, available, (tier) => weights[tier], wanted, tuning.distinctTiersPerStep);

  /*
   * A step with more fights than the band has distinct tiers.
   *
   * Unreachable at the shipped tuning — `distinctKindsPerStep` caps a step at
   * one wild and one trainer, so two fights at most against three tiers — but
   * only unreachable *because of another knob*, which is not a guarantee. The
   * fallback repeats the softest tier drawn rather than dropping a node or
   * throwing: a map that refuses to generate because two dials disagree is a
   * far worse failure than a step that briefly offers the same trade twice.
   */
  const fallback = drawn[drawn.length - 1] ?? 'normal';

  let next = 0;
  return kinds.map((kind) => (BATTLE_KINDS.includes(kind) ? (drawn[next++] ?? fallback) : null));
}

/**
 * One node's contents.
 *
 * The kind decides which randomizer entry point is called and nothing else.
 * Note that a wild node asks for a *team* rather than a Pokemon: at the shipped
 * curve that team has one member, and writing `[generateWildMon(...)]` here
 * would be the single-mon assumption written down one more time in the one file
 * whose job is to not do that.
 */
function buildNode(
  id: string,
  kind: ChoosableKind,
  tier: Tier | null,
  segment: number,
  locale: LocaleId,
  rng: Rng,
): NodeSpec {
  if (kind === 'rest' || kind === 'shop' || kind === 'event') {
    // Contents for these are pass 4's job: a shop's shelf and an event's
    // outcomes both come off the `rewards` stream, and drawing them here would
    // interleave that stream with the `randomizer` draws around it.
    return {
      id,
      kind,
      tier: null,
      label: NON_BATTLE_LABELS[kind],
      encounter: null,
      reward: null,
      shop: null,
      event: null,
      acquisition: null,
    };
  }
  if (!tier) throw new Error(`Battle node ${id} was generated without a tier`);

  const stream = rng.randomizer.at(nodeKey(id));
  /*
   * The locale reaches exactly one of these two calls, and that is the whole of
   * what a locale decides. A trainer's team, a shop's shelf and an event's
   * outcomes are locale agnostic: a locale is where you are, not how hard it is,
   * and a second dial on difficulty is a dial the balance report cannot
   * attribute.
   */
  const team =
    kind === 'wild'
      ? generateWildTeam(segment, tier, stream, locale)
      : generateTrainerTeam(segment, tier, stream);
  const lead = team[0];
  if (!lead) throw new Error(`Generated an empty ${kind} team at segment ${segment}`);

  return {
    id,
    kind,
    tier,
    label: kind === 'wild' ? 'Wild encounter' : 'Trainer battle',
    encounter: {
      team,
      opponent: describeOpponent(kind, team, lead),
      simSeed: PLACEHOLDER_SEED,
    },
    // Filled by pass 4.
    reward: null,
    shop: null,
    event: null,
    acquisition: null,
  };
}

/** What the map calls a node that is not a fight. */
const NON_BATTLE_LABELS: Record<'rest' | 'shop' | 'event', string> = {
  rest: 'Rest site',
  shop: 'Shop',
  event: 'Something happens',
};

/** What the log and the summary call this opponent. */
function describeOpponent(kind: ChoosableKind, team: TeamSpec, lead: PokemonSpec): string {
  if (kind === 'wild') return `Wild ${lead.species}`;
  return team.length === 1 ? `Trainer's ${lead.species}` : `Trainer (${team.length})`;
}
