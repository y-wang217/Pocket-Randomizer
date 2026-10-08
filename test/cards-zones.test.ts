/** The card board's geometry. **Card battle engine, checkpoint 1.** */
import { describe, expect, it } from 'vitest';

import { blastCentres, blastTiles, inReach, laneFromSide, moveDestinations, slashTiles, zoneOf } from '../src/core/cards/zones';
import { at } from './fixtures/card-battle';

const sorted = (tiles: { lane: number; col: number }[]): string[] => tiles.map((t) => `${t.lane},${t.col}`).sort();

describe('card zones', () => {
  it('splits the columns into three zones and two reaches', () => {
    expect([1, 2, 3, 4, 5, 6].map((col) => zoneOf(at(1, col as 1)))).toEqual([
      'playerBackline', 'playerBackline', 'danger', 'danger', 'enemyBackline', 'enemyBackline',
    ]);
    expect(inReach('player', at(2, 4))).toBe(true);
    expect(inReach('player', at(2, 5))).toBe(false);
    expect(inReach('enemy', at(2, 3))).toBe(true);
    expect(inReach('enemy', at(2, 2))).toBe(false);
  });

  it('shapes Slash as the next column, clipped at the board edge', () => {
    expect(sorted(slashTiles('player', at(2, 3)))).toEqual(['1,4', '2,4', '3,4']);
    expect(sorted(slashTiles('player', at(1, 4)))).toEqual(['1,5', '2,5']);
    expect(sorted(slashTiles('enemy', at(3, 4)))).toEqual(['2,3', '3,3']);
  });

  it('shapes Blast as a centre and its four neighbours, clipped at the edge', () => {
    expect(sorted(blastTiles(at(2, 5)))).toEqual(['1,5', '2,4', '2,5', '2,6', '3,5']);
    expect(sorted(blastTiles(at(1, 6)))).toEqual(['1,5', '1,6', '2,6']);
    expect(sorted(blastCentres('player', at(2, 4)))).toEqual(['1,5', '1,6', '2,5', '2,6', '3,5', '3,6']);
  });

  it('orders a lane from the attacker side of the board', () => {
    expect(laneFromSide('player', 2).map((t) => t.col)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(laneFromSide('enemy', 2).map((t) => t.col)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('moves through empty tiles only, inside the reach', () => {
    // Move 1 from (2,4): (2,5) is outside player reach, (1,4) is occupied.
    expect(sorted(moveDestinations('player', at(2, 4), 1, [at(1, 4)]))).toEqual(['2,3', '3,4']);
    // Move 2 cannot pass through a unit in the way.
    expect(sorted(moveDestinations('player', at(2, 1), 2, [at(2, 2), at(1, 1), at(3, 1)]))).toEqual([]);
    expect(sorted(moveDestinations('player', at(2, 2), 2, []))).toEqual(
      ['1,1', '1,2', '1,3', '2,1', '2,3', '2,4', '3,1', '3,2', '3,3'],
    );
  });
});
