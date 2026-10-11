/**
 * Every word the card battle sandbox shows a player, in one table per
 * language. The sandbox is outside the design bible
 * (`docs/spec/gymrun-card-battle-engine-rulings.md`), so these are working
 * words for a fun test, kept in data so a playtest can reword them without
 * touching the screen.
 *
 * English is the source. Every other language is a table of the same shape in
 * `cardData/translations/`, machine-drafted and not yet read by a native
 * speaker (`docs/spec/gymrun-patch-card-battle-accessibility.md`). A sentence
 * with a slot in it is a function, so each language orders its own words.
 *
 * `CARD_COPY` is a live binding: `setCardLanguage` swaps the table under it,
 * and the screen reads it at every render, so the next render is in the new
 * language. The battle log the Menu copies is JSON and is never translated.
 */
import type { DamageKeyword } from '../core/cards/defs';
import type { PlayBlock } from '../core/cards/state';
import { DE } from './translations/de';
import { ES } from './translations/es';
import { FR } from './translations/fr';
import { JA } from './translations/ja';
import { UK } from './translations/uk';
import { ZH_HANS } from './translations/zh-Hans';
import { ZH_HANT } from './translations/zh-Hant';

const EN = {
  title: 'Card battle test',
  round: 'Round',
  /** Part C: the wave being fought, in the status line. */
  wave: (n: number, of: number) => `Wave ${n}/${of}`,
  draw: 'Draw',
  discard: 'Discard',
  endTurn: 'End Turn',
  start: 'Start',
  deployHint: 'Place your units on the home rows, then Start',
  placeUnit: (unit: string) => `${unit}: pick a home tile`,
  scenario: 'Scenario',
  /** A scenario's grade total, the sum of its enemies' provisional grades. */
  grade: (n: number) => `Grade ${n}`,
  botTurn: 'Bot turn',
  undo: 'Undo',
  cancel: 'Cancel',
  inspect: 'Inspect',
  menu: 'Menu',
  close: 'Close',
  exit: 'Exit',
  restart: 'Restart',
  newSeed: 'New seed',
  copyLog: 'Copy log',
  copied: 'Log copied',
  copyFailed: 'Select the log below and copy it',
  seed: 'Seed',
  won: 'Won',
  lost: 'Lost',
  pickUnit: 'Pick who plays it',
  cannotPlay: (units: string, reason: string) => `${units}: ${reason}`,
  pickTarget: 'Pick a target',
  pickAlly: 'Pick an ally',
  pickTile: 'Pick a tile',
  pickTileBlock: 'Pick a tile · a shield blocks a Strike',
  pickTileAllies: 'Pick a tile · a marked tile hits an ally too',
  pickTargetAllies: 'Pick a target · a marked one hits an ally too',
  inspectHint: 'Tap a card or an enemy to inspect it',
  /** Round 1 under opening grace (A1, A7): the note line, while nothing else is said. */
  graceBoard: 'Round 1: enemies are getting into position',
  /** Inspect entries for the rules of the grace and friendly fire patch (A7). */
  rule: {
    grace: 'Round 1: most enemies set up instead of attacking.',
    fast: 'Fast: attacks from round 1, for 1.',
    blastAllies: 'Blast hits allies on its tiles too. Not the unit that plays it.',
    blastAlliesCaster: 'Blast hits allies on its tiles too, the unit that plays it included.',
  },
  enemyStats: (hp: number, base: number) => `HP ${hp} · Base ${base}`,
  /** The unit filter (A6): tap a unit to see only what it can play. */
  filterShowing: (unit: string) => `Showing ${unit}`,
  filterShowAll: 'Show all',
  filterOther: (n: number) => `+${n} other`,
  /** The Uses keyword (D7), left of total. */
  uses: (left: number, of: number) => `Uses ${left}/${of}`,
  retain: 'Retain: stays in hand',
  /** Part D, the boss's panel and Inspect entry. */
  pinned: (turns: number) => `Pinned ${turns}`,
  stalkAt: (hp: number) => `Stalks at ${hp} HP`,
  bossRules: {
    stalk: 'Once, at half HP, it stalks up to 3 rows toward you, stomping each tile it moves into.',
    pin: 'A Harpoon pins it for 2 turns: no moves, no shields until the second turn, and it Screams at every tile touching it.',
  },
  neutral: 'Neutral',
  cost: 'MP',
  hp: 'HP',
  shield: 'Shield',
  shieldShort: 'Sh',
  baseShield: 'Base',
  slots: 'Slots',
  intentNone: 'Wait',
  /** The Fast badge on an enemy's token and panel. */
  fast: 'Fast',
  reasons: {
    noMp: 'Not enough MP',
    noSlot: 'No free slot',
    wrongZone: 'Danger zone only',
    noTarget: 'Nothing to hit',
    fainted: 'Fainted',
    outOfRange: 'Too far: 3 tiles ahead in its lane',
  } satisfies Record<PlayBlock, string>,
  keyword: {
    strike: 'Strike',
    pierce: 'Pierce',
    slash: 'Slash',
    blast: 'Blast',
    move: 'Move',
    shield: 'Shield',
    target: 'Target',
    scream: 'Scream',
  } satisfies Record<DamageKeyword | 'move' | 'shield' | 'target' | 'scream', string>,
  effect: {
    shieldSelf: (n: number) => `Shield ${n}, self`,
    shieldFriendly: (n: number) => `Shield ${n}, ally`,
    gainMp: (n: number) => `+${n} MP on use`,
    mpNextTurns: (n: number, turns: number) => `+${n} MP next ${turns} turns`,
    grantMove: (n: number) => `Ally: Move ${n}, no MP`,
    drawNext: (n: number) => `Next hand +${n}, not mine`,
    harpoon: (range: number, pin: number) => `Pin a boss ${range} ahead, ${pin} turns`,
  },
  roundLog: 'Round log',
  replayRound: 'Replay round',
  back: 'Back',
  logEmpty: 'No round played yet',
  /** The round playback and the round log: one line per thing that happened, in order. */
  log: {
    plays: (who: string, card: string) => `${who} · ${card}`,
    acts: (who: string, act: string) => `${who} · ${act}`,
    moves: (who: string, way: string) => `${who} moves ${way}`,
    waits: (who: string) => `${who} waits`,
    way: { up: 'up', down: 'down', left: 'left', right: 'right' },
    converted: 'Strike becomes Pierce',
    fizzledGone: 'Fizzled: target gone',
    fizzledNothing: 'Fizzled: nothing to hit',
    friendlyFire: (who: string) => `${who}: friendly fire`,
    harpooned: (who: string, turns: number) => `${who} pinned for ${turns} turns, shields gone`,
    shieldsReturned: (who: string, n: number) => `${who} shields back: base ${n}`,
    pinEnded: (who: string) => `${who} tears the harpoon out`,
    stalked: (who: string) => `${who} stalks!`,
    stomp: (who: string, n: number, of: number) => `${who} stomps ${n}/${of}`,
    granted: (card: string) => `${card} into your hand`,
    usedUp: (card: string) => `${card}: no uses left this wave`,
    notPlayed: 'Not played: fainted',
    hit: (who: string, n: number) => `${who} hit for ${n}`,
    absorbed: { shield: (n: number) => `shield -${n}`, baseShield: (n: number) => `base -${n}`, hp: (n: number) => `HP -${n}` },
    missed: 'Missed: nobody on the lit tiles',
    shielded: (who: string, n: number) => `${who} shield +${n}`,
    shieldDrops: (who: string, n: number) => `${who} shield ${n} wears off`,
    defeated: (who: string) => `${who} defeated`,
    fainted: (who: string) => `${who} fainted`,
    mp: (who: string, n: number) => `${who} +${n} MP`,
    roundMp: (who: string) => `MP +1: ${who}`,
    drawQueued: (n: number) => `Next hand +${n}`,
    next: 'Next round',
    telegraph: (who: string, act: string) => `${who}: ${act}`,
    reshuffled: 'Discard shuffled in',
    round: (n: number) => `Round ${n}`,
    wave: (n: number) => `Wave ${n} arrives`,
    step: (n: number, of: number) => `${n}/${of}`,
  },
  /** The panels' meters, each one's accessible name (`ui/cardbattle/meters.ts`). */
  meters: {
    vitals: (hp: number, max: number, shield: number, base: number) => `HP ${hp}/${max} · Shield ${shield} · Base ${base}`,
    mana: (free: number, held: number, cap: number) => `MP ${free} free, ${held} held, of ${cap}`,
    ult: (card: string, cost: number) => `${card} at ${cost}`,
  },
  /** The tutorial (`ui/cardbattle/tutorial.ts`): its buttons, and each step's title and text. */
  tutorial: {
    button: 'Tutorial',
    skip: 'Skip tutorial',
    skipStep: 'Skip step',
    next: 'Next',
    progress: (n: number, of: number) => `${n}/${of}`,
    complete: 'Tutorial complete: the dummy is down.',
    play: (scenario: string) => `Play ${scenario}`,
    steps: {
      place: { title: 'Placement', text: 'Tap a unit, then a tile on your two home rows. A unit already there swaps with it.' },
      start: { title: 'Start', text: 'Press Start when your units are set. The enemies then take their places.' },
      hand: { title: 'Your hand', text: 'The band and letter say which unit plays a card; a grey card, any unit. Top left is its MP cost. Hold a card to read it.' },
      vitals: { title: 'Hearts and bubbles', text: 'Hearts are HP. Bubbles are shields and pop before hearts: a filled one wears off, a ringed one is the base shield, used once. A shielded piece wears a bubble on the board.' },
      mana: { title: 'MP', text: (card: string, cost: number, cap: number) => `Each unit gains 1 MP a round, up to ${cap}. The star marks its ult: ${card} at ${cost}. Dimmed cells are held by cards you planned.` },
      move: { title: 'Move', text: 'Tap Move, pick who plays it, then a lit tile.' },
      slots: { title: 'Card slots', text: "A planned card sits in its unit's slot, numbered in the order the plan plays. Tap a slot to take the card back." },
      attack: { title: 'Attack', text: "Tap Shoot. It hits the first enemy down the Gunner's lane, at any range." },
      end: { title: 'End Turn', text: 'Your cards play in order, then the enemies act. The dummy only waits.' },
      finish: { title: 'Beat the dummy', text: 'Keep going until the Target Dummy falls. MP builds each round, so bigger cards open up.' },
    },
  },
  /**
   * The names the card data carries, keyed by their English text: cards,
   * units, enemies and scenarios. English leaves it empty and reads the data.
   */
  names: {} as Record<string, string>,
  /** The Menu's settings. Each language's own name is always written in that language. */
  settings: {
    language: 'Language',
    colours: 'Colours',
    paletteStandard: 'Standard',
    paletteTritan: 'Blue-green safe',
  },
};

