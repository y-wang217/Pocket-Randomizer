/**
 * The card engine's reliability and speed gates, the prompt's section 6, plus
 * the battle log and replay. **Card battle engine, checkpoint 4.** These are
 * tests, not aspirations: each threshold is the prompt's.
 */
import { describe, expect, it } from 'vitest';

import { botStream, playBattle, randomBot } from '../src/core/cards/bots';
import { createBattle } from '../src/core/cards/create';
import { checkInvariants } from '../src/core/cards/invariants';
import { legalActions } from '../src/core/cards/legal';
import { CARD_ENGINE_VERSION, formatReadout, replay, summarize, type BattleLog } from '../src/core/cards/log';
import type { Action, BattleState } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';
import { allTiles } from '../src/core/cards/zones';
import { createRng } from '../src/core/rng';

const bot = (botSeed: string) => {
  const stream = botStream(botSeed);
  return (state: BattleState) => randomBot(state, stream);
};

describe('section 6 gates', () => {
  it('2,000 random-bot battles: invariants hold after every step, every bot action is accepted, every battle ends', () => {
    const violations: string[] = [];
    const refused: string[] = [];
    const unfinished: string[] = [];
    let cappedAtRoundLimit = 0;
    for (let i = 0; i < 2000; i++) {
      const seed = `FUZZ${i}`;
      const result = playBattle('test', seed, bot(`BOT${i}`), (_before, action, res) => {
        if (!res.ok) refused.push(`${seed}: ${JSON.stringify(action)} -> ${res.reason}`);
        else for (const breach of checkInvariants(res.state)) violations.push(`${seed}: ${breach}`);
      });
      if (result.state.phase === 'plan') unfinished.push(seed);
      if (result.events.some((e) => e.t === 'lost' && e.why === 'roundCap')) cappedAtRoundLimit++;
    }
    expect(violations.slice(0, 5)).toEqual([]);
    expect(refused.slice(0, 5)).toEqual([]);
    expect(unfinished, 'battles the engine never ended').toEqual([]);
    // Ending at the round cap is an ending; the count is reported, not gated.
    expect(cappedAtRoundLimit).toBeLessThan(2000);
  });

  it('accepts every action legalActions offers, and nothing it does not', () => {
    let checked = 0;
    for (let i = 0; i < 40; i++) {
      const junk = createRng(`JUNK${i}`).policy.at('cards/test-junk');
      playBattle('test', `LEGAL${i}`, bot(`LB${i}`), (before) => {
        const legal = legalActions(before);
        const keys = new Set(legal.map((a) => JSON.stringify(a)));
        for (const action of legal) {
          const result = step(before, action);
          expect(result.ok, `${JSON.stringify(action)} refused: ${(result as { reason?: string }).reason}`).toBe(true);
        }
        // Well-formed actions drawn at random: accepted exactly when legalActions offers them.
        const ids = [...Object.keys(before.cards), 'c99'];
        const targets = ['A', 'B', 'C', 'e0', 'e1', 'e2'];
        const tiles = allTiles();
        for (let n = 0; n < 12; n++) {
          const card = junk.pick(ids);
          const unit = junk.pick(['A', 'B', 'C'] as const);
          const shape = junk.nextInt(4);
          const choice: { unit?: string; tile?: { lane: 1 | 2 | 3; col: 1 | 2 | 3 | 4 | 5 | 6 } } = {};
          if (shape === 1 || shape === 3) choice.unit = junk.pick(targets);
          if (shape === 2 || shape === 3) choice.tile = junk.pick(tiles);
          const action: Action = shape === 0 ? { type: 'select', card, unit } : { type: 'select', card, unit, choice };
          const result = step(before, action);
          expect(result.ok, JSON.stringify(action)).toBe(keys.has(JSON.stringify(action)));
          if (!result.ok) expect(result.state).toBe(before);
          checked++;
        }
      });
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('rejects malformed actions with the same state reference and never throws', () => {
    const junk = createRng('MALFORMED').policy.at('cards/test-junk');
    const shapes: unknown[] = [
      undefined, null, 0, 'commit', [], {}, { type: 'select' }, { type: 'select', card: null, unit: 'A' },
      { type: 'select', card: 'c0', unit: 'Z' }, { type: 'select', card: 'c0', unit: 'A', choice: 5 },
      { type: 'select', card: 'c0', unit: 'A', choice: { tile: { lane: 0, col: 9 } } },
      { type: 'select', card: 'c0', unit: 'A', choice: { unit: 7 } }, { type: 'unselect' },
      { type: 'unselect', planIndex: -1 }, { type: 'unselect', planIndex: 99 }, { type: 'unselect', planIndex: 'x' },
      { type: 'select', card: '__proto__', unit: 'A' }, { type: 'select', card: 'constructor', unit: 'A' }, { type: 'dance' },
    ];
    for (let i = 0; i < 30; i++) {
      playBattle('test', `MAL${i}`, bot(`MB${i}`), (before) => {
        for (let n = 0; n < 4; n++) {
          const action = shapes[junk.nextInt(shapes.length)];
          let result;
          expect(() => (result = step(before, action))).not.toThrow();
          expect(result!.ok).toBe(false);
          expect(result!.state).toBe(before);
        }
      });
    }
  });

  it('plays 1,000 random-bot battles headless in under 5 seconds', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) playBattle('test', `SPEED${i}`, bot(`SB${i}`));
    expect(performance.now() - start).toBeLessThan(5000);
  });

  it('the same seed and log, run twice, give a deep-equal state and an identical event stream', () => {
    for (let i = 0; i < 20; i++) {
      const played = playBattle('test', `TWICE${i}`, bot(`TB${i}`));
      const a = replay(played.log);
      const b = replay(JSON.parse(JSON.stringify(played.log)) as BattleLog);
      expect(a).toEqual(b);
      expect(a.state).toEqual(played.state);
      expect(a.events).toEqual(played.events);
    }
  });
});

describe('log and replay', () => {
  it('stamps the engine version and records every select, not only commits', () => {
    const { log } = playBattle('test', 'STAMP', bot('STAMP'));
    expect(log.engineVersion).toBe(CARD_ENGINE_VERSION);
    expect(log.actions.some((a) => a.type === 'select')).toBe(true);
    expect(JSON.parse(JSON.stringify(log))).toEqual(log);
  });

  it('a log saved mid-plan, reloaded and continued, reaches the same final state', () => {
    const played = playBattle('test', 'MIDPLAN', bot('MIDPLAN'));
    // Cut just after a select, so the saved battle holds a plan in progress.
    const cut = played.log.actions.findIndex((a, i) => i > 5 && a.type === 'select') + 1;
    const saved: BattleLog = JSON.parse(JSON.stringify({ ...played.log, actions: played.log.actions.slice(0, cut) }));
    const resumed = replay(saved);
    expect(resumed.state.plan.length).toBeGreaterThan(0);
    let state = resumed.state;
    for (const action of played.log.actions.slice(cut)) {
      const result = step(state, action);
      if (!result.ok) throw new Error(result.reason);
      state = result.state;
    }
    expect(state).toEqual(played.state);
  });

  it('refuses a log from another engine version, naming both values', () => {
    const { log } = playBattle('test', 'VERSION', bot('VERSION'));
    expect(() => replay({ ...log, engineVersion: 'cards-0.0.9' })).toThrow(/cards-0\.0\.9.*cards-0\.2\.0/);
  });

  it('refuses a log that does not replay, saying where', () => {
    const { log } = playBattle('test', 'BROKEN', bot('BROKEN'));
    const broken = { ...log, actions: [{ type: 'unselect', planIndex: 3 } as Action, ...log.actions] };
    expect(() => replay(broken)).toThrow(/action 0/);
  });
});

describe('playtest readout', () => {
  it('counts the fun test\'s numbers from a log, and only counts', () => {
    const played = playBattle('test', 'READOUT', bot('READOUT'));
    const readout = summarize(played.log);
    expect(readout.outcome).toBe(played.state.phase);
    expect(readout.rounds).toBe(played.state.round);
    const commits = played.log.actions.filter((a) => a.type === 'commit').length;
    expect(readout.cardsPerRound).toHaveLength(commits);
    expect(readout.cardsPerRound.reduce((a, b) => a + b, 0)).toBe(played.events.filter((e) => e.t === 'played').length);
    expect(readout.telegraphs.dodged).toBe(played.events.filter((e) => e.t === 'enemyMissed').length);
    expect(JSON.parse(JSON.stringify(readout))).toEqual(readout);
    expect(formatReadout(readout)).toContain(`outcome            ${readout.outcome}`);
  });

  it('records each Moon Strike cast with its round, and Neutrals by the unit that played them', () => {
    const created = createBattle('test', 'MOON');
    if (!created.ok) throw new Error('create');
    // Search bot battles for one with a Moon Strike, so the count is checked against a real cast.
    for (let i = 0; i < 300; i++) {
      const played = playBattle('test', `MOON${i}`, bot(`MOON${i}`));
      const casts = played.events.filter((e) => e.t === 'played' && played.state.cards[e.card]!.def === 'moon-strike').length;
      if (casts === 0) continue;
      const readout = summarize(played.log);
      expect(readout.moonStrikes).toHaveLength(casts);
      const neutrals = played.events.filter((e) => e.t === 'played' && played.state.cards[e.card]!.owner === 'neutral').length;
      expect(Object.values(readout.neutralsByUnit).reduce((a, b) => a + b, 0)).toBe(neutrals);
      return;
    }
    throw new Error('no bot battle in 300 cast Moon Strike');
  });
});
