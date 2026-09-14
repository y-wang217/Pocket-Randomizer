/**
 * Events: building one when the map is built, and applying it when the player
 * picks.
 *
 * Pure, explicit `Rng`, same contract as `randomizer.ts` and `rewards.ts`.
 *
 * ## What the event rejig changed
 *
 * Before it, an event was a prompt and two or three authored choices, each
 * carrying one outcome per capability band. Every choice paid at every band, so
 * the node was a small guaranteed handout with a relic check bolted on.
 *
 * Now an event is a prompt and **four options, one per archetype**:
 *
 * | archetype | cost | pays |
 * |---|---|---|
 * | `safe` | none | a flat `T1` |
 * | `gamble` | none | `T0` to `T2`, on the node's rarity |
 * | `toll` | a stated price, paid up front | a guaranteed `T2` |
 * | `attune` | none | `T2` to `T3`, and **only when the event's relic is held** |
 *
 * The archetype decides the distribution and `data/events.ts` decides the copy
 * and the price, so 24 events are written from one template rather than 24
 * bespoke outcome tables.
 *
 * ## The coin is already flipped
 *
 * Every draw happens at map generation, so an event that reads "might be a
 * trap" to the player has already resolved before they see it. That is not a
 * hedge, it is the only version of randomness a seeded game can honestly offer:
 * resolving at pick time would let a save reloaded before the choice reroll a
 * bad outcome, and two players on the same seed making the same decision would
 * get different runs.
 *
 * ## Everything is drawn for every option, at every tier and every band
 *
 * All four options are built whatever the run holds, **including Attune on a
 * run with no relic**, and each one draws one outcome per tier and one selected
 * tier per band. At most one of those sixteen outcomes is ever paid.
 *
 * That waste is the feature. RNG consumption per event node must not depend on
 * the party or the relics standing in front of it, or a seed stops describing
 * one run — two players on the same seed would diverge on a roll neither of
 * them made. Attune is filtered out of the *presented* list at resolution, by
 * `presentedOptions`, and never out of the *generated* one.
 *
 * ## Outcomes are data
 *
 * `EventOutcome` is a typed union of kinds and numbers, never a callback, and
 * `applyEventOutcome` below is the only thing that interprets it. Two reasons,
 * both in the spec: an outcome must serialize into the run log, and the balance
 * simulator must be able to *score* an option without executing arbitrary code
 * — a policy that had to run a function to find out what a button does could
 * not compare two buttons, and the report's event numbers would be measuring a
 * coin toss.
 */
import type { AcquisitionOffer } from './acquisition';
import { stow } from './items';
import { leadOf, recoverParty } from './party';
import { damagingInBands } from './randomizer';
import type { RngStream } from './rng';
import type { RunState } from './run';
import { hpEventDelta } from './hpCopy';
import { BERRIES, itemById } from '../data/items';
import {
  EVENTS,
  eventsInLocale,
  type EventDefinition,
  type TollPrice,
} from '../data/events';
import {
  EVENT_ARCHETYPES,
  OUTCOME_TIERS,
  tierEntriesFor,
  tierWeightsFor,
  type EffectTarget,
  type EventArchetype,
  type EventEffect,
  type EventRarity,
  type OutcomeTier,
} from '../data/eventPools';
import { eventRarityWeights, rewardMoveBands } from '../data/scaling';
import type { Capability } from '../data/capabilities';
import type { LocaleId } from '../data/locales';
import type { CapabilityBand } from './capabilities';
import type { Tuning } from '../data/tuning';

// ---------------------------------------------------------------------------
// The resolved shapes
// ---------------------------------------------------------------------------

/**
 * One atomic thing that happens, with every draw already made.
 *
 * The `pool` of an `item` template has collapsed to concrete ids and a `move`
 * to one move name. Everything here is a plain value, so a `JSON.stringify` of
 * a run's events is a complete record.
 *
 * Two kinds stay unresolved on purpose, and **neither is a draw**:
 * `currencyFraction` is arithmetic against gold the run does not have yet, and
 * `discard` names a count because what is in the backpack is a function of how
 * the run went. Computing either at resolution consumes no RNG and therefore
 * cannot shift a stream.
 */
