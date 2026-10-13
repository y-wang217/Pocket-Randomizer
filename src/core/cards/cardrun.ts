/**
 * The card run (`docs/spec/gymrun-card-run-prompt.md`): the scenarios stitched
 * into one run of three acts, each two fights and a boss, with a stop between
 * every two fights where the player picks a City, a Town or the Wild. Beating
 * a boss upgrades one unit for the rest of the run.
 *
 * Like a battle, a run is plain JSON and `stepRun` is its reducer: state and
 * action in, state out, a typed refusal and the untouched state for anything
 * it will not do, never a throw. A battle inside the run is the battle
 * engine's own state, stepped by the battle engine's own `step`.
 *
 * Every draw a run makes is made by `createRun`, in one pass, for every node,
 * the stops the player will never visit included (`CLAUDE.md`, Randomness):
 * each stop's market, quests, card offers, supplies and ? event, each fight's
 * battle seed, each boss's upgrade offers. A key names the node, never the
 * moment, so which stop the player picks moves no other stop's draw. Player
 * decisions draw nothing.
 *
 * Every number lives in `cardData/cardrunTables.ts`.
 */
import { CARDS, UPGRADE_OF } from '../../cardData/cards';
import {
  ACTS,
  BOOST_AMOUNT,
  BOOST_UNITS,
  BOOST_WEIGHTS,
  EVENTS,
  MARKET,
  MARKET_FROM,
  RUN_RULES,
  SHAPES,
  STARTING_DECK,
  TOWN_POOL,
  type ShapeId,
  type BoostKind,
  type EventOption,
} from '../../cardData/cardrunTables';
import { GIVEN_BACK, TALENT_OFFERS, TALENTS } from '../../cardData/talents';
import { createRng, formatSeed, type RngStream } from '../rng';
import { cardRunKey } from '../streamKeys';
import { createBattle } from './create';
import type { Loadout, UnitBoost, UnitDefId } from './defs';
import type { BattleEvent } from './events';
import { shuffled } from './random';
import type { Action, BattleState } from './state';
import { step } from './step';

/** Bumps when a run's draws, its tables' meaning or a logged decision changes what a run log replays to. */
export const CARD_RUN_VERSION = 'cardrun-0.16.0';

export type StopKind = 'city' | 'town' | 'wild';

/** A stat a boss offers: this unit gets this much more of it for the rest of the run. */
export interface StatOffer {
  unit: UnitDefId;
  kind: BoostKind;
  n: number;
}

/**
 * One boss upgrade on offer: a stat, or a talent for its unit. A node holds
 * the stats and the talent order it drew; the boss screen picks among them by
 * what the run has already taken (`offersFor`).
 */
export type BoostOffer = StatOffer | { unit: UnitDefId; kind: 'talent'; talent: string };

/** A fight a stop can send the player on, with the battle seed drawn for it. */
export interface QuestDraw {
  encounter: string;
  seed: string;
}

export interface FightNode {
  kind: 'fight';
  /** Its place in the run, the stream key's node part: `a1/f0`, `a1/boss`. */
  key: string;
  /** From 0. */
  act: number;
  encounter: string;
  seed: string;
  boss: boolean;
  /** A boss's stat offers, one drawn per unit; none on the last boss, whose fall ends the run. */
  boosts: StatOffer[];
  /** Every talent, in the order this boss offers them (5a); empty on the last boss. */
  talentOrder: string[];
}

export interface StopNode {
  kind: 'stop';
  key: string;
  act: number;
  /** A market of equipment, or a defense quest whose reward is a card upgrade. */
  city: { market: { card: string; price: number }[]; defense: QuestDraw };
  /**
   * Whether the City is open at this stop. The stop between a floor's two
   * fights has none (the author's ruling of 2026-10-13); its City is drawn all
   * the same, so no other draw moves.
   */
  cityOpen: boolean;
  /** A quest whose reward is supplies and one of three new cards. */
  town: { quest: QuestDraw; supplies: number; offer: string[] };
  /**
   * Supplies enough for one upgrade at least, and perhaps a ? event. What
   * each event could hand over is drawn whichever event it is, or none.
   */
  wild: { supplies: number; event: string | null; equipment: string; card: string; ambush: QuestDraw; offer: string[] };
}

