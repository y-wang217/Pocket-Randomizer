/**
 * Gym leaders.
 *
 * A gym is a leader identity, a type, the segment it guards, and a team. Stage
 * 1 hardcodes the team; Stage 2 replaces `gymTeam()` with
 * `generateGymTeam(gym, rng, tuning)` drawing from the type. When that happens
 * **the definitions below must not need to change** — that is why the type is a
 * first-class field rather than something inferred from the roster, and why the
 * roster carries no levels (levels come from tuning and the segment index).
 *
 * All eight segments are defined even though Stage 1 plays one. `gymForSegment`
 * is then a real lookup rather than a constant with a lookup's shape, and
 * Stage 2 turns on seven more segments without touching this file.
 *
 * One Pokemon per gym, deliberately. The driver has no switch choice until
 * Stage 4, so a two-Pokemon side would hand the sim a forced-switch request
 * that no policy can answer. A roster that the engine cannot actually play is
 * worse than a short one.
 */
import type { MonEntry } from './mons';

export interface GymDefinition {
  id: string;
  leader: string;
  /** The gym's type identity. Stage 2 generates the team from this. */
  type: string;
  /** Which segment this gym caps. */
  segment: number;
  /** Stage 1's hardcoded roster. Stage 2 generates it instead. */
  team: readonly MonEntry[];
}

export const GYMS: readonly GymDefinition[] = [
  {
    id: 'gym-rock',
    leader: 'Garnet',
    type: 'Rock',
    segment: 0,
    team: [{ id: 'rhydon', species: 'Rhydon', ability: 'Lightning Rod', moves: ['Rock Slide', 'Earthquake', 'Megahorn', 'Swords Dance'] }],
  },
  {
    id: 'gym-water',
    leader: 'Marina',
    type: 'Water',
    segment: 1,
    team: [{ id: 'lapras', species: 'Lapras', ability: 'Water Absorb', moves: ['Surf', 'Ice Beam', 'Thunderbolt', 'Body Slam'] }],
  },
  {
    id: 'gym-electric',
    leader: 'Volta',
    type: 'Electric',
    segment: 2,
    team: [{ id: 'electivire', species: 'Electivire', ability: 'Motor Drive', moves: ['Wild Charge', 'Earthquake', 'Ice Punch', 'Bulk Up'] }],
  },
  {
    id: 'gym-grass',
    leader: 'Fern',
    type: 'Grass',
    segment: 3,
    team: [{ id: 'tangrowth', species: 'Tangrowth', ability: 'Regenerator', moves: ['Power Whip', 'Earthquake', 'Knock Off', 'Giga Drain'] }],
  },
  {
    id: 'gym-fire',
    leader: 'Cinder',
    type: 'Fire',
    segment: 4,
    team: [{ id: 'magmortar', species: 'Magmortar', ability: 'Flame Body', moves: ['Flamethrower', 'Thunderbolt', 'Focus Blast', 'Nasty Plot'] }],
  },
  {
    id: 'gym-psychic',
    leader: 'Solene',
    type: 'Psychic',
    segment: 5,
    team: [{ id: 'slowking', species: 'Slowking', ability: 'Regenerator', moves: ['Psyshock', 'Surf', 'Flamethrower', 'Calm Mind'] }],
  },
  {
    id: 'gym-ghost',
    leader: 'Vesper',
    type: 'Ghost',
    segment: 6,
    team: [{ id: 'gengar', species: 'Gengar', ability: 'Cursed Body', moves: ['Shadow Ball', 'Sludge Bomb', 'Focus Blast', 'Nasty Plot'] }],
  },
  {
    id: 'gym-dragon',
    leader: 'Draven',
    type: 'Dragon',
    segment: 7,
    team: [{ id: 'salamence', species: 'Salamence', ability: 'Intimidate', moves: ['Dragon Claw', 'Earthquake', 'Fire Fang', 'Dragon Dance'] }],
  },
];

/** The gym that caps a segment. Throws rather than wrapping: a missing gym is a bug. */
export function gymForSegment(segment: number): GymDefinition {
  const gym = GYMS.find((entry) => entry.segment === segment);
  if (!gym) throw new RangeError(`No gym defined for segment ${segment}`);
  return gym;
}
