/**
 * Every balance number in the game, in one typed object.
 *
 * The rule this file exists to enforce: nothing under core/ may reach in here
 * for a constant. `Tuning` is *passed* into generation and into the run state
 * machine, never imported from deep inside a function. Stage 2 sweeps these
 * values programmatically — a thousand runs at `stepsPerSegment: 6` against a
 * thousand at 8 — and that is only possible if every number is reachable from
 * a value the caller controls.
 *
 * If you find yourself writing a literal number in core/, it belongs here.
 */

import type { Tier } from '../core/types';


/**
 * The kinds of node a step can offer. `gym` is never an option, only a cap.
 *
 * Stage 3 added `shop` and `event`. Both are choosable, neither is a fight, and
 * neither carries a tier — a tier scales an encounter and selects a reward
 * pool, and a node with no encounter and no reward has nothing for one to do.
 */
export type NodeKind = 'wild' | 'trainer' | 'rest' | 'gym' | 'shop' | 'event';

/**
 * The kinds of node that are actually a fight.
 *
 * Introduced in Stage 3 to narrow the curve tables in `data/scaling.ts`. Those
 * were `Record<NodeKind, …>`, which meant every non-battle kind carried a level
 * offset and a team size that could never be read — `rest: { min: 0, max: 0 }`
 * was already meaningless filler, and adding `shop` and `event` would have
 * tripled it across eight rows. Narrowing the key is the version where the type
 * system says which kinds have a difficulty and which do not.
 */
export type BattleKind = Extract<NodeKind, 'wild' | 'trainer' | 'gym'>;

/** The kinds a step may actually offer as a choice. */
export type ChoosableKind = Exclude<NodeKind, 'gym'>;

/**
 * How likely each tier is over a stretch of the run.
 *
 * A band rather than a per-segment row because the thing being described is a
 * *phase* of the run — "the opening", "the middle", "the back half" — and eight
 * rows of three numbers would be eight places to make the same edit and one
 * place to get it wrong. `data/scaling.ts` is per segment because a level curve
 * genuinely bends at one segment; a risk appetite does not.
 */
export interface TierBand {
  /** The last segment index this row covers. Rows are read in order. */
  throughSegment: number;
  /**
   * Relative frequency of each tier. Zero locks a tier out of the band
   * entirely, which is what keeps `elite` off the opening segments.
   */
  weights: Record<Tier, number>;
}

/** An inclusive integer range, drawn uniformly. */
export interface Range {
  min: number;
  max: number;
}

/**
 * The step range a segment draws its length from. **Stage 4.8, item 3.**
 *
 * The one reader of `tuning.stepsPerSegment`'s table, so the clamp at the end
 * lives in exactly one place. A segment index past the last row reads the last
 * row rather than returning `undefined` — the same rule `segmentScaling` applies
 * to its own eight rows, and for the same reason: a run length that changed would
 * make a missing row a `NaN` step count rather than an error anyone sees.
 */
export function stepsRangeFor(tuning: Tuning, segment: number): Range {
  const rows = tuning.stepsPerSegment;
  if (rows.length === 0) throw new RangeError('tuning.stepsPerSegment is empty');
  const row = rows[Math.max(0, Math.min(rows.length - 1, Math.floor(segment)))];
  if (!row) throw new RangeError(`No step range for segment ${segment}`);
  return row;
}

/**
 * How many rests a segment of `steps` steps must offer.
 *
 * The larger of the count floor and the density floor, which is what makes the
 * 4.6a guarantee hold at every length in the curve rather than only at the length
 * it was written against. See `restStepsPerGuarantee`.
 */
export function restFloorFor(tuning: Tuning, steps: number): number {
  const byDensity = Math.floor(steps / Math.max(1, tuning.restStepsPerGuarantee));
  return Math.max(tuning.minRestSteps, byDensity);
}

export interface Tuning {
  // --- map shape -----------------------------------------------------------

