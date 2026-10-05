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
import { decodeParty, encodeParty } from '../../src/data/encounters/types';
import type { RawEncounter } from './model';
import { GAME_GEN, GAME_LABEL } from './model';
import { slug } from './names';
import { classOf, gymTypeOf, placeOf, roleOf } from './roles';
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
      trainer: { name: row.name, class: classOf(row, role), sprite: spriteFor(row, role) },
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

/** The row's party string, proven to decode back to the record before it is written. */
function encodedParty(record: EncounterRecord): string {
  const encoded = encodeParty(record.party);
  const back = decodeParty(encoded, record.id);
  const canon = (party: readonly EncounterRecord['party'][number][]) =>
    JSON.stringify(party.map((m) => [m.species, m.level, m.item ?? null, m.moves && m.moves.length > 0 ? [...m.moves] : null, m.gender ?? null]));
  if (canon(back) !== canon(record.party)) throw new Error(`Encounter ${record.id}: party does not round-trip through its encoding`);
  return encoded;
}

function literal(record: EncounterRecord): string {
  const party = JSON.stringify(encodedParty(record));
  const fields = [
    `id: '${record.id}'`,
    `game: '${record.game}'`,
    `gen: ${record.gen}`,
    `trainer: { name: ${JSON.stringify(record.trainer.name)}, class: ${JSON.stringify(record.trainer.class)}, sprite: ${record.trainer.sprite ? `'${record.trainer.sprite}'` : 'null'} }`,
    `role: '${record.role}'`,
    `place: ${JSON.stringify(record.place)}`,
  ];
  if (record.gymType) fields.push(`gymType: '${record.gymType}'`);
  fields.push(`party: ${party}`);
  if (record.double) fields.push('double: true');
  fields.push(`cite: ${JSON.stringify(record.cite)}`);
  return `  { ${fields.join(', ')} },`;
}

/**
 * Write a game's tables: the bosses, rivals, leaders, Elite Four and
 * villains in `<game>.ts`, and the route trainers, where the game has any,
 * in `<game>-routes.ts`. **Checkpoint 9.** The split is the bundle seam:
 * `index.ts` imports the first statically and the host installs the second
 * (`full.ts`) before any run, so four fifths of the library's bytes are a
 * chunk of their own. Ids, order and content are unchanged by the split.
 */
export function emitGame(game: GameId, records: EncounterRecord[], source: EncounterSource): void {
  const routes = records.filter((record) => record.role === 'route');
  const bosses = records.filter((record) => record.role !== 'route');
  writeFileSync(join(OUT, `${game}.ts`), fileText(game, bosses, source, 'ROWS', routes.length));
  if (routes.length > 0) writeFileSync(join(OUT, `${game}-routes.ts`), fileText(game, routes, source, 'ROUTE_ROWS', 0));
}

function fileText(game: GameId, records: EncounterRecord[], source: EncounterSource, suffix: 'ROWS' | 'ROUTE_ROWS', routesElsewhere: number): string {
  const constName = game.toUpperCase();
  const body = records.map(literal).join('\n');
  const what =
    suffix === 'ROUTE_ROWS'
      ? `${GAME_LABEL[game]}: ${records.length} route trainers, the half of the game the host
 * installs before a run (\`full.ts\`); the bosses are in \`${game}.ts\`.`
      : routesElsewhere > 0
        ? `${GAME_LABEL[game]}: ${records.length} encounters, the bosses, rivals, leaders, Elite Four
 * and villains; its ${routesElsewhere} route trainers are in \`${game}-routes.ts\`.`
        : `${GAME_LABEL[game]}: ${records.length} encounters.`;
  return `/**
 * GENERATED FILE — do not hand-edit. Produced by \`npm run gen:encounters\`
 * from ${source.repo} at ${source.sha}. Fix the importer or the pin, then regenerate.
 *
 * ${what} A row's \`cite\` is its label
 * inside the files named below. A row's \`party\` is one string per the grammar
 * in \`types.ts\` (\`species:level[@item][>moves][#gender]\`, members on \`|\`),
 * decoded once at load by \`index.ts\`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const ${constName}_SOURCE: EncounterSource = {
  repo: '${source.repo}',
  sha: '${source.sha}',
  files: [${source.files.map((file) => `'${file}'`).join(', ')}],
};

export const ${constName}_${suffix}: readonly EncounterRow[] = [
${body}
];
`;
}
