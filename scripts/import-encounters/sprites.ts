/**
 * Which Showdown trainer sprite a record wears, checked against the CDN.
 *
 * `sprites.json` is the file list of `play.pokemonshowdown.com/sprites/trainers/`
 * as scraped on the date it records. `--refresh-sprites` re-scrapes it. A
 * sprite id is only ever written into a record if it is in that list, so a
 * generated table never points at a 404.
 *
 * The choice is by era: a Gen 1 Brock wears `brock-gen1`, a Gen 3 one
 * `brock-gen3`, and when no era variant exists the bare id, which is the
 * newest official art. Generic classes map through `CLASS_SPRITES`, trying a
 * gendered variant first when the source says the trainer is a woman.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import type { GameId } from '../../src/data/encounters/types';
import type { RawEncounter } from './model';

const LIST_URL = 'https://play.pokemonshowdown.com/sprites/trainers/?view=dir';
const FILE = new URL('./sprites.json', import.meta.url);

interface SpriteList {
  scrapedAt: string;
  ids: string[];
}

export async function refreshSpriteList(): Promise<void> {
  const html = await (await fetch(LIST_URL)).text();
  const ids = [...new Set([...html.matchAll(/([a-z0-9-]+)\.png/g)].map((m) => m[1] ?? ''))].filter(Boolean).sort();
  if (ids.length < 1000) throw new Error(`Sprite listing looks truncated: ${ids.length} ids`);
  const list: SpriteList = { scrapedAt: new Date().toISOString().slice(0, 10), ids };
  writeFileSync(FILE, `${JSON.stringify(list, null, 2)}\n`);
  console.log(`sprites.json: ${ids.length} ids`);
}

let cached: Set<string> | null = null;
export function spriteList(): Set<string> {
  if (!cached) cached = new Set((JSON.parse(readFileSync(FILE, 'utf8')) as SpriteList).ids);
  return cached;
}

/** The suffixes to try for each game, most specific first. */
const ERA: Record<GameId, string[]> = {
  rby: ['-gen1rb', '-gen1', ''],
  yellow: ['-gen1', '-gen1rb', ''],
  gs: ['-gen2', ''],
  crystal: ['-gen2', ''],
  rs: ['-gen3rs', '-rse', '-gen3', ''],
  emerald: ['-gen3', '-rse', '-gen3rs', ''],
  frlg: ['-gen3frlg', '-gen3', '-gen3rs', ''],
  platinum: ['-gen4', '-gen4dp', ''],
  hgss: ['-gen4', '-gen4dp', ''],
  bw: ['-gen5bw', '-gen5', ''],
  b2w2: ['-gen5bw2', '-gen5', ''],
  xy: ['-gen6xy', '-gen6', ''],
  oras: ['-gen6', '-gen6xy', '', '-gen3'],
  sm: ['-gen7', ''],
  usum: ['-gen7', ''],
  lgpe: ['-lgpe', ''],
  swsh: ['-gen8', ''],
  bdsp: ['-gen8', '-gen4', ''],
  sv: ['-gen9', ''],
};

/** Named trainers whose sprite id is not the lower-cased name. */
const NAME_SPRITES: Record<string, string[]> = {
  'lt. surge': ['ltsurge'],
  'tate & liza': ['tateandliza'],
  'crasher wake': ['crasherwake'],
  'professor oak': ['oak'],
  // Scarlet and Violet's named trainers are drawn per version on the CDN; Scarlet's art is the one chosen.
  nemona: ['nemona-s', 'nemona-v'],
  arven: ['arven-s', 'arven-v'],
  clavell: ['clavell-s', 'clavell-v'],
};

/**
 * Trainer class constants to Showdown class sprite ids, most specific first.
 * A gendered class resolves by the constant's suffix or the source's flag:
 * `swimmer` tries `swimmerf` or `swimmerm`, then `swimmer`.
 */