export type ResolvedEffect =
  | { kind: 'currency'; amount: number }
  | { kind: 'currencyFraction'; fraction: number; floor: number }
  | { kind: 'damage'; percent: number; target: EffectTarget }
  | { kind: 'heal'; percent: number; target: EffectTarget }
  | { kind: 'item'; items: readonly string[] }
  | { kind: 'loseItem'; pool: readonly string[] }
  | { kind: 'discard'; count: number }
  | { kind: 'move'; move: string }
  /**
   * A Pokemon offered with no fight in front of it.
   *
   * **Ratified fightless at every tier**, and the deciding argument is about
   * the Toll rather than about events in general: a Toll charges a stated price
   * for a guaranteed `T2`, so a `T2` that spawned a battle would charge an
   * unknown second cost *after payment*, which is the one shape a Toll must
   * never have. `docs/generation.md` section 14 carries the ruling.
   *
   * Handled by the run's **existing** capture step rather than by
   * `applyEventOutcome`: `playRun` already asks `chooseAcquisition` once per
   * node, so an event-sourced offer reaches it by being visible to
   * `acquisitionOffered` — not by opening a second path through which a node
   * can complete.
   */
  | { kind: 'acquisition'; offer: AcquisitionOffer; withItem: boolean }
  /** A relic the run does not hold. Which one is decided at offer resolution. */
  | { kind: 'relic' }
  | { kind: 'nothing' };

/**
 * One tier's worth of outcome, drawn.
 *
 * `cost` is populated on `T0` and empty everywhere else. It stays a separate
 * field rather than being folded into `grant` so that the result screen can
 * render the consolation as its own line: a cost that appears without its
 * consolation reads as the game taking something and giving nothing, which is
 * the exact misread the retired "unrewarded, not punished" rule existed to
 * prevent.
 */
export interface EventOutcome {
  tier: OutcomeTier;
  /** The pool entry this came from. For the report and for tests, never logged. */
  entryId: string;
  cost: readonly ResolvedEffect[];
  grant: readonly ResolvedEffect[];
}

/**
 * One button on the event screen, with all sixteen of its draws already made.
 *
 * `tierAt` is the band selector and `outcomes` is what each tier holds. Both
 * are complete for every band and every tier whatever the run looks like —
 * see the header for why the waste is the point.
 */
export interface EventOption {
  archetype: EventArchetype;
  label: string;
  /** Shown before picking. Says the shape of the risk, never the drawn outcome. */
  hint: string;
  /** The exact price, on `toll` and nowhere else. */
  toll: TollPrice | null;
  outcomes: Readonly<Record<OutcomeTier, EventOutcome>>;
  tierAt: Readonly<Record<CapabilityBand, OutcomeTier>>;
}

/** An event as it exists on a generated map. */
export interface EventInstance {
  nodeId: string;
  eventId: string;
  /** The locale whose list this event was drawn from. */
  locale: LocaleId;
  /** How swingy this node is. Scales the distribution; names nothing. */
  rarity: EventRarity;
  prompt: string;
  /** The capability whose relic puts the Attune option on the menu. */
  requires: Capability;
  /** Always four, in archetype order, Attune included. */
  options: EventOption[];
}

// ---------------------------------------------------------------------------
// Reading an instance
// ---------------------------------------------------------------------------

/**
 * The outcome an option pays at this band. **The single accessor.**
 *
 * Every consumer goes through it — the run's fold, the event screen, the
 * simulator's scorer — so that "which of the sixteen" is answered once. Two
 * places indexing the records directly is two places for the band to be
 * computed against a stale party.
 */
export function outcomeFor(option: EventOption, band: CapabilityBand): EventOutcome {
  return option.outcomes[option.tierAt[band]];
}

/**
 * The options actually on the menu at this band. **The Attune gate, and the
 * only place it lives.**
 *
 * Three options without the relic, four with. The filter is here rather than at
 * generation because generation must not know what the run holds; see the
 * header.
 */
export function presentedOptions(event: EventInstance, band: CapabilityBand): EventOption[] {
  return event.options.filter((option) => option.archetype !== 'attune' || band === 'known');
}

/** The option this archetype names, or null. Archetypes are unique per event. */
export function optionOf(event: EventInstance, archetype: EventArchetype): EventOption | null {
  return event.options.find((option) => option.archetype === archetype) ?? null;
}

// ---------------------------------------------------------------------------
// Generating
// ---------------------------------------------------------------------------

