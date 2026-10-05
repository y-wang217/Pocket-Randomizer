/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pokemondb.net at 2026-10-05. Fix the importer or the pin, then regenerate.
 *
 * Brilliant Diamond and Shining Pearl: 38 encounters. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const BDSP_SOURCE: EncounterSource = {
  repo: 'pokemondb.net',
  sha: '2026-10-05',
  files: ['brilliant-diamond-shining-pearl/gymleaders-elitefour'],
};

export const BDSP_ROWS: readonly EncounterRow[] = [
  { id: 'bdsp/roark-1', game: 'bdsp', gen: 8, trainer: { name: "Roark", class: "Leader", sprite: 'roark' }, role: 'gym', place: "Oreburgh City Gym", gymType: 'Rock', party: "geodude:12|onix:12|cranidos:14", cite: "#gym-1 Roark" },
  { id: 'bdsp/roark-2', game: 'bdsp', gen: 8, trainer: { name: "Roark", class: "Leader", sprite: 'roark' }, role: 'gym', place: "Oreburgh City Gym", gymType: 'Rock', party: "tyranitar:68|aerodactyl:66|armaldo:70|probopass:68|relicanth:64|rampardos:72", cite: "#gym-1 Roark - rematch" },
  { id: 'bdsp/gardenia-1', game: 'bdsp', gen: 8, trainer: { name: "Gardenia", class: "Leader", sprite: 'gardenia' }, role: 'gym', place: "Eterna City Gym", gymType: 'Grass', party: "cherubi:19|turtwig:19|roserade:22", cite: "#gym-2 Gardenia" },
  { id: 'bdsp/gardenia-2', game: 'bdsp', gen: 8, trainer: { name: "Gardenia", class: "Leader", sprite: 'gardenia' }, role: 'gym', place: "Eterna City Gym", gymType: 'Grass', party: "jumpluff:66|sunflora:70|cherrim:69|breloom:68|torterra:68|roserade:72", cite: "#gym-2 Gardenia - rematch" },
  { id: 'bdsp/maylene-1', game: 'bdsp', gen: 8, trainer: { name: "Maylene", class: "Leader", sprite: 'maylene' }, role: 'gym', place: "Veilstone City Gym", gymType: 'Fighting', party: "meditite:27|machoke:27|lucario:30", cite: "#gym-3 Maylene" },
  { id: 'bdsp/maylene-2', game: 'bdsp', gen: 8, trainer: { name: "Maylene", class: "Leader", sprite: 'maylene' }, role: 'gym', place: "Veilstone City Gym", gymType: 'Fighting', party: "hitmontop:64|breloom:66|heracross:68|infernape:70|medicham:72|lucario:74", cite: "#gym-3 Maylene - rematch" },
  { id: 'bdsp/crasher-wake-1', game: 'bdsp', gen: 8, trainer: { name: "Crasher Wake", class: "Leader", sprite: 'crasherwake' }, role: 'gym', place: "Pastoria City Gym", gymType: 'Water', party: "gyarados:27|quagsire:27|floatzel:30", cite: "#gym-4 Crasher Wake" },
  { id: 'bdsp/crasher-wake-2', game: 'bdsp', gen: 8, trainer: { name: "Crasher Wake", class: "Leader", sprite: 'crasherwake' }, role: 'gym', place: "Pastoria City Gym", gymType: 'Water', party: "politoed:68|kingdra:68|ludicolo:68|huntail:70|gyarados:70|floatzel:72", cite: "#gym-4 Crasher Wake - rematch" },
  { id: 'bdsp/fantina-1', game: 'bdsp', gen: 8, trainer: { name: "Fantina", class: "Leader", sprite: 'fantina' }, role: 'gym', place: "Hearthome City Gym", gymType: 'Ghost', party: "drifblim:32|gengar:34|mismagius:36", cite: "#gym-5 Fantina" },
  { id: 'bdsp/fantina-2', game: 'bdsp', gen: 8, trainer: { name: "Fantina", class: "Leader", sprite: 'fantina' }, role: 'gym', place: "Hearthome City Gym", gymType: 'Ghost', party: "drifblim:68|banette:65|dusknoir:70|mismagius:70|froslass:72|gengar:72", cite: "#gym-5 Fantina - rematch" },
  { id: 'bdsp/byron-1', game: 'bdsp', gen: 8, trainer: { name: "Byron", class: "Leader", sprite: 'byron' }, role: 'gym', place: "Canalave City Gym", gymType: 'Steel', party: "bronzor:36|steelix:36|bastiodon:39", cite: "#gym-6 Byron" },
  { id: 'bdsp/byron-2', game: 'bdsp', gen: 8, trainer: { name: "Byron", class: "Leader", sprite: 'byron' }, role: 'gym', place: "Canalave City Gym", gymType: 'Steel', party: "skarmory:69|steelix:69|magnezone:70|empoleon:70|aggron:71|bastiodon:72", cite: "#gym-6 Byron - rematch" },
  { id: 'bdsp/candice-1', game: 'bdsp', gen: 8, trainer: { name: "Candice", class: "Leader", sprite: 'candice' }, role: 'gym', place: "Snowpoint City Gym", gymType: 'Ice', party: "snover:38|sneasel:38|medicham:40|abomasnow:42", cite: "#gym-7 Candice" },
  { id: 'bdsp/candice-2', game: 'bdsp', gen: 8, trainer: { name: "Candice", class: "Leader", sprite: 'candice' }, role: 'gym', place: "Snowpoint City Gym", gymType: 'Ice', party: "abomasnow:68|jynx:70|mamoswine:68|froslass:70|glaceon:70|weavile:72", cite: "#gym-7 Candice - rematch" },
  { id: 'bdsp/volkner-1', game: 'bdsp', gen: 8, trainer: { name: "Volkner", class: "Leader", sprite: 'volkner' }, role: 'gym', place: "Sunyshore City Gym", gymType: 'Electric', party: "raichu:46|ambipom:47|octillery:47|luxray:49", cite: "#gym-8 Volkner" },
  { id: 'bdsp/volkner-2', game: 'bdsp', gen: 8, trainer: { name: "Volkner", class: "Leader", sprite: 'volkner' }, role: 'gym', place: "Sunyshore City Gym", gymType: 'Electric', party: "pelipper:70|raichu:70|luxray:70|lanturn:66|jolteon:68|electivire:75", cite: "#gym-8 Volkner - rematch" },
  { id: 'bdsp/aaron-1', game: 'bdsp', gen: 8, trainer: { name: "Aaron", class: "Elite Four", sprite: 'aaron' }, role: 'elite', place: "Pokemon League", party: "dustox:53|beautifly:53|vespiquen:54|heracross:54|drapion:57", cite: "#elite4-1 Aaron" },
  { id: 'bdsp/aaron-2', game: 'bdsp', gen: 8, trainer: { name: "Aaron", class: "Elite Four", sprite: 'aaron' }, role: 'elite', place: "Pokemon League", party: "yanmega:65|scizor:65|vespiquen:66|heracross:67|drapion:69", cite: "#elite4-1 Aaron - rematch" },
  { id: 'bdsp/aaron-3', game: 'bdsp', gen: 8, trainer: { name: "Aaron", class: "Elite Four", sprite: 'aaron' }, role: 'elite', place: "Pokemon League", party: "yanmega:75|scizor:75|vespiquen:77|heracross:77|flygon:75|drapion:79", cite: "#elite4-1 Aaron - rematch 2" },
  { id: 'bdsp/bertha-1', game: 'bdsp', gen: 8, trainer: { name: "Bertha", class: "Elite Four", sprite: 'bertha' }, role: 'elite', place: "Pokemon League", party: "quagsire:55|sudowoodo:56|golem:56|whiscash:55|hippowdon:59", cite: "#elite4-2 Bertha" },
  { id: 'bdsp/bertha-2', game: 'bdsp', gen: 8, trainer: { name: "Bertha", class: "Elite Four", sprite: 'bertha' }, role: 'elite', place: "Pokemon League", party: "whiscash:66|gliscor:69|golem:68|hippowdon:68|rhyperior:71", cite: "#elite4-2 Bertha - rematch" },
  { id: 'bdsp/bertha-3', game: 'bdsp', gen: 8, trainer: { name: "Bertha", class: "Elite Four", sprite: 'bertha' }, role: 'elite', place: "Pokemon League", party: "whiscash:76|gliscor:79|nidoking:78|hippowdon:78|mamoswine:78|rhyperior:81", cite: "#elite4-2 Bertha - rematch 2" },
  { id: 'bdsp/flint-1', game: 'bdsp', gen: 8, trainer: { name: "Flint", class: "Elite Four", sprite: 'flint' }, role: 'elite', place: "Pokemon League", party: "rapidash:58|steelix:57|drifblim:58|lopunny:57|infernape:61", cite: "#elite4-3 Flint" },
  { id: 'bdsp/flint-2', game: 'bdsp', gen: 8, trainer: { name: "Flint", class: "Elite Four", sprite: 'flint' }, role: 'elite', place: "Pokemon League", party: "houndoom:68|flareon:71|rapidash:69|infernape:71|magmortar:73", cite: "#elite4-3 Flint - rematch" },
  { id: 'bdsp/flint-3', game: 'bdsp', gen: 8, trainer: { name: "Flint", class: "Elite Four", sprite: 'flint' }, role: 'elite', place: "Pokemon League", party: "ninetales:78|houndoom:78|rapidash:79|infernape:81|arcanine:81|magmortar:83", cite: "#elite4-3 Flint - rematch 2" },
  { id: 'bdsp/lucian-1', game: 'bdsp', gen: 8, trainer: { name: "Lucian", class: "Elite Four", sprite: 'lucian' }, role: 'elite', place: "Pokemon League", party: "mrmime:59|girafarig:59|medicham:60|alakazam:60|bronzong:63", cite: "#elite4-4 Lucian" },
  { id: 'bdsp/lucian-2', game: 'bdsp', gen: 8, trainer: { name: "Lucian", class: "Elite Four", sprite: 'lucian' }, role: 'elite', place: "Pokemon League", party: "mrmime:69|espeon:71|bronzong:70|alakazam:72|gallade:75", cite: "#elite4-4 Lucian - rematch" },
  { id: 'bdsp/lucian-3', game: 'bdsp', gen: 8, trainer: { name: "Lucian", class: "Elite Four", sprite: 'lucian' }, role: 'elite', place: "Pokemon League", party: "mrmime:79|espeon:81|bronzong:80|alakazam:82|slowbro:82|gallade:85", cite: "#elite4-4 Lucian - rematch 2" },
  { id: 'bdsp/cynthia-1', game: 'bdsp', gen: 8, trainer: { name: "Cynthia", class: "Champion", sprite: 'cynthia-gen4' }, role: 'champion', place: "Pokemon League", party: "spiritomb:61|roserade:60|gastrodon:60|lucario:63|milotic:63|garchomp:66", cite: "#champion-5 Cynthia" },
  { id: 'bdsp/cynthia-2', game: 'bdsp', gen: 8, trainer: { name: "Cynthia", class: "Champion", sprite: 'cynthia-gen4' }, role: 'champion', place: "Pokemon League", party: "spiritomb:74|roserade:74|togekiss:76|lucario:76|milotic:74|garchomp:78", cite: "#champion-5 Cynthia - rematch" },
  { id: 'bdsp/cynthia-3', game: 'bdsp', gen: 8, trainer: { name: "Cynthia", class: "Champion", sprite: 'cynthia-gen4' }, role: 'champion', place: "Pokemon League", party: "spiritomb:84|porygonz:85|togekiss:86|lucario:86|milotic:84|garchomp:88", cite: "#champion-5 Cynthia - rematch 2" },
  { id: 'bdsp/barry-1', game: 'bdsp', gen: 8, trainer: { name: "Barry", class: "Rival", sprite: 'barry' }, role: 'rival', place: "Sinnoh", party: "staraptor:58|floatzel:59|heracross:60|roserade:59|snorlax:60|infernape:64", cite: "#trainers-misc Barry" },
  { id: 'bdsp/barry-2', game: 'bdsp', gen: 8, trainer: { name: "Barry", class: "Rival", sprite: 'barry' }, role: 'rival', place: "Sinnoh", party: "staraptor:68|floatzel:69|heracross:70|roserade:69|snorlax:70|infernape:74", cite: "#trainers-misc Barry - rematch" },
  { id: 'bdsp/barry-3', game: 'bdsp', gen: 8, trainer: { name: "Barry", class: "Rival", sprite: 'barry' }, role: 'rival', place: "Sinnoh", party: "staraptor:58|roserade:59|heracross:60|rapidash:59|snorlax:60|empoleon:64", cite: "#trainers-misc Barry" },
  { id: 'bdsp/barry-4', game: 'bdsp', gen: 8, trainer: { name: "Barry", class: "Rival", sprite: 'barry' }, role: 'rival', place: "Sinnoh", party: "staraptor:68|roserade:69|heracross:70|rapidash:69|snorlax:70|empoleon:74", cite: "#trainers-misc Barry - rematch" },
  { id: 'bdsp/barry-5', game: 'bdsp', gen: 8, trainer: { name: "Barry", class: "Rival", sprite: 'barry' }, role: 'rival', place: "Sinnoh", party: "staraptor:58|floatzel:59|heracross:60|rapidash:59|snorlax:60|torterra:64", cite: "#trainers-misc Barry" },
  { id: 'bdsp/barry-6', game: 'bdsp', gen: 8, trainer: { name: "Barry", class: "Rival", sprite: 'barry' }, role: 'rival', place: "Sinnoh", party: "staraptor:68|floatzel:69|heracross:70|rapidash:69|snorlax:70|torterra:74", cite: "#trainers-misc Barry - rematch" },
  { id: 'bdsp/game-freak-s-morimoto-1', game: 'bdsp', gen: 8, trainer: { name: "Game Freak's Morimoto", class: "Pokemon Trainer", sprite: null }, role: 'boss', place: "Sinnoh", party: "spiritomb:63|ambipom:64|hippowdon:64|vaporeon:65|jolteon:65|flareon:65", cite: "#trainers-misc Game Freak's Morimoto" },
];
