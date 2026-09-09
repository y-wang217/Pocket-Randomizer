/**
 * The per-move effectiveness helper, asserted against the dex chart.
 *
 * **Item B of the Stage 4.5.2 playtest round, and it was a diagnosis before it
 * was a change.** The feedback said the effectiveness hint "should reflect the
 * moveset, not the Pokemon's typing", on the hypothesis that the hint was
 * computed from the attacker's species types. It was not — `view.ts` has taken
 * each move's own type against the defender since Stage 4.5. What was actually
 * missing is what this file tests: the answer existed only as a bare
 * multiplier, produced inside a projection that needed a whole `BattleFacts`
 * snapshot, so nothing could ask "what does Earthquake do to a Flying type?"
 * without building a battle first.
 *
 * Two properties carry the file:
 *
 *   1. **Status moves never have an effectiveness.** Not `1`, not `0`, not
 *      "the type chart says". A Thunder Wave aimed at a Ground type is stopped
 *      by the paralysis immunity, and a `0x` badge on that button would be a
 *      true-sounding number attached to the wrong reason. Asserted as a sweep
 *      over every type against every defender rather than on one example.
 *   2. **The chart is the dex's, in both files.** Every expectation here is
 *      checked against `driver.typeMultiplier`, which is `Dex.getEffectiveness`,
 *      so a hand-rolled chart cannot pass by agreeing with itself.
 */
import { describe, expect, it } from 'vitest';

import { typeMultiplier, WHEEL_TYPES } from '../src/core/battle/driver';
import {
  bandOf,
  EFFECTIVENESS_LABELS,
  moveEffectiveness,
  type Effectiveness,
  type EffectivenessDefender,
  type EffectivenessMove,
} from '../src/core/battle/effectiveness';
import { abilityEffects } from '../src/data/abilityEffects';

const REVEALED = { ability: true, item: true };
const HIDDEN = { ability: false, item: true };

function move(overrides: Partial<EffectivenessMove> = {}): EffectivenessMove {
  return { type: 'Normal', category: 'Physical', flags: ['contact', 'protect'], ...overrides };
}

function defender(overrides: Partial<EffectivenessDefender> = {}): EffectivenessDefender {
  return { types: ['Normal'], ability: null, ...overrides };
}

/** The one real chart, so nothing here can agree with a second implementation. */
function against(m: EffectivenessMove, d: EffectivenessDefender, reveal = REVEALED) {
  return moveEffectiveness(m, d, typeMultiplier, abilityEffects, reveal);
}