export type RunNode = FightNode | StopNode;

/** Why a fight is being fought, which decides what winning it pays. */
export type FightKind = 'main' | 'boss' | 'town' | 'defense' | 'ambush';

/** The decision the run is waiting on. */
export type RunScreen =
  | { k: 'battle'; kind: FightKind }
  /** At a stop: City, Town or Wild. The camp's paid upgrade is open here too. */
  | { k: 'route' }
  /** In a City: its market, or its defense quest. */
  | { k: 'city' }
  /** Buying equipment; `bought` holds the market's indices already bought. */
  | { k: 'market'; bought: number[] }
  /** One of three cards, no skip (`CLAUDE.md`, Rewards). */
  | { k: 'cards'; offer: string[]; source: 'town' | 'ambush' }
  /** The card taken goes in place of a deck card the player picks: the deck never grows from a card reward. */
  | { k: 'replace'; card: string; source: 'town' | 'ambush' | 'peddler' }
  /** A free upgrade: pick the card. */
  | { k: 'upgrade'; source: 'defense' | 'smith' }
  /** The shrine: pick the card to leave. */
  | { k: 'remove' }
  /** In the Wild: its supplies are paid; its event, if it has one, waits on a choice. */
  | { k: 'wild'; gained: number }
  /** A boss fell: one of its three upgrades. */
  | { k: 'boost'; offers: BoostOffer[] }
  | { k: 'over'; won: boolean };

export interface RunBattle {
  kind: FightKind;
  encounter: string;
  seed: string;
  loadout: Loadout;
  state: BattleState;
  /** Every action the battle accepted, in order: with the seed, encounter and loadout, its battle log. */
  actions: Action[];
}

export interface CardRunState {
  version: string;
  seed: string;
  nodes: RunNode[];
  /** The node the player is on. */
  at: number;
  /** Card definition ids, in the order a battle's draw pile is dealt before its shuffle. */
  deck: string[];
  supplies: number;
  boosts: Record<UnitDefId, UnitBoost>;
  screen: RunScreen;
  /** The stop chosen at the node the player is on, while it is being resolved. */
  stop: StopKind | null;
  battle: RunBattle | null;
  /** Counts for the end screen. */
  stats: { fights: number; bosses: number; quests: number; upgrades: number };
}

export type RunAction =
  | { type: 'battle'; action: Action }
  | { type: 'go'; to: StopKind }
  /** In a City. */
  | { type: 'market' }
  | { type: 'defend' }
  | { type: 'buy'; index: number }
  /** A card offer's or a boss upgrade's index. */
  | { type: 'pick'; index: number }
  /** A deck index: free on an upgrade screen, paid at the camp. */
  | { type: 'upgrade'; index: number }
  | { type: 'remove'; index: number }
  /** A deck index: the card a reward card goes in place of. */
  | { type: 'replace'; index: number }
  | { type: 'event'; option: number }
  /** Done at the market, or done in a Wild with no event. */
  | { type: 'leave' };

export type RunRefusal =
  | 'malformed'
  | 'runOver'
  | 'wrongScreen'
  | 'badIndex'
  /** A stated price the run cannot pay: never charged in part, never waived. */
  | 'cannotPay'
  /** The City at a stop that has none: between a floor's two fights. */
  | 'noCity'
  | 'alreadyBought'
  | 'notUpgradable'
  | 'deckTooSmall'
  /** The battle engine refused the action; `battleReason` says why. */
  | 'battleRefused';

export type RunResult =
  | { ok: true; state: CardRunState; battleEvents: BattleEvent[] }
  | { ok: false; state: CardRunState; reason: RunRefusal; battleReason?: string };

// ------------------------------------------------------------------ generation

