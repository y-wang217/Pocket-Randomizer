/**
 * A move fact's column is its identity, and no two fields that share a column
 * appear on one move.
 *
 * **The playtest complaint this holds the fix for:** "the line breaks for the
 * band and the accuracy etc must be consistent for the user to remember what
 * they mean." The strip packed its chips left to right, so a move with no
 * contact flag put its secondary-effect chance exactly where the button beside
 * it put contact, and `BAND n` wrapped onto the first line of one button and
 * the second line of the next depending on how long that move's type name was.
 *
 * The fix is a fixed grid, and a fixed grid rests on a claim about the data:
 * **four columns are enough, and the fields sharing one never co-occur.** That
 * claim is true of the pools today and nothing about it is self-enforcing — a
 * move added to `data/movePools.ts` could break either half — so it is
 * re-derived here over the live tables rather than asserted as a number
 * somebody once measured.
 *
 * The grouping's justification is in `data/moveFactInfo.ts`. This file is the
 * check that the justification still describes the tables.
 */
import { describe, expect, it } from 'vitest';

import { describeMove } from '../src/core/battle/driver';
import { moveFactsOf, MOVE_FACT_IDS, type MoveFactId } from '../src/core/moveFacts';
import { MOVE_FACT_COLUMN, MOVE_FACT_COLUMNS } from '../src/data/moveFactInfo';
import { DAMAGING_MOVES, STATUS_MOVES } from '../src/data/movePools';

/** Every move the game can draw, with its face facts. */
function factsByMove(): Map<string, MoveFactId[]> {
  const out = new Map<string, MoveFactId[]>();
  for (const entry of [...DAMAGING_MOVES, ...STATUS_MOVES]) {
    const explained = describeMove(entry.name);
    if (!explained) continue;
    out.set(entry.name, moveFactsOf(explained).map((fact) => fact.id));
  }
  return out;
}

describe('the fact column map', () => {
  it('gives every field a column inside the grid', () => {
    for (const id of MOVE_FACT_IDS) {
      const column = MOVE_FACT_COLUMN[id];
      expect(Number.isInteger(column), id).toBe(true);
      expect(column, id).toBeGreaterThanOrEqual(1);
      expect(column, id).toBeLessThanOrEqual(MOVE_FACT_COLUMNS);
    }
  });

  it('never gives one move two fields in the same column', () => {
    const collisions: string[] = [];
    for (const [name, facts] of factsByMove()) {
      const seen = new Map<number, MoveFactId>();
      for (const id of facts) {
        const column = MOVE_FACT_COLUMN[id];
        const taken = seen.get(column);
        if (taken) collisions.push(`${name}: ${taken} and ${id} both want column ${column}`);
        else seen.set(column, id);
      }
    }
    /*
     * A failure here is not "widen the grid". It is a data question: which of
     * the two fields moves, and does any other move then collide? The map's
     * comment carries the co-occurrence counts the current grouping came from.
     */
    expect(collisions).toEqual([]);
  });

  it('holds every field of every move, so the grid drops nothing', () => {
    const over: string[] = [];
    let widest = 0;
    for (const [name, facts] of factsByMove()) {
      widest = Math.max(widest, facts.length);
      if (facts.length > MOVE_FACT_COLUMNS) over.push(`${name}: ${facts.length}`);
    }
    expect(over).toEqual([]);
    /*
     * And the columns are not simply generous. A grid with room to spare on
     * every move would be four columns of mostly-empty space on the tightest
     * surface in the game, so the ceiling being *reached* is the evidence that
     * four is the right number rather than a safe one.
     */
    expect(widest, 'no move uses the full grid, so it is wider than the data needs').toBe(
      MOVE_FACT_COLUMNS,
    );
  });
});
