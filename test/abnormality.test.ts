/**
 * The abnormality reducer. **Branch 3B.**
 *
 * @vitest-environment node
 *
 * `ui/abnormality.ts` is a pure function over a turn's flags, and it exists
 * because of a boundary: `test/boundaries.test.ts` forbids `ui/scene.ts` from
 * reading `.flags` at all, on the rule that "a beat that read `flags` would be
 * one step from a recoil that grew with the multiplier, which is a verdict
 * drawn on the board". The scene is handed a class and a slot; it cannot weight
 * a beat by severity because it never sees severity.
 *
 * Being pure, it is tested without a DOM. `test/battle-outro.test.ts` asserts
 * the attributes the scene then writes, so the two halves of the seam are
 * covered from both sides.
 */
import { describe, expect, it } from 'vitest';

import { readFlags, type FlagDeps } from '../src/core/battle/flags';
import { abnormalityMarks, firedTraits } from '../src/ui/abnormality';

const STUB: FlagDeps = { priorityOf: () => 0 };

const OPEN = ['|switch|p1a: Snorlax|Snorlax, L50, M|235/235', '|switch|p2a: Golem|Golem, L50, M|155/155', '|turn|1'];

const marksFor = (lines: readonly string[]): ReturnType<typeof abnormalityMarks> =>
  abnormalityMarks(readFlags([...lines], STUB));