  /**
   * Steps before the gym, **per segment**. Each step is one choice between nodes.
   *
   * **Stage 4.8, item 3: a table rather than one range.** A segment used to be
   * the same length at gym 8 as at gym 1, so a run did not physically grow —
   * the roster widened and the opponents scaled, and the road stayed the same
   * road. One row per segment, read by index, so a tuning pass edits numbers
   * rather than logic; a formula here would make "how long is segment 5" a thing
   * to derive rather than a thing to look at.
   *
   * Indexed by segment, and a segment past the end reads the last row — the same
   * clamp `segmentScaling` uses, for the same reason.
   */
  stepsPerSegment: readonly Range[];
  /** How many nodes a step offers. The spec calls for 2 or 3. */
  nodeChoiceCount: Range;
  /**
   * Relative frequency of each node kind when filling a step's options.
   *
   * **`rest` halved in Stage 4.5.1**, from 2 to 1, and the reason is worth
   * writing down because the direction is counter-intuitive. A rest node that
   * becomes a fight is a node that *pays a reward*, so cutting rests both
   * removes healing and adds rewards — the two pull opposite ways, and only the
   * simulator says which wins. It is the first: 12.0% completion to 11.3% at
   * 400 seeds, with the floor in `minRestSteps` cut in step.
   */
  nodeWeights: Record<ChoosableKind, number>;
  /**
   * First step index that may offer a rest.
   *
   * A rest on step 0 is a wasted choice — nothing has happened yet — and a step
   * whose only interesting option is a no-op teaches the player that the map
   * does not matter. Stage 1 has no rewards to create the tension instead.
   */
  restEarliestStep: number;
  /**
   * Whether a step's options must all be different kinds.
   *
   * On, because the map hides encounter contents: two wild nodes side by side
   * read as one option printed twice. It also caps a step's option count at the
   * number of kinds available, so an early step where rest is not yet allowed
   * offers two rather than silently offering a duplicate.
   */
  distinctKindsPerStep: boolean;
  // --- locales and composition guarantees ---------------------------------

  /**
   * How many locales a segment offers. The spec calls for 2 or 3.
   *
   * A pre-step rather than a node: picking a region does not consume one of
   * `stepsPerSegment`, so the node budget is exactly what it was in 4.5.1 and
   * the balance report can read the locale system as an addition rather than as
   * a segment that got shorter.
   */
  localeOfferCount: Range;
  /**
   * Steps in a segment whose **every** option is a wild encounter.
   *
   * One, which is the guarantee "exactly one wild encounter per segment,
   * reachable whatever the player picks". The spec allows a step where the wild
   * node is the only option; this takes the other half of the same sentence and
   * makes every option of that step a wild node, because a step with one option
   * is not a choice — and this codebase already refuses to send a list of one to
   * `chooseNode` (see the gym, and `nodeOptions`).
   *
   * The options are still a decision, because their **tiers** differ: a normal
   * wild against a hard wild is two trades, and the tier is on the map before
   * the click. See `wildStepOptionCount` for how wide that step is and why the
   * width is a number here rather than a function of the tier table.
   */
  wildStepsPerSegment: number;
  /**
   * How many options the guaranteed wild step offers.
   *
   * Two, and it is a constant rather than the step's own drawn option count for
   * one reason: **every option on that step is a wild encounter, so the tier is
   * the whole of what distinguishes them.** Three wilds in segment 0, where
   * `elite` is locked out and only two tiers exist, would be two options
   * carrying the same badge — a decision-shaped rectangle, which is exactly
   * what `distinctKindsPerStep` and `distinctTiersPerStep` both exist to
   * prevent.
   *
   * Two rather than "however many tiers the segment has" because that version
   * couples map *shape* to `tierBands`, and the rule those bands are tuned
   * under is that moving them changes which tier a node carries and nothing
   * else — same lengths, same option counts, same kinds. `test/tiers.test.ts`
   * asserts it, and it caught this exact coupling when the first version of the
   * wild step derived its width from the tier weights.
   */
  wildStepOptionCount: number;
  /**
   * Minimum steps in a segment that offer an event.
   *
   * The floor under the capability events 4.6c builds on: a segment with no
   * event in it is a segment where a party's utility Pokemon does nothing at
   * all, and a mechanic that fails to appear is one nobody can learn.
   */
  minEventSteps: number;

