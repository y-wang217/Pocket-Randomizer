/**
 * Party slots, and the four places a stale capacity would be invisible.
 *
 * **Stage 4.8, item 1.** The party used to be one number for a whole run, which
 * made a gym clear structurally identical to any other node completion. It is a
 * schedule now — `data/partyTuning.SLOT_UNLOCK_SCHEDULE` — and `partyCapacity`
 * is the single function that answers how wide the roster is *right now*.
 *
 * ## What this file is for, and what it deliberately is not
 *
 * The schedule's numbers are balance numbers and this file does not assert them.
 * It asserts the three things that are not balance:
 *
 *   1. Capacity follows the table exactly, and is derived rather than stored.
 *   2. The backpack grows with it, at every unlock boundary, over a real run.
 *   3. **Every reader asks the run, not a constant.** This is the one the prompt
 *      singles out: "a slot unlock that does not reach the capture flow means a
 *      player is told they have room and then asked to replace someone."
 *
 * The third is the reason a constant was not left beside the schedule for
 * compatibility. `PARTY_SIZE` is deleted, so a call site that has not been
 * reviewed does not compile — which is a stronger guarantee than any test here,
 * and these tests cover what the compiler cannot see: a site that reads *a*
 * capacity, but the wrong one, or one captured at the wrong moment.
 */
import { describe, expect, it } from 'vitest';

import { decisionRefusal, hasRoom } from '../src/core/acquisition';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { backpackCapacity } from '../src/core/items';
import { createParty } from '../src/core/party';
import {
  createRun,
  gymsCleared,
  partyCapacity,
  playRun,
  scriptedRunPolicy,
  SEGMENTS_PER_RUN,
  type RunPolicy,
  type RunState,
} from '../src/core/run';
import type { PokemonSpec, PokemonState } from '../src/core/types';
import {
  MAX_PARTY_CAPACITY,
  nextSlotUnlock,
  partyCapacityAfter,
  SLOT_UNLOCK_SCHEDULE,
} from '../src/data/partyTuning';
import { expectedPartySize, MAX_TEAM_SIZE, opponentTeamSize } from '../src/data/scaling';
import { DEFAULT_TUNING } from '../src/data/tuning';

const ROSTER = ['Bulbasaur', 'Squirtle', 'Charmander', 'Pidgey', 'Rattata', 'Zubat'];

const spec = (species: string): PokemonSpec => ({
  species,
  ability: 'Overgrow',
  moves: ['Tackle'],
  level: 30,
});

const partyOf = (size: number): PokemonState[] => createParty(ROSTER.slice(0, size).map(spec));

/** A run state with `gyms` gym clears in its history and nothing else. */
function withGyms(gyms: number): RunState {
  const state = createRun('SLOTS-A1');
  return {
    ...state,
    history: Array.from({ length: gyms }, (_unused, index) => ({
      node: { ...state.segments[0]!.gym, id: `gym-${index}` },
      segment: index,
      result: { winner: 'p1' as const, turns: 1, cause: 'faint' as const },
      hpAfter: 1,
      casualties: [],
    })),
  };
}

// ---------------------------------------------------------------------------
// 1. The schedule, and capacity as a function of it
// ---------------------------------------------------------------------------

describe('the slot unlock schedule', () => {
  it('covers every gym count a run can reach, including zero and eight', () => {
    // One row per gym count, not per segment: a run that clears all eight has a
    // capacity after the eighth, and an off-by-one here is a `NaN` on screen.
    expect(SLOT_UNLOCK_SCHEDULE).toHaveLength(SEGMENTS_PER_RUN + 1);
  });

  it('never narrows, because a slot is never taken away', () => {
    for (let gyms = 1; gyms < SLOT_UNLOCK_SCHEDULE.length; gyms++) {
      expect(
        partyCapacityAfter(gyms),
        `capacity fell between gym ${gyms - 1} and gym ${gyms}`,
      ).toBeGreaterThanOrEqual(partyCapacityAfter(gyms - 1));
    }
  });

  it('reaches its ceiling by gym 6, leaving the last two at full width', () => {
    // The prompt's shape, asserted as the shape rather than as the numbers: the
    // endgame is meant to be played wide, not still growing.
    expect(partyCapacityAfter(6)).toBe(MAX_PARTY_CAPACITY);
    expect(partyCapacityAfter(7)).toBe(MAX_PARTY_CAPACITY);
    expect(partyCapacityAfter(8)).toBe(MAX_PARTY_CAPACITY);
  });

  it('grants the first extra slot at gym 2, which is the definition of done', () => {
    // "A player clears gym 2 and is told they now carry another Pokemon."
    expect(partyCapacityAfter(2)).toBeGreaterThan(partyCapacityAfter(1));
    expect(partyCapacityAfter(1)).toBe(partyCapacityAfter(0));
  });

  it('clamps rather than trusting a gym count off either end', () => {
    expect(partyCapacityAfter(-3)).toBe(partyCapacityAfter(0));
    expect(partyCapacityAfter(99)).toBe(MAX_PARTY_CAPACITY);
    expect(partyCapacityAfter(2.7)).toBe(partyCapacityAfter(2));
  });

  it('follows the table exactly, row for row', () => {
    SLOT_UNLOCK_SCHEDULE.forEach((slots, gyms) => {
      expect(partyCapacityAfter(gyms), `gym ${gyms}`).toBe(Math.min(slots, MAX_PARTY_CAPACITY));
    });
  });
});

