/**
 * The curated species pools.
 *
 * Everything here is a `MonEntry`: a species, an ability and four moves, with
 * no level. Level is a *tuning* number, not a data number — it is a function of
 * the segment index and the node kind (see data/tuning.ts), so baking one into
 * a pool entry would put a balance lever somewhere Stage 2's sweep cannot reach.
 * `toSpec(entry, level)` is the only way an entry becomes a `PokemonSpec`.
 *
 * "Curated" is load-bearing rather than decorative. Stage 2 replaces these
 * pools with a randomizer; until then the pools are the difficulty curve, so
 * every entry carries four moves that do something, and no entry can lose a
 * battle to itself. Specifically excluded:
 *
 *   - self-KO moves (Explosion, Final Gambit): they end a run on the opponent's
 *     whim rather than on the player's play
 *   - switch moves (U-turn, Volt Switch, Baton Pass, Teleport): the driver has
 *     no switch choice until Stage 4, and a move whose point is a switch is a
 *     move that silently does half of what it says
 *   - evasion abilities (Sand Veil, Snow Cloak): a miss the player cannot see
 *     coming reads as the engine being broken
 *
 * Custom Game runs no legality check, so several of these movesets are
 * illegal by cartridge rules. That is the point — Stage 2's randomizer will
 * produce far stranger ones, and the engine has to take them today.
 */
import type { PokemonSpec, TeamSpec } from '../core/types';

/** A pool entry: identity and kit, but no level. */
export interface MonEntry {
  /** Stable id. Unlocks (Stage 5) and save logs key off this, not the species. */
  id: string;
  species: string;
  ability: string;
  moves: string[];
}

/** Turn a pool entry into something the battle layer can take. */
export function toSpec(entry: MonEntry, level: number): PokemonSpec {
  return { species: entry.species, ability: entry.ability, moves: [...entry.moves], level };
}

/**
 * Wild encounters: the light end of the curve.
 *
 * These are meant to be won and to cost something — a chunk of HP, a few PP —
 * rather than to threaten a run. If a wild node reliably ends runs the offsets
 * in `tuning.levelOffset.wild` are the lever, not this list.
 */
export const WILD_POOL: readonly MonEntry[] = [
  { id: 'raticate', species: 'Raticate', ability: 'Guts', moves: ['Crunch', 'Body Slam', 'Sucker Punch', 'Swords Dance'] },
  { id: 'fearow', species: 'Fearow', ability: 'Keen Eye', moves: ['Drill Peck', 'Drill Run', 'Take Down', 'Agility'] },
  { id: 'golbat', species: 'Golbat', ability: 'Inner Focus', moves: ['Air Slash', 'Poison Fang', 'Bite', 'Confuse Ray'] },
  { id: 'arbok', species: 'Arbok', ability: 'Intimidate', moves: ['Poison Jab', 'Earthquake', 'Crunch', 'Glare'] },
  { id: 'sandslash', species: 'Sandslash', ability: 'Sand Rush', moves: ['Earthquake', 'Rock Slide', 'Crush Claw', 'Swords Dance'] },
  { id: 'marowak', species: 'Marowak', ability: 'Rock Head', moves: ['Bonemerang', 'Rock Slide', 'Double-Edge', 'Swords Dance'] },
  { id: 'primeape', species: 'Primeape', ability: 'Vital Spirit', moves: ['Close Combat', 'Rock Slide', 'Night Slash', 'Bulk Up'] },
  { id: 'tentacruel', species: 'Tentacruel', ability: 'Liquid Ooze', moves: ['Surf', 'Sludge Bomb', 'Ice Beam', 'Acid Spray'] },
  { id: 'dodrio', species: 'Dodrio', ability: 'Early Bird', moves: ['Brave Bird', 'Drill Run', 'Knock Off', 'Swords Dance'] },
  { id: 'weezing', species: 'Weezing', ability: 'Levitate', moves: ['Sludge Bomb', 'Flamethrower', 'Thunderbolt', 'Will-O-Wisp'] },
  { id: 'kadabra', species: 'Kadabra', ability: 'Synchronize', moves: ['Psychic', 'Shadow Ball', 'Dazzling Gleam', 'Calm Mind'] },
  { id: 'seaking', species: 'Seaking', ability: 'Lightning Rod', moves: ['Waterfall', 'Megahorn', 'Drill Run', 'Ice Beam'] },
];

/**
 * Trainer encounters: the heavy end.
 *
 * Bulkier, better coverage, and several with recovery, so a trainer node is a
 * real fight rather than a longer wild one. They sit one level band above the
 * wild pool by tuning, not by stat total.
 */
export const TRAINER_POOL: readonly MonEntry[] = [
  { id: 'vileplume', species: 'Vileplume', ability: 'Effect Spore', moves: ['Giga Drain', 'Sludge Bomb', 'Moonblast', 'Synthesis'] },
  { id: 'rapidash', species: 'Rapidash', ability: 'Flash Fire', moves: ['Flare Blitz', 'Wild Charge', 'High Horsepower', 'Morning Sun'] },
  { id: 'poliwrath', species: 'Poliwrath', ability: 'Water Absorb', moves: ['Waterfall', 'Close Combat', 'Ice Punch', 'Bulk Up'] },
  { id: 'machamp', species: 'Machamp', ability: 'No Guard', moves: ['Dynamic Punch', 'Knock Off', 'Stone Edge', 'Bulk Up'] },
  { id: 'muk', species: 'Muk', ability: 'Poison Touch', moves: ['Gunk Shot', 'Shadow Sneak', 'Brick Break', 'Curse'] },
  { id: 'starmie', species: 'Starmie', ability: 'Natural Cure', moves: ['Hydro Pump', 'Psychic', 'Ice Beam', 'Recover'] },
  { id: 'ninetales', species: 'Ninetales', ability: 'Flash Fire', moves: ['Flamethrower', 'Dark Pulse', 'Nasty Plot', 'Will-O-Wisp'] },
  { id: 'golem', species: 'Golem', ability: 'Sturdy', moves: ['Earthquake', 'Stone Edge', 'Heavy Slam', 'Curse'] },
  { id: 'hypno', species: 'Hypno', ability: 'Insomnia', moves: ['Psychic', 'Shadow Ball', 'Nasty Plot', 'Thunder Wave'] },
  { id: 'kingler', species: 'Kingler', ability: 'Sheer Force', moves: ['Crabhammer', 'Knock Off', 'X-Scissor', 'Swords Dance'] },
  { id: 'victreebel', species: 'Victreebel', ability: 'Chlorophyll', moves: ['Leaf Blade', 'Sludge Bomb', 'Knock Off', 'Swords Dance'] },
  { id: 'magneton', species: 'Magneton', ability: 'Analytic', moves: ['Thunderbolt', 'Flash Cannon', 'Thunder Wave', 'Tri Attack'] },
];

// ---------------------------------------------------------------------------
// Stage 0's fixed matchup
// ---------------------------------------------------------------------------

/**
 * Snorlax versus Milotic, kept as-is.
 *
 * Stage 1 no longer plays this battle, but the Stage 0 determinism and replay
 * tests are pinned to it. They are the tests that prove the engine is a pure
 * function of the seed, and repointing them at generated teams would make them
 * test generation as well — a strictly worse test.
 */
export const PLAYER_TEAM: TeamSpec = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Crunch', 'Curse', 'Rest'], level: 50 },
];

export const OPPONENT_TEAM: TeamSpec = [
  { species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald', 'Ice Beam', 'Recover', 'Dragon Tail'], level: 50 },
];
