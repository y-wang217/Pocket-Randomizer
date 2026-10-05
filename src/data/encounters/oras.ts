/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pokemondb.net at 2026-10-05. Fix the importer or the pin, then regenerate.
 *
 * Omega Ruby and Alpha Sapphire: 18 encounters. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const ORAS_SOURCE: EncounterSource = {
  repo: 'pokemondb.net',
  sha: '2026-10-05',
  files: ['omega-ruby-alpha-sapphire/gymleaders-elitefour'],
};

export const ORAS_ROWS: readonly EncounterRow[] = [
  { id: 'oras/roxanne-1', game: 'oras', gen: 6, trainer: { name: "Roxanne", class: "Leader", sprite: 'roxanne-gen6' }, role: 'gym', place: "Rustboro City Gym", gymType: 'Rock', party: "geodude:12|nosepass:14", cite: "#gym-1 Roxanne" },
  { id: 'oras/brawly-1', game: 'oras', gen: 6, trainer: { name: "Brawly", class: "Leader", sprite: 'brawly-gen6' }, role: 'gym', place: "Dewford Town Gym", gymType: 'Fighting', party: "machop:14|makuhita:16", cite: "#gym-2 Brawly" },
  { id: 'oras/wattson-1', game: 'oras', gen: 6, trainer: { name: "Wattson", class: "Leader", sprite: 'wattson' }, role: 'gym', place: "Mauville City Gym", gymType: 'Electric', party: "magnemite:19|voltorb:19|magneton:21", cite: "#gym-3 Wattson" },
  { id: 'oras/flannery-1', game: 'oras', gen: 6, trainer: { name: "Flannery", class: "Leader", sprite: 'flannery-gen6' }, role: 'gym', place: "Lavaridge Town Gym", gymType: 'Fire', party: "slugma:26|numel:26|torkoal:28", cite: "#gym-4 Flannery" },
  { id: 'oras/norman-1', game: 'oras', gen: 6, trainer: { name: "Norman", class: "Leader", sprite: 'norman-gen6' }, role: 'gym', place: "Petalburg City Gym", gymType: 'Normal', party: "slaking:28|vigoroth:28|slaking:30", cite: "#gym-5 Norman" },
  { id: 'oras/winona-1', game: 'oras', gen: 6, trainer: { name: "Winona", class: "Leader", sprite: 'winona-gen6' }, role: 'gym', place: "Fortree City Gym", gymType: 'Flying', party: "swellow:33|pelipper:33|skarmory:33|altaria:35", cite: "#gym-6 Winona" },
  { id: 'oras/tate-and-liza-1', game: 'oras', gen: 6, trainer: { name: "Tate & Liza", class: "Leader", sprite: 'tateandliza-gen6' }, role: 'gym', place: "Mossdeep City Gym", gymType: 'Psychic', party: "lunatone:45|solrock:45", cite: "#gym-7 Liza & Tate" },
  { id: 'oras/wallace-1', game: 'oras', gen: 6, trainer: { name: "Wallace", class: "Leader", sprite: 'wallace-gen6' }, role: 'gym', place: "Sootopolis City Gym", gymType: 'Water', party: "luvdisc:44|whiscash:44|sealeo:44|seaking:44|milotic:46", cite: "#gym-8 Wallace" },
  { id: 'oras/sidney-1', game: 'oras', gen: 6, trainer: { name: "Sidney", class: "Elite Four", sprite: 'sidney' }, role: 'elite', place: "Pokemon League", party: "mightyena:50|shiftry:50|cacturne:50|sharpedo:50|absol:52", cite: "#elite4-1 Sidney" },
  { id: 'oras/sidney-2', game: 'oras', gen: 6, trainer: { name: "Sidney", class: "Elite Four", sprite: 'sidney' }, role: 'elite', place: "Pokemon League", party: "scrafty:70|shiftry:70|sharpedo:70|zoroark:70|mandibuzz:70|absol:72", cite: "#elite4-1 Sidney - rematch" },
  { id: 'oras/phoebe-1', game: 'oras', gen: 6, trainer: { name: "Phoebe", class: "Elite Four", sprite: 'phoebe-gen6' }, role: 'elite', place: "Pokemon League", party: "dusclops:51|banette:51|sableye:51|banette:51|dusknoir:53", cite: "#elite4-2 Phoebe" },
  { id: 'oras/phoebe-2', game: 'oras', gen: 6, trainer: { name: "Phoebe", class: "Elite Four", sprite: 'phoebe-gen6' }, role: 'elite', place: "Pokemon League", party: "banette:71|mismagius:71|drifblim:71|chandelure:71|dusknoir:71|sableye:73", cite: "#elite4-2 Phoebe - rematch" },
  { id: 'oras/glacia-1', game: 'oras', gen: 6, trainer: { name: "Glacia", class: "Elite Four", sprite: 'glacia' }, role: 'elite', place: "Pokemon League", party: "glalie:52|froslass:52|glalie:52|froslass:52|walrein:54", cite: "#elite4-3 Glacia" },
  { id: 'oras/glacia-2', game: 'oras', gen: 6, trainer: { name: "Glacia", class: "Elite Four", sprite: 'glacia' }, role: 'elite', place: "Pokemon League", party: "abomasnow:72|beartic:72|froslass:72|vanilluxe:72|walrein:72|glalie:74", cite: "#elite4-3 Glacia - rematch" },
  { id: 'oras/drake-1', game: 'oras', gen: 6, trainer: { name: "Drake", class: "Elite Four", sprite: 'drake-gen3' }, role: 'elite', place: "Pokemon League", party: "altaria:53|flygon:53|kingdra:53|flygon:53|salamence:55", cite: "#elite4-4 Drake" },
  { id: 'oras/drake-2', game: 'oras', gen: 6, trainer: { name: "Drake", class: "Elite Four", sprite: 'drake-gen3' }, role: 'elite', place: "Pokemon League", party: "altaria:73|dragalge:73|kingdra:73|flygon:73|haxorus:73|salamence:75", cite: "#elite4-4 Drake - rematch" },
  { id: 'oras/steven-1', game: 'oras', gen: 6, trainer: { name: "Steven", class: "Champion", sprite: 'steven-gen6' }, role: 'champion', place: "Pokemon League", party: "skarmory:57|claydol:57|aggron:57|cradily:57|armaldo:57|metagross:59", cite: "#champion-5 Steven" },
  { id: 'oras/steven-2', game: 'oras', gen: 6, trainer: { name: "Steven", class: "Champion", sprite: 'steven-gen6' }, role: 'champion', place: "Pokemon League", party: "skarmory:77|claydol:77|carbink:77|aerodactyl:77|aggron:77|metagross:79", cite: "#champion-5 Steven - rematch" },
];