function streamFor(seed: string, node: string, what: string): RngStream {
  return createRng(seed).map.at(cardRunKey(node, what));
}

function battleSeed(seed: string, node: string, what: string): string {
  return formatSeed(streamFor(seed, node, what));
}

function pickOne<T>(stream: RngStream, items: readonly T[]): T {
  return items[stream.nextInt(items.length)]!;
}

function distinct(stream: RngStream, items: readonly string[], n: number): string[] {
  return shuffled(stream, items).slice(0, n);
}

function between(stream: RngStream, range: { min: number; max: number }): number {
  return range.min + stream.nextInt(range.max - range.min + 1);
}

function weighted<K extends string>(stream: RngStream, weights: Readonly<Record<K, number>>): K {
  const entries = Object.entries(weights) as [K, number][];
  let roll = stream.nextInt(entries.reduce((sum, [, w]) => sum + w, 0));
  for (const [kind, w] of entries) {
    if (roll < w) return kind;
    roll -= w;
  }
  return entries.at(-1)![0];
}

/**
 * A card offer (5b): three of the four shapes, drawn, then one card from each.
 * The shapes share no card, so the three are distinct.
 */
function shapedOffer(stream: RngStream): string[] {
  return shuffled(stream, Object.keys(SHAPES)).slice(0, RUN_RULES.offer).map((id) => pickOne(stream, SHAPES[id as ShapeId].cards));
}

function quest(seed: string, node: string, what: string, pool: readonly string[]): QuestDraw {
  return { encounter: pickOne(streamFor(seed, node, what), pool), seed: battleSeed(seed, node, `${what}/battle`) };
}

function stopNode(seed: string, act: number, index: number): StopNode {
  const key = `a${act + 1}/s${index}`;
  const def = ACTS[act]!;
  const sold = Object.keys(MARKET).filter((card) => (MARKET_FROM[card] ?? 0) <= act);
  const market = distinct(streamFor(seed, key, 'market'), sold, RUN_RULES.offer).map((card) => ({ card, price: MARKET[card]! }));
  const wild = streamFor(seed, key, 'wild');
  const supplies = between(wild, RUN_RULES.wild.supplies);
  const rolled = wild.nextFloat() < RUN_RULES.wild.eventChance;
  const event = pickOne(wild, Object.keys(EVENTS));
  return {
    kind: 'stop',
    key,
    act,
    city: { market, defense: quest(seed, key, 'defense', def.defenseQuests) },
    cityOpen: index !== 0,
    town: {
      quest: quest(seed, key, 'town', def.townQuests),
      supplies: between(streamFor(seed, key, 'town/supplies'), RUN_RULES.town.supplies),
      offer: shapedOffer(streamFor(seed, key, 'town/offer')),
    },
    wild: {
      supplies,
      event: rolled ? event : null,
      equipment: pickOne(streamFor(seed, key, 'wild/equipment'), sold),
      card: pickOne(streamFor(seed, key, 'wild/card'), TOWN_POOL),
      ambush: quest(seed, key, 'ambush', def.townQuests),
      offer: shapedOffer(streamFor(seed, key, 'ambush/offer')),
    },
  };
}

function fightNode(seed: string, act: number, index: 0 | 1 | 'boss'): FightNode {
  const def = ACTS[act]!;
  const boss = index === 'boss';
  const key = `a${act + 1}/${boss ? 'boss' : `f${index}`}`;
  const last = act === ACTS.length - 1;
  const stream = streamFor(seed, key, 'boosts');
  // Every boss draws its offers, the last one's included, so no count depends on which boss it is.
  const boosts = BOOST_UNITS.map((unit) => {
    const kind = weighted(stream, BOOST_WEIGHTS);
    return { unit, kind, n: BOOST_AMOUNT[kind] };
  });
  // Its own stream, so the stats above draw as they did before talents had an order.
  const talentOrder = shuffled(streamFor(seed, key, 'talents'), Object.keys(TALENTS));
  return {
    kind: 'fight',
    key,
    act,
    encounter: index === 'boss' ? def.boss : def.fights[index],
    seed: battleSeed(seed, key, 'battle'),
    boss,
    boosts: boss && !last ? boosts : [],
    talentOrder: boss && !last ? talentOrder : [],
  };
}

