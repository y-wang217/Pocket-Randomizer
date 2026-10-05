/**
 * Red/Blue and Yellow: `data/trainers/parties.asm` and `data/trainers/names.asm`.
 *
 * Gen 1 trainers have a class and no name. Each class has one `<Class>Data:`
 * block of `db` rows, one row per trainer, and a comment above a run of rows
 * says where they are (`; Route 3`). A row is either `db level, species...,
 * 0` (every member at one level) or `db $FF, level, species, level, species...,
 * 0`. The class order is the `TrainerDataPointers` table, which is also the
 * order of the class-name list, so the two files zip.
 */
import { readFileSync } from 'node:fs';

import type { GameId } from '../../src/data/encounters/types';
import { must, type RawEncounter } from './model';
import { displayName, speciesId } from './names';
import { sourcePath } from './fetch';

export function parseGen1(repo: 'pokered' | 'pokeyellow', game: GameId): RawEncounter[] {
  const partiesFile = 'data/trainers/parties.asm';
  const parties = readFileSync(sourcePath(repo, partiesFile), 'utf8');
  const names = readFileSync(sourcePath(repo, 'data/trainers/names.asm'), 'utf8');

  const classNames = [...names.matchAll(/^\s*li\s+"([^"]+)"/gm)].map((m) => must(m[1], 'class name'));
  const order = [...parties.matchAll(/^\s*dw\s+(\w+)Data\s*$/gm)].map((m) => must(m[1], 'data pointer'));
  if (order.length !== classNames.length) {
    throw new Error(`${repo}: ${order.length} data pointers but ${classNames.length} class names`);
  }

  const out: RawEncounter[] = [];
  const lines = parties.split('\n');
  let current: { label: string; className: string } | null = null;
  let place: string | undefined;
  let unused = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const label = /^(\w+)Data:/.exec(line);
    if (label) {
      const name = must(label[1], 'data label');
      const index = order.indexOf(name);
      current = index === -1 ? null : { label: name, className: displayName(must(classNames[index], 'class name')) };
      place = undefined;
      unused = false;
      continue;
    }
    const comment = /^\s*;\s*(.+)$/.exec(line);
    if (comment && current) {
      const text = must(comment[1], 'comment').trim();
      unused = /unused/i.test(text);
      if (!unused) place = text;
      continue;
    }
    const row = /^\s*db\s+([^;]+)(?:;\s*(.*))?$/.exec(line);
    if (!row || !current || unused) continue;
    if (row[2]) place = row[2].trim();
    const fields = must(row[1], 'row').split(',').map((f) => f.trim()).filter(Boolean);
    if (fields[fields.length - 1] === '0') fields.pop();
    const party: RawEncounter['party'] = [];
    if (fields[0] === '$FF') {
      for (let i = 1; i + 1 < fields.length; i += 2) {
        party.push({ species: speciesId(must(fields[i + 1], 'species')), level: Number(fields[i]) });
      }
    } else {
      const level = Number(fields[0]);
      for (const species of fields.slice(1)) party.push({ species: speciesId(species), level });
    }
    if (party.length === 0) continue;
    out.push({
      game,
      className: current.className,
      classKey: current.label.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase(),
      name: nameFor(current.label, current.className),
      place,
      party,
      cite: `${current.label}Data`,
    });
  }
  return out;
}

/** Gen 1 bosses are classes of their own; the rival is the player's rival and the games call him Blue. */
function nameFor(label: string, className: string): string {
  if (/^Rival\d$/.test(label)) return 'Blue';
  if (label === 'ProfOak') return 'Professor Oak';
  if (label === 'LtSurge') return 'Lt. Surge';
  if (['Brock', 'Misty', 'Erika', 'Koga', 'Blaine', 'Sabrina', 'Giovanni', 'Lorelei', 'Bruno', 'Agatha', 'Lance'].includes(label)) {
    return label;
  }
  return className;
}
