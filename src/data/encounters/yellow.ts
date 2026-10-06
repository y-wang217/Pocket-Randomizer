/**
 * GENERATED FILE — do not hand-edit. Produced by `npm run gen:encounters`
 * from pret/pokeyellow at e89ead154b9968aa50eed9328ff2b38b6c194382. Fix the importer or the pin, then regenerate.
 *
 * Yellow: 30 encounters, the bosses, rivals, leaders, Elite Four
 * and villains; its 313 route trainers are in `yellow-routes.ts`. A row's `cite` is its label
 * inside the files named below. A row's `party` is one string per the grammar
 * in `types.ts` (`species:level[@item][>moves][#gender]`, members on `|`),
 * decoded once at load by `index.ts`.
 *
 * Regenerating is a draw-composition change for every node that draws from
 * this table: bump RANDOMIZER_VERSION in src/core/randomizer.ts.
 */
import type { EncounterRow, EncounterSource } from './types';

export const YELLOW_SOURCE: EncounterSource = {
  repo: 'pret/pokeyellow',
  sha: 'e89ead154b9968aa50eed9328ff2b38b6c194382',
  files: ['data/trainers/parties.asm', 'data/trainers/names.asm'],
};

export const YELLOW_ROWS: readonly EncounterRow[] = [
  { id: 'yellow/blue-1', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "Oak's Lab", party: "eevee:5", cite: "Rival1Data" },
  { id: 'yellow/blue-2', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "Route 22", party: "spearow:9|eevee:8", cite: "Rival1Data" },
  { id: 'yellow/blue-3', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "Cerulean City", party: "spearow:18|sandshrew:15|rattata:15|eevee:17", cite: "Rival1Data" },
  { id: 'yellow/giovanni-1', game: 'yellow', gen: 1, trainer: { name: "Giovanni", class: "Boss", sprite: 'giovanni-gen1' }, role: 'boss', place: "Rocket Hideout B4F", party: "onix:25|rhyhorn:24|persian:29", cite: "GiovanniData" },
  { id: 'yellow/giovanni-2', game: 'yellow', gen: 1, trainer: { name: "Giovanni", class: "Boss", sprite: 'giovanni-gen1' }, role: 'boss', place: "Silph Co. 11F", party: "nidorino:37|persian:35|rhyhorn:37|nidoqueen:41", cite: "GiovanniData" },
  { id: 'yellow/giovanni-3', game: 'yellow', gen: 1, trainer: { name: "Giovanni", class: "Leader", sprite: 'giovanni-gen1' }, role: 'gym', place: "Viridian Gym", gymType: 'Ground', party: "dugtrio:50|persian:53|nidoqueen:53|nidoking:55|rhydon:55", cite: "GiovanniData" },
  { id: 'yellow/bruno-1', game: 'yellow', gen: 1, trainer: { name: "Bruno", class: "Elite Four", sprite: 'bruno-gen1' }, role: 'elite', place: "Indigo Plateau", party: "onix:53|hitmonchan:55|hitmonlee:55|onix:56|machamp:58", cite: "BrunoData" },
  { id: 'yellow/brock-1', game: 'yellow', gen: 1, trainer: { name: "Brock", class: "Leader", sprite: 'brock-gen1' }, role: 'gym', place: "Pewter City Gym", gymType: 'Rock', party: "geodude:10|onix:12", cite: "BrockData" },
  { id: 'yellow/misty-1', game: 'yellow', gen: 1, trainer: { name: "Misty", class: "Leader", sprite: 'misty-gen1' }, role: 'gym', place: "Cerulean City Gym", gymType: 'Water', party: "staryu:18|starmie:21", cite: "MistyData" },
  { id: 'yellow/lt-surge-1', game: 'yellow', gen: 1, trainer: { name: "Lt. Surge", class: "Leader", sprite: 'ltsurge-gen1' }, role: 'gym', place: "Vermilion City Gym", gymType: 'Electric', party: "raichu:28", cite: "LtSurgeData" },
  { id: 'yellow/erika-1', game: 'yellow', gen: 1, trainer: { name: "Erika", class: "Leader", sprite: 'erika-gen1' }, role: 'gym', place: "Celadon City Gym", gymType: 'Grass', party: "tangela:30|weepinbell:32|gloom:32", cite: "ErikaData" },
  { id: 'yellow/koga-1', game: 'yellow', gen: 1, trainer: { name: "Koga", class: "Leader", sprite: 'koga-gen1' }, role: 'gym', place: "Fuchsia City Gym", gymType: 'Poison', party: "venonat:44|venonat:46|venonat:48|venomoth:50", cite: "KogaData" },
  { id: 'yellow/blaine-1', game: 'yellow', gen: 1, trainer: { name: "Blaine", class: "Leader", sprite: 'blaine-gen1' }, role: 'gym', place: "Cinnabar Island Gym", gymType: 'Fire', party: "ninetales:48|rapidash:50|arcanine:54", cite: "BlaineData" },
  { id: 'yellow/sabrina-1', game: 'yellow', gen: 1, trainer: { name: "Sabrina", class: "Leader", sprite: 'sabrina-gen1' }, role: 'gym', place: "Saffron City Gym", gymType: 'Psychic', party: "abra:50|kadabra:50|alakazam:50", cite: "SabrinaData" },
  { id: 'yellow/blue-4', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "SS Anne 2F", party: "spearow:19|rattata:16|sandshrew:18|eevee:20", cite: "Rival2Data" },
  { id: 'yellow/blue-5', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "Pokémon Tower 2F", party: "fearow:25|shellder:23|vulpix:22|sandshrew:20|eevee:25", cite: "Rival2Data" },
  { id: 'yellow/blue-6', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "Pokémon Tower 2F", party: "fearow:25|magnemite:23|shellder:22|sandshrew:20|eevee:25", cite: "Rival2Data" },
  { id: 'yellow/blue-7', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "Pokémon Tower 2F", party: "fearow:25|vulpix:23|magnemite:22|sandshrew:20|eevee:25", cite: "Rival2Data" },
  { id: 'yellow/blue-8', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "Silph Co. 7F", party: "sandslash:38|ninetales:35|cloyster:37|kadabra:35|jolteon:40", cite: "Rival2Data" },
  { id: 'yellow/blue-9', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "Silph Co. 7F", party: "sandslash:38|cloyster:35|magneton:37|kadabra:35|flareon:40", cite: "Rival2Data" },
  { id: 'yellow/blue-10', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "Silph Co. 7F", party: "sandslash:38|magneton:35|ninetales:37|kadabra:35|vaporeon:40", cite: "Rival2Data" },
  { id: 'yellow/blue-11', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "Route 22", party: "sandslash:47|exeggcute:45|ninetales:45|cloyster:47|kadabra:50|jolteon:53", cite: "Rival2Data" },
  { id: 'yellow/blue-12', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "Route 22", party: "sandslash:47|exeggcute:45|cloyster:45|magneton:47|kadabra:50|flareon:53", cite: "Rival2Data" },
  { id: 'yellow/blue-13', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Rival", sprite: 'blue-gen1' }, role: 'rival', place: "Route 22", party: "sandslash:47|exeggcute:45|magneton:45|ninetales:47|kadabra:50|vaporeon:53", cite: "Rival2Data" },
  { id: 'yellow/blue-14', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Champion", sprite: 'blue-gen1champion' }, role: 'champion', place: "Champion's Room", party: "sandslash:61|alakazam:59|exeggutor:61|cloyster:61|ninetales:63|jolteon:65", cite: "Rival3Data" },
  { id: 'yellow/blue-15', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Champion", sprite: 'blue-gen1champion' }, role: 'champion', place: "Champion's Room", party: "sandslash:61|alakazam:59|exeggutor:61|magneton:61|cloyster:63|flareon:65", cite: "Rival3Data" },
  { id: 'yellow/blue-16', game: 'yellow', gen: 1, trainer: { name: "Blue", class: "Champion", sprite: 'blue-gen1champion' }, role: 'champion', place: "Champion's Room", party: "sandslash:61|alakazam:59|exeggutor:61|ninetales:61|magneton:63|vaporeon:65", cite: "Rival3Data" },
  { id: 'yellow/lorelei-1', game: 'yellow', gen: 1, trainer: { name: "Lorelei", class: "Elite Four", sprite: 'lorelei-gen1' }, role: 'elite', place: "Indigo Plateau", party: "dewgong:54|cloyster:53|slowbro:54|jynx:56|lapras:56", cite: "LoreleiData" },
  { id: 'yellow/agatha-1', game: 'yellow', gen: 1, trainer: { name: "Agatha", class: "Elite Four", sprite: 'agatha-gen1' }, role: 'elite', place: "Indigo Plateau", party: "gengar:56|golbat:56|haunter:55|arbok:58|gengar:60", cite: "AgathaData" },
  { id: 'yellow/lance-1', game: 'yellow', gen: 1, trainer: { name: "Lance", class: "Elite Four", sprite: 'lance-gen1' }, role: 'elite', place: "Kanto", party: "gyarados:58|dragonair:56|dragonair:56|aerodactyl:60|dragonite:62", cite: "LanceData" },
];
