/**
 * Worst-case run states for the gallery. **Density modes patch, step 3.**
 *
 * The Pocket gate is a gate on the worst case or it is nothing (ruling 3 on
 * the report), and the smoke bot cannot ask for one: it plays a seed, and
 * whether the party happens to be six wide with every hand full on the turn it
 * stops is the seed's business. So the states here are **constructed**, which
 * is a recorded deviation from the gallery's own "played rather than
 * fabricated" rule (`generation.md` section 12l, ruling 3): a summary with
 * eight gyms cleared and a full graveyard does not exist as a played seed the
 * scripted policy reaches, and a fixture that waited for one would gate
 * nothing.
 *
 * What is constructed is *state*, never facts the engine owns: every species,
 * move and item is one the seed's own map generated or the dex whitelist
 * carries, every visit is one of the map's own nodes, and the party is built
 * through `core/party.createParty` so its vitals are the adapter's. Nothing
 * here draws RNG, and nothing here is imported by the shipped app —
 * `vite.gallery.config.ts` builds `gallery.html` alone.
 *
 * Per screen, the worst case the rulings name:
 *
 *   - six members, each holding an item, two of them statused and hurt, with
 *     contribution counters that are not zero (party, pre-gym, drawer, target,
 *     locale strip, the map HUD, the result's party row and capture block);
 *   - a full backpack and every relic (party screen; the drawer takes the
 *     relics);
 *   - eight gyms cleared with a casualty at every one, so the graveyard and
 *     the route are full (summary);
 *   - the event with the most prose, revealed (event);
 *   - the segment's shop with the whole shelf (shop).
 */
import { describeMove } from '../core/battle/driver';
import type { NodeSpec, Segment } from '../core/encounters';
import type { ShopStock } from '../core/economy';
import { generateEvent, type EventInstance } from '../core/events';
import { backpackCapacity } from '../core/items';
import { displayName } from '../core/nicknames';
import { createParty } from '../core/party';
import { createRng } from '../core/rng';
import type { TargetedReward } from '../core/rewards';
import { chooseLocale, chooseStarter, createRun, partyCapacity, type NodeVisit, type RunResult, type RunState } from '../core/run';
import type { MoveSpec, PokemonSpec, PokemonState, RunLog } from '../core/types';
import { ITEMS } from '../data/items';
import { MAX_PARTY_CAPACITY } from '../data/partyTuning';
import { RELIC_IDS } from '../data/relics';
import { DEFAULT_TUNING } from '../data/tuning';

/** Every spec the seed's map can put on the field, longest species name first. */
function harvestSpecs(state: RunState): PokemonSpec[] {
  const seen = new Map<string, PokemonSpec>();
  const take = (node: NodeSpec): void => {
    for (const spec of node.encounter?.team ?? []) {
      if (spec.moves.length === 4 && !seen.has(spec.species)) seen.set(spec.species, spec);
    }
  };
  for (const segment of state.segments) {
    take(segment.gym);
    for (const route of segment.routes) for (const step of route.steps) for (const node of step.options) take(node);
  }
  return [...seen.values()].sort((a, b) => b.species.length - a.species.length || a.species.localeCompare(b.species));
}

/**
 * The widest party the run allows, every hand full.
 *
 * Long species names first, because a name is the widest thing on a card
 * header and a wrapped header is a taller card. Two members statused and hurt
 * so the status chip and the HP band's colour are on screen; every member
 * holding a different item so the item row is never the empty chip.
 */
export function worstCaseParty(state: RunState): PokemonState[] {
  const specs = harvestSpecs(state).slice(0, MAX_PARTY_CAPACITY);
  const party = createParty(specs.length >= MAX_PARTY_CAPACITY ? specs : [...state.party.map((member) => member.spec), ...specs].slice(0, MAX_PARTY_CAPACITY));
  return party.map((member, index) => ({
    ...member,
    // Held items are on the spec, which is what the adapter reads. One of
    // each, from the top of the whitelist, so no two chips read the same.
    spec: { ...member.spec, item: ITEMS[index % ITEMS.length]?.id ?? member.spec.item },
    // And on the member, which is what the party screen and the drawer read.
    item: ITEMS[index % ITEMS.length]?.id,
    hp: index % 3 === 1 ? Math.max(1, Math.floor(member.maxHp * 0.4)) : member.maxHp,
    status: index === 1 ? 'brn' : index === 4 ? 'par' : null,
    contribution: {
      ...member.contribution,
      damageDealt: 1234 + index * 100,
      damageTaken: 987 + index * 50,
      kos: 3 + index,
      faints: index % 2,
      turnsOnField: 42 + index * 7,
    },
  }));
}

