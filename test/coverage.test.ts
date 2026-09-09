/**
 * Offensive coverage: a fact, a pure one, and never a score.
 *
 * Two things are under test and they are of different kinds. One is arithmetic
 * — does the fold over the type chart produce the right set — and it is checked
 * against hand-computed cases rather than against a second implementation.
 *
 * The other is a *design* property, and it is the one worth the file: the
 * module must give a caller no way to render a verdict. Part 4 of the stage
 * spec forbids a score, a rating, a "recommended" marker, or an ordering that
 * implies one. A function returning a number would make that a matter of
 * discipline at every call site; a function returning a set of names makes it
 * structural. The last section asserts the shape, so that adding a
 * `coverageScore` later is a test failure rather than a quiet drift.
 */
import { describe, expect, it } from 'vitest';

import { coverageAfterSwap, coverageDelta, offensiveCoverage } from '../src/core/coverage';
import { createPartyMember } from '../src/core/party';
import type { PokemonSpec, PokemonState } from '../src/core/types';

const mon = (species: string, ability: string, moves: string[]): PokemonState =>
  createPartyMember({ species, ability, moves, level: 50 } as PokemonSpec);

// ---------------------------------------------------------------------------
// The fold
// ---------------------------------------------------------------------------

describe('offensiveCoverage', () => {
  it('reports what one move type is strong against, and nothing else', () => {
    // Ember is Fire. Fire is super effective against exactly these four.
    const party = [mon('Charmander', 'Blaze', ['Ember'])];
    expect(offensiveCoverage(party)).toEqual(['Bug', 'Grass', 'Ice', 'Steel']);
  });

  it('unions across moves and across members', () => {
    const fire = offensiveCoverage([mon('Charmander', 'Blaze', ['Ember'])]);
    const water = offensiveCoverage([mon('Squirtle', 'Torrent', ['Bubble'])]);
    const both = offensiveCoverage([
      mon('Charmander', 'Blaze', ['Ember']),
      mon('Squirtle', 'Torrent', ['Bubble']),
    ]);

    expect(both).toEqual([...new Set([...fire, ...water])].sort());
    expect(both.length).toBeGreaterThan(fire.length);
  });

  it('ignores status moves, which hit nothing hard', () => {
    // Thunder Wave is Electric but deals no damage, so it buys no coverage.
    expect(offensiveCoverage([mon('Pikachu', 'Static', ['Thunder Wave', 'Growl'])])).toEqual([]);
  });

  it('counts a damaging move of the same type that a status move would not', () => {
    const covered = offensiveCoverage([mon('Pikachu', 'Static', ['Thunder Wave', 'Thunder Shock'])]);
    expect(covered).toEqual(['Flying', 'Water']);
  });

  it('is empty for an empty party rather than throwing', () => {
    expect(offensiveCoverage([])).toEqual([]);
  });

  it('counts a fainted member, because it revives at the next node', () => {
    const healthy = mon('Charmander', 'Blaze', ['Ember']);
    const down = { ...healthy, hp: 0, fainted: true };
    // A party that appeared to lose coverage because someone went down would be
    // reporting the fight rather than the team.
    expect(offensiveCoverage([down])).toEqual(offensiveCoverage([healthy]));
  });

  it('counts a move at zero PP, for the same reason', () => {
    const full = mon('Charmander', 'Blaze', ['Ember']);
    const spent = { ...full, moves: full.moves.map((move) => ({ ...move, pp: 0 })) };
    expect(offensiveCoverage([spent])).toEqual(offensiveCoverage([full]));
  });

  it('returns a sorted set, so party order cannot change the answer', () => {
    const a = mon('Charmander', 'Blaze', ['Ember']);
    const b = mon('Squirtle', 'Torrent', ['Bubble']);
    expect(offensiveCoverage([a, b])).toEqual(offensiveCoverage([b, a]));

    const result = offensiveCoverage([a, b]);
    expect(result).toEqual([...result].sort());
    expect(new Set(result).size).toBe(result.length);
  });
});

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

describe('the function is pure', () => {
  it('returns identical output for identical input, every time', () => {
    const party = [
      mon('Charmander', 'Blaze', ['Ember', 'Scratch']),
      mon('Squirtle', 'Torrent', ['Bubble', 'Tackle']),
    ];
    const first = offensiveCoverage(party);
    for (let i = 0; i < 5; i++) expect(offensiveCoverage(party)).toEqual(first);
  });

  it('does not mutate the party it is handed', () => {
    const party = [mon('Charmander', 'Blaze', ['Ember'])];
    const before = JSON.parse(JSON.stringify(party)) as PokemonState[];
    offensiveCoverage(party);
    expect(JSON.parse(JSON.stringify(party))).toEqual(before);
  });

  it('draws no RNG: two calls either side of unrelated work still agree', () => {
    // If it drew, interleaving would shift the stream and the sets would
    // diverge. They cannot, because there is no stream to draw from.
    const party = [mon('Pikachu', 'Static', ['Thunder Shock'])];
    const first = offensiveCoverage(party);
    offensiveCoverage([mon('Snorlax', 'Thick Fat', ['Body Slam', 'Crunch', 'Earthquake', 'Rest'])]);
    expect(offensiveCoverage(party)).toEqual(first);
  });
});

