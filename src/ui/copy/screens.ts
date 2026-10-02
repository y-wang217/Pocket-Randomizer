/**
 * The screens' own prose, in both of its forms. **Density modes patch, Part 4.**
 *
 * Every player-facing string that was written inline in a screen — a blurb
 * under a title, a note on a card, a line about an empty section — lives here
 * now, beside its short form. Detailed reads `long`; Simple and Pocket read
 * `short` (`ui/dom.ts`, `prose`). The rule is that a short form sits beside
 * the long one in the table the string already lives in, and this is the
 * table these strings never had: they were literals in twelve components.
 *
 * **Under `ui/`, not `data/`**, for `ui/copy/summary.ts`'s reason:
 * `contentHash` is computed over `data/`, and a word changed here must not
 * move a seed. Strings that already live in a `data/` table stay there —
 * `data/statInfo.ts` carries the abbreviation beside the label, the tier
 * rows in `ui/copy/summary.ts` carry a short line beside the long — and
 * strings that live in `core/` (`core/hpCopy.ts`'s result lines,
 * `core/typeMatchup.ts`'s threat sentences) are left as they are, because a
 * short form there would be a `core/` edit for a display preference.
 *
 * The short form says the same fact in fewer words. It never says a different
 * fact, and it never drops the part that is the rule ("permanent", "no undo",
 * "nothing is bought until you leave"): a warning that survives only in
 * Detailed is a warning the mode removed. Attributes, never verdicts, in both
 * forms — `test/boundaries.test.ts` reads both.
 */
import type { Prose } from '../dom';
import type { BattleSpeed } from '../settings';

export const STARTER_COPY = {
  blurb: {
    long:
      'One Pokemon carries the whole run, through eight gyms. Species, ability and ' +
      'moves are all randomized. HP and PP persist between fights; a cleared gym ' +
      'restores both.',
    short: 'Species, ability and moves are randomized. HP and PP carry between fights; a gym clear restores both.',
  },
} as const satisfies Record<string, Prose>;

/**
 * The starter detail panel's words. **Bible Rev 19, D80**: section 4's
 * *Starter detail panel* row budgets exactly these, the two coverage labels and
 * the control's verb, at 5. *Vulnerable*, never *weak*: section 8 forbids the
 * hedge word on every surface and `data/forbiddenWords.ts` carries it.
 */
export const STARTER_LABELS = {
  effective: 'Effective against',
  vulnerable: 'Vulnerable to',
  choose: (species: string): string => `Choose ${species}`,
} as const;

/**
 * The band a stat bar is measured against, on the stat glyph's press.
 * **Bible Rev 21, D88.** A bare range at a level: no rating, no hedge.
 */
export const STAT_BAND_COPY = {
  line: (level: string, min: string, max: string): string => `At level ${level}, the pool runs ${min} to ${max}.`,
  /**
   * A staged cell's press (bible Rev 22, D95): the number before the stage,
   * and the stage as count and multiplier. The cell's face is the number now.
   */
  stage: (base: string, stage: string, multiplier: string): string => `Base ${base}, stage ${stage} (${multiplier}).`,
} as const;

export const LOCALE_COPY = {
  blurb: {
    long:
      'Where this segment is walked. The region decides which wild Pokemon live ' +
      'in it, and nothing else — trainers, shops, rests and the gym are the same ' +
      'either way.',
    short: 'The region decides the wild Pokemon here, and nothing else.',
  },
} as const satisfies Record<string, Prose>;

export const SHOP_COPY = {
  blurb: {
    long:
      'Pick what you want, then leave. Nothing is bought until you do, and there is ' +
      'no selling and no coming back.',
    short: 'Nothing is bought until you leave. No selling, no coming back.',
  },
  heal: { long: 'Heals HP and PP, and clears status.', short: 'Full HP, PP and status.' },
  teach: { long: 'You choose who learns it, and what it replaces.', short: 'You choose who learns it.' },
} as const satisfies Record<string, Prose>;

