/**
 * Stage 0's two combatants.
 *
 * These are hardcoded, and that is the whole extent of it — they are hardcoded
 * *as `TeamSpec`s*, which is the same type Stage 2's randomizer will emit from
 * its rolls. The battle layer takes a TeamSpec and has no way to ask where it
 * came from, so replacing this file with a generator later is a change to this
 * file and nothing else.
 *
 * The matchup was picked by measuring, not by taste. Over 30 seeds it runs 2-5
 * turns and the player wins about two thirds of the time with naive play —
 * long enough to watch the UI work, short enough to replay, and losable enough
 * that the defeat screen is not theoretical. The first pairing tried (Charizard
 * into Blastoise) ended in two turns every time, because Surf is 4x.
 *
 * It also exercises every indicator the stage calls for:
 *   - Body Slam's paralysis and Scald's burn light up the status badge
 *   - Curse moves three stat stages at once, in both directions
 *   - Thick Fat and Marvel Scale are conditional abilities, a cheap check that
 *     abilities reach the engine at all
 *   - Rest and Recover keep a battle going when the player wants it to
 */
import type { TeamSpec } from '../core/types';

export const PLAYER_TEAM: TeamSpec = [
  {
    species: 'Snorlax',
    ability: 'Thick Fat',
    moves: ['Body Slam', 'Crunch', 'Curse', 'Rest'],
    level: 50,
  },
];

export const OPPONENT_TEAM: TeamSpec = [
  {
    species: 'Milotic',
    ability: 'Marvel Scale',
    moves: ['Scald', 'Ice Beam', 'Recover', 'Dragon Tail'],
    level: 50,
  },
];
