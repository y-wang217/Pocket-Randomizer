/**
 * The two moves the current generation calls illegal, held to the protocol.
 *
 * Gen 9 marks Cut `Unobtainable` and Flash `Past`, and `scripts/gen-pools.ts`
 * admits both anyway. That admission rests on a claim about the engine — that
 * `isNonstandard` is a legality verdict and GYMRUN never validates a team — and
 * a claim about the engine is worth exactly as much as the test behind it.
 *
 * So these assert against raw protocol lines rather than against a result.
 * "The battle finished" would pass if the move silently failed; `|-damage|` on
 * the line after `|move|...|Cut|` would not.
 *
 * Both run with the learnset tables stripped, like the rest of the suite. Run
 * `npm run test:trim-strict` to run them against proxies that throw on any read
 * of those tables, which is the form that shows nothing consulted a learnset to
 * decide whether a Gastly may swing a blade.
 */
import { describe, expect, it } from 'vitest';
import { runBattle } from '../src/core/battle/driver';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { firstUsableMovePolicy } from '../src/core/battle/policy';
import { DAMAGING_MOVES, STATUS_MOVES } from '../src/data/movePools';
import type { TeamSpec } from '../src/core/types';

/** Ghost/Poison, and it learns Cut and Flash in no generation. */
const GASTLY: TeamSpec = [{ species: 'Gastly', ability: 'Levitate', moves: ['Cut'], level: 50 }];
const TARGET: TeamSpec = [{ species: 'Snorlax', ability: 'Immunity', moves: ['Splash'], level: 50 }];

/** The line after the move was used, so a failed move cannot pass as a hit. */
function afterFirstUse(protocol: readonly string[], move: string): string | undefined {
  const index = protocol.findIndex((line) => line.startsWith('|move|') && line.includes(`|${move}|`));
  return index === -1 ? undefined : protocol[index + 1];
}

describe('Cut, which gen 9 calls Unobtainable', () => {
  it('is in the damaging pool', () => {
    expect(DAMAGING_MOVES.find((move) => move.id === 'cut')?.band).toBe(1);
  });

  it('executes and deals damage from a species that cannot learn it', async () => {
    const run = await runBattle(GASTLY, TARGET, 'NONSTD-CUT', firstUsableMovePolicy, greedyAiPolicy);
    expect(run.protocol.some((line) => line.startsWith('|move|') && line.includes('|Cut|'))).toBe(true);
    expect(afterFirstUse(run.protocol, 'Cut')).toMatch(/^\|-damage\|p2a: Snorlax\|/);
    // Nothing refused it: no failure, no immunity, no "can't use".
    expect(run.protocol.some((line) => /^\|-fail\||^\|-immune\||cant/.test(line))).toBe(false);
  });
});

describe('Flash, which gen 9 calls Past', () => {
  it('is in the status pool, tagged pressure and unbanded', () => {
    const flash = STATUS_MOVES.find((move) => move.id === 'flash');
    expect(flash?.impact).toBe('pressure');
    expect(flash?.band).toBeNull();
  });

  it('executes and lands the accuracy drop', async () => {
    const party: TeamSpec = [{ species: 'Gastly', ability: 'Levitate', moves: ['Flash'], level: 50 }];
    const run = await runBattle(party, TARGET, 'NONSTD-FLASH', firstUsableMovePolicy, greedyAiPolicy);
    expect(run.protocol.some((line) => line.startsWith('|move|') && line.includes('|Flash|'))).toBe(true);
    expect(afterFirstUse(run.protocol, 'Flash')).toBe('|-unboost|p2a: Snorlax|accuracy|1');
  });
});
