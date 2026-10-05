/**
 * The encounter library, whole. **Stage 6.0.**
 *
 * One table per game under this directory; this file is the sum of them, in
 * id order, so that anything drawing from the library reads one stable
 * sequence whatever order the game files are listed in. The query and fit
 * layer that turns a record into a GYMRUN team arrives with the `core/`
 * wiring and sits beside this; until then the library is a record.
 */
import { CRYSTAL_ENCOUNTERS, CRYSTAL_SOURCE } from './crystal';
import { EMERALD_ENCOUNTERS, EMERALD_SOURCE } from './emerald';
import { FRLG_ENCOUNTERS, FRLG_SOURCE } from './frlg';
import { GS_ENCOUNTERS, GS_SOURCE } from './gs';
import { HGSS_ENCOUNTERS, HGSS_SOURCE } from './hgss';
import { PLATINUM_ENCOUNTERS, PLATINUM_SOURCE } from './platinum';
import { RBY_ENCOUNTERS, RBY_SOURCE } from './rby';
import { RS_ENCOUNTERS, RS_SOURCE } from './rs';
import type { EncounterRecord, EncounterSource, GameId } from './types';
import { YELLOW_ENCOUNTERS, YELLOW_SOURCE } from './yellow';

export type { EncounterRecord, EncounterSource, GameId, PartyMember, TrainerRole } from './types';

/** Every game's table, keyed by game, with where it came from. */
export const ENCOUNTER_TABLES: Readonly<Partial<Record<GameId, { source: EncounterSource; records: readonly EncounterRecord[] }>>> = {
  rby: { source: RBY_SOURCE, records: RBY_ENCOUNTERS },
  yellow: { source: YELLOW_SOURCE, records: YELLOW_ENCOUNTERS },
  gs: { source: GS_SOURCE, records: GS_ENCOUNTERS },
  crystal: { source: CRYSTAL_SOURCE, records: CRYSTAL_ENCOUNTERS },
  rs: { source: RS_SOURCE, records: RS_ENCOUNTERS },
  emerald: { source: EMERALD_SOURCE, records: EMERALD_ENCOUNTERS },
  frlg: { source: FRLG_SOURCE, records: FRLG_ENCOUNTERS },
  platinum: { source: PLATINUM_SOURCE, records: PLATINUM_ENCOUNTERS },
  hgss: { source: HGSS_SOURCE, records: HGSS_ENCOUNTERS },
};

/** The whole library in id order. The order is the draw order, so it is sorted here and not left to the import list. */
export const ENCOUNTERS: readonly EncounterRecord[] = Object.values(ENCOUNTER_TABLES)
  .flatMap((table) => table.records)
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const byId = new Map(ENCOUNTERS.map((record) => [record.id, record]));

/** One record by id, or null. A missing id is a data error upstream, never a draw. */
export function encounterById(id: string): EncounterRecord | null {
  return byId.get(id) ?? null;
}
