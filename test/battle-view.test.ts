/**
 * The battle screen's projection, tested without a screen.
 *
 * `BattleUiView` is a pure function of a `BattleFacts` snapshot, which is the
 * property that makes this file possible: every assertion below runs headless,
 * with no DOM, and most of them run with no sim either.
 *
 * The boost tests are the exception and they are deliberately the other way
 * round. They drive a **real battle** and assert against the **protocol log**,
 * not against a hand-built fact object. A boost display that agrees with a
 * hand-built fixture is a test of the fixture; the thing worth knowing is that
 * what the panel shows tracks what the engine announced.
 */
import { describe, expect, it } from 'vitest';

import { createBattle, typeChart, typeMultiplier } from '../src/core/battle/driver';
import {
  applyAbilityEffects,
  buildBattleUiView,
  effectivenessBand,
  fasterSide,
  formatEffectiveness,
  formatStat,
  type ActiveFacts,
  type BattleFacts,
  type MoveFacts,
  type RevealPolicy,
} from '../src/core/battle/view';
import { abilityEffects } from '../src/data/abilityEffects';
import type { TeamSpec } from '../src/core/types';

const REVEAL_ALL: RevealPolicy = { ability: true, item: true };
const REVEAL_NONE: RevealPolicy = { ability: false, item: false };

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function active(overrides: Partial<ActiveFacts> = {}): ActiveFacts {
  return {
    species: 'Ditto',
    name: 'Ditto',
    level: 50,
    types: ['Normal'],
    hp: 100,
    maxHp: 100,
    fainted: false,
    status: null,
    stats: { atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    baseStats: { atk: 48, def: 48, spa: 48, spd: 48, spe: 48 },
    boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 },
    volatiles: [],
    ability: null,
    item: null,
    speed: { engine: 100, abilityModified: false },
    ...overrides,
  };
}

function move(overrides: Partial<MoveFacts> = {}): MoveFacts {
  return {
    slot: 1,
    id: 'tackle',
    name: 'Tackle',
    type: 'Normal',
    category: 'Physical',
    basePower: 40,
    accuracy: 100,
    pp: 56,
    maxPp: 56,
    usable: true,
    flags: ['contact', 'protect'],
    typeMultiplier: 1,
    ...overrides,
  };
}

