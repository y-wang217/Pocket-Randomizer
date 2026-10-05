/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pokemondb.net at 2026-10-05. Fix the importer or the pin, then regenerate.
 *
 * Sun and Moon: 23 encounters. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const SM_SOURCE: EncounterSource = {
  repo: 'pokemondb.net',
  sha: '2026-10-05',
  files: ['sun-moon/kahunas-elitefour'],
};

export const SM_ROWS: readonly EncounterRow[] = [
  { id: 'sm/hala-1', game: 'sm', gen: 7, trainer: { name: "Hala", class: "Kahuna", sprite: 'hala' }, role: 'gym', place: "Iki Town", gymType: 'Fighting', party: "mankey:14|makuhita:14|crabrawler:15", cite: "#kahuna-1 Hala" },
  { id: 'sm/olivia-1', game: 'sm', gen: 7, trainer: { name: "Olivia", class: "Kahuna", sprite: 'olivia' }, role: 'gym', place: "Ruins of Life", gymType: 'Rock', party: "nosepass:26|boldore:26|lycanrocmidnight:27", cite: "#kahuna-2 Olivia" },
  { id: 'sm/nanu-1', game: 'sm', gen: 7, trainer: { name: "Nanu", class: "Kahuna", sprite: 'nanu' }, role: 'gym', place: "Malie City", gymType: 'Dark', party: "sableye:38|krokorok:38|persian:39", cite: "#kahuna-3 Nanu" },
  { id: 'sm/hapu-1', game: 'sm', gen: 7, trainer: { name: "Hapu", class: "Kahuna", sprite: 'hapu' }, role: 'gym', place: "Vast Poni Canyon", gymType: 'Ground', party: "dugtrioalola:47|gastrodon:47|flygon:47|mudsdale:48", cite: "#kahuna-4 Hapu" },
  { id: 'sm/hala-2', game: 'sm', gen: 7, trainer: { name: "Hala", class: "Elite Four", sprite: 'hala' }, role: 'elite', place: "Pokemon League", party: "hariyama:54|primeape:54|bewear:54|poliwrath:54|crabominable:55", cite: "#elite4-1 Hala" },
  { id: 'sm/hala-3', game: 'sm', gen: 7, trainer: { name: "Hala", class: "Elite Four", sprite: 'hala' }, role: 'elite', place: "Pokemon League", party: "hariyama:63|primeape:63|bewear:63|poliwrath:63|crabominable:63", cite: "#elite4-1 Hala - rematch" },
  { id: 'sm/olivia-2', game: 'sm', gen: 7, trainer: { name: "Olivia", class: "Elite Four", sprite: 'olivia' }, role: 'elite', place: "Pokemon League", party: "relicanth:54|carbink:54|golemalola:54|probopass:54|lycanrocmidnight:55", cite: "#elite4-2 Olivia" },
  { id: 'sm/olivia-3', game: 'sm', gen: 7, trainer: { name: "Olivia", class: "Elite Four", sprite: 'olivia' }, role: 'elite', place: "Pokemon League", party: "relicanth:63|carbink:63|golemalola:63|probopass:63|lycanrocmidnight:63", cite: "#elite4-2 Olivia - rematch" },
  { id: 'sm/acerola-1', game: 'sm', gen: 7, trainer: { name: "Acerola", class: "Elite Four", sprite: 'acerola' }, role: 'elite', place: "Pokemon League", party: "sableye:54|drifblim:54|dhelmise:54|froslass:54|palossand:55", cite: "#elite4-3 Acerola" },
  { id: 'sm/acerola-2', game: 'sm', gen: 7, trainer: { name: "Acerola", class: "Elite Four", sprite: 'acerola' }, role: 'elite', place: "Pokemon League", party: "sableye:63|drifblim:63|dhelmise:63|froslass:63|palossand:63", cite: "#elite4-3 Acerola - rematch" },
  { id: 'sm/kahili-1', game: 'sm', gen: 7, trainer: { name: "Kahili", class: "Elite Four", sprite: 'kahili' }, role: 'elite', place: "Pokemon League", party: "skarmory:54|crobat:54|oricorio:54|mandibuzz:54|toucannon:55", cite: "#elite4-4 Kahili" },
  { id: 'sm/kahili-2', game: 'sm', gen: 7, trainer: { name: "Kahili", class: "Elite Four", sprite: 'kahili' }, role: 'elite', place: "Pokemon League", party: "skarmory:63|crobat:63|oricorio:63|mandibuzz:63|toucannon:63", cite: "#elite4-4 Kahili - rematch" },
  { id: 'sm/kukui-1', game: 'sm', gen: 7, trainer: { name: "Kukui", class: "Champion", sprite: 'kukui' }, role: 'champion', place: "Pokemon League", party: "lycanroc:57|ninetalesalola:57|braviary:57|magnezone:57|snorlax:57|incineroar:58", cite: "#champion-5 Kukui" },
  { id: 'sm/kukui-2', game: 'sm', gen: 7, trainer: { name: "Kukui", class: "Champion", sprite: 'kukui' }, role: 'champion', place: "Pokemon League", party: "lycanroc:65|ninetalesalola:65|braviary:65|magnezone:65|snorlax:65|incineroar:65", cite: "#champion-5 Kukui - rematch" },
  { id: 'sm/kukui-3', game: 'sm', gen: 7, trainer: { name: "Kukui", class: "Champion", sprite: 'kukui' }, role: 'champion', place: "Pokemon League", party: "lycanroc:57|ninetalesalola:57|braviary:57|magnezone:57|snorlax:57|primarina:58", cite: "#champion-5 Kukui" },
  { id: 'sm/kukui-4', game: 'sm', gen: 7, trainer: { name: "Kukui", class: "Champion", sprite: 'kukui' }, role: 'champion', place: "Pokemon League", party: "lycanroc:65|ninetalesalola:65|braviary:65|magnezone:65|snorlax:65|primarina:65", cite: "#champion-5 Kukui - rematch" },
  { id: 'sm/kukui-5', game: 'sm', gen: 7, trainer: { name: "Kukui", class: "Champion", sprite: 'kukui' }, role: 'champion', place: "Pokemon League", party: "lycanroc:57|ninetalesalola:57|braviary:57|magnezone:57|snorlax:57|decidueye:58", cite: "#champion-5 Kukui" },
  { id: 'sm/kukui-6', game: 'sm', gen: 7, trainer: { name: "Kukui", class: "Champion", sprite: 'kukui' }, role: 'champion', place: "Pokemon League", party: "lycanroc:65|ninetalesalola:65|braviary:65|magnezone:65|snorlax:65|decidueye:65", cite: "#champion-5 Kukui - rematch" },
  { id: 'sm/ilima-1', game: 'sm', gen: 7, trainer: { name: "Ilima", class: "Captain", sprite: 'ilima' }, role: 'gym', place: "Verdant Cavern", gymType: 'Normal', party: "gumshoos:15|smeargle:14", cite: "#captain-1 Ilima" },
  { id: 'sm/lana-1', game: 'sm', gen: 7, trainer: { name: "Lana", class: "Captain", sprite: 'lana' }, role: 'gym', place: "Brooklet Hill", gymType: 'Water', party: "chinchou:26|shellder:26|araquanid:27", cite: "#captain-2 Lana" },
  { id: 'sm/kiawe-1', game: 'sm', gen: 7, trainer: { name: "Kiawe", class: "Captain", sprite: 'kiawe' }, role: 'gym', place: "Wela Volcano Park", gymType: 'Fire', party: "growlithe:26|fletchinder:26|marowak:27", cite: "#captain-3 Kiawe" },
  { id: 'sm/mallow-1', game: 'sm', gen: 7, trainer: { name: "Mallow", class: "Captain", sprite: 'mallow' }, role: 'gym', place: "Lush Jungle", gymType: 'Grass', party: "phantump:26|shiinotic:26|steenee:27", cite: "#captain-4 Mallow" },
  { id: 'sm/mina-1', game: 'sm', gen: 7, trainer: { name: "Mina", class: "Captain", sprite: 'mina' }, role: 'gym', place: "Seafolk Village", gymType: 'Fairy', party: "klefki:61|granbull:61|shiinotic:61|wigglytuff:61|ribombee:61", cite: "#captain-7 Mina" },
];