describe('nextSlotUnlock', () => {
  it('names the next gym that widens the party, and what it widens to', () => {
    const next = nextSlotUnlock(0);
    expect(next).not.toBeNull();
    expect(next!.slots).toBe(partyCapacityAfter(next!.atGym));
    expect(next!.slots).toBeGreaterThan(partyCapacityAfter(0));
  });

  it('skips the gyms that grant nothing rather than naming the next gym', () => {
    // Gym 1 grants no slot, so the readout must say gym 2 — "next slot at gym 1"
    // would be a promise the run does not keep.
    expect(nextSlotUnlock(0)?.atGym).toBe(2);
  });

  it('is null at the ceiling, so the readout says nothing rather than "no more"', () => {
    expect(nextSlotUnlock(SLOT_UNLOCK_SCHEDULE.length - 1)).toBeNull();
    expect(nextSlotUnlock(6)).toBeNull();
  });

  it('agrees with the schedule at every gym count', () => {
    for (let gyms = 0; gyms < SLOT_UNLOCK_SCHEDULE.length; gyms++) {
      const next = nextSlotUnlock(gyms);
      if (next === null) {
        expect(partyCapacityAfter(gyms)).toBe(MAX_PARTY_CAPACITY);
      } else {
        expect(next.atGym).toBeGreaterThan(gyms);
        expect(next.slots).toBeGreaterThan(partyCapacityAfter(gyms));
        // Nothing between now and then widens it, or this is not the *next* one.
        for (let between = gyms + 1; between < next.atGym; between++) {
          expect(partyCapacityAfter(between)).toBe(partyCapacityAfter(gyms));
        }
      }
    }
  });
});

describe('partyCapacity reads the run', () => {
  it('is the schedule applied to the run\'s own gym count', () => {
    for (let gyms = 0; gyms <= SEGMENTS_PER_RUN; gyms++) {
      const state = withGyms(gyms);
      expect(gymsCleared(state), `fixture for ${gyms} gyms`).toBe(gyms);
      expect(partyCapacity(state)).toBe(partyCapacityAfter(gyms));
    }
  });

  it('is derived, so nothing in run state stores it', () => {
    /*
     * The determinism claim in one assertion. Capacity is a function of history,
     * history is rebuilt by replay, so capacity needs no field and `RUN_LOG_VERSION`
     * does not move for this patch. A stored copy is a second source of a derived
     * number, and its failure mode is a saved run whose capacity disagrees with
     * its own gym count.
     */
    const state = withGyms(4);
    const keys = Object.keys(state);
    expect(keys).not.toContain('partyCapacity');
    expect(keys).not.toContain('slots');
    expect(JSON.stringify(state)).not.toContain('"capacity"');
  });

  it('rises the moment a gym lands in history and not before', () => {
    const before = withGyms(1);
    const after = withGyms(2);
    expect(partyCapacity(after)).toBeGreaterThan(partyCapacity(before));
  });
});

// ---------------------------------------------------------------------------
// 2. Every reader, and the capture flow in particular
// ---------------------------------------------------------------------------

