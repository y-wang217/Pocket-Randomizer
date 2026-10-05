/**
 * Platinum and HeartGold/SoulSilver.
 *
 * Platinum is one JSON file per trainer under `res/trainers/data/`, named
 * `<class>_<name>[_<place>][_rematch].json`, with the class constant, the
 * shown name, the items and a party whose members carry `species`, `form`,
 * `level`, `item` and the explicitly set `moves`. HeartGold/SoulSilver is a
 * single `trainers.json` of the same information with `{TRNAME}` prefixed to
 * every name.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { PartyMember } from '../../src/data/encounters/types';
import type { RawEncounter } from './model';
import { displayName, itemId, moveId, speciesId, titleCase } from './names';
import { sourcePath } from './fetch';

interface Gen4Member {
  species: string;
  form?: number;
  level: number;
  item?: string | null;
  moves?: string[];
}

interface Gen4Trainer {
  name: string;
  class: string;
  items?: string[];
  double?: boolean | number;
  double_battle?: boolean;
  party: Gen4Member[];
}

function member(raw: Gen4Member): PartyMember {
  const out: PartyMember = { species: speciesId(raw.species, raw.form ?? 0), level: raw.level };
  if (raw.item) {
    const id = itemId(raw.item);
    if (id) out.item = id;
  }
  if (raw.moves) {
    const ids = raw.moves.map(moveId).filter((m): m is string => m !== null);
    if (ids.length > 0) out.moves = ids;
  }
  return out;
}

export function parsePlatinum(): RawEncounter[] {
  const dir = sourcePath('pokeplatinum', 'res/trainers/data');
  const out: RawEncounter[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.json') || file.startsWith('dummy')) continue;
    const json = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Gen4Trainer;
    if (!json.party || json.party.length === 0) continue;
    const classKey = json.class.replace('TRAINER_CLASS_', '');
    // The player's own data and the five partners (Cheryl, Mira, Riley, Buck, Marley) are never opponents.
    if (/^(DP_PLAYER|PLAYER)_/.test(classKey) || /^TRAINER_(BUCK|CHERYL|MARLEY|MIRA|RILEY)$/.test(classKey)) continue;
    const stem = file.replace(/\.json$/, '');
    out.push({
      game: 'platinum',
      className: platinumClassName(classKey),
      classKey,
      name: platinumName(classKey, json.name),
      place: platinumPlace(stem, json.name),
      party: json.party.map(member),
      double: json.double_battle ? true : undefined,
      female: /_FEMALE$/.test(classKey) || undefined,
      cite: `pret/pokeplatinum res/trainers/data/${file}`,
    });
  }
  return out;
}

/** `LEADER_ROARK` is shown as `Leader`; the person is the name field. */
function platinumClassName(classKey: string): string {
  if (classKey === 'PI') return 'PI';
  const generic = classKey
    .replace(/_(ROARK|GARDENIA|MAYLENE|WAKE|FANTINA|BYRON|CANDICE|VOLKNER|CYNTHIA|AARON|BERTHA|FLINT|LUCIAN|MARS|JUPITER|SATURN)$/, '')
    .replace(/_(MALE|FEMALE)$/, '')
    .replace(/^BREEDER$/, 'POKEMON_BREEDER')
    .replace(/^RANGER$/, 'POKEMON_RANGER');
  return titleCase(generic);
}

function platinumName(classKey: string, raw: string): string {
  if (classKey === 'RIVAL' || raw === 'Cedric') return 'Barry';
  return displayName(raw);
}

/** The file stem carries the place for rivals and bosses: `rival_canalave_city_chimchar`. */
function platinumPlace(stem: string, name: string): string | undefined {
  const parts = stem.split('_');
  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const after = stem.indexOf(nameSlug) === -1 ? [] : stem.slice(stem.indexOf(nameSlug) + nameSlug.length + 1).split('_').filter(Boolean);
  const words = after.filter((w) => !/^(rematch|\d+|chimchar|piplup|turtwig)$/.test(w));
  if (words.length === 0) return undefined;
  if (parts[0] === 'rival' || parts[0] === 'dp') return titleCase(words.join(' '));
  return titleCase(words.join(' '));
}

export function parseHgss(): RawEncounter[] {
  const file = 'files/poketool/trainer/trainers.json';
  const json = JSON.parse(readFileSync(sourcePath('pokeheartgold', file), 'utf8')) as { trainers: Gen4Trainer[] };
  const out: RawEncounter[] = [];
  json.trainers.forEach((trainer, index) => {
    if (!trainer.party || trainer.party.length === 0) return;
    const classKey = trainer.class.replace('TRAINERCLASS_', '');
    const name = displayName(trainer.name);
    if (!name || name === '-') return;
    // The protagonists' own data and the Ethan/Lyra partner entries are never opponents.
    if (/^PKMN_TRAINER_(ETHAN|LYRA)$/.test(classKey) || classKey === 'PASSERBY') return;
    out.push({
      game: 'hgss',
      className: hgssClassName(classKey),
      classKey,
      name: classKey === 'RIVAL' ? 'Silver' : name,
      party: trainer.party.map(member),
      double: trainer.double ? true : undefined,
      female: /_F$/.test(classKey) || undefined,
      cite: `pret/pokeheartgold ${file} trainers[${index}]`,
    });
  });
  return out;
}

function hgssClassName(classKey: string): string {
  const generic = classKey
    .replace(/^LEADER_\w+$/, 'LEADER')
    .replace(/^ELITE_FOUR_\w+$/, 'ELITE_FOUR')
    .replace(/^EXECUTIVE_\w+$/, 'EXECUTIVE')
    .replace(/^PKMN_TRAINER_\w+$/, 'PKMN_TRAINER')
    .replace(/_GS$/, '')
    .replace(/_F$/, '');
  return titleCase(generic);
}