  /**
   * Minimum steps in a segment that offer a rest.
   *
   * Weighted draws can produce a segment with no rest at all. A run whose seed
   * decided there was nowhere to heal is not a hard run, it is a run the player
   * had no hand in, so generation guarantees a floor.
   *
   * **Halved in Stage 4.5.1, from 2 to 1, alongside `nodeWeights.rest`.** Both
   * were tuned for a world where healing was free, and the stage's premise is
   * that a rest node is only a decision if skipping it costs something. Two
   * guaranteed rests in a four-to-five step segment meant the choice arrived
   * about half the time and almost never bit.
   *
   * The floor stays at 1 rather than going to 0, and the simulator is why. At
   * 400 seeds, halving both dials cost about a point of completion (12.0% ->
   * 11.3%); removing the floor entirely cost five (7.2%) and reintroduced
   * exactly the failure this number exists to prevent — a seed that offers
   * nowhere to heal at all. One is the smallest guarantee that is still a
   * guarantee.
   */
  minRestSteps: number;
  /**
   * One rest guaranteed per this many steps. **Stage 4.8, item 3.**
   *
   * `minRestSteps` is a floor on the *count* and this is a floor on the
   * *density*, and a segment gets whichever is larger. Before item 3 they were
   * the same thing because every segment was the same length; with a curve they
   * are not, and one rest across a seven-step segment is a different amount of
   * recovery from one rest across a four-step one.
   *
   * Three, so a 4 or 5 step segment still guarantees exactly one — the opening
   * is unchanged, deliberately — and a 6 or 7 step segment guarantees two.
   */
  restStepsPerGuarantee: number;

  // --- difficulty tiers ----------------------------------------------------

  /**
   * The tier distribution, by phase of the run. Read in order; the first row
   * whose `throughSegment` covers the segment wins.
   */
  tierBands: readonly TierBand[];
  /**
   * Whether the battle nodes in one step must all carry different tiers.
   *
   * **On, and it is the single rule that makes Stage 3 a decision rather than a
   * label.** A step is a choice, and a step whose two fights are both `hard` is
   * a choice between two identical risks with two identical reward pools — the
   * tier is then decoration printed twice. Drawing without replacement means
   * every step that offers two fights offers two *different* trades, which is
   * the same reasoning as `distinctKindsPerStep` applied one level down.
   *
   * Turning it off gives independent weighted draws per node, which is the
   * honest comparison for a simulator run that wants to know whether the spread
   * is doing any work.
   */
  distinctTiersPerStep: boolean;

  // --- shops and events ----------------------------------------------------

  /** How many things a shop stocks. Drawn per shop at map generation. */
  shopStockSize: Range;
  /**
   * Fraction of max HP an event may never take a party member below.
   *
   * **An event cannot end a run, and that is a rule rather than a tuning
   * accident.** An event is a node with no battle in it; a player who loses a
   * run to one has lost it to a coin flip they could see but not play. The risk
   * an event carries is that you arrive at the *next* fight nearly dead, which
   * is a cost the player can then make decisions about.
   *
   * It is also what keeps the death rule coherent: `isWiped` reads `fainted`,
   * and HP driven to zero without a faint would be a party in a state no other
   * code expects.
   */
  eventDamageFloor: number;

  // --- rewards -------------------------------------------------------------

  /*
   * `allowSpeciesRewards` was here, and Stage 4.6b deleted it rather than
   * turning it off.
   *
   * It gated a reward card that handed over a Pokemon, and 4.6a made that card
   * redundant: capture is offered on every wild victory and a segment
   * guarantees a wild encounter. A flag left behind is a configuration nobody
   * runs and a branch nobody tests — and the reason this one could be deleted
   * cleanly is the reason it existed: it was there so the report could tell the
   * two acquisition routes apart, and there is one route now.
   */

  /**
   * Whether a won wild node may offer the species it just fielded.
   *
   * The second acquisition route, with its own switch for the same reason the
   * first has one: they are two sources of the same decision, and a report that
   * cannot turn one off cannot say which of them fills a party. The rate itself
   * is keyed to tier in `data/rewardPools.ts` — this is on or off, not a
   * multiplier, because a multiplier here and a table there would be two dials
   * on one number.
   *
   * **Turning it off does not skip the roll.** `generateEncounterAcquisition`
   * draws first and discards, so a map generated with this off consumes exactly
   * the same `rewards` draws as one with it on. A flag that skipped the draw
   * would make every later reward in every seed depend on it, and the two
   * configurations would no longer be comparable — which is the one thing this
   * flag exists to make them.
   */
  allowEncounterAcquisitions: boolean;

  // --- persistence between nodes ------------------------------------------

