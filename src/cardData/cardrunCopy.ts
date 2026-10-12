/**
 * Every word the card run's own screens show (`ui/cardrun/`), and the few the
 * battle screen adds in a run, in one table per language. English is the
 * source; every other language is a table of the same shape in
 * `cardData/translations/run/`, machine-drafted and not yet read by a native
 * speaker (`docs/spec/gymrun-patch-card-run-translations.md`). Card, unit,
 * enemy and scenario names go through `nameOf`, as in the battle.
 *
 * `RUN_COPY` is a live binding, swapped with the battle's by
 * `setCardLanguage` (`copy.ts`), so the run and its battles are always in the
 * same language. The run log is JSON and is never translated.
 *
 * Outside the design bible, like the battle (`docs/spec/gymrun-card-battle-engine-rulings.md`).
 */
import type { RunRefusal } from '../core/cards/cardrun';
import type { BoostKind } from './cardrunTables';
import type { CardLanguage } from './copy';
import { RUN_DE } from './translations/run/de';
import { RUN_ES } from './translations/run/es';
import { RUN_FR } from './translations/run/fr';
import { RUN_JA } from './translations/run/ja';
import { RUN_UK } from './translations/run/uk';
import { RUN_ZH_HANS } from './translations/run/zh-Hans';
import { RUN_ZH_HANT } from './translations/run/zh-Hant';

