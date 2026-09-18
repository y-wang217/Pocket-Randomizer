/**
 * What a move's base-power band means, for a player meeting the badge.
 *
 * The reward card prints `BAND 3` next to a move's name, and three characters
 * are enough to *compare* two cards at a glance — which is most of what the
 * badge is for. They are not enough to learn from. "BAND 3" does not tell
 * anyone that the number is cut from base power, that the segment they are
 * standing in pays a particular band, or that a risky node pays above it, and
 * those three facts are the whole decision Stage 4.6b added.
 *
 * So the badge is a tooltip trigger like every other one on screen, and the
 * text is here rather than in `screens/reward.ts` for the same reason the
 * category text is in `data/categoryInfo.ts`: a sentence describing a mechanic,
 * written in the file that renders it, drifts from the mechanic.
 *
 * **Part 4 applies to every word below.** A band is an attribute — which of
 * five power brackets a move sits in — and the copy says what the bracket is
 * and where it comes from. It does not say that a higher band is better, that
 * the player should take one, or that any band is worth more than the card
 * beside it. The player knows what their party is holding; the screen does not
 * get to do the comparison for them.
 *
 * The ranges are stated because they are checkable. A player who reads "111 and
 * over" and then reads `120 BP` on the same card has learned the whole system
 * from one tooltip, which is the standard every other tooltip in this game is
 * written to.
 */

export interface BandEntry {
  label: string;
  /** The base-power range, exactly as `scripts/gen-pools.ts` cuts it. */
  range: string;
  /** What a move in this band is, in the player's terms. Never a verdict. */
  text: string;
}

/**
 * Keyed by band number, 1 to 5.
 *
 * The ranges mirror `POWER_CUTS` in `scripts/gen-pools.ts` and have to agree
 * with it; `test/tooltips.test.ts` asserts every band has an entry, and
 * `test/banding.test.ts` asserts the cuts themselves. Two files stating one
 * number is the cost of the number being player-facing.
 */
/**
 * How many pips the band meter draws. **Patch 4.8.0.3, item 3.**
 *
 * Five, because there are five bands, and the meter is a count of them rather
 * than a scale. It lives here beside the table it counts so the two cannot
 * disagree — `test/band-badge.test.ts` holds it to `BAND_INFO`'s own size, and
 * `test/battle-readout.test.ts` holds the pair to each other. It was four until
 * the band recut split the old top band at 110.
 */
export const BAND_PIPS = 5;

export const BAND_INFO: Readonly<Record<number, BandEntry>> = {
  1: {
    label: 'Band 1',
    range: '60 base power and under',
    text: 'Where a run starts. Every starter opens holding these, and so does most of what the first two segments field.',
  },
  2: {
    label: 'Band 2',
    range: '61 to 75 base power',
    text: 'The step up out of the opening. What the third segment mostly fields, and what the first gyms pay.',
  },
  3: {
    label: 'Band 3',
    range: '76 to 90 base power',
    text: 'The middle of the table, and the widest part of it. Most of what the middle segments field.',
  },
  4: {
    label: 'Band 4',
    range: '91 to 110 base power',
    text: 'The back half of the run. A risky node reaches here before the segments do.',
  },
  5: {
    label: 'Band 5',
    range: '111 base power and over',
    text: 'The top of the table. Mostly moves that cost something to use. The last segments field these, and the last gym pays one.',
  },
};

/** The band's entry, or null for a number no band uses. */
export function bandInfo(band: number): BandEntry | null {
  return BAND_INFO[band] ?? null;
}

/**
 * A multi-hit move is banded on what it applies in a turn, not per hit.
 *
 * Said out loud in the tooltip because it is the one place the badge and the
 * base power on the same card *disagree*: Population Bomb reads `20 BP` and
 * `BAND 5`, and a player who cannot account for that learns to distrust both
 * numbers. See `effectivePower` in `scripts/gen-pools.ts`.
 */
export const BAND_MULTIHIT_NOTE =
  'A move that hits several times is banded on its total, not on one hit.';