/**
 * Draws the event identity, without replacement inside a segment.
 *
 * **Rarity used to name the event and no longer does.** The prompt drew a
 * rarity per node *and* gave each event a rarity, so `(locale, rarity)` named
 * exactly one event — which made "no event twice in a run" mean "no rarity
 * twice in a locale", distorting the distribution a required test pins. The
 * ruling decoupled them: rarity scales the payout, identity is this separate
 * draw, and any event can roll any rarity.
 *
 * The list refills when a locale empties. "No repeat within a segment" cannot
 * hold unconditionally at three events per locale, because a segment generates
 * three to eight event nodes across two or three locale routes and one locale
 * occasionally carries more nodes than it has events. A refill is a repeat; a
 * failed draw is a broken map.
 *
 * State is per segment and depends only on generation order, never on where
 * the player walked — exhausting along the walked path would make a draw depend
 * on player behaviour, which the keyed-stream discipline does not allow.
 */
export class EventPicker {
  private readonly unused = new Map<LocaleId, EventDefinition[]>();
  /** How often a locale ran out and refilled. The number that sizes the table. */
  refills = 0;

  pick(locale: LocaleId, stream: RngStream): EventDefinition | null {
    const all = eventsInLocale(locale);
    if (all.length === 0) return null;

    let left = this.unused.get(locale);
    if (!left || left.length === 0) {
      if (left) this.refills += 1;
      left = [...all];
      this.unused.set(locale, left);
    }

    const chosen = stream.pick(left);
    this.unused.set(
      locale,
      left.filter((event) => event.id !== chosen.id),
    );
    return chosen;
  }
}

/** The berry ids, as the toll and the `T0` costs price a berry in. */
const BERRY_IDS: readonly string[] = BERRIES.map((berry) => berry.id);

/** What an acquisition outcome asks the node for. See `core/encounters.ts`. */
export type OfferPokemon = (bandOffset: number) => AcquisitionOffer | null;

/**
 * Build one event: its rarity, its identity, and all four options fully drawn.
 *
 * Draw order, fixed, because it is a draw order and reading it differently
 * would reshuffle every recorded seed:
 *
 *   1. rarity, off the segment's ramp
 *   2. identity, off the locale's unused list
 *   3. per option in archetype order: one tier per band, then one outcome per
 *      tier
 *
 * The count is a function of the drawn entries — an entry granting two items
 * draws twice — and that is safe for the same reason it always was: this is the
 * last consumer of the `rewards` stream for a node, nodes are generated in a
 * fixed index order, so a variable count inside one node shifts only that
 * node's successors. **What it never depends on is the party or the relics**,
 * which is the property `test/event-archetypes.test.ts` asserts directly.
 */
export function generateEvent(
  nodeId: string,
  locale: LocaleId,
  segment: number,
  stream: RngStream,
  tuning: Tuning,
  picker: EventPicker,
  offerPokemon: OfferPokemon = () => null,
): EventInstance | null {
  void tuning;

  const rarity = drawRarity(segment, stream);
  const definition = picker.pick(locale, stream);
  if (!definition) return null;

  const options = EVENT_ARCHETYPES.map((archetype) =>
    buildOption(definition, archetype, rarity, segment, stream, offerPokemon),
  );

  return {
    nodeId,
    eventId: definition.id,
    locale: definition.locale,
    rarity,
    prompt: definition.hook,
    requires: definition.requires,
    options,
  };
}

/** One weighted draw over the segment's rarity ramp. Exactly one draw, always. */
function drawRarity(segment: number, stream: RngStream): EventRarity {
  const weights = eventRarityWeights(segment);
  return weightedPick(
    [
      { weight: weights.common, value: 'common' as const },
      { weight: weights.uncommon, value: 'uncommon' as const },
      { weight: weights.rare, value: 'rare' as const },
    ],
    stream,
    'common',
  );
}

