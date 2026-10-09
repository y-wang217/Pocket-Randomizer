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
  draw: 'Draw',
  discard: 'Discard',
  endTurn: 'End Turn',
  start: 'Start',
  deployHint: 'Place your units on the home rows, then Start',
  placeUnit: (unit: string) => `${unit}: pick a home tile`,
  scenario: 'Scenario',
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
  inspectHint: 'Tap a card to inspect it',
  once: 'Once',
  neutral: 'Neutral',
  cost: 'MP',
  hp: 'HP',
  shield: 'Shield',
  shieldShort: 'Sh',
  baseShield: 'Base',
  slots: 'Slots',
  intentNone: 'Wait',
  reasons: {
    noMp: 'Not enough MP',
    noSlot: 'No free slot',
    wrongZone: 'Danger zone only',
    noTarget: 'Nothing to hit',
    fainted: 'Fainted',
  } satisfies Record<PlayBlock, string>,
  keyword: {
    strike: 'Strike',
    pierce: 'Pierce',
    slash: 'Slash',
    blast: 'Blast',
    move: 'Move',
    shield: 'Shield',
    target: 'Target',
  } satisfies Record<DamageKeyword | 'move' | 'shield' | 'target', string>,
  effect: {
    shieldSelf: (n: number) => `Shield ${n}, self`,
    shieldFriendly: (n: number) => `Shield ${n}, ally`,
    gainMp: (n: number) => `+${n} MP on use`,
    mpNextTurns: (n: number, turns: number) => `+${n} MP next ${turns} turns`,
    grantMove: (n: number) => `Ally: Move ${n}, no MP`,
    drawNext: (n: number) => `Next hand +${n}, not mine`,
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
    step: (n: number, of: number) => `${n}/${of}`,
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
