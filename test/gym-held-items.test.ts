/**
 * Items on gym leaders' Pokemon. **The R19 rulings, item 5.**
 *
 * The request was three sentences and each one is a separate assertion here:
 *
 *   1. *"lets add battle items at random for now and do item scaling: leftovers
 *      is much stronger than expert belt for example"* — a gym leader holds
 *      something, and what it holds gets better as the run goes on.
 *   2. *"If we already have scaling, just use the same bands."* — we did, and it
 *      is the same bands: the ladder is `PREMIUM_ITEMS`, `GOOD_ITEMS`,
 *      `MODEST_ITEMS`, `TYPE_ITEMS` and `CHOICE_ITEMS`, the lists the reward
 *      pools already grade themselves with, read against segment instead of
 *      against node tier.
 *   3. *"Gym 8 should have 6 mons w 6 battle items equipped"* — asserted as the
 *      sentence, not as the number that happens to produce it.
 *
 * **And the thing that makes it a data change rather than a version bump**: a
 * trainer and a wild Pokemon generate byte-identically to what they generated
 * before any of this existed. `rollHeldItem` spends the same two draws in the
 * same order it spent as `rollBerry`, so the only thing that moved is what the
 * gym column reads out of them.
 */
import { describe, expect, it } from 'vitest';

import { createHash } from 'node:crypto';

import { generateGymTeam, generateTrainerTeam, generateWildTeam } from '../src/core/randomizer';
import { createRng } from '../src/core/rng';
import type { Tier } from '../src/core/types';
import { GYMS } from '../src/data/gyms';
import {
  BERRIES,
  CHOICE_ITEMS,
  GYM_ITEM_BANDS,
  GOOD_ITEMS,
  heldItemPoolFor,
  itemById,
  MODEST_ITEMS,
  PREMIUM_ITEMS,
  TYPE_ITEMS,
} from '../src/data/items';
import { HELD_ITEM_RATE, heldItemRate, opponentTeamSize, SEGMENT_COUNT } from '../src/data/scaling';

const ids = (entries: readonly { id: string }[]): Set<string> => new Set(entries.map((e) => e.id));

/** Every gym team at a segment, across enough seeds to see the rate. */
function gymTeamsAt(segment: number, seeds = 400): { species: string; item?: string }[] {
  const out: { species: string; item?: string }[] = [];
  for (let s = 0; s < seeds; s++) {
    const stream = createRng(`GYM-ITEMS-${s}`).randomizer.at(`gym-${segment}`);
    for (const spec of generateGymTeam(GYMS[segment]!, segment, stream)) {
      out.push({ species: spec.species, ...(spec.item === undefined ? {} : { item: spec.item }) });
    }
  }
  return out;
}

