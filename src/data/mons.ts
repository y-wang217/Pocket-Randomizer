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
/**
 * Wild encounters: the light end of the curve.
 *
 * Deliberately low base power. The first cut of this pool gave everything its
 * best move — Crunch, Close Combat, Gunk Shot — and `npm run sweep` measured
 * the result: fights lasted 1.5 turns whatever the levels were, because at
 * level 30 with no EVs a fully evolved Pokemon's best move one-shots another
 * one. Widening the level gap only changed *which* side did the one-shotting.
 * Dropping the kits to 40-70 BP is what actually bought a fight that takes
 * more than one turn, and therefore a run that is decided by attrition rather
 * than by who moved first.
 */
export const WILD_POOL: readonly MonEntry[] = [
  { id: 'raticate', species: 'Raticate', ability: 'Guts', moves: ['Quick Attack', 'Bite', 'Take Down', 'Swords Dance'] },
  { id: 'fearow', species: 'Fearow', ability: 'Keen Eye', moves: ['Wing Attack', 'Aerial Ace', 'Fury Attack', 'Agility'] },
  { id: 'golbat', species: 'Golbat', ability: 'Inner Focus', moves: ['Wing Attack', 'Poison Fang', 'Bite', 'Confuse Ray'] },
  { id: 'arbok', species: 'Arbok', ability: 'Intimidate', moves: ['Poison Fang', 'Bite', 'Rock Tomb', 'Glare'] },
  { id: 'sandslash', species: 'Sandslash', ability: 'Sand Rush', moves: ['Dig', 'Rock Tomb', 'Fury Cutter', 'Swords Dance'] },
  { id: 'marowak', species: 'Marowak', ability: 'Rock Head', moves: ['Bone Club', 'Rock Tomb', 'Headbutt', 'Swords Dance'] },
  { id: 'primeape', species: 'Primeape', ability: 'Vital Spirit', moves: ['Karate Chop', 'Rock Tomb', 'Fury Swipes', 'Bulk Up'] },
  { id: 'tentacruel', species: 'Tentacruel', ability: 'Liquid Ooze', moves: ['Water Pulse', 'Acid Spray', 'Bubble Beam', 'Poison Sting'] },
  { id: 'dodrio', species: 'Dodrio', ability: 'Early Bird', moves: ['Aerial Ace', 'Fury Attack', 'Bite', 'Swords Dance'] },
  { id: 'weezing', species: 'Weezing', ability: 'Levitate', moves: ['Sludge', 'Clear Smog', 'Venoshock', 'Will-O-Wisp'] },
  { id: 'kadabra', species: 'Kadabra', ability: 'Synchronize', moves: ['Confusion', 'Psybeam', 'Dazzling Gleam', 'Calm Mind'] },
  { id: 'seaking', species: 'Seaking', ability: 'Lightning Rod', moves: ['Water Pulse', 'Horn Attack', 'Icy Wind', 'Agility'] },
];

/**
 * Trainer encounters: the heavy end.
 *
 * Better coverage, several with recovery or setup, and a level band above the
 * wild pool. The sweep says a run that takes every trainer node reaches the gym
 * 27% of the time against 52% for one that takes wild fights — so the choice
 * between two fights is already a real one at Stage 1, before tiers and rewards
 * exist to make it a loud one.
 */
export const TRAINER_POOL: readonly MonEntry[] = [
  { id: 'vileplume', species: 'Vileplume', ability: 'Effect Spore', moves: ['Mega Drain', 'Sludge', 'Draining Kiss', 'Synthesis'] },
  { id: 'rapidash', species: 'Rapidash', ability: 'Flash Fire', moves: ['Flame Wheel', 'Stomp', 'Bulldoze', 'Morning Sun'] },
  { id: 'poliwrath', species: 'Poliwrath', ability: 'Water Absorb', moves: ['Bubble Beam', 'Brick Break', 'Ice Punch', 'Bulk Up'] },
  { id: 'machamp', species: 'Machamp', ability: 'No Guard', moves: ['Brick Break', 'Knock Off', 'Rock Tomb', 'Bulk Up'] },
  { id: 'muk', species: 'Muk', ability: 'Poison Touch', moves: ['Sludge', 'Shadow Sneak', 'Brick Break', 'Curse'] },
  { id: 'starmie', species: 'Starmie', ability: 'Natural Cure', moves: ['Water Pulse', 'Psybeam', 'Icy Wind', 'Recover'] },
  { id: 'ninetales', species: 'Ninetales', ability: 'Flash Fire', moves: ['Flame Wheel', 'Bite', 'Nasty Plot', 'Will-O-Wisp'] },
  { id: 'golem', species: 'Golem', ability: 'Sturdy', moves: ['Bulldoze', 'Rock Tomb', 'Headbutt', 'Curse'] },
  { id: 'hypno', species: 'Hypno', ability: 'Insomnia', moves: ['Psybeam', 'Shadow Ball', 'Nasty Plot', 'Thunder Wave'] },
  { id: 'kingler', species: 'Kingler', ability: 'Sheer Force', moves: ['Bubble Beam', 'Knock Off', 'Rock Tomb', 'Swords Dance'] },
  { id: 'victreebel', species: 'Victreebel', ability: 'Chlorophyll', moves: ['Mega Drain', 'Sludge', 'Knock Off', 'Swords Dance'] },
  { id: 'magneton', species: 'Magneton', ability: 'Analytic', moves: ['Shock Wave', 'Mirror Shot', 'Thunder Wave', 'Tri Attack'] },
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
