/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pret/pokered at d2704a63c26f9ba046ade877445216b3de0519a4. Fix the importer or the pin, then regenerate.
 *
 * Red and Blue: 38 encounters, the bosses, rivals, leaders, Elite Four
 * and villains; its 314 route trainers are in `rby-routes.ts`. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const RBY_SOURCE: EncounterSource = {
  repo: 'pret/pokered',
  sha: 'd2704a63c26f9ba046ade877445216b3de0519a4',
  files: ['data/trainers/parties.asm', 'data/trainers/names.asm'],
};

export const RBY_ROWS: readonly EncounterRow[] = [
  { id: 'rby/blue-1', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Kanto", party: "squirtle:5", cite: "Rival1Data" },
  { id: 'rby/blue-2', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Kanto", party: "bulbasaur:5", cite: "Rival1Data" },
  { id: 'rby/blue-3', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Kanto", party: "charmander:5", cite: "Rival1Data" },
  { id: 'rby/blue-4', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Route 22", party: "pidgey:9|squirtle:8", cite: "Rival1Data" },
  { id: 'rby/blue-5', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Route 22", party: "pidgey:9|bulbasaur:8", cite: "Rival1Data" },
  { id: 'rby/blue-6', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Route 22", party: "pidgey:9|charmander:8", cite: "Rival1Data" },
  { id: 'rby/blue-7', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Cerulean City", party: "pidgeotto:18|abra:15|rattata:15|squirtle:17", cite: "Rival1Data" },
  { id: 'rby/blue-8', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Cerulean City", party: "pidgeotto:18|abra:15|rattata:15|bulbasaur:17", cite: "Rival1Data" },
  { id: 'rby/blue-9', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Cerulean City", party: "pidgeotto:18|abra:15|rattata:15|charmander:17", cite: "Rival1Data" },
  { id: 'rby/giovanni-1', game: 'rby', gen: 1, trainer: { name: "Giovanni", class: "Boss", sprite: 'giovanni-gen1rb' }, role: 'boss', place: "Rocket Hideout B4F", party: "onix:25|rhyhorn:24|kangaskhan:29", cite: "GiovanniData" },
  { id: 'rby/giovanni-2', game: 'rby', gen: 1, trainer: { name: "Giovanni", class: "Boss", sprite: 'giovanni-gen1rb' }, role: 'boss', place: "Silph Co. 11F", party: "nidorino:37|kangaskhan:35|rhyhorn:37|nidoqueen:41", cite: "GiovanniData" },
  { id: 'rby/giovanni-3', game: 'rby', gen: 1, trainer: { name: "Giovanni", class: "Leader", sprite: 'giovanni-gen1rb' }, role: 'gym', place: "Viridian Gym", gymType: 'Ground', party: "rhyhorn:45|dugtrio:42|nidoqueen:44|nidoking:45|rhydon:50", cite: "GiovanniData" },
  { id: 'rby/bruno-1', game: 'rby', gen: 1, trainer: { name: "Bruno", class: "Elite Four", sprite: 'bruno-gen1rb' }, role: 'elite', place: "Indigo Plateau", party: "onix:53|hitmonchan:55|hitmonlee:55|onix:56|machamp:58", cite: "BrunoData" },
  { id: 'rby/brock-1', game: 'rby', gen: 1, trainer: { name: "Brock", class: "Leader", sprite: 'brock-gen1rb' }, role: 'gym', place: "Pewter City Gym", gymType: 'Rock', party: "geodude:12|onix:14", cite: "BrockData" },
  { id: 'rby/misty-1', game: 'rby', gen: 1, trainer: { name: "Misty", class: "Leader", sprite: 'misty-gen1rb' }, role: 'gym', place: "Cerulean City Gym", gymType: 'Water', party: "staryu:18|starmie:21", cite: "MistyData" },
  { id: 'rby/lt-surge-1', game: 'rby', gen: 1, trainer: { name: "Lt. Surge", class: "Leader", sprite: 'ltsurge-gen1rb' }, role: 'gym', place: "Vermilion City Gym", gymType: 'Electric', party: "voltorb:21|pikachu:18|raichu:24", cite: "LtSurgeData" },
  { id: 'rby/erika-1', game: 'rby', gen: 1, trainer: { name: "Erika", class: "Leader", sprite: 'erika-gen1rb' }, role: 'gym', place: "Celadon City Gym", gymType: 'Grass', party: "victreebel:29|tangela:24|vileplume:29", cite: "ErikaData" },
  { id: 'rby/koga-1', game: 'rby', gen: 1, trainer: { name: "Koga", class: "Leader", sprite: 'koga-gen1rb' }, role: 'gym', place: "Fuchsia City Gym", gymType: 'Poison', party: "koffing:37|muk:39|koffing:37|weezing:43", cite: "KogaData" },
  { id: 'rby/blaine-1', game: 'rby', gen: 1, trainer: { name: "Blaine", class: "Leader", sprite: 'blaine-gen1rb' }, role: 'gym', place: "Cinnabar Island Gym", gymType: 'Fire', party: "growlithe:42|ponyta:40|rapidash:42|arcanine:47", cite: "BlaineData" },
  { id: 'rby/sabrina-1', game: 'rby', gen: 1, trainer: { name: "Sabrina", class: "Leader", sprite: 'sabrina-gen1rb' }, role: 'gym', place: "Saffron City Gym", gymType: 'Psychic', party: "kadabra:38|mrmime:37|venomoth:38|alakazam:43", cite: "SabrinaData" },
  { id: 'rby/blue-10', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "SS Anne 2F", party: "pidgeotto:19|raticate:16|kadabra:18|wartortle:20", cite: "Rival2Data" },
  { id: 'rby/blue-11', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "SS Anne 2F", party: "pidgeotto:19|raticate:16|kadabra:18|ivysaur:20", cite: "Rival2Data" },
  { id: 'rby/blue-12', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "SS Anne 2F", party: "pidgeotto:19|raticate:16|kadabra:18|charmeleon:20", cite: "Rival2Data" },
  { id: 'rby/blue-13', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Pokémon Tower 2F", party: "pidgeotto:25|growlithe:23|exeggcute:22|kadabra:20|wartortle:25", cite: "Rival2Data" },
  { id: 'rby/blue-14', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Pokémon Tower 2F", party: "pidgeotto:25|gyarados:23|growlithe:22|kadabra:20|ivysaur:25", cite: "Rival2Data" },
  { id: 'rby/blue-15', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Pokémon Tower 2F", party: "pidgeotto:25|exeggcute:23|gyarados:22|kadabra:20|charmeleon:25", cite: "Rival2Data" },
  { id: 'rby/blue-16', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Silph Co. 7F", party: "pidgeot:37|growlithe:38|exeggcute:35|alakazam:35|blastoise:40", cite: "Rival2Data" },
  { id: 'rby/blue-17', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Silph Co. 7F", party: "pidgeot:37|gyarados:38|growlithe:35|alakazam:35|venusaur:40", cite: "Rival2Data" },
  { id: 'rby/blue-18', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Silph Co. 7F", party: "pidgeot:37|exeggcute:38|gyarados:35|alakazam:35|charizard:40", cite: "Rival2Data" },
  { id: 'rby/blue-19', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Route 22", party: "pidgeot:47|rhyhorn:45|growlithe:45|exeggcute:47|alakazam:50|blastoise:53", cite: "Rival2Data" },
  { id: 'rby/blue-20', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Route 22", party: "pidgeot:47|rhyhorn:45|gyarados:45|growlithe:47|alakazam:50|venusaur:53", cite: "Rival2Data" },
  { id: 'rby/blue-21', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1rb' }, role: 'rival', place: "Route 22", party: "pidgeot:47|rhyhorn:45|exeggcute:45|gyarados:47|alakazam:50|charizard:53", cite: "Rival2Data" },
  { id: 'rby/blue-22', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Champion", sprite: 'blue-gen1rbchampion' }, role: 'champion', place: "Indigo Plateau", party: "pidgeot:61|alakazam:59|rhydon:61|arcanine:61|exeggutor:63|blastoise:65", cite: "Rival3Data" },
  { id: 'rby/blue-23', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Champion", sprite: 'blue-gen1rbchampion' }, role: 'champion', place: "Indigo Plateau", party: "pidgeot:61|alakazam:59|rhydon:61|gyarados:61|arcanine:63|venusaur:65", cite: "Rival3Data" },
  { id: 'rby/blue-24', game: 'rby', gen: 1, trainer: { name: "Blue", class: "Champion", sprite: 'blue-gen1rbchampion' }, role: 'champion', place: "Indigo Plateau", party: "pidgeot:61|alakazam:59|rhydon:61|exeggutor:61|gyarados:63|charizard:65", cite: "Rival3Data" },
  { id: 'rby/lorelei-1', game: 'rby', gen: 1, trainer: { name: "Lorelei", class: "Elite Four", sprite: 'lorelei-gen1rb' }, role: 'elite', place: "Indigo Plateau", party: "dewgong:54|cloyster:53|slowbro:54|jynx:56|lapras:56", cite: "LoreleiData" },
  { id: 'rby/agatha-1', game: 'rby', gen: 1, trainer: { name: "Agatha", class: "Elite Four", sprite: 'agatha-gen1rb' }, role: 'elite', place: "Indigo Plateau", party: "gengar:56|golbat:56|haunter:55|arbok:58|gengar:60", cite: "AgathaData" },
  { id: 'rby/lance-1', game: 'rby', gen: 1, trainer: { name: "Lance", class: "Elite Four", sprite: 'lance-gen1rb' }, role: 'elite', place: "Kanto", party: "gyarados:58|dragonair:56|dragonair:56|aerodactyl:60|dragonite:62", cite: "LanceData" },
];