/** The shape every language fills. */
export type CardCopy = typeof EN;

export const CARD_LANGUAGES = ['en', 'zh-Hant', 'zh-Hans', 'ja', 'de', 'uk', 'es', 'fr'] as const;
export type CardLanguage = (typeof CARD_LANGUAGES)[number];

/** Each language's name for itself: what the picker shows, whatever language is on. */
export const LANGUAGE_NAMES: Record<CardLanguage, string> = {
  en: 'English',
  'zh-Hant': '繁體中文',
  'zh-Hans': '简体中文',
  ja: '日本語',
  de: 'Deutsch',
  uk: 'Українська',
  es: 'Español',
  fr: 'Français',
};

export const CARD_COPY_BY_LANGUAGE: Record<CardLanguage, CardCopy> = {
  en: EN,
  'zh-Hant': ZH_HANT,
  'zh-Hans': ZH_HANS,
  ja: JA,
  de: DE,
  uk: UK,
  es: ES,
  fr: FR,
};

// A live binding, reassigned only by `setCardLanguage`.
export let CARD_COPY: CardCopy = EN;
let current: CardLanguage = 'en';

export function cardLanguage(): CardLanguage {
  return current;
}

export function setCardLanguage(language: CardLanguage): void {
  current = language;
  CARD_COPY = CARD_COPY_BY_LANGUAGE[language];
}

export function isCardLanguage(value: unknown): value is CardLanguage {
  return typeof value === 'string' && (CARD_LANGUAGES as readonly string[]).includes(value);
}

/** A name from the card data in the current language, or as the data has it. */
export function nameOf(english: string): string {
  return CARD_COPY.names[english] ?? english;
}
