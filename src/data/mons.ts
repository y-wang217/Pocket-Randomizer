/**
 * Stage 0's two combatants.
 *
 * These are hardcoded, and that is the whole extent of it — they are hardcoded
 * *as `TeamSpec`s*, which is the same type Stage 2's randomizer will emit from
 * its rolls. The battle layer takes a TeamSpec and has no way to ask where it
 * came from, so replacing this file with a generator later is a change to this
 * file and nothing else.
 *
 * The matchup is chosen to make Stage 0 actually testable by hand:
 *   - neither side one-shots the other, so a battle runs several turns
 *   - both have a status move, so the status indicator has something to show
 *   - both have a boosting move, so the stat-stage indicators do too
 *   - Charizard's Solar Power and Blastoise's Torrent are conditional
 *     abilities, which is a cheap check that abilities are wired through
 */
import type { TeamSpec } from '../core/types';

export const PLAYER_TEAM: TeamSpec = [
  {
    species: 'Charizard',
    ability: 'Solar Power',
    moves: ['Flamethrower', 'Air Slash', 'Dragon Dance', 'Roost'],
    level: 50,
  },
];

export const OPPONENT_TEAM: TeamSpec = [
  {
    species: 'Blastoise',
    ability: 'Torrent',
    moves: ['Surf', 'Ice Beam', 'Iron Defense', 'Yawn'],
    level: 50,
  },
];
