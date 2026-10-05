/**
 * Turn parsed rows into `EncounterRecord`s and write one table per game.
 *
 * The citation is split in two on purpose: the row carries only the label it
 * was read from, and the file carries the repository, paths and revision once
 * as `<GAME>_SOURCE`. Five thousand rows each repeating the same eighty bytes
 * of provenance would be the largest thing in the bundle.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EncounterRecord, EncounterSource, GameId } from '../../src/data/encounters/types';
import type { RawEncounter } from './model';
import { GAME_GEN, GAME_LABEL } from './model';
import { slug } from './names';
import { gymTypeOf, placeOf, roleOf } from './roles';
import { spriteFor } from './sprites';

const OUT = new URL('../../src/data/encounters/', import.meta.url).pathname;

/** Assign ids, roles, places and sprites. Ids number repeats of one name within one game in source order. */
export function toRecords(rows: RawEncounter[]): EncounterRecord[] {
  const counters = new Map<string, number>();
  return rows.map((row) => {
    const role = roleOf(row);
    const stem = `${row.game}/${slug(row.name)}`;
    const n = (counters.get(stem) ?? 0) + 1;
    counters.set(stem, n);
    const record: EncounterRecord = {
      id: `${stem}-${n}`,
      game: row.game,
      gen: GAME_GEN[row.game],
      trainer: { name: row.name, class: row.className, sprite: spriteFor(row, role) },
      role,
      place: placeOf(row, role),
      party: row.party,
      cite: row.cite,
    };
    const gymType = gymTypeOf(row, role);
    if (gymType) record.gymType = gymType;
    if (row.double) record.double = true;
    return record;
  });
}

function literal(record: EncounterRecord): string {
  const party = record.party
    .map((m) => {
      const parts = [`species: '${m.species}'`, `level: ${m.level}`];
      if (m.moves) parts.push(`moves: [${m.moves.map((x) => `'${x}'`).join(', ')}]`);
      if (m.item) parts.push(`item: '${m.item}'`);
      if (m.gender) parts.push(`gender: '${m.gender}'`);
      return `{ ${parts.join(', ')} }`;
    })
    .join(', ');
  const fields = [
    `id: '${record.id}'`,
    `game: '${record.game}'`,
    `gen: ${record.gen}`,
    `trainer: { name: ${JSON.stringify(record.trainer.name)}, class: ${JSON.stringify(record.trainer.class)}, sprite: ${record.trainer.sprite ? `'${record.trainer.sprite}'` : 'null'} }`,
    `role: '${record.role}'`,
    `place: ${JSON.stringify(record.place)}`,
  ];
  if (record.gymType) fields.push(`gymType: '${record.gymType}'`);
  fields.push(`party: [${party}]`);
  if (record.double) fields.push('double: true');
  fields.push(`cite: ${JSON.stringify(record.cite)}`);
  return `  { ${fields.join(', ')} },`;
}

export function emitGame(game: GameId, records: EncounterRecord[], source: EncounterSource): void {
  const constName = game.toUpperCase();
  const body = records.map(literal).join('\n');
  const text = `/**
 * GENERATED FILE — do not hand-edit. Produced by \`npm run gen:encounters\`
 * from ${source.repo} at ${source.sha}. Fix the importer or the pin, then regenerate.
 *
 * ${GAME_LABEL[game]}: ${records.length} encounters. A row's \`cite\` is its label
 * inside the files named below.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRecord, EncounterSource } from './types';

export const ${constName}_SOURCE: EncounterSource = {
  repo: '${source.repo}',
  sha: '${source.sha}',
  files: [${source.files.map((file) => `'${file}'`).join(', ')}],
};

export const ${constName}_ENCOUNTERS: readonly EncounterRecord[] = [
${body}
];
`;
  writeFileSync(join(OUT, `${game}.ts`), text);
}
