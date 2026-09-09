/**
 * The HP wording. Item G.
 *
 * The playtest said *"You are 11% down" is not clear after you heal* — the
 * phrasing describes a delta but reads as a state, and after a heal it
 * contradicts what the player just watched happen. That sentence is not in the
 * codebase; what the player was reading is @pkmn/view's
 * `(Pikachu lost 11% of its health!)`, which this repo opted into by supplying
 * a tracker that returns a percentage.
 *
 * So the rule, and what this file holds it to: **state wherever a state
 * exists, and healing always names the amount restored.**
 *
 * The last describe is the one that matters most. It plays a real battle, takes
 * every HP line the log would render, and checks each against the protocol that
 * produced it — so "no HP message contradicts what just happened on screen" is
 * asserted against the engine rather than against our idea of it.
 */
import { describe, expect, it } from 'vitest';

import { createBattle } from '../src/core/battle/driver';
import {
  FAINTED,
  FAINTED_REVIVES,
  hpAfterDamage,
  hpAfterHeal,
  hpEventDelta,
  hpState,
  hpStateBare,
  ppState,
} from '../src/core/hpCopy';
import { moveChoice, type TeamSpec } from '../src/core/types';

describe('the wording', () => {
  it('states what is left, not what was taken', () => {
    expect(hpState(24, 48)).toBe('24 / 48 HP (50%)');
    expect(hpAfterDamage('Pikachu', 24, 48)).toBe('Pikachu: 24 / 48 HP (50%)');
    // The number the player just lost is deliberately absent. It is derivable,
    // it is one line above in the log, and printing both trains them to read
    // the smaller number as the important one.
    expect(hpAfterDamage('Pikachu', 24, 48)).not.toMatch(/lost|down|-/);
  });

  it('names the amount a heal restored, which is the line that was missing', () => {
    expect(hpAfterHeal('Pikachu', 12, 36, 48)).toBe('Pikachu restored 12 HP — now 36 / 48 HP (75%)');
    // And it never reads as a loss, which is the exact contradiction reported.
    expect(hpAfterHeal('Pikachu', 12, 36, 48)).not.toMatch(/lost|down/);
  });

  it('never contradicts itself on a heal to full', () => {
    const line = hpAfterHeal('Blissey', 40, 100, 100);
    expect(line).toContain('restored 40 HP');
    expect(line).toContain('100 / 100 HP (100%)');
  });

  it('clamps rather than printing an impossible share', () => {
    expect(hpState(0, 48)).toBe('0 / 48 HP (0%)');
    // A max of zero is not reachable in a real battle, and a NaN on screen
    // would be. Zero is the answer that cannot be wrong.
    expect(hpState(0, 0)).toBe('0 / 0 HP (0%)');
    expect(hpStateBare(24, 48)).toBe('24 / 48 · 50%');
  });

  it('keeps a delta only where no state exists yet', () => {
    // An event label describes an effect drawn at map generation; there is no
    // "after" to state at the moment it is written.
    expect(hpEventDelta(-0.15)).toBe('-15% HP');
    expect(hpEventDelta(0.15)).toBe('+15% HP');
  });

  it('says fainted without a percentage, because zero is not a share', () => {
    expect(FAINTED).toBe('Fainted');
    expect(FAINTED_REVIVES).toContain('revives at the next node');
    expect(FAINTED).not.toMatch(/%/);
    expect(ppState(87, 88)).toBe('PP 87/88');
  });
});

describe('against a real battle', () => {
  const ATTACKER: TeamSpec = [
    { species: 'Snorlax', ability: 'Immunity', moves: ['Body Slam', 'Rest'], level: 50 },
  ];
  const TARGET: TeamSpec = [
    { species: 'Blissey', ability: 'Natural Cure', moves: ['Seismic Toss', 'Soft-Boiled'], level: 50 },
  ];

  /**
   * The same reader `ui/battle-log.ts` uses, reimplemented in eight lines so
   * this stays a core test with no DOM.
   *
   * Kept in step with it by construction rather than by discipline: both read
   * the `|-damage|`/`|-heal|` payload and both call `core/hpCopy.ts`, so a
   * wording change moves them together and a *parsing* change would fail here.
   */
  function hpLines(protocol: readonly string[]): { line: string; current: number; max: number }[] {
    const seen = new Map<string, number>();
    const out: { line: string; current: number; max: number }[] = [];

    for (const raw of protocol) {
      const parts = raw.split('|');
      const kind = parts[1];
      const ident = parts[2];
      const health = parts[3];
      if (!ident || !health) continue;

      if (kind === 'switch' || kind === 'drag') {
        const start = /^(\d+)\//.exec(parts[4] ?? '');
        if (start?.[1]) seen.set(ident, Number(start[1]));
        continue;
      }
      if (kind !== '-damage' && kind !== '-heal') continue;

      const match = /^(\d+)\/(\d+)/.exec(health);
      if (!match?.[1] || !match[2]) continue;
      const current = Number(match[1]);
      const max = Number(match[2]);
      const name = ident.replace(/^p[12][a-c]: /, '');
      const before = seen.get(ident);
      const restored = kind === '-heal' && before !== undefined ? Math.max(0, current - before) : 0;

      out.push({
        line:
          kind === '-heal' && restored > 0
            ? hpAfterHeal(name, restored, current, max)
            : hpAfterDamage(name, current, max),
        current,
        max,
      });
      seen.set(ident, current);
    }
    return out;
  }

  /**
   * **The property the playtest asked for, stated against the engine.**
   *
   * Every HP line the log would print must name the HP the protocol says the
   * Pokemon actually has at that moment. A line that disagreed is precisely
   * "an HP message that contradicts what just happened on screen".
   */
  it('every HP line names the HP the protocol reported', () => {
    const session = createBattle({ teams: { p1: ATTACKER, p2: TARGET }, seed: 'HPCOPY' });
    for (let turn = 0; turn < 8 && !session.ended; turn++) {
      session.submit('p1', moveChoice(1));
      session.submit('p2', moveChoice(1));
    }

    const protocol = session.protocolFor('p1').filter((line) => !line.startsWith('|t:|'));
    const lines = hpLines(protocol);
    expect(lines.length, 'no HP changed in eight turns — the fixture is stale').toBeGreaterThan(0);

    for (const entry of lines) {
      expect(entry.line).toContain(`${entry.current} / ${entry.max} HP`);
      // Never a delta, and never the word the feedback objected to.
      expect(entry.line).not.toMatch(/\bdown\b/);
      expect(entry.line).not.toMatch(/lost \d/);
    }
  });

  /**
   * The heal case, end to end: Soft-Boiled after taking damage must produce a
   * line that says restored, and a total larger than the one before it.
   */
  it('reports a heal as a gain, never as a loss', () => {
    const session = createBattle({ teams: { p1: ATTACKER, p2: TARGET }, seed: 'HPHEAL' });

    // Damage first, so there is something to heal back.
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(1));
    // Then Blissey uses Soft-Boiled.
    session.submit('p1', moveChoice(1));
    session.submit('p2', moveChoice(2));

    const protocol = session.protocolFor('p1').filter((line) => !line.startsWith('|t:|'));
    const heals = hpLines(protocol).filter((entry) => entry.line.includes('restored'));

    expect(heals.length, 'Soft-Boiled did not heal — the fixture is stale').toBeGreaterThan(0);
    for (const heal of heals) {
      expect(heal.line).toMatch(/restored \d+ HP — now/);
      expect(heal.line).not.toMatch(/lost|down/);
    }
  });
});
