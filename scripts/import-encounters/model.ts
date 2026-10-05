/**
 * What a parser hands back: one row per trainer battle, before roles, sprites
 * and ids are assigned. Species, moves and items are already Showdown ids.
 */
import type { GameId, PartyMember, TrainerRole } from '../../src/data/encounters/types';

/** A regex group or table cell that the source guarantees. Throws with the reason rather than passing `undefined` on. */
export function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
}

export interface RawEncounter {
  game: GameId;
  /** The game's own class name, display case: `Youngster`, `Leader`, `Elite Four`. */
  className: string;
  /** The constant the class came from, for the sprite and role tables: `LEADER_ROARK`, `RIVAL`, `BUG_CATCHER`. */
  classKey: string;
  /** The trainer's name as the game writes it, or the class name when the game gives none. */
  name: string;
  /** Where the fight is, when the source says. */
  place?: string;
  party: PartyMember[];
  double?: boolean;
  /** The trainer is drawn as a woman, where the source says: picks the `f` sprite of a gendered class. */
  female?: boolean;
  /** A role the source states outright (the pokemondb sections), overriding the class-constant rules. */
  role?: TrainerRole;
  /** A gym type the source states outright, for a stated `gym` role. */
  gymType?: string;
  /** The file and label the row was read from, relative to the repository. */
  cite: string;
}

export const GAME_LABEL: Record<GameId, string> = {
  rby: 'Red and Blue',
  yellow: 'Yellow',
  gs: 'Gold and Silver',
  crystal: 'Crystal',
  rs: 'Ruby and Sapphire',
  emerald: 'Emerald',
  frlg: 'FireRed and LeafGreen',
  platinum: 'Platinum',
  hgss: 'HeartGold and SoulSilver',
  bw: 'Black and White',
  b2w2: 'Black 2 and White 2',
  xy: 'X and Y',
  oras: 'Omega Ruby and Alpha Sapphire',
  sm: 'Sun and Moon',
  usum: 'Ultra Sun and Ultra Moon',
  lgpe: "Let's Go, Pikachu! and Let's Go, Eevee!",
  swsh: 'Sword and Shield',
  bdsp: 'Brilliant Diamond and Shining Pearl',
  sv: 'Scarlet and Violet',
};

export const GAME_GEN: Record<GameId, 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9> = {
  rby: 1,
  yellow: 1,
  gs: 2,
  crystal: 2,
  rs: 3,
  emerald: 3,
  frlg: 3,
  platinum: 4,
  hgss: 4,
  bw: 5,
  b2w2: 5,
  xy: 6,
  oras: 6,
  sm: 7,
  usum: 7,
  lgpe: 7,
  swsh: 8,
  bdsp: 8,
  sv: 9,
};

export const GAME_REGION: Record<GameId, string> = {
  rby: 'Kanto',
  yellow: 'Kanto',
  gs: 'Johto',
  crystal: 'Johto',
  rs: 'Hoenn',
  emerald: 'Hoenn',
  frlg: 'Kanto',
  platinum: 'Sinnoh',
  hgss: 'Johto',
  bw: 'Unova',
  b2w2: 'Unova',
  xy: 'Kalos',
  oras: 'Hoenn',
  sm: 'Alola',
  usum: 'Alola',
  lgpe: 'Kanto',
  swsh: 'Galar',
  bdsp: 'Sinnoh',
  sv: 'Paldea',
};