const CLASS_SPRITES: Record<string, string[]> = {
  YOUNGSTER: ['youngster'],
  BUG_CATCHER: ['bugcatcher'],
  LASS: ['lass'],
  SAILOR: ['sailor'],
  JR_TRAINER_M: ['youngster'],
  JR_TRAINER_F: ['lass'],
  POKEMANIAC: ['pokemaniac'],
  SUPER_NERD: ['supernerd'],
  HIKER: ['hiker'],
  BIKER: ['biker'],
  BURGLAR: ['burglar'],
  ENGINEER: ['engineer'],
  FISHER: ['fisherman'],
  FISHERMAN: ['fisherman'],
  SWIMMER: ['swimmer'],
  SWIMMER_M: ['swimmer'],
  SWIMMER_F: ['swimmerf', 'swimmer'],
  CUE_BALL: ['cueball'],
  GAMBLER: ['gambler'],
  GAMER: ['gambler'],
  BEAUTY: ['beauty'],
  PSYCHIC: ['psychic'],
  PSYCHIC_M: ['psychic'],
  PSYCHIC_F: ['psychicf', 'psychic'],
  ROCKER: ['rocker'],
  JUGGLER: ['juggler'],
  TAMER: ['tamer'],
  BIRD_KEEPER: ['birdkeeper'],
  BLACKBELT: ['blackbelt'],
  BLACK_BELT: ['blackbelt'],
  SCIENTIST: ['scientist'],
  ROCKET: ['rocket', 'rocketgrunt'],
  TEAM_ROCKET: ['rocketgrunt', 'teamrocketgrunt', 'teamrocket'],
  TEAM_ROCKET_F: ['rocketgruntf', 'teamrocketgruntf'],
  GRUNT_M: ['rocketgrunt'],
  GRUNT_F: ['rocketgruntf'],
  EXECUTIVE_M: ['rocketexecutive'],
  EXECUTIVE_F: ['rocketexecutivef'],
  EXECUTIVE: ['rocketexecutive'],
  COOLTRAINER_M: ['acetrainer'],
  COOLTRAINER_F: ['acetrainerf', 'acetrainer'],
  COOLTRAINER: ['acetrainer'],
  COOL_TRAINER: ['acetrainer'],
  COOL_COUPLE: ['acetrainercouple'],
  ACE_TRAINER: ['acetrainer'],
  ACE_TRAINER_SNOW: ['acetrainersnow'],
  GENTLEMAN: ['gentleman'],
  CHANNELER: ['channeler'],
  SCHOOLBOY: ['schoolkid'],
  SCHOOL_KID: ['schoolkid'],
  CAMPER: ['camper'],
  PICNICKER: ['picnicker'],
  TEACHER: ['teacher'],
  GUITARIST: ['guitarist'],
  FIREBREATHER: ['firebreather'],
  SAGE: ['sage'],
  MEDIUM: ['medium'],
  BOARDER: ['boarder'],
  SKIER: ['skier'],
  POKEFAN: ['pokefan'],
  KIMONO_GIRL: ['kimonogirl'],
  TWINS: ['twins'],
  OFFICER: ['officer', 'policeman'],
  POLICEMAN: ['policeman'],
  MYSTICALMAN: ['eusine'],
  MYSTERY_MAN: ['eusine'],
  ELDER: ['li'],
  TEAM_AQUA: ['aquagrunt'],
  TEAM_MAGMA: ['magmagrunt'],
  AQUA_ADMIN: ['aquagrunt'],
  MAGMA_ADMIN: ['magmagrunt'],
  AROMA_LADY: ['aromalady'],
  RUIN_MANIAC: ['ruinmaniac'],
  INTERVIEWER: ['interviewers'],
  INTERVIEWERS: ['interviewers'],
  TUBER: ['tuber'],
  TRIATHLETE: ['triathleterunner', 'triathletebiker', 'triathleteswimmer'],
  LADY: ['lady'],
  PARASOL_LADY: ['parasollady'],
  DRAGON_TAMER: ['dragontamer'],
  NINJA_BOY: ['ninjaboy'],
  BATTLE_GIRL: ['battlegirl'],
  EXPERT: ['expert'],
  POKEMON_BREEDER: ['pokemonbreeder'],
  PKMN_BREEDER: ['pokemonbreeder'],
  BREEDER: ['pokemonbreeder'],
  PKMN_RANGER: ['pokemonranger'],
  POKEMON_RANGER: ['pokemonranger'],
  RANGER: ['pokemonranger'],
  COLLECTOR: ['collector'],
  BUG_MANIAC: ['bugmaniac'],
  KINDLER: ['kindler'],
  HEX_MANIAC: ['hexmaniac'],
  OLD_COUPLE: ['oldcouple'],
  SIS_AND_BRO: ['sisandbro'],
  SR_AND_JR: ['srandjr'],
  YOUNG_COUPLE: ['youngcouple'],
  CRUSH_GIRL: ['crushgirl'],
  CRUSH_KIN: ['crushkin'],
  PKMN_TRAINER_1: ['brendan'],
  PKMN_TRAINER_2: ['may'],
  POKEMON_TRAINER_1: ['brendan'],
  POKEMON_TRAINER_2: ['may'],
  PKMN_TRAINER: ['acetrainer'],
  PKMNTRAINER: ['acetrainer'],
  PKMN_TRAINER_3: ['acetrainer'],
  POKEMON_TRAINER_3: ['acetrainer'],
  BELLE_AND_PA: ['bellepa'],
  CYCLIST: ['cyclist'],
  JOGGER: ['jogger'],
  POKE_KID: ['pokekid'],
  COWGIRL: ['cowgirl'],
  RANCHER: ['rancher'],
  WAITER: ['waiter'],
  WAITRESS: ['waitress'],
  VETERAN: ['veteran'],
  WORKER: ['worker'],
  ARTIST: ['artist'],
  IDOL: ['idol'],
  CLOWN: ['clown'],
  REPORTER: ['reporter'],
  CAMERAMAN: ['cameraman'],
  SOCIALITE: ['socialite', 'madame'],
  MAID: ['maid'],
  ROUGHNECK: ['roughneck'],
  GALACTIC_GRUNT: ['galacticgrunt'],
  DOUBLE_TEAM: ['doubleteam'],
  RICH_BOY: ['richboy'],
  WINSTRATE: ['expert'],
};

