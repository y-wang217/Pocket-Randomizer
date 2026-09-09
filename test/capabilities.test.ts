/**
 * The capability tables, held to the three things they claim.
 *
 * A capability is a gate an event puts in front of the party, and every one of
 * these tests exists because a table that fails it produces a gate nobody can
 * open — which is not a hard event, it is a dead one.
 *
 * 1. **The move resolves.** A capability naming a move no pool contains is a
 *    requirement the player can never satisfy.
 * 2. **The types are non-empty and reachable.** A capability no locale can
 *    supply resolves `none` for every party that did not buy the move, which
 *    makes `latent` decoration.
 * 3. **The hand-written rows match the dex.** `data/capabilityMoves.ts` carries
 *    two entries that `scripts/gen-pools.ts` did not generate, so nothing
 *    checks them against @pkmn/sim unless this file does.
 */
import { Dex } from '@pkmn/sim';
import { describe, expect, it } from 'vitest';

import { describeMove } from '../src/core/battle/driver';
import { GYMRUN_GEN } from '../src/core/battle/format';
import {
  CAPABILITY_MOVE,
  CAPABILITY_ONLY_MOVES,
  capabilityMoveEntry,
  capabilityOfMove,
} from '../src/data/capabilityMoves';
import {
  CAPABILITIES,
  CAPABILITY_TYPES,
  capabilityById,
  typesSatisfy,
  type CapabilityId,
} from '../src/data/capabilityTypes';
import { LOCALES } from '../src/data/locales';
import { bandOf, bandOfMove, danglingOverrides } from '../src/data/moveOverrides';
import { DAMAGING_MOVES, STATUS_MOVES } from '../src/data/movePools';

/** The band the decisions table fixes for each capability. Null means status. */
const EXPECTED_BAND: Readonly<Record<CapabilityId, number | null>> = {
  cut: 1,
  flash: null,
  rockSmash: 1,
  strength: 3,
  surf: 3,
};

describe('the capability move binding', () => {
  it('resolves every capability to a move entry', () => {
    for (const capability of CAPABILITIES) {
      const entry = capabilityMoveEntry(capability);
      expect(entry.id, capability).toBe(CAPABILITY_MOVE[capability]);
    }
  });

  it('bands every capability move through bandOfMove, by name and by id', () => {
    for (const capability of CAPABILITIES) {
      const entry = capabilityMoveEntry(capability);
      const expected = EXPECTED_BAND[capability];

      // The band a reward card would print, looked up the way a screen does it.
      expect(bandOfMove(entry.id), `${capability} by id`).toBe(expected);
      expect(bandOfMove(entry.name), `${capability} by name`).toBe(expected);
      // And the same answer through the entry-keyed function core uses.
      expect(bandOf(entry), `${capability} by entry`).toBe(expected);
    }
  });

  it('gives the status capability an impact instead of a band', () => {
    // Flash has no base power, so banding it would be meaningless — offering it
    // as a "band 1" card would read as the weakest move in the game.
    const flash = capabilityMoveEntry('flash');
    expect(flash.category).toBe('Status');
    expect(flash.band).toBeNull();
    expect(flash.impact).toBe('pressure');
  });

  it('maps a move id back to its capability, however it is spelled', () => {
    for (const capability of CAPABILITIES) {
      const entry = capabilityMoveEntry(capability);
      expect(capabilityOfMove(entry.id)).toBe(capability);
      expect(capabilityOfMove(entry.name)).toBe(capability);
    }
    expect(capabilityOfMove('flamethrower')).toBeNull();
  });

  it('describes every capability move, so the reward flow can offer one', () => {
    // `askMoveQuestions` throws on a move `describeMove` cannot resolve, so a
    // capability move that failed here would crash the run at the reward screen
    // rather than at build time.
    for (const capability of CAPABILITIES) {
      const entry = capabilityMoveEntry(capability);
      const spec = describeMove(entry.name);
      expect(spec, capability).not.toBeNull();
      expect(spec?.id).toBe(entry.id);
      expect(spec?.maxPp).toBeGreaterThan(0);
    }
  });
});

