/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pokemondb.net at 2026-10-05. Fix the importer or the pin, then regenerate.
 *
 * Ultra Sun and Ultra Moon: 31 encounters. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const USUM_SOURCE: EncounterSource = {
  repo: 'pokemondb.net',
  sha: '2026-10-05',
  files: ['ultra-sun-ultra-moon/kahunas-elitefour'],
};

export const USUM_ROWS: readonly EncounterRow[] = [
  { id: 'usum/hala-1', game: 'usum', gen: 7, trainer: { name: "Hala", class: "Kahuna", sprite: 'hala' }, role: 'gym', place: "Iki Town", gymType: 'Fighting', party: "machop:15|makuhita:15|crabrawler:16", cite: "#kahuna-1 Hala" },
  { id: 'usum/hala-2', game: 'usum', gen: 7, trainer: { name: "Hala", class: "Kahuna", sprite: 'hala' }, role: 'gym', place: "Iki Town", gymType: 'Fighting', party: "hariyama:63|machamp:63|bewear:63|poliwrath:63|crabominable:63", cite: "#kahuna-1 Hala - rematch" },
  { id: 'usum/olivia-1', game: 'usum', gen: 7, trainer: { name: "Olivia", class: "Kahuna", sprite: 'olivia' }, role: 'gym', place: "Ruins of Life", gymType: 'Rock', party: "anorith:27|lileep:27|lycanrocmidnight:28", cite: "#kahuna-2 Olivia" },
  { id: 'usum/nanu-1', game: 'usum', gen: 7, trainer: { name: "Nanu", class: "Kahuna", sprite: 'nanu' }, role: 'gym', place: "Malie City", gymType: 'Dark', party: "sableye:52|absol:52|persian:53", cite: "#kahuna-3 Nanu" },
  { id: 'usum/nanu-2', game: 'usum', gen: 7, trainer: { name: "Nanu", class: "Kahuna", sprite: 'nanu' }, role: 'gym', place: "Malie City", gymType: 'Dark', party: "sableye:52|absol:52|persian:53", cite: "#kahuna-3 Nanu - rematch" },
  { id: 'usum/hapu-1', game: 'usum', gen: 7, trainer: { name: "Hapu", class: "Kahuna", sprite: 'hapu' }, role: 'gym', place: "Exeggutor Island", gymType: 'Ground', party: "golurk:53|gastrodon:53|flygon:53|mudsdale:54", cite: "#kahuna-4 Hapu" },
  { id: 'usum/molayne-1', game: 'usum', gen: 7, trainer: { name: "Molayne", class: "Elite Four", sprite: 'molayne' }, role: 'elite', place: "Pokemon League", party: "klefki:56|bisharp:56|magnezone:56|metagross:56|dugtrioalola:57", cite: "#elite4-1 Molayne" },
  { id: 'usum/molayne-2', game: 'usum', gen: 7, trainer: { name: "Molayne", class: "Elite Four", sprite: 'molayne' }, role: 'elite', place: "Pokemon League", party: "klefki:66|bisharp:66|magnezone:66|metagross:66|dugtrioalola:66", cite: "#elite4-1 Molayne - rematch" },
  { id: 'usum/olivia-2', game: 'usum', gen: 7, trainer: { name: "Olivia", class: "Elite Four", sprite: 'olivia' }, role: 'elite', place: "Pokemon League", party: "armaldo:56|cradily:56|gigalith:56|probopass:56|lycanrocmidnight:57", cite: "#elite4-2 Olivia" },
  { id: 'usum/olivia-3', game: 'usum', gen: 7, trainer: { name: "Olivia", class: "Elite Four", sprite: 'olivia' }, role: 'elite', place: "Pokemon League", party: "armaldo:66|cradily:66|gigalith:66|probopass:66|lycanrocmidnight:66", cite: "#elite4-2 Olivia - rematch" },
  { id: 'usum/acerola-1', game: 'usum', gen: 7, trainer: { name: "Acerola", class: "Elite Four", sprite: 'acerola' }, role: 'elite', place: "Pokemon League", party: "sableye:56|drifblim:56|dhelmise:56|froslass:56|palossand:57", cite: "#elite4-3 Acerola" },
  { id: 'usum/acerola-2', game: 'usum', gen: 7, trainer: { name: "Acerola", class: "Elite Four", sprite: 'acerola' }, role: 'elite', place: "Pokemon League", party: "sableye:66|drifblim:66|dhelmise:66|froslass:66|palossand:66", cite: "#elite4-3 Acerola - rematch" },
  { id: 'usum/kahili-1', game: 'usum', gen: 7, trainer: { name: "Kahili", class: "Elite Four", sprite: 'kahili' }, role: 'elite', place: "Pokemon League", party: "braviary:56|hawlucha:56|oricorio:56|mandibuzz:56|toucannon:57", cite: "#elite4-4 Kahili" },
  { id: 'usum/kahili-2', game: 'usum', gen: 7, trainer: { name: "Kahili", class: "Elite Four", sprite: 'kahili' }, role: 'elite', place: "Pokemon League", party: "braviary:66|hawlucha:66|oricorio:66|mandibuzz:66|toucannon:66", cite: "#elite4-4 Kahili - rematch" },
  { id: 'usum/hau-1', game: 'usum', gen: 7, trainer: { name: "Hau", class: "Champion", sprite: 'hau' }, role: 'champion', place: "Pokemon League", party: "raichu:59|flareon:58|tauros:58|noivern:58|crabominable:59|primarina:60", cite: "#champion-5 Hau" },
  { id: 'usum/hau-2', game: 'usum', gen: 7, trainer: { name: "Hau", class: "Champion", sprite: 'hau' }, role: 'champion', place: "Pokemon League", party: "raichu:69|flareon:68|tauros:68|noivern:68|crabominable:68|primarina:70", cite: "#champion-5 Hau - rematch" },
  { id: 'usum/hau-3', game: 'usum', gen: 7, trainer: { name: "Hau", class: "Champion", sprite: 'hau' }, role: 'champion', place: "Pokemon League", party: "raichu:59|vaporeon:58|tauros:58|noivern:58|crabominable:59|decidueye:60", cite: "#champion-5 Hau" },
  { id: 'usum/hau-4', game: 'usum', gen: 7, trainer: { name: "Hau", class: "Champion", sprite: 'hau' }, role: 'champion', place: "Pokemon League", party: "raichu:69|vaporeon:68|tauros:68|noivern:68|crabominable:68|decidueye:70", cite: "#champion-5 Hau - rematch" },
  { id: 'usum/hau-5', game: 'usum', gen: 7, trainer: { name: "Hau", class: "Champion", sprite: 'hau' }, role: 'champion', place: "Pokemon League", party: "raichu:59|leafeon:58|tauros:58|noivern:58|crabominable:59|incineroar:60", cite: "#champion-5 Hau" },
  { id: 'usum/hau-6', game: 'usum', gen: 7, trainer: { name: "Hau", class: "Champion", sprite: 'hau' }, role: 'champion', place: "Pokemon League", party: "raichu:69|leafeon:68|tauros:68|noivern:68|crabominable:68|incineroar:70", cite: "#champion-5 Hau - rematch" },
  { id: 'usum/ilima-1', game: 'usum', gen: 7, trainer: { name: "Ilima", class: "Captain", sprite: 'ilima' }, role: 'gym', place: "Verdant Cavern", gymType: 'Normal', party: "gumshoos:51|smeargle:51|komala:51", cite: "#captain-1 Ilima" },
  { id: 'usum/ilima-2', game: 'usum', gen: 7, trainer: { name: "Ilima", class: "Captain", sprite: 'ilima' }, role: 'gym', place: "Verdant Cavern", gymType: 'Normal', party: "gumshoos:60|smeargle:60|komala:60", cite: "#captain-1 Ilima - rematch" },
  { id: 'usum/lana-1', game: 'usum', gen: 7, trainer: { name: "Lana", class: "Captain", sprite: 'lana' }, role: 'gym', place: "Brooklet Hill", gymType: 'Water', party: "lanturn:51|cloyster:51|araquanid:51", cite: "#captain-2 Lana" },
  { id: 'usum/lana-2', game: 'usum', gen: 7, trainer: { name: "Lana", class: "Captain", sprite: 'lana' }, role: 'gym', place: "Brooklet Hill", gymType: 'Water', party: "lanturn:60|cloyster:60|araquanid:60", cite: "#captain-2 Lana - rematch" },
  { id: 'usum/kiawe-1', game: 'usum', gen: 7, trainer: { name: "Kiawe", class: "Captain", sprite: 'kiawe' }, role: 'gym', place: "Wela Volcano Park", gymType: 'Fire', party: "arcanine:51|talonflame:51|marowak:51", cite: "#captain-3 Kiawe" },
  { id: 'usum/kiawe-2', game: 'usum', gen: 7, trainer: { name: "Kiawe", class: "Captain", sprite: 'kiawe' }, role: 'gym', place: "Wela Volcano Park", gymType: 'Fire', party: "arcanine:60|talonflame:60|marowak:60", cite: "#captain-3 Kiawe - rematch" },
  { id: 'usum/mallow-1', game: 'usum', gen: 7, trainer: { name: "Mallow", class: "Captain", sprite: 'mallow' }, role: 'gym', place: "Lush Jungle", gymType: 'Grass', party: "trevenant:51|shiinotic:51|tsareena:51", cite: "#captain-4 Mallow" },
  { id: 'usum/mallow-2', game: 'usum', gen: 7, trainer: { name: "Mallow", class: "Captain", sprite: 'mallow' }, role: 'gym', place: "Lush Jungle", gymType: 'Grass', party: "trevenant:60|shiinotic:60|tsareena:60", cite: "#captain-4 Mallow - rematch" },
  { id: 'usum/sophocles-1', game: 'usum', gen: 7, trainer: { name: "Sophocles", class: "Captain", sprite: 'sophocles' }, role: 'gym', place: "Hokulani Observatory", gymType: 'Electric', party: "togedemaru:61|magnezone:61|golemalola:61", cite: "#captain-5 Sophocles" },
  { id: 'usum/sophocles-2', game: 'usum', gen: 7, trainer: { name: "Sophocles", class: "Captain", sprite: 'sophocles' }, role: 'gym', place: "Hokulani Observatory", gymType: 'Electric', party: "togedemaru:67|magnezone:67|electivire:67|vikavolt:67|golemalola:67", cite: "#captain-5 Sophocles - rematch" },
  { id: 'usum/mina-1', game: 'usum', gen: 7, trainer: { name: "Mina", class: "Captain", sprite: 'mina' }, role: 'gym', place: "Seafolk Village", gymType: 'Fairy', party: "mawile:51|granbull:51|ribombee:51", cite: "#captain-7 Mina" },
];