function facts(overrides: Partial<BattleFacts> = {}): BattleFacts {
  return {
    turn: 1,
    ended: false,
    player: active(),
    opponent: active(),
    moves: [],
    invertedSpeed: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Effectiveness
// ---------------------------------------------------------------------------

describe('type effectiveness', () => {
  /**
   * The table the stage asks for, including every multiplier the chart can
   * produce. Each row is a real gen 9 matchup, checked against the dex rather
   * than asserted from memory.
   */
  it('returns the right multiplier across the chart', () => {
    const cases: [string, string[], number][] = [
      // 4x — two weaknesses stacked.
      ['Rock', ['Fire', 'Flying'], 4],
      ['Ice', ['Dragon', 'Flying'], 4],
      ['Ground', ['Fire', 'Steel'], 4],
      // 2x
      ['Water', ['Fire'], 2],
      ['Fighting', ['Normal'], 2],
      // 1x
      ['Normal', ['Water'], 1],
      ['Fire', ['Electric'], 1],
      // 0.5x
      ['Fire', ['Water'], 0.5],
      ['Grass', ['Fire'], 0.5],
      // 0.25x — two resistances stacked.
      ['Grass', ['Fire', 'Flying'], 0.25],
      ['Fighting', ['Psychic', 'Flying'], 0.25],
      ['Fire', ['Fire', 'Water'], 0.25],
      // 0x — an immunity beats any number of weaknesses.
      ['Normal', ['Ghost'], 0],
      ['Ground', ['Flying'], 0],
      ['Electric', ['Ground'], 0],
      ['Poison', ['Steel'], 0],
      ['Psychic', ['Dark'], 0],
      ['Dragon', ['Fairy'], 0],
      // The immunity wins even when the other half of a dual type is weak:
      // Ground is 2x on Steel and 0x on Flying, and Skarmory takes nothing.
      ['Ground', ['Steel', 'Flying'], 0],
    ];

    for (const [type, defender, expected] of cases) {
      expect(typeMultiplier(type, defender), `${type} vs ${defender.join('/')}`).toBe(expected);
    }
  });

  it('formats only the multipliers worth reading', () => {
    expect(formatEffectiveness(4)).toBe('4x');
    expect(formatEffectiveness(2)).toBe('2x');
    expect(formatEffectiveness(0.5)).toBe('0.5x');
    expect(formatEffectiveness(0.25)).toBe('0.25x');
    expect(formatEffectiveness(0)).toBe('0x');
    // Neutral prints nothing: four badges that all say "ordinary" is four
    // badges the player stops reading, and the 0x goes with them.
    expect(formatEffectiveness(1)).toBeNull();
    expect(formatEffectiveness(null)).toBeNull();
  });

  it('bands multipliers for styling', () => {
    expect(effectivenessBand(4)).toBe('super');
    expect(effectivenessBand(0.25)).toBe('resisted');
    expect(effectivenessBand(0)).toBe('immune');
    expect(effectivenessBand(1)).toBeNull();
  });
});

describe('abilities and effectiveness', () => {
  /**
   * The rule this stage exists to enforce, stated as a test.
   *
   * Ground is 2x on a Rock/Ground Rhydon. With Levitate it is 0x, and Stage 2
   * hands out abilities off-species, so this is a routine matchup rather than a
   * corner case. A UI that shows 2x here is a UI the player stops believing.
   */
  it('never shows 2x where a visible Levitate makes it 0x', () => {
    const rhydon = active({
      species: 'Rhydon',
      types: ['Ground', 'Rock'],
      ability: { id: 'levitate', name: 'Levitate' },
    });
    const earthquake = move({ id: 'earthquake', name: 'Earthquake', type: 'Ground', typeMultiplier: 2 });

    const view = buildBattleUiView(
      facts({ opponent: rhydon, moves: [earthquake] }),
      REVEAL_ALL,
      abilityEffects,
    );

    expect(view.moves[0]?.effectiveness).toBe(0);
    expect(view.moves[0]?.abilityAffected).toBe(true);
  });

  /**
   * And the other half of the rule: when the ability is hidden, the naive chart
   * result is shown. That is not a lie — it is exactly what a player reasoning
   * from types alone would conclude, which is all they have been given.
   */
  it('falls back to the naive chart when the ability is hidden', () => {
    const rhydon = active({
      species: 'Rhydon',
      types: ['Ground', 'Rock'],
      ability: { id: 'levitate', name: 'Levitate' },
    });
    const earthquake = move({ type: 'Ground', typeMultiplier: 2 });

    const view = buildBattleUiView(
      facts({ opponent: rhydon, moves: [earthquake] }),
      REVEAL_NONE,
      abilityEffects,
    );

    expect(view.moves[0]?.effectiveness).toBe(2);
    expect(view.moves[0]?.abilityAffected).toBe(false);
  });

  it('absorbs by move flag, not only by type', () => {
    // Shadow Ball is a `bullet` move, which is invisible from its type.
    const bulletproof = active({ ability: { id: 'bulletproof', name: 'Bulletproof' } });
    const shadowBall = move({
      id: 'shadowball',
      type: 'Ghost',
      flags: ['bullet', 'protect'],
      typeMultiplier: 2,
    });

    const view = buildBattleUiView(
      facts({ opponent: bulletproof, moves: [shadowBall] }),
      REVEAL_ALL,
      abilityEffects,
    );
    expect(view.moves[0]?.effectiveness).toBe(0);
  });

  it('applies Dry Skin in both directions at once', () => {
    // Immune to Water, and takes 1.25x from Fire. One ability, two effects.
    expect(applyAbilityEffects(1, 'Water', [], abilityEffects('dryskin'))).toBe(0);
    expect(applyAbilityEffects(1, 'Fire', [], abilityEffects('dryskin'))).toBe(1.25);
    expect(applyAbilityEffects(2, 'Grass', [], abilityEffects('dryskin'))).toBe(2);
  });

  it('applies Wonder Guard to everything that is not super effective', () => {
    const wg = abilityEffects('wonderguard');
    expect(applyAbilityEffects(2, 'Fire', [], wg)).toBe(2);
    expect(applyAbilityEffects(4, 'Fire', [], wg)).toBe(4);
    expect(applyAbilityEffects(1, 'Fire', [], wg)).toBe(0);
    expect(applyAbilityEffects(0.5, 'Fire', [], wg)).toBe(0);
    expect(applyAbilityEffects(0, 'Fire', [], wg)).toBe(0);
  });

  it('halves Fire and Ice through Thick Fat', () => {
    expect(applyAbilityEffects(2, 'Fire', [], abilityEffects('thickfat'))).toBe(1);
    expect(applyAbilityEffects(2, 'Ice', [], abilityEffects('thickfat'))).toBe(1);
    expect(applyAbilityEffects(2, 'Water', [], abilityEffects('thickfat'))).toBe(2);
  });

  /**
   * A status move has no multiplier at all.
   *
   * Showing `0x` on a Thunder Wave aimed at a Ground type would be adjacent to
   * true and completely misleading: what stops it is the paralysis immunity,
   * not the type chart, and the badge claims to be about the type chart.
   */
  it('shows no effectiveness for status moves', () => {
    const view = buildBattleUiView(
      facts({ moves: [move({ category: 'Status', typeMultiplier: 0 })] }),
      REVEAL_ALL,
      abilityEffects,
    );
    expect(view.moves[0]?.effectiveness).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Speed
// ---------------------------------------------------------------------------

describe('the speed readout', () => {
  it('names the faster side', () => {
    const fast = active({ speed: { engine: 200, abilityModified: false } });
    const slow = active({ speed: { engine: 100, abilityModified: false } });

    expect(fasterSide(facts({ player: fast, opponent: slow }), REVEAL_ALL)).toBe('player');
    expect(fasterSide(facts({ player: slow, opponent: fast }), REVEAL_ALL)).toBe('opponent');
    expect(fasterSide(facts({ player: slow, opponent: slow }), REVEAL_ALL)).toBe('tie');
  });

  /** A tie is a tie. No percentage, no probability — the sim rolls it. */
  it('reports a tie rather than modelling one', () => {
    const even = active({ speed: { engine: 150, abilityModified: false } });
    expect(fasterSide(facts({ player: even, opponent: even }), REVEAL_ALL)).toBe('tie');
  });

  it('inverts under Trick Room', () => {
    const fast = active({ speed: { engine: 200, abilityModified: false } });
    const slow = active({ speed: { engine: 100, abilityModified: false } });
    const inverted = facts({ player: fast, opponent: slow, invertedSpeed: true });
    expect(fasterSide(inverted, REVEAL_ALL)).toBe('opponent');
  });

  /**
   * The visibility branch, which is unreachable at the default tuning.
   *
   * When the opponent's ability is hidden *and* contributing to its speed, the
   * engine's number would leak the ability through the arrow. So the visible
   * layers are recomputed: base stat at level, stage, paralysis, revealed item.
   *
   * Ninjask base 160 Speed at level 50 is 165; the engine reports 330 because
   * Speed Boost has already fired. With the ability hidden, the readout uses
   * 165 and the player is slower — which is what they would conclude from what
   * they have been shown.
   */
  it('drops hidden ability modifiers from the comparison', () => {
    const player = active({ speed: { engine: 200, abilityModified: false } });
    const boosted = active({
      species: 'Ninjask',
      baseStats: { atk: 90, def: 45, spa: 50, spd: 50, spe: 160 },
      speed: { engine: 330, abilityModified: true },
      ability: { id: 'speedboost', name: 'Speed Boost' },
    });

    const state = facts({ player, opponent: boosted });
    expect(fasterSide(state, REVEAL_ALL)).toBe('opponent'); // 330 > 200
    expect(fasterSide(state, REVEAL_NONE)).toBe('player'); // 165 < 200
  });

  it('folds paralysis into the hidden-ability fallback', () => {
    const player = active({ speed: { engine: 100, abilityModified: false } });
    const paralysed = active({
      baseStats: { atk: 90, def: 45, spa: 50, spd: 50, spe: 160 },
      status: 'par',
      speed: { engine: 400, abilityModified: true },
      ability: { id: 'quickfeet', name: 'Quick Feet' },
    });

    // 165 halved by paralysis is 82, which is slower than 100.
    expect(fasterSide(facts({ player, opponent: paralysed }), REVEAL_NONE)).toBe('player');
  });
});

// ---------------------------------------------------------------------------
// Display format
// ---------------------------------------------------------------------------

describe('the stat panel format', () => {
  /**
   * Neutral stages show the number alone, so the panel is quiet until something
   * changes. Six rows of `152 +0 152` is six rows nobody reads.
   */
  it('is quiet at stage zero', () => {
    expect(formatStat('Atk', { base: 152, stage: 0, effective: 152 })).toBe('Atk 152');
  });

  it('shows base, stage and effective once something moves', () => {
    expect(formatStat('Atk', { base: 152, stage: 1, effective: 228 })).toBe('Atk 152 +1 228');
    expect(formatStat('Spe', { base: 110, stage: -2, effective: 55 })).toBe('Spe 110 -2 55');
  });
});

// ---------------------------------------------------------------------------
// Boosts, driven from a real battle
// ---------------------------------------------------------------------------

/**
 * The Pokemon below never faint each other, so the battle runs long enough to
 * stack boosts. Blissey has the bulk; Seismic Toss does fixed damage that no
 * stat change can alter, which keeps the fight from ending early on a crit.
 */
const BOOSTER: TeamSpec = [
  { species: 'Scizor', ability: 'Technician', moves: ['Swords Dance', 'Bullet Punch'], level: 50 },
];
const GROWLER: TeamSpec = [
  { species: 'Blissey', ability: 'Natural Cure', moves: ['Growl', 'Soft-Boiled'], level: 50 },
];

describe('boost display, driven from the protocol', () => {
  /**
   * The panel's stages are checked against `|-boost|` and `|-unboost|` lines
   * from the sim, not against a fixture.
   *
   * A test that built the facts by hand and then asserted the view rendered
   * them would prove the projection agrees with itself. The claim worth making
   * is that it agrees with what the engine announced, which is the same failure
   * mode Stage 4's `readSwitches` bug came from: our model of the battle and
   * the engine's disagreed, and only the engine was consulted at run time.
   */
  it('tracks what the engine announced', () => {
    const session = createBattle({ teams: { p1: BOOSTER, p2: GROWLER }, seed: 'boost-protocol' });

    for (let turn = 0; turn < 3; turn++) {
      session.submit('p1', { kind: 'move', slot: 1 }); // Swords Dance
      session.submit('p2', { kind: 'move', slot: 1 }); // Growl
    }

    const protocol = session.protocolFor('p1');
    const boosts = protocol.filter((line) => line.startsWith('|-boost|'));
    const unboosts = protocol.filter((line) => line.startsWith('|-unboost|'));

    // The engine announced the changes; that is what the panel has to match.
    expect(boosts.length).toBeGreaterThan(0);
    expect(unboosts.length).toBeGreaterThan(0);

    const announcedAtk = sumStages(boosts, 'p1a', 'atk') - sumStages(unboosts, 'p1a', 'atk');

    const view = buildBattleUiView(session.factsFor('p1'), REVEAL_ALL, abilityEffects);
    expect(view.player.stats.atk.stage).toBe(announcedAtk);
    expect(view.player.stats.atk.stage).toBeGreaterThan(0);
  });

  /** The effective number is the base with that announced stage applied. */
  it('renders the effective value from the announced stage', () => {
    const session = createBattle({ teams: { p1: BOOSTER, p2: GROWLER }, seed: 'boost-effective' });
    session.submit('p1', { kind: 'move', slot: 1 });
    session.submit('p2', { kind: 'move', slot: 2 }); // Soft-Boiled, no stat change

    const view = buildBattleUiView(session.factsFor('p1'), REVEAL_ALL, abilityEffects);
    const atk = view.player.stats.atk;

    expect(atk.stage).toBe(2);
    expect(atk.effective).toBe(atk.base * 2);
    expect(formatStat('Atk', atk)).toBe(`Atk ${atk.base} +2 ${atk.effective}`);
  });
});

/** Sum the stage deltas the protocol announced for one Pokemon and one stat. */
function sumStages(lines: readonly string[], ident: string, stat: string): number {
  let total = 0;
  for (const line of lines) {
    const parts = line.split('|');
    if (!parts[2]?.startsWith(ident) || parts[3] !== stat) continue;
    total += Number(parts[4] ?? 0);
  }
  return total;
}

// ---------------------------------------------------------------------------
// The reveal policy, carried through
// ---------------------------------------------------------------------------

describe('the reveal policy', () => {
  it('carries the flag through rather than dropping the value', () => {
    const foe = active({
      ability: { id: 'levitate', name: 'Levitate' },
      item: { id: 'leftovers', name: 'Leftovers' },
    });

    const shown = buildBattleUiView(facts({ opponent: foe }), REVEAL_ALL, abilityEffects);
    expect(shown.opponent.ability).toEqual({ id: 'levitate', name: 'Levitate', revealed: true });
    expect(shown.opponent.item).toEqual({ id: 'leftovers', name: 'Leftovers', revealed: true });

    const hidden = buildBattleUiView(facts({ opponent: foe }), REVEAL_NONE, abilityEffects);
    expect(hidden.opponent.ability?.revealed).toBe(false);
    expect(hidden.opponent.item?.revealed).toBe(false);
  });

  /** Your own side is never hidden from you, whatever the flags say. */
  it('never hides your own ability', () => {
    const me = active({ ability: { id: 'technician', name: 'Technician' } });
    const view = buildBattleUiView(facts({ player: me }), REVEAL_NONE, abilityEffects);
    expect(view.player.ability?.revealed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The type chart
// ---------------------------------------------------------------------------

describe('the generated type chart', () => {
  it('covers every type in both directions', () => {
    const chart = typeChart();
    expect(chart.length).toBe(18);
    // Stellar is a Terastal mechanic, neutral both ways, and GYMRUN never
    // terastallizes — a row for it would be eighteen blanks.
    expect(chart.some((entry) => entry.type === 'Stellar')).toBe(false);
  });

  it('agrees with the multiplier function it is generated from', () => {
    for (const entry of typeChart()) {
      for (const other of entry.strongAgainst) expect(typeMultiplier(entry.type, [other])).toBe(2);
      for (const other of entry.weakAgainst) expect(typeMultiplier(entry.type, [other])).toBe(0.5);
      for (const other of entry.noEffectAgainst) expect(typeMultiplier(entry.type, [other])).toBe(0);
      for (const other of entry.weakTo) expect(typeMultiplier(other, [entry.type])).toBe(2);
      for (const other of entry.resists) expect(typeMultiplier(other, [entry.type])).toBe(0.5);
      for (const other of entry.immuneTo) expect(typeMultiplier(other, [entry.type])).toBe(0);
    }
  });

  /** A spot check, so a chart that generated itself into nonsense is caught. */
  it('knows the matchups a player would check first', () => {
    const chart = typeChart();
    const ghost = chart.find((entry) => entry.type === 'Ghost');
    expect(ghost?.immuneTo).toContain('Normal');
    expect(ghost?.immuneTo).toContain('Fighting');

    const ground = chart.find((entry) => entry.type === 'Ground');
    expect(ground?.immuneTo).toContain('Electric');
    expect(ground?.strongAgainst).toContain('Electric');
    expect(ground?.noEffectAgainst).toContain('Flying');
  });
});
