/**
 * The Gen 1 to 4 route trainers, the half of the library the main chunk does
 * not carry. **Checkpoint 9.** Imported by `full.ts` alone; `index.ts` never
 * imports this file, which is what keeps it out of the main chunk. The nine
 * files are generated beside their games' boss files.
 */
import { CRYSTAL_ROUTE_ROWS } from './crystal-routes';
import { EMERALD_ROUTE_ROWS } from './emerald-routes';
import { FRLG_ROUTE_ROWS } from './frlg-routes';
import { GS_ROUTE_ROWS } from './gs-routes';
import { HGSS_ROUTE_ROWS } from './hgss-routes';
import { PLATINUM_ROUTE_ROWS } from './platinum-routes';
import { RBY_ROUTE_ROWS } from './rby-routes';
import { RS_ROUTE_ROWS } from './rs-routes';
import type { EncounterRow, GameId } from './types';
import { YELLOW_ROUTE_ROWS } from './yellow-routes';

export const ROUTE_TABLES: Readonly<Partial<Record<GameId, readonly EncounterRow[]>>> = {
  rby: RBY_ROUTE_ROWS,
  yellow: YELLOW_ROUTE_ROWS,
  gs: GS_ROUTE_ROWS,
  crystal: CRYSTAL_ROUTE_ROWS,
  rs: RS_ROUTE_ROWS,
  emerald: EMERALD_ROUTE_ROWS,
  frlg: FRLG_ROUTE_ROWS,
  platinum: PLATINUM_ROUTE_ROWS,
  hgss: HGSS_ROUTE_ROWS,
};