export const PARTY_COPY = {
  blurb: {
    long: 'The first member leads the next battle. Releasing is permanent.',
    short: 'Slot 1 leads. Release is permanent.',
  },
  noRelics: {
    long: 'No relics yet. They come from elite nodes, gyms, and occasionally a shop.',
    short: 'No relics yet.',
  },
  emptyBag: { long: 'Nothing loose. Items you win arrive here.', short: 'Nothing loose.' },
} as const satisfies Record<string, Prose>;

/**
 * The Team and Bag screens' labels. **Bible Rev 22, D92 to D94.** Single words
 * on controls and headings, no sentence at rest: the view switch, the sort,
 * and the bag's sections and two acts.
 */
export const PARTY_LABELS = {
  teamTitle: 'Your party',
  bagTitle: 'Bag',
  views: { stats: 'Stats', moves: 'Moves', coverage: 'Coverage' },
  sortBy: 'Sort',
  partyOrder: 'Party order',
  held: 'Held',
  nothingHeld: 'Nothing held',
  toBag: 'To bag',
  discard: 'Discard',
} as const;

export const REPLACE_COPY = {
  blurb: {
    long: 'Four moves already. Pick the one it replaces — this cannot be undone.',
    short: 'Pick the move it replaces. No undo.',
  },
  current: { long: 'Currently knows — tap one to replace', short: 'Knows — tap one to replace' },
} as const satisfies Record<string, Prose>;

export const TARGET_COPY = {
  blurb: { long: 'Who learns it? You choose what it replaces next.', short: 'Who learns it?' },
  /**
   * The control for handing a gym's move back, and the line under it.
   *
   * Shown only where the decline is offered, which is the gym's guaranteed
   * move and nothing else — see `core/rewards.DECLINED_MOVE`. The wording is
   * deliberately flat: "Don't learn it" states the action, where a "skip
   * (recommended if your moves are good)" would be the UI ranking the option
   * against the party, which the copy rule bars.
   */
  /**
   * The control that picks a recipient. **Milestone M3.3.**
   *
   * New copy, because the card used to *be* the button and now it is the party
   * row with a control beside it — `screens/pre-gym.ts`'s shape, which asks the
   * same "which member" question. Flat, like every label here: "Teach it"
   * states the action where a "best fit" would rank the six against each
   * other, which Part 4 bars.
   */
  choose: { long: 'Teach it to this one', short: 'Teach it' },
  decline: { long: "Don't learn it", short: "Don't learn it" },
  /**
   * The confirm behind the decline. **Milestone M3.3.**
   *
   * `declineNote` stood under the control and said the same thing at rest, on
   * every render, for a control most runs never press. Section 4 budgets this
   * overlay at 4 words and the record gives the wording: "Forfeit this reward?"
   *
   * Both halves the same, which is the convention `decline` above already
   * follows: a confirm has one form, because the band is the compact surface
   * and a long variant of a four-word question would be a second reading of
   * the same sentence. They stay in this table rather than beside the caller
   * so `npm run copy-audit` still finds every string a player reads.
   */
  forfeitTitle: { long: 'Forfeit this reward?', short: 'Forfeit this reward?' },
  forfeitConfirm: { long: 'Forfeit', short: 'Forfeit' },
  /*
   * `Keep`, the same word the replace confirm's way out uses. R1 is about
   * slots and this is the same idea one level up: the two confirms in this
   * game ask the player to give something up, and the control that declines
   * should not be a different word on each.
   */
  forfeitCancel: { long: 'Keep', short: 'Keep' },
} as const satisfies Record<string, Prose>;

/** What a move would do to one member, in one line. Facts about the pairing only. */
export const TARGET_EFFECT = {
  known: (move: string): Prose => ({
    long: `Already knows ${move}. Taking it here restores its PP.`,
    short: `Knows ${move}. Restores its PP.`,
  }),
  free: (move: string): Prose => ({
    long: `Has a free move slot. ${move} goes straight in.`,
    short: `Free slot. ${move} goes in.`,
  }),
  choose: (move: string): Prose => ({
    long: `Knows four moves. You choose which one ${move} replaces.`,
    short: `Four moves. You choose what ${move} replaces.`,
  }),
};

