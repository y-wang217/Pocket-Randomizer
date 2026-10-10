/**
 * Every word the card run's own screens show (`ui/cardrun/`), and the few the
 * battle screen adds in a run. English only for now: the battle's eight
 * languages (`copy.ts`) cover the battle, and these wait for the same
 * machine draft once the words settle in a playtest. Card, unit, enemy and
 * scenario names still go through `nameOf`, so they are translated wherever
 * a translation exists.
 *
 * Outside the design bible, like the battle (`docs/spec/gymrun-card-battle-engine-rulings.md`).
 */
import type { RunRefusal } from '../core/cards/cardrun';
import type { BoostKind } from './cardrunTables';

export const RUN_COPY = {
  title: 'Card Run',
  tagline: 'Three acts. A stop between every fight. A Colossus at the end of each.',
  newRun: 'New run',
  continueRun: 'Continue run',
  sandbox: 'Sandbox',
  seed: (seed: string) => `Seed ${seed}`,
  act: (n: number, of: number) => `Act ${n}/${of}`,
  fight: (n: number) => `Fight ${n}`,
  supplies: 'Supplies',
  suppliesN: (n: number) => `${n} supplies`,
  plusSupplies: (n: number) => `+${n} supplies`,
  deck: (n: number) => `Deck ${n}`,
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
  },
  /** On the battle screen, in a run. */
  inBattle: {
    toRun: 'Run',
    continue: 'Continue',
    runOver: 'See the run',
    equipment: 'Equipment: once used, gone for the run',
  },
  owner: { neutral: 'Neutral', equipment: 'Equipment' },
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
};
