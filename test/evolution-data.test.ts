/**
 * The evolution graph in `data/speciesPools.ts`, held against the dex and
 * against `data/evolutionThresholds.ts`.
 *
 * The generator bakes two fields per species — `prevo` and `evoLevel` — from
 * the dex plus the synthetic table. This file recomputes both from the same
 * pure function and fails on the first entry that drifted, so a dependency
 * bump or a threshold edit without a regeneration cannot quietly move a
 * species between stages. Then it holds the three rules the threshold file's
 * header states.
 */
import { Dex } from '@pkmn/sim';
import { Generations, Pokemon } from '@smogon/calc';
import { describe, expect, it } from 'vitest';

import { BLACKLISTED_SPECIES } from '../src/data/blacklists';
import { entryOfId, hasEvolution, isBaseForm, stageAllowedAt, targetsOf } from '../src/data/evolution';
import {
  SYNTHETIC_BY_METHOD,
  SYNTHETIC_FLOOR_BY_BAND,
  SYNTHETIC_OVERRIDES,
  syntheticThreshold,
  type EvoMethod,
} from '../src/data/evolutionThresholds';
import { playerLevel, SEGMENT_COUNT } from '../src/data/scaling';
import { SPECIES_POOL } from '../src/data/speciesPools';

const dex = Dex.forGen(9);
const ids = new Set(SPECIES_POOL.map((entry) => entry.id));
const FINAL_LEVEL = playerLevel(SEGMENT_COUNT - 1);

describe('the generated evolution graph', () => {
  it('matches the dex plus the synthetic table, entry by entry', () => {
    for (const entry of SPECIES_POOL) {
      const species = dex.species.get(entry.id);
      if (!species.prevo) {
        expect(entry.prevo, `${entry.species} prevo`).toBeNull();
        expect(entry.evoLevel, `${entry.species} evoLevel`).toBeNull();
        continue;
      }
      const parent = dex.species.get(species.prevo);
      expect(entry.prevo, `${entry.species} prevo`).toBe(ids.has(parent.id) ? parent.id : null);
      // The parent's threshold as the *pool* carries it: a parent outside the
      // pool (a regional forme) contributes 0, which is what the generator's
      // recursion also resolves it to, since every such parent is a base form.
      const parentLevel = entryOfId(parent.id)?.evoLevel ?? 0;
      const expected =
        species.evoLevel ??
        syntheticThreshold(entry.id, (species.evoType ?? 'other') as EvoMethod, entry.band, parentLevel);
      expect(entry.evoLevel, `${entry.species} evoLevel`).toBe(expected);
    }
  });

  it('admits Past species and still nothing tagged, formed or battle-only', () => {
    // Stage 4.9's roster widening: the argument for `isNonstandard === null`
    // was wrong for a Custom Game randomizer, and the pool doubled its band 0.
    const past = SPECIES_POOL.filter((entry) => dex.species.get(entry.id).isNonstandard === 'Past');
    expect(past.length).toBeGreaterThan(200);
    for (const entry of SPECIES_POOL) {
      const kind = dex.species.get(entry.id).isNonstandard;
      expect(kind === null || kind === 'Past', `${entry.species} is ${kind}`).toBe(true);
    }
  });

  it('never raises a real dex level, only fills a missing one', () => {
    for (const entry of SPECIES_POOL) {
      const species = dex.species.get(entry.id);
      if (species.evoLevel) expect(entry.evoLevel, entry.species).toBe(species.evoLevel);
    }
    for (const id of Object.keys(SYNTHETIC_OVERRIDES)) {
      expect(ids.has(id), `override ${id} names a pool species`).toBe(true);
      expect(dex.species.get(id).evoLevel, `override ${id} sits on a species with a real dex level`).toBeFalsy();
    }
  });

  it('gives every synthetic entry a reason', () => {
    for (const [method, row] of Object.entries(SYNTHETIC_BY_METHOD)) {
      expect(row.reason.length, method).toBeGreaterThan(10);
      expect(row.level).toBeGreaterThan(0);
    }
    for (const [id, row] of Object.entries(SYNTHETIC_OVERRIDES)) {
      expect(row.reason.length, id).toBeGreaterThan(10);
    }
  });

  it('holds the floor: a synthetic threshold is never below its band floor', () => {
    for (const entry of SPECIES_POOL) {
      const species = dex.species.get(entry.id);
      if (!species.prevo || species.evoLevel) continue;
      if (SYNTHETIC_OVERRIDES[entry.id]) continue;
      const floor = SYNTHETIC_FLOOR_BY_BAND[entry.band] ?? 0;
      expect(entry.evoLevel ?? 0, `${entry.species} (band ${entry.band})`).toBeGreaterThanOrEqual(floor);
    }
  });

  it('holds the ceiling: every synthetic threshold fits inside the run', () => {
    for (const entry of SPECIES_POOL) {
      const species = dex.species.get(entry.id);
      if (!species.prevo || species.evoLevel) continue;
      expect(entry.evoLevel ?? 0, entry.species).toBeLessThanOrEqual(FINAL_LEVEL);
    }
    // Real dex levels above the final level are allowed to exist and never
    // fire; only a *real* level may strand a line, never a synthetic one.
    const stranded = SPECIES_POOL.filter((entry) => (entry.evoLevel ?? 0) > FINAL_LEVEL);
    for (const entry of stranded) expect(dex.species.get(entry.id).evoLevel, entry.species).toBe(entry.evoLevel);
  });

  it('holds the sibling rule: every branch of a family fires at one level', () => {
    const families = new Map<string, number[]>();
    for (const entry of SPECIES_POOL) {
      if (entry.prevo === null) continue;
      families.set(entry.prevo, [...(families.get(entry.prevo) ?? []), entry.evoLevel ?? 0]);
    }
    let branching = 0;
    for (const [parent, levels] of families) {
      if (levels.length < 2) continue;
      branching++;
      expect(new Set(levels).size, `${parent} branches at ${levels.join('/')}`).toBe(1);
    }
    expect(branching).toBeGreaterThan(10);
  });

  it('keeps chains monotone: a child is never a lower level than its parent', () => {
    for (const entry of SPECIES_POOL) {
      if (entry.prevo === null) continue;
      const parent = entryOfId(entry.prevo);
      expect(parent, `${entry.species} parent ${entry.prevo}`).not.toBeNull();
      expect(entry.evoLevel ?? 0, `${entry.species} vs ${parent?.species}`).toBeGreaterThanOrEqual(parent?.evoLevel ?? 0);
    }
  });
});

