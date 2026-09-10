/**
 * Archetype labels: the function, its purity, and the pool it has to cover.
 *
 * Stage 4.7, Part 7. Six labels off a base stat spread, so a player can tell a
 * physical attacker from a special one at a glance on either side of the field.
 *
 * The property test over the whole species pool is the one that matters. An
 * unlabelled opponent is a hole in the feature — the label appears next to a
 * level on both battle panels, and a blank there on the one Pokemon whose
 * spread the classifier could not place would be worse than not shipping it.
 */
import { describe, expect, it } from 'vitest';

import { archetypeOf } from '../src/core/archetype';
import { describeSpecCard } from '../src/core/battle/driver';
import {
  ARCHETYPES,
  ARCHETYPE_CAVEAT,
  ARCHETYPE_DISPLAY,
  ARCHETYPE_TUNING,
  type Archetype,
} from '../src/data/archetypes';
import { SPECIES_POOL } from '../src/data/speciesPools';
import { getStarterPool } from '../src/data/starters';
import type { StatsTable } from '../src/core/types';

const stats = (hp: number, atk: number, def: number, spa: number, spd: number, spe = 60): StatsTable => ({
  hp,
  atk,
  def,
  spa,
  spd,
  spe,
});

describe('archetypeOf', () => {
  it('reads a lopsided physical attacker as one', () => {
    // Rampardos: 97/165/60/65/50. Attack is nearly triple the mean bulk.
    expect(archetypeOf(stats(97, 165, 60, 65, 50))).toBe('pAttacker');
  });

  it('reads a lopsided special attacker as one', () => {
    // Alakazam: 55/50/45/135/95.
    expect(archetypeOf(stats(55, 50, 45, 135, 95))).toBe('sAttacker');
  });

  it('reads close offences as mixed', () => {
    // Attack and Sp. Attack within the mixed ratio, both clear of the bulk.
    expect(archetypeOf(stats(60, 120, 50, 115, 50))).toBe('mixAttacker');
  });

  it('reads a physical wall as a physical tank', () => {
    // Shuckle: 20/10/230/10/230 is the pathological case — both defences are
    // identical, so it is mixed, and it is unambiguously not an attacker.
    expect(archetypeOf(stats(20, 10, 230, 10, 230))).toBe('mixTank');
    // Skarmory: 65/80/140/40/70. Defence well clear of Sp. Defence.
    expect(archetypeOf(stats(65, 80, 140, 40, 70))).toBe('pTank');
  });

  it('reads a special wall as a special tank', () => {
    // Blissey: 255/10/10/75/135.
    expect(archetypeOf(stats(255, 10, 10, 75, 135))).toBe('sTank');
  });

  it('returns one of exactly six labels, and never a seventh', () => {
    for (const spread of [
      stats(1, 90, 45, 30, 30), // Shedinja: 1 HP, the extreme low-bulk case
      stats(255, 10, 10, 75, 135),
      stats(100, 100, 100, 100, 100),
      stats(0, 0, 0, 0, 0),
    ]) {
      expect(ARCHETYPES).toContain(archetypeOf(spread));
    }
  });

  it('is pure: identical input, identical output', () => {
    const spread = stats(80, 105, 65, 60, 75);
    const first = archetypeOf(spread);
    for (let i = 0; i < 50; i++) expect(archetypeOf(spread)).toBe(first);
    // And it does not mutate what it is handed.
    expect(spread).toEqual(stats(80, 105, 65, 60, 75));
  });

  it('does not read Speed', () => {
    /*
     * The seventh label that is deliberately not being added. If Speed ever
     * enters the classification, this fails — which is the point: adding a
     * `speedster` is a decision about the vocabulary, not a tweak to a
     * threshold.
     */
    const slow = stats(80, 120, 60, 50, 60, 5);
    const fast = stats(80, 120, 60, 50, 60, 200);
    expect(archetypeOf(slow)).toBe(archetypeOf(fast));
  });

  it('takes its thresholds from the table, so a retune is a table edit', () => {
    // A block that is an attacker at the shipped ratio and a tank above it.
    const spread = stats(80, 90, 75, 60, 75);
    expect(archetypeOf(spread, { ...ARCHETYPE_TUNING, attackerRatio: 0.5 })).toMatch(/Attacker$/);
    expect(archetypeOf(spread, { ...ARCHETYPE_TUNING, attackerRatio: 3 })).toMatch(/Tank$/);
  });

  it('honours the tie rules rather than leaving them to an operator', () => {
    // Offence exactly equal to bulk: `offenceTie` decides.
    const even = stats(90, 90, 90, 90, 90);
    expect(archetypeOf(even, { ...ARCHETYPE_TUNING, offenceTie: 'attacker' })).toMatch(/Attacker$/);
    expect(archetypeOf(even, { ...ARCHETYPE_TUNING, offenceTie: 'tank' })).toMatch(/Tank$/);
  });
});

