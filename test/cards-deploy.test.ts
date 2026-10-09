/**
 * Deployment: the player places its units on the home rows before round 1,
 * then starts (`docs/spec/gymrun-patch-card-battle-scenarios-and-bot.md`).
 */
import { describe, expect, it } from 'vitest';

import { createBattle } from '../src/core/cards/create';
import { legalActions } from '../src/core/cards/legal';
import { newLog, replay } from '../src/core/cards/log';
import type { Action, BattleState } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { at, begun } from './fixtures/card-battle';

function created(encounter = 'test', seed = 'DEPLOY'): BattleState {
  const result = createBattle(encounter, seed);
  if (!result.ok) throw new Error('create');
  return result.state;
}

function ok(state: BattleState, action: Action): BattleState {
  const result = step(state, action);
  if (!result.ok) throw new Error(`refused ${JSON.stringify(action)}: ${result.reason}`);
  return result.state;
}

const posOf = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!.pos;

describe('deployment', () => {
  it('places a unit on any other home tile, and a unit already there takes its old tile', () => {
    let s = created();
    s = ok(s, { type: 'place', unit: 'A', tile: at(3, 1) });
    expect(posOf(s, 'A')).toEqual(at(3, 1));
    s = ok(s, { type: 'place', unit: 'A', tile: at(2, 2) });
    expect([posOf(s, 'A'), posOf(s, 'B')]).toEqual([at(2, 2), at(3, 1)]);
  });

  it('refuses a tile off the home rows, the tile it stands on, and a malformed placement, handing back the same state', () => {
    const s = created();
    for (const [action, reason] of [
      [{ type: 'place', unit: 'A', tile: at(1, 3) }, 'badChoice'],
      [{ type: 'place', unit: 'A', tile: at(1, 2) }, 'badChoice'],
      [{ type: 'place', unit: 'Z', tile: at(1, 1) }, 'malformed'],
      [{ type: 'place', unit: 'A', tile: { lane: 4, col: 1 } }, 'malformed'],
      [{ type: 'place', unit: 'A' }, 'malformed'],
    ] as const) {
      const result = step(s, action);
      expect(result, JSON.stringify(action)).toMatchObject({ ok: false, reason });
      expect(result.state).toBe(s);
    }
  });

  it('accepts no card action before the start, and no placement after it', () => {
    const s = created();
    expect(step(s, { type: 'commit' })).toMatchObject({ ok: false, reason: 'deploying' });
    expect(step(s, { type: 'select', card: s.piles.hand[0]!, unit: 'A' })).toMatchObject({ ok: false, reason: 'deploying' });
    const started = ok(s, { type: 'start' });
    expect(started.phase).toBe('plan');
    expect(step(started, { type: 'place', unit: 'A', tile: at(1, 1) })).toMatchObject({ ok: false, reason: 'notDeploying' });
    expect(step(started, { type: 'start' })).toMatchObject({ ok: false, reason: 'notDeploying' });
  });

  it('offers every placement and the start, and nothing else', () => {
    const s = created();
    const legal = legalActions(s);
    expect(legal.filter((a) => a.type === 'place')).toHaveLength(3 * 5);
    expect(legal.at(-1)).toEqual({ type: 'start' });
    expect(legal.every((a) => a.type === 'place' || a.type === 'start')).toBe(true);
  });

  it('draws nothing: the hand, the draw pile and the draw count are the same however the units are placed', () => {
    const s = created('skirmish', 'NODRAW');
    const moved = ok(ok(s, { type: 'place', unit: 'C', tile: at(1, 1) }), { type: 'place', unit: 'B', tile: at(3, 1) });
    const a = ok(s, { type: 'start' });
    const b = ok(moved, { type: 'start' });
    expect(b.rngDraws).toBe(a.rngDraws);
    expect(b.piles).toEqual(a.piles);
    expect(b.enemies.map((e) => e.step)).toEqual(a.enemies.map((e) => e.step));
  });

  it('the enemies open on the placement: a Drone on its Hunt step goes to the lane the player chose', () => {
    // Steps chosen so e0 opens on step 1 (Hunt, Strike) and only A remains in reach of its column.
    const base = created('test', 'HUNT');
    const s: BattleState = { ...base, enemies: base.enemies.map((e, i) => ({ ...e, step: 0, pos: i === 0 ? at(2, 6) : null, hp: i === 0 ? 3 : 0 })) };
    const alone = { ...s, units: s.units.map((u) => (u.id === 'A' ? u : { ...u, pos: null, fainted: true, hp: 0 })) };
    const toLane1 = ok(alone, { type: 'start' });
    expect(toLane1.enemies[0]!.pos).toEqual(at(1, 6));
    const moved = ok(alone, { type: 'place', unit: 'A', tile: at(3, 1) });
    expect(ok(moved, { type: 'start' }).enemies[0]!.pos).toEqual(at(3, 6));
  });

  it('a log that places and starts replays to the same state', () => {
    const log = newLog('REPLAYDEPLOY', 'skirmish', 'puppeteer');
    let s = created('skirmish', 'REPLAYDEPLOY');
    for (const action of [
      { type: 'place', unit: 'C', tile: at(1, 1) },
      { type: 'start' },
      { type: 'commit' },
    ] as Action[]) {
      s = ok(s, action);
      log.actions.push(action);
    }
    expect(replay(JSON.parse(JSON.stringify(log))).state).toEqual(s);
  });

  it('begun() is a start on the default placement', () => {
    const { state } = begun('test', 'DEPLOY');
    expect(state).toEqual(ok(created(), { type: 'start' }));
  });
});
