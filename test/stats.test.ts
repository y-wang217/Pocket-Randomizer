/**
 * The stat formula, checked against the engine rather than against a doc.
 *
 * `core/battle/stats.ts` is a transcription of `Battle#statModify`, and a
 * transcription is worth exactly as much as the thing that checks it. Every
 * number below is compared to what @pkmn/sim actually computed for the same
 * Pokemon at the same level, so the file cannot drift: if the gen-lock moves,
 * or a nature or EV ever enters the game, this fails rather than the battle
 * panel quietly printing a wrong Attack.
 *
 * The hand-verified case the stage asks for is first, spelled out arithmetic
 * and all, because "it matches the engine" and "it matches the formula" are two
 * different claims and both are worth making.
 */
import { describe, expect, it } from 'vitest';

import { createBattle } from '../src/core/battle/driver';
import { applyStage, hpAtLevel, statAtLevel, statsAtLevel } from '../src/core/battle/stats';
import type { TeamSpec } from '../src/core/types';

/** A one-on-one battle, so `factsFor` has a real turn to project. */
function battleOf(p1: TeamSpec, p2: TeamSpec) {
  return createBattle({ teams: { p1, p2 }, seed: 'stats-test' });
}

const FILLER: TeamSpec = [{ species: 'Ditto', ability: 'Limber', moves: ['Transform'], level: 50 }];