describe('the species pools', () => {
  it('labels every species the randomizer can draw', () => {
    /*
     * The property test the brief asks for, over the full pool rather than a
     * sample. `archetypeOf` cannot throw and cannot return anything outside the
     * vocabulary for any spread that can appear in a run — on either side of
     * the field, since opponents come from the same pool.
     */
    expect(SPECIES_POOL.length).toBeGreaterThan(500);

    for (const entry of SPECIES_POOL) {
      const card = describeSpecCard({
        species: entry.species,
        ability: 'Levitate',
        moves: ['Tackle'],
        level: 50,
      });
      const label = archetypeOf(card.baseStats);
      expect(ARCHETYPES, `${entry.species} produced ${label}`).toContain(label);
    }
  }, 300_000);

  it('labels every starter', () => {
    for (const entry of getStarterPool()) {
      const card = describeSpecCard({
        species: entry.species,
        ability: 'Levitate',
        moves: ['Tackle'],
        level: 5,
      });
      expect(ARCHETYPES).toContain(archetypeOf(card.baseStats));
    }
  }, 60_000);

  it('spreads across the vocabulary rather than collapsing onto one label', () => {
    /*
     * Not a balance assertion — a classifier that returned `pAttacker` for
     * every species in the dex would pass every test above and be useless. This
     * is the floor: every label is reachable from the real pool, and no single
     * label holds most of it.
     */
    const counts = new Map<Archetype, number>();
    for (const entry of SPECIES_POOL.slice(0, 300)) {
      const card = describeSpecCard({
        species: entry.species,
        ability: 'Levitate',
        moves: ['Tackle'],
        level: 50,
      });
      const label = archetypeOf(card.baseStats);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    for (const label of ARCHETYPES) {
      expect(counts.get(label) ?? 0, `no species in the sample is a ${label}`).toBeGreaterThan(0);
    }
    const top = Math.max(...counts.values());
    expect(top / 300).toBeLessThan(0.6);
  }, 300_000);
});

describe('the display table', () => {
  it('has a form for every label', () => {
    for (const label of ARCHETYPES) {
      expect(ARCHETYPE_DISPLAY[label].short.length).toBeGreaterThan(0);
      expect(ARCHETYPE_DISPLAY[label].long.length).toBeGreaterThan(0);
      expect(ARCHETYPE_DISPLAY[label].blurb.length).toBeGreaterThan(0);
    }
  });

  it('keeps the short forms short enough for a chip next to a level', () => {
    for (const label of ARCHETYPES) {
      expect(ARCHETYPE_DISPLAY[label].short.length).toBeLessThanOrEqual(14);
    }
  });

  it('states the moveset caveat, because the player meets it in the first hour', () => {
    /*
     * Under full move randomization a `pAttacker` can roll four special moves.
     * The label describes the stat block, never the moveset, and naming it
     * something that implies moveset knowledge would be worse than not shipping
     * it. The caveat has to exist and has to say `moveset`.
     */
    expect(ARCHETYPE_CAVEAT).toMatch(/moveset/i);
    expect(ARCHETYPE_CAVEAT).toMatch(/base stats/i);
  });

  it('carries no verdicts', () => {
    /*
     * Part 4. A label is a classification of public data. None of the copy may
     * say a label is good, that it counters anything, or what to do about it.
     */
    const forbidden = /\b(best|better|worse|strong(est)?|weak(est)?|should|counters?|recommend|ideal|prefer)\b/i;
    for (const label of ARCHETYPES) {
      const display = ARCHETYPE_DISPLAY[label];
      expect(display.blurb, `${label} blurb`).not.toMatch(forbidden);
      expect(display.long, `${label} long`).not.toMatch(forbidden);
    }
    expect(ARCHETYPE_CAVEAT).not.toMatch(forbidden);
  });
});
