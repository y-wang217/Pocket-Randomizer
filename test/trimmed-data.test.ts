/**
 * The bundle trim, held to its claim.
 *
 * build-config/trim-sim-data.ts strips @pkmn/sim's learnset, legality and
 * Pokemon GO tables — about 450 kB gzipped, roughly 40% of the bundle. The
 * justification is that they exist for `TeamValidator` and GYMRUN never
 * validates a team. That is a claim about the engine, so it gets tested against
 * the moves most likely to falsify it: the ones that reach for a move pool.
 *
 * Run `npm run test:trim-strict` to run the whole suite with the stubs replaced
 * by proxies that throw on any access. That is the strong form of this proof —
 * it shows the tables are never *read*, not merely that empty reads are
 * survivable.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { runBattle } from '../src/core/battle/driver';
import { firstUsableMovePolicy } from '../src/core/battle/policy';
import type { TeamSpec } from '../src/core/types';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../src/data/mons';

describe('trimmed sim data', () => {
  it('runs a normal battle without the validator tables', async () => {
    const run = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, 'TRIM', greedyAiPolicy, greedyAiPolicy);
    expect(run.result.winner).not.toBeNull();
  });

  it('handles the moves that reach for a move pool', async () => {
    // Metronome, Mimic, Sketch, Copycat, Assist and Transform all acquire a
    // move at runtime. If any of them consulted a learnset table, stripping it
    // would break them silently — and Stage 2's randomizer will absolutely roll
    // them onto something.
    const trickster: TeamSpec = [
      { species: 'Smeargle', ability: 'Own Tempo', moves: ['Metronome', 'Mimic', 'Sketch', 'Transform'], level: 50 },
    ];
    const foil: TeamSpec = [
      { species: 'Ditto', ability: 'Imposter', moves: ['Copycat', 'Assist', 'Struggle', 'Tackle'], level: 50 },
    ];

    for (let seed = 0; seed < 12; seed++) {
      const run = await runBattle(trickster, foil, `TRICK-${seed}`, firstUsableMovePolicy, greedyAiPolicy);
      expect(run.result.turns).toBeGreaterThan(0);
    }
  });

  it('still resolves species, moves, abilities and items', async () => {
    // Everything the game *does* need out of the dex has to survive the trim.
    const held: TeamSpec = [
      { species: 'Sneasel', ability: 'Inner Focus', moves: ['Knock Off', 'Ice Shard'], level: 50, item: 'Life Orb' },
    ];
    const run = await runBattle(held, OPPONENT_TEAM, 'ITEMS', firstUsableMovePolicy, greedyAiPolicy);
    expect(run.protocol.some((line) => line.includes('Knock Off'))).toBe(true);
    expect(run.result.winner).not.toBeNull();
  });
});