const EN = {
  title: 'Card Run',
  tagline: 'Three acts. A stop between every fight. A Colossus at the end of each.',
  newRun: 'New run',
  continueRun: 'Continue run',
  sandbox: 'Sandbox',
  /** The battle screen's tutorial (`ui/cardbattle/coach.ts`), against the Target Dummy. */
  tutorial: 'Tutorial',
  seed: (seed: string) => `Seed ${seed}`,
  act: (n: number, of: number) => `Act ${n}/${of}`,
  /**
   * What an act does to its fights (`ACT_SCALING`, checkpoint 6), read off the
   * table: on the route screen, the run's battle screen and the progress strip
   * (step 7a). Empty for an act that changes nothing.
   */
  actScaling: (n: number, hp: number, veterans: 'none' | 'leads' | 'all') => {
    const parts = [hp > 0 ? `enemies +${hp} HP` : '', { none: '', leads: 'veterans in the first two waves', all: 'veterans in every wave' }[veterans]].filter(Boolean);
    return parts.length > 0 ? `Act ${n}: ${parts.join(', ')}` : '';
  },
  /** The same, short, on the progress strip where the act begins. */
  actChip: (hp: number, veterans: 'none' | 'leads' | 'all') => [hp > 0 ? `+${hp} HP` : '', veterans === 'none' ? '' : 'veterans'].filter(Boolean).join(' · '),
  fight: (n: number) => `Fight ${n}`,
  supplies: 'Supplies',
  suppliesN: (n: number) => `${n} supplies`,
  plusSupplies: (n: number) => `+${n} supplies`,
  deck: (n: number) => `Deck ${n}`,
  /** The deck view's groups (step 7a), each with its count. The shapes' names are `SHAPES`'s. */
  group: { basic: 'Basic', equipment: 'Equipment', other: 'Other' },
  groupCount: (name: string, n: number) => `${name} · ${n}`,
  team: 'Team',
  slots: (n: number) => `${n} slot${n === 1 ? '' : 's'}`,
  hp: (n: number) => `${n} HP`,
  base: (n: number) => `Base ${n}`,
  mp: (n: number) => `+${n} MP`,
  close: 'Close',
  back: 'Back',
  cancel: 'Cancel',
  /** The progress strip's node kinds, for a screen reader. */
  node: { fight: 'Fight', boss: 'Boss', stop: 'Stop', here: 'you are here', done: 'done' },
  route: {
    heading: 'Choose your stop',
    city: 'City',
    cityWhat: 'Buy equipment, or take a defense quest for a card upgrade.',
    town: 'Town',
    townWhat: 'A quest battle. Reward: supplies and a new card.',
    wild: 'Wild',
    wildWhat: 'Extra supplies, enough for an upgrade. Maybe a ? event.',
    quest: (name: string) => `Quest: ${name}`,
    reward: 'Reward',
    pickOne: 'pick one of',
    maybeEvent: 'Chance of a ? event',
    next: (name: string) => `Then: ${name}`,
  },
  city: {
    heading: 'City',
    market: 'Market',
    marketWhat: 'Equipment: use once, then it is gone.',
    defend: 'Defense quest',
    defendWhat: (name: string) => `${name}. Reward: upgrade one card.`,
  },
  market: {
    heading: 'Market',
    buy: (price: number) => `Buy · ${price}`,
    bought: 'Bought',
    cannotPay: 'Not enough supplies',
    leave: 'Leave the city',
  },
  camp: {
    heading: 'Camp',
    upgrade: (price: number) => `Upgrade a card · ${price} supplies`,
    cannotPay: (price: number) => `Upgrade a card · needs ${price} supplies`,
    none: 'No card left to upgrade',
    pick: 'Pick a card to upgrade',
  },
  cards: {
    heading: 'Pick a card',
    town: 'The town pays you in cards.',
    ambush: 'The raiders dropped their loot.',
    take: 'Take',
  },
  upgrade: {
    heading: 'Upgrade a card',
    defense: 'The city thanks you: upgrade one card, free.',
    smith: 'The smith sharpens one card, free.',
    becomes: 'becomes',
  },
  replace: {
    heading: 'Make room',
    /** A starting deck card's mark: they are listed first. */
    basic: 'Basic',
    what: (card: string) => `${card} goes in place of the card you pick. Your deck stays the same size.`,
  },
  remove: {
    heading: 'Leave a card',
    what: 'The card stays at the shrine for the rest of the run.',
  },
  wild: {
    heading: 'Wild',
    gained: (n: number) => `You forage ${n} supplies.`,
    quiet: 'Nothing else stirs.',
    leave: 'Move on',
    why: { cannotPay: 'Not enough supplies', notUpgradable: 'No card left to upgrade', deckTooSmall: 'Your deck is too small' },
  },
  boost: {
    heading: 'The boss falls',
    what: 'Upgrade one unit for the rest of the run.',
    kind: {
      slots: (n: number) => `+${n} card slot`,
      hp: (n: number) => `+${n} max HP`,
      baseShield: (n: number) => `+${n} base shield`,
      mp: (n: number) => `+${n} MP at the start of each fight`,
    } satisfies Record<BoostKind, (n: number) => string>,
    talent: 'Talent',
    /** A talent's shape (step 7a); Marksman is the Gunner's own, given back. */
    givenBack: 'Given back',
    has: (talents: string) => `Has: ${talents}`,
    hasNone: 'No talent yet',
  },
  battle: {
    heading: (kind: string) => kind,
    kind: { main: 'Fight', boss: 'Boss fight', town: 'Town quest', defense: 'Defense quest', ambush: 'Ambush' },
    resume: 'Return to the battle',
  },
  over: {
    won: 'The run is won',
    lost: 'The run is over',
    stats: (fights: number, bosses: number, quests: number, upgrades: number) =>
      `${fights} fights won · ${bosses} bosses · ${quests} quests · ${upgrades} upgrades`,
    reached: (where: string) => `Reached: ${where}`,
    /** Step 7a: the act the run fell in, the shape it leaned into and the talents it took. */
    fellIn: (act: number, of: number, where: string) => `Fell in act ${act}/${of}: ${where}`,
    leaned: (shapes: string, n: number) => `Leaned into: ${shapes}, ${n} card${n === 1 ? '' : 's'}`,
    leanedNone: 'Leaned into no shape',
    talents: (list: string) => `Talents: ${list}`,
    talentsNone: 'No talents taken',
  },
  /** On the battle screen, in a run. */
  inBattle: {
    toRun: 'Run',
    continue: 'Continue',
    runOver: 'See the run',
    equipment: 'Equipment: once used, gone for the run',
  },
  owner: { neutral: 'Neutral', equipment: 'Equipment' },
  /** What the character at a screen's foot says (the mock's speech bubbles): flavour, the same every time. */
  says: {
    cards: 'Take something useful for the road ahead!',
    market: 'Take a look! Good gear makes the road easier.',
    city: 'Take a look! Good gear makes the road easier.',
    replace: 'Choose a card to replace.',
  },
  /** A save from another build does not replay; it is dropped and this says so. */
  staleSave: 'The saved run is from another version and cannot be resumed.',
  copied: 'Run log copied',
  copyLog: 'Copy run log',
  abandon: 'Abandon run',
  abandonConfirm: 'Abandon this run? It cannot be resumed.',
  /** Why the run would not take a tap. The screen disables what it can; these say why when it could not. */
  refusal: {
    malformed: 'That is not something the run can do.',
    runOver: 'The run is over.',
    wrongScreen: 'Not now.',
    badIndex: 'That option is not there.',
    cannotPay: 'Not enough supplies.',
    alreadyBought: 'Already bought.',
    notUpgradable: 'That card has no upgrade left.',
    deckTooSmall: 'Your deck is too small to lose a card.',
    battleRefused: 'The battle would not take that.',
  } satisfies Record<RunRefusal, string>,
  /**
   * The lines the run's tables carry that a run screen shows, keyed by their
   * English text: the shapes' names and plans, the ? events' names, texts and
   * options, the talents' texts and the bosses' blurbs. English leaves it
   * empty and reads the data.
   */
  text: {} as Record<string, string>,
};

/** The shape every language fills. */
export type RunCopy = typeof EN;

export const RUN_COPY_BY_LANGUAGE: Record<CardLanguage, RunCopy> = {
  en: EN,
  'zh-Hant': RUN_ZH_HANT,
  'zh-Hans': RUN_ZH_HANS,
  ja: RUN_JA,
  de: RUN_DE,
  uk: RUN_UK,
  es: RUN_ES,
  fr: RUN_FR,
};

// A live binding, reassigned only by `setRunLanguage`, which `setCardLanguage` calls.
export let RUN_COPY: RunCopy = EN;

export function setRunLanguage(language: CardLanguage): void {
  RUN_COPY = RUN_COPY_BY_LANGUAGE[language];
}

/** A line from the run's tables in the current language, or as the data has it. */
export function textOf(english: string): string {
  return RUN_COPY.text[english] ?? english;
}
