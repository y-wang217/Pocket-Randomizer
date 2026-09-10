/**
 * The run summary's copy. Stage V4.
 *
 * **Under `ui/`, not `data/`.** `contentHash` is computed over `data/`, and a
 * word changed here must not move a seed. Nothing in this file is read by
 * `core/`, and nothing here is a number the game uses.
 *
 * The tier table states where a run landed. It does not rate the run and it
 * does not compare it to anyone else's: five rows, one range each, one line
 * of flavour, the player's row bold. There is no population to compare
 * against and the plan defers that on purpose.
 */

export const OUTCOME_WORDS = { victory: 'VICTORY', defeat: 'FALLEN' } as const;

export interface TierRow {
  /** Gyms cleared, inclusive. */
  min: number;
  max: number;
  /** The range as printed. */
  range: string;
  /** One line. Sentence case, a fact about the distance. */
  copy: string;
  /** A tiny inline SVG glyph on a 12x12 grid, in the display's neutral. */
  icon: string;
}

const glyph = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges">${body}</svg>`;

export const TIER_ROWS: readonly TierRow[] = [
  { min: 0, max: 2, range: '0 – 2', copy: 'The first gyms. The kit was still finding its shape.', icon: glyph('<rect x="2" y="9" width="8" height="2" fill="currentColor"/>') },
  { min: 3, max: 4, range: '3 – 4', copy: 'Past the opening. The party had a plan, and the map had an answer.', icon: glyph('<rect x="2" y="9" width="8" height="2" fill="currentColor"/><rect x="4" y="6" width="4" height="3" fill="currentColor"/>') },
  { min: 5, max: 6, range: '5 – 6', copy: 'The far side of the map. Most runs do not see it.', icon: glyph('<rect x="2" y="9" width="8" height="2" fill="currentColor"/><rect x="4" y="6" width="4" height="3" fill="currentColor"/><rect x="5" y="3" width="2" height="3" fill="currentColor"/>') },
  { min: 7, max: 7, range: '7', copy: 'One gym short. The last leader is the whole run in one fight.', icon: glyph('<rect x="2" y="9" width="8" height="2" fill="currentColor"/><rect x="4" y="6" width="4" height="3" fill="currentColor"/><rect x="5" y="3" width="2" height="3" fill="currentColor"/><rect x="5" y="1" width="2" height="1" fill="currentColor"/>') },
  { min: 8, max: 8, range: '8', copy: 'All eight. The run is finished, and the seed is worth sharing.', icon: glyph('<rect x="1" y="9" width="10" height="2" fill="currentColor"/><rect x="3" y="6" width="6" height="3" fill="currentColor"/><rect x="5" y="3" width="2" height="3" fill="currentColor"/><rect x="4" y="1" width="4" height="1" fill="currentColor"/><rect x="5" y="0" width="2" height="1" fill="currentColor"/>') },
];

/** The row a count of cleared gyms lands on. Every value 0 to 8 lands on one. */
export function tierRowFor(cleared: number): TierRow {
  const row = TIER_ROWS.find((candidate) => cleared >= candidate.min && cleared <= candidate.max);
  if (!row) throw new RangeError(`No tier row for ${cleared} gyms`);
  return row;
}
