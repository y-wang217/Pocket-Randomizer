/**
 * The threat readout: what it lists, what it refuses to list, and in what order.
 *
 * Three properties, and the third is the one that is easy to lose.
 *
 *   1. A listed type hits somebody hard. (`hitsHard` is non-empty.)
 *   2. A listed type is one nothing in the party answers. (`punished` is false,
 *      which is *not* membership in `offensiveCoverage`.)
 *   3. The order carries no meaning. Canonical dex order, never severity —
 *      because a list sorted by how badly it hurts is the UI telling the player
 *      what to be most afraid of, and Part 4 says the UI presents attributes
 *      and never verdicts.
 *
 * The hand-built parties below are chosen so that every assertion has a reason
 * a reader can check against the type chart without running anything: a
 * mono-Water Squirtle is weak to Grass and Electric and its Water moves answer
 * Fire, Ground and Rock. Nothing here depends on a species' *real* moveset or
 * ability, because in GYMRUN nothing does — abilities come off the whole pool
 * and movesets are off-species by design, which is exactly why a Levitate on a
 * Pikachu is a routine case rather than a curiosity.
 */
import { describe, expect, it } from 'vitest';

import { describeSpecCard, typeMultiplier, WHEEL_TYPES } from '../src/core/battle/driver';
import { applyAbilityEffects } from '../src/core/battle/effectiveness';
import { offensiveCoverage } from '../src/core/coverage';
import { generateStarterOptions } from '../src/core/encounters';
import { createPartyMember } from '../src/core/party';
import { createRng } from '../src/core/rng';
import {
  HITS_HARD_AT,
  NO_THREATS,
  partyThreats,
  threatDetail,
  threatDetailLine,
  threatLine,
  type ThreatEntry,
} from '../src/core/typeMatchup';
import { abilityEffects } from '../src/data/abilityEffects';
import { DEFAULT_TUNING } from '../src/data/tuning';
import type { PokemonState } from '../src/core/types';

/** A party member from a species, an ability and a moveset, at a fixed level. */
function member(species: string, ability: string, moves: string[]): PokemonState {
  return createPartyMember({ species, ability, moves, level: 30 });
}

/** Just the type names, which is what most assertions here are about. */
function typesOf(threats: readonly ThreatEntry[]): string[] {
  return threats.map((entry) => entry.type);
}

// ---------------------------------------------------------------------------
// What the list contains
// ---------------------------------------------------------------------------

describe('partyThreats lists what hits the party and nothing answers', () => {
  it('lists both unanswered weaknesses of a mono-Water party with only Water moves', () => {
    // Water is weak to Grass and Electric; a Water move answers Fire, Ground
    // and Rock and neither of those two. So both are unanswered.
    const party = [member('Squirtle', 'Torrent', ['Water Gun', 'Tackle'])];
    expect(typesOf(partyThreats(party))).toEqual(['Electric', 'Grass']);
  });

  it('drops a weakness the party can hit back', () => {
    /*
     * The same Squirtle, one move different. Ice Beam is super effective
     * against Grass, so Grass leaves the list while Electric — which nothing
     * in the moveset is strong against — stays.
     *
     * This is the asymmetry the whole function turns on: Grass is still a 2x
     * weakness, and it is still absent, because the question is not "what hurts
     * me" but "what hurts me that I cannot answer".
     */
    const party = [member('Squirtle', 'Torrent', ['Water Gun', 'Ice Beam'])];
    expect(typesOf(partyThreats(party))).toEqual(['Electric']);
  });

  it('lists every weakness of a party with no damaging moves at all', () => {
    // Nothing is answered, so every 2x weakness is listed. A party that cannot
    // hit anything is a real state — a moveset can be four status moves — and
    // it must not be an empty readout.
    const party = [member('Squirtle', 'Torrent', ['Growl', 'Tail Whip', 'Withdraw'])];
    expect(typesOf(partyThreats(party))).toEqual(['Electric', 'Grass']);
  });

  it('carries the party size on every entry, so the UI never recomputes it', () => {
    const party = [
      member('Squirtle', 'Torrent', ['Tackle']),
      member('Squirtle', 'Torrent', ['Tackle']),
    ];
    for (const entry of partyThreats(party)) {
      expect(entry.partySize).toBe(2);
      expect(entry.membersHit).toBeGreaterThan(0);
      expect(entry.membersHit).toBeLessThanOrEqual(entry.partySize);
    }
  });
});