/** Every node of a run, in order, every draw made. */
export function generateRun(seed: string): RunNode[] {
  const nodes: RunNode[] = [];
  ACTS.forEach((_, act) => {
    nodes.push(fightNode(seed, act, 0), stopNode(seed, act, 0), fightNode(seed, act, 1), stopNode(seed, act, 1), fightNode(seed, act, 'boss'));
    // A stop between acts too, but none after the last boss.
    if (act < ACTS.length - 1) nodes.push(stopNode(seed, act, 2));
  });
  return nodes;
}

/** A new run on a seed, on its first fight's deployment. */
export function createRun(seed: string, deck: readonly string[] = startingDeck()): CardRunState {
  const s: CardRunState = {
    version: CARD_RUN_VERSION,
    seed,
    nodes: generateRun(seed),
    at: 0,
    deck: [...deck],
    supplies: RUN_RULES.supplies.start,
    boosts: { A: {}, B: {}, C: {} },
    screen: { k: 'route' },
    stop: null,
    battle: null,
    stats: { fights: 0, bosses: 0, quests: 0, upgrades: 0 },
  };
  enter(s);
  return s;
}

/** The basic ten (`STARTING_DECK`): the Puppeteer is built toward, not dealt. */
export function startingDeck(): string[] {
  return [...STARTING_DECK];
}

// ------------------------------------------------------------------ reading

export function currentNode(s: CardRunState): RunNode | undefined {
  return s.nodes[s.at];
}

export function currentStop(s: CardRunState): StopNode | null {
  const node = currentNode(s);
  return node?.kind === 'stop' ? node : null;
}

/** The deck indices a card upgrade can take: cards with an upgrade not yet taken. */
export function upgradable(s: CardRunState): number[] {
  return s.deck.flatMap((id, index) => (UPGRADE_OF[id] ? [index] : []));
}

/** What the camp charges for an upgrade, and whether the run can pay it now. */
export function campPrice(s: CardRunState): { price: number; payable: boolean } {
  const price = RUN_RULES.upgradePrice;
  return { price, payable: s.supplies >= price && upgradable(s).length > 0 };
}

/** The screens on which the camp's paid upgrade is open. */
export function campOpen(s: CardRunState): boolean {
  return s.screen.k === 'route' || s.screen.k === 'market' || s.screen.k === 'wild';
}

/**
 * Whether a ? event option can be taken: its price can be paid, and a card
 * it asks for exists. Read only from what the player sees: the supplies and
 * the deck, never anything drawn.
 */
export function eventOptionOpen(s: CardRunState, option: EventOption): { open: boolean; why?: 'cannotPay' | 'notUpgradable' | 'deckTooSmall' } {
  if (option.price !== undefined && s.supplies < option.price) return { open: false, why: 'cannotPay' };
  if (option.effects.some((e) => e.k === 'upgrade') && upgradable(s).length === 0) return { open: false, why: 'notUpgradable' };
  if (option.effects.some((e) => e.k === 'remove') && s.deck.length <= RUN_RULES.minDeck) return { open: false, why: 'deckTooSmall' };
  return { open: true };
}

/** Which act and which fight of it the player is on, from 1, for a progress line. */
export function progressOf(s: CardRunState): { act: number; acts: number; fight: number } {
  const node = currentNode(s) ?? s.nodes.at(-1)!;
  const fights = s.nodes.slice(0, s.at + 1).filter((n) => n.kind === 'fight' && n.act === node.act).length;
  return { act: node.act + 1, acts: ACTS.length, fight: Math.max(1, fights) };
}

/**
 * A fallen boss's three offers (5a): two talents, then a stat. Marksman comes
 * first while it is untaken (the Gunner's ability, given back), then the
 * untaken talents in the order the boss drew; the stat is the one the node
 * drew for a unit neither talent is for. Talents run out before they could
 * fill both slots only on a run that took nearly all of them, and stats fill
 * in. Everything is drawn at generation, so what the player took moves no
 * draw; it only selects among what was drawn.
 */