describe('the gym held-item ladder', () => {
  it('gives gym 8 a full roster with every member holding something', () => {
    const segment = SEGMENT_COUNT - 1;
    /*
     * The ruling's sentence, both halves. Six is not written down here: it is
     * read from `opponentTeamSize`, so a schedule change that widened or
     * narrowed the last gym would fail this on the half it actually broke.
     */
    expect(opponentTeamSize('gym', segment, 'normal')).toBe(6);
    for (let s = 0; s < 60; s++) {
      const stream = createRng(`GYM-8-${s}`).randomizer.at('gym-last');
      const team = generateGymTeam(GYMS[segment]!, segment, stream);
      expect(team).toHaveLength(6);
      for (const spec of team) {
        expect(spec.item, `${spec.species} at gym 8 holds nothing`).toBeDefined();
      }
    }
  });

  it('climbs: a later gym leader holds something more often than an earlier one', () => {
    const held = (segment: number): number => {
      const team = gymTeamsAt(segment, 200);
      return team.filter((m) => m.item !== undefined).length / team.length;
    };
    const first = held(0);
    const last = held(SEGMENT_COUNT - 1);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(0.45);
    expect(last).toBe(1);
    // Monotonic in the table, which is the claim the measurement samples.
    for (let segment = 1; segment < SEGMENT_COUNT; segment++) {
      expect(heldItemRate('gym', segment), `segment ${segment}`).toBeGreaterThanOrEqual(
        heldItemRate('gym', segment - 1),
      );
    }
  });

  it('runs the gym column against the other two, which still descend', () => {
    expect(heldItemRate('gym', 0)).toBeLessThan(heldItemRate('gym', SEGMENT_COUNT - 1));
    expect(heldItemRate('trainer', 0)).toBeGreaterThan(heldItemRate('trainer', SEGMENT_COUNT - 1));
    expect(heldItemRate('wild', 0)).toBeGreaterThan(heldItemRate('wild', SEGMENT_COUNT - 1));
  });

  /*
   * The scaling claim, stated the way the ruling stated it. Expert Belt is a
   * `GOOD_ITEMS` entry and Leftovers is a `PREMIUM_ITEMS` entry, and the ladder
   * has to reach them in that order or "item scaling" means nothing.
   */
  it('reaches Expert Belt before it reaches Leftovers', () => {
    const firstSegmentHolding = (id: string): number =>
      GYM_ITEM_BANDS.findIndex((band) => band.some((entry) => entry.id === id));
    const expertBelt = firstSegmentHolding('expertbelt');
    const leftovers = firstSegmentHolding('leftovers');
    expect(expertBelt).toBeGreaterThanOrEqual(0);
    expect(leftovers).toBeGreaterThan(expertBelt);
  });

  it('draws only from lists the reward pools already grade themselves with', () => {
    const known = new Set([
      ...ids(PREMIUM_ITEMS),
      ...ids(GOOD_ITEMS),
      ...ids(MODEST_ITEMS),
      ...ids(TYPE_ITEMS),
      ...ids(CHOICE_ITEMS),
      'sitrusberry',
    ]);
    for (const band of GYM_ITEM_BANDS) {
      // Two lists minimum, so a segment never offers one predictable item.
      expect(band.length).toBeGreaterThan(2);
      for (const entry of band) {
        expect(known.has(entry.id), `${entry.id} is not on any graded list`).toBe(true);
        expect(itemById(entry.id), `${entry.id} is not on the whitelist`).not.toBeNull();
      }
    }
  });

  /*
   * The ruling named the item — "heal 1/4 hp berry is top tier" — and it
   * already existed, so nothing was looked up to replace it. It belongs to the
   * top band and to no other.
   */
  it('puts the 1/4-max-HP berry in the top band and nowhere else', () => {
    const sitrus = BERRIES.find((entry) => entry.id === 'sitrusberry');
    expect(sitrus?.restores?.fraction).toBe(0.25);
    const bands = GYM_ITEM_BANDS.map((band) => band.some((entry) => entry.id === 'sitrusberry'));
    expect(bands.at(-1)).toBe(true);
    expect(bands.filter(Boolean).length).toBeLessThan(bands.length);
    expect(bands[0]).toBe(false);
  });

  it('leaves a trainer and a wild Pokemon drawing from the berry list alone', () => {
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      expect(heldItemPoolFor('trainer', segment)).toBe(BERRIES);
      expect(heldItemPoolFor('wild', segment)).toBe(BERRIES);
    }
  });

  /**
   * **The proof that this cost no version bump.**
   *
   * Recorded against the tree before `rollHeldItem` existed, when the function
   * was `rollBerry` and drew from `BERRIES` for every kind. If a future change
   * moves a trainer or a wild team by so much as one field, this fails and the
   * change owes `RANDOMIZER_VERSION` a bump — which is the whole point of
   * writing the digest down rather than asserting a property of it.
   *
   * **Re-recorded once, and the bump it demanded was paid.** The user-locked
   * move cut took Aura Wheel, Hyperspace Fury and Double Shock out of
   * `data/movePools.ts`, so a pick that used to land on one of them lands
   * elsewhere and the teams here moved from `68f5b8e9ec48a07f`.
   * `gymrun-randomizer-22` and a `contentHash` move arrive in the same commit,
   * which is this assertion working rather than being worked around.
   *
   * Two recordings that did **not** move are worth naming beside it, because
   * together they say where the cut reaches: `test/fixtures/sim-report.json`
   * and all six records in `docs/visual/baseline/runs/` are byte identical but
   * for their stamps. Those play early segments, which draw bands 1 to 3; all
   * three cut moves are band 4 and 5, and this digest is the thing that sweeps
   * every segment and every tier.
   */
  it('generates trainer and wild teams byte-identically to before the ladder existed', () => {
    const records: string[] = [];
    for (let s = 0; s < 300; s++) {
      for (let seg = 0; seg < 8; seg++) {
        for (const tier of ['normal', 'hard', 'elite'] as Tier[]) {
          records.push(
            JSON.stringify(
              generateTrainerTeam(seg, tier, createRng(`BASE${s}`).randomizer.at(`t-${seg}-${tier}`)),
            ),
          );
          records.push(
            JSON.stringify(
              generateWildTeam(seg, tier, createRng(`BASE${s}`).randomizer.at(`w-${seg}-${tier}`)),
            ),
          );
        }
      }
    }
    const digest = createHash('sha256').update(records.join('\n')).digest('hex').slice(0, 16);
    expect(digest).toBe('515570045bb4d9af');
  });

  it('spends the same two draws on a gym member as on any other opponent', () => {
    const cost = (segment: number, build: (stream: ReturnType<typeof at>) => unknown): number => {
      const stream = at(`draws-${segment}`);
      build(stream);
      return stream.draws;
    };
    const at = (key: string): ReturnType<ReturnType<typeof createRng>['randomizer']['at']> =>
      createRng('GYM-DRAW-COST').randomizer.at(key);
    /*
     * One gym member against one trainer member at a segment where both field
     * the same roster size, so the totals are comparable without arithmetic.
     * The rate differs and the pool differs; the count must not.
     */
    const segment = 3;
    const size = opponentTeamSize('gym', segment, 'normal');
    const gymDraws = cost(segment, (s) => generateGymTeam(GYMS[segment]!, segment, s));
    const trainerDraws = cost(segment, (s) => generateTrainerTeam(segment, 'normal', s));
    const trainerSize = opponentTeamSize('trainer', segment, 'normal');
    expect(gymDraws / size).toBe(trainerDraws / trainerSize);
  });

  it('keeps a row per segment, so the clamp is never what decides a gym', () => {
    expect(HELD_ITEM_RATE).toHaveLength(SEGMENT_COUNT);
    expect(GYM_ITEM_BANDS).toHaveLength(SEGMENT_COUNT);
  });
});