/** A fresh segment-one map with the worst-case party on it. */
export function openingState(seed: string): RunState {
  const state = chooseLocale(chooseStarter(createRun(seed, DEFAULT_TUNING), 0), 0);
  return furnish({ ...state, party: worstCaseParty(state) });
}

/** Every relic, a backpack at capacity, and coins enough to buy the whole shelf. */
function furnish(state: RunState): RunState {
  const capacity = backpackCapacity(partyCapacity(state), state.tuning);
  const held = new Set(state.party.map((member) => member.spec.item));
  const loose = ITEMS.filter((entry) => !held.has(entry.id)).map((entry) => entry.id);
  // `Array.from` rather than a spread literal: `test/relic-permanence.test.ts`
  // scans `src/` for `relics: [` and this constructed state must not read as a
  // second grant. It is a fixture, not a write path.
  return {
    ...state,
    relics: Array.from(RELIC_IDS),
    backpack: Array.from({ length: capacity }, (_, index) => loose[index % loose.length] ?? loose[0] ?? 'leftovers'),
    currency: 999,
  };
}

/**
 * A run at its last gym with eight segments walked and a casualty at every
 * gym: the summary's worst case, and the capacity every late screen reads.
 *
 * Every visit names one of the map's own nodes; only the *fact of having been
 * there* is constructed. `hpAfter` and the turn counts are plausible numbers
 * the summary prints and nothing computes from.
 */
export function lateState(seed: string): RunState {
  const state = chooseLocale(chooseStarter(createRun(seed, DEFAULT_TUNING), 0), 0);
  const party = worstCaseParty(state);
  const history: NodeVisit[] = [];
  for (const [index, segment] of state.segments.entries()) {
    const route = segment.routes[0];
    for (const step of route?.steps ?? []) {
      const node = step.options[0];
      if (!node) continue;
      history.push(visitOf(node, index, node.kind === 'rest' || node.kind === 'shop' || node.kind === 'event' ? null : 'won', party, []));
    }
    const casualty = party[index % party.length];
    history.push(
      visitOf(segment.gym, index, 'won', party, casualty ? [casualtyOf(casualty, segment)] : []),
    );
  }
  const last = state.segments.length - 1;
  const lastSteps = state.segments[last]?.routes[0]?.steps.length ?? 0;
  return furnish({
    ...state,
    party,
    localeChoices: state.segments.map(() => 0),
    currentSegment: last,
    position: lastSteps,
    history,
  });
}

function visitOf(node: NodeSpec, segment: number, result: 'won' | null, party: readonly PokemonState[], casualties: NodeVisit['casualties']): NodeVisit {
  return {
    node,
    segment,
    result: result ? { winner: 'p1', turns: 7 + segment, cause: 'faint' } : null,
    hpAfter: party.reduce((total, member) => total + member.hp, 0),
    casualties,
  };
}

function casualtyOf(member: PokemonState, segment: Segment): NodeVisit['casualties'][number] {
  const foe = segment.gym.encounter?.team[0];
  return {
    side: 'p1',
    name: displayName(member.spec),
    level: member.spec.level,
    bySpecies: foe?.species ?? segment.leader,
    byMove: foe?.moves[0] ?? null,
    indirect: null,
  };
}

/** The finished run the summary draws, victorious, with `lateState`'s history. */
export function finishedResult(seed: string, log: RunLog): RunResult {
  const state = { ...lateState(seed), outcome: 'victory' as const };
  return { state, outcome: 'victory', log };
}

/** The first shop the map holds, with the whole shelf. */
export function anyShop(state: RunState): ShopStock | null {
  for (const segment of state.segments) {
    for (const route of segment.routes) {
      for (const step of route.steps) {
        const stocked = step.options.find((node) => node.shop)?.shop;
        if (stocked) return stocked;
      }
    }
  }
  return null;
}

/** The generated event with the most prose across its choices, drawn from a keyed stream. */
export function wordiestEvent(seed: string): EventInstance {
  let best: EventInstance | null = null;
  let bestLength = -1;
  for (let index = 0; index < 40; index++) {
    const event = generateEvent('gallery', createRng(`${seed}-EVT-${index}`).rewards.at('e'), DEFAULT_TUNING);
    const length = event.prompt.length + event.choices.reduce((total, choice) => total + choice.label.length + choice.hint.length, 0);
    if (length > bestLength) {
      best = event;
      bestLength = length;
    }
  }
  if (!best) throw new Error('no event generated');
  return best;
}

/** A move that teaches: the target and replace screens' incoming card. */
export function incomingMove(): MoveSpec {
  const move = describeMove('Earthquake');
  if (!move) throw new Error('Earthquake is not in the dex');
  return move;
}

export function targetedReward(): TargetedReward {
  return { kind: 'tm', move: incomingMove().name };
}
