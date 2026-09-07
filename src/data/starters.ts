/**
 * The starter whitelist.
 *
 * Curated means no duds. The player picks one Pokemon and carries a whole
 * segment on it, so a bad roll here is not a bad turn, it is a lost run the
 * player never had a hand in. Every entry therefore has: usable bulk, a
 * reliable STAB move, one coverage move, and either recovery or setup. There
 * is no entry on this list that cannot beat the Stage 1 gym.
 *
 * Exposed as a *function* rather than a bare array on purpose. Stage 5 expands
 * the pool through unlocks, and `getStarterPool(unlocked)` is where that lands
 * — not in the run code, which only ever asks for a pool and draws from it.
 */
import type { MonEntry } from './mons';

/**
 * The pool as it stands, in a fixed order.
 *
 * Order matters: generation draws indices from a seeded stream, so reordering
 * this list changes what every recorded seed offers. Append, do not insert.
 */
const STARTERS: readonly MonEntry[] = [
  { id: 'venusaur', species: 'Venusaur', ability: 'Overgrow', moves: ['Giga Drain', 'Sludge Bomb', 'Sleep Powder', 'Synthesis'] },
  { id: 'blastoise', species: 'Blastoise', ability: 'Torrent', moves: ['Surf', 'Ice Beam', 'Dark Pulse', 'Rest'] },
  { id: 'charizard', species: 'Charizard', ability: 'Blaze', moves: ['Flamethrower', 'Air Slash', 'Dragon Pulse', 'Roost'] },
  { id: 'snorlax', species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Crunch', 'Curse', 'Rest'] },
  { id: 'gyarados', species: 'Gyarados', ability: 'Intimidate', moves: ['Waterfall', 'Crunch', 'Ice Fang', 'Dragon Dance'] },
  { id: 'sylveon', species: 'Sylveon', ability: 'Pixilate', moves: ['Hyper Voice', 'Psyshock', 'Calm Mind', 'Draining Kiss'] },
  { id: 'metagross', species: 'Metagross', ability: 'Clear Body', moves: ['Meteor Mash', 'Zen Headbutt', 'Earthquake', 'Bullet Punch'] },
  { id: 'dragonite', species: 'Dragonite', ability: 'Multiscale', moves: ['Dragon Claw', 'Earthquake', 'Roost', 'Dragon Dance'] },
  { id: 'arcanine', species: 'Arcanine', ability: 'Intimidate', moves: ['Flare Blitz', 'Extreme Speed', 'Wild Charge', 'Morning Sun'] },
  { id: 'swampert', species: 'Swampert', ability: 'Torrent', moves: ['Earthquake', 'Waterfall', 'Ice Punch', 'Rest'] },
  { id: 'clefable', species: 'Clefable', ability: 'Magic Guard', moves: ['Moonblast', 'Flamethrower', 'Calm Mind', 'Soft-Boiled'] },
];

/**
 * Species that exist but are not offered until unlocked.
 *
 * Empty in Stage 1, and that is the honest state of it: there is no unlock
 * system yet, so there is nothing to unlock. Stage 5 fills this table and
 * changes nothing else.
 */
const LOCKED: readonly MonEntry[] = [];

/**
 * The species a run may offer as starters.
 *
 * Unlocks are strictly **additive**, and appended after the base pool. Both
 * halves matter for seed compatibility: an unlock that removed an entry, or one
 * that inserted into the middle, would change what every previously recorded
 * seed offers, because generation draws indices from this list.
 *
 * @param unlocked Ids the player has unlocked. Stage 1 never passes it.
 */
export function getStarterPool(unlocked?: readonly string[]): readonly MonEntry[] {
  if (!unlocked || unlocked.length === 0) return STARTERS;
  const wanted = new Set(unlocked);
  return [...STARTERS, ...LOCKED.filter((entry) => wanted.has(entry.id))];
}