// ---------------------------------------------------------------------------
// Status moves
// ---------------------------------------------------------------------------

describe('status moves never answer anything', () => {
  /*
   * Will-O-Wisp and Ember are both Fire, and Fire is strong against Grass. One
   * of them answers Grass and one does not, and the difference is category
   * rather than type — the same rule the per-move markers use when they print
   * no effectiveness at all for a status move rather than printing `1x`.
   */
  it('leaves a weakness listed when the only move of that type is a status move', () => {
    const party = [member('Squirtle', 'Torrent', ['Will-O-Wisp'])];
    expect(typesOf(partyThreats(party))).toContain('Grass');
  });

  it('drops it when the same type arrives as a damaging move', () => {
    const party = [member('Squirtle', 'Torrent', ['Ember'])];
    expect(typesOf(partyThreats(party))).not.toContain('Grass');
  });
});

// ---------------------------------------------------------------------------
// Abilities
// ---------------------------------------------------------------------------

describe('abilities are folded in', () => {
  /*
   * **The case the readout would not be forgiven for getting wrong.** Abilities
   * are drawn from the whole pool rather than a species' legal set, so a
   * Levitate on a mono-Electric Pikachu is an ordinary roll — and a line that
   * told the player to watch for Ground when Ground cannot touch their team is
   * a false alarm they will stop trusting the readout over.
   */
  it('does not count a Levitate holder in hitsHard(Ground)', () => {
    const grounded = [member('Pikachu', 'Static', ['Body Slam'])];
    expect(typesOf(partyThreats(grounded))).toEqual(['Ground']);

    const floating = [member('Pikachu', 'Levitate', ['Body Slam'])];
    expect(typesOf(partyThreats(floating))).toEqual([]);
  });

  it('does not list Ground when the only Ground-weak member has Levitate', () => {
    // The Squirtle is along to prove the party is not simply empty of threats:
    // it brings Electric and Grass, and Ground is still absent.
    const party = [
      member('Pikachu', 'Levitate', ['Body Slam']),
      member('Squirtle', 'Torrent', ['Tackle']),
    ];
    const listed = typesOf(partyThreats(party));
    expect(listed).not.toContain('Ground');
    expect(listed).toEqual(['Electric', 'Grass']);
  });
});

// ---------------------------------------------------------------------------
// Dual types
// ---------------------------------------------------------------------------

describe('a dual type is one net multiplier, not two lookups', () => {
  /*
   * Gyarados is Water/Flying and answers both halves of the rule at once.
   *
   *   - Grass is 2x into Water and 0.5x into Flying. The product is 1x, so it
   *     is not a weakness and must not be listed — which is what a
   *     per-slot implementation gets wrong, because one slot says 2x.
   *   - Electric is 2x into Water and 2x into Flying. The product is 4x, one
   *     member, counted **once** — which is what a per-slot implementation gets
   *     wrong in the other direction, by counting the same Pokemon twice.
   */
  const party = [member('Gyarados', 'Intimidate', ['Body Slam'])];

  it('does not count a member whose two slots cancel', () => {
    expect(typesOf(partyThreats(party))).not.toContain('Grass');
  });

  it('counts a 4x member once', () => {
    const electric = partyThreats(party).find((entry) => entry.type === 'Electric');
    expect(electric).toBeDefined();
    expect(electric?.membersHit).toBe(1);
    expect(electric?.partySize).toBe(1);
  });

  it('lists exactly the two types that survive the product', () => {
    expect(typesOf(partyThreats(party))).toEqual(['Electric', 'Rock']);
  });
});

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