  /**
   * Fraction of max HP a rest node restores. 1 is a full heal.
   *
   * Partial restore is a Stage 3 question: it only becomes an interesting
   * decision once rewards give skipping a rest a real opportunity cost.
   */
  restHpFraction: number;
  /** Fraction of max PP a rest node restores. */
  restPpFraction: number;
  /**
   * Fraction of max HP and PP restored when a gym falls and a segment ends.
   *
   * The knob that made an eight-segment run survivable on one Pokemon, and the
   * second-largest balance finding of Stage 2. The simulator's diagnosis was
   * unambiguous: 80% of the runs that ended at an ordinary node entered that
   * node already damaged, and half of those below 40% HP. Attrition was not
   * pressure, it was a countdown — every segment started poorer than the last
   * and the run was decided somewhere around segment 3 regardless of play.
   *
   * Healing at the gym makes each segment its own attrition budget instead of
   * one eight-segment budget. That is also what the genre it is borrowing from
   * does: you clear a gym, you visit the Pokemon Center. Rest nodes still carry
   * the *within*-segment tension, which is where a choice between two nodes can
   * actually be interesting.
   *
   * Set below 1 to make late segments start on a deficit; set to 0 for the
   * original behaviour, which the simulator measured at a 2.5% completion rate
   * against a 5-15% target.
   */
  gymClearHealFraction: number;
  /** Whether a rest node also clears status. */
  restClearsStatus: boolean;
  /**
   * Clear status when a node ends.
   *
   * On by default, and it is a real balance decision rather than a shortcut.
   * A whole segment carried on one Pokemon means a turn-two freeze or a sleep
   * that outlasts the fight is not a decision the player made, it is a coin
   * flip that ends the run. HP and PP attrition is the interesting pressure;
   * status is a per-battle problem. Flip this to false to feel the difference.
   */
  clearStatusBetweenNodes: boolean;
  /**
   * Revive fainted party members at the start of the next node.
   *
   * Irrelevant in Stage 1, where a fainted party member means an empty party
   * and the run is already over. It is encoded now so that wipe — *every*
   * member fainted — stays the only death rule when Stage 4 adds slots.
   */
  reviveFaintedBetweenNodes: boolean;
  /**
   * Fraction of max HP a revived member returns at. Floored at 1 point.
   *
   * **Moved here from `partyTuning.reviveHpFraction` in Stage 4.5.1, and the
   * move is the point.** Stage 4 introduced partial revival as its headline
   * attrition lever and then put it somewhere a sweep cannot reach: module
   * scope in `data/partyTuning.ts`, read by a `reviveHpFor` that took no
   * tuning. So the one number the balance report kept blaming (docs/balance.md
   * §7.6: "partial free revival makes preservation cheap to skip") was the one
   * number `withTuning` could not vary, and every claim about it was an opinion
   * rather than a measurement.
   *
   * It also absorbs the old `freeRevive` boolean, which was `reviveHpPercent:
   * 1` written as a second knob. Two dials on one number is how the two answers
   * drift apart — see the note this file's header makes about `nodeWeights`.
   *
   * Half is still the shipped hypothesis. Lower makes a faint hurt for longer
   * than the node it happened on; 1 is the Stage 1 behaviour, where the bench
   * is three health bars rather than three Pokemon.
   */
  reviveHpPercent: number;

  // --- the backpack --------------------------------------------------------

  /**
   * How many *loose* items the run may carry **on top of its party slots**.
   *
   * Two, which with the slots is the smallest capacity that is still a decision:
   * enough to re-equip a full party from scratch, plus two spare to choose
   * between. Counting only loose items is the deliberate half — a capacity that
   * counted held ones would make equipping a Pokemon a way to dodge the limit,
   * and the limit exists so that *acquisition* stays a choice rather than pure
   * accumulation.
   *
   * **Stage 4.8 made this the slack rather than the whole number, and that is
   * the fix rather than a rename.** It was `backpackCapacity: PARTY_SIZE + 2`, a
   * literal evaluated once at module load and frozen into `DEFAULT_TUNING` — so
   * the bag was sized from the party at *import* time and could not follow a
   * party that grows. `Tuning` is passed into a run and must not change inside
   * one, so the derived half cannot live here; only the slack can.
   * `core/items.backpackCapacity` adds the run's live slots to it.
   *
   * Stage 3 refused to build a bag at all, on the grounds that a bag needs "a
   * screen, a capacity rule, and an answer to what happens on a wipe". This is
   * the capacity rule. The screen is the party screen, which is where items are
   * assigned; the answer on a wipe is that the run is over and the backpack
   * goes with it.
   *
   * If the simulator later shows players never reaching the cap, that is this
   * number being wrong, not the cap being pointless — see the note in
   * `core/items.ts` on why the finite version is the interesting one.
   */
  backpackSlack: number;

  // --- selection -----------------------------------------------------------

  /** How many species the starter screen offers. */
  starterOptionCount: number;

  // --- what the battle screen may show ------------------------------------