function buildOption(
  definition: EventDefinition,
  archetype: EventArchetype,
  rarity: EventRarity,
  segment: number,
  stream: RngStream,
  offerPokemon: OfferPokemon,
): EventOption {
  /*
   * Bands in a fixed order, every one drawn even though at most one is used.
   * Reading the band before drawing would make RNG consumption a function of
   * the run's relics, and a seed would stop describing one run.
   */
  const tierAt = {
    none: drawTier(archetype, rarity, 'none', stream),
    latent: drawTier(archetype, rarity, 'latent', stream),
    known: drawTier(archetype, rarity, 'known', stream),
  };

  const outcomes = {
    T0: drawOutcome('T0', segment, stream, offerPokemon),
    T1: drawOutcome('T1', segment, stream, offerPokemon),
    T2: drawOutcome('T2', segment, stream, offerPokemon),
    T3: drawOutcome('T3', segment, stream, offerPokemon),
  };

  return {
    archetype,
    label: definition.labels[archetype],
    hint: definition.hints[archetype],
    toll: archetype === 'toll' ? definition.toll : null,
    outcomes,
    tierAt,
  };
}

/** Which tier this archetype lands on at this band. Exactly one draw. */
function drawTier(
  archetype: EventArchetype,
  rarity: EventRarity,
  band: CapabilityBand,
  stream: RngStream,
): OutcomeTier {
  const weights = tierWeightsFor(archetype, rarity, band);
  return weightedPick(
    OUTCOME_TIERS.map((tier) => ({ weight: weights[tier], value: tier })),
    stream,
    'T1',
  );
}

/** One entry from a tier's pool, with its effects resolved. */
function drawOutcome(
  tier: OutcomeTier,
  segment: number,
  stream: RngStream,
  offerPokemon: OfferPokemon,
): EventOutcome {
  const entries = tierEntriesFor(tier, segment);
  const entry = weightedPick(
    entries.map((candidate) => ({ weight: candidate.weight, value: candidate })),
    stream,
    entries[entries.length - 1] ?? null,
  );
  if (!entry) return { tier, entryId: 'empty', cost: [], grant: [{ kind: 'nothing' }] };

  return {
    tier,
    entryId: entry.id,
    cost: (entry.cost ?? []).map((effect) => resolveEffect(effect, segment, stream, offerPokemon)),
    grant: entry.grant.map((effect) => resolveEffect(effect, segment, stream, offerPokemon)),
  };
}

/**
 * Collapse a template effect's remaining randomness.
 *
 * `item` and `move` draw off the event's own stream. `acquisition` does
 * **not**: `offerPokemon` draws off the node's `capture` sub-stream, so adding
 * or removing an acquisition outcome cannot shift a single one of this event's
 * other draws. That is the keyed-stream discipline paying for itself.
 *
 * Anything that cannot be resolved degrades to `nothing` rather than throwing,
 * for the same reason an empty item pool always has: an event that cannot pay
 * is a dull event, not a broken run.
 */
function resolveEffect(
  effect: EventEffect,
  segment: number,
  stream: RngStream,
  offerPokemon: OfferPokemon,
): ResolvedEffect {
  switch (effect.kind) {
    case 'item': {
      const available = effect.pool.filter((id) => itemById(id));
      if (available.length === 0) return { kind: 'nothing' };
      const items = Array.from({ length: Math.max(1, effect.count) }, () => stream.pick(available));
      return { kind: 'item', items };
    }
    case 'move': {
      /*
       * `normal` rather than a node tier, because an event node has no tier:
       * `REWARD_BAND_OFFSET.normal` is zero, so the band window is the
       * segment's own plus the entry's offset and nothing else.
       */
      const bands = rewardMoveBands(segment, 'normal', effect.bandOffset);
      const available = damagingInBands(bands);
      if (available.length === 0) return { kind: 'nothing' };
      return { kind: 'move', move: stream.pick(available).name };
    }
    case 'acquisition': {
      const offer = offerPokemon(effect.bandOffset);
      return offer ? { kind: 'acquisition', offer, withItem: effect.withItem } : { kind: 'nothing' };
    }
    default:
      return effect;
  }
}

/**
 * One weighted draw over a list. **Exactly one draw, always**, whatever the
 * weights say — including when every weight is zero, which is the shape a
 * degenerate distribution like Safe's has.
 */
function weightedPick<T>(
  entries: readonly { weight: number; value: T }[],
  stream: RngStream,
  fallback: T,
): T {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let roll = stream.nextFloat() * Math.max(total, Number.EPSILON);
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll < 0) return entry.value;
  }
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index]!;
    if (entry.weight > 0) return entry.value;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------