export function offersFor(s: CardRunState, node: FightNode): BoostOffer[] {
  const taken = (t: string): boolean => (s.boosts[TALENTS[t]!.unit].talents ?? []).includes(t);
  const order = [GIVEN_BACK, ...node.talentOrder.filter((t) => t !== GIVEN_BACK)].filter((t) => !taken(t));
  const talents: BoostOffer[] = order.slice(0, TALENT_OFFERS).map((t) => ({ unit: TALENTS[t]!.unit, kind: 'talent', talent: t }));
  const covered = new Set(talents.map((o) => o.unit));
  const stats = [...node.boosts.filter((o) => !covered.has(o.unit)), ...node.boosts.filter((o) => covered.has(o.unit))];
  return [...talents, ...stats].slice(0, RUN_RULES.offer);
}

/** The boosts a battle carries: only the units the run has boosted. */
export function loadoutOf(s: CardRunState): Loadout {
  const units = Object.fromEntries(Object.entries(s.boosts).filter(([, b]) => Object.keys(b).length > 0)) as Loadout['units'];
  return { cards: [...s.deck], ...(units && Object.keys(units).length > 0 ? { units } : {}) };
}

// ------------------------------------------------------------------ stepping

function clone(s: CardRunState): CardRunState {
  return JSON.parse(JSON.stringify(s)) as CardRunState;
}

function startBattle(s: CardRunState, kind: FightKind, encounter: string, seed: string): void {
  const loadout = loadoutOf(s);
  const created = createBattle(encounter, seed, loadout);
  // A table naming an encounter or card that does not exist is a broken build, not a decision.
  if (!created.ok) throw new Error(`card run: cannot lay out ${encounter} with this deck`);
  s.battle = { kind, encounter, seed, loadout, state: created.state, actions: [] };
  s.screen = { k: 'battle', kind };
}

/** Enter the node the player is now on. */
function enter(s: CardRunState): void {
  s.stop = null;
  s.battle = null;
  const node = currentNode(s);
  if (!node) {
    s.screen = { k: 'over', won: true };
    return;
  }
  if (node.kind === 'fight') startBattle(s, node.boss ? 'boss' : 'main', node.encounter, node.seed);
  else s.screen = { k: 'route' };
}

function advance(s: CardRunState): void {
  s.at += 1;
  enter(s);
}

/** Equipment a battle used up leaves the run's deck: its instance `c{i}` is deck entry `i`. */
function consumeEquipment(s: CardRunState, battle: BattleState): void {
  const used = new Set(
    battle.piles.spent.filter((iid) => CARDS[battle.cards[iid]!.def]!.equipment).map((iid) => Number(iid.slice(1))),
  );
  s.deck = s.deck.filter((_, index) => !used.has(index));
}

function battleWon(s: CardRunState, battle: RunBattle): void {
  consumeEquipment(s, battle.state);
  // The supplies the battle's wave packs paid (the author's answer of 2026-10-13).
  s.supplies += battle.state.suppliesWon;
  s.stats.fights += 1;
  const stop = currentStop(s);
  switch (battle.kind) {
    case 'main':
      s.supplies += RUN_RULES.supplies.fight;
      advance(s);
      return;
    case 'boss': {
      s.supplies += RUN_RULES.supplies.boss;
      s.stats.bosses += 1;
      const node = currentNode(s) as FightNode;
      s.battle = null;
      if (node.boosts.length > 0) s.screen = { k: 'boost', offers: offersFor(s, node) };
      else advance(s);
      return;
    }
    case 'town':
      s.stats.quests += 1;
      s.supplies += stop!.town.supplies;
      s.battle = null;
      s.screen = { k: 'cards', offer: stop!.town.offer, source: 'town' };
      return;
    case 'defense':
      s.stats.quests += 1;
      s.battle = null;
      if (upgradable(s).length > 0) s.screen = { k: 'upgrade', source: 'defense' };
      else advance(s);
      return;
    case 'ambush':
      s.battle = null;
      s.screen = { k: 'cards', offer: stop!.wild.offer, source: 'ambush' };
      return;
  }
}