  /**
   * Whether the opponent's ability is named on the battle screen.
   *
   * **On, and the reason is the randomizer rather than a preference for
   * generosity.** In a normal Pokemon game a hidden ability is still something
   * a player can reason about: a species has two or three legal abilities, the
   * set is public, and narrowing it from what the opponent does is a skill.
   * Stage 2 draws abilities from the *whole pool* off-species, so there is no
   * set to narrow and no meta knowledge to infer from. Hiding it does not
   * create a deduction, it converts a skill decision into a coin flip.
   *
   * That is the same reasoning Stage 1 used to clear status between encounters:
   * a difficulty that comes from the player not being told the rules is not
   * difficulty.
   *
   * It is a flag rather than a constant so the opposite can be playtested
   * cheaply. `ActiveUiView.ability.revealed` carries the value through, so the
   * effectiveness badge and the tooltip layer both respect it from one source
   * — a UI that hid the ability in one place and leaked it through a `0x` in
   * another would be worse than either choice made consistently.
   */
  revealOpponentAbility: boolean;

  /**
   * Whether the opponent's held item is named on the battle screen.
   *
   * Same argument, one step weaker: items come from a curated whitelist of
   * about twenty rather than the whole item dex, so a player could in principle
   * learn the list. But the list is *ours*, not the games', and Stage 3 hands
   * items to opponents from reward-tier pools the player never sees drawn. On
   * for the same reason, separable because the case is not identical.
   */
  revealOpponentItem: boolean;
  /**
   * How many tags a move card's **button face** may carry. **Stage 4.7.**
   *
   * Four move buttons in a 2x2 grid on a 390x844 phone cannot carry twelve tags
   * and a 44px touch target. The rest of the set is not dropped — it is in the
   * tap-to-expand explanation, which is where a player who wants the full
   * picture is already going.
   *
   * Three is a judgement call and it is the first thing to revisit if
   * playtesters report missing a tag that got cut. The priority order that
   * decides *which* three survive is in `data/moveTags.ts`, next to the
   * vocabulary, and is the other half of the same call.
   *
   * A display number, so it changes no seed and enters no hash. It is on
   * `Tuning` rather than in `data/moveTags.ts` because the simulator can sweep
   * a `Tuning` field and cannot sweep a module constant — and "how much fits on
   * a phone" is exactly the sort of thing worth being able to vary.
   */
  maxMoveTagsOnFace: number;
  /**
   * How long the battle screen's feedback takes to settle, in milliseconds.
   *
   * **One number for all of it, and that is the constraint rather than a
   * convenience.** The HP chunk's shadow spends the whole of it; the two turn
   * order nudges are a quarter each and run inside the same window, the second
   * delayed by one. `ui/theme/motion.ts` writes it to `--motion-duration` at
   * startup and every battle-feedback length in the stylesheet is derived from
   * that token, so there is exactly one place the feel of a turn is set and no
   * second constant to find.
   *
   * **It is not a delay.** Nothing on the screen waits for it: the bar, the HP
   * text, the flag words and the move buttons are all correct and interactive
   * on the frame the update arrives, and a tap resolves every animation early.
   * This is how long the feedback *stays*, not how long the player waits.
   *
   * 500ms is the prompt's default and it has not been measured against
   * anything. Unlike every other number in this file it is not a balance
   * finding — the simulator has no opinion about how long a shadow should
   * linger — so it is here to be swept by a playtest, not by `npm run sim`.
   *
   * A display number, so it changes no seed. On `contentHash`: it is under
   * `src/data/`, and `docs/generation.md` §9 currently contradicts itself
   * about whether the hash is a glob over that directory or an explicit file
   * list. Under the glob reading this number would move a content hash, which
   * is exactly the failure 4.7's constraint in that section names. See
   * `docs/reports/release-c-battle-feedback.md`.
   */
  battleFeedbackMs: number;
}

/**
 * The numbers the game ships with.
 *
 * Levels and bands used to live here and now live in data/scaling.ts, which is
 * a per-segment table rather than two numbers and a multiplication. What is
 * left is the *shape of a segment*: how long it is, what it offers, and what
 * survives a node boundary. Those are the same at segment 1 and segment 8, so
 * they stay one object rather than eight rows.
 *
 * Measured with `npm run sim`, not guessed; docs/balance.md carries the report.
 */
