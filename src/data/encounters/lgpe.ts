/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pokemondb.net at 2026-10-05. Fix the importer or the pin, then regenerate.
 *
 * Let's Go, Pikachu! and Let's Go, Eevee!: 31 encounters. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const LGPE_SOURCE: EncounterSource = {
  repo: 'pokemondb.net',
  sha: '2026-10-05',
  files: ['lets-go-pikachu-eevee/gymleaders-elitefour'],
};

export const LGPE_ROWS: readonly EncounterRow[] = [
  { id: 'lgpe/brock-1', game: 'lgpe', gen: 7, trainer: { name: "Brock", class: "Leader", sprite: 'brock-lgpe' }, role: 'gym', place: "Pewter City Gym", gymType: 'Rock', party: "geodude:11|onix:12", cite: "#gym-1 Brock" },
  { id: 'lgpe/brock-2', game: 'lgpe', gen: 7, trainer: { name: "Brock", class: "Leader", sprite: 'brock-lgpe' }, role: 'gym', place: "Pewter City Gym", gymType: 'Rock', party: "onix:56|kabutops:56|omastar:56|aerodactyl:56|golem:57", cite: "#gym-1 Brock - rematch" },
  { id: 'lgpe/misty-1', game: 'lgpe', gen: 7, trainer: { name: "Misty", class: "Leader", sprite: 'misty-lgpe' }, role: 'gym', place: "Cerulean City Gym", gymType: 'Water', party: "psyduck:18|starmie:19", cite: "#gym-2 Misty" },
  { id: 'lgpe/misty-2', game: 'lgpe', gen: 7, trainer: { name: "Misty", class: "Leader", sprite: 'misty-lgpe' }, role: 'gym', place: "Cerulean City Gym", gymType: 'Water', party: "golduck:56|dewgong:56|starmie:56|vaporeon:56|gyarados:57", cite: "#gym-2 Misty - rematch" },
  { id: 'lgpe/lt-surge-1', game: 'lgpe', gen: 7, trainer: { name: "Lt. Surge", class: "Leader", sprite: 'ltsurge' }, role: 'gym', place: "Vermilion City Gym", gymType: 'Electric', party: "voltorb:25|magnemite:25|raichu:26", cite: "#gym-3 Lt. Surge" },
  { id: 'lgpe/lt-surge-2', game: 'lgpe', gen: 7, trainer: { name: "Lt. Surge", class: "Leader", sprite: 'ltsurge' }, role: 'gym', place: "Vermilion City Gym", gymType: 'Electric', party: "electrode:56|jolteon:56|electabuzz:56|magneton:56|raichu:57", cite: "#gym-3 Lt. Surge - rematch" },
  { id: 'lgpe/erika-1', game: 'lgpe', gen: 7, trainer: { name: "Erika", class: "Leader", sprite: 'erika-lgpe' }, role: 'gym', place: "Celadon City Gym", gymType: 'Grass', party: "tangela:33|weepinbell:33|vileplume:34", cite: "#gym-4 Erika" },
  { id: 'lgpe/erika-2', game: 'lgpe', gen: 7, trainer: { name: "Erika", class: "Leader", sprite: 'erika-lgpe' }, role: 'gym', place: "Celadon City Gym", gymType: 'Grass', party: "tangela:56|parasect:56|victreebel:56|exeggutor:56|vileplume:57", cite: "#gym-4 Erika - rematch" },
  { id: 'lgpe/koga-1', game: 'lgpe', gen: 7, trainer: { name: "Koga", class: "Leader", sprite: 'koga-lgpe' }, role: 'gym', place: "Fuchsia City Gym", gymType: 'Poison', party: "weezing:43|muk:43|golbat:43|venomoth:44", cite: "#gym-5 Koga" },
  { id: 'lgpe/koga-2', game: 'lgpe', gen: 7, trainer: { name: "Koga", class: "Leader", sprite: 'koga-lgpe' }, role: 'gym', place: "Fuchsia City Gym", gymType: 'Poison', party: "tentacruel:56|golbat:56|weezing:56|venomoth:56|muk:57", cite: "#gym-5 Koga - rematch" },
  { id: 'lgpe/sabrina-1', game: 'lgpe', gen: 7, trainer: { name: "Sabrina", class: "Leader", sprite: 'sabrina-lgpe' }, role: 'gym', place: "Saffron City Gym", gymType: 'Psychic', party: "mrmime:43|slowbro:43|jynx:43|alakazam:44", cite: "#gym-6 Sabrina" },
  { id: 'lgpe/sabrina-2', game: 'lgpe', gen: 7, trainer: { name: "Sabrina", class: "Leader", sprite: 'sabrina-lgpe' }, role: 'gym', place: "Saffron City Gym", gymType: 'Psychic', party: "mrmime:56|jynx:56|hypno:56|slowbro:56|alakazam:57", cite: "#gym-6 Sabrina - rematch" },
  { id: 'lgpe/blaine-1', game: 'lgpe', gen: 7, trainer: { name: "Blaine", class: "Leader", sprite: 'blaine-lgpe' }, role: 'gym', place: "Cinnabar Island Gym", gymType: 'Fire', party: "magmar:47|rapidash:47|ninetales:47|arcanine:48", cite: "#gym-7 Blaine" },
  { id: 'lgpe/blaine-2', game: 'lgpe', gen: 7, trainer: { name: "Blaine", class: "Leader", sprite: 'blaine-lgpe' }, role: 'gym', place: "Cinnabar Island Gym", gymType: 'Fire', party: "magmar:56|rapidash:56|ninetales:56|flareon:56|arcanine:57", cite: "#gym-7 Blaine - rematch" },
  { id: 'lgpe/giovanni-1', game: 'lgpe', gen: 7, trainer: { name: "Giovanni", class: "Leader", sprite: 'giovanni-lgpe' }, role: 'gym', place: "Viridian City Gym", gymType: 'Ground', party: "dugtrio:49|nidoqueen:49|nidoking:49|rhydon:50", cite: "#gym-8 Giovanni" },
  { id: 'lgpe/blue-1', game: 'lgpe', gen: 7, trainer: { name: "Blue", class: "Leader", sprite: 'blue-lgpe' }, role: 'gym', place: "Viridian City Gym", party: "tauros:66|gyarados:66|aerodactyl:66|alakazam:66|exeggutor:66|charizard:68", cite: "#gym-8 Blue - rematch" },
  { id: 'lgpe/lorelei-1', game: 'lgpe', gen: 7, trainer: { name: "Lorelei", class: "Elite Four", sprite: 'lorelei-lgpe' }, role: 'elite', place: "Indigo Plateau", party: "dewgong:51|jynx:51|cloyster:51|slowbro:51|lapras:52", cite: "#elite4-1 Lorelei" },
  { id: 'lgpe/lorelei-2', game: 'lgpe', gen: 7, trainer: { name: "Lorelei", class: "Elite Four", sprite: 'lorelei-lgpe' }, role: 'elite', place: "Indigo Plateau", party: "dewgong:61|jynx:61|cloyster:61|slowbro:61|sandslashalola:61|lapras:62", cite: "#elite4-1 Lorelei - rematch" },
  { id: 'lgpe/bruno-1', game: 'lgpe', gen: 7, trainer: { name: "Bruno", class: "Elite Four", sprite: 'bruno' }, role: 'elite', place: "Indigo Plateau", party: "onix:52|hitmonlee:52|hitmonchan:52|poliwrath:52|machamp:53", cite: "#elite4-2 Bruno" },
  { id: 'lgpe/bruno-2', game: 'lgpe', gen: 7, trainer: { name: "Bruno", class: "Elite Four", sprite: 'bruno' }, role: 'elite', place: "Indigo Plateau", party: "onix:62|hitmonlee:62|hitmonchan:62|poliwrath:62|golemalola:62|machamp:63", cite: "#elite4-2 Bruno - rematch" },
  { id: 'lgpe/agatha-1', game: 'lgpe', gen: 7, trainer: { name: "Agatha", class: "Elite Four", sprite: 'agatha-lgpe' }, role: 'elite', place: "Indigo Plateau", party: "arbok:53|gengar:53|golbat:53|weezing:53|gengar:54", cite: "#elite4-3 Agatha" },
  { id: 'lgpe/agatha-2', game: 'lgpe', gen: 7, trainer: { name: "Agatha", class: "Elite Four", sprite: 'agatha-lgpe' }, role: 'elite', place: "Indigo Plateau", party: "arbok:63|gengar:63|golbat:63|weezing:63|marowakalola:63|gengar:64", cite: "#elite4-3 Agatha - rematch" },
  { id: 'lgpe/lance-1', game: 'lgpe', gen: 7, trainer: { name: "Lance", class: "Elite Four", sprite: 'lance-lgpe' }, role: 'elite', place: "Indigo Plateau", party: "seadra:54|aerodactyl:54|gyarados:54|charizard:54|dragonite:55", cite: "#elite4-4 Lance" },
  { id: 'lgpe/lance-2', game: 'lgpe', gen: 7, trainer: { name: "Lance", class: "Elite Four", sprite: 'lance-lgpe' }, role: 'elite', place: "Indigo Plateau", party: "seadra:64|aerodactyl:64|gyarados:64|exeggutoralola:64|charizard:64|dragonite:65", cite: "#elite4-4 Lance - rematch" },
  { id: 'lgpe/trace-1', game: 'lgpe', gen: 7, trainer: { name: "Trace", class: "Champion", sprite: 'trace' }, role: 'champion', place: "Indigo Plateau", party: "pidgeot:56|vileplume:56|marowak:56|rapidash:56|slowbro:56|jolteon:57", cite: "#champion-5 Trace" },
  { id: 'lgpe/trace-2', game: 'lgpe', gen: 7, trainer: { name: "Trace", class: "Champion", sprite: 'trace' }, role: 'champion', place: "Indigo Plateau", party: "pidgeot:66|vileplume:66|marowak:66|rapidash:66|slowbro:66|jolteon:67", cite: "#champion-5 Trace - rematch" },
  { id: 'lgpe/trace-3', game: 'lgpe', gen: 7, trainer: { name: "Trace", class: "Champion", sprite: 'trace' }, role: 'champion', place: "Indigo Plateau", party: "pidgeot:56|vileplume:56|marowak:56|rapidash:56|slowbro:56|raichu:57", cite: "#champion-5 Trace" },
  { id: 'lgpe/trace-4', game: 'lgpe', gen: 7, trainer: { name: "Trace", class: "Champion", sprite: 'trace' }, role: 'champion', place: "Indigo Plateau", party: "pidgeot:66|vileplume:66|marowak:66|rapidash:66|slowbro:66|raichu:67", cite: "#champion-5 Trace - rematch" },
  { id: 'lgpe/archer-1', game: 'lgpe', gen: 7, trainer: { name: "Archer", class: "Pokemon Trainer", sprite: 'archer' }, role: 'boss', place: "Kanto", party: "electrode:54|golbat:54|magmar:54|weezing:54", cite: "#trainers-misc Archer" },
  { id: 'lgpe/green-1', game: 'lgpe', gen: 7, trainer: { name: "Green", class: "Pokemon Trainer", sprite: 'green' }, role: 'boss', place: "Cerulean City", party: "clefable:66|gengar:66|kangaskhan:66|victreebel:66|ninetales:66|blastoise:68", cite: "#trainers-misc Pokémon Trainer Green" },
  { id: 'lgpe/red-1', game: 'lgpe', gen: 7, trainer: { name: "Red", class: "Pokemon Trainer", sprite: 'red-lgpe' }, role: 'boss', place: "Kanto", party: "pikachu:85|machamp:85|arcanine:85|lapras:85|snorlax:85|venusaur:85", cite: "#trainers-misc Pokémon Trainer Red" },
];