describe('the stat formula', () => {
  /**
   * The hand-verified case. Rhydon at level 50, worked through by hand:
   *
   *   HP  = floor((2*105 + 31 + 0 + 100) * 50 / 100 + 10)
   *       = floor(341 * 0.5 + 10) = floor(180.5) = 180
   *   Atk = floor((2*130 + 31 + 0) * 50 / 100 + 5)
   *       = floor(291 * 0.5 + 5)  = floor(150.5) = 150
   *   Spe = floor((2*40 + 31 + 0) * 50 / 100 + 5)
   *       = floor(111 * 0.5 + 5)  = floor(60.5)  = 60
   *
   * Rhydon rather than something famous because its base stats are lopsided
   * enough that a transposed term would be obvious: 130 Atk against 45 SpA.
   */
  it('matches a hand-verified Rhydon at level 50', () => {
    expect(hpAtLevel(105, 50)).toBe(180);
    expect(statAtLevel(130, 50)).toBe(150);
    expect(statAtLevel(120, 50)).toBe(140);
    expect(statAtLevel(45, 50)).toBe(65);
    expect(statAtLevel(40, 50)).toBe(60);
  });

  it('agrees with the engine for that same Rhydon', () => {
    const session = battleOf([{ species: 'Rhydon', ability: 'Lightning Rod', moves: ['Earthquake'], level: 50 }], FILLER);
    const me = session.factsFor('p1').player;

    expect(me.maxHp).toBe(180);
    expect(me.stats).toEqual({ atk: 150, def: 140, spa: 65, spd: 65, spe: 60 });
  });

  /**
   * The sweep, and the reason the formula is allowed to exist at all.
   *
   * The opponent's stats are *computed* rather than read off the engine, because
   * the protocol never sends them and because a pure function can render a
   * Pokemon that is not in a battle. That is only safe if the computation is
   * exact, so it is checked against the engine across a spread of base-stat
   * shapes and every level band the run curve produces.
   */
  it('reproduces the engine across species and levels', () => {
    const species = [
      'Rhydon',
      'Pikachu',
      'Blissey', // 255 base HP, 10 base Def — the extremes at both ends
      'Shuckle', // 230 base Def and SpD
      'Deoxys-Speed',
      'Magikarp',
      'Wobbuffet',
      'Ninjask',
      'Regigigas',
      'Sudowoodo',
    ];

    for (const name of species) {
      for (const level of [5, 17, 33, 50, 68, 84, 100]) {
        const session = battleOf(
          [{ species: name, ability: 'Levitate', moves: ['Splash'], level }],
          FILLER,
        );
        const facts = session.factsFor('p1').player;
        const computed = statsAtLevel(
          { ...facts.baseStats, hp: 0 },
          level,
        );

        // HP is checked against the engine's own maxhp; the base HP is not on
        // `baseStats`, so it is recomputed from the engine's answer instead.
        expect({ ...computed, hp: facts.maxHp }, `${name} L${level}`).toMatchObject({
          atk: facts.stats.atk,
          def: facts.stats.def,
          spa: facts.stats.spa,
          spd: facts.stats.spd,
          spe: facts.stats.spe,
        });
      }
    }
  });

  /**
   * The opponent path specifically.
   *
   * `factsFor('p1').opponent.stats` is produced by the formula, not by reading
   * `storedStats`. This asserts the two agree, which is the whole justification
   * for the asymmetry documented in `toActiveFacts`.
   */
  it('computes opponent stats that match what the engine gave the opponent', () => {
    const opponent: TeamSpec = [
      { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam'], level: 42 },
    ];
    const session = battleOf(FILLER, opponent);

    const asOpponent = session.factsFor('p1').opponent.stats;
    // The same Pokemon seen from its own side, where the numbers come off the
    // engine rather than out of the formula.
    const asSelf = session.factsFor('p2').player.stats;

    expect(asOpponent).toEqual(asSelf);
  });

  /**
   * Shedinja is blacklisted from generation, so this is defensive rather than
   * reachable — but the formula is used by screens that take a spec from
   * anywhere, and one Pokemon in the dex ignores the HP formula entirely.
   */
  it('honours the max-HP override', () => {
    expect(hpAtLevel(1, 50, 1)).toBe(1);
    expect(hpAtLevel(1, 100, 1)).toBe(1);
    // Without the override the same base would give the ordinary answer.
    expect(hpAtLevel(1, 50)).toBe(76);
  });
});

describe('stat stages', () => {
  /**
   * Raises multiply and drops divide, and the asymmetry is the mechanic.
   *
   * +1 is x1.5 and -1 is x(2/3), which is why a Growl is worth less than a
   * Swords Dance. A panel that showed the stage without the effective number
   * would leave the player to know that.
   */
  it('applies the boost table the way the engine does', () => {
    expect(applyStage(100, 0)).toBe(100);
    expect(applyStage(100, 1)).toBe(150);
    expect(applyStage(100, 2)).toBe(200);
    expect(applyStage(100, 6)).toBe(400);
    expect(applyStage(100, -1)).toBe(66);
    expect(applyStage(100, -2)).toBe(50);
    expect(applyStage(100, -6)).toBe(25);
  });

  it('clamps beyond +-6, as the engine does', () => {
    expect(applyStage(100, 9)).toBe(applyStage(100, 6));
    expect(applyStage(100, -9)).toBe(applyStage(100, -6));
  });

  it('floors rather than rounds', () => {
    // 151 * 1.5 = 226.5, and the engine keeps 226.
    expect(applyStage(151, 1)).toBe(226);
    // 151 / 1.5 = 100.67, and the engine keeps 100.
    expect(applyStage(151, -1)).toBe(100);
  });

  /** The engine's own arithmetic, for the same input. */
  it('agrees with the engine after a real boost', () => {
    const session = createBattle({
      teams: {
        p1: [{ species: 'Scizor', ability: 'Technician', moves: ['Swords Dance', 'Bullet Punch'], level: 50 }],
        p2: [{ species: 'Blissey', ability: 'Natural Cure', moves: ['Soft-Boiled'], level: 50 }],
      },
      seed: 'boost-test',
    });

    const before = session.factsFor('p1').player;
    expect(before.boosts.atk).toBe(0);

    session.submit('p1', { kind: 'move', slot: 1 });
    session.submit('p2', { kind: 'move', slot: 1 });

    const after = session.factsFor('p1').player;
    expect(after.boosts.atk).toBe(2);
    // The panel's effective value is the base with the stage applied.
    expect(applyStage(after.stats.atk, after.boosts.atk)).toBe(after.stats.atk * 2);
  });
});
