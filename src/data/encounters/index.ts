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
 * champions, rivals and villains, with levels and no set moves; Sword and
 * Shield's Champion Cup from Serebii the same way.
 *
 * The game files carry each party as one string (`types.ts`, `EncounterRow`)
 * and this file decodes them once at load. Nothing below this line sees a
 * row, so the encoding is a bundle-size fact and not a draw fact.
 */
import { B2W2_ROWS, B2W2_SOURCE } from './b2w2';
import { BDSP_ROWS, BDSP_SOURCE } from './bdsp';
import { BW_ROWS, BW_SOURCE } from './bw';
import { CRYSTAL_ROWS, CRYSTAL_SOURCE } from './crystal';
import { EMERALD_ROWS, EMERALD_SOURCE } from './emerald';
import { FRLG_ROWS, FRLG_SOURCE } from './frlg';
import { GS_ROWS, GS_SOURCE } from './gs';
import { HGSS_ROWS, HGSS_SOURCE } from './hgss';
import { LGPE_ROWS, LGPE_SOURCE } from './lgpe';
import { ORAS_ROWS, ORAS_SOURCE } from './oras';
import { PLATINUM_ROWS, PLATINUM_SOURCE } from './platinum';
import { RBY_ROWS, RBY_SOURCE } from './rby';
import { RS_ROWS, RS_SOURCE } from './rs';
import { SM_ROWS, SM_SOURCE } from './sm';
import { SV_ROWS, SV_SOURCE } from './sv';
import { SWSH_ROWS, SWSH_SOURCE } from './swsh';
import type { EncounterRecord, EncounterRow, EncounterSource, GameId } from './types';
import { decodeRow } from './types';
import { USUM_ROWS, USUM_SOURCE } from './usum';
import { XY_ROWS, XY_SOURCE } from './xy';
import { YELLOW_ROWS, YELLOW_SOURCE } from './yellow';

export type { EncounterRecord, EncounterRow, EncounterSource, GameId, PartyMember, TrainerRole } from './types';
export { GAME_LABEL, decodeParty, encodeParty } from './types';

export interface EncounterTable {
  source: EncounterSource;
  records: readonly EncounterRecord[];
}

/** One game's rows decoded, once, at load: the only place a row becomes a record. */
function table(source: EncounterSource, rows: readonly EncounterRow[]): EncounterTable {
  return { source, records: rows.map(decodeRow) };
}

/** Every game's table, keyed by game, with where it came from. */
export const ENCOUNTER_TABLES: Readonly<Record<GameId, EncounterTable>> = {
  rby: table(RBY_SOURCE, RBY_ROWS),
  yellow: table(YELLOW_SOURCE, YELLOW_ROWS),
  gs: table(GS_SOURCE, GS_ROWS),
  crystal: table(CRYSTAL_SOURCE, CRYSTAL_ROWS),
  rs: table(RS_SOURCE, RS_ROWS),
  emerald: table(EMERALD_SOURCE, EMERALD_ROWS),
  frlg: table(FRLG_SOURCE, FRLG_ROWS),
  platinum: table(PLATINUM_SOURCE, PLATINUM_ROWS),
  hgss: table(HGSS_SOURCE, HGSS_ROWS),
  bw: table(BW_SOURCE, BW_ROWS),
  b2w2: table(B2W2_SOURCE, B2W2_ROWS),
  xy: table(XY_SOURCE, XY_ROWS),
  oras: table(ORAS_SOURCE, ORAS_ROWS),
  sm: table(SM_SOURCE, SM_ROWS),
  usum: table(USUM_SOURCE, USUM_ROWS),
  lgpe: table(LGPE_SOURCE, LGPE_ROWS),
  swsh: table(SWSH_SOURCE, SWSH_ROWS),
  bdsp: table(BDSP_SOURCE, BDSP_ROWS),
  sv: table(SV_SOURCE, SV_ROWS),
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
