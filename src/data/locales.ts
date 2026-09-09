/**
 * The eight regions a segment can be walked through.
 *
 * **Stage 4.6a, and the thing it adds is geography rather than difficulty.** A
 * segment opens on a choice of locale, and that choice decides one thing: what
 * the wild Pokemon in it are. It does not decide how hard the segment is, what
 * the trainers field, what the shops stock or what the gym leader brings. A
 * locale is *where you are*, not *how hard it is* — and keeping those apart is
 * what lets the balance report attribute a change to the tier table rather than
 * to a player's taste in scenery.
 *
 * ## The type table is data, not logic
 *
 * Four types each, eighteen types covered exactly. Dragon, Psychic, Fairy and
 * Steel appear once; every other type appears twice. That is a deliberate
 * scarcity: the four rarest types are the ones a party is least likely to
 * assemble by accident, so routing for them is a plan rather than a side
 * effect.
 *
 * If a type reads wrong in a locale — Poison on the Shore is the one that will
 * be argued about — that is a table edit and nothing else. No code below reads
 * a specific type name.
 *
 * ## The offer rule is here too, and that is the point
 *
 * `localeOfferWeight` is the whole of "which locales does a segment offer". The
 * generator (`core/encounters.ts`) does the weighted sampling and knows nothing
 * about consecutive segments or about whether a locale has been seen. Two rules
 * live in the number it returns:
 *
 *   - **A locale offered last segment is not offered this segment.** Weight
 *     zero, not a filter, so the rule is one number to change rather than a
 *     branch in the generator. Back-to-back Marsh is the seed deciding the run's
 *     type coverage instead of the player.
 *   - **A locale nobody has been offered yet outweighs one they have.** Which is
 *     how all eight show up across a run without the offer becoming a
 *     round-robin — a rotation would be predictable, and predictable is the one
 *     thing a seeded map has to avoid being.
 */
import type { TypeName } from '../core/types';

export type LocaleId = 'cave' | 'shore' | 'summit' | 'city' | 'forest' | 'ruins' | 'marsh' | 'badlands';

export interface LocaleDefinition {
  id: LocaleId;
  /** What the map calls it. */
  name: string;
  /**
   * The four types its wild Pokemon are drawn from.
   *
   * A species qualifies if *either* of its types is in this list, so a
   * Gyarados is a Shore encounter on Water alone. Requiring both would make a
   * dual-typed species nearly undrawable and would quietly narrow every locale
   * to a handful of monotypes.
   */
  types: readonly TypeName[];
  /** One line of flavour. Says where you are; says nothing about what it pays. */
  blurb: string;
}

/**
 * The eight, in a fixed order.
 *
 * The order is a **draw order** — `localeOfferWeight` is walked over this list
 * — so appending is safe and re-sorting reshuffles every recorded seed's offers.
 */
export const LOCALES: readonly LocaleDefinition[] = [
  { id: 'cave', name: 'Cave', types: ['Rock', 'Ground', 'Dark', 'Steel'], blurb: 'Close air and no horizon.' },
  { id: 'shore', name: 'Shore', types: ['Water', 'Poison', 'Ground', 'Normal'], blurb: 'Tideline, and whatever it left behind.' },
  { id: 'summit', name: 'Summit', types: ['Flying', 'Rock', 'Ice', 'Dragon'], blurb: 'Thin air above the treeline.' },
  { id: 'city', name: 'City', types: ['Normal', 'Electric', 'Poison', 'Fairy'], blurb: 'Wires overhead and alleys under them.' },
  { id: 'forest', name: 'Forest', types: ['Grass', 'Bug', 'Fighting', 'Flying'], blurb: 'Canopy, and something moving in it.' },
  { id: 'ruins', name: 'Ruins', types: ['Ghost', 'Dark', 'Psychic', 'Fire'], blurb: 'Somebody lived here once.' },
  { id: 'marsh', name: 'Marsh', types: ['Water', 'Grass', 'Bug', 'Ghost'], blurb: 'Standing water and slow ground.' },
  { id: 'badlands', name: 'Badlands', types: ['Fire', 'Ice', 'Electric', 'Fighting'], blurb: 'Scoured flat, and still hot.' },
];

const BY_ID = new Map(LOCALES.map((locale) => [locale.id, locale]));

export function localeById(id: LocaleId): LocaleDefinition {
  const locale = BY_ID.get(id);
  if (!locale) throw new RangeError(`No locale ${id}`);
  return locale;
}

/** Every locale id, in table order. The candidate list an offer is drawn from. */
export const LOCALE_IDS: readonly LocaleId[] = LOCALES.map((locale) => locale.id);

/** Whether a species belongs to a locale's pool. Either of its types will do. */
export function localeAdmits(locale: LocaleId, types: readonly TypeName[]): boolean {
  const allowed = new Set(localeById(locale).types);
  return types.some((type) => allowed.has(type));
}

/**
 * What the offer rule knows about the run so far.
 *
 * Deliberately not the whole `RunState`: the rule is a function of which
 * locales were offered, and nothing else. Handing it a party or a segment index
 * would be an invitation to make the offer depend on how the run is going,
 * which is how a locale offer stops being a fact about the map.
 */
export interface LocaleOfferContext {
  /** The locales offered in the previous segment. Empty at segment 0. */
  previous: readonly LocaleId[];
  /** Every locale offered anywhere in this run so far. */
  seen: readonly LocaleId[];
}

/**
 * Relative frequency of one locale in one segment's offer.
 *
 * Zero locks it out entirely, which is how the consecutive rule is expressed —
 * the same idiom `tuning.tierBands` uses to keep `elite` out of the opening
 * segments, and for the same reason: a weight of zero is a number a tuning pass
 * can move, and a filter in the generator is not.
 */
export function localeOfferWeight(locale: LocaleId, context: LocaleOfferContext): number {
  if (context.previous.includes(locale)) return LOCALE_OFFER_WEIGHTS.consecutive;
  return context.seen.includes(locale) ? LOCALE_OFFER_WEIGHTS.seen : LOCALE_OFFER_WEIGHTS.fresh;
}

/**
 * The two numbers the rule above is made of.
 *
 * `fresh` against `seen` is the coverage dial. At 4:1 a full run offers all
 * eight locales in the large majority of seeds without the sequence ever
 * becoming a rotation; at 1:1 it is uniform and the tail locales go missing in
 * about a third of runs; at 20:1 it is a rotation with noise on top. The
 * simulator's locale pick distribution is what moves it — see docs/balance.md.
 */
export const LOCALE_OFFER_WEIGHTS = {
  fresh: 4,
  seen: 1,
  consecutive: 0,
} as const;