/**
 * Fold a chosen event outcome into the run. The only interpreter of the union.
 *
 * Cost first, then grant, and the order is the design: a `T0` that healed
 * before it hit would pay its consolation out of HP the cost then took back,
 * and the player would read the two lines as contradicting each other.
 *
 * Called from `resolveNode` *before* the wipe check, so the death rule sees
 * whatever an event did. In practice it can never trigger one — damage is
 * floored by `tuning.eventDamageFloor` — but the ordering means that stays true
 * because of the rule rather than because of the clamp.
 */
export function applyEventOutcome(state: RunState, outcome: EventOutcome, tuning: Tuning): RunState {
  let next = state;
  for (const effect of outcome.cost) next = applyEffect(next, effect, tuning);
  for (const effect of outcome.grant) next = applyEffect(next, effect, tuning);
  return next;
}

/** Pay a toll. The same fold, so a price and a cost cannot drift apart. */
export function applyToll(state: RunState, toll: TollPrice, tuning: Tuning): RunState {
  return applyEffect(state, tollEffect(toll), tuning);
}

/** The toll, as the one effect it is. Keeps `applyEffect` the only interpreter. */
export function tollEffect(toll: TollPrice): ResolvedEffect {
  switch (toll.kind) {
    case 'hp':
      return { kind: 'damage', percent: toll.percent, target: toll.target };
    case 'gold':
      return { kind: 'currencyFraction', fraction: toll.fraction, floor: toll.floor };
    case 'goldFixed':
      return { kind: 'currency', amount: -toll.amount };
    case 'berry':
      return { kind: 'loseItem', pool: BERRY_IDS };
    case 'discard':
      return { kind: 'discard', count: toll.count };
  }
}

function applyEffect(state: RunState, effect: ResolvedEffect, tuning: Tuning): RunState {
  switch (effect.kind) {
    case 'nothing':
      return state;

    /*
     * Deliberately nothing, and this is the load-bearing line of the mechanism.
     *
     * The party change for an accepted capture is `applyAcquisition`, called
     * once by `resolveNode` from `result.acquisition` — the same call that has
     * handled every wild capture since 4.6a. Folding a second party change in
     * here would mean an event-sourced Pokemon joined by a different code path
     * than a wild one, and the first divergence between the two would be
     * invisible. The offer travels; the application does not move.
     */
    case 'acquisition':
      return state;

    /* Same posture: which relic is decided at offer resolution, not here. */
    case 'relic':
      return state;

    case 'currency':
      // Clamped at zero rather than refused: an event that charges more than
      // the player has takes what they have. A shop is a transaction the player
      // can decline; a toll they already walked into is not.
      return { ...state, currency: Math.max(0, state.currency + effect.amount) };

    case 'currencyFraction': {
      /*
       * `max(floor, fraction x current gold)`, so a broke player still pays
       * something — and then clamped at zero, so paying more than you have
       * takes what you have rather than going negative.
       *
       * Computed here and not at generation because current gold is not known
       * when the map is built. That is arithmetic against state, not a draw: it
       * consumes no RNG and therefore cannot shift a stream, which is what lets
       * a resolution-time number exist at all in this codebase.
       */
      const owed = Math.max(Math.max(0, effect.floor), Math.round(state.currency * Math.max(0, effect.fraction)));
      return { ...state, currency: Math.max(0, state.currency - owed) };
    }

    case 'heal':
      return {
        ...state,
        party: effect.target === 'party' ? recoverParty(state.party, effect.percent) : healLead(state, effect.percent),
      };

    case 'damage':
      return { ...state, party: damageParty(state, effect.percent, effect.target, tuning) };

    case 'item':
      /*
       * Into the backpack, like every other item the run acquires. It used to
       * go straight onto the lead, which made an event item a *worse* reward
       * than an identical one from a card: it silently destroyed whatever the
       * lead was holding.
       */
      return { ...state, backpack: effect.items.reduce((bag, item) => stow(bag, item), [...state.backpack]) };

    case 'move':
      // Step 5's job: a granted move is a logged targeting decision, and asking
      // it here would put an entry in the log for a question nobody was asked.
      return state;

    case 'loseItem': {
      const index = state.backpack.findIndex((item) => effect.pool.includes(item));
      if (index < 0) return state;
      return { ...state, backpack: state.backpack.filter((_, at) => at !== index) };
    }

    case 'discard': {
      /*
       * **From the end of the backpack, and that is a rule rather than a
       * convenience.**
       *
       * A forced discard has to name a victim without asking the player, and
       * every way of choosing one is arbitrary — so the choice is made the one
       * way that is also *legible*: the backpack is ordered by acquisition, so
       * the end is the most recently picked up. A player who just took a
       * Leftovers and then walked into a setback loses the Leftovers, which is
       * a thing they can see happening. Drawing a victim would be worse twice
       * over: it would consume RNG at resolution, and it would make the cost
       * unpredictable in a way no amount of copy could explain.
       *
       * An empty backpack makes this a no-op. That is deliberate and it is why
       * `data/eventPools.ts` keeps the discard out of the opening band, where a
       * bag is most often empty: a cost that no-ops on half the runs that draw
       * it is a cost nobody learns to fear.
       */
      const keep = Math.max(0, state.backpack.length - Math.max(0, effect.count));
      return { ...state, backpack: state.backpack.slice(0, keep) };
    }
  }
}

