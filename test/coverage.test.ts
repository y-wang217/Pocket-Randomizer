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

import { greedyAiPolicy } from '../src/core/battle/ai';
import { coverageAfterSwap, coverageDelta, offensiveCoverage } from '../src/core/coverage';
import { createPartyMember } from '../src/core/party';
import { playRun, replayRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import type { PokemonSpec, PokemonState } from '../src/core/types';
import { PARTY_SIZE } from '../src/data/partyTuning';

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

// ---------------------------------------------------------------------------
// Species rewards, end to end
// ---------------------------------------------------------------------------

/**
 * A policy that takes every species card it is offered and, once full, swaps.
 *
 * The reward-card route specifically, not the wild-node one. Both go through
 * `chooseAcquisition` — that is the whole point of `acquisitionOffered` — but
 * only the card carries a spec that was flattened into a `Reward` and rebuilt,
 * so only the card can lose a field on the round trip. Gender did, in an
 * earlier draft of this stage.
 */
function speciesTaker(): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseReward: async (offer) => {
      const species = offer.options.findIndex((option) => option.kind === 'species');
      return species === -1 ? 0 : species;
    },
    chooseAcquisition: async (_offer, party) =>
      party.length < PARTY_SIZE ? { kind: 'accept' } : { kind: 'release', slot: 0 },
  };
}

describe('a species swap replays identically', () => {
  it('reconstructs the same party, species for species', async () => {
    const original = await playRun('SPECIES-SWAP', speciesTaker());
    const replayed = await replayRun(original.log);

    expect(replayed.state.party.map((member) => member.spec.species)).toEqual(
      original.state.party.map((member) => member.spec.species),
    );
    expect(replayed.outcome).toBe(original.outcome);
    expect(replayed.log.decisions).toEqual(original.log.decisions);
  }, 60_000);

  it('carries every spec field across the card round trip, gender included', async () => {
    // A species card is a flattened `PokemonSpec` rebuilt in
    // `run.acquisitionOffered`. A field dropped there is silently re-rolled by
    // the sim at the member's first battle — and again at its second.
    const run = await playRun('SPECIES-FIELDS', speciesTaker());
    for (const member of run.state.party) {
      expect(member.spec.gender, member.spec.species).not.toBeUndefined();
      expect(member.spec.ability, member.spec.species).toBeTruthy();
      expect(member.spec.moves.length, member.spec.species).toBeGreaterThan(0);
    }
  }, 60_000);

  it('reports the same coverage for the replayed party as for the original', async () => {
    // The function is pure, so this can only fail if the parties differ — which
    // is the point: it is a second, independent read on the replay above.
    const original = await playRun('SPECIES-COVER', speciesTaker());
    const replayed = await replayRun(original.log);
    expect(offensiveCoverage(replayed.state.party)).toEqual(
      offensiveCoverage(original.state.party),
    );
  }, 60_000);
});
