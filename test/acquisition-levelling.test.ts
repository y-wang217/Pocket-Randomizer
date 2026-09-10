/**
 * Stage 4.7, Part 8: what level a Pokemon joins the party at, and stays at.
 *
 * **The rule, in one sentence.** Anything entering the party after run start
 * arrives at the segment's player level from `data/scaling.ts`, and every
 * member re-normalizes to the segment level at each segment boundary. Only the
 * level moves.
 *
 * **What it replaced.** 4.6a's "the captured Pokemon arrives at the level and
 * moveset it was fought with", which read as generosity and was the opposite. A
 * wild encounter is drawn at `playerLevel + levelOffset.wild`, and that offset
 * runs from -11 in segment 0 to -26 in segment 7 — so a capture in segment 3
 * joined a party of 48s at level 28 to 32 and stayed there until the next gym
 * fell. It could not fight the segment's gym, which is the one fight in the
 * segment where a party slot is worth anything.
 *
 * **What is deliberately not asserted here** is that this made capture better.
 * It is a correctness fix: the tax was invisible, unchooseable and paid at the
 * worst moment. `docs/balance.md` §12 has the measurement and the finding that
 * the swap problem it was hypothesised to cause is *not* caused by this.
 *
 * The two headline cases are asserted over many seeds rather than one, because
 * both are properties of every acquisition in every run rather than of a
 * fixture — and because a level rule that holds on one seed and not another is
 * exactly the failure a single-seed test cannot see.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { hasRoom, joinLevelFor } from '../src/core/acquisition';
import { playRun, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import type { PokemonState } from '../src/core/types';
import { playerLevel } from '../src/data/scaling';
import { DEFAULT_TUNING } from '../src/data/tuning';

/** Takes every capture offered, releasing its lowest-level member when full. */
function catcher(): RunPolicy {
  return {
    ...scriptedRunPolicy(greedyAiPolicy),
    chooseNode: async (options) => {
      const wild = options.findIndex((option) => option.kind === 'wild');
      return wild === -1 ? 0 : wild;
    },
    chooseAcquisition: async (_offer, party) => {
      if (hasRoom(party)) return { kind: 'accept' };
      let lowest = 0;
      party.forEach((member, index) => {
        if (member.spec.level < (party[lowest]?.spec.level ?? 0)) lowest = index;
      });
      return { kind: 'release', slot: lowest };
    },
  };
}

const SEEDS = ['LEVEL-A', 'LEVEL-B', 'LEVEL-C', 'LEVEL-D', 'LEVEL-E', 'LEVEL-F'];

/**
 * A stable identity for a party member across node boundaries.
 *
 * **Not object identity.** `betweenNodes` and `levelParty` rebuild every member
 * on every boundary, so `party[0]` is a different object after every node and a
 * `Set<PokemonState>` treats the whole party as newly arrived each time. The
 * first draft of these tests did exactly that, and the failure it produced —
 * asserting full HP on a member that had been fighting for two segments —
 * is the reason this is written down rather than inlined.
 */
function keyOf(member: PokemonState): string {
  return `${member.spec.species}@${member.joinedSegment}`;
}

describe('joinLevelFor', () => {
  it('is the segment player level, with no discount and no premium', () => {
    for (let segment = 0; segment < 8; segment++) {
      expect(joinLevelFor(segment)).toBe(playerLevel(segment));
    }
  });
});