describe('a move against a defender', () => {
  it('names the four bands over known matchups', () => {
    const cases: [string, string[], Effectiveness, number][] = [
      // The zero-effect case the spec asks for by name.
      ['Ground', ['Flying'], 'none', 0],
      ['Normal', ['Ghost'], 'none', 0],
      ['Electric', ['Ground'], 'none', 0],
      // Super, including the doubled-up case.
      ['Water', ['Fire'], 'super', 2],
      ['Ice', ['Dragon', 'Flying'], 'super', 4],
      // Resisted, including the quartered case.
      ['Fire', ['Water'], 'resisted', 0.5],
      ['Grass', ['Fire', 'Flying'], 'resisted', 0.25],
      // Neutral is an answer, not an absence.
      ['Normal', ['Water'], 'neutral', 1],
      ['Dragon', ['Water'], 'neutral', 1],
      // An immunity on one half of a dual type beats a weakness on the other:
      // Ground is 2x into Steel and 0x into Flying, and Skarmory takes nothing.
      ['Ground', ['Steel', 'Flying'], 'none', 0],
    ];

    for (const [type, types, band, multiplier] of cases) {
      const result = against(move({ type }), defender({ types }));
      expect(result.band, `${type} vs ${types.join('/')}`).toBe(band);
      expect(result.multiplier, `${type} vs ${types.join('/')}`).toBe(multiplier);
      expect(result.abilityAffected).toBe(false);
    }
  });

  /**
   * **The property, over the whole chart rather than over an example.**
   *
   * Every type against every single- and dual-type defender in the game, as a
   * status move: 18 types x 18 defenders plus a sample of dual types, and not
   * one of them may come back with a number. This is the assertion the old
   * shape could not make, because `null` also meant "neutral" and a sweep over
   * both would have passed while conflating them.
   */
  it('never gives a status move an effectiveness, for any matchup', () => {
    const offenders: string[] = [];

    for (const type of WHEEL_TYPES) {
      for (const first of WHEEL_TYPES) {
        for (const types of [[first], [first, 'Flying'], [first, 'Steel']]) {
          const result = against(move({ type, category: 'Status', flags: [] }), defender({ types }));
          if (result.multiplier !== null || result.band !== null || result.abilityAffected) {
            offenders.push(`${type} vs ${types.join('/')}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('gives a status move no effectiveness even where an ability would absorb it', () => {
    // Levitate answers Ground, and a Ground *status* move still has no badge:
    // the ability would stop the damage there is none of.
    const result = against(
      move({ type: 'Ground', category: 'Status', flags: [] }),
      defender({ types: ['Rock'], ability: { id: 'levitate', name: 'Levitate' } }),
    );
    expect(result).toEqual({ multiplier: null, band: null, abilityAffected: false });
  });

  it('every damaging move gets a band, and every band has a label', () => {
    const missing: string[] = [];
    for (const type of WHEEL_TYPES) {
      for (const first of WHEEL_TYPES) {
        const result = against(move({ type }), defender({ types: [first] }));
        if (result.band === null || !EFFECTIVENESS_LABELS[result.band]) {
          missing.push(`${type} vs ${first}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('abilities, and the rule about never lying', () => {
  /**
   * The Levitate-on-a-Rhydon case, which is routine here rather than a
   * curiosity: abilities are drawn off the full pool, not off a species' legal
   * set. A `2x` badge over a visible Levitate would train the player to
   * distrust every number the UI prints.
   */
  it('folds a visible immunity in, and says it was the ability', () => {
    const result = against(
      move({ type: 'Ground' }),
      defender({ types: ['Rock'], ability: { id: 'levitate', name: 'Levitate' } }),
    );
    expect(result.multiplier).toBe(0);
    expect(result.band).toBe('none');
    expect(result.abilityAffected).toBe(true);
  });

  it('shows the naive chart result when the ability is hidden', () => {
    const hidden = against(
      move({ type: 'Ground' }),
      defender({ types: ['Rock'], ability: { id: 'levitate', name: 'Levitate' } }),
      HIDDEN,
    );
    // Not a lie: it is exactly what a player reasoning from types alone would
    // conclude, and `abilityAffected` stays false because nothing visible moved it.
    expect(hidden.multiplier).toBe(2);
    expect(hidden.band).toBe('super');
    expect(hidden.abilityAffected).toBe(false);
  });

  it('absorbs by move flag as well as by type', () => {
    // Shadow Ball is a `bullet` move whose type says nothing about Bulletproof.
    const result = against(
      move({ type: 'Ghost', category: 'Special', flags: ['bullet', 'protect'] }),
      defender({ types: ['Ghost'], ability: { id: 'bulletproof', name: 'Bulletproof' } }),
    );
    expect(result.band).toBe('none');
    expect(result.abilityAffected).toBe(true);
  });

  it('bands a partial ability reduction as resisted', () => {
    // Thick Fat halves Fire into a neutral defender: 0.5 is resisted, and the
    // band is a comparison rather than a lookup of the six chart values.
    const result = against(
      move({ type: 'Fire', category: 'Special', flags: [] }),
      defender({ types: ['Normal'], ability: { id: 'thickfat', name: 'Thick Fat' } }),
    );
    expect(result.multiplier).toBeLessThan(1);
    expect(result.band).toBe('resisted');
    expect(result.abilityAffected).toBe(true);
  });

  it('leaves an ability with nothing to say alone', () => {
    const result = against(
      move({ type: 'Water', category: 'Special', flags: [] }),
      defender({ types: ['Fire'], ability: { id: 'levitate', name: 'Levitate' } }),
    );
    expect(result.multiplier).toBe(2);
    expect(result.abilityAffected).toBe(false);
  });
});

describe('bandOf', () => {
  it('splits on 1 rather than on the chart values', () => {
    expect(bandOf(0)).toBe('none');
    expect(bandOf(0.25)).toBe('resisted');
    expect(bandOf(0.5)).toBe('resisted');
    // Between the chart values: an ability that shaves a neutral hit has
    // genuinely resisted it, and a lookup table of chart values would miss this.
    expect(bandOf(0.75)).toBe('resisted');
    expect(bandOf(1)).toBe('neutral');
    expect(bandOf(1.25)).toBe('super');
    expect(bandOf(2)).toBe('super');
    expect(bandOf(4)).toBe('super');
  });
});