describe('the order implies no ranking', () => {
  /*
   * A party where the alphabet and the severity disagree, which is the only
   * kind of party this test could be written on.
   *
   * Grass hits all three (Squirtle 2x, Geodude 4x, Sandshrew 2x). Electric
   * hits one (Squirtle; it does nothing at all to the two Ground types). So a
   * list sorted by `membersHit` would open with Grass, and the canonical dex
   * order opens with Electric. The assertion is that it opens with Electric.
   */
  const party = [
    member('Squirtle', 'Torrent', ['Tackle']),
    member('Geodude', 'Sturdy', ['Tackle']),
    member('Sandshrew', 'Sand Veil', ['Tackle']),
  ];

  it('uses the canonical dex type order', () => {
    const listed = typesOf(partyThreats(party));
    expect(listed).toEqual(WHEEL_TYPES.filter((type) => listed.includes(type)));
  });

  it('is not sorted by membersHit', () => {
    const threats = partyThreats(party);
    const electric = threats.findIndex((entry) => entry.type === 'Electric');
    const grass = threats.findIndex((entry) => entry.type === 'Grass');

    expect(electric).toBeGreaterThanOrEqual(0);
    expect(grass).toBeGreaterThanOrEqual(0);
    // The premise: severity and the alphabet genuinely disagree here.
    expect(threats[grass]?.membersHit).toBeGreaterThan(threats[electric]?.membersHit ?? 0);
    // And the alphabet wins.
    expect(electric).toBeLessThan(grass);
  });

  it('gives the same order on every call', () => {
    expect(typesOf(partyThreats(party))).toEqual(typesOf(partyThreats(party)));
  });
});

// ---------------------------------------------------------------------------
// Degenerate parties
// ---------------------------------------------------------------------------

describe('parties with nothing in them, and parties with nothing standing', () => {
  it('returns an empty array for an empty party rather than throwing', () => {
    expect(() => partyThreats([])).not.toThrow();
    expect(partyThreats([])).toEqual([]);
  });

  /*
   * **An all-fainted party reads exactly as the same party alive**, and the
   * patch's own test list asks for the opposite in one line while its
   * definition asks for this in another. The definition wins, and it is the
   * half that has a reason: a fainted member revives at
   * `tuning.reviveHpPercent` at the next node, so it is part of the team the
   * player is about to walk into the next fight with. A readout that emptied
   * itself on a wipe would be describing the last battle rather than the party,
   * and it would flicker on every faint.
   *
   * What is genuinely asserted from that line is the part that matters: it does
   * not throw.
   */
  it('counts fainted members, and does not throw on a party with no one standing', () => {
    const alive = [member('Squirtle', 'Torrent', ['Tackle'])];
    const fainted = alive.map((one) => ({ ...one, hp: 0, fainted: true }));

    expect(() => partyThreats(fainted)).not.toThrow();
    expect(partyThreats(fainted)).toEqual(partyThreats(alive));
    expect(typesOf(partyThreats(fainted))).toEqual(['Electric', 'Grass']);
  });
});

// ---------------------------------------------------------------------------
// The property, over parties nobody chose
// ---------------------------------------------------------------------------