/**
 * The shell nav's five words. **Stage 5.0/1**, section 4's Shell nav row at
 * 5: one word per tab, and nothing else at rest.
 */
export const NAV_COPY = {
  label: 'Run',
  tabs: { map: 'Map', team: 'Team', bag: 'Bag', info: 'Run Info', settings: 'Settings' },
} as const;

/** The screens the Run Info and Settings tabs open. Stage 5.0/1. */
export const RUN_INFO_COPY = {
  title: 'Run info',
  label: 'Run info',
  seed: 'Seed',
  build: 'Build',
  progress: 'Run progress',
} as const;

/** The desktop sidebar. Stage 5.0/1. */
export const SIDEBAR_COPY = {
  label: 'Run at a glance',
  wordmark: 'GYMRUN',
  whereTitle: 'Where',
  team: 'Team',
  where: (locale: string | null, segment: number, gyms: number, leader: string): string =>
    `${locale ? `${locale} · ` : ''}Gym ${segment + 1} of ${gyms} · ${leader}`,
} as const;

export const SETTINGS_COPY = {
  title: 'Settings',
  label: 'Settings',
  tutorial: 'Show the tutorial again',
} as const;

export const BATTLE_SPEED_HEADING = 'Battle speed';
/*
 * Three speeds, each named for what the turn does rather than for a number.
 * Part 4 applies: "Swift" and "Patient" are descriptions of a pace, not a
 * judgement about which pace is better, and neither description says a player
 * who picks it is doing it right.
 */
export const BATTLE_SPEED_COPY: Readonly<Record<BattleSpeed, { name: string; description: string }>> = {
  swift: { name: 'Swift', description: 'Beats go by quickly. The turn is out of the way sooner.' },
  even: { name: 'Even', description: 'The shipped pace. Each beat of a turn reads on its own.' },
  patient: { name: 'Patient', description: 'Beats hold longer. More time to read what happened.' },
};

export const DRAWER_COPY = {
  carrying: { long: 'What you are carrying right now.', short: 'Carrying now.' },
  inBattle: { long: 'Your side, as the fight has left it.', short: 'Your side, mid-fight.' },
  note: { long: 'Read only. Items are assigned on the party screen.', short: 'Read only.' },
} as const satisfies Record<string, Prose>;

/** The drawer's backpack heading, for the Bag tab. Stage 5.0/1. */
export const DRAWER_BAG_HEADING = 'Bag';

export const REWARD_COPY = {
  itemNote: { long: 'Goes to your backpack. Assign it on the party screen.', short: 'To your backpack.' },
  coins: { long: 'Spend it at a shop, on items, healing or a move.', short: 'Spend at a shop.' },
  heal: { long: 'Heals HP and PP, and clears status, for the whole party.', short: 'Full HP, PP and status, whole party.' },
  /*
   * A partial heal's line. **The opening playtest QA, QA-004.**
   *
   * `heal` above was the only line, so a `Restore 85%` card read "Full HP, PP
   * and status" under its own title. The share stays in the title and only
   * there (R3); this line says what it is a share of, which is max HP and PP
   * added through `recoverParty`, and the status clear, which is total.
   */
  healPartial: {
    long: 'Heals that share of max HP and PP, and clears status, for the whole party.',
    short: 'Share of max HP and PP. Clears status.',
  },
  tutor: { long: 'A strong move. You choose who learns it, and what it replaces.', short: 'You choose who learns it.' },
  tm: { long: 'A new move. You choose who learns it, and what it replaces.', short: 'You choose who learns it.' },
  /*
   * A technique says what a technique *is* rather than what it is worth.
   *
   * It cannot reuse `tm`'s line, because the thing that makes a status move a
   * different decision is that it deals no damage — a player who reads "a new
   * move" and picks it expecting an attack has been misled by the copy rather
   * than by the card. Naming the absence is a fact about the move, in the same
   * class as its type; it is not a verdict, and it says nothing about whether
   * the pick is a good one.
   */
  technique: {
    long: 'A status move — it deals no damage. You choose who learns it, and what it replaces.',
    short: 'No damage. You choose who learns it.',
  },
  /*
   * A relic's card carries the relic's *own* `playerDescription` on the detail
   * line, so this is the line under it: what a relic is, as a class of thing,
   * which the effect text does not say and which a first-time player has no
   * other way to learn.
   */
  relic: { long: 'Yours for the rest of the run. It cannot be lost or replaced.', short: 'Kept for the whole run.' },
} as const satisfies Record<string, Prose>;

