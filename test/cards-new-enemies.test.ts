/**
 * The five enemies of `docs/spec/gymrun-patch-card-battle-grace-friendly-fire.md`
 * A3, built from the existing vocabulary: their table, and the steps that
 * need the interpreter to read them right.
 */
import { describe, expect, it } from 'vitest';

import { ENEMIES } from '../src/cardData/enemies';
import type { EnemyDefId } from '../src/core/cards/defs';
import { enemyMovesAndTelegraph } from '../src/core/cards/enemies';
import type { BattleEvent } from '../src/core/cards/events';
import { step } from '../src/core/cards/step';
import type { Action, BattleState, Pos } from '../src/core/cards/state';
import { at, board, type BoardSpec } from './fixtures/card-battle';

function ok(state: BattleState, action: Action): { state: BattleState; events: BattleEvent[] } {
  const result = step(state, action);
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result;
}
const commit = (state: BattleState) => ok(state, { type: 'commit' }).state;

/** One enemy of `def` at `pos` on `stepIndex`, deep-HP units, telegraphed as battle start would. */
function lone(def: EnemyDefId, pos: Pos, stepIndex: number, spec: BoardSpec = {}): BattleState {
  const s = board({ ...spec, enemies: [pos, null, null] });
  for (const u of s.units) u.hp = u.maxHp = 99;
  const e = s.enemies[0]!;
  Object.assign(e, { def, hp: ENEMIES[def].hp, baseShield: ENEMIES[def].baseShield, step: stepIndex });
  enemyMovesAndTelegraph({ s, events: [] }, false);
  return s;
}
const where = (s: BattleState) => `${s.enemies[0]!.pos!.lane},${s.enemies[0]!.pos!.col}`;
const intent = (s: BattleState) => `${s.enemies[0]!.intent!.act}${s.enemies[0]!.intent!.n}`;

describe('the A3 enemies', () => {
  it('match the table: HP, base shield, Fast, grade and cycle length', () => {
    const table: [EnemyDefId, number, number, boolean, number, number][] = [
      ['drone', 3, 1, false, 2, 6],
      ['lancer', 2, 0, false, 1, 3],
      ['hound', 2, 0, true, 1, 2],
      ['turret', 4, 1, false, 2, 3],
      ['bulwark', 4, 2, false, 2, 3],
      ['sniper', 2, 0, false, 3, 3],
      ['pikeman', 3, 1, false, 3, 4],
    ];
    // The Colossus is Part D's (test/cards-boss.test.ts).
    expect(Object.keys(ENEMIES).filter((id) => id !== 'colossus' && id !== 'dummy').sort()).toEqual(table.map(([id]) => id).sort());
    for (const [id, hp, base, fast, grade, steps] of table) {
      const def = ENEMIES[id];
      expect([def.hp, def.baseShield, def.fast === true, def.grade, def.script.steps.length], id).toEqual([hp, base, fast, grade, steps]);
    }
  });

  it('Turret never moves: Shield 1, Strike 2 down its lane, then nothing', () => {
    let s = lone('turret', at(1, 7), 0);
    const seen = [[where(s), intent(s)]];
    for (let round = 0; round < 3; round++) {
      s = commit(s);
      seen.push([where(s), intent(s)]);
    }
    expect(seen).toEqual([
      ['1,7', 'shield1'],
      ['1,7', 'strike2'],
      ['1,7', 'none0'],
      ['1,7', 'shield1'],
    ]);
  });

  it('Bulwark advances behind Shield 2, then Slashes a unit in range or hunts behind Shield 1', () => {
    const open = lone('bulwark', at(1, 6), 0);
    expect([where(open), intent(open)]).toEqual(['1,5', 'shield2']);
    // From L1C5 with nobody on column 4: it hunts (A in its own lane, it stays) and shields.
    const hunts = commit(open);
    expect([where(hunts), intent(hunts)]).toEqual(['1,5', 'shield1']);
    // With B on column 4 beside it: it stays and Slashes.
    const slashes = commit(lone('bulwark', at(1, 6), 0, { units: { B: at(2, 4) } }));
    expect([where(slashes), intent(slashes)]).toEqual(['1,5', 'slash1']);
  });

  it('Hound is Fast: it opens on Hunt, Strike 1, then advances', () => {
    let s = lone('hound', at(2, 6), 0, { units: { B: null } });
    expect(intent(s)).toBe('strike1');
    expect(where(s)).toBe('1,6');
    s = commit(s);
    expect([where(s), intent(s)]).toEqual(['1,5', 'none0']);
  });

  it('Sniper hunts, waits, then Strikes 3; Pikeman shields, hunts, waits, then Pierces 2', () => {
    let sniper = lone('sniper', at(2, 7), 0, { units: { B: null } });
    const shots = [intent(sniper)];
    for (let round = 0; round < 2; round++) shots.push(intent((sniper = commit(sniper))));
    expect(shots).toEqual(['none0', 'none0', 'strike3']);
    expect(where(sniper)).toBe('1,7');
    let pike = lone('pikeman', at(2, 7), 0);
    const acts = [intent(pike)];
    for (let round = 0; round < 3; round++) acts.push(intent((pike = commit(pike))));
    expect(acts).toEqual(['shield1', 'none0', 'none0', 'pierce2']);
  });
});