describe('over generated parties', () => {
  /**
   * Parties built from real generated starters, which is the only population
   * that contains the combinations nobody would think to hand-build: an
   * off-species ability, four moves of one type, a dual type whose slots
   * disagree.
   */
  function generatedParties(count: number): PokemonState[][] {
    const parties: PokemonState[][] = [];
    for (let seed = 0; seed < count; seed++) {
      const specs = generateStarterOptions(createRng(`THREAT-PROP-${seed}`), DEFAULT_TUNING);
      // One party of all three, and one of the first alone, so both the
      // single-member and the full-party denominators are exercised.
      parties.push(specs.map(createPartyMember));
      const solo = specs[0];
      if (solo) parties.push([createPartyMember(solo)]);
    }
    return parties;
  }

  const parties = generatedParties(40);

  it('builds a population worth asserting over', () => {
    // A property test over an empty population passes forever and means nothing.
    expect(parties.length).toBe(80);
    expect(parties.some((party) => partyThreats(party).length > 0)).toBe(true);
  });

  it('lists only types that hit at least one member at the threshold', () => {
    /*
     * Recomputed from the chart in a deliberately different shape — a filter
     * over members rather than a counting loop — so this is a second reading of
     * the definition rather than a copy of the implementation. What it is
     * really asserting is that `membersHit` is the count it claims to be, over
     * a population where the abilities were not chosen by whoever wrote the
     * test.
     */
    for (const party of parties) {
      const defenders = party.map((one) => describeSpecCard(one.spec));
      for (const entry of partyThreats(party)) {
        const hit = defenders.filter(
          (card) =>
            applyAbilityEffects(
              typeMultiplier(entry.type, card.types),
              entry.type,
              [],
              abilityEffects(card.abilityId),
            ) >= HITS_HARD_AT,
        );
        expect(hit.length, `${entry.type} listed but hits nobody`).toBeGreaterThan(0);
        expect(entry.membersHit).toBe(hit.length);
        expect(entry.partySize).toBe(party.length);
      }
    }
  });

  it('lists no type the party covers, so the output is disjoint from coverage', () => {
    // The independent half of the property, and the one that cannot be
    // restated from the type chart: `punished` is membership in the *same* set
    // the species card renders, so a threat that appeared in both would mean
    // two screens disagreeing about one party.
    for (const party of parties) {
      const covered = new Set(offensiveCoverage(party));
      for (const entry of partyThreats(party)) {
        expect(covered.has(entry.type), `${entry.type} is both listed and covered`).toBe(false);
      }
    }
  });

  it('returns a subset of the threat set, disjoint from the coverage set', () => {
    /*
     * The statement the two properties above make together, asserted as one
     * thing because that is what the output *is*: every entry hits somebody
     * hard, and no entry is answered. Nothing else can appear in the list, and
     * nothing that satisfies both can be missing from it.
     */
    for (const party of parties) {
      const covered = new Set(offensiveCoverage(party));
      const expected = WHEEL_TYPES.filter((type) => {
        if (covered.has(type)) return false;
        return party.some((one) => {
          const card = describeSpecCard(one.spec);
          const naive = typeMultiplier(type, card.types);
          return applyAbilityEffects(naive, type, [], abilityEffects(card.abilityId)) >= HITS_HARD_AT;
        });
      });
      expect(typesOf(partyThreats(party))).toEqual(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

describe('the function is pure', () => {
  const party = [
    member('Squirtle', 'Torrent', ['Water Gun']),
    member('Geodude', 'Sturdy', ['Tackle']),
  ];

  it('returns identical output for identical input, every time', () => {
    const first = partyThreats(party);
    for (let i = 0; i < 5; i++) expect(partyThreats(party)).toEqual(first);
  });

  it('does not mutate the party it is handed', () => {
    const before = JSON.stringify(party);
    partyThreats(party);
    expect(JSON.stringify(party)).toBe(before);
  });

  it('draws no RNG: two streams either side of a call still agree', () => {
    /*
     * The same guard `test/coverage.test.ts` puts on the coverage function, and
     * it is the one that matters for a readout: a display feature that advanced
     * a stream would change every seed in the game, silently, and the only
     * symptom would be that old run logs stopped replaying.
     */
    const untouched = createRng('THREAT-RNG');
    const around = createRng('THREAT-RNG');

    const expected = [
      untouched.map.nextUint32(),
      untouched.rewards.nextUint32(),
      untouched.battle.nextUint32(),
    ];

    const first = around.map.nextUint32();
    partyThreats(party);
    const rest = [around.rewards.nextUint32(), around.battle.nextUint32()];

    expect([first, ...rest]).toEqual(expected);
    // And no stream advanced at all, which the values alone would not show if
    // two streams happened to draw past each other.
    expect([around.map.draws, around.rewards.draws, around.battle.draws]).toEqual([1, 1, 1]);
  });
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

describe('the copy states facts and grades nothing', () => {
  const threats = partyThreats([member('Squirtle', 'Torrent', ['Water Gun', 'Tackle'])]);

  it('names the types in the simple reading', () => {
    expect(threatLine(threats)).toBe('Watch for: Electric, Grass');
  });

  it('gives the count out of the party size in the detailed reading', () => {
    const entry = threats[0];
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(threatDetail(entry)).toBe('hits 1 of 1, unanswered');
    expect(threatDetailLine(entry)).toBe('Electric: hits 1 of 1, unanswered');
  });

  it('says there is nothing to list rather than passing judgement on an empty list', () => {
    expect(threatLine([])).toBe(NO_THREATS);
  });

  it('uses no word that grades the party', () => {
    /*
     * The wording is the closest thing in the game to advice, so the vocabulary
     * is checked rather than trusted. "Weak", "bad", "vulnerable", "risk" and
     * the rest are verdicts; a score, a rating or a grade is the same verdict
     * with a number on it.
     */
    const banned = /\b(weak|weakness|bad|poor|vulnerab\w*|danger\w*|risk\w*|trouble|score|rating|grade|should|improve|better|worse)\b/i;
    const copy = [
      threatLine(threats),
      threatLine([]),
      ...threats.map(threatDetailLine),
    ];
    for (const line of copy) expect(line, `"${line}" grades the party`).not.toMatch(banned);
  });
});
