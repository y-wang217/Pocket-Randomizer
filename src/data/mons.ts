/**
 * Stage 0's fixed matchup, and nothing else any more.
 *
 * This file used to hold the curated wild and trainer pools — twenty-four
 * Pokemon with hand-written kits, which *were* the difficulty curve for as long
 * as there was no randomizer. Stage 2 has one, so they are gone: the pools now
 * live in data/speciesPools.ts and data/movePools.ts (generated from the dex),
 * the curve lives in data/scaling.ts, and the rolls live in core/randomizer.ts.
 *
 * What survives is Snorlax versus Milotic, and it survives on purpose. The
 * Stage 0 determinism and replay tests are pinned to this exact matchup: they
 * are the tests that prove the *engine* is a pure function of its seed, and
 * repointing them at generated teams would make them test the randomizer as
 * well — a strictly worse test, and one that would go red every time a band
 * window moved.
 */
import type { TeamSpec } from '../core/types';

export const PLAYER_TEAM: TeamSpec = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Crunch', 'Curse', 'Rest'], level: 50 },
];

export const OPPONENT_TEAM: TeamSpec = [
  { species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald', 'Ice Beam', 'Recover', 'Dragon Tail'], level: 50 },
];
