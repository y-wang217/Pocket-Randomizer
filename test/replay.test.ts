/**
 * The turn as steps, read off the batch. **The per-move replay patch.**
 *
 * Hand-written protocol, as `test/turn-order.test.ts` drives its reader,
 * because every case here is a claim about which line belongs to which action
 * and what the bodies looked like after it, and a captured battle would bury
 * that under a hundred lines that do not matter. The reader is pure: no DOM,
 * no sim, and the bracket lookup is a stub.
 */
import { describe, expect, it } from 'vitest';

import { readFlags, type FlagDeps } from '../src/core/battle/flags';
import { readReplay } from '../src/ui/replay';

const FLAGS: FlagDeps = { priorityOf: (move) => (move === 'Quick Attack' ? 1 : 0) };

function replayOf(lines: readonly string[]): ReturnType<typeof readReplay> {
  return readReplay(lines, readFlags(lines, FLAGS));
}

describe('one step per action, with the bodies after it', () => {
  it('reads each side\'s HP off the lines of the action that moved it', () => {
    const replay = replayOf([
      '|move|p1a: Snorlax|Body Slam|p2a: Jolteon',
      '|-damage|p2a: Jolteon|40/100',
      '|move|p2a: Jolteon|Thunderbolt|p1a: Snorlax',
      '|-damage|p1a: Snorlax|120/235 par',
      '|-status|p1a: Snorlax|par',
      '|upkeep',
      '|turn|2',
    ]);
    expect(replay.steps.map((step) => `${step.side}:${step.kind}`)).toEqual(['p1:move', 'p2:move']);
    // After the first action only the foe has moved; the player's HP is unchanged so far.
    expect(replay.steps[0]!.bodies.p2.hp).toEqual({ current: 40, max: 100, fraction: 0.4 });
    expect(replay.steps[0]!.bodies.p1.hp).toBeNull();
    // After the second, both: the player's own exact numbers, the status tag ignored.
    expect(replay.steps[1]!.bodies.p1.hp).toEqual({ current: 120, max: 235, fraction: 120 / 235 });
    expect(replay.steps[1]!.bodies.p2.hp).toEqual({ current: 40, max: 100, fraction: 0.4 });
    expect(replay.bracket).toBeNull();
  });

  it('marks the side a bracket put first, and which way, off the log\'s own reading', () => {
    const replay = replayOf([
      '|move|p1a: Snorlax|Quick Attack|p2a: Jolteon',
      '|-damage|p2a: Jolteon|80/100',
      '|move|p2a: Jolteon|Tackle|p1a: Snorlax',
      '|-damage|p1a: Snorlax|200/235',
      '|upkeep',
      '|turn|2',
    ]);
    expect(replay.bracket).toEqual({ side: 'p1', way: 'up' });
  });

  it('draws a body that arrived and fainted in one turn, then its replacement, as three steps', () => {
    const replay = replayOf([
      '|switch|p2a: Golem|Golem, L50, M|100/100',
      '|move|p1a: Snorlax|Body Slam|p2a: Golem',
      '|-damage|p2a: Golem|0 fnt',
      '|faint|p2a: Golem',
      '|upkeep',
      '|switch|p2a: Onix|Onix, L50, M|100/100',
      '|turn|2',
    ]);
    expect(replay.steps.map((step) => `${step.side}:${step.kind}`)).toEqual(['p2:switch', 'p1:move', 'p2:switch']);
    const [arrived, fell, replaced] = replay.steps;
    expect(arrived!.bodies.p2).toEqual({ switched: true, species: 'Golem', hp: { current: 100, max: 100, fraction: 1 }, fainted: false });
    expect(fell!.bodies.p2).toEqual({ switched: true, species: 'Golem', hp: { current: 0, max: 100, fraction: 0 }, fainted: true });
    // The replacement is written after `|upkeep|`, where the engine puts it, and is still a step.
    expect(replaced!.bodies.p2).toEqual({ switched: true, species: 'Onix', hp: { current: 100, max: 100, fraction: 1 }, fainted: false });
  });

  it('leaves what happened after upkeep to the view itself', () => {
    const replay = replayOf([
      '|move|p1a: Snorlax|Body Slam|p2a: Jolteon',
      '|-damage|p2a: Jolteon|60/100',
      '|upkeep',
      '|-damage|p1a: Snorlax|200/235 brn|[from] brn',
      '|turn|2',
    ]);
    expect(replay.steps).toHaveLength(1);
    // The burn's damage is residual: no step carries it, so the final draw lands it.
    expect(replay.steps[0]!.bodies.p1.hp).toBeNull();
  });

  it('reads only the last turn with actions, counting its actions from where they start in the batch', () => {
    // A batch that carries the end of one turn and the whole of the next.
    const replay = replayOf([
      '|move|p2a: Jolteon|Tackle|p1a: Snorlax',
      '|-damage|p1a: Snorlax|230/235',
      '|upkeep',
      '|turn|2',
      '|move|p1a: Snorlax|Body Slam|p2a: Jolteon',
      '|-damage|p2a: Jolteon|50/100',
      '|move|p2a: Jolteon|Tackle|p1a: Snorlax',
      '|-damage|p1a: Snorlax|225/235',
      '|upkeep',
      '|turn|3',
    ]);
    expect(replay.steps.map((step) => step.side)).toEqual(['p1', 'p2']);
    expect(replay.steps[0]!.bodies.p2.hp?.current).toBe(50);
    expect(replay.steps[1]!.bodies.p1.hp?.current).toBe(225);
  });

  it('has no steps for an opening batch, and keeps its marks', () => {
    const replay = replayOf(['|switch|p1a: Snorlax|Snorlax, L50, M|235/235', '|switch|p2a: Golem|Golem, L50, M|155/155', '|turn|1']);
    // The opening switch-ins are a null-turn group with actions, which the
    // scene is told to play no step for: `screens/battle.ts` empties them.
    expect(replay.steps.map((step) => step.kind)).toEqual(['switch', 'switch']);
    expect(replay.bracket).toBeNull();
  });

  it('gives a turn handed over with no lines one step per action, bodies unchanged', () => {
    const turns = readFlags(['|move|p1a: A|Tackle|p2a: B', '|move|p2a: B|Tackle|p1a: A', '|turn|2'], FLAGS);
    const replay = readReplay([], turns);
    expect(replay.steps.map((step) => step.side)).toEqual(['p1', 'p2']);
    for (const step of replay.steps) {
      expect(step.bodies.p1).toEqual({ switched: false, species: null, hp: null, fainted: false });
      expect(step.bodies.p2).toEqual({ switched: false, species: null, hp: null, fainted: false });
    }
  });
});
