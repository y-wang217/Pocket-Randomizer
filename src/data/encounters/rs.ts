/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pret/pokeruby at 5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f. Fix the importer or the pin, then regenerate.
 *
 * Ruby and Sapphire: 61 encounters, the bosses, rivals, leaders, Elite Four
 * and villains; its 632 route trainers are in `rs-routes.ts`. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const RS_SOURCE: EncounterSource = {
  repo: 'pret/pokeruby',
  sha: '5784633ce4ef7ade1a7f2d2d0c288e3d5e6cdd7f',
  files: ['src/data/trainers_en.h', 'src/data/trainer_parties.h', 'src/data/text/trainer_class_names_en.h'],
};

export const RS_ROWS: readonly EncounterRow[] = [
  { id: 'rs/archie-1', game: 'rs', gen: 3, trainer: { name: "Archie", class: "Aqua Leader", sprite: 'archie-gen3' }, role: 'boss', place: "Hoenn", party: "huntail:17|sharpedo:17", cite: "TRAINER_ARCHIE_1" },
  { id: 'rs/aqua-admin-1', game: 'rs', gen: 3, trainer: { name: "Aqua Admin", class: "Aqua Admin", sprite: 'aquagrunt-rse' }, role: 'boss', place: "Hoenn", party: "wailmer:30|pelipper:30", cite: "TRAINER_ANONYMOUS_1" },
  { id: 'rs/matt-1', game: 'rs', gen: 3, trainer: { name: "Matt", class: "Aqua Admin", sprite: 'matt-gen3' }, role: 'boss', place: "Hoenn", party: "carvanha:32|mightyena:32|sharpedo:32", cite: "TRAINER_MATT_1" },
  { id: 'rs/matt-2', game: 'rs', gen: 3, trainer: { name: "Matt", class: "Aqua Admin", sprite: 'matt-gen3' }, role: 'boss', place: "Hoenn", party: "carvanha:20|poochyena:20|carvanha:20", cite: "TRAINER_MATT_2" },
  { id: 'rs/shelly-1', game: 'rs', gen: 3, trainer: { name: "Shelly", class: "Aqua Admin", sprite: 'shelly-gen3' }, role: 'boss', place: "Hoenn", party: "carvanha:28|mightyena:28", cite: "TRAINER_SHELLY_1" },
  { id: 'rs/shelly-2', game: 'rs', gen: 3, trainer: { name: "Shelly", class: "Aqua Admin", sprite: 'shelly-gen3' }, role: 'boss', place: "Hoenn", party: "sharpedo:38|mightyena:38", cite: "TRAINER_SHELLY_2" },
  { id: 'rs/archie-2', game: 'rs', gen: 3, trainer: { name: "Archie", class: "Aqua Leader", sprite: 'archie-gen3' }, role: 'boss', place: "Hoenn", party: "mightyena:41|crobat:41|sharpedo:43", cite: "TRAINER_ARCHIE_2" },
  { id: 'rs/archie-3', game: 'rs', gen: 3, trainer: { name: "Archie", class: "Aqua Leader", sprite: 'archie-gen3' }, role: 'boss', place: "Hoenn", party: "mightyena:24|golbat:24|sharpedo:25", cite: "TRAINER_ARCHIE_3" },
  { id: 'rs/sidney-1', game: 'rs', gen: 3, trainer: { name: "Sidney", class: "Elite Four", sprite: 'sidney-gen3' }, role: 'elite', place: "Ever Grande City", party: "mightyena:46|shiftry:48|cacturne:46|sharpedo:48|absol:49@sitrusberry", cite: "TRAINER_SIDNEY" },
  { id: 'rs/phoebe-1', game: 'rs', gen: 3, trainer: { name: "Phoebe", class: "Elite Four", sprite: 'phoebe-gen3' }, role: 'elite', place: "Ever Grande City", party: "dusclops:48|banette:49|sableye:50|banette:49|dusclops:51@sitrusberry", cite: "TRAINER_PHOEBE" },
  { id: 'rs/glacia-1', game: 'rs', gen: 3, trainer: { name: "Glacia", class: "Elite Four", sprite: 'glacia-gen3' }, role: 'elite', place: "Ever Grande City", party: "glalie:50|sealeo:50|sealeo:52|glalie:52|walrein:53@sitrusberry", cite: "TRAINER_GLACIA" },
  { id: 'rs/drake-1', game: 'rs', gen: 3, trainer: { name: "Drake", class: "Elite Four", sprite: 'drake-gen3' }, role: 'elite', place: "Ever Grande City", party: "shelgon:52|altaria:54|flygon:53|flygon:53|salamence:55@sitrusberry", cite: "TRAINER_DRAKE" },
  { id: 'rs/roxanne-1', game: 'rs', gen: 3, trainer: { name: "Roxanne", class: "Leader", sprite: 'roxanne-gen3' }, role: 'gym', place: "Rustboro City Gym", gymType: 'Rock', party: "geodude:14|nosepass:15", cite: "TRAINER_ROXANNE" },
  { id: 'rs/brawly-1', game: 'rs', gen: 3, trainer: { name: "Brawly", class: "Leader", sprite: 'brawly-gen3' }, role: 'gym', place: "Dewford Town Gym", gymType: 'Fighting', party: "machop:17|makuhita:18", cite: "TRAINER_BRAWLY" },
  { id: 'rs/wattson-1', game: 'rs', gen: 3, trainer: { name: "Wattson", class: "Leader", sprite: 'wattson-gen3' }, role: 'gym', place: "Mauville City Gym", gymType: 'Electric', party: "magnemite:22|voltorb:20|magneton:23", cite: "TRAINER_WATTSON" },
  { id: 'rs/flannery-1', game: 'rs', gen: 3, trainer: { name: "Flannery", class: "Leader", sprite: 'flannery-gen3' }, role: 'gym', place: "Lavaridge Town Gym", gymType: 'Fire', party: "slugma:26|slugma:26|torkoal:28", cite: "TRAINER_FLANNERY" },
  { id: 'rs/norman-1', game: 'rs', gen: 3, trainer: { name: "Norman", class: "Leader", sprite: 'norman-gen3' }, role: 'gym', place: "Petalburg City Gym", gymType: 'Normal', party: "slaking:28|vigoroth:30|slaking:31", cite: "TRAINER_NORMAN" },
  { id: 'rs/winona-1', game: 'rs', gen: 3, trainer: { name: "Winona", class: "Leader", sprite: 'winona-gen3' }, role: 'gym', place: "Fortree City Gym", gymType: 'Flying', party: "swellow:31|pelipper:30|skarmory:32|altaria:33", cite: "TRAINER_WINONA" },
  { id: 'rs/tate-and-liza-1', game: 'rs', gen: 3, trainer: { name: "Tate & Liza", class: "Leader", sprite: 'tateandliza-gen3' }, role: 'gym', place: "Mossdeep City Gym", gymType: 'Psychic', party: "lunatone:42|solrock:42", double: true, cite: "TRAINER_TATE_AND_LIZA" },
  { id: 'rs/wallace-1', game: 'rs', gen: 3, trainer: { name: "Wallace", class: "Leader", sprite: 'wallace-gen3rs' }, role: 'gym', place: "Sootopolis City Gym", gymType: 'Water', party: "luvdisc:40|whiscash:42|sealeo:40|seaking:42|milotic:43", cite: "TRAINER_WALLACE" },
  { id: 'rs/steven-1', game: 'rs', gen: 3, trainer: { name: "Steven", class: "Champion", sprite: 'steven-gen3' }, role: 'champion', place: "Ever Grande City", party: "skarmory:57|claydol:55|aggron:56|cradily:56|armaldo:56|metagross:58@sitrusberry", cite: "TRAINER_STEVEN" },
  { id: 'rs/wally-1', game: 'rs', gen: 3, trainer: { name: "Wally", class: "Pokemon Trainer", sprite: 'wally-rse' }, role: 'rival', place: "Hoenn", party: "altaria:44|delcatty:43|roselia:44|magneton:41|gardevoir:45", cite: "TRAINER_WALLY_1" },
  { id: 'rs/brendan-1', game: 'rs', gen: 3, trainer: { name: "Brendan", class: "Pokemon Trainer", sprite: 'brendan-gen3rs' }, role: 'rival', place: "Hoenn", party: "treecko:5", cite: "TRAINER_BRENDAN_1" },
  { id: 'rs/brendan-2', game: 'rs', gen: 3, trainer: { name: "Brendan", class: "Pokemon Trainer", sprite: 'brendan-gen3rs' }, role: 'rival', place: "Hoenn", party: "numel:18|wailmer:18|grovyle:20", cite: "TRAINER_BRENDAN_2" },
  { id: 'rs/brendan-3', game: 'rs', gen: 3, trainer: { name: "Brendan", class: "Pokemon Trainer", sprite: 'brendan-gen3rs' }, role: 'rival', place: "Hoenn", party: "numel:29|wailmer:29|grovyle:31", cite: "TRAINER_BRENDAN_3" },
  { id: 'rs/brendan-4', game: 'rs', gen: 3, trainer: { name: "Brendan", class: "Pokemon Trainer", sprite: 'brendan-gen3rs' }, role: 'rival', place: "Hoenn", party: "torchic:5", cite: "TRAINER_BRENDAN_4" },
  { id: 'rs/brendan-5', game: 'rs', gen: 3, trainer: { name: "Brendan", class: "Pokemon Trainer", sprite: 'brendan-gen3rs' }, role: 'rival', place: "Hoenn", party: "wailmer:18|shroomish:18|combusken:20", cite: "TRAINER_BRENDAN_5" },
  { id: 'rs/brendan-6', game: 'rs', gen: 3, trainer: { name: "Brendan", class: "Pokemon Trainer", sprite: 'brendan-gen3rs' }, role: 'rival', place: "Hoenn", party: "wailmer:29|shroomish:29|combusken:31", cite: "TRAINER_BRENDAN_6" },
  { id: 'rs/brendan-7', game: 'rs', gen: 3, trainer: { name: "Brendan", class: "Pokemon Trainer", sprite: 'brendan-gen3rs' }, role: 'rival', place: "Hoenn", party: "mudkip:5", cite: "TRAINER_BRENDAN_7" },
  { id: 'rs/brendan-8', game: 'rs', gen: 3, trainer: { name: "Brendan", class: "Pokemon Trainer", sprite: 'brendan-gen3rs' }, role: 'rival', place: "Hoenn", party: "shroomish:18|numel:18|marshtomp:20", cite: "TRAINER_BRENDAN_8" },
  { id: 'rs/brendan-9', game: 'rs', gen: 3, trainer: { name: "Brendan", class: "Pokemon Trainer", sprite: 'brendan-gen3rs' }, role: 'rival', place: "Hoenn", party: "shroomish:29|numel:29|marshtomp:31", cite: "TRAINER_BRENDAN_9" },
  { id: 'rs/may-1', game: 'rs', gen: 3, trainer: { name: "May", class: "Pokemon Trainer", sprite: 'may-gen3rs' }, role: 'rival', place: "Hoenn", party: "treecko:5", cite: "TRAINER_MAY_1" },
  { id: 'rs/may-2', game: 'rs', gen: 3, trainer: { name: "May", class: "Pokemon Trainer", sprite: 'may-gen3rs' }, role: 'rival', place: "Hoenn", party: "wailmer:18|numel:18|grovyle:20", cite: "TRAINER_MAY_2" },
  { id: 'rs/may-3', game: 'rs', gen: 3, trainer: { name: "May", class: "Pokemon Trainer", sprite: 'may-gen3rs' }, role: 'rival', place: "Hoenn", party: "numel:29|wailmer:29|grovyle:31", cite: "TRAINER_MAY_3" },
  { id: 'rs/may-4', game: 'rs', gen: 3, trainer: { name: "May", class: "Pokemon Trainer", sprite: 'may-gen3rs' }, role: 'rival', place: "Hoenn", party: "torchic:5", cite: "TRAINER_MAY_4" },
  { id: 'rs/may-5', game: 'rs', gen: 3, trainer: { name: "May", class: "Pokemon Trainer", sprite: 'may-gen3rs' }, role: 'rival', place: "Hoenn", party: "wailmer:18|shroomish:18|combusken:20", cite: "TRAINER_MAY_5" },
  { id: 'rs/may-6', game: 'rs', gen: 3, trainer: { name: "May", class: "Pokemon Trainer", sprite: 'may-gen3rs' }, role: 'rival', place: "Hoenn", party: "wailmer:29|shroomish:29|combusken:31", cite: "TRAINER_MAY_6" },
  { id: 'rs/may-7', game: 'rs', gen: 3, trainer: { name: "May", class: "Pokemon Trainer", sprite: 'may-gen3rs' }, role: 'rival', place: "Hoenn", party: "mudkip:5", cite: "TRAINER_MAY_7" },
  { id: 'rs/may-8', game: 'rs', gen: 3, trainer: { name: "May", class: "Pokemon Trainer", sprite: 'may-gen3rs' }, role: 'rival', place: "Hoenn", party: "shroomish:18|numel:18|marshtomp:20", cite: "TRAINER_MAY_8" },
  { id: 'rs/may-9', game: 'rs', gen: 3, trainer: { name: "May", class: "Pokemon Trainer", sprite: 'may-gen3rs' }, role: 'rival', place: "Hoenn", party: "shroomish:29|numel:29|marshtomp:31", cite: "TRAINER_MAY_9" },
  { id: 'rs/maxie-1', game: 'rs', gen: 3, trainer: { name: "Maxie", class: "Magma Leader", sprite: 'maxie-gen3' }, role: 'boss', place: "Hoenn", party: "torkoal:17|camerupt:17", cite: "TRAINER_MAXIE_1" },
  { id: 'rs/magma-admin-1', game: 'rs', gen: 3, trainer: { name: "Magma Admin", class: "Magma Admin", sprite: 'magmagrunt-rse' }, role: 'boss', place: "Hoenn", party: "carvanha:30|mightyena:30", cite: "TRAINER_ANONYMOUS_14" },
  { id: 'rs/magma-admin-2', game: 'rs', gen: 3, trainer: { name: "Magma Admin", class: "Magma Admin", sprite: 'magmagrunt-rse' }, role: 'boss', place: "Hoenn", party: "poochyena:30|swellow:30", cite: "TRAINER_ANONYMOUS_15" },
  { id: 'rs/tabitha-1', game: 'rs', gen: 3, trainer: { name: "Tabitha", class: "Magma Admin", sprite: 'tabitha-gen3' }, role: 'boss', place: "Hoenn", party: "numel:32|mightyena:32|camerupt:32", cite: "TRAINER_TABITHA_1" },
  { id: 'rs/tabitha-2', game: 'rs', gen: 3, trainer: { name: "Tabitha", class: "Magma Admin", sprite: 'tabitha-gen3' }, role: 'boss', place: "Hoenn", party: "numel:20|poochyena:20|numel:20", cite: "TRAINER_TABITHA_2" },
  { id: 'rs/magma-admin-3', game: 'rs', gen: 3, trainer: { name: "Magma Admin", class: "Magma Admin", sprite: 'magmagrunt-rse' }, role: 'boss', place: "Hoenn", party: "carvanha:21|sharpedo:21", cite: "TRAINER_ANONYMOUS_16" },
  { id: 'rs/courtney-1', game: 'rs', gen: 3, trainer: { name: "Courtney", class: "Magma Admin", sprite: 'courtney-gen3' }, role: 'boss', place: "Hoenn", party: "numel:28|mightyena:28", cite: "TRAINER_COURTNEY_1" },
  { id: 'rs/courtney-2', game: 'rs', gen: 3, trainer: { name: "Courtney", class: "Magma Admin", sprite: 'courtney-gen3' }, role: 'boss', place: "Hoenn", party: "camerupt:38|mightyena:38", cite: "TRAINER_COURTNEY_2" },
  { id: 'rs/maxie-2', game: 'rs', gen: 3, trainer: { name: "Maxie", class: "Magma Leader", sprite: 'maxie-gen3' }, role: 'boss', place: "Hoenn", party: "mightyena:41|crobat:41|camerupt:43", cite: "TRAINER_MAXIE_2" },
  { id: 'rs/maxie-3', game: 'rs', gen: 3, trainer: { name: "Maxie", class: "Magma Leader", sprite: 'maxie-gen3' }, role: 'boss', place: "Hoenn", party: "mightyena:24|golbat:24|camerupt:25", cite: "TRAINER_MAXIE_3" },
  { id: 'rs/wally-2', game: 'rs', gen: 3, trainer: { name: "Wally", class: "Pokemon Trainer", sprite: 'wally-rse' }, role: 'rival', place: "Hoenn", party: "ralts:16", cite: "TRAINER_WALLY_2" },
  { id: 'rs/wally-3', game: 'rs', gen: 3, trainer: { name: "Wally", class: "Pokemon Trainer", sprite: 'wally-rse' }, role: 'rival', place: "Hoenn", party: "altaria:47|delcatty:46|roselia:47|magneton:44|gardevoir:48", cite: "TRAINER_WALLY_3" },
  { id: 'rs/wally-4', game: 'rs', gen: 3, trainer: { name: "Wally", class: "Pokemon Trainer", sprite: 'wally-rse' }, role: 'rival', place: "Hoenn", party: "altaria:50|delcatty:49|roselia:50|magneton:47|gardevoir:51", cite: "TRAINER_WALLY_4" },
  { id: 'rs/wally-5', game: 'rs', gen: 3, trainer: { name: "Wally", class: "Pokemon Trainer", sprite: 'wally-rse' }, role: 'rival', place: "Hoenn", party: "altaria:53|delcatty:52|roselia:53|magneton:50|gardevoir:54", cite: "TRAINER_WALLY_5" },
  { id: 'rs/wally-6', game: 'rs', gen: 3, trainer: { name: "Wally", class: "Pokemon Trainer", sprite: 'wally-rse' }, role: 'rival', place: "Hoenn", party: "altaria:56|delcatty:55|roselia:56|magneton:53|gardevoir:57", cite: "TRAINER_WALLY_6" },
  { id: 'rs/brendan-10', game: 'rs', gen: 3, trainer: { name: "Brendan", class: "Pokemon Trainer", sprite: 'brendan-gen3rs' }, role: 'rival', place: "Hoenn", party: "swellow:31|numel:32|wailmer:32|grovyle:34", cite: "TRAINER_BRENDAN_LILYCOVE_MUDKIP" },
  { id: 'rs/brendan-11', game: 'rs', gen: 3, trainer: { name: "Brendan", class: "Pokemon Trainer", sprite: 'brendan-gen3rs' }, role: 'rival', place: "Hoenn", party: "swellow:31|wailmer:32|shroomish:32|combusken:34", cite: "TRAINER_BRENDAN_LILYCOVE_TREECKO" },
  { id: 'rs/brendan-12', game: 'rs', gen: 3, trainer: { name: "Brendan", class: "Pokemon Trainer", sprite: 'brendan-gen3rs' }, role: 'rival', place: "Hoenn", party: "swellow:31|shroomish:32|numel:32|marshtomp:34", cite: "TRAINER_BRENDAN_LILYCOVE_TORCHIC" },
  { id: 'rs/may-10', game: 'rs', gen: 3, trainer: { name: "May", class: "Pokemon Trainer", sprite: 'may-gen3rs' }, role: 'rival', place: "Hoenn", party: "swellow:31|numel:32|wailmer:32|grovyle:34", cite: "TRAINER_MAY_LILYCOVE_MUDKIP" },
  { id: 'rs/may-11', game: 'rs', gen: 3, trainer: { name: "May", class: "Pokemon Trainer", sprite: 'may-gen3rs' }, role: 'rival', place: "Hoenn", party: "swellow:31|wailmer:32|shroomish:32|combusken:34", cite: "TRAINER_MAY_LILYCOVE_TREECKO" },
  { id: 'rs/may-12', game: 'rs', gen: 3, trainer: { name: "May", class: "Pokemon Trainer", sprite: 'may-gen3rs' }, role: 'rival', place: "Hoenn", party: "swellow:31|shroomish:32|numel:32|marshtomp:34", cite: "TRAINER_MAY_LILYCOVE_TORCHIC" },
];