describe('the capture flow reads live capacity', () => {
  it('has room at the opening width only below it', () => {
    const opening = partyCapacityAfter(0);
    expect(hasRoom(partyOf(opening - 1), opening)).toBe(true);
    expect(hasRoom(partyOf(opening), opening)).toBe(false);
  });

  it('finds room in a party that was full one gym ago', () => {
    /*
     * **The bug item 1 exists to prevent, as a test.** A party of three is full
     * at the opening width and has room the moment a gym grants a fourth slot.
     * A `hasRoom` reading a constant answers "full" for both, which is the player
     * being told to release someone to make room they already have.
     */
    const opening = partyCapacityAfter(0);
    const full = partyOf(opening);
    expect(hasRoom(full, opening)).toBe(false);
    expect(hasRoom(full, partyCapacityAfter(2))).toBe(true);
  });

  it('accepts into the new slot instead of demanding a release', () => {
    const full = partyOf(partyCapacityAfter(0));

    // At the opening width, `accept` is refused and `release` is the answer.
    expect(decisionRefusal(full, { kind: 'accept' }, partyCapacityAfter(0))).toMatch(/full/);
    expect(decisionRefusal(full, { kind: 'release', slot: 0 }, partyCapacityAfter(0))).toBeNull();

    // One unlock later the two swap over, which is the whole point of the item.
    const widened = partyCapacityAfter(2);
    expect(decisionRefusal(full, { kind: 'accept' }, widened)).toBeNull();
    expect(decisionRefusal(full, { kind: 'release', slot: 0 }, widened)).toMatch(/has room/);
  });

  it('names the capacity it refused against, not a constant', () => {
    // The message is what a player and a log reader both see. "3/3" on a run with
    // five slots is a refusal nobody can explain.
    const five = partyOf(5);
    expect(decisionRefusal(five, { kind: 'accept' }, 5)).toBe('party is full (5/5)');
  });

  it('never reports room and a release in the same breath, at any capacity', () => {
    for (let capacity = 1; capacity <= MAX_PARTY_CAPACITY; capacity++) {
      for (let size = 1; size <= MAX_PARTY_CAPACITY; size++) {
        const party = partyOf(size);
        const accept = decisionRefusal(party, { kind: 'accept' }, capacity);
        const release = decisionRefusal(party, { kind: 'release', slot: 0 }, capacity);
        // Exactly one of the two is available. Both legal means a player could
        // release for nothing; neither legal means a dead offer.
        expect(
          (accept === null) !== (release === null),
          `size ${size} at capacity ${capacity}`,
        ).toBe(true);
      }
    }
  });
});

describe('the backpack grows with the party', () => {
  it('is the slots plus the slack, at every gym count', () => {
    for (let gyms = 0; gyms <= SEGMENTS_PER_RUN; gyms++) {
      expect(backpackCapacity(partyCapacityAfter(gyms), DEFAULT_TUNING)).toBe(
        partyCapacityAfter(gyms) + DEFAULT_TUNING.backpackSlack,
      );
    }
  });

  it('widens at exactly the gyms the party does, and never between them', () => {
    // The prompt's requirement 2: at every unlock boundary. Asserted as a pair of
    // step functions that step together, rather than as two lists of numbers.
    for (let gyms = 1; gyms <= SEGMENTS_PER_RUN; gyms++) {
      const partyGrew = partyCapacityAfter(gyms) > partyCapacityAfter(gyms - 1);
      const bagGrew =
        backpackCapacity(partyCapacityAfter(gyms), DEFAULT_TUNING) >
        backpackCapacity(partyCapacityAfter(gyms - 1), DEFAULT_TUNING);
      expect(bagGrew, `gym ${gyms}: party grew ${partyGrew}, bag grew ${bagGrew}`).toBe(partyGrew);
    }
  });

  it('is not a frozen literal: it follows capacity over a whole real run', async () => {
    /*
     * **The regression the report found.** `backpackCapacity` was
     * `PARTY_SIZE + 2` evaluated once at module load and frozen into
     * `DEFAULT_TUNING`, so it could not follow a party that grows however the
     * schedule was written. This watches the live pair over a played run.
     */
    const seen = new Map<number, number>();
    await playRun('SLOTS-B7', capturePolicy(), DEFAULT_TUNING, {
      onState: (state) => {
        seen.set(gymsCleared(state), backpackCapacity(partyCapacity(state), state.tuning));
      },
    });

    expect(seen.size).toBeGreaterThan(1);
    for (const [gyms, bag] of seen) {
      expect(bag, `bag at ${gyms} gyms`).toBe(
        partyCapacityAfter(gyms) + DEFAULT_TUNING.backpackSlack,
      );
    }
  }, 120_000);
});