function upgradeAt(s: CardRunState, index: number): boolean {
  const next = UPGRADE_OF[s.deck[index] ?? ''];
  if (!next) return false;
  s.deck[index] = next;
  s.stats.upgrades += 1;
  return true;
}

const isIndex = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** The run's reducer. Never throws on any action; a refusal hands back the very state it was given. */
export function stepRun(state: CardRunState, action: RunAction | unknown): RunResult {
  const refuse = (reason: RunRefusal, battleReason?: string): RunResult => ({ ok: false, state, reason, ...(battleReason ? { battleReason } : {}) });
  if (typeof action !== 'object' || action === null) return refuse('malformed');
  const a = action as Partial<Record<string, unknown>> & { type?: unknown };
  if (state.screen.k === 'over') return refuse('runOver');
  const screen = state.screen;

  if (a.type === 'battle') {
    if (screen.k !== 'battle' || !state.battle) return refuse('wrongScreen');
    const result = step(state.battle.state, a.action);
    if (!result.ok) return refuse('battleRefused', result.reason);
    const s = clone({ ...state, battle: null });
    const battle: RunBattle = { ...state.battle, state: result.state, actions: [...state.battle.actions, a.action as Action] };
    s.battle = battle;
    if (result.state.phase === 'won') battleWon(s, battle);
    else if (result.state.phase === 'lost') s.screen = { k: 'over', won: false };
    return { ok: true, state: s, battleEvents: result.events };
  }

  const s = clone(state);
  const stop = currentStop(s);
  const done = (): RunResult => ({ ok: true, state: s, battleEvents: [] });

  switch (a.type) {
    case 'go': {
      if (screen.k !== 'route' || !stop) return refuse('wrongScreen');
      if (a.to === 'city') {
        if (!stop.cityOpen) return refuse('noCity');
        s.stop = 'city';
        s.screen = { k: 'city' };
      } else if (a.to === 'town') {
        s.stop = 'town';
        startBattle(s, 'town', stop.town.quest.encounter, stop.town.quest.seed);
      } else if (a.to === 'wild') {
        s.stop = 'wild';
        s.supplies += stop.wild.supplies;
        s.screen = { k: 'wild', gained: stop.wild.supplies };
      } else return refuse('malformed');
      return done();
    }
    case 'market':
      if (screen.k !== 'city') return refuse('wrongScreen');
      s.screen = { k: 'market', bought: [] };
      return done();
    case 'defend':
      if (screen.k !== 'city' || !stop) return refuse('wrongScreen');
      startBattle(s, 'defense', stop.city.defense.encounter, stop.city.defense.seed);
      return done();
    case 'buy': {
      if (screen.k !== 'market' || !stop) return refuse('wrongScreen');
      if (!isIndex(a.index)) return refuse('malformed');
      const item = stop.city.market[a.index];
      if (!item) return refuse('badIndex');
      if (screen.bought.includes(a.index)) return refuse('alreadyBought');
      if (s.supplies < item.price) return refuse('cannotPay');
      s.supplies -= item.price;
      s.deck.push(item.card);
      s.screen = { k: 'market', bought: [...screen.bought, a.index] };
      return done();
    }
    case 'pick': {
      if (!isIndex(a.index)) return refuse('malformed');
      if (screen.k === 'cards') {
        const card = screen.offer[a.index];
        if (!card) return refuse('badIndex');
        s.screen = { k: 'replace', card, source: screen.source };
        return done();
      }
      if (screen.k === 'boost') {
        const offer = screen.offers[a.index];
        if (!offer) return refuse('badIndex');
        const boost = s.boosts[offer.unit];
        if (offer.kind === 'talent') boost.talents = [...(boost.talents ?? []), offer.talent];
        else boost[offer.kind] = (boost[offer.kind] ?? 0) + offer.n;
        advance(s);
        return done();
      }
      return refuse('wrongScreen');
    }
    case 'upgrade': {
      if (!isIndex(a.index)) return refuse('malformed');
      if (a.index >= s.deck.length) return refuse('badIndex');
      if (!UPGRADE_OF[s.deck[a.index]!]) return refuse('notUpgradable');
      if (screen.k === 'upgrade') {
        upgradeAt(s, a.index);
        advance(s);
        return done();
      }
      if (!campOpen(s)) return refuse('wrongScreen');
      if (s.supplies < RUN_RULES.upgradePrice) return refuse('cannotPay');
      s.supplies -= RUN_RULES.upgradePrice;
      upgradeAt(s, a.index);
      return done();
    }
    case 'remove': {
      if (screen.k !== 'remove') return refuse('wrongScreen');
      if (!isIndex(a.index)) return refuse('malformed');
      if (a.index >= s.deck.length) return refuse('badIndex');
      if (s.deck.length <= RUN_RULES.minDeck) return refuse('deckTooSmall');
      s.deck.splice(a.index, 1);
      advance(s);
      return done();
    }
    case 'replace': {
      if (screen.k !== 'replace') return refuse('wrongScreen');
      if (!isIndex(a.index)) return refuse('malformed');
      if (a.index >= s.deck.length) return refuse('badIndex');
      s.deck[a.index] = screen.card;
      advance(s);
      return done();
    }
    case 'event': {
      if (screen.k !== 'wild' || !stop?.wild.event) return refuse('wrongScreen');
      if (!isIndex(a.option)) return refuse('malformed');
      const option = EVENTS[stop.wild.event]!.options[a.option];
      if (!option) return refuse('badIndex');
      const gate = eventOptionOpen(s, option);
      if (!gate.open) return refuse(gate.why!);
      if (option.price !== undefined) s.supplies -= option.price;
      for (const effect of option.effects) {
        switch (effect.k) {
          case 'supplies':
            s.supplies += effect.n;
            break;
          case 'equipment':
            s.deck.push(stop.wild.equipment);
            break;
          case 'card':
            s.screen = { k: 'replace', card: stop.wild.card, source: 'peddler' };
            return done();
          case 'upgrade':
            s.screen = { k: 'upgrade', source: 'smith' };
            return done();
          case 'remove':
            s.screen = { k: 'remove' };
            return done();
          case 'fight':
            startBattle(s, 'ambush', stop.wild.ambush.encounter, stop.wild.ambush.seed);
            return done();
        }
      }
      advance(s);
      return done();
    }
    case 'leave':
      if (screen.k === 'market') {
        advance(s);
        return done();
      }
      if (screen.k === 'wild' && stop && !stop.wild.event) {
        advance(s);
        return done();
      }
      return refuse('wrongScreen');
    default:
      return refuse('malformed');
  }
}

// ------------------------------------------------------------------ the log

export interface RunLog {
  version: string;
  seed: string;
  actions: RunAction[];
}

export function newRunLog(seed: string): RunLog {
  return { version: CARD_RUN_VERSION, seed, actions: [] };
}

/**
 * A run again from its log. Throws, loudly, on a version mismatch, naming both
 * values, or on an action the run refuses: a log that does not replay is a
 * bug report, never something to reinterpret.
 */
export function replayRun(log: RunLog): CardRunState {
  if (log.version !== CARD_RUN_VERSION) {
    throw new Error(`card run version mismatch: the log was written by ${log.version}, this build is ${CARD_RUN_VERSION}`);
  }
  let state = createRun(log.seed);
  log.actions.forEach((action, index) => {
    const result = stepRun(state, action);
    if (!result.ok) throw new Error(`the run log does not replay: action ${index} (${JSON.stringify(action)}) refused: ${result.reason}${result.battleReason ? ` (${result.battleReason})` : ''}`);
    state = result.state;
  });
  return state;
}