describe('the derived read', () => {
  it('inverts prevo in dex order and drops blacklisted targets', () => {
    for (const entry of SPECIES_POOL) {
      const targets = targetsOf(entry.id);
      const expected = SPECIES_POOL.filter((child) => child.prevo === entry.id && !BLACKLISTED_SPECIES.includes(child.id));
      expect(targets.map((target) => target.id), entry.species).toEqual(expected.map((child) => child.id));
    }
    expect(targetsOf('nincada').map((target) => target.id)).toEqual(['ninjask']);
    expect(targetsOf('eevee').length).toBe(8);
    expect(targetsOf('dragonite')).toEqual([]);
  });

  it('gates stages by level', () => {
    const gible = entryOfId('gible')!;
    const gabite = entryOfId('gabite')!;
    const garchomp = entryOfId('garchomp')!;
    expect(isBaseForm(gible)).toBe(true);
    expect(hasEvolution(gible)).toBe(true);
    expect(stageAllowedAt(gible, 1)).toBe(true);
    expect(stageAllowedAt(gabite, 23)).toBe(false);
    expect(stageAllowedAt(gabite, 24)).toBe(true);
    expect(stageAllowedAt(garchomp, 47)).toBe(false);
    expect(stageAllowedAt(garchomp, 48)).toBe(true);
  });

  it('keeps a regional line\'s child as a non-base form with no parent', () => {
    // Clodsire descends from Wooper-Paldea, a forme the pool excludes. The edge
    // is dropped but Clodsire is still not a base form: it must not be drawn at
    // level 5 and it must not be offered as a starter.
    const clodsire = entryOfId('clodsire')!;
    expect(clodsire.prevo).toBeNull();
    expect(isBaseForm(clodsire)).toBe(false);
    expect(targetsOf('wooper').map((target) => target.id)).toEqual(['quagsire']);
  });

  it('builds every drawable species in the damage calc, which the opponent AI asks about', () => {
    // Aegislash is why this exists: admitted with the Past species, absent from
    // the calc's gen 9 table as a plain name, and the switch scorer threw on it.
    const gen = Generations.get(9);
    for (const entry of SPECIES_POOL) {
      if (BLACKLISTED_SPECIES.includes(entry.id)) continue;
      expect(() => new Pokemon(gen, entry.species, { level: 10 }), entry.species).not.toThrow();
    }
  });

  it('has a band-0 base form of every type, for the widen-down fallback to land on', () => {
    const types = new Set(SPECIES_POOL.flatMap((entry) => entry.types));
    for (const type of types) {
      const count = SPECIES_POOL.filter((entry) => entry.band === 0 && isBaseForm(entry) && entry.types.includes(type)).length;
      expect(count, type).toBeGreaterThan(5);
    }
  });
});