describe('the party never exceeds its slots, over a played run', () => {
  it('stays within live capacity at every transition, and grows past the opening width', async () => {
    let peak = 0;
    let over = 0;
    let peakCapacity = 0;

    await playRun('SLOTS-C3', capturePolicy(), DEFAULT_TUNING, {
      onState: (state) => {
        peak = Math.max(peak, state.party.length);
        peakCapacity = Math.max(peakCapacity, partyCapacity(state));
        if (state.party.length > partyCapacity(state)) over++;
      },
    });

    expect(over, 'a party was wider than the slots it had').toBe(0);
    // The run has to actually reach an unlock, or the assertion above is vacuous.
    expect(peakCapacity).toBeGreaterThan(partyCapacityAfter(0));
    expect(peak).toBeGreaterThan(1);
  }, 120_000);
});

// ---------------------------------------------------------------------------
// 3. The difficulty curve reads the same schedule
// ---------------------------------------------------------------------------

describe('the curve and the schedule are one number asked once', () => {
  it('never assumes a party wider than the slots that segment has', () => {
    /*
     * The Stage 4 finding, held under a moving ceiling. `expectedPartySize` is
     * what the player is *measured* to field and `partyCapacityAfter` is what they
     * are *allowed*; the first may never exceed the second, or every opponent in
     * that segment is sized against a party that cannot exist.
     */
    for (let segment = 0; segment < SEGMENTS_PER_RUN; segment++) {
      expect(expectedPartySize(segment), `segment ${segment}`).toBeLessThanOrEqual(
        partyCapacityAfter(segment),
      );
      expect(expectedPartySize(segment)).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps the opening segments exactly where 4.6c measured them', () => {
    // Decision 4: segments 0-3 unchanged, so the early benchmark rows stay
    // comparable across this patch and a move in them means something else broke.
    expect([0, 1, 2, 3].map(expectedPartySize)).toEqual([1, 2, 2, 3]);
  });

  it('always leaves the clamp headroom, so the tier gradient cannot flatten', () => {
    /*
     * **The invariant that forced the curve's last row down, stated as a rule
     * rather than as the number 5.**
     *
     * `opponentTeamSize` is `min(MAX_TEAM_SIZE, assumed + advantage)`. If the
     * curve ever assumes `MAX_TEAM_SIZE`, the clamp binds for every tier at once
     * and a normal, a hard and an elite node all field the same team — which is
     * Stage 3's whole risk gradient gone at the end of a run. The slot schedule
     * may reach six; what the curve *assumes* may not.
     *
     * Written against both constants by name so that raising either one fails
     * here, rather than silently flattening the endgame and being noticed by
     * `tiers.test.ts` a stage later.
     */
    for (let segment = 0; segment < SEGMENTS_PER_RUN; segment++) {
      expect(expectedPartySize(segment), `segment ${segment} leaves the clamp no room`).toBeLessThan(
        MAX_TEAM_SIZE,
      );
    }
  });

  it('keeps the tiers ordered by team size wherever the clamp is not binding', () => {
    // The gradient this protects, read directly: an elite node fields more than
    // an ordinary one at every segment, which is the reason to take one.
    for (let segment = 0; segment < SEGMENTS_PER_RUN; segment++) {
      const normal = opponentTeamSize('trainer', segment, 'normal');
      const elite = opponentTeamSize('trainer', segment, 'elite');
      expect(elite, `segment ${segment}: elite does not out-number normal`).toBeGreaterThan(normal);
    }
  });

  it('keeps opponent teams clamped to the sim\'s six at every segment and tier', () => {
    for (let segment = 0; segment < SEGMENTS_PER_RUN; segment++) {
      for (const tier of ['normal', 'hard', 'elite'] as const) {
        for (const kind of ['wild', 'trainer', 'gym'] as const) {
          const size = opponentTeamSize(kind, segment, tier);
          expect(size, `${kind}/${tier}/seg${segment}`).toBeGreaterThanOrEqual(1);
          expect(size).toBeLessThanOrEqual(6);
        }
      }
    }
  });
});

/**
 * A policy that takes every Pokemon it is offered while the run has room.
 *
 * The floor on competent play, and the only policy that exercises a growing
 * roster: one that declined would keep the party at its starter and every
 * assertion about capacity above the opening width would pass vacuously. It reads
 * the capacity `playRun` hands it, which is itself part of what is under test —
 * a policy asking a constant is the sim-side half of the same bug.
 */
function capturePolicy(): RunPolicy {
  const base = scriptedRunPolicy(greedyAiPolicy);
  return {
    ...base,
    chooseAcquisition: async (_offer, party, capacity) =>
      hasRoom(party, capacity) ? { kind: 'accept' } : { kind: 'decline' },
  };
}
