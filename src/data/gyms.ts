/**
 * The eight gyms.
 *
 * A gym is a type and the segment it guards. Stage 1 carried a hardcoded roster
 * alongside those and predicted it would not survive contact with the
 * randomizer; it did not, and it is gone. Stage 6.0 retired the eight fictional
 * leaders and their blurbs the same way: **the type is the gym**, and the
 * leader is drawn per seed from the encounter library (`data/encounters/`), a
 * real gym leader of that type from a real game, with that game's roster
 * fitted to the segment. Garnet, Marina and the rest were names for a type;
 * Brock, Roxanne and Roark are the type's own names.
 *
 * That is why this file has no leaders, no levels and no team sizes in it.
 * Leaders come from the library; levels come from the curve; team sizes come
 * from `opponentTeamSize`, which from Stage 4.9 is the player's own slot
 * schedule — a gym fields the roster the run has.
 */

export interface GymDefinition {
  id: string;
  /**
   * The gym's type identity.
   *
   * Every member of a generated gym team has this type. Not "mostly" — the
   * property is asserted across many seeds in test/randomizer.test.ts, because
   * a Rock gym that occasionally fields a Gyarados is a gym whose identity the
   * player cannot plan against, and planning against it is the whole reason a
   * gym is announced before you fight it. The library's candidate rule keeps
   * it too: a leader record defends this gym only when its stated type is this
   * one, and an Elite Four record only when every playable member carries it.
   */
  type: string;
  /** Which segment this gym caps. */
  segment: number;
  /**
   * Species ids this gym's rolled fill draws from, in place of "every species
   * of the type".
   *
   * Unset for all eight today. It exists because "type identity" and "the
   * roster I want" are different constraints, and the day a gym needs the
   * second one it should not require a code change. It governs the rolled
   * slots only; the canonical members are the record's.
   */
  allow?: readonly string[];
  /** Species ids this gym's rolled fill never draws, on top of data/blacklists.ts. */
  deny?: readonly string[];
}

export const GYMS: readonly GymDefinition[] = [
  { id: 'gym-rock', type: 'Rock', segment: 0 },
  { id: 'gym-water', type: 'Water', segment: 1 },
  { id: 'gym-electric', type: 'Electric', segment: 2 },
  { id: 'gym-grass', type: 'Grass', segment: 3 },
  { id: 'gym-fire', type: 'Fire', segment: 4 },
  { id: 'gym-psychic', type: 'Psychic', segment: 5 },
  { id: 'gym-ghost', type: 'Ghost', segment: 6 },
  { id: 'gym-dragon', type: 'Dragon', segment: 7 },
];

/** The gym that caps a segment. Throws rather than wrapping: a missing gym is a bug. */
export function gymForSegment(segment: number): GymDefinition {
  const gym = GYMS.find((entry) => entry.segment === segment);
  if (!gym) throw new RangeError(`No gym defined for segment ${segment}`);
  return gym;
}
