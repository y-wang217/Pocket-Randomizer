/**
 * The encounter library, whole. **Stage 6.0.**
 *
 * One table per game under this directory; this file is the sum of them, in
 * id order, so that anything drawing from the library reads one stable
 * sequence whatever order the game files are listed in. The query and fit
 * layer that turns a record into a GYMRUN team arrives with the `core/`
 * wiring and sits beside this; until then the library is a record.
 *
 * Gen 1 to 4 are read from the pret decompilations at a pinned revision,
 * every trainer in the game. Gen 5 to 9 are read from pokemondb's roster
 * pages on a pinned date: the gym leaders, kahunas, captains, Elite Four,
 * champions, rivals and villains, with levels and no set moves.
 */
import { B2W2_ENCOUNTERS, B2W2_SOURCE } from './b2w2';
import { BDSP_ENCOUNTERS, BDSP_SOURCE } from './bdsp';
import { BW_ENCOUNTERS, BW_SOURCE } from './bw';
import { CRYSTAL_ENCOUNTERS, CRYSTAL_SOURCE } from './crystal';
import { EMERALD_ENCOUNTERS, EMERALD_SOURCE } from './emerald';
import { FRLG_ENCOUNTERS, FRLG_SOURCE } from './frlg';
import { GS_ENCOUNTERS, GS_SOURCE } from './gs';
import { HGSS_ENCOUNTERS, HGSS_SOURCE } from './hgss';
import { LGPE_ENCOUNTERS, LGPE_SOURCE } from './lgpe';
import { ORAS_ENCOUNTERS, ORAS_SOURCE } from './oras';
import { PLATINUM_ENCOUNTERS, PLATINUM_SOURCE } from './platinum';
import { RBY_ENCOUNTERS, RBY_SOURCE } from './rby';
import { RS_ENCOUNTERS, RS_SOURCE } from './rs';
import { SM_ENCOUNTERS, SM_SOURCE } from './sm';
import { SV_ENCOUNTERS, SV_SOURCE } from './sv';
import { SWSH_ENCOUNTERS, SWSH_SOURCE } from './swsh';
import type { EncounterRecord, EncounterSource, GameId } from './types';
import { USUM_ENCOUNTERS, USUM_SOURCE } from './usum';
import { XY_ENCOUNTERS, XY_SOURCE } from './xy';
import { YELLOW_ENCOUNTERS, YELLOW_SOURCE } from './yellow';

export type { EncounterRecord, EncounterSource, GameId, PartyMember, TrainerRole } from './types';

export interface EncounterTable {
  source: EncounterSource;
  records: readonly EncounterRecord[];
}

/** Every game's table, keyed by game, with where it came from. */
export const ENCOUNTER_TABLES: Readonly<Record<GameId, EncounterTable>> = {
  rby: { source: RBY_SOURCE, records: RBY_ENCOUNTERS },
  yellow: { source: YELLOW_SOURCE, records: YELLOW_ENCOUNTERS },
  gs: { source: GS_SOURCE, records: GS_ENCOUNTERS },
  crystal: { source: CRYSTAL_SOURCE, records: CRYSTAL_ENCOUNTERS },
  rs: { source: RS_SOURCE, records: RS_ENCOUNTERS },
  emerald: { source: EMERALD_SOURCE, records: EMERALD_ENCOUNTERS },
  frlg: { source: FRLG_SOURCE, records: FRLG_ENCOUNTERS },
  platinum: { source: PLATINUM_SOURCE, records: PLATINUM_ENCOUNTERS },
  hgss: { source: HGSS_SOURCE, records: HGSS_ENCOUNTERS },
  bw: { source: BW_SOURCE, records: BW_ENCOUNTERS },
  b2w2: { source: B2W2_SOURCE, records: B2W2_ENCOUNTERS },
  xy: { source: XY_SOURCE, records: XY_ENCOUNTERS },
  oras: { source: ORAS_SOURCE, records: ORAS_ENCOUNTERS },
  sm: { source: SM_SOURCE, records: SM_ENCOUNTERS },
  usum: { source: USUM_SOURCE, records: USUM_ENCOUNTERS },
  lgpe: { source: LGPE_SOURCE, records: LGPE_ENCOUNTERS },
  swsh: { source: SWSH_SOURCE, records: SWSH_ENCOUNTERS },
  bdsp: { source: BDSP_SOURCE, records: BDSP_ENCOUNTERS },
  sv: { source: SV_SOURCE, records: SV_ENCOUNTERS },
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
