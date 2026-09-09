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
 * four power brackets a move sits in — and the copy says what the bracket is
 * and where it comes from. It does not say that a higher band is better, that
 * the player should take one, or that any band is worth more than the card
 * beside it. The player knows what their party is holding; the screen does not
 * get to do the comparison for them.
 *
 * The ranges are stated because they are checkable. A player who reads "96 and
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
 * Keyed by band number, 1 to 4.
 *
 * The ranges mirror `POWER_CUTS` in `scripts/gen-pools.ts` and have to agree
 * with it; `test/tooltips.test.ts` asserts every band has an entry, and
 * `test/banding.test.ts` asserts the cuts themselves. Two files stating one
 * number is the cost of the number being player-facing.
 */
export const BAND_INFO: Readonly<Record<number, BandEntry>> = {
  1: {
    label: 'Band 1',
    range: '55 base power and under',
    text: 'Where a run starts. Every starter opens holding these, and so does everything in the first two segments.',
  },
  2: {
    label: 'Band 2',
    range: '56 to 75 base power',
    text: 'The middle of the table. Most of what the middle segments field, and what an ordinary reward pays there.',
  },
  3: {
    label: 'Band 3',
    range: '76 to 95 base power',
    text: 'The back half of the run. A risky node reaches here before the segments do.',
  },
  4: {
    label: 'Band 4',
    range: '96 base power and over',
    text: 'The top of the table. The last segments field these, and gym leaders draw one band above the segment around them.',
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
 * `BAND 4`, and a player who cannot account for that learns to distrust both
 * numbers. See `effectivePower` in `scripts/gen-pools.ts`.
 */
export const BAND_MULTIHIT_NOTE =
  'A move that hits several times is banded on its total, not on one hit.';