/** Heal the lead alone. A party of nothing standing is left exactly as it was. */
function healLead(state: RunState, percent: number): RunState['party'] {
  const lead = leadOf(state.party);
  if (!lead) return state.party;
  return state.party.map((member) => (member === lead ? recoverParty([member], percent)[0]! : member));
}

/**
 * Take a percentage of max HP off the target, without fainting anyone.
 *
 * The floor is what makes an event unable to end a run. That is a design rule,
 * not a safety net: an event is a node with no battle in it, so a player who
 * lost a run to one lost it to a coin flip they could see but never play. The
 * risk an event carries is arriving at the *next* fight nearly dead, which is a
 * cost the player then gets to make decisions about.
 *
 * It also keeps the party in a coherent state. `isWiped` reads `fainted`, and
 * HP driven to zero without a faint would be a shape no other code expects.
 */
function damageParty(
  state: RunState,
  percent: number,
  target: EffectTarget,
  tuning: Tuning,
): RunState['party'] {
  const lead = target === 'lead' ? leadOf(state.party) : null;
  return state.party.map((member) => {
    if (member.fainted) return member;
    if (target === 'lead' && member !== lead) return member;
    const floor = Math.max(1, Math.round(member.maxHp * tuning.eventDamageFloor));
    const hit = Math.round(member.maxHp * Math.max(0, percent));
    return { ...member, hp: Math.max(floor, member.hp - hit) };
  });
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** A one-line label for one effect, for the event screen and the report. */
export function describeEffect(effect: ResolvedEffect): string {
  switch (effect.kind) {
    case 'currency':
      return effect.amount >= 0 ? `+${effect.amount} coins` : `${effect.amount} coins`;
    case 'currencyFraction':
      return `${Math.round(effect.fraction * 100)}% of your coins`;
    // The one place a delta is the correct unit: an event label describes an
    // effect drawn at map generation, so there is no "after" to state yet.
    case 'damage':
      return `${hpEventDelta(-effect.percent)}${effect.target === 'lead' ? ', lead' : ''}`;
    case 'heal':
      return `${hpEventDelta(effect.percent)}${effect.target === 'lead' ? ', lead' : ''}`;
    case 'item':
      return effect.items.map((item) => itemById(item)?.name ?? item).join(', ');
    case 'loseItem':
      return 'Lose a berry';
    case 'discard':
      return effect.count === 1 ? 'Discard one bag item' : `Discard ${effect.count} bag items`;
    case 'move':
      return effect.move;
    // The species and nothing else: what taking it costs is a party question,
    // and the capture card is where the party is on screen to answer it.
    case 'acquisition':
      return effect.offer.spec.species;
    case 'relic':
      return 'A relic';
    case 'nothing':
      return 'Nothing happens';
  }
}

/** What an outcome paid, as one line. The cost is described separately. */
export function describeOutcome(outcome: EventOutcome): string {
  const grants = outcome.grant.map(describeEffect).filter((text) => text !== 'Nothing happens');
  return grants.length > 0 ? grants.join(' + ') : 'Nothing happens';
}

/** What an outcome cost, as one line, or null when it cost nothing. */
export function describeCost(outcome: EventOutcome): string | null {
  if (outcome.cost.length === 0) return null;
  return outcome.cost.map(describeEffect).join(' + ');
}

/** The definition an instance came from, for tests and the report. */
export function definitionOf(instance: EventInstance): EventDefinition | null {
  return EVENTS.find((event) => event.id === instance.eventId) ?? null;
}
