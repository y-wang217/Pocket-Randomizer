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

export const STARTER_COPY = {
  blurb: {
    long:
      'One Pokemon carries the whole run, through eight gyms. Species, ability and ' +
      'moves are all randomized. HP and PP persist between fights; a cleared gym ' +
      'restores both.',
    short: 'Species, ability and moves are randomized. HP and PP carry between fights; a gym clear restores both.',
  },
} as const satisfies Record<string, Prose>;

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

export const REPLACE_COPY = {
  blurb: {
    long: 'Four moves already. Pick the one it replaces — this cannot be undone.',
    short: 'Pick the move it replaces. No undo.',
  },
  current: { long: 'Currently knows — tap one to replace', short: 'Knows — tap one to replace' },
} as const satisfies Record<string, Prose>;

export const TARGET_COPY = {
  blurb: { long: 'Who learns it? You choose what it replaces next.', short: 'Who learns it?' },
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

export const DRAWER_COPY = {
  carrying: { long: 'What you are carrying right now.', short: 'Carrying now.' },
  inBattle: { long: 'Your side, as the fight has left it.', short: 'Your side, mid-fight.' },
  note: { long: 'Read only. Items are assigned on the party screen.', short: 'Read only.' },
} as const satisfies Record<string, Prose>;

export const REWARD_COPY = {
  itemNote: { long: 'Goes to your backpack. Assign it on the party screen.', short: 'To your backpack.' },
  coins: { long: 'Spend it at a shop, on items, healing or a move.', short: 'Spend at a shop.' },
  heal: { long: 'Heals HP and PP, and clears status, for the whole party.', short: 'Full HP, PP and status, whole party.' },
  tutor: { long: 'A strong move. You choose who learns it, and what it replaces.', short: 'You choose who learns it.' },
  tm: { long: 'A new move. You choose who learns it, and what it replaces.', short: 'You choose who learns it.' },
} as const satisfies Record<string, Prose>;

/** The coins already held, on a currency card. */
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

export const CAPTURE_FULL: Prose = {
  long: ' Your party is full — someone has to go.',
  short: ' Party full, one goes.',
};

/** The release control on a capture block's card, which sits under the member's name. */
export const RELEASE_LABEL = (species: string): Prose => ({ long: `Release ${species}`, short: 'Release' });

/** Beside a held item on the capture block's cards: the item is not part of the price. */
export const RETURNS_TO_BAG: Prose = { long: 'returns to your bag', short: 'to bag' };