describe('an acquired Pokemon', () => {
  it('arrives at the segment player level, over many seeds', async () => {
    /*
     * Test 10. Watched through `onState`, because the level a member arrives at
     * is only observable in the window between the acquisition and the next gym
     * — after that, `levelParty` would have corrected it and a test reading the
     * final party could not tell a normalization from a re-level.
     */
    let joins = 0;

    for (const seed of SEEDS) {
      const seen = new Set<string>();

      await playRun(seed, catcher(), DEFAULT_TUNING, {
        onState: (state) => {
          for (const member of state.party) {
            if (member.joinedSegment === 0) continue; // the starter
            if (seen.has(keyOf(member))) continue;
            seen.add(keyOf(member));
            joins++;
            expect(
              member.spec.level,
              `${member.spec.species} joined in segment ${member.joinedSegment} at ${member.spec.level}`,
            ).toBe(playerLevel(state.currentSegment));
          }
        },
      });
    }

    expect(joins, 'no seed in the sample ever acquired anything').toBeGreaterThan(0);
  }, 300_000);

  it('keeps its moveset, ability and item through the normalization', async () => {
    /*
     * The other half of test 10, and the reason the rule says "only the level
     * moves". Re-rolling a caught Pokemon's moves at the new level would turn a
     * capture into a second reward draw, and would mean the Pokemon the player
     * took is not the one they watched fight.
     *
     * Asserted against the *offer* the run recorded rather than against the
     * dex, so it fails if anything at all is regenerated on the way in.
     */
    let checked = 0;

    for (const seed of SEEDS.slice(0, 3)) {
      const offers = new Map<string, { ability: string; moves: readonly string[] }>();
      const base = catcher();
      const policy: RunPolicy = {
        ...base,
        chooseAcquisition: async (offer, party) => {
          offers.set(offer.spec.species, {
            ability: offer.spec.ability,
            moves: [...offer.spec.moves],
          });
          return base.chooseAcquisition(offer, party);
        },
      };

      const seen = new Set<string>();

      await playRun(seed, policy, DEFAULT_TUNING, {
        onState: (state) => {
          for (const member of state.party) {
            if (member.joinedSegment === 0) continue;
            if (seen.has(keyOf(member))) continue;
            seen.add(keyOf(member));
            const offered = offers.get(member.spec.species);
            if (!offered) continue;
            checked++;
            expect(member.spec.ability).toBe(offered.ability);
            expect(member.spec.moves).toEqual(offered.moves);
            // The HP bar is rebuilt at the new level rather than relabelled,
            // which is what makes the level change a real one. The first state
            // a joined member appears in is the one `resolveNode` just
            // returned, so it has not fought yet.
            expect(member.maxHp).toBeGreaterThan(0);
            expect(member.hp).toBe(member.maxHp);
          }
        },
      });
    }

    expect(checked).toBeGreaterThan(0);
  }, 300_000);
});

describe('the whole party', () => {
  it('is at the segment player level at the start of every segment, over many seeds', async () => {
    /*
     * Test 11. This one held before 4.7 as well — `party.levelParty` has
     * re-levelled the whole party on every gym clear since Stage 2, which is
     * why `data/partyTuning.ts` says there is no bench experience to model.
     *
     * It is asserted anyway, and the reason is Part 8: the level tax was
     * *transient* precisely because this rule existed, which made it invisible
     * to anyone reading the final party. A regression here would restore the
     * tax permanently rather than for one segment, and nothing else in the
     * suite is looking.
     *
     * The check runs at position 0 of a segment, which is the state right after
     * a gym fell and before any node of the new segment has been walked.
     */
    let checkedSegments = 0;

    for (const seed of SEEDS) {
      const checkedFor = new Set<number>();

      await playRun(seed, catcher(), DEFAULT_TUNING, {
        onState: (state) => {
          if (state.outcome) return;
          if (state.position !== 0) return;
          // `onState` also fires at run creation, before a starter is chosen.
          if (state.party.length === 0) return;
          if (checkedFor.has(state.currentSegment)) return;
          checkedFor.add(state.currentSegment);
          checkedSegments++;

          for (const member of state.party) {
            expect(
              member.spec.level,
              `${member.spec.species} at the top of segment ${state.currentSegment}`,
            ).toBe(playerLevel(state.currentSegment));
          }
        },
      });
    }

    expect(checkedSegments).toBeGreaterThan(SEEDS.length);
  }, 300_000);
});