export const DEFAULT_TUNING: Tuning = {
  // Six to eight steps was sized for Stage 1's *single* segment. Eight of those
  // is a sixty-node run on one Pokemon, which the simulator measured as an
  // attrition countdown rather than a curve. Four to five puts a full run at
  // roughly forty nodes, which is the length the genre actually uses.
  /*
   * **Stage 4.8, item 3: the run gets physically longer as it goes.**
   *
   * Segments 0 and 1 are unchanged at 4-5, which is what 4.6c measured, so the
   * early benchmark rows stay comparable and a move in them means something else
   * landed. From there it rises in two steps to 6-7.
   *
   * It stops well short of Stage 1's shape, and that is deliberate rather than
   * timid. Six to eight was sized for Stage 1's *single* segment, and eight of
   * those measured as "an attrition countdown rather than a curve" — the note on
   * the old flat value above is the record of it. This curve is 45 steps across a
   * run against today's 36, so 53 nodes against 44: a quarter longer, with the
   * growth where the player has a wide roster and a full bag to spend on it.
   */
  stepsPerSegment: [
    { min: 4, max: 5 },
    { min: 4, max: 5 },
    { min: 5, max: 6 },
    { min: 5, max: 6 },
    { min: 5, max: 6 },
    { min: 6, max: 7 },
    { min: 6, max: 7 },
    { min: 6, max: 7 },
  ],
  nodeChoiceCount: { min: 2, max: 3 },
  /*
   * Shops and events are deliberately scarcer than fights.
   *
   * A run is a sequence of fights with pressure between them; a map where every
   * other step is a shop is a map where the pressure never accumulates. These
   * weights put a shop in roughly one step in six and an event in one in four,
   * which is often enough to plan around and rare enough to be worth planning
   * around.
   */
  nodeWeights: { wild: 5, trainer: 3, rest: 1, shop: 1.5, event: 2.5 },
  restEarliestStep: 1,
  distinctKindsPerStep: true,

  localeOfferCount: { min: 2, max: 3 },
  wildStepsPerSegment: 1,
  wildStepOptionCount: 2,
  minEventSteps: 1,
  minRestSteps: 1,
  restStepsPerGuarantee: 3,

  /*
   * Elite is locked out of segments 0-1 and the weight climbs from there.
   *
   * Not because an early elite node would be unfair — the player can decline it
   * — but because it would be *illegible*. A player two steps into their first
   * run has no baseline for what a normal fight costs, so a tier label they
   * cannot price is a coin flip dressed as a decision. By segment 2 they have
   * fought a dozen nodes and the word means something.
   *
   * The back half raises the elite share so that declining risk gets steadily
   * harder to do. It does not *invert* the weights, which was the first cut:
   * `{3, 4, 4}` put 73% of late nodes above normal, and combined with
   * `distinctTiersPerStep` it meant a risk-averse player frequently had no safe
   * option at all. The simulator read that as a run dying to attrition it never
   * chose — per-segment survival around 62%, which compounds to a 1% clear over
   * eight segments.
   */
  tierBands: [
    { throughSegment: 1, weights: { normal: 7, hard: 3, elite: 0 } },
    { throughSegment: 4, weights: { normal: 5, hard: 5, elite: 1 } },
    { throughSegment: 7, weights: { normal: 4, hard: 5, elite: 2 } },
  ],
  distinctTiersPerStep: true,

  shopStockSize: { min: 3, max: 4 },
  eventDamageFloor: 0.05,

  allowEncounterAcquisitions: true,

  restHpFraction: 1,
  restPpFraction: 1,
  gymClearHealFraction: 1,
  restClearsStatus: true,
  clearStatusBetweenNodes: true,
  reviveFaintedBetweenNodes: true,
  reviveHpPercent: 0.5,

  backpackSlack: 2,

  starterOptionCount: 3,

  revealOpponentAbility: true,
  revealOpponentItem: true,

  maxMoveTagsOnFace: 3,
  battleFeedbackMs: 500,
};

/** A tuning derived from the default. Stage 2's sweep builds variants this way. */
export function withTuning(overrides: Partial<Tuning>): Tuning {
  return { ...DEFAULT_TUNING, ...overrides };
}

/**
 * The tier weights that apply to a segment.
 *
 * Falls back to the last row rather than throwing, so a `SEGMENT_COUNT` raised
 * without a matching band row keeps generating instead of crashing a run.
 */
export function tierWeightsFor(tuning: Tuning, segment: number): Record<Tier, number> {
  const row =
    tuning.tierBands.find((band) => segment <= band.throughSegment) ??
    tuning.tierBands[tuning.tierBands.length - 1];
  if (!row) throw new RangeError('Tuning has no tier bands');
  return row.weights;
}
