/**
 * Which role a row plays, which type a gym leader runs, and where the bosses
 * are. These are facts about the games, kept in one table so a curation fix
 * is one line.
 *
 * Roles come from the **class constant**, never from the name alone: the
 * games are full of route trainers called Flint, May and Bruno. The Game Boy
 * games give each boss a class of their own, so there the constant is the
 * name, and those are listed.
 */
import type { GameId, TrainerRole } from '../../src/data/encounters/types';
import type { TypeName } from '../../src/core/types';
import type { RawEncounter } from './model';
import { GAME_GEN, GAME_REGION } from './model';

/** Gym leaders and the type their gym runs. Blue's Viridian gym has no type. */
export const GYM_TYPE: Record<string, TypeName | null> = {
  brock: 'Rock',
  misty: 'Water',
  'lt. surge': 'Electric',
  erika: 'Grass',
  koga: 'Poison',
  janine: 'Poison',
  sabrina: 'Psychic',
  blaine: 'Fire',
  giovanni: 'Ground',
  falkner: 'Flying',
  bugsy: 'Bug',
  whitney: 'Normal',
  morty: 'Ghost',
  chuck: 'Fighting',
  jasmine: 'Steel',
  pryce: 'Ice',
  clair: 'Dragon',
  blue: null,
  roxanne: 'Rock',
  brawly: 'Fighting',
  wattson: 'Electric',
  flannery: 'Fire',
  norman: 'Normal',
  winona: 'Flying',
  'tate & liza': 'Psychic',
  wallace: 'Water',
  juan: 'Water',
  roark: 'Rock',
  gardenia: 'Grass',
  maylene: 'Fighting',
  'crasher wake': 'Water',
  fantina: 'Ghost',
  byron: 'Steel',
  candice: 'Ice',
  volkner: 'Electric',
};

/** Where each named boss fights. */
const BOSS_PLACE: Record<string, string> = {
  brock: 'Pewter City Gym',
  misty: 'Cerulean City Gym',
  'lt. surge': 'Vermilion City Gym',
  erika: 'Celadon City Gym',
  koga: 'Fuchsia City Gym',
  janine: 'Fuchsia City Gym',
  sabrina: 'Saffron City Gym',
  blaine: 'Cinnabar Island Gym',
  giovanni: 'Viridian City Gym',
  blue: 'Viridian City Gym',
  falkner: 'Violet City Gym',
  bugsy: 'Azalea Town Gym',
  whitney: 'Goldenrod City Gym',
  morty: 'Ecruteak City Gym',
  chuck: 'Cianwood City Gym',
  jasmine: 'Olivine City Gym',
  pryce: 'Mahogany Town Gym',
  clair: 'Blackthorn City Gym',
  roxanne: 'Rustboro City Gym',
  brawly: 'Dewford Town Gym',
  wattson: 'Mauville City Gym',
  flannery: 'Lavaridge Town Gym',
  norman: 'Petalburg City Gym',
  winona: 'Fortree City Gym',
  'tate & liza': 'Mossdeep City Gym',
  juan: 'Sootopolis City Gym',
  roark: 'Oreburgh City Gym',
  gardenia: 'Eterna City Gym',
  maylene: 'Veilstone City Gym',
  'crasher wake': 'Pastoria City Gym',
  fantina: 'Hearthome City Gym',
  byron: 'Canalave City Gym',
  candice: 'Snowpoint City Gym',
  volkner: 'Sunyshore City Gym',
  lorelei: 'Indigo Plateau',
  bruno: 'Indigo Plateau',
  agatha: 'Indigo Plateau',
  will: 'Indigo Plateau',
  karen: 'Indigo Plateau',
  sidney: 'Ever Grande City',
  phoebe: 'Ever Grande City',
  glacia: 'Ever Grande City',
  drake: 'Ever Grande City',
  aaron: 'Pokemon League',
  bertha: 'Pokemon League',
  flint: 'Pokemon League',
  lucian: 'Pokemon League',
  cynthia: 'Pokemon League',
  steven: 'Ever Grande City',
  red: 'Mt. Silver',
  anabel: 'Battle Tower',
  tucker: 'Battle Dome',
  spenser: 'Battle Palace',
  greta: 'Battle Arena',
  noland: 'Battle Factory',
  lucy: 'Battle Pike',
  brandon: 'Battle Pyramid',
  palmer: 'Battle Tower',
  argenta: 'Battle Hall',
  thorton: 'Battle Factory',
  dahlia: 'Battle Arcade',
  darach: 'Battle Castle',
  eusine: 'Burned Tower',
};

