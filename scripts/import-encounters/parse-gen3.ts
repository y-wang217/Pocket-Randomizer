/**
 * Ruby/Sapphire, Emerald and FireRed/LeafGreen: `src/data/trainers*.h`,
 * `src/data/trainer_parties.h` and the class-name text table.
 *
 * `gTrainers[]` is one designated initialiser per trainer with the class
 * constant, the shown name, the bag items, a doubles flag and a pointer to a
 * party array. The party arrays are structs of `.lvl`/`.level`, `.species`,
 * and depending on the struct kind `.heldItem` and `.moves`. The three
 * repositories differ only in spelling: Ruby's parties are `gTrainerParty_*`
 * and its initialiser is `{.NoItemDefaultMoves = ...}`, Emerald's and
 * FireRed's are `sParty_*` behind a macro.
 */
import { readFileSync } from 'node:fs';

import type { GameId, PartyMember } from '../../src/data/encounters/types';
import { must, type RawEncounter } from './model';
import { displayName, itemId, moveId, speciesId, titleCase } from './names';
import { sourcePath } from './fetch';

interface Gen3Files {
  trainers: string;
  parties: string;
  classNames: string;
}

const FILES: Record<'pokeruby' | 'pokeemerald' | 'pokefirered', Gen3Files> = {
  pokeruby: {
    trainers: 'src/data/trainers_en.h',
    parties: 'src/data/trainer_parties.h',
    classNames: 'src/data/text/trainer_class_names_en.h',
  },
  pokeemerald: {
    trainers: 'src/data/trainers.h',
    parties: 'src/data/trainer_parties.h',
    classNames: 'src/data/text/trainer_class_names.h',
  },
  pokefirered: {
    trainers: 'src/data/trainers.h',
    parties: 'src/data/trainer_parties.h',
    classNames: 'src/data/text/trainer_class_names.h',
  },
};

function parseParties(text: string): Map<string, PartyMember[]> {
  const parties = new Map<string, PartyMember[]>();
  const blocks = text.split(/(?=(?:static )?const struct TrainerMon\w+ \w+\[\] = \{)/);
  for (const block of blocks) {
    const head = /const struct TrainerMon\w+ (\w+)\[\] = \{/.exec(block);
    if (!head) continue;
    const partyName = must(head[1], 'party name');
    const members: PartyMember[] = [];
    for (const chunk of block.matchAll(/\{\s*\.iv[^}]*\}/g)) {
      const body = chunk[0];
      const level = /\.(?:lvl|level)\s*=\s*(\d+)/.exec(body);
      const species = /\.species\s*=\s*(SPECIES_\w+)/.exec(body);
      if (!level || !species) throw new Error(`Unreadable party member in ${partyName}: ${body}`);
      const member: PartyMember = { species: speciesId(must(species[1], 'species')), level: Number(level[1]) };
      const item = /\.heldItem\s*=\s*(ITEM_\w+)/.exec(body);
      if (item) {
        const id = itemId(must(item[1], 'item'));
        if (id) member.item = id;
      }
      const moves = /\.moves\s*=\s*\{([^}]*)\}/.exec(body);
      if (moves) {
        const ids = must(moves[1], 'moves')
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
          .map(moveId)
          .filter((m): m is string => m !== null);
        if (ids.length > 0) member.moves = ids;
      }
      members.push(member);
    }
    parties.set(partyName, members);
  }
  return parties;
}

function parseClassNames(text: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const m of text.matchAll(/\[(TRAINER_CLASS_\w+)\]\s*=\s*_\("([^"]*)"\)/g)) {
    names.set(must(m[1], 'class constant'), titleCase(must(m[2], 'class text')));
  }
  return names;
}

export function parseGen3(repo: keyof typeof FILES, game: GameId): RawEncounter[] {
  const files = FILES[repo];
  const trainersText = readFileSync(sourcePath(repo, files.trainers), 'utf8');
  const parties = parseParties(readFileSync(sourcePath(repo, files.parties), 'utf8'));
  const classNames = parseClassNames(readFileSync(sourcePath(repo, files.classNames), 'utf8'));

  const out: RawEncounter[] = [];
  const entries = trainersText.split(/(?=\[TRAINER_\w+\]\s*=)/);
  for (const entry of entries) {
    const id = /^\[(TRAINER_\w+)\]/.exec(entry);
    if (!id || id[1] === 'TRAINER_NONE') continue;
    const classConst = /\.trainerClass\s*=\s*(TRAINER_CLASS_\w+)/.exec(entry);
    const name = /\.trainerName\s*=\s*_\("([^"]*)"\)/.exec(entry);
    const partyRef = /\.party\s*=\s*(?:\{\s*\.\w+\s*=\s*|\w+\()\s*(\w+)/.exec(entry);
    const double = /\.doubleBattle\s*=\s*TRUE/.test(entry);
    const female = /F_TRAINER_FEMALE/.test(entry);
    if (!classConst || !name || !partyRef) continue;
    const trainerId = must(id[1], 'trainer id');
    const partyName = must(partyRef[1], 'party reference');
    const party = parties.get(partyName);
    if (!party) throw new Error(`${repo}: ${trainerId} points at missing party ${partyName}`);
    if (party.length === 0) continue;
    const classConstant = must(classConst[1], 'class constant');
    const classKey = classConstant.replace('TRAINER_CLASS_', '');
    // The protagonist's own roster, used as a partner in the Mossdeep double battle. Never an opponent.
    if (classKey === 'RS_PROTAG') continue;
    out.push({
      game,
      className: classNames.get(classConstant) ?? titleCase(classKey),
      classKey,
      name: nameFor(game, classKey, must(name[1], 'trainer name')),
      party: party.map((member) => ({ ...member })),
      double: double || undefined,
      female: female || undefined,
      cite: `pret/${repo} ${files.trainers} ${trainerId}`,
    });
  }
  return out;
}

/** The games' placeholder rival names, and the shout-case everything else is written in. */
function nameFor(game: GameId, classKey: string, raw: string): string {
  if (game === 'frlg' && (classKey.startsWith('RIVAL') || classKey === 'CHAMPION')) return 'Blue';
  if (raw === 'TERRY') return 'Blue';
  // Ruby's Magma admins have no name in the table; the class is what the game shows.
  if (raw.trim() === '') return titleCase(classKey);
  return displayName(raw);
}