describe('the overlay', () => {
  it('carries only what the generated pools lack', () => {
    // The overlay is a delta, not a second copy. Rock Smash, Strength and Surf
    // are in DAMAGING_MOVES already; duplicating them here would be two rows
    // that could disagree.
    const pooled = new Set([...DAMAGING_MOVES, ...STATUS_MOVES].map((move) => move.id));
    for (const move of CAPABILITY_ONLY_MOVES) {
      expect(pooled.has(move.id), `${move.id} is already generated`).toBe(false);
    }
    expect(CAPABILITY_ONLY_MOVES.map((move) => move.id)).toEqual(['cut', 'flash']);
  });

  it('never reaches an opponent, because the generated pools do not carry it', () => {
    // The whole reason this is an overlay rather than a regeneration. A trainer
    // rolling Flash would be an encounter made easier for a reason the player
    // cannot see and the report cannot attribute.
    const rollable = new Set([...DAMAGING_MOVES, ...STATUS_MOVES].map((move) => move.id));
    expect(rollable.has('cut')).toBe(false);
    expect(rollable.has('flash')).toBe(false);
  });

  it('matches the dex on name, type, category, power and accuracy', () => {
    const dex = Dex.forGen(GYMRUN_GEN);
    for (const move of CAPABILITY_ONLY_MOVES) {
      const data = dex.moves.get(move.id);
      expect(data.exists, move.id).toBe(true);
      expect(move.name).toBe(data.name);
      expect(move.type).toBe(data.type);
      expect(move.category).toBe(data.category);
      expect(move.basePower).toBe(data.basePower);
      expect(move.accuracy).toBe(data.accuracy === true ? 101 : data.accuracy);
    }
  });

  it('leaves the override table dangling check passing', () => {
    expect(danglingOverrides()).toEqual([]);
  });
});

describe('the capability type sets', () => {
  it('gives every capability a non-empty set', () => {
    for (const capability of CAPABILITIES) {
      expect(CAPABILITY_TYPES[capability].types.length, capability).toBeGreaterThan(0);
    }
  });

  it('is reachable: some locale offers a satisfying type for every capability', () => {
    // The floor under the whole mechanic. A capability no locale can supply is
    // one that resolves `none` for every party that did not buy the move.
    for (const capability of CAPABILITIES) {
      const locales = LOCALES.filter((locale) => typesSatisfy(capability, locale.types));
      expect(locales.length, `${capability} is offered by no locale`).toBeGreaterThan(0);
    }
  });

  it('is reachable from more than one locale, so a locale pick cannot lock it out', () => {
    // A segment offers two or three locales and the player commits to one. A
    // capability supplied by exactly one locale would be a gate whose answer
    // was fixed by a decision made several steps earlier for other reasons.
    for (const capability of CAPABILITIES) {
      const locales = LOCALES.filter((locale) => typesSatisfy(capability, locale.types));
      expect(locales.length, `${capability} is offered by only ${locales.length} locale`)
        .toBeGreaterThanOrEqual(2);
    }
  });

  it('answers typesSatisfy on either of a member type', () => {
    // Same rule as `localeAdmits`: one matching type is enough, and a party
    // member is not required to match on its primary.
    expect(typesSatisfy('cut', ['Water', 'Grass'])).toBe(true);
    expect(typesSatisfy('cut', ['Grass'])).toBe(true);
    expect(typesSatisfy('cut', ['Water', 'Flying'])).toBe(false);
    expect(typesSatisfy('surf', ['Water'])).toBe(true);
    expect(typesSatisfy('surf', ['Ice'])).toBe(false);
  });

  it('names and labels every capability exactly once', () => {
    expect(new Set(CAPABILITIES).size).toBe(CAPABILITIES.length);
    for (const capability of CAPABILITIES) {
      const definition = capabilityById(capability);
      expect(definition, capability).not.toBeNull();
      expect(definition?.id).toBe(capability);
      expect(definition?.label.length).toBeGreaterThan(0);
    }
    expect(capabilityById('fly')).toBeNull();
  });
});