/** Game Boy boss classes, where the class constant is the person. */
const GB_GYM = new Set(['BROCK', 'MISTY', 'LT_SURGE', 'ERIKA', 'KOGA', 'BLAINE', 'SABRINA', 'FALKNER', 'BUGSY', 'WHITNEY', 'MORTY', 'CHUCK', 'JASMINE', 'PRYCE', 'CLAIR', 'JANINE', 'BLUE']);
const GB_ELITE = new Set(['LORELEI', 'BRUNO', 'AGATHA', 'WILL', 'KAREN']);
const FRONTIER = /^(SALON_MAIDEN|DOME_ACE|PALACE_MAVEN|ARENA_TYCOON|FACTORY_HEAD|PIKE_QUEEN|PYRAMID_KING|TOWER_TYCOON|HALL_MATRON|ARCADE_STAR|CASTLE_VALET)$/;
const VILLAIN = /^(ROCKET_BOSS|BOSS|BOSS_\w+|GALACTIC_BOSS|COMMANDER_\w+|AQUA_LEADER|MAGMA_LEADER|AQUA_ADMIN|MAGMA_ADMIN|EXECUTIVE|EXECUTIVE_\w+|MYSTERY_MAN)$/;

export function roleOf(row: RawEncounter): TrainerRole {
  if (row.role) return row.role;
  const key = row.classKey;
  const gen = GAME_GEN[row.game];
  const gb = gen <= 2;
  if (key === 'CHAMPION' || /^CHAMPION_/.test(key) || key === 'PKMN_TRAINER_RED' || key === 'RED') return 'champion';
  // Red/Blue's third rival fight is the Champion fight.
  if (gb && key === 'RIVAL3') return 'champion';
  if (key === 'LANCE') return gen === 1 ? 'elite' : 'champion';
  if (/^ELITE_FOUR/.test(key) || GB_ELITE.has(key)) return 'elite';
  // Koga is a gym leader in Kanto and Elite Four in Johto; the game decides.
  if (key === 'KOGA' && gen === 2) return 'elite';
  if (key === 'GIOVANNI') return /gym/i.test(row.place ?? '') ? 'gym' : 'boss';
  if (/^(LEADER|RS_LEADER)/.test(key) || GB_GYM.has(key)) return 'gym';
  if (/^RIVAL/.test(key) || key === 'DP_RIVAL' || key === 'POKEMON_TRAINER_3') return 'rival';
  if (VILLAIN.test(key) || FRONTIER.test(key) || key === 'PKMN_TRAINER_LANCE') return 'boss';
  if (key === 'PKMN_TRAINER' && row.name === 'Eusine') return 'boss';
  return 'route';
}

/**
 * The class a player reads beside the name (D104: `Leader Brock`, `Rival
 * Blue`). The Game Boy games give each boss a class that *is* the boss
 * (`BROCK`, `LORELEI`), Red and Blue call the three rival fights `RIVAL1` to
 * `RIVAL3` and the Champion fight is the third, and Ruby's class table has
 * no entry for its rival constant; those read as the role word the later
 * games print. Every other class is the game's own.
 */
export function classOf(row: RawEncounter, role: TrainerRole): string {
  const own = row.className === row.name;
  if (role === 'gym' && own) return 'Leader';
  if (role === 'elite' && own) return 'Elite Four';
  if (role === 'champion' && (own || /^Rival\d$/.test(row.className))) return 'Champion';
  if (role === 'rival' && /^Rival\d$/.test(row.className)) return 'Rival';
  if (role === 'rival' && row.className === 'Pokemon Trainer 3') return 'Pokemon Trainer';
  if (role === 'boss' && own && row.name === 'Giovanni') return 'Boss';
  return row.className;
}

export function gymTypeOf(row: RawEncounter, role: TrainerRole): TypeName | undefined {
  if (role !== 'gym') return undefined;
  if (row.gymType) return row.gymType as TypeName;
  const type = GYM_TYPE[row.name.toLowerCase()];
  return type ?? undefined;
}

export function placeOf(row: RawEncounter, role: TrainerRole): string {
  if (row.place) return row.place;
  const name = row.name.toLowerCase();
  if (role === 'gym' && name === 'wallace') return 'Sootopolis City Gym';
  if (role === 'champion') {
    if (name === 'red') return 'Mt. Silver';
    if (row.game === 'rs' || row.game === 'emerald') return 'Ever Grande City';
    if (row.game === 'platinum') return 'Pokemon League';
    return 'Indigo Plateau';
  }
  if (role === 'elite' && name === 'koga') return 'Indigo Plateau';
  const bossPlace = BOSS_PLACE[name];
  if (role !== 'route' && role !== 'rival' && bossPlace) return bossPlace;
  return GAME_REGION[row.game as GameId];
}
