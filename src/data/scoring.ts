/**
 * What a run is worth, as weights. **Stage 4.8, item 4.**
 *
 * Every number here is a balance number and a tuning pass edits this file alone.
 * `core/scoring.ts` computes the counts and multiplies; it contains no weights,
 * and this contains no counting.
 *
 * ## What the score is for, and why risk is paid for at all
 *
 * A score that paid only for clearing gyms would teach players to route around
 * every hard node, which is the opposite of the game the tier system exists to
 * produce. **Score is the game telling the player what to chase**, so it has to
 * pay for the thing the run is built around: taking the fight you could have
 * declined. The gradient below is deliberate — an elite node is worth noticeably
 * more than a hard one, because the risk is noticeably larger.
 *
 * ## Why a zero is here rather than absent
 *
 * `turns` is weighted zero and still computed, still listed, still displayed. The
 * data exists for a later decision about pace without this patch taking a
 * position on fight length, which is explicitly out of scope. A component that
 * was simply missing would have to be added — and measured — from nothing; one
 * that is recorded at zero is a column the next pass can read history out of.
 *
 * **A weight of zero is not a licence to skip the component.** `scoreRun` computes
 * and returns every one of these regardless, and `test/scoring.test.ts` asserts it.
 */

/** The components a run is scored on, in the order a breakdown lists them. */
export const SCORE_COMPONENTS = [
  'gymsCleared',
  'eliteNodes',
  'hardNodes',
  'captures',
  'relics',
  'survivors',
  'turns',
] as const;

export type ScoreComponentId = (typeof SCORE_COMPONENTS)[number];

/**
 * What one of each component is worth.
 *
 * Gyms dominate by an order of magnitude, which is the statement that clearing
 * the run is the point and everything else is how well you did it. Eight gyms is
 * 800 of a typical total; the rest of a good run is a few hundred.
 */
export const SCORE_WEIGHTS: Readonly<Record<ScoreComponentId, number>> = {
  /** The run's spine. Eight of these is most of a perfect score. */
  gymsCleared: 100,
  /** The two-Pokemon fight. Worth more than hard by more than the tier gap suggests. */
  eliteNodes: 30,
  /** A visible amount, so declining every one of them is a visible cost. */
  hardNodes: 12,
  /** A roster built rather than inherited. */
  captures: 6,
  /** Permanent, and mostly taken at elite nodes, so this partly double-pays risk. */
  relics: 15,
  /** Small: surviving is its own reward, and a wipe already scores nothing after it. */
  survivors: 8,
  /** Zero, deliberately. See the header. */
  turns: 0,
};

/** What the result screen calls each component. Attributes, never verdicts. */
export const SCORE_LABELS: Readonly<Record<ScoreComponentId, string>> = {
  gymsCleared: 'Gyms cleared',
  eliteNodes: 'Elite nodes taken',
  hardNodes: 'Hard nodes taken',
  captures: 'Pokemon caught',
  relics: 'Relics held',
  survivors: 'Standing at the end',
  turns: 'Turns taken',
};
