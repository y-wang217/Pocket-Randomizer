/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pokemondb.net at 2026-10-05. Fix the importer or the pin, then regenerate.
 *
 * Scarlet and Violet: 36 encounters. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const SV_SOURCE: EncounterSource = {
  repo: 'pokemondb.net',
  sha: '2026-10-05',
  files: ['scarlet-violet/gymleaders-elitefour'],
};

export const SV_ROWS: readonly EncounterRow[] = [
  { id: 'sv/katy-1', game: 'sv', gen: 9, trainer: { name: "Katy", class: "Leader", sprite: 'katy' }, role: 'gym', place: "Cortondo Gym", gymType: 'Bug', party: "nymble:14|tarountula:14|teddiursa:15", cite: "#gym-1 Katy" },
  { id: 'sv/katy-2', game: 'sv', gen: 9, trainer: { name: "Katy", class: "Leader", sprite: 'katy' }, role: 'gym', place: "Cortondo Gym", gymType: 'Bug', party: "lokix:65|forretress:65|spidops:65|heracross:65|ursaring:66", cite: "#gym-1 Katy - rematch" },
  { id: 'sv/brassius-1', game: 'sv', gen: 9, trainer: { name: "Brassius", class: "Leader", sprite: 'brassius' }, role: 'gym', place: "Artazon Gym", gymType: 'Grass', party: "petilil:16|smoliv:16|sudowoodo:17", cite: "#gym-2 Brassius" },
  { id: 'sv/brassius-2', game: 'sv', gen: 9, trainer: { name: "Brassius", class: "Leader", sprite: 'brassius' }, role: 'gym', place: "Artazon Gym", gymType: 'Grass', party: "lilligant:65|breloom:65|tsareena:65|arboliva:65|sudowoodo:66", cite: "#gym-2 Brassius - rematch" },
  { id: 'sv/iono-1', game: 'sv', gen: 9, trainer: { name: "Iono", class: "Leader", sprite: 'iono' }, role: 'gym', place: "Levincia Gym", gymType: 'Electric', party: "wattrel:23|bellibolt:23|luxio:23|mismagius:24", cite: "#gym-3 Iono" },
  { id: 'sv/iono-2', game: 'sv', gen: 9, trainer: { name: "Iono", class: "Leader", sprite: 'iono' }, role: 'gym', place: "Levincia Gym", gymType: 'Electric', party: "kilowattrel:65|bellibolt:65|electrode:65|luxray:65|mismagius:66", cite: "#gym-3 Iono - rematch" },
  { id: 'sv/kofu-1', game: 'sv', gen: 9, trainer: { name: "Kofu", class: "Leader", sprite: 'kofu' }, role: 'gym', place: "Cascarrafa Gym", gymType: 'Water', party: "veluza:29|wugtrio:29|crabominable:30", cite: "#gym-4 Kofu" },
  { id: 'sv/kofu-2', game: 'sv', gen: 9, trainer: { name: "Kofu", class: "Leader", sprite: 'kofu' }, role: 'gym', place: "Cascarrafa Gym", gymType: 'Water', party: "veluza:65|pelipper:65|wugtrio:65|clawitzer:65|crabominable:66", cite: "#gym-4 Kofu - rematch" },
  { id: 'sv/larry-1', game: 'sv', gen: 9, trainer: { name: "Larry", class: "Leader", sprite: 'larry' }, role: 'gym', place: "Medali Gym", gymType: 'Normal', party: "komala:35|dudunsparce:35|staraptor:36", cite: "#gym-5 Larry" },
  { id: 'sv/larry-2', game: 'sv', gen: 9, trainer: { name: "Larry", class: "Leader", sprite: 'larry' }, role: 'gym', place: "Medali Gym", gymType: 'Normal', party: "oinkologne:65|komala:65|braviary:65|dudunsparce:65|staraptor:66", cite: "#gym-5 Larry - rematch" },
  { id: 'sv/ryme-1', game: 'sv', gen: 9, trainer: { name: "Ryme", class: "Leader", sprite: 'ryme' }, role: 'gym', place: "Montenevera Gym", gymType: 'Ghost', party: "banette:41|mimikyu:41|houndstone:41|toxtricitylowkey:42", cite: "#gym-6 Ryme" },
  { id: 'sv/ryme-2', game: 'sv', gen: 9, trainer: { name: "Ryme", class: "Leader", sprite: 'ryme' }, role: 'gym', place: "Montenevera Gym", gymType: 'Ghost', party: "banette:65|mimikyu:65|spiritomb:65|houndstone:65|toxtricitylowkey:66", cite: "#gym-6 Ryme - rematch" },
  { id: 'sv/tulip-1', game: 'sv', gen: 9, trainer: { name: "Tulip", class: "Leader", sprite: 'tulip' }, role: 'gym', place: "Alfornada Gym", gymType: 'Psychic', party: "farigiraf:44|gardevoir:44|espathra:44|florges:45", cite: "#gym-7 Tulip" },
  { id: 'sv/tulip-2', game: 'sv', gen: 9, trainer: { name: "Tulip", class: "Leader", sprite: 'tulip' }, role: 'gym', place: "Alfornada Gym", gymType: 'Psychic', party: "farigiraf:65|gardevoir:65|espathra:65|gallade:65|florges:66", cite: "#gym-7 Tulip - rematch" },
  { id: 'sv/grusha-1', game: 'sv', gen: 9, trainer: { name: "Grusha", class: "Leader", sprite: 'grusha' }, role: 'gym', place: "Glaseado Mountain Gym", gymType: 'Ice', party: "frosmoth:47|beartic:47|cetitan:47|altaria:48", cite: "#gym-8 Grusha" },
  { id: 'sv/grusha-2', game: 'sv', gen: 9, trainer: { name: "Grusha", class: "Leader", sprite: 'grusha' }, role: 'gym', place: "Glaseado Mountain Gym", gymType: 'Ice', party: "frosmoth:65|beartic:65|cetitan:65|weavile:65|altaria:66", cite: "#gym-8 Grusha - rematch" },
  { id: 'sv/giacomo-1', game: 'sv', gen: 9, trainer: { name: "Giacomo", class: "Team Star", sprite: 'giacomo' }, role: 'boss', place: "Team Star Base", party: "pawniard:21", cite: "#teamstar-1 Giacomo" },
  { id: 'sv/giacomo-2', game: 'sv', gen: 9, trainer: { name: "Giacomo", class: "Team Star", sprite: 'giacomo' }, role: 'boss', place: "Team Star Base", party: "cacturne:65|honchkrow:65|mabosstiff:65|krookodile:65|kingambit:66", cite: "#teamstar-1 Giacomo - rematch" },
  { id: 'sv/mela-1', game: 'sv', gen: 9, trainer: { name: "Mela", class: "Team Star", sprite: 'mela' }, role: 'boss', place: "Team Star Base", party: "torkoal:27", cite: "#teamstar-2 Mela" },
  { id: 'sv/mela-2', game: 'sv', gen: 9, trainer: { name: "Mela", class: "Team Star", sprite: 'mela' }, role: 'boss', place: "Team Star Base", party: "torkoal:65|coalossal:65|houndoom:65|arcanine:65|armarouge:66", cite: "#teamstar-2 Mela - rematch" },
  { id: 'sv/atticus-1', game: 'sv', gen: 9, trainer: { name: "Atticus", class: "Team Star", sprite: 'atticus' }, role: 'boss', place: "Team Star Base", party: "skuntank:32|muk:32|revavroom:33", cite: "#teamstar-3 Atticus" },
  { id: 'sv/atticus-2', game: 'sv', gen: 9, trainer: { name: "Atticus", class: "Team Star", sprite: 'atticus' }, role: 'boss', place: "Team Star Base", party: "skuntank:65|muk:65|dragalge:65|toxapex:65|revavroom:66", cite: "#teamstar-3 Atticus - rematch" },
  { id: 'sv/ortega-1', game: 'sv', gen: 9, trainer: { name: "Ortega", class: "Team Star", sprite: 'ortega' }, role: 'boss', place: "Team Star Base", party: "azumarill:50|wigglytuff:50|dachsbun:51", cite: "#teamstar-4 Ortega" },
  { id: 'sv/ortega-2', game: 'sv', gen: 9, trainer: { name: "Ortega", class: "Team Star", sprite: 'ortega' }, role: 'boss', place: "Team Star Base", party: "klefki:65|azumarill:65|wigglytuff:65|hatterene:65|dachsbun:66", cite: "#teamstar-4 Ortega - rematch" },
  { id: 'sv/eri-1', game: 'sv', gen: 9, trainer: { name: "Eri", class: "Team Star", sprite: 'eri' }, role: 'boss', place: "Team Star Base", party: "toxicroak:55|passimian:55|lucario:55|annihilape:56", cite: "#teamstar-5 Eri" },
  { id: 'sv/eri-2', game: 'sv', gen: 9, trainer: { name: "Eri", class: "Team Star", sprite: 'eri' }, role: 'boss', place: "Team Star Base", party: "primeape:65|toxicroak:65|passimian:65|lucario:65|annihilape:66", cite: "#teamstar-5 Eri - rematch" },
  { id: 'sv/rika-1', game: 'sv', gen: 9, trainer: { name: "Rika", class: "Elite Four", sprite: 'rika' }, role: 'elite', place: "Pokemon League", party: "whiscash:57|camerupt:57|donphan:57|dugtrio:57|clodsire:58", cite: "#elite4-1 Rika" },
  { id: 'sv/poppy-1', game: 'sv', gen: 9, trainer: { name: "Poppy", class: "Elite Four", sprite: 'poppy' }, role: 'elite', place: "Pokemon League", party: "copperajah:58|magnezone:58|bronzong:58|corviknight:58|tinkaton:59", cite: "#elite4-2 Poppy" },
  { id: 'sv/larry-3', game: 'sv', gen: 9, trainer: { name: "Larry", class: "Elite Four", sprite: 'larry' }, role: 'elite', place: "Pokemon League", party: "tropius:59|oricoriopompom:59|altaria:59|staraptor:59|flamigo:60", cite: "#elite4-3 Larry" },
  { id: 'sv/hassel-1', game: 'sv', gen: 9, trainer: { name: "Hassel", class: "Elite Four", sprite: 'hassel' }, role: 'elite', place: "Pokemon League", party: "noivern:60|haxorus:60|dragalge:60|flapple:60|baxcalibur:61", cite: "#elite4-4 Hassel" },
  { id: 'sv/geeta-1', game: 'sv', gen: 9, trainer: { name: "Geeta", class: "Champion", sprite: 'geeta' }, role: 'champion', place: "Pokemon League", party: "espathra:61|gogoat:61|veluza:61|avalugg:61|kingambit:61|glimmora:62", cite: "#champion-5 Geeta" },
  { id: 'sv/geeta-2', game: 'sv', gen: 9, trainer: { name: "Geeta", class: "Champion", sprite: 'geeta' }, role: 'champion', place: "Pokemon League", party: "espathra:69|gogoat:69|veluza:69|avalugg:69|kingambit:69|glimmora:70", cite: "#champion-5 Geeta - rematch" },
  { id: 'sv/nemona-1', game: 'sv', gen: 9, trainer: { name: "Nemona", class: "Rival", sprite: 'nemona-s' }, role: 'rival', place: "Paldea", party: "lycanroc:65|goodra:65|dudunsparcethreesegment:65|orthworm:65|pawmot:65|quaquaval:66", cite: "#trainers-misc Nemona" },
  { id: 'sv/nemona-2', game: 'sv', gen: 9, trainer: { name: "Nemona", class: "Rival", sprite: 'nemona-s' }, role: 'rival', place: "Paldea", party: "lycanroc:65|goodra:65|dudunsparcethreesegment:65|orthworm:65|pawmot:65|meowscarada:66", cite: "#trainers-misc Nemona" },
  { id: 'sv/nemona-3', game: 'sv', gen: 9, trainer: { name: "Nemona", class: "Rival", sprite: 'nemona-s' }, role: 'rival', place: "Paldea", party: "lycanroc:65|goodra:65|dudunsparcethreesegment:65|orthworm:65|pawmot:65|skeledirge:66", cite: "#trainers-misc Nemona" },
  { id: 'sv/penny-1', game: 'sv', gen: 9, trainer: { name: "Penny", class: "Rival", sprite: 'penny' }, role: 'rival', place: "Paldea", party: "umbreon:62|vaporeon:62|jolteon:62|flareon:62|leafeon:62|sylveon:63", cite: "#trainers-misc Penny" },
];
