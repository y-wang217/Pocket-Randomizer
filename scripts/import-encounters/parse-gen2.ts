/**
 * Gold/Silver and Crystal: `data/trainers/parties.asm` and `data/trainers/class_names.asm`.
 *
 * Each class is a `<Class>Group:` block. Each trainer in it opens with
 * `db "NAME@", TRAINERTYPE_*` and closes with `db -1`; the rows between are
 * `db level, species[, item][, move x4]` depending on the type. The class
 * names list is in class order, which is the group order in the file.
 */
import { readFileSync } from 'node:fs';

import type { GameId } from '../../src/data/encounters/types';
import { must, type RawEncounter } from './model';
import { displayName, itemId, moveId, speciesId } from './names';
import { sourcePath } from './fetch';

export function parseGen2(repo: 'pokegold' | 'pokecrystal', game: GameId): RawEncounter[] {
  const partiesFile = 'data/trainers/parties.asm';
  const parties = readFileSync(sourcePath(repo, partiesFile), 'utf8');
  const names = readFileSync(sourcePath(repo, 'data/trainers/class_names.asm'), 'utf8');
  const classNames = [...names.matchAll(/^\s*li\s+"([^"]+)"/gm)].map((m) => displayName(must(m[1], 'class name')));

  const out: RawEncounter[] = [];
  let group: { label: string; className: string } | null = null;
  let groupIndex = -1;
  let trainer: { name: string; type: string } | null = null;
  let party: RawEncounter['party'] = [];

  for (const raw of parties.split('\n')) {
    const line = raw.trim();
    const header = /^(\w+)Group:/.exec(line);
    if (header) {
      groupIndex += 1;
      const label = must(header[1], 'group label');
      group = { label, className: classNames[groupIndex] ?? label };
      continue;
    }
    if (!group) continue;
    const open = /^db\s+"([^"]*)",\s*(TRAINERTYPE_\w+)/.exec(line);
    if (open) {
      trainer = { name: must(open[1], 'trainer name'), type: must(open[2], 'trainer type') };
      party = [];
      continue;
    }
    if (/^db\s+-1/.test(line)) {
      if (trainer && party.length > 0) {
        out.push({
          game,
          className: group.className,
          classKey: group.label.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase(),
          name: nameFor(group.label, trainer.name, group.className),
          party,
          cite: `${group.label}Group "${trainer.name}"`,
        });
      }
      trainer = null;
      continue;
    }
    const row = /^db\s+([^;]+)/.exec(line);
    if (!row || !trainer) continue;
    const fields = must(row[1], 'row').split(',').map((f) => f.trim()).filter(Boolean);
    const level = Number(fields[0]);
    const species = speciesId(must(fields[1], 'species'));
    let cursor = 2;
    const member: RawEncounter['party'][number] = { species, level };
    if (trainer.type === 'TRAINERTYPE_ITEM' || trainer.type === 'TRAINERTYPE_ITEM_MOVES') {
      const item = itemId(must(fields[cursor], 'item'));
      if (item) member.item = item;
      cursor += 1;
    }
    if (trainer.type === 'TRAINERTYPE_MOVES' || trainer.type === 'TRAINERTYPE_ITEM_MOVES') {
      const moves = fields.slice(cursor, cursor + 4).map(moveId).filter((m): m is string => m !== null);
      if (moves.length > 0) member.moves = moves;
    }
    party.push(member);
  }
  return out;
}

function nameFor(group: string, raw: string, className: string): string {
  if (/^Rival\d$/.test(group)) return 'Silver';
  if (group === 'PokemonProf') return 'Professor Oak';
  if (raw === '?' || raw === '') return className;
  return displayName(raw);
}