/**
 * The claim band over a reward card, and the buy band over the shop's basket.
 * **Stage 5.0/3, D69.** Section 4's *Confirm band (claim, buy)* row, at 6: the
 * question and the band's two controls. The way out returns to the cards.
 */
export const CLAIM_COPY = { title: 'Take this?', confirm: 'Take', cancel: 'Back' } as const;
export const BUY_COPY = { title: 'Buy and leave?', confirm: 'Buy', cancel: 'Back' } as const;

/**
 * A restore card's name, for its long press. **Stage 5.0/3, D66.** It was the
 * card's title at rest; the face is `+N%` beside a bar now, and the words
 * went to inspect with every other card's name.
 */
export function restoreTitle(fraction: number): string {
  return fraction >= 1 ? 'Full restore' : `Restore ${Math.round(fraction * 100)}%`;
}

/** The coins already held, on a currency card's long press. */
export function carryingLine(coins: number): Prose {
  return { long: `You are carrying ${coins}.`, short: `Carrying ${coins}.` };
}

/** Where a capture offer came from. Never what it is worth. */
export const CAPTURE_SOURCE = {
  encounter: { long: 'You beat it. You can take it with you.', short: 'Beaten. Yours to take.' },
  reward: { long: 'Offered as your reward for the fight.', short: 'The fight’s reward.' },
  event: { long: 'It is here, and it will come with you.', short: 'It comes with you.' },
} as const satisfies Record<string, Prose>;

/** What a node kind is, on the map's current step. Facts about the kind. */
export const KIND_HINTS = {
  wild: { long: 'A wild Pokemon. Cheaper than a trainer, and still costs something.', short: 'A wild Pokemon.' },
  trainer: { long: 'A trained Pokemon. Tougher, and the level band is higher.', short: 'A trainer, a band up.' },
  rest: { long: 'Restore HP, PP and status in full.', short: 'Full restore.' },
  gym: { long: 'The gym leader. Beat them and the segment is over.', short: 'The gym leader.' },
  shop: { long: 'Spend coins on items, healing and moves.', short: 'Items, healing, moves.' },
  event: { long: 'Something happens. You choose what to do about it.', short: 'Something happens.' },
} as const satisfies Record<string, Prose>;

/**
 * What a coin amount is, behind the currency mark. **Stage 5.0/4, D54.**
 * Section 3's *Coin amount* inspect column; the number comes from the mark.
 */
export const CURRENCY_COPY = {
  payout: 'What this fight pays when it is won.',
  price: 'The cheapest thing on this shelf.',
  wallet: 'What the run is carrying.',
} as const;

export const CAPTURE_FULL: Prose = {
  long: ' Your party is full — someone has to go.',
  short: ' Party full, one goes.',
};

/** The release control on a capture block's card, which sits under the member's name. */
export const RELEASE_LABEL = (species: string): Prose => ({ long: `Release ${species}`, short: 'Release' });

/** Beside a held item on the capture block's cards: the item is not part of the price. */
export const RETURNS_TO_BAG: Prose = { long: 'returns to your bag', short: 'to bag' };

/** The evolution block on a gym clear's result screen. Stage 4.9. */
export const EVOLUTION_HEADING = 'Evolution';

/** One member that changed: who, from what, into what. Facts, in that order. */
export const EVOLUTION_LINE = (name: string, from: string, to: string): Prose => ({
  long: name === from ? `${from} evolved into ${to}.` : `${name} (${from}) evolved into ${to}.`,
  short: `${from} → ${to}`,
});

/** The fork. The options say what each is; this only says that there is a choice. */
export const EVOLUTION_CHOICE = (name: string): Prose => ({
  long: `${name} is ready to evolve, and there is more than one way. Choose what it becomes.`,
  short: `${name} evolves. Choose which.`,
});