// ---------------------------------------------------------------------------
// The delta
// ---------------------------------------------------------------------------

describe('coverageDelta', () => {
  it('names what was gained and what was lost, in both directions', () => {
    expect(coverageDelta(['Ghost', 'Water'], ['Dragon', 'Steel', 'Water'])).toEqual({
      added: ['Dragon', 'Steel'],
      lost: ['Ghost'],
    });
  });

  it('is empty on both sides when nothing changed', () => {
    expect(coverageDelta(['Bug', 'Grass'], ['Grass', 'Bug'])).toEqual({ added: [], lost: [] });
  });

  it('handles a pure gain and a pure loss without a net', () => {
    expect(coverageDelta([], ['Fire'])).toEqual({ added: ['Fire'], lost: [] });
    expect(coverageDelta(['Fire'], [])).toEqual({ added: [], lost: ['Fire'] });
  });

  it('sorts both lists, so the rendered line is stable', () => {
    const delta = coverageDelta([], ['Water', 'Bug', 'Steel']);
    expect(delta.added).toEqual(['Bug', 'Steel', 'Water']);
  });
});

// ---------------------------------------------------------------------------
// The swap preview
// ---------------------------------------------------------------------------

describe('coverageAfterSwap', () => {
  const party = (): PokemonState[] => [
    mon('Charmander', 'Blaze', ['Ember']),
    mon('Squirtle', 'Torrent', ['Bubble']),
  ];
  const incoming = (): PokemonState => mon('Dratini', 'Shed Skin', ['Dragon Rage', 'Twister']);

  it('reports the party as it would be with the named member replaced', () => {
    const swapped = coverageAfterSwap(party(), incoming(), 0);
    const byHand = offensiveCoverage([incoming(), party()[1]!]);
    expect(swapped).toEqual(byHand);
  });

  it('updates as the highlighted target moves, which is the point', () => {
    const dropFire = coverageAfterSwap(party(), incoming(), 0);
    const dropWater = coverageAfterSwap(party(), incoming(), 1);
    expect(dropFire).not.toEqual(dropWater);
  });

  it('adds rather than replaces when the slot is out of range', () => {
    // The empty-slot reading, and the state a card is in before the player has
    // highlighted anything. It renders the additive line rather than crashing.
    const added = coverageAfterSwap(party(), incoming(), -1);
    expect(added).toEqual(offensiveCoverage([...party(), incoming()]));
  });

  it('does not mutate the party it previews against', () => {
    const roster = party();
    const before = JSON.parse(JSON.stringify(roster)) as PokemonState[];
    coverageAfterSwap(roster, incoming(), 0);
    expect(JSON.parse(JSON.stringify(roster))).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Part 4: the module offers no way to render a verdict
// ---------------------------------------------------------------------------

describe('there is no score to render', () => {
  it('returns names, never numbers', async () => {
    const module = await import('../src/core/coverage');
    const party = [mon('Charmander', 'Blaze', ['Ember'])];

    for (const value of offensiveCoverage(party)) expect(typeof value).toBe('string');
    const delta = coverageDelta([], offensiveCoverage(party));
    for (const value of [...delta.added, ...delta.lost]) expect(typeof value).toBe('string');

    /*
     * And the module exports nothing that could be read as a rating.
     *
     * Structural rather than a matter of discipline at each call site: Part 4
     * forbids a numeric score, and the cheapest way to keep that true is for
     * there to be no function here that produces one. A `coverageScore` added
     * later fails this test, which is the point of it.
     */
    expect(Object.keys(module).sort()).toEqual([
      'coverageAfterSwap',
      'coverageDelta',
      'offensiveCoverage',
    ]);
  });

  it('gives a caller no ordering that implies ranking', () => {
    // Alphabetical, which carries no judgement. A set ordered by "how much this
    // helps" would be a ranking rendered as a list.
    const covered = offensiveCoverage([
      mon('Charmander', 'Blaze', ['Ember']),
      mon('Squirtle', 'Torrent', ['Bubble']),
    ]);
    expect(covered).toEqual([...covered].sort());
  });
});