describe('which class a turn earns', () => {
  it('maps each kind to its class', () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['|cant|p1a: Snorlax|flinch', 'prevented'],
      ['|-fail|p1a: Snorlax', 'prevented'],
      ['|-boost|p1a: Snorlax|atk|1', 'stage'],
      ['|-unboost|p1a: Snorlax|atk|1', 'stage'],
      ['|-ability|p1a: Snorlax|Intimidate|boost', 'trait'],
      ['|-start|p1a: Snorlax|confusion', 'volatile'],
      ['|-weather|RainDance|[from] ability: Drizzle|[of] p1a: Snorlax', 'field'],
    ];
    for (const [line, klass] of cases) {
      const marks = marksFor([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', line]);
      expect(marks.find((mark) => mark.side === 'p1')?.klass, line).toBe(klass);
    }
  });

  /*
   * A boost and a drop share a class. Which way a stat went is a word on the
   * strip and a chip on the panel; a beat that rose for one and fell for the
   * other would be the board taking a view on which is better — the same
   * mistake `--hit-recoil`'s comment refuses for the multiplier.
   */
  it('gives a rise and a fall the same class, so the beat takes no view', () => {
    const rose = marksFor([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-boost|p1a: Snorlax|atk|1']);
    const fell = marksFor([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-unboost|p1a: Snorlax|atk|1']);
    expect(rose[0]?.klass).toBe(fell[0]?.klass);
  });

  it('earns nothing from a turn that was only damage', () => {
    expect(marksFor([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-damage|p2a: Golem|100/155'])).toEqual([]);
  });

  /*
   * The kinds that already have a beat of their own, or that describe a move
   * rather than an event. A crit marking the body would be a second beat for
   * something the chunk and the strip both already carry.
   */
  it('earns nothing from a crit, a miss or STAB', () => {
    const marks = marksFor([
      ...OPEN,
      '|move|p1a: Snorlax|Tackle|p2a: Golem',
      '|-crit|p2a: Golem',
      '|-supereffective|p2a: Golem',
      '|-damage|p2a: Golem|10/155',
    ]);
    expect(marks).toEqual([]);
  });
});

describe('which turn, and which slot', () => {
  /*
   * **The case the whole `prevented` class exists for, and the one the first
   * build got wrong.** `|cant|` replaces the `|move|` line rather than
   * accompanying it, so a prevented turn has no action at all — picking the
   * last group *with actions* finds nothing and marks nothing, on exactly the
   * turn that already leaves no other trace.
   */
  it('finds a turn that carried no action at all', () => {
    const marks = marksFor([...OPEN, '|cant|p1a: Snorlax|flinch']);
    expect(marks).toHaveLength(1);
    expect(marks[0]?.klass).toBe('prevented');
    expect(marks[0]?.side).toBe('p1');
  });

  it('rides the slot of the action that caused it', () => {
    // p1 acted first, so anything hanging off its move sits in slot 1.
    const marks = marksFor([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-unboost|p2a: Golem|spe|1']);
    expect(marks[0]?.slot).toBe(1);
  });

  it('takes one mark per side, first in protocol order', () => {
    const marks = marksFor([
      ...OPEN,
      '|move|p1a: Snorlax|Tackle|p2a: Golem',
      '|-unboost|p2a: Golem|spe|1',
      '|-start|p2a: Golem|confusion',
    ]);
    expect(marks.filter((mark) => mark.side === 'p2')).toHaveLength(1);
    // The order the engine produced them in, which `flags.ts` calls "the one
    // ordering that is a fact rather than an opinion" — so this is not a rank.
    expect(marks.find((mark) => mark.side === 'p2')?.klass).toBe('stage');
  });

  it('marks both sides when both carry something', () => {
    const marks = marksFor([
      ...OPEN,
      '|move|p1a: Snorlax|Tackle|p2a: Golem',
      '|-unboost|p2a: Golem|spe|1',
      '|-boost|p1a: Snorlax|atk|1',
    ]);
    expect(new Set(marks.map((mark) => mark.side))).toEqual(new Set(['p1', 'p2']));
  });

  it('is empty on no turns at all, which is the opening draw', () => {
    expect(abnormalityMarks(undefined)).toEqual([]);
    expect(abnormalityMarks([])).toEqual([]);
  });
});

/**
 * The panels' own list, beside the marks. **Stage 4.11 Tier 4, D48.**
 */
describe('which panels fired a trait', () => {
  const firesFor = (lines: readonly string[]): ReturnType<typeof firedTraits> => firedTraits(readFlags([...lines], STUB));

  it('lists an ability firing with the slot of the action it rode', () => {
    const fires = firesFor([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-ability|p2a: Golem|Sturdy']);
    expect(fires).toEqual([{ side: 'p2', what: 'ability', slot: 1 }]);
  });

  it('lists a berry as an item fire, on the last slot when it fired at end of turn', () => {
    const fires = firesFor([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|move|p2a: Golem|Tackle|p1a: Snorlax', '|upkeep', '|-enditem|p1a: Snorlax|Sitrus Berry|[eat]']);
    expect(fires).toEqual([{ side: 'p1', what: 'item', slot: 2 }]);
  });

  it('gives a weather-setting ability both the field mark and the panel fire', () => {
    const lines = [...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-weather|RainDance|[from] ability: Drizzle|[of] p1a: Snorlax'];
    expect(marksFor(lines).find((mark) => mark.side === 'p1')?.klass).toBe('field');
    expect(firesFor(lines)).toEqual([{ side: 'p1', what: 'ability', slot: 1 }]);
  });

  it('reads the opening batch, where most fires land', () => {
    const fires = firesFor(['|switch|p1a: Snorlax|Snorlax, L50, M|235/235', '|switch|p2a: Golem|Golem, L50, M|155/155', '|-ability|p2a: Golem|Intimidate|boost', '|turn|1']);
    expect(fires).toEqual([{ side: 'p2', what: 'ability', slot: 2 }]);
  });

  it('lists at most one of each kind per side, first in protocol order', () => {
    const fires = firesFor([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-ability|p2a: Golem|Sturdy', '|-activate|p2a: Golem|ability: Emergency Exit']);
    expect(fires).toHaveLength(1);
  });

  it('carries nothing that ranks: no ability name, no weight', () => {
    const fires = firesFor([...OPEN, '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-ability|p2a: Golem|Intimidate|boost']);
    expect(Object.keys(fires[0] ?? {}).sort()).toEqual(['side', 'slot', 'what']);
  });
});