function first(candidates: string[], list: Set<string>): string | null {
  return candidates.find((id) => list.has(id)) ?? null;
}

/** The class constant with its person or gender suffix removed. */
function classBase(key: string): string {
  return key
    .replace(/^(LEADER|ELITE_FOUR|EXECUTIVE|COMMANDER|PKMN_TRAINER|RIVAL)_[A-Z]+$/, '$1')
    .replace(/_GS$/, '')
    .replace(/_(M|F|MALE|FEMALE)$/, '');
}

export function spriteFor(row: RawEncounter, role: string): string | null {
  const list = spriteList();
  const suffixes = ERA[row.game];
  const name = row.name.toLowerCase();
  // A named person first: a leader, a champion, a rival, a villain, a frontier brain.
  if (role !== 'route') {
    const bases = NAME_SPRITES[name] ?? [name.replace(/[^a-z0-9]/g, '')];
    const roleVariants = role === 'champion' ? ['champion', ''] : [''];
    const hit = first(
      bases.flatMap((base) => suffixes.flatMap((era) => roleVariants.map((variant) => `${base}${era}${variant}`))),
      list,
    );
    if (hit) return hit;
  }
  // Then the class, by era, gendered variant first.
  const key = row.classKey;
  const female = row.female || /_(F|FEMALE)$/.test(key);
  const bases = CLASS_SPRITES[key] ?? CLASS_SPRITES[classBase(key)] ?? [classBase(key).toLowerCase().replace(/[^a-z0-9]/g, '')];
  const genders = female ? ['f', ''] : ['m', ''];
  return first(
    bases.flatMap((base) => suffixes.flatMap((era) => genders.map((g) => `${base}${g}${era}`))),
    list,
  );
}
